/**
 * Л·08 «ВЕРЛЕТ-КАНАТ» — мини-версия физики ЭКСП. 04 «ТЕКСТОВОЕ ПОЛЕ».
 *
 * Цепочка из 26 сегментов в интеграторе Верле: скорость хранится как
 * разница позиций, связи решаются релаксацией — чем больше итераций,
 * тем жёстче канат. Слайдер итераций честно показывает, как дешёвый
 * солвер превращает верёвку в резину. Курсор тянет ближайшую точку.
 */

import { clamp, lerp } from '@/lib/lab/math'
import { numParam, type DemoInstance, type DemoModule, type DemoPointer } from '@/lib/lab/types'

const POINTS = 27
const FIXED_DT = 1 / 60
const MOSS: [number, number, number] = [78, 240, 138]
const AMBER: [number, number, number] = [232, 179, 77]

export const verletRopeDemo: DemoModule = {
  id: 'rope',
  title: 'Верлет-канат',
  latin: 'VERLET ROPE',
  category: 'physics',
  description:
    'Цепочка из 26 сегментов в интеграторе Верле — та же механика, на которой стоит физика глифов в ЭКСП. 04. Ползунок итераций честно показывает цену жёсткости: две итерации — резина, двенадцать — почти стержень. Курсор тянет ближайшую точку каната.',
  tech: 'canvas 2d · верлет-интегратор · релаксация связей · захват курсором',
  params: [
    { key: 'iter', label: 'Итерации связей', kind: 'range', min: 2, max: 12, step: 1, value: 6 },
    { key: 'grav', label: 'Гравитация', kind: 'range', min: 300, max: 3200, step: 50, value: 1500 },
    { key: 'damp', label: 'Демпфирование', kind: 'range', min: 0.8, max: 0.99, step: 0.005, value: 0.965 },
    { key: 'stress', label: 'Натяжение', kind: 'toggle', value: true },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    let w = 1
    let h = 1
    let iter = Math.round(numParam(params, 'iter', 6))
    let grav = numParam(params, 'grav', 1500)
    let damp = numParam(params, 'damp', 0.965)
    let showStress = params.stress !== false
    const pointer: DemoPointer = { x: -9999, y: -9999, down: false }

    const px = new Float64Array(POINTS)
    const py = new Float64Array(POINTS)
    const ox = new Float64Array(POINTS) // prev
    const oy = new Float64Array(POINTS)
    const mass = new Float64Array(POINTS).fill(1)
    mass[POINTS - 1] = 5 // груз на конце
    let segLen = 10
    let grabbed = -1
    let acc = 0

    const layRope = (): void => {
      const anchorX = w * 0.5
      const anchorY = h * 0.14
      segLen = (h * 0.6) / (POINTS - 1)
      for (let i = 0; i < POINTS; i++) {
        px[i] = anchorX
        py[i] = anchorY + i * segLen
        ox[i] = px[i]
        oy[i] = py[i]
      }
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
      layRope()
      grabbed = -1
      if (opts.reduced) {
        presettle()
        render()
      }
    }

    /** Один фиксированный шаг симуляции. */
    function simStep(): void {
      const dt2 = FIXED_DT * FIXED_DT
      // интегратор Верле: новая позиция = 2·текущая − прошлая + ускорение·dt²
      for (let i = 0; i < POINTS; i++) {
        if (i === 0 || i === grabbed) continue
        const nvx = (px[i] - ox[i]) * damp
        const nvy = (py[i] - oy[i]) * damp
        ox[i] = px[i]
        oy[i] = py[i]
        px[i] += nvx
        py[i] += nvy + grav * dt2
      }
      // релаксация связей: несколько проходов по всем сегментам
      for (let it = 0; it < iter; it++) {
        for (let i = 0; i < POINTS - 1; i++) {
          const j = i + 1
          const dx = px[j] - px[i]
          const dy = py[j] - py[i]
          const d = Math.hypot(dx, dy) || 1e-6
          const diff = (d - segLen) / d
          const wi = i === 0 || i === grabbed ? 0 : 1 / mass[i]
          const wj = j === 0 || j === grabbed ? 0 : 1 / mass[j]
          const tot = wi + wj
          if (tot === 0) continue
          const fi = (diff * wi) / tot
          const fj = (diff * wj) / tot
          px[i] += dx * fi
          py[i] += dy * fi
          px[j] -= dx * fj
          py[j] -= dy * fj
        }
      }
      // якорь и захваченная точка неподвижны
      px[0] = w * 0.5
      py[0] = h * 0.14
      if (grabbed >= 0) {
        px[grabbed] = pointer.x
        py[grabbed] = pointer.y
        ox[grabbed] = px[grabbed]
        oy[grabbed] = py[grabbed]
      }
    }

    /** Reduced-motion: заранее просчитать успокоившийся канат. */
    function presettle(): void {
      layRope()
      for (let s = 0; s < 420; s++) simStep()
    }

    function render(): void {
      ctx.fillStyle = '#0a0c09'
      ctx.fillRect(0, 0, w, h)

      // шкала слева — приборная мера глубины
      ctx.strokeStyle = 'rgba(236,231,221,0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let y = h * 0.14; y < h * 0.92; y += 36) {
        ctx.moveTo(10, y)
        ctx.lineTo(10 + (((y - h * 0.14) / 36) % 2 === 0 ? 12 : 6), y)
      }
      ctx.stroke()

      // канат: сужение к грузу, цвет — по натяжению
      for (let i = 0; i < POINTS - 1; i++) {
        const dx = px[i + 1] - px[i]
        const dy = py[i + 1] - py[i]
        const d = Math.hypot(dx, dy)
        const stress = clamp(Math.abs(d - segLen) / (segLen * 0.6), 0, 1)
        const t = showStress ? stress : 0.25
        const r = Math.round(lerp(MOSS[0], AMBER[0], t))
        const g = Math.round(lerp(MOSS[1], AMBER[1], t))
        const b = Math.round(lerp(MOSS[2], AMBER[2], t))
        ctx.strokeStyle = `rgb(${r},${g},${b})`
        ctx.lineWidth = lerp(6.5, 2.5, i / (POINTS - 1))
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(px[i], py[i])
        ctx.lineTo(px[i + 1], py[i + 1])
        ctx.stroke()
      }

      // точки звеньев
      ctx.fillStyle = 'rgba(220,248,217,0.9)'
      for (let i = 1; i < POINTS - 1; i++) {
        ctx.beginPath()
        ctx.arc(px[i], py[i], 1.4, 0, Math.PI * 2)
        ctx.fill()
      }

      // якорь
      const ax = w * 0.5
      const ay = h * 0.14
      ctx.fillStyle = '#161411'
      ctx.strokeStyle = 'rgba(232,179,77,0.85)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(ax - 9, ay - 10)
      ctx.lineTo(ax + 9, ay - 10)
      ctx.lineTo(ax, ay + 4)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // груз на конце
      const ex = px[POINTS - 1]
      const ey = py[POINTS - 1]
      ctx.fillStyle = '#161411'
      ctx.strokeStyle = '#4ef08a'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(ex, ey, 9, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(78,240,138,0.4)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(ex, ey, 14, 0, Math.PI * 2)
      ctx.stroke()
    }

    function interact(): void {
      const inCanvas = pointer.x > -9000
      if (!inCanvas) {
        grabbed = -1
        return
      }
      if (pointer.down && grabbed < 0) {
        // захват ближайшей точки — либо импульс по щелчку мимо каната
        let best = -1
        let bestD2 = 46 * 46
        for (let i = 1; i < POINTS; i++) {
          const dx = px[i] - pointer.x
          const dy = py[i] - pointer.y
          const d2 = dx * dx + dy * dy
          if (d2 < bestD2) {
            bestD2 = d2
            best = i
          }
        }
        if (best >= 0) grabbed = best
        else {
          for (let i = 1; i < POINTS; i++) {
            const dx = px[i] - pointer.x
            const dy = py[i] - pointer.y
            const d2 = dx * dx + dy * dy
            if (d2 < 140 * 140) {
              const d = Math.sqrt(d2) || 1
              const imp = (1 - d / 140) * 26
              // скорость = pos − prev; смещаем prev назад по направлению от клика
              ox[i] = px[i] - (dx / d) * imp
              oy[i] = py[i] - (dy / d) * imp
            }
          }
        }
      }
      if (!pointer.down) grabbed = -1
    }

    resize()

    return {
      pointer,
      frame(_t, dt) {
        if (opts.reduced) {
          render()
          return
        }
        interact()
        acc += Math.min(dt, 0.06)
        let guard = 0
        while (acc >= FIXED_DT && guard < 3) {
          simStep()
          acc -= FIXED_DT
          guard++
        }
        if (guard === 3) acc = 0
        render()
      },
      setParam(key, value) {
        if (key === 'iter' && typeof value === 'number') iter = Math.round(value)
        else if (key === 'grav' && typeof value === 'number') grav = value
        else if (key === 'damp' && typeof value === 'number') damp = value
        else if (key === 'stress' && typeof value === 'boolean') showStress = value
        if (opts.reduced) {
          presettle()
          render()
        }
      },
      resize,
      destroy() {
        /* чистить нечего */
      },
    }
  },
}
