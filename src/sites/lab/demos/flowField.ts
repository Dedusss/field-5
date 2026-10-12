/**
 * Л·01 «ПОЛЕ ПОТОКА» — 2200 частиц в поле углов из value noise.
 *
 * Поле углов: шум задаёт направление движения напрямую (без векторного
 * сложения), поэтому хвосты сплетаются в непрерывную «ткань». Хвосты —
 * классический трюк с полупрозрачной заливкой фона поверх прошлого кадра.
 * Курсор вкручивает в ткань локальный вихрь.
 */

import { lerp, mulberry32, valueNoise2D } from '@/lib/lab/math'
import { numParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

/** Подгоняет 2D-канвас под CSS-размер с DPR-капом 2 (общий приём демо). */
function fit(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, canvas.clientWidth)
  const h = Math.max(1, canvas.clientHeight)
  const bw = Math.round(w * dpr)
  const bh = Math.round(h * dpr)
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw
    canvas.height = bh
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { w, h }
}

/** Собирает градиентную палитру из hex-остановок (общий приём демо). */
function buildRamp(stops: string[], n: number): string[] {
  const cols = stops.map((hex) => {
    const v = parseInt(hex.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const
  })
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * (cols.length - 1)
    const i0 = Math.min(Math.floor(t), cols.length - 2)
    const a = cols[i0]
    const b = cols[i0 + 1]
    const lt = t - i0
    out.push(
      `rgb(${Math.round(lerp(a[0], b[0], lt))},${Math.round(lerp(a[1], b[1], lt))},${Math.round(
        lerp(a[2], b[2], lt),
      )})`,
    )
  }
  return out
}

const COUNT = 2200
const BINS = 24
/** слива → маджента → кость: цвета категории «поля» */
const RAMP = buildRamp(['#42133a', '#e84fd0', '#f8ecf5'], BINS)

export const flowFieldDemo: DemoModule = {
  id: 'flow',
  title: 'Поле потока',
  latin: 'FLOW FIELD',
  category: 'fields',
  description:
    'Две с лишним тысячи частиц скользят по полю углов, сваренному из value noise: направление задаёт сам шум, поэтому хвосты сплетаются в непрерывную ткань. Курсор вкручивает в неё локальный вихрь.',
  tech: 'canvas 2d · value noise → поле углов · хвосты полупрозрачной заливкой',
  params: [
    { key: 'scale', label: 'Масштаб шума', kind: 'range', min: 0.6, max: 3.2, step: 0.05, value: 1.6 },
    { key: 'speed', label: 'Скорость', kind: 'range', min: 12, max: 140, step: 1, value: 58 },
    { key: 'tail', label: 'Длина хвоста', kind: 'range', min: 0, max: 1, step: 0.01, value: 0.62 },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    const rng = mulberry32(1402)
    const px = new Float32Array(COUNT)
    const py = new Float32Array(COUNT)
    const ppx = new Float32Array(COUNT)
    const ppy = new Float32Array(COUNT)
    const bins: number[][] = Array.from({ length: BINS }, () => [])

    let w = 1
    let h = 1
    let scale = numParam(params, 'scale', 1.6)
    let speed = numParam(params, 'speed', 58)
    let tail = numParam(params, 'tail', 0.62)
    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }

    const seed = (): void => {
      for (let i = 0; i < COUNT; i++) {
        px[i] = rng() * w
        py[i] = rng() * h
        ppx[i] = px[i]
        ppy[i] = py[i]
      }
    }

    const resize = (): void => {
      const f = fit(canvas, ctx)
      w = f.w
      h = f.h
      ctx.fillStyle = '#0d0a0c'
      ctx.fillRect(0, 0, w, h)
      seed()
      if (opts.reduced) drawStatic()
    }

    /** Угол поля в точке: шум напрямую становится направлением. */
    const angleAt = (x: number, y: number): number =>
      valueNoise2D(x * 0.0042 * scale, y * 0.0042 * scale) * Math.PI * 4

    /** Reduced-motion: штрихи-линии тока рисуют структуру поля одним кадром. */
    function drawStatic(): void {
      ctx.fillStyle = '#0d0a0c'
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 1
      ctx.globalAlpha = 0.55
      for (let i = 0; i < COUNT; i += 3) {
        let x = px[i]
        let y = py[i]
        ctx.strokeStyle = RAMP[(valueNoise2D(x * 0.0042 * scale, y * 0.0042 * scale) * (BINS - 1)) | 0]
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let s = 0; s < 9; s++) {
          const a = angleAt(x, y)
          x += Math.cos(a) * 2.4
          y += Math.sin(a) * 2.4
          if (x < 0 || x > w || y < 0 || y > h) break
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    function step(dt: number): void {
      // Хвосты: чуть притушить прошлый кадр — чем меньше альфа, тем длиннее память.
      const fade = lerp(0.3, 0.022, tail)
      ctx.fillStyle = `rgba(13,10,12,${fade})`
      ctx.fillRect(0, 0, w, h)

      for (const b of bins) b.length = 0
      const mouseIn = pointer.x > -9000
      const R = 92
      const R2 = R * R
      const swirlBoost = pointer.down ? 2.4 : 1

      for (let i = 0; i < COUNT; i++) {
        const n = valueNoise2D(px[i] * 0.0042 * scale, py[i] * 0.0042 * scale)
        const a = n * Math.PI * 4
        let vx = Math.cos(a) * speed
        let vy = Math.sin(a) * speed
        if (mouseIn) {
          const dx = px[i] - pointer.x
          const dy = py[i] - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < R2 && d2 > 1) {
            const d = Math.sqrt(d2)
            const s = (1 - d / R) * speed * 2.6 * swirlBoost
            // тангенциальная составляющая — вихрь; лёгкий выброс наружу
            vx += (-dy / d) * s + (dx / d) * s * 0.3
            vy += (dx / d) * s + (dy / d) * s * 0.3
          }
        }
        ppx[i] = px[i]
        ppy[i] = py[i]
        px[i] += vx * dt
        py[i] += vy * dt
        // Заворачиваем на краях; на переносе рвём сегмент, чтобы не тянулись линии через весь кадр
        if (px[i] < 0) {
          px[i] += w
          ppx[i] = px[i]
        } else if (px[i] > w) {
          px[i] -= w
          ppx[i] = px[i]
        }
        if (py[i] < 0) {
          py[i] += h
          ppy[i] = py[i]
        } else if (py[i] > h) {
          py[i] -= h
          ppy[i] = py[i]
        }
        bins[(n * (BINS - 1)) | 0].push(ppx[i], ppy[i], px[i], py[i])
      }

      ctx.lineWidth = 1.1
      for (let bi = 0; bi < BINS; bi++) {
        const b = bins[bi]
        if (b.length === 0) continue
        ctx.strokeStyle = RAMP[bi]
        ctx.globalAlpha = lerp(0.3, 0.62, bi / (BINS - 1))
        ctx.beginPath()
        for (let k = 0; k < b.length; k += 4) {
          ctx.moveTo(b[k], b[k + 1])
          ctx.lineTo(b[k + 2], b[k + 3])
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    resize()

    const inst: DemoInstance = {
      pointer,
      frame(_t, dt) {
        if (opts.reduced) {
          drawStatic()
          return
        }
        step(Math.min(dt, 0.034))
      },
      setParam(key, value) {
        if (typeof value !== 'number') return
        if (key === 'scale') scale = value
        else if (key === 'speed') speed = value
        else if (key === 'tail') tail = value
      },
      resize,
      destroy() {
        /* у демо нет слушателей и WebGL — чистить нечего */
      },
    }
    return inst
  },
}
