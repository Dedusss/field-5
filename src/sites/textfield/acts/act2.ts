/**
 * АКТ II «ТКАНЬ» — «Смысл держится на связях, которые можно порвать».
 * Гирлянда: глифы = верлет-точки вдоль цепи, оба конца — крюки сверху.
 * Гравитация даёт провис (катенарь); драг деформирует цепь;
 * растяжение связи > 1.6× рвёт её — красная вспышка, и оторвавшийся
 * кусок падает на пол как физические AABB-тела.
 */

import type { GlyphAtlas } from '../atlas'
import { World } from '../physics'
import { Rng, ACT_SEEDS } from '../rng'
import { PALETTE, floorLineY, type PointerState, type Vec2 } from '../types'
import { VerletChain, type VPoint } from '../verlet'
import {
  BodyDragger,
  drawBody,
  drawFloor,
  type Act,
  type ActEnv,
} from './act-utils'

export const SENTENCE = 'Смысл держится на связях, которые можно порвать'
export const SCRAPS = ['Смысл', 'связях,', 'порвать']
const WEIGHT = 700
const VERLET_H = 1 / 120
const FLASH_LIFE = 0.55

interface Flash {
  x: number
  y: number
  born: number
  seed: number
}

export class ActCloth implements Act {
  readonly index = 1
  private chain = new VerletChain()
  private world = new World()
  private drag = new BodyDragger()
  private dragPointId = -1
  private rng = new Rng(ACT_SEEDS[1])
  private env: ActEnv | null = null
  private flashes: Flash[] = []
  private accum = 0
  private hookA = { x: 0, y: 0 }
  private hookB = { x: 0, y: 0 }
  private glyphSize = 40

  build(env: ActEnv): void {
    this.env = env
    this.rng = new Rng(ACT_SEEDS[1])
    this.chain.clear()
    this.world.clear()
    this.drag = new BodyDragger()
    this.dragPointId = -1
    this.flashes.length = 0
    this.accum = 0

    const { w, h, atlas } = env
    const floorY = floorLineY(h)
    this.world.gravity = env.gravity
    this.world.setBounds({
      floorY,
      leftX: 6,
      rightX: w - 6,
      ceilingY: -2400,
    })
    this.chain.gravity = env.gravity * 0.85

    const hookY = Math.max(120, h * 0.2)
    const x1 = w * 0.09
    const x2 = w * 0.91
    this.hookA = { x: x1, y: hookY }
    this.hookB = { x: x2, y: hookY }
    const span = x2 - x1

    // кегль: строка растягивается ровно между крюками
    let size = span / atlas.measureTextWidth(SENTENCE, 100, WEIGHT) * 100
    size = Math.max(18, Math.min(54, size))
    this.glyphSize = size

    // целевая кривая провиса (парабола) и позиции глифов по ней
    const sag = h * 0.16
    const startSag = env.reducedMotion ? sag : sag * 0.4
    const curveY = (t: number, s: number): number =>
      hookY + s * 4 * t * (1 - t)

    // раскладка: x пропорционально естественным ширинам глифов;
    // центр глифа — в середине своегоAdvance, чтобы крайние глифы
    // не совпадали с крюками (нулевой сегмент = мгновенный разрыв)
    const chars: { char: string; adv: number }[] = []
    let totalAdv = 0
    for (const ch of SENTENCE) {
      const adv =
        ch === ' ' ? size * 0.5 : atlas.measure(ch, size, WEIGHT).advance
      chars.push({ char: ch, adv })
      totalAdv += adv
    }
    let advCursor = 0
    const layout: { char: string; x: number; y: number }[] = []
    for (const c of chars) {
      const t = totalAdv > 0 ? (advCursor + c.adv / 2) / totalAdv : 0
      const px = x1 + span * t
      const py = curveY(t, startSag)
      layout.push({ char: c.char, x: px, y: py })
      advCursor += c.adv
    }

    const chain = this.chain
    chain.addPoint(x1, hookY, null, true)
    for (const item of layout) {
      const glyph =
        item.char === ' '
          ? null
          : { char: item.char, size, weight: WEIGHT, color: PALETTE.ink }
      chain.addPoint(item.x, item.y, glyph)
    }
    chain.addPoint(x2, hookY, null, true)

    for (let i = 0; i < chain.points.length - 1; i++) {
      // длина покоя — по целевой (глубокой) кривой провиса
      const a = chain.points[i]
      const b = chain.points[i + 1]
      const deepRest = this.deepRest(a, b, x1, span, sag, hookY)
      chain.link(i, i + 1, deepRest)
    }

    if (env.reducedMotion) {
      chain.relax(220, VERLET_H)
    }
  }

  /** Длина связи по целевой кривой провиса. */
  private deepRest(
    a: VPoint,
    b: VPoint,
    x1: number,
    span: number,
    sag: number,
    hookY: number,
  ): number {
    const ta = Math.max(0, Math.min(1, (a.x - x1) / span))
    const tb = Math.max(0, Math.min(1, (b.x - x1) / span))
    const ya = hookY + sag * 4 * ta * (1 - ta)
    const yb = hookY + sag * 4 * tb * (1 - tb)
    return Math.hypot(b.x - a.x, yb - ya)
  }

  restore(): void {
    if (this.env) this.build(this.env)
  }

  private flashNow = 0

  update(dt: number, now: number, pointer: PointerState): void {
    const env = this.env
    if (!env) return
    this.flashNow = now

    // верлет фиксированным шагом
    this.accum = Math.min(this.accum + dt, VERLET_H * 6)
    while (this.accum >= VERLET_H) {
      this.chain.step(
        VERLET_H,
        this.dragPointId,
        pointer.x,
        pointer.y,
      )
      this.accum -= VERLET_H
    }

    // вспышки разрывов
    for (const t of this.chain.tears) {
      this.flashes.push({ x: t.x, y: t.y, born: now, seed: t.seed })
    }
    this.chain.tears.length = 0

    // оторвавшиеся куски → физические тела
    if (this.chain.newlyDetached.length > 0) {
      const atlas = env.atlas
      for (const p of this.chain.newlyDetached) {
        if (!p.glyph) continue
        const met = atlas.measure(p.glyph.char, p.glyph.size, p.glyph.weight)
        const vel = this.chain.pointVelocity(p, VERLET_H)
        const body = this.world.add({
          char: p.glyph.char,
          size: p.glyph.size,
          weight: p.glyph.weight,
          color: p.glyph.color,
          x: p.x,
          y: p.y,
          hw: met.inkW / 2 + p.glyph.size * 0.02,
          hh: met.inkH / 2 + p.glyph.size * 0.02,
          vx: vel.vx,
          vy: vel.vy,
        })
        p.body = body
        // если разорвали прямо за захваченную точку — тело остаётся в руке
        if (p.id === this.dragPointId) {
          this.dragPointId = -1
          this.world.wake(body)
          this.drag.setBody(body, pointer.x, pointer.y)
        }
      }
      this.chain.newlyDetached.length = 0
    }

    if (this.drag.active) this.drag.update(dt, pointer)
    this.world.step(dt)

    this.flashes = this.flashes.filter(
      (f) => now - f.born < FLASH_LIFE,
    )
  }

  render(ctx: CanvasRenderingContext2D): void {
    const env = this.env
    if (!env) return
    const atlas = env.atlas

    drawFloor(ctx, this.world.bounds.floorY, env.w, PALETTE.ink)

    // крюки: стержень от верха + точка
    ctx.strokeStyle = PALETTE.ink
    ctx.lineWidth = 1
    for (const hk of [this.hookA, this.hookB]) {
      ctx.beginPath()
      ctx.moveTo(hk.x, 0)
      ctx.lineTo(hk.x, hk.y - 4)
      ctx.stroke()
      ctx.fillStyle = PALETTE.ink
      ctx.beginPath()
      ctx.arc(hk.x, hk.y, 3.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // нити связей
    ctx.strokeStyle = 'rgba(138, 134, 124, 0.55)'
    ctx.lineWidth = 1
    const pts = this.chain.points
    for (const l of this.chain.links) {
      if (l.broken) continue
      const a = pts[l.a]
      const b = pts[l.b]
      if (a.detached || b.detached) continue
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    // глифы цепи с наклоном по касательной
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (p.detached) continue
      if (!p.glyph) {
        // пробел — узелок нити
        if (!p.pinned) {
          ctx.fillStyle = 'rgba(138, 134, 124, 0.65)'
          ctx.beginPath()
          ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
        continue
      }
      const prev = pts[i - 1]
      const next = pts[i + 1]
      let angle = 0
      if (prev && next && !prev.detached && !next.detached) {
        angle = Math.atan2(next.y - prev.y, next.x - prev.x)
        if (angle > 1.1) angle = 1.1
        else if (angle < -1.1) angle = -1.1
      }
      atlas.draw(
        ctx,
        p.glyph.char,
        p.glyph.size,
        p.glyph.weight,
        p.glyph.color,
        p.x,
        p.y,
        angle,
      )
    }

    // обрывки-тела
    const bodies = this.world.bodies
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      if (b.dormant) continue
      drawBody(ctx, atlas, b)
    }

    // вспышки разрывов
    const now = this.flashNow
    for (const f of this.flashes) {
      const t = (now - f.born) / FLASH_LIFE
      if (t < 0 || t > 1) continue
      const alpha = 1 - t
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.strokeStyle = PALETTE.red
      // расходящееся кольцо
      ctx.lineWidth = 2 * (1 - t) + 0.5
      ctx.beginPath()
      ctx.arc(f.x, f.y, 6 + 44 * t, 0, Math.PI * 2)
      ctx.stroke()
      // трещина-щелчок: три штриха
      ctx.lineWidth = 1.6
      for (let k = 0; k < 3; k++) {
        const a = f.seed + k * (Math.PI / 3) + t * 0.6
        const r0 = 4 + 20 * t
        const r1 = r0 + 10 + 14 * (1 - t)
        ctx.beginPath()
        ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0)
        ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1)
        ctx.stroke()
      }
      ctx.restore()
    }
  }

  hit(x: number, y: number): boolean {
    return this.hitPoint(x, y) !== null
  }

  private hitPoint(x: number, y: number): VPoint | null {
    const r = Math.max(26, this.glyphSize * 0.8)
    const r2 = r * r
    for (const p of this.chain.points) {
      if (p.pinned || p.detached) continue
      const dx = p.x - x
      const dy = p.y - y
      if (dx * dx + dy * dy < r2) return p
    }
    return null
  }

  pointerDown(x: number, y: number): boolean {
    const p = this.hitPoint(x, y)
    if (p) {
      this.dragPointId = p.id
      return true
    }
    return this.drag.grab(this.world, x, y)
  }

  pointerMove(_x: number, _y: number): void {
    void _x
    void _y
  }

  pointerUp(vel: Vec2): void {
    // скорость отпущенной точки цепи остаётся в её истории позиций
    this.dragPointId = -1
    this.drag.release(vel)
  }

  fling(): void {
    for (const p of this.chain.points) {
      if (p.pinned || p.detached) continue
      p.py += this.rng.range(260, 760)
      p.px += this.rng.signed() * 160
    }
    const bodies = this.world.bodies
    for (const b of bodies) {
      this.world.wake(b)
      b.vy -= this.rng.range(500, 1200)
      b.vx += this.rng.signed() * 260
      b.angleVel += this.rng.signed() * 2
    }
    this.dragPointId = -1
    this.drag = new BodyDragger()
  }

  glyphCount(): number {
    let n = 0
    for (const p of this.chain.points) {
      if (p.glyph && !p.detached) n++
    }
    for (const b of this.world.bodies) if (!b.dormant) n++
    return n
  }

  settled(): boolean {
    return this.world.awakeCount === 0
  }
}
