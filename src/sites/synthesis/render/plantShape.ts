import type { SeedType } from '../types'
import { mulberry32 } from '../util'

export interface Branch {
  len: number
  /** угол относительно родителя (радианы) */
  angle: number
  /** поперечный изгиб квадратичной кривой, -1..1 */
  curve: number
  depth: number
  weight: number
  phase: number
  /** гибкость к ветру */
  flex: number
  /** размер биолюминесцентного кончика (0 = не кончик) */
  tipSize: number
  children: Branch[]
}

export interface PlantSkeleton {
  root: Branch
  maxDepth: number
  height: number
  width: number
}

interface ShapeParams {
  depth: [number, number]
  base: [number, number]
  decay: [number, number]
  spread: [number, number]
  curve: number
  weight: number
  rootChildren: [number, number]
  triChance: number
}

const SHAPES: Record<SeedType, ShapeParams> = {
  // высокий стебель с редкими_fronds, толстый и тягучий
  drone: { depth: [5, 5], base: [0.95, 1.1], decay: [0.78, 0.85], spread: [0.14, 0.3], curve: 0.42, weight: 4.6, rootChildren: [2, 3], triChance: 0.1 },
  // кустик: много тонких ветвей, широко расходится
  pluck: { depth: [5, 6], base: [0.55, 0.72], decay: [0.78, 0.87], spread: [0.4, 0.62], curve: 0.22, weight: 3.1, rootChildren: [2, 3], triChance: 0.3 },
  // три длинные дуги-лианы
  choir: { depth: [5, 6], base: [0.85, 1.05], decay: [0.84, 0.9], spread: [0.3, 0.48], curve: 0.58, weight: 2.4, rootChildren: [3, 3], triChance: 0 },
  // приземистый и мощный
  hit: { depth: [4, 5], base: [0.38, 0.5], decay: [0.85, 0.92], spread: [0.55, 0.78], curve: 0.14, weight: 5.8, rootChildren: [2, 3], triChance: 0.35 },
}

const BUDGET = 170

/** Рекурсивный скелет растения из seed: глубина 5–7, изогнутые ветви, кончики светятся. */
export function buildPlantSkeleton(seed: number, type: SeedType, unit: number): PlantSkeleton {
  const rng = mulberry32((seed ^ 0x517c) >>> 0)
  const sh = SHAPES[type]
  const maxDepth = sh.depth[0] + Math.floor(rng() * (sh.depth[1] - sh.depth[0] + 1))
  let budget = BUDGET
  let minX = 0
  let maxX = 0
  let minY = 0
  const rand = (a: number, b: number) => a + rng() * (b - a)

  const grow = (depth: number, len: number, weight: number): Branch => {
    budget--
    const b: Branch = {
      len,
      angle: 0,
      curve: (rng() * 2 - 1) * sh.curve,
      depth,
      weight,
      phase: rng() * Math.PI * 2,
      flex: (0.7 + rng() * 0.6) / (0.6 + weight * 0.22),
      tipSize: 0,
      children: [],
    }
    if (depth < maxDepth && budget > 0 && len > unit * 0.05) {
      const n =
        depth === 1
          ? Math.round(rand(sh.rootChildren[0], sh.rootChildren[1]))
          : rng() < sh.triChance
            ? 3
            : 2
      const decay = rand(sh.decay[0], sh.decay[1])
      // размах сужается с глубиной — растение тянется вверх
      const spread = rand(sh.spread[0], sh.spread[1]) * (1 - depth * 0.09)
      for (let i = 0; i < n; i++) {
        const child = grow(depth + 1, len * decay, weight * 0.66)
        child.angle =
          (n === 1 ? rand(-0.5, 0.5) : (i / (n - 1) - 0.5) * 2) * spread + rand(-0.1, 0.1)
        b.children.push(child)
      }
    } else {
      b.tipSize = 0.75 + rng() * 0.75
    }
    return b
  }

  const root = grow(0, unit * rand(sh.base[0], sh.base[1]), sh.weight * rand(0.9, 1.15))
  root.angle = rand(-0.14, 0.14)

  // габариты без ветра (для хит-зоны и лейбла)
  const walk = (b: Branch, x: number, y: number, a: number) => {
    const ex = x + Math.cos(a + b.angle) * b.len
    const ey = y + Math.sin(a + b.angle) * b.len
    if (ex < minX) minX = ex
    if (ex > maxX) maxX = ex
    if (ey < minY) minY = ey
    for (const c of b.children) walk(c, ex, ey, a + b.angle)
  }
  walk(root, 0, 0, -Math.PI / 2)

  return { root, maxDepth, height: -minY, width: Math.max(maxX - minX, 10) }
}
