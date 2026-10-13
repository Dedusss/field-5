'use client'

/**
 * Л·11 «РЯБЬ» — волновой бассейн.
 *
 * Двумерное волновое уравнение на грубой сетке (FDTD, схема «крест»):
 * высота хранится в двух буферах, каждый шаг новое поле считается из
 * текущего, предыдущего и лапласиана. Курсор роняет камень, драг —
 * непрерывная капель; тумблер «Дождь» оживляет бассейн сам. Края —
 * отражающие (волна возвращается) или поглощающие (затухающая кайма).
 *
 * Рендер — ImageData в разрешении сетки, растянутый с билинейным
 * сглаживанием: мягкая вода без единого шейдера. В reduced-motion
 * прибор рисует замёрзшую картину интерференции трёх камней.
 */

import { clamp } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

const CELL = 5 // CSS-px на ячейку сетки
const FIXED_DT = 1 / 120 // шаг интегратора (с)
const SUBSTEPS_MAX = 4 // предохранитель от спирали смерти
const RIM = 7 // ширина затухающей каймы поглощающих краёв (ячеек)

/* Палитра: чёрно-зелёная вода без единого синего пикселя */
const BASE: [number, number, number] = [10, 15, 12] // спокойная вода
const CREST: [number, number, number] = [150, 244, 186] // гребень-пена
const TROUGH: [number, number, number] = [20, 44, 31] // впадина-мох

export const rippleDemo: DemoModule = {
  id: 'ripple',
  title: 'Рябь',
  latin: 'RIPPLE TANK',
  category: 'physics',
  description:
    'Волновой бассейн: двумерное волновое уравнение на сетке, решается схемой «крест» — каждый кадр новое поле высот рождается из текущего, предыдущего и лапласиана. Клик роняет камень, драг работает непрерывной капелью; дождь оживляет воду сам. Края бассейна — отражающие (волна возвращается и интерферирует) или поглощающие (затухающая кайма, как у настоящей ванны с ватой по периметру).',
  tech: 'canvas 2d · волновое уравнение FDTD (схема «крест», c² ≤ 0.5) · отражающие/поглощающие края · билинейный апскейл ImageData',
  params: [
    { key: 'speed', label: 'Скорость волны', kind: 'range', min: 0.1, max: 0.48, step: 0.01, value: 0.34 },
    { key: 'damp', label: 'Затухание', kind: 'range', min: 0, max: 0.03, step: 0.001, value: 0.005 },
    {
      key: 'edges',
      label: 'Края',
      kind: 'select',
      value: 'reflect',
      options: [
        { value: 'reflect', label: 'отражающие' },
        { value: 'absorb', label: 'поглощающие' },
      ],
    },
    { key: 'rain', label: 'Дождь', kind: 'toggle', value: true },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    let c2 = numParam(params, 'speed', 0.34) // c² схемы (стабильно ≤ 0.5)
    let dampMul = 1 - numParam(params, 'damp', 0.005)
    let edges = strParam(params, 'edges', 'reflect')
    let rain = params.rain !== false

    let w = 1
    let h = 1
    let gw = 4
    let gh = 4
    let curr = new Float32Array(gw * gh)
    let prev = new Float32Array(gw * gh)
    let acc = 0
    let nextRainAt = 0
    let needsPreset = opts.reduced
    let lastDropX = -1
    let lastDropY = -1

    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }

    /* Офф-скрин в разрешении сетки: красим ImageData, растягиваем сглаживанием */
    const off = document.createElement('canvas')
    const offCtx0 = off.getContext('2d')
    const offCtx = offCtx0
    let img: ImageData | null = null

    const drop = (cx: number, cy: number, amp: number, sigma: number): void => {
      // гауссов бугор в текущем поле (курсор уже переведён в ячейки)
      const r = Math.ceil(sigma * 2.5)
      const i0 = Math.max(1, Math.floor(cx - r))
      const i1 = Math.min(gw - 2, Math.ceil(cx + r))
      const j0 = Math.max(1, Math.floor(cy - r))
      const j1 = Math.min(gh - 2, Math.ceil(cy + r))
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const dx = (i - cx) / sigma
          const dy = (j - cy) / sigma
          curr[j * gw + i] += amp * Math.exp(-(dx * dx + dy * dy) / 2)
        }
      }
    }

    const dropAt = (x: number, y: number, amp: number, sigma: number): void => {
      drop(x / CELL, y / CELL, amp, sigma)
    }

    /** Один шаг схемы «крест» по внутренним ячейкам + края. */
    function step(): void {
      // next переиспользует буфер prev (после шага он станет прошлым)
      const next = prev
      for (let j = 1; j < gh - 1; j++) {
        const row = j * gw
        for (let i = 1; i < gw - 1; i++) {
          const k = row + i
          const lap = curr[k - 1] + curr[k + 1] + curr[k - gw] + curr[k + gw] - 4 * curr[k]
          next[k] = (2 * curr[k] - prev[k] + c2 * lap) * dampMul
        }
      }
      if (edges === 'absorb') {
        // затухающая кайма: плавный спад к границе гасит отражение
        for (let j = 0; j < gh; j++) {
          const dj = Math.min(j, gh - 1 - j)
          const fj = dj < RIM ? 0.72 + (0.28 * dj) / RIM : 1
          for (let i = 0; i < gw; i++) {
            const di = Math.min(i, gw - 1 - i)
            const f = di < RIM ? fj * (0.72 + (0.28 * di) / RIM) : fj
            if (f < 1) next[j * gw + i] *= f
          }
        }
      } else {
        // отражающие края: условие Неймана — копируем соседа изнутри
        for (let i = 1; i < gw - 1; i++) {
          next[i] = next[gw + i]
          next[(gh - 1) * gw + i] = next[(gh - 2) * gw + i]
        }
        for (let j = 0; j < gh; j++) {
          const row = j * gw
          next[row] = next[row + 1]
          next[row + gw - 1] = next[row + gw - 2]
        }
      }
      prev = curr
      curr = next
    }

    function draw(): void {
      if (!offCtx || !img) return
      const data = img.data
      for (let k = 0; k < gw * gh; k++) {
        const u = curr[k]
        const v = clamp(u * 1.35, -1, 1)
        const o = k * 4
        if (v >= 0) {
          data[o] = BASE[0] + v * (CREST[0] - BASE[0])
          data[o + 1] = BASE[1] + v * (CREST[1] - BASE[1])
          data[o + 2] = BASE[2] + v * (CREST[2] - BASE[2])
        } else {
          const a = -v
          data[o] = BASE[0] + a * (TROUGH[0] - BASE[0])
          data[o + 1] = BASE[1] + a * (TROUGH[1] - BASE[1])
          data[o + 2] = BASE[2] + a * (TROUGH[2] - BASE[2])
        }
        data[o + 3] = 255
      }
      offCtx.putImageData(img, 0, 0)
      // билинейный апскейл — мягкая вода без шейдеров
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(off, 0, 0, gw, gh, 0, 0, w, h)
    }

    /** Замёрзшая картина для reduced-motion: три камня, 160 шагов, стоп-кадр. */
    function preset(): void {
      curr.fill(0)
      prev.fill(0)
      drop(gw * 0.32, gh * 0.38, 1.4, 2.4)
      drop(gw * 0.68, gh * 0.58, 1.4, 2.4)
      drop(gw * 0.5, gh * 0.86, 1.0, 1.8)
      for (let n = 0; n < 160; n++) step()
      draw()
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
      gw = Math.max(4, Math.ceil(w / CELL))
      gh = Math.max(4, Math.ceil(h / CELL))
      curr = new Float32Array(gw * gh)
      prev = new Float32Array(gw * gh)
      off.width = gw
      off.height = gh
      if (offCtx) img = offCtx.createImageData(gw, gh)
      needsPreset = opts.reduced
    }

    resize()

    return {
      pointer,
      frame(t, dt) {
        if (opts.reduced) {
          // статичный стоп-кадр; параметры пересобирают картину
          if (needsPreset) {
            preset()
            needsPreset = false
          }
          return
        }
        // камень по клику, капель при драге
        if (pointer.x > -1000 && pointer.y > -1000) {
          const moved = Math.hypot(pointer.x - lastDropX, pointer.y - lastDropY)
          if (pointer.down && (lastDropX < -1000 || moved > CELL * 1.5)) {
            const stone = lastDropX < -1000
            dropAt(pointer.x, pointer.y, stone ? 1.3 : 0.55, stone ? 2.4 : 1.5)
            lastDropX = pointer.x
            lastDropY = pointer.y
          }
          if (!pointer.down) {
            lastDropX = -9999
            lastDropY = -9999
          }
        }
        // дождь: случайные капли по расписанию
        if (rain) {
          if (nextRainAt <= 0) nextRainAt = t + 0.4
          if (t >= nextRainAt) {
            drop(1 + Math.random() * (gw - 2), 1 + Math.random() * (gh - 2), 0.4 + Math.random() * 0.5, 1.6)
            nextRainAt = t + 0.35 + Math.random() * 0.85
          }
        }
        // фиксированный шаг интегратора с аккумулятором времени
        acc = Math.min(acc + Math.min(dt, 0.05), FIXED_DT * SUBSTEPS_MAX)
        while (acc >= FIXED_DT) {
          step()
          acc -= FIXED_DT
        }
        draw()
      },
      setParam(key, value) {
        if (key === 'speed' && typeof value === 'number') {
          c2 = clamp(value, 0.05, 0.5) // стабильность схемы: c² ≤ 0.5
        } else if (key === 'damp' && typeof value === 'number') {
          dampMul = 1 - value
        } else if (key === 'edges' && typeof value === 'string') {
          edges = value
        } else if (key === 'rain' && typeof value === 'boolean') {
          rain = value
        }
        if (opts.reduced) needsPreset = true
      },
      resize,
      destroy() {
        /* сетки и офф-скрин подберёт сборщик мусора */
      },
    }
  },
}
