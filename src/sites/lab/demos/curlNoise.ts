/**
 * Л·02 «CURL-ШУМ» — бездивергентное поле из разностной производной шума.
 *
 * Шум играет роль функции тока ψ; скорость частиц — ротор ψ, посчитанный
 * центральными разностями. У такого поля нет источников и стоков, поэтому
 * частицы «текут несжимаемо»: не слипаются и не разбегаются. Псевдо-3D —
 * тонировка и толщина линии по скорости: «ближе к камере» = быстрее.
 */

import { clamp, lerp, mulberry32, valueNoise2D } from '@/lib/lab/math'
import { numParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

const MAX_COUNT = 2800
const BINS = 20
/** тёмная слива → маджента → кость (скорость = «глубина») */
const RAMP_STOPS: readonly (readonly [number, number, number])[] = [
  [46, 14, 40],
  [148, 36, 122],
  [232, 79, 208],
  [248, 236, 245],
]

function rampColor(t: number): string {
  const x = clamp(t, 0, 1) * (RAMP_STOPS.length - 1)
  const i0 = Math.min(Math.floor(x), RAMP_STOPS.length - 2)
  const a = RAMP_STOPS[i0]
  const b = RAMP_STOPS[i0 + 1]
  const lt = x - i0
  return `rgb(${Math.round(lerp(a[0], b[0], lt))},${Math.round(lerp(a[1], b[1], lt))},${Math.round(
    lerp(a[2], b[2], lt),
  )})`
}
const RAMP = Array.from({ length: BINS }, (_, i) => rampColor(i / (BINS - 1)))

export const curlNoiseDemo: DemoModule = {
  id: 'curl',
  title: 'Curl-шум',
  latin: 'CURL NOISE',
  category: 'fields',
  description:
    'Бездивергентное поле: шум — функция тока, скорость — его ротор через разностную производную. Частицы текут несжимаемо, как жидкость: линии тока не сходятся и не рвутся. Цвет и толщина линии — псевдо-3D по скорости.',
  tech: 'canvas 2d · curl of value noise (central differences) · линии тока',
  params: [
    { key: 'freq', label: 'Частота', kind: 'range', min: 0.6, max: 3, step: 0.05, value: 1.5 },
    { key: 'force', label: 'Сила', kind: 'range', min: 0.2, max: 2.4, step: 0.05, value: 1 },
    { key: 'count', label: 'Плотность частиц', kind: 'range', min: 400, max: 2800, step: 200, value: 1600 },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    const rng = mulberry32(7702)
    const px = new Float32Array(MAX_COUNT)
    const py = new Float32Array(MAX_COUNT)
    const vx = new Float32Array(MAX_COUNT)
    const vy = new Float32Array(MAX_COUNT)
    const life = new Float32Array(MAX_COUNT)

    let w = 1
    let h = 1
    let count = numParam(params, 'count', 1600)
    let freq = numParam(params, 'freq', 1.5)
    let force = numParam(params, 'force', 1)
    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }

    const spawn = (i: number): void => {
      px[i] = rng() * w
      py[i] = rng() * h
      vx[i] = 0
      vy[i] = 0
      life[i] = 3 + rng() * 6
    }

    const resize = (): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, canvas.clientWidth)
      h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * dpr)
      const bh = Math.round(h * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#0c0910'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < MAX_COUNT; i++) spawn(i)
      if (opts.reduced) drawStatic()
    }

    /**
     * Скорость curl-поля в точке. ψ — value noise с октавами;
     * ротор в 2D: v = (∂ψ/∂y, −∂ψ/∂x), производные — центральные разности.
     */
    const EPS = 0.28 // шаг разности в клетках шума
    function curlAt(x: number, y: number, out: { x: number; y: number }): void {
      const nx = x * 0.006 * freq
      const ny = y * 0.006 * freq
      const dpdy = valueNoise2D(nx, ny + EPS, 3) - valueNoise2D(nx, ny - EPS, 3)
      const dpdx = valueNoise2D(nx + EPS, ny, 3) - valueNoise2D(nx - EPS, ny, 3)
      out.x = dpdy
      out.y = -dpdx
    }

    const tmp = { x: 0, y: 0 }

    /** Reduced-motion: тонкие интегральные линии тока по полю. */
    function drawStatic(): void {
      ctx.fillStyle = '#0c0910'
      ctx.fillRect(0, 0, w, h)
      ctx.lineWidth = 0.8
      const stepLen = 2.6
      for (let i = 0; i < count; i += 4) {
        let x = px[i]
        let y = py[i]
        curlAt(x, y, tmp)
        const sp0 = Math.hypot(tmp.x, tmp.y)
        ctx.strokeStyle = RAMP[clamp((sp0 * 2.2) * (BINS - 1), 0, BINS - 1) | 0]
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.moveTo(x, y)
        for (let s = 0; s < 16; s++) {
          curlAt(x, y, tmp)
          const m = Math.hypot(tmp.x, tmp.y) || 1e-5
          x += (tmp.x / m) * stepLen
          y += (tmp.y / m) * stepLen
          if (x < 0 || x > w || y < 0 || y > h) break
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    function step(dt: number): void {
      // очень лёгкое затухание: линии тока накапливаются шёлковыми нитями
      ctx.fillStyle = 'rgba(12,9,16,0.045)'
      ctx.fillRect(0, 0, w, h)

      const bins: number[][] = Array.from({ length: BINS }, () => [])
      const binsW = new Float32Array(BINS)
      const mouseIn = pointer.x > -9000
      const R = 80
      const R2 = R * R

      for (let i = 0; i < count; i++) {
        curlAt(px[i], py[i], tmp)
        let sx = tmp.x * force * 120
        let sy = tmp.y * force * 120
        if (mouseIn) {
          const dx = px[i] - pointer.x
          const dy = py[i] - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < R2 && d2 > 1) {
            const d = Math.sqrt(d2)
            const s = (1 - d / R) * 160 * (pointer.down ? 2.5 : 1)
            sx += (-dy / d) * s
            sy += (dx / d) * s
          }
        }
        vx[i] = vx[i] * 0.86 + sx * 0.14
        vy[i] = vy[i] * 0.86 + sy * 0.14
        const ox = px[i]
        const oy = py[i]
        px[i] += vx[i] * dt
        py[i] += vy[i] * dt
        life[i] -= dt
        const outside = px[i] < 0 || px[i] > w || py[i] < 0 || py[i] > h
        if (outside || life[i] <= 0) {
          spawn(i)
          continue
        }
        // псевдо-3D: скорость → «глубина» → цвет и толщина
        const sp = Math.hypot(vx[i], vy[i]) / (force * 190 + 1e-4)
        const bin = clamp((sp * 1.15 * (BINS - 1)) | 0, 0, BINS - 1)
        bins[bin].push(ox, oy, px[i], py[i])
        binsW[bin] = Math.max(binsW[bin], clamp(sp, 0, 1))
      }

      for (let bi = 0; bi < BINS; bi++) {
        const b = bins[bi]
        if (b.length === 0) continue
        ctx.strokeStyle = RAMP[bi]
        ctx.globalAlpha = lerp(0.16, 0.6, bi / (BINS - 1))
        ctx.lineWidth = lerp(0.5, 1.8, binsW[bi])
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

    return {
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
        if (key === 'freq') freq = value
        else if (key === 'force') force = value
        else if (key === 'count') {
          count = Math.min(MAX_COUNT, Math.max(200, Math.round(value)))
          for (let i = 0; i < MAX_COUNT; i++) if (life[i] === 0) spawn(i)
        }
      },
      resize,
      destroy() {
        /* чистить нечего: слушателей и GPU-ресурсов нет */
      },
    }
  },
}
