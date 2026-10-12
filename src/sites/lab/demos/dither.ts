/**
 * Л·04 «ДИЗЕРИНГ И ПАЛИТРЫ» — процедурный градиент в духе первых принтеров.
 *
 * Поле яркости — fbm с доменным искривлением; при выводе оно квантуется на
 * N ступеней, а остаток рассыпается матрицей Байера 4×4 (ordered dithering).
 * Три палитры-рампы показывают, как дешёвый трюк превращается в эстетику.
 * Рендер компактный (пиксельная сетка) — потому кадр стоит копейки.
 */

import { clamp, lerp, valueNoise2D } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule } from '@/lib/lab/types'

/** Матрица Байера 4×4: пороги дизеринга (0..15) / 16. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** Палитры-рампы: пары hex-остановок. */
const PALETTES: Record<string, string[]> = {
  ember: ['#16120d', '#5c3d1a', '#e8b34d', '#f6ecd2'],
  plum: ['#12070f', '#4a1040', '#e84fd0', '#f9d9f1'],
  moss: ['#04130b', '#0c3b22', '#4ef08a', '#dcf8d9'],
}

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

/** Собирает рампу из stops в levels цветов (Uint8, для ImageData). */
function buildRamp(stops: string[], levels: number): Uint8Array {
  const cols = stops.map(hexToRgb)
  const out = new Uint8Array(levels * 3)
  for (let i = 0; i < levels; i++) {
    const x = (i / Math.max(levels - 1, 1)) * (cols.length - 1)
    const i0 = Math.min(Math.floor(x), cols.length - 2)
    const a = cols[i0]
    const b = cols[i0 + 1]
    const lt = x - i0
    out[i * 3] = Math.round(lerp(a[0], b[0], lt))
    out[i * 3 + 1] = Math.round(lerp(a[1], b[1], lt))
    out[i * 3 + 2] = Math.round(lerp(a[2], b[2], lt))
  }
  return out
}

const IW = 320 // внутренняя ширина (высота — по пропорции): пиксельная фактура

export const ditherDemo: DemoModule = {
  id: 'dither',
  title: 'Дизеринг и палитры',
  latin: 'DITHER + RAMPS',
  category: 'shaders',
  description:
    'Процедурный градиент из fbm квантуется на ступени, а остаток рассыпается матрицей Байера 4×4 — приём времён 8-битных платформ и первых принтеров. Три рампы показывают, как техническое ограничение становится стилем.',
  tech: 'canvas 2d · fbm + domain warp · bayer 4x4 ordered dithering · палитры-рампы',
  params: [
    {
      key: 'palette',
      label: 'Палитра',
      kind: 'select',
      value: 'ember',
      options: [
        { value: 'ember', label: 'Уголь-янтарь' },
        { value: 'plum', label: 'Слива-маджента' },
        { value: 'moss', label: 'Мох' },
      ],
    },
    { key: 'levels', label: 'Ступени', kind: 'range', min: 2, max: 12, step: 1, value: 6 },
    { key: 'scale', label: 'Масштаб fbm', kind: 'range', min: 0.7, max: 3, step: 0.05, value: 1.6 },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    const off = document.createElement('canvas')
    const offCtx0 = off.getContext('2d')
    if (!offCtx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const offCtx = offCtx0

    let palette = strParam(params, 'palette', 'ember')
    let levels = Math.round(numParam(params, 'levels', 6))
    let scale = numParam(params, 'scale', 1.6)

    let iw = IW
    let ih = IW
    let field = new Float32Array(0)
    let img: ImageData | null = null
    let ramp = buildRamp(PALETTES[palette] ?? PALETTES.ember, levels)
    let fieldDirty = true

    const recomputeField = (): void => {
      // fbm с доменным искривлением: поле выглядит как мрамор, а не облако
      for (let y = 0; y < ih; y++) {
        const v = (y / ih) * 3 * scale
        for (let x = 0; x < iw; x++) {
          const u = (x / iw) * 4 * scale
          const wx = valueNoise2D(u * 1.7 + 5.2, v * 1.7 + 1.3, 3)
          const wy = valueNoise2D(u * 1.7 - 3.1, v * 1.7 + 7.7, 3)
          field[y * iw + x] = valueNoise2D(u + (wx - 0.5) * 1.5, v + (wy - 0.5) * 1.5, 4)
        }
      }
    }

    const resize = (): void => {
      const cw = Math.max(1, canvas.clientWidth)
      const ch = Math.max(1, canvas.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      iw = IW
      ih = Math.max(2, Math.round((IW * ch) / cw))
      if (off.width !== iw || off.height !== ih) {
        off.width = iw
        off.height = ih
        field = new Float32Array(iw * ih)
        img = offCtx.createImageData(iw, ih)
        fieldDirty = true
      }
      const bw = Math.round(cw * dpr)
      const bh = Math.round(ch * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = false
      if (fieldDirty) recomputeField()
      if (opts.reduced) render(3.1)
    }

    const rowWave = new Float32Array(IW)
    const colWave = new Float32Array(1024)

    function render(t: number): void {
      if (field.length === 0 || !img) return
      const data = img.data
      const step = 1 / levels
      const lv = levels
      const r = ramp

      // «стоячие волны» через поле: sin-таблицы вместо синуса на пиксель
      for (let x = 0; x < iw; x++) rowWave[x] = Math.sin(x * 0.052 + t * 0.9)
      for (let y = 0; y < ih; y++) colWave[y] = Math.sin(y * 0.061 - t * 0.7)

      let p = 0
      for (let y = 0; y < ih; y++) {
        const bRow = (y & 3) << 2
        const cwv = colWave[y]
        for (let x = 0; x < iw; x++, p += 4) {
          const v = field[y * iw + x] + 0.13 * rowWave[x] * cwv
          // упорядоченный дизеринг: порог Байера добавляется до квантования
          const bayer = BAYER[bRow | (x & 3)] / 16
          let q = Math.floor((v + (bayer - 0.5) * step) / step + 0.5)
          q = clamp(q, 0, lv - 1)
          data[p] = r[q * 3]
          data[p + 1] = r[q * 3 + 1]
          data[p + 2] = r[q * 3 + 2]
          data[p + 3] = 255
        }
      }
      offCtx.putImageData(img, 0, 0)
      const cw = Math.max(1, canvas.clientWidth)
      const ch = Math.max(1, canvas.clientHeight)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(off, 0, 0, cw, ch)
    }

    resize()

    return {
      frame(t) {
        if (fieldDirty) {
          recomputeField()
          fieldDirty = false
        }
        if (opts.reduced) {
          render(3.1) // статичная фаза волн — картинка жива, но не движется
          return
        }
        render(t)
      },
      setParam(key, value) {
        if (key === 'palette' && typeof value === 'string') {
          palette = value
          ramp = buildRamp(PALETTES[palette] ?? PALETTES.ember, levels)
        } else if (key === 'levels' && typeof value === 'number') {
          levels = Math.round(value)
          ramp = buildRamp(PALETTES[palette] ?? PALETTES.ember, levels)
        } else if (key === 'scale' && typeof value === 'number') {
          scale = value
          fieldDirty = true
        }
      },
      resize,
      destroy() {
        /* offscreen-канвас подберёт сборщик мусора */
      },
    }
  },
}
