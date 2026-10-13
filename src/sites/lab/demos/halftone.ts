'use client'

/**
 * Л·10 «ПОЛУТОН» — печатный растр как прибор.
 *
 * Непрерывное поле яркости переводится в сетку чернильных точек: площадь
 * точки кодирует тон (радиус ~ sqrt), решётка повёрнута на классический
 * печатный угол. Бумага — тёплая, с зерном; краска — одна, как в один прогон.
 *
 * Дуотон — второй прогон краски: вторая решётка повёрнута на +30°
 * (классический сдвиг печатных углов против муара) и печатает
 * дополнительный тон — инверсию поля. Площадь чернил в сумме постоянна,
 * как у настоящего дуплекса: где первой краски мало, второй много.
 *
 * Трихромия — третий прогон: тон разложен на три пластины (тени, средние
 * тона, света), сумма чернил по-прежнему постоянна. Углы решёток +30°
 * и +60°: при базовом 45° получается классическая тройка 15/45/75°
 * трёхцветной печати.
 *
 * Курсор работает лупой: приближает изображение, не ломая решётку;
 * зажатая кнопка усиливает увеличение.
 */

import { clamp, TAU } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule } from '@/lib/lab/types'

/** Краски прогонов: цвет чернил на тёплой бумаге. */
const INKS: Record<string, string> = {
  ink: '#26201a',
  vermilion: '#b23a1c',
  ochre: '#96551a',
}

/** Источники поля яркости (0..1): x, y — CSS-пиксели, t — секунды. */
type SourceFn = (x: number, y: number, w: number, h: number, t: number) => number

const SOURCES: Record<string, SourceFn> = {
  // интерференция двух круговых волн: гребни и узлы дают «оптику»
  interference(x, y, w, h, t) {
    const s = Math.max(w, h)
    const k = (TAU * 4.2) / s
    const d1 = Math.hypot(x - w * 0.32, y - h * 0.4)
    const d2 = Math.hypot(x - w * 0.68, y - h * 0.6)
    return 0.5 + 0.27 * Math.sin(d1 * k - t * 1.1) + 0.27 * Math.sin(d2 * k - t * 0.9)
  },
  // направленные волны с перекрёстной модуляцией — текучие полосы
  waves(x, y, w, h, t) {
    const s = Math.max(w, h)
    const u = x / s
    const v = y / s
    const a =
      Math.sin(u * 7.5 + Math.sin(v * 2.5 + t * 0.35) * 1.4) +
      Math.sin((u * 2.1 + v * 5.2) * 1.9 - t * 0.7)
    return 0.5 + 0.24 * a
  },
  // дышащее сияние: центр медленно ходит по орбите, радиус пульсирует
  glow(x, y, w, h, t) {
    const cx = w * (0.5 + 0.18 * Math.sin(t * 0.32))
    const cy = h * (0.46 + 0.14 * Math.cos(t * 0.24))
    const r = Math.max(w, h) * (0.3 + 0.07 * Math.sin(t * 0.6))
    const d = Math.hypot(x - cx, y - cy) / r
    return 1.15 * Math.exp(-d * d * 1.6)
  },
  // клин — контрольная шкала печатника: девять полей фиксированного тона,
  // у границ полей — узкие светлые зазоры. На каждом поле видно, как растр
  // переводит заданный тон в площадь точки; зазоры дают «кромки» шкалы.
  // Статичен, как настоящий клин на оттиске. Конвенция поля: 0 — бумага,
  // 1 — полная краска, поэтому поля растут слева направо от светлого к
  // тёмному, а зазоры — почти бумага.
  wedge(x, _y, w, _h, _t) {
    const steps = 9
    const s = (x / w) * steps
    const patch = Math.min(steps - 1, Math.max(0, Math.floor(s)))
    const frac = s - patch
    if (frac < 0.06 || frac > 0.94) return 0.02 // зазор: почти бумага
    return 0.06 + (patch / (steps - 1)) * 0.88
  },
}

const LOUPE_R = 105 // радиус лупы (CSS-px)
const MAG_HOVER = 2.2 // увеличение при наведённом курсоре
const MAG_DOWN = 3.4 // увеличение при зажатой кнопке
const DUOTONE_SHIFT = (30 * Math.PI) / 180 // сдвиг второй решётки против муара
const TRICHROME_SHIFT = (60 * Math.PI) / 180 // угол третьей решётки (классика 15/45/75)

export const halftoneDemo: DemoModule = {
  id: 'halftone',
  title: 'Полутон',
  latin: 'HALFTONE',
  category: 'shaders',
  description:
    'Полутоновой растр, как в газетной печати: непрерывное поле яркости переводится в сетку чернильных точек — площадь точки кодирует тон, решётка повёрнута на классический печатный угол. В режиме дуотона второй прогон краски печатает инверсию поля со сдвигом решётки на +30°: где первой краски мало, второй много — сумма чернил постоянна, как у настоящего дуплекса. Трихромия раскладывает тон на три пластины — тени, средние тона, света — тремя красками под углами +30° и +60°: при базовом угле 45° получается классическая тройка 15/45/75° трёхцветной печати. Курсор работает лупой: приближает изображение, не ломая решётку; зажатая кнопка усиливает увеличение. Источник «клин» — контрольная шкала печатника: девять полей заданного тона, на каждом видно, как растр кодирует тон площадью точки.',
  tech: 'canvas 2d · повёрнутые решётки растра · радиус ~ sqrt(тон) · до трёх прогонов краски (дуотон +30°, трихромия +60°) · варп поля лупой · бумага с зерном и метками реза · клин — контрольная шкала тона',
  params: [
    {
      key: 'source',
      label: 'Источник',
      kind: 'select',
      value: 'interference',
      options: [
        { value: 'interference', label: 'интерференция' },
        { value: 'waves', label: 'волны' },
        { value: 'glow', label: 'сияние' },
        { value: 'wedge', label: 'клин' },
      ],
    },
    { key: 'cell', label: 'Шаг растра', kind: 'range', min: 7, max: 24, step: 1, value: 12 },
    { key: 'angle', label: 'Угол решётки', kind: 'range', min: 0, max: 75, step: 1, value: 45 },
    {
      key: 'pass',
      label: 'Прогон',
      kind: 'select',
      value: 'single',
      options: [
        { value: 'single', label: 'одна краска' },
        { value: 'duotone', label: 'дуотон' },
        { value: 'trichrome', label: 'трихромия' },
      ],
    },
    {
      key: 'ink',
      label: 'Краска 1',
      kind: 'select',
      value: 'ink',
      options: [
        { value: 'ink', label: 'чернила' },
        { value: 'vermilion', label: 'киноварь' },
        { value: 'ochre', label: 'охра' },
      ],
    },
    {
      key: 'ink2',
      label: 'Краска 2',
      kind: 'select',
      value: 'vermilion',
      options: [
        { value: 'vermilion', label: 'киноварь' },
        { value: 'ink', label: 'чернила' },
        { value: 'ochre', label: 'охра' },
      ],
    },
    {
      key: 'ink3',
      label: 'Краска 3',
      kind: 'select',
      value: 'ochre',
      options: [
        { value: 'ochre', label: 'охра' },
        { value: 'vermilion', label: 'киноварь' },
        { value: 'ink', label: 'чернила' },
      ],
    },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    const pointer = { x: -9999, y: -9999, down: false }

    let sourceKey = strParam(params, 'source', 'interference')
    let sourceFn = SOURCES[sourceKey] ?? SOURCES.interference
    let cell = numParam(params, 'cell', 12)
    let angleDeg = numParam(params, 'angle', 45)
    let passKey = strParam(params, 'pass', 'single')
    let inkKey = strParam(params, 'ink', 'ink')
    let ink2Key = strParam(params, 'ink2', 'vermilion')
    let ink3Key = strParam(params, 'ink3', 'ochre')

    let w = 1
    let h = 1

    // Бумага с зерном: кэш пересобирается при resize.
    const paper = document.createElement('canvas')
    const paperCtx0 = paper.getContext('2d')
    const paperCtx = paperCtx0

    const buildPaper = (): void => {
      if (!paperCtx) return
      paper.width = Math.max(2, w)
      paper.height = Math.max(2, h)
      const img = paperCtx.createImageData(paper.width, paper.height)
      const data = img.data
      for (let i = 0; i < data.length; i += 4) {
        // тёплая бумага с попиксельным зерном (±8) — фактура, а не шум
        const n = (Math.random() * 2 - 1) * 8
        data[i] = clamp(239 + n, 0, 255)
        data[i + 1] = clamp(229 + n, 0, 255)
        data[i + 2] = clamp(207 + n * 0.8, 0, 255)
        data[i + 3] = 255
      }
      paperCtx.putImageData(img, 0, 0)
      // лёгкое потемнение к краям листа — как у оттиска
      const grad = paperCtx.createRadialGradient(
        paper.width / 2,
        paper.height / 2,
        Math.min(paper.width, paper.height) * 0.36,
        paper.width / 2,
        paper.height / 2,
        Math.hypot(paper.width, paper.height) * 0.62,
      )
      grad.addColorStop(0, 'rgba(58,44,24,0)')
      grad.addColorStop(1, 'rgba(58,44,24,0.12)')
      paperCtx.fillStyle = grad
      paperCtx.fillRect(0, 0, paper.width, paper.height)
    }

    const resize = (): void => {
      const cw = Math.max(1, canvas.clientWidth)
      const ch = Math.max(1, canvas.clientHeight)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = cw
      h = ch
      const bw = Math.round(cw * dpr)
      const bh = Math.round(ch * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildPaper()
      if (opts.reduced) render(2.7)
    }

    /** Поле с учётом лупы: позиция (x, y) смотрит в «увеличенную» точку поля. */
    const sample = (x: number, y: number, t: number): number => {
      const active = pointer.x > -1000 && pointer.y > -1000
      let sx = x
      let sy = y
      if (active) {
        const dx = x - pointer.x
        const dy = y - pointer.y
        const dist = Math.hypot(dx, dy)
        if (dist < LOUPE_R) {
          const f = 1 - dist / LOUPE_R
          const smooth = f * f * (3 - 2 * f) // smoothstep-спад лупы
          const k = 1 + ((pointer.down ? MAG_DOWN : MAG_HOVER) - 1) * smooth
          sx = pointer.x + dx * k
          sy = pointer.y + dy * k
        }
      }
      return clamp(sourceFn(sx, sy, w, h, t), 0, 1)
    }

    /**
     * Один прогон краски: решётка растра под углом theta, точки радиусом
     * ~ rMax·sqrt(тон). Печатается поверх предыдущего прогона — как на
     * машине, вторая краска ложится сверху.
     */
    function drawPass(theta: number, color: string, tone: (v: number) => number, t: number): void {
      const cos = Math.cos(theta)
      const sin = Math.sin(theta)
      // rMax подобран так, чтобы площадь чернил соответствовала тону:
      // r = rMax·sqrt(v) при rMax ≈ cell/√π — в средних тонах честный полутон
      const rMax = cell * 0.58

      // покрытие: углы канваса в координатах решётки
      const corners: [number, number][] = [
        [0, 0],
        [w, 0],
        [0, h],
        [w, h],
      ]
      let aMin = Infinity
      let aMax = -Infinity
      let bMin = Infinity
      let bMax = -Infinity
      for (const [cx, cy] of corners) {
        const a = (cx * cos + cy * sin) / cell
        const b = (-cx * sin + cy * cos) / cell
        if (a < aMin) aMin = a
        if (a > aMax) aMax = a
        if (b < bMin) bMin = b
        if (b > bMax) bMax = b
      }

      ctx.fillStyle = color
      ctx.beginPath()
      for (let jb = Math.floor(bMin); jb <= Math.ceil(bMax); jb++) {
        for (let ia = Math.floor(aMin); ia <= Math.ceil(aMax); ia++) {
          const x = (ia * cos - jb * sin) * cell
          const y = (ia * sin + jb * cos) * cell
          if (x < -cell || x > w + cell || y < -cell || y > h + cell) continue
          const v = tone(sample(x, y, t))
          // площадь точки кодирует тон: радиус ~ sqrt — как у печатного растра
          const r = rMax * Math.sqrt(Math.max(0, v))
          if (r < 0.35) continue
          ctx.moveTo(x + r, y)
          ctx.arc(x, y, r, 0, TAU)
        }
      }
      ctx.fill()
    }

    function render(t: number): void {
      if (w < 2 || h < 2) return
      // лист
      if (paperCtx) ctx.drawImage(paper, 0, 0, w, h)

      const theta = (angleDeg * Math.PI) / 180

      if (passKey === 'trichrome') {
        // трихромия: тон разложен на три пластины — тени / средние / света,
        // сумма чернил постоянна; углы +30° и +60° (при 45° — классика 15/45/75)
        drawPass(theta, INKS[inkKey] ?? INKS.ink, (v) => clamp(2 * v - 1, 0, 1), t)
        drawPass(
          theta + DUOTONE_SHIFT,
          INKS[ink2Key] ?? INKS.vermilion,
          (v) => 1 - Math.abs(2 * v - 1),
          t,
        )
        drawPass(theta + TRICHROME_SHIFT, INKS[ink3Key] ?? INKS.ochre, (v) => clamp(1 - 2 * v, 0, 1), t)
      } else {
        drawPass(theta, INKS[inkKey] ?? INKS.ink, (v) => v, t)

        // второй прогон: инверсия тона на решётке +30° — сумма чернил постоянна
        if (passKey === 'duotone') {
          drawPass(theta + DUOTONE_SHIFT, INKS[ink2Key] ?? INKS.vermilion, (v) => 1 - v, t)
        }
      }

      // метки реза: угловые скобы печатного листа — как у оттиска
      // под рез; цветом основной краски, полупрозрачно
      ctx.strokeStyle = INKS[inkKey] ?? INKS.ink
      ctx.globalAlpha = 0.65
      ctx.lineWidth = 1
      const inset = Math.max(7, Math.min(12, w * 0.035)) // отступ скобы от края листа
      const arm = Math.max(10, Math.min(20, w * 0.06)) // длина плеча скобы
      ctx.beginPath()
      // (x, y) — угол скобы, плечи тянутся внутрь листа
      const brackets: [number, number, number, number][] = [
        [inset, inset, 1, 1],
        [w - inset, inset, -1, 1],
        [inset, h - inset, 1, -1],
        [w - inset, h - inset, -1, -1],
      ]
      for (const [bx, by, sx, sy] of brackets) {
        ctx.moveTo(bx + sx * arm, by)
        ctx.lineTo(bx, by)
        ctx.lineTo(bx, by + sy * arm)
      }
      ctx.stroke()
      ctx.globalAlpha = 1

      // кольцо лупы: тонкая окружность вокруг курсора; в дуотоне — цветом
      // второй краски, в трихромии — третьей, чтобы под курсором читались
      // обе дополнительные пластины
      if (pointer.x > -1000 && pointer.y > -1000) {
        ctx.strokeStyle =
          passKey === 'trichrome'
            ? (INKS[ink3Key] ?? INKS.ochre)
            : passKey === 'duotone'
              ? (INKS[ink2Key] ?? INKS.vermilion)
              : (INKS[inkKey] ?? INKS.ink)
        ctx.globalAlpha = 0.38
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.arc(pointer.x, pointer.y, LOUPE_R, 0, TAU)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
    }

    resize()

    return {
      pointer,
      frame(t) {
        if (opts.reduced) {
          render(2.7) // статичная фаза поля — параметры работают, лупа жива
          return
        }
        render(t)
      },
      setParam(key, value) {
        if (key === 'source' && typeof value === 'string') {
          sourceKey = value
          sourceFn = SOURCES[sourceKey] ?? SOURCES.interference
        } else if (key === 'cell' && typeof value === 'number') {
          cell = value
        } else if (key === 'angle' && typeof value === 'number') {
          angleDeg = value
        } else if (key === 'pass' && typeof value === 'string') {
          passKey = value
        } else if (key === 'ink' && typeof value === 'string') {
          inkKey = value
        } else if (key === 'ink2' && typeof value === 'string') {
          ink2Key = value
        } else if (key === 'ink3' && typeof value === 'string') {
          ink3Key = value
        }
      },
      resize,
      destroy() {
        /* кэш бумаги подберёт сборщик мусора */
      },
    }
  },
}
