'use client'

import { useEffect, useRef } from 'react'

/**
 * Фон хаба: медленное поле тлеющей пыли.
 * Спрайт-блум рисуется один раз в offscreen-canvas, частицы — drawImage.
 * Уважает prefers-reduced-motion (один статичный кадр) и visibilitychange.
 */
export default function BackDrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let stopped = false
    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)

    interface Mote {
      x: number
      y: number
      depth: number
      drift: number
      phase: number
      speed: number
    }
    let motes: Mote[] = []

    // Спрайт свечения
    const sprite = document.createElement('canvas')
    sprite.width = 64
    sprite.height = 64
    const sctx = sprite.getContext('2d')
    if (sctx) {
      const g = sctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(240, 196, 128, 0.9)')
      g.addColorStop(0.35, 'rgba(217, 160, 91, 0.35)')
      g.addColorStop(1, 'rgba(217, 160, 91, 0)')
      sctx.fillStyle = g
      sctx.fillRect(0, 0, 64, 64)
    }

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const seed = () => {
      const count = Math.max(140, Math.min(260, Math.round((w * h) / 9000)))
      motes = Array.from({ length: count }, () => {
        const depth = 0.25 + Math.random() * 0.75
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          depth,
          drift: Math.random() * Math.PI * 2,
          phase: Math.random() * Math.PI * 2,
          speed: 6 + depth * 14,
        }
      })
    }

    const field = (x: number, y: number, t: number) =>
      Math.sin(x * 0.0016 + t * 0.12) + Math.cos(y * 0.0013 - t * 0.09) +
      Math.sin((x + y) * 0.0008 + t * 0.05)

    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      for (const m of motes) {
        const a = field(m.x, m.y, t)
        m.x += Math.cos(a) * m.speed * 0.016 * m.depth
        m.y += Math.sin(a) * m.speed * 0.016 * m.depth + 0.06 * m.depth
        if (m.x < -40) m.x = w + 40
        if (m.x > w + 40) m.x = -40
        if (m.y > h + 40) {
          m.y = -40
          m.x = Math.random() * w
        }
        const twinkle = 0.45 + 0.55 * Math.sin(t * 0.7 + m.phase) ** 2
        const size = (5 + m.depth * 22) * twinkle
        ctx.globalAlpha = 0.06 + m.depth * 0.16 * twinkle
        ctx.drawImage(sprite, m.x - size / 2, m.y - size / 2, size, size)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    resize()
    seed()

    if (reduced) {
      draw(1.2)
      return () => {}
    }

    let last = 0
    const loop = (now: number) => {
      if (stopped) return
      if (now - last > 33) {
        last = now
        draw(now / 1000)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onResize = () => {
      resize()
      seed()
    }
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        raf = requestAnimationFrame(loop)
      }
    }

    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 h-full w-full"
    />
  )
}
