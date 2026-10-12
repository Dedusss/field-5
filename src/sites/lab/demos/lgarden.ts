/**
 * Л·07 «L-САД» — детерминированный сад из L-систем.
 *
 * Грамматика с одной аксиомой и двумя правилами разворачивается в строку
 * команд черепахи; строка обходится каждый кадр с накопленным ветром —
 * поэтому растения качаются, не теряя формы. Прорастание — просто доля
 * пройденных сегментов. Семя переключает сад целиком: тот же сад можно
 * воспроизвести по индексу семени.
 */

import { clamp, mulberry32 } from '@/lib/lab/math'
import { numParam, strParam, type DemoInstance, type DemoModule } from '@/lib/lab/types'

/** Правила грамматики: побег X и стебель F. */
const RULES: Record<string, string> = {
  X: 'F+[[X]-X]-F[-FX]+X',
  F: 'FF',
}
const AXIOM = 'X'

function expand(iterations: number): string {
  let s = AXIOM
  for (let i = 0; i < iterations; i++) {
    let next = ''
    for (const ch of s) next += RULES[ch] ?? ch
    s = next
  }
  return s
}

const PLANTS = 3

export const lgardenDemo: DemoModule = {
  id: 'lgarden',
  title: 'L-сад',
  latin: 'L-SYSTEM GARDEN',
  category: 'gen',
  description:
    'Сад растёт из грамматики: аксиома и два правила разворачиваются в команды черепахи — и несколько растений прорастают на глазах, послушно качаясь от ветра. Семя детерминировано: одинаковый номер — одинаковый сад, как у настоящего генератора миров.',
  tech: 'canvas 2d · L-система (аксиома + правила) · turtle-интерпретация · mulberry32-семя',
  params: [
    { key: 'angle', label: 'Угол ветвления', kind: 'range', min: 10, max: 40, step: 1, value: 24 },
    { key: 'depth', label: 'Глубина', kind: 'range', min: 3, max: 7, step: 1, value: 5 },
    { key: 'wind', label: 'Ветер', kind: 'range', min: 0, max: 1, step: 0.05, value: 0.35 },
    {
      key: 'seed',
      label: 'Семя',
      kind: 'select',
      value: '1',
      options: [1, 2, 3, 4].map((n) => ({ value: String(n), label: `№${n}` })),
    },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    let w = 1
    let h = 1
    let angle = numParam(params, 'angle', 24)
    let depth = Math.round(numParam(params, 'depth', 5))
    let wind = numParam(params, 'wind', 0.35)
    let seed = strParam(params, 'seed', '1')

    // Паспорта растений: позиция, масштаб, джиттер угла, фаза — всё от семени.
    let garden: { x: number; scale: number; angJit: number; phase: number }[] = []
    const buildGarden = (): void => {
      const rng = mulberry32(parseInt(seed, 10) * 99991 + 7)
      garden = []
      for (let i = 0; i < PLANTS; i++) {
        garden.push({
          x: w * (0.2 + 0.3 * i) + (rng() - 0.5) * w * 0.06,
          scale: h * 0.155 * (0.82 + rng() * 0.4),
          angJit: 0.8 + rng() * 0.45,
          phase: rng() * Math.PI * 2,
        })
      }
    }

    let tokens = expand(depth)
    const rebuildTokens = (): void => {
      tokens = expand(Math.round(depth))
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
      buildGarden()
      if (opts.reduced) draw(1.0, 0)
    }

    /**
     * Обход строки черепахой с накопленным ветром.
     * bin-ы по глубине стека дают разную толщину: ствол толстый, концы тонкие.
     */
    function draw(t: number, windNow: number): void {
      ctx.fillStyle = '#0d0c0a'
      ctx.fillRect(0, 0, w, h)
      const baseY = h * 0.9
      // всего сегментов F в строке — норма для «доли прорастания»
      const totalF = tokens.split('F').length - 1

      // земля
      ctx.strokeStyle = 'rgba(236,231,221,0.14)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(w * 0.06, baseY)
      ctx.lineTo(w * 0.94, baseY)
      ctx.stroke()

      for (const g of garden) {
        const growth = clamp((t + 0.8 - g.phase * 0.15) / 6.5, 0.04, 1)
        const budget = Math.max(1, Math.floor(totalF * growth))

        const rad = (angle * g.angJit * Math.PI) / 180
        let x = g.x
        let y = baseY
        let a = -Math.PI / 2
        let seg = 0
        const stack: number[] = []
        // bin-ы: 0 — ствол/скелет, 1 — средние ветви, 2 — тонкие концы
        const paths: number[][] = [[], [], []]
        const tips: number[] = []

        for (let ci = 0; ci < tokens.length; ci++) {
          const ch = tokens[ci]
          if (ch === 'F') {
            if (seg < budget) {
              const wob =
                windNow * 0.045 * Math.sin(t * 1.5 + seg * 0.33 + g.phase) * (0.35 + stack.length * 0.65)
              a += wob
              const nx = x + Math.cos(a) * g.scale * 0.16
              const ny = y + Math.sin(a) * g.scale * 0.16
              const bin = Math.min(stack.length, 2)
              paths[bin].push(x, y, nx, ny)
              x = nx
              y = ny
              seg++
            } else {
              // лимит роста: остальную строку пропускаем — но счётчик сегментов ведём
              seg++
            }
          } else if (ch === '+') a += rad
          else if (ch === '-') a -= rad
          else if (ch === '[') {
            stack.push(x, y, a)
          } else if (ch === ']') {
            if (seg < budget) tips.push(x, y)
            const sy = stack.pop()
            const sx = stack.pop()
            const sa = stack.pop()
            if (sx === undefined || sy === undefined || sa === undefined) continue
            x = sx
            y = sy
            a = sa
          }
        }

        const widths = [2.1, 1.2, 0.7]
        const styles = ['rgba(214,205,188,0.9)', 'rgba(196,186,166,0.75)', 'rgba(232,179,77,0.8)']
        for (let b = 0; b < 3; b++) {
          const p = paths[b]
          if (p.length === 0) continue
          ctx.strokeStyle = styles[b]
          ctx.lineWidth = widths[b] * Math.max(0.8, g.scale / (h * 0.155))
          ctx.lineCap = 'round'
          ctx.beginPath()
          for (let k = 0; k < p.length; k += 4) {
            ctx.moveTo(p[k], p[k + 1])
            ctx.lineTo(p[k + 2], p[k + 3])
          }
          ctx.stroke()
        }
        // почки на кончиках отросших ветвей
        ctx.fillStyle = 'rgba(232,179,77,0.95)'
        for (let k = 0; k < tips.length; k += 2) {
          ctx.beginPath()
          ctx.arc(tips[k], tips[k + 1], 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    resize()

    return {
      frame(t) {
        if (opts.reduced) {
          draw(9, 0) // взрослый сад, штиль
          return
        }
        draw(t, wind)
      },
      setParam(key, value) {
        if (key === 'angle' && typeof value === 'number') angle = value
        else if (key === 'depth' && typeof value === 'number') {
          depth = Math.round(value)
          rebuildTokens()
        } else if (key === 'wind' && typeof value === 'number') wind = value
        else if (key === 'seed' && typeof value === 'string') {
          seed = value
          buildGarden()
        }
      },
      resize,
      destroy() {
        /* чистить нечего */
      },
    }
  },
}
