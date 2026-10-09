/**
 * Верлет-модуль акта «ТКАНЬ»: точки + дистанционные ограничения.
 * Интеграция Верле, 4–6 итераций удовлетворения ограничений,
 * разрыв связи при растяжении > tearFactor × длины покоя.
 * Оторвавшиеся от крюков точки помечаются detached и передаются
 * физическому миру (AABB-режим).
 */

import type { Body, World } from './physics'

export interface ChainGlyph {
  char: string
  size: number
  weight: number
  color: string
}

export interface VPoint {
  id: number
  x: number
  y: number
  px: number
  py: number
  pinned: boolean
  /** глиф в точке; null — служебная точка (крюк, пробел) */
  glyph: ChainGlyph | null
  /** оторвана от крюков — дальше живёт как физическое тело */
  detached: boolean
  body: Body | null
}

export interface VLink {
  a: number
  b: number
  rest: number
  broken: boolean
}

export interface TearSpot {
  x: number
  y: number
  seed: number
}

export class VerletChain {
  points: VPoint[] = []
  links: VLink[] = []
  gravity = 1500
  damping = 0.994
  iterations = 5
  tearFactor = 1.6
  /** точки, оторвавшиеся после последнего шага (для конвертации в тела) */
  newlyDetached: VPoint[] = []
  /** места разрывов за последний шаг */
  tears: TearSpot[] = []

  private nextId = 1

  addPoint(
    x: number,
    y: number,
    glyph: ChainGlyph | null,
    pinned = false,
  ): VPoint {
    const p: VPoint = {
      id: this.nextId++,
      x,
      y,
      px: x,
      py: y,
      pinned,
      glyph,
      detached: false,
      body: null,
    }
    this.points.push(p)
    return p
  }

  link(a: number, b: number, rest?: number): VLink {
    const pa = this.points[a]
    const pb = this.points[b]
    const l: VLink = {
      a,
      b,
      rest: rest ?? Math.hypot(pb.x - pa.x, pb.y - pa.y),
      broken: false,
    }
    this.links.push(l)
    return l
  }

  clear(): void {
    this.points.length = 0
    this.links.length = 0
    this.newlyDetached.length = 0
    this.tears.length = 0
    this.nextId = 1
  }

  get intact(): boolean {
    for (const l of this.links) if (!l.broken) return true
    return false
  }

  step(h: number, draggedId: number, dragX: number, dragY: number): void {
    const hh = h * h
    const g = this.gravity
    const damp = this.damping

    for (const p of this.points) {
      if (p.pinned || p.detached) continue
      if (p.id === draggedId) {
        // захваченная точка следует за курсором, история позиций даёт скорость
        p.px = p.x
        p.py = p.y
        p.x += (dragX - p.x) * 0.5
        p.y += (dragY - p.y) * 0.5
        continue
      }
      const vx = (p.x - p.px) * damp
      const vy = (p.y - p.py) * damp
      p.px = p.x
      p.py = p.y
      p.x += vx
      p.y += vy + g * hh
    }

    let torn = false
    for (let it = 0; it < this.iterations; it++) {
      for (const l of this.links) {
        if (l.broken) continue
        this.satisfy(l)
      }
    }
    for (const l of this.links) {
      if (l.broken) continue
      const pa = this.points[l.a]
      const pb = this.points[l.b]
      if (pa.detached || pb.detached) continue
      const d = Math.hypot(pb.x - pa.x, pb.y - pa.y)
      if (d > l.rest * this.tearFactor) {
        l.broken = true
        torn = true
        this.tears.push({
          x: (pa.x + pb.x) / 2,
          y: (pa.y + pb.y) / 2,
          seed: Math.floor(d * 97) % 360,
        })
      }
    }
    if (torn) this.refreshDetachment()
  }

  private satisfy(l: VLink): void {
    const pa = this.points[l.a]
    const pb = this.points[l.b]
    if (pa.detached || pb.detached) return
    const dx = pb.x - pa.x
    const dy = pb.y - pa.y
    const d = Math.hypot(dx, dy)
    if (d < 1e-6) return
    const wa = pa.pinned ? 0 : 1
    const wb = pb.pinned ? 0 : 1
    const s = wa + wb
    if (s === 0) return
    const diff = (d - l.rest) / d
    // жёсткость связи — полный диапазон, разрыв проверяется отдельно
    const k = 0.92
    pa.x += dx * diff * (wa / s) * k
    pa.y += dy * diff * (wa / s) * k
    pb.x -= dx * diff * (wb / s) * k
    pb.y -= dy * diff * (wb / s) * k
  }

  /** Пересчёт связности от крюков: всё, что больше не держится, — отрыв. */
  private refreshDetachment(): void {
    const connected = new Set<number>()
    const stack: VPoint[] = []
    for (const p of this.points) {
      if (p.pinned && !p.detached) {
        connected.add(p.id)
        stack.push(p)
      }
    }
    const adj = new Map<number, number[]>()
    for (const l of this.links) {
      if (l.broken) continue
      const pa = this.points[l.a]
      const pb = this.points[l.b]
      if (pa.detached || pb.detached) continue
      const la = adj.get(l.a)
      if (la) la.push(l.b)
      else adj.set(l.a, [l.b])
      const lb = adj.get(l.b)
      if (lb) lb.push(l.a)
      else adj.set(l.b, [l.a])
    }
    while (stack.length) {
      const p = stack.pop() as VPoint
      const neighbors = adj.get(p.id)
      if (!neighbors) continue
      for (const nid of neighbors) {
        if (!connected.has(nid)) {
          connected.add(nid)
          stack.push(this.points[nid])
        }
      }
    }
    this.newlyDetached.length = 0
    for (const p of this.points) {
      if (!p.pinned && !p.detached && !connected.has(p.id)) {
        p.detached = true
        this.newlyDetached.push(p)
      }
    }
  }

  /** Скорость точки (px/s) — для передачи импульса телу при отрыве. */
  pointVelocity(p: VPoint, h: number): { vx: number; vy: number } {
    return { vx: ((p.x - p.px) / h) * 0.9, vy: ((p.y - p.py) / h) * 0.9 }
  }

  /** Служебная точка по id (или null). */
  byId(id: number): VPoint | null {
    for (const p of this.points) if (p.id === id) return p
    return null
  }

  /** Headless-расслабление цепи (мгновенный провис для reduced-motion). */
  relax(steps: number, h: number): void {
    for (let i = 0; i < steps; i++) this.step(h, -1, 0, 0)
  }
}
