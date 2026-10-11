/**
 * ЭКСП. 05 «ОРГАНИЗМ» — модель детерминированного роста.
 *
 * Каждая graft-мутация из БД превращается в ветвь колонии:
 *   - якорь: позиция на «спирали колонии» — угол mutation.angle, радиальный
 *     отход от ядра растёт с плотностью колонии (лог-спиральное уплотнение);
 *   - форма: рекурсивное ветвление, вся геометрия управляется seeded RNG
 *     mulberry32(hash(id)) — одинаково у всех и во всех сессиях;
 *   - глубина 2..5 уровней задаётся potency (0.1 → 2, 1.0 → 5).
 *
 * Координаты — в единицах радиуса колонии, ядро в (0, 0), ось Y вниз.
 */

import type { Mutation } from './api'
import { hash32, mulberry32 } from './rng'

const TAU = Math.PI * 2

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v

export interface GSeg {
  x0: number
  y0: number
  cx: number
  cy: number
  x1: number
  y1: number
  /** толщина в px при базовом радиусе 560 */
  w: number
  level: number
  /** 0..1 — порядок прорастания внутри ветви */
  order: number
  /** фаза для покачивания */
  swayPh: number
  /** терминальный сегмент (кончик ветви) */
  term: boolean
  /** расстояние кончика от ядра, в единицах R */
  dist: number
  /** единичный радиальный вектор кончика — для толчка волной */
  urx: number
  ury: number
}

export interface GTerminal {
  x: number
  y: number
  dist: number
  level: number
  order: number
}

export interface GBranch {
  id: number
  ax: number
  ay: number
  segs: GSeg[]
  terminals: GTerminal[]
  /** точки для хит-теста наведения (в единицах R) */
  hits: { x: number; y: number }[]
  phase: number
}

/** Смешивание двух направлений по векторам (без разрыва на ±π) */
function blendAngle(a: number, b: number, t: number): number {
  const vx = (1 - t) * Math.cos(a) + t * Math.cos(b)
  const vy = (1 - t) * Math.sin(a) + t * Math.sin(b)
  return Math.atan2(vy, vx)
}

/** Глубина ветвления из potency: 0.1 → 2 уровня, 1.0 → 5 */
export function levelsForPotency(potency: number): number {
  const p = clamp(potency, 0.1, 1)
  return 2 + Math.round(((p - 0.1) / 0.9) * 3)
}

const MAX_SEGS = 40

export function buildBranch(m: Mutation, index: number): GBranch {
  // сид формы — только из id: детерминизм от БД
  const rnd = mulberry32(hash32(m.id * 2654435761 + 11) || 7)
  const potency = clamp(m.potency, 0.1, 1)
  const levels = levelsForPotency(potency)

  // лог-спиральное уплотнение: ранние мутации ближе к ядру, новые — к периферии
  const pack = index / (index + 6)
  const dist = clamp(m.distance, 0.05, 1)
  const anchorR = 0.17 + 0.83 * dist * (0.42 + 0.58 * pack)

  const angle = ((m.angle % TAU) + TAU) % TAU
  const ax = Math.cos(angle) * anchorR
  const ay = Math.sin(angle) * anchorR

  // колония тянется вверх: начальное направление — наружу с фототропизмом
  const dir0 = blendAngle(angle, -Math.PI / 2, 0.32)

  const phase = rnd() * TAU
  const segs: GSeg[] = []
  const terminals: GTerminal[] = []
  const hits: { x: number; y: number }[] = [{ x: ax, y: ay }]
  let grown = 0

  const grow = (x: number, y: number, dir: number, len: number, width: number, level: number): void => {
    if (grown >= MAX_SEGS) return
    grown += 1

    const curve = (rnd() - 0.5) * 1.2
    const midA = dir + curve * 0.35
    const endA = dir + curve * 0.8
    const half = len * 0.52
    const cx = x + Math.cos(midA) * half
    const cy = y + Math.sin(midA) * half
    const x1 = cx + Math.cos(endA) * half
    const y1 = cy + Math.sin(endA) * half
    const d = Math.hypot(x1, y1) || 0.0001

    const seg: GSeg = {
      x0: x,
      y0: y,
      cx,
      cy,
      x1,
      y1,
      w: width,
      level,
      order: 0,
      swayPh: phase + level * 0.7,
      term: false,
      dist: d,
      urx: x1 / d,
      ury: y1 / d,
    }
    segs.push(seg)
    if (level <= 1) hits.push({ x: x1, y: y1 })

    const canRecurse = level + 1 < levels && grown < MAX_SEGS
    if (canRecurse) {
      const kids = level === 0 && levels <= 4 ? (rnd() < 0.65 ? 3 : 2) : 2
      for (let i = 0; i < kids; i++) {
        const spread = 0.5 + rnd() * 0.55
        let cd = endA + spread * (i - (kids - 1) / 2) + (rnd() - 0.5) * 0.4
        cd = blendAngle(cd, -Math.PI / 2, 0.16)
        grow(x1, y1, cd, len * (0.58 + rnd() * 0.2), width * 0.62, level + 1)
      }
    } else {
      seg.term = true
      terminals.push({ x: x1, y: y1, dist: d, level, order: 0 })
    }
  }

  grow(ax, ay, dir0, 0.17 + 0.09 * rnd(), 5.2 + 4.5 * potency, 0)

  // каскад прорастания внутри ветви: по порядку обхода
  const n = Math.max(1, segs.length - 1)
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    s.order = i / n
    s.swayPh = phase + s.order * 1.9 + s.level * 0.55
  }
  for (const t of terminals) {
    const s = segs.find((seg) => seg.x1 === t.x && seg.y1 === t.y)
    t.order = s ? s.order : 1
  }

  // точки хит-теста: якорь, середина и кончик ствола, первый терминал
  if (segs.length > 0) hits.push({ x: segs[0].cx, y: segs[0].cy })
  const tip = terminals[terminals.length - 1]
  if (tip) hits.push({ x: tip.x, y: tip.y })
  hits.splice(8)

  return { id: m.id, ax, ay, segs, terminals, hits, phase }
}

export interface Bead {
  x: number
  y: number
  seed: number
}

/**
 * Пульсы — не ветви: они оставляют «узелки-шрамы» на стволах.
 * Позиция бусины детерминирована hash(id) — точка на квадратичной кривой
 * выбранного ствола.
 */
export function buildBeads(pulses: Mutation[], branches: GBranch[]): Bead[] {
  const beads: Bead[] = []
  for (const p of pulses) {
    const h = hash32(p.id)
    const b = branches.length > 0 ? branches[h % branches.length] : null
    if (!b || b.segs.length === 0) {
      const a = ((h % 360) * Math.PI) / 180
      beads.push({ x: Math.cos(a) * 0.22, y: Math.sin(a) * 0.22 - 0.06, seed: h })
      continue
    }
    const seg = b.segs[Math.min(b.segs.length - 1, (h >>> 8) % b.segs.length)]
    const t = ((h >>> 16) % 100) / 100
    const om = 1 - t
    const q = (a: number, c: number, d: number): number =>
      om * om * a + 2 * om * t * c + t * t * d
    beads.push({ x: q(seg.x0, seg.cx, seg.x1), y: q(seg.y0, seg.cy, seg.y1), seed: h })
  }
  return beads
}
