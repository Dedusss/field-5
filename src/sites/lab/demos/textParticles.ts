/**
 * Л·06 «ТЕКСТ → ЧАСТИЦЫ» — слово, разобранное на пружинные точки.
 *
 * Слово рисуется в offscreen-канвас, альфа сэмплируется сеткой — так
 * рождаются «дома» частиц. Дальше работает пружинная физика: частицы
 * тянутся к домам, курсор расталкивает толпу, клик устраивает взрыв.
 * Смена слова пересобирает дома — толпа перетекает в новое слово.
 */

import { clamp } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

const WORDS = ['ПОЛЕ', 'ОПЫТ', 'ВЕБ'] as const

/** Семейство шрифта проекта для canvas (next/font отдаёт его через CSS-переменную). */
function displayFamily(): string {
  if (typeof window === 'undefined') return 'sans-serif'
  const fam = getComputedStyle(document.body).getPropertyValue('--font-unbounded').trim()
  return fam || 'sans-serif'
}

export const textParticlesDemo: DemoModule = {
  id: 'text',
  title: 'Текст → частицы',
  latin: 'TEXT TO PARTICLES',
  category: 'gen',
  description:
    'Слово рисуется в невидимом канвасе, его альфа сэмплируется сеткой — и каждая точка становится частицей с пружиной к своему «дому». Курсор расталкивает толпу, клик устраивает взрыв, смена слова отправляет буквы перетекать в новые дома.',
  tech: 'canvas 2d · offscreen-текст → сэмплинг альфы · пружины к домам · repulsion',
  params: [
    { key: 'dot', label: 'Размер точки', kind: 'range', min: 1, max: 4, step: 0.25, value: 2 },
    { key: 'repel', label: 'Сила отталкивания', kind: 'range', min: 0.2, max: 2.2, step: 0.05, value: 1 },
    {
      key: 'word',
      label: 'Слово',
      kind: 'select',
      value: 'ПОЛЕ',
      options: WORDS.map((wd) => ({ value: wd, label: wd })),
    },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0
    const off = document.createElement('canvas')
    const offCtx = off.getContext('2d', { willReadFrequently: true })
    if (!offCtx) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }

    let w = 1
    let h = 1
    let dot = numParam(params, 'dot', 2)
    let repel = numParam(params, 'repel', 1)
    let word = strParam(params, 'word', 'ПОЛЕ')
    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }
    let wasDown = false
    let disposed = false

    let count = 0
    let px = new Float32Array(0)
    let py = new Float32Array(0)
    let vx = new Float32Array(0)
    let vy = new Float32Array(0)
    let hx = new Float32Array(0)
    let hy = new Float32Array(0)

    /** Сэмплирует альфу слова и (пере)собирает дома; позиции частиц сохраняются — получается морф. */
    const sampleWord = (): void => {
      const fam = displayFamily()
      off.width = Math.max(2, Math.round(w))
      off.height = Math.max(2, Math.round(h))
      let size = h * 0.5
      offCtx.font = `800 ${size}px ${fam}, sans-serif`
      const maxW = w * 0.86
      const meas = offCtx.measureText(word)
      if (meas.width > maxW && meas.width > 0) {
        size = (size * maxW) / meas.width
        offCtx.font = `800 ${size}px ${fam}, sans-serif`
      }
      offCtx.textAlign = 'center'
      offCtx.textBaseline = 'middle'
      offCtx.fillStyle = '#fff'
      offCtx.fillText(word, w / 2, h * 0.52)

      const data = offCtx.getImageData(0, 0, off.width, off.height).data
      // шаг сетки подбираем так, чтобы частиц было ~2400
      const cover = off.width * off.height * 0.22
      const step = clamp(Math.sqrt(cover / 2400), 2.5, 12)
      const homes: number[] = []
      for (let y = step * 0.5; y < h; y += step) {
        for (let x = step * 0.5; x < w; x += step) {
          const ix = x | 0
          const iy = y | 0
          if (data[(iy * off.width + ix) * 4 + 3] > 128) {
            homes.push(x + (Math.random() - 0.5) * step * 0.7, y + (Math.random() - 0.5) * step * 0.7)
          }
        }
      }
      const n = homes.length / 2
      if (n === 0) return
      const npx = new Float32Array(n)
      const npy = new Float32Array(n)
      const nvx = new Float32Array(n)
      const nvy = new Float32Array(n)
      const nhx = new Float32Array(n)
      const nhy = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        nhx[i] = homes[i * 2]
        nhy[i] = homes[i * 2 + 1]
        if (i < count) {
          // старые частицы сохраняют позиции и скорости — морфинг
          npx[i] = px[i]
          npy[i] = py[i]
          nvx[i] = vx[i]
          nvy[i] = vy[i]
        } else {
          npx[i] = Math.random() * w
          npy[i] = Math.random() * h
        }
      }
      count = n
      px = npx
      py = npy
      vx = nvx
      vy = nvy
      hx = nhx
      hy = nhy
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
      sampleWord()
      if (opts.reduced) settle()
    }

    /** Reduced-motion: сразу расставить частицы по домам и нарисовать. */
    function settle(): void {
      for (let i = 0; i < count; i++) {
        px[i] = hx[i]
        py[i] = hy[i]
        vx[i] = 0
        vy[i] = 0
      }
      render()
    }

    function render(): void {
      ctx.fillStyle = '#0d0b0e'
      ctx.fillRect(0, 0, w, h)
      for (let i = 0; i < count; i++) {
        const dx = hx[i] - px[i]
        const dy = hy[i] - py[i]
        const speed = Math.hypot(dx, dy)
        // разлёт по скорости: тихие — кость, разлетевшиеся — янтарь
        const hot = clamp(speed / 90, 0, 1)
        ctx.fillStyle =
          hot > 0.25
            ? `rgba(246,208,120,${0.5 + 0.4 * hot})`
            : 'rgba(236,231,221,0.6)'
        ctx.beginPath()
        ctx.arc(px[i], py[i], dot * (0.7 + hot * 0.6), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    function step(dt: number): void {
      const mouseIn = pointer.x > -9000
      const R = 60 + repel * 46
      const R2 = R * R
      const push = 2600 * repel
      const spring = 34
      const damping = Math.pow(0.0025, dt) // сильное трение — толпа вязкая

      // клик: взрыв от точки удара
      if (pointer.down && !wasDown && mouseIn) {
        const ER = 170
        const ER2 = ER * ER
        for (let i = 0; i < count; i++) {
          const dx = px[i] - pointer.x
          const dy = py[i] - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < ER2 && d2 > 1) {
            const d = Math.sqrt(d2)
            const imp = (1 - d / ER) * 620
            vx[i] += (dx / d) * imp
            vy[i] += (dy / d) * imp
          }
        }
      }
      wasDown = pointer.down

      for (let i = 0; i < count; i++) {
        vx[i] += (hx[i] - px[i]) * spring * dt
        vy[i] += (hy[i] - py[i]) * spring * dt
        if (mouseIn) {
          const dx = px[i] - pointer.x
          const dy = py[i] - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < R2 && d2 > 1) {
            const d = Math.sqrt(d2)
            const f = (1 - d / R) * push * dt * (pointer.down ? 2.1 : 1)
            vx[i] += (dx / d) * f
            vy[i] += (dy / d) * f
          }
        }
        vx[i] *= damping
        vy[i] *= damping
        px[i] += vx[i] * dt
        py[i] += vy[i] * dt
      }
      render()
    }

    resize()

    // Слово могли семплировать до загрузки фирменного шрифта — пересоберём по готовности.
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        if (disposed) return
        sampleWord()
        if (opts.reduced) settle()
      }).catch(() => {})
    }

    return {
      pointer,
      frame(_t, dt) {
        if (opts.reduced) {
          return // статичный кадр уже нарисован в settle()
        }
        step(Math.min(dt, 0.034))
      },
      setParam(key, value) {
        if (key === 'dot' && typeof value === 'number') dot = value
        else if (key === 'repel' && typeof value === 'number') repel = value
        else if (key === 'word' && typeof value === 'string') {
          if ((WORDS as readonly string[]).includes(value)) {
            word = value
            sampleWord()
            if (opts.reduced) settle()
          }
        }
      },
      resize,
      destroy() {
        disposed = true
      },
    }
  },
}
