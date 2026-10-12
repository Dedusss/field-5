/**
 * Л·05 «ОБРАТНАЯ СВЯЗЬ» — canvas как аналоговая память.
 *
 * Каждый кадр канвас накладывается сам на себя с альфой затухания
 * (drawImage scale 1.0 + composite 'copy'), и поверх доливается новый свет.
 * Прошлые кадры живут в пикселях — так растут шлейфы. Курсор — кисть:
 * точки или нити, которые тают по закону затухания.
 */

import { clamp, lerp } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

export const feedbackDemo: DemoModule = {
  id: 'feedback',
  title: 'Обратная связь',
  latin: 'FEEDBACK BUFFER',
  category: 'shaders',
  description:
    'Канвас помнит себя: каждый кадр накладывается сам на себя с затуханием, и прошлый свет продолжает жить в пикселях. Светящийся маятник-пульсатор плетёт шлейфы, а курсор работает кистью — след тает по закону затухания.',
  tech: 'canvas 2d · feedback (self drawImage × alpha) · additive glow · lissajous-маятник',
  params: [
    { key: 'decay', label: 'Затухание', kind: 'range', min: 0.8, max: 0.985, step: 0.005, value: 0.93 },
    { key: 'glow', label: 'Свечение', kind: 'range', min: 6, max: 48, step: 1, value: 24 },
    { key: 'brush', label: 'Режим кисти', kind: 'select', value: 'dot', options: [
      { value: 'dot', label: 'Точка' },
      { value: 'line', label: 'Линия' },
    ] },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    let w = 1
    let h = 1
    let decay = numParam(params, 'decay', 0.93)
    let glow = numParam(params, 'glow', 24)
    let brush = strParam(params, 'brush', 'dot')
    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }
    let lastBrushX = -1
    let lastBrushY = -1

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, canvas.clientWidth)
      h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * dpr)
      const bh = Math.round(h * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      } else {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      lastBrushX = -1
      if (opts.reduced) paintStatic(4.4)
    }

    /** Светящееся ядро с ореолом (additive). */
    const orb = (x: number, y: number, r: number, hot: number): void => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, `rgba(246,232,198,${0.85 * hot})`)
      g.addColorStop(0.25, `rgba(232,179,77,${0.5 * hot})`)
      g.addColorStop(0.6, `rgba(232,120,77,${0.16 * hot})`)
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = `rgba(255,248,230,${0.95 * hot})`
      ctx.beginPath()
      ctx.arc(x, y, Math.max(1.2, r * 0.06), 0, Math.PI * 2)
      ctx.fill()
    }

    /** Позиция маятника-пульсатора (lissajous + пульс). */
    const pendulum = (t: number): { x: number; y: number; r: number; hot: number } => {
      const x = w * 0.5 + Math.sin(t * 1.05) * w * 0.3
      const y = h * 0.46 + Math.sin(t * 2.12 + 1.2) * h * 0.26
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6)
      return { x, y, r: glow * (0.55 + pulse * 0.7), hot: 0.55 + pulse * 0.45 }
    }

    function paintStatic(t: number): void {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'
      const p = pendulum(t)
      orb(p.x, p.y, p.r, p.hot)
      ctx.globalCompositeOperation = 'source-over'
    }

    function step(t: number): void {
      // Обратная связь: содержимое × затухание через наложение на себя.
      // 'copy' + globalAlpha умножает альфу прошлых кадров — свет умирает медленно.
      ctx.globalCompositeOperation = 'copy'
      ctx.globalAlpha = decay
      ctx.drawImage(canvas, 0, 0, w, h)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'lighter'

      const p = pendulum(t)
      orb(p.x, p.y, p.r, p.hot * lerp(0.5, 1, 0.93))

      // Кисть курсора: точка — штампы, линия — непрерывная нить
      if (pointer.x > -9000) {
        const boost = pointer.down ? 1.8 : 1
        if (brush === 'dot') {
          orb(pointer.x, pointer.y, glow * 0.42 * boost, 0.7 * boost)
        } else if (lastBrushX > -9000) {
          const dx = pointer.x - lastBrushX
          const dy = pointer.y - lastBrushY
          if (dx * dx + dy * dy > 0.5) {
            ctx.strokeStyle = 'rgba(232,179,77,0.5)'
            ctx.lineWidth = clamp(glow * 0.12, 1, 5)
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(lastBrushX, lastBrushY)
            ctx.lineTo(pointer.x, pointer.y)
            ctx.stroke()
          }
        }
        lastBrushX = pointer.x
        lastBrushY = pointer.y
      } else {
        lastBrushX = -1
      }
      ctx.globalCompositeOperation = 'source-over'
    }

    resize()

    return {
      pointer,
      frame(t) {
        if (opts.reduced) {
          paintStatic(4.4)
          return
        }
        step(t)
      },
      setParam(key, value) {
        if (key === 'decay' && typeof value === 'number') decay = value
        else if (key === 'glow' && typeof value === 'number') glow = value
        else if (key === 'brush' && typeof value === 'string') brush = value
      },
      resize,
      destroy() {
        /* чистить нечего */
      },
    }
  },
}
