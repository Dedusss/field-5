/**
 * АКТ I «ПАДЕНИЕ» — «ЯЗЫК — ЭТО ВЕЩЕСТВО».
 * Буквы рождаются над экраном по очереди, падают, сталкиваются,
 * скачут (restitution 0.32) и складываются кучей на полу (86% высоты).
 * Драг — пружинная тяга с инерцией; отпускание — бросок со скоростью курсора.
 * Через ~20 с бездействия куча «вздыхает» (кроме reduced-motion).
 */

import type { GlyphAtlas } from '../atlas'
import { World, type Body } from '../physics'
import { Rng, ACT_SEEDS } from '../rng'
import { PALETTE, floorLineY, type PointerState, type Vec2 } from '../types'
import {
  BodyDragger,
  drawBody,
  drawFloor,
  type Act,
  type ActEnv,
} from './act-utils'

const TITLE_LINES = ['ЯЗЫК — ЭТО', 'ВЕЩЕСТВО']
const DISPLAY_WEIGHT = 800
const SIGH_INTERVAL = 20

export class ActFall implements Act {
  readonly index = 0
  private world = new World()
  private drag = new BodyDragger()
  private rng = new Rng(ACT_SEEDS[0])
  private env: ActEnv | null = null
  private idleTime = 0

  build(env: ActEnv): void {
    this.env = env
    this.rng = new Rng(ACT_SEEDS[0])
    this.world.clear()
    this.drag = new BodyDragger()
    this.idleTime = 0

    const { w, h, atlas } = env
    const floorY = floorLineY(h)
    this.world.gravity = env.gravity
    this.world.setBounds({
      floorY,
      leftX: 6,
      rightX: w - 6,
      ceilingY: -2400,
    })

    // подбор кегля: от 11.5vw, но не шире 88% экрана
    let size = w * 0.115
    const tracking = () => size * 0.03
    const lineWidth = (line: string): number => {
      let width = 0
      for (const ch of line) {
        width += atlas.measure(ch, size, DISPLAY_WEIGHT).advance
      }
      width += tracking() * (line.length - 1)
      return width
    }
    let maxLine = 0
    for (const line of TITLE_LINES) maxLine = Math.max(maxLine, lineWidth(line))
    if (maxLine > w * 0.88) {
      size *= (w * 0.88) / maxLine
      maxLine = 0
      for (const line of TITLE_LINES)
        maxLine = Math.max(maxLine, lineWidth(line))
    }

    const lineH = size * 1.04
    const topBaseline = h * 0.3
    let order = 0
    TITLE_LINES.forEach((line, li) => {
      const lw = lineWidth(line)
      let cursor = (w - lw) / 2
      const baseline = topBaseline + li * lineH
      for (const ch of line) {
        const met = atlas.measure(ch, size, DISPLAY_WEIGHT)
        if (ch !== ' ') {
          const hw = met.inkW / 2 + size * 0.02
          const hh = met.inkH / 2 + size * 0.02
          const cx = cursor + met.advance / 2
          const cy = baseline - met.ascent + met.inkH / 2
          this.world.add({
            char: ch,
            size,
            weight: DISPLAY_WEIGHT,
            color: PALETTE.ink,
            x: cx + this.rng.signed() * 3,
            y: -(hh + 90 + order * 22 + this.rng.range(0, 240)),
            hw,
            hh,
            vx: this.rng.signed() * 42,
            spawnDelay: order * 0.055 + this.rng.range(0, 0.05),
            restitution: 0.32,
          })
          order++
        }
        cursor += met.advance + tracking()
      }
    })

    if (env.reducedMotion) {
      // без анимации входа: мгновенная детерминированная укладка кучи
      this.world.settle(620)
    }
  }

  update(dt: number, _now: number, pointer: PointerState): void {
    void _now
    if (this.drag.active) this.drag.update(dt, pointer)
    this.world.step(dt)

    // «вздох» кучи при долгом бездействии
    const env = this.env
    if (env && !env.reducedMotion) {
      if (this.drag.active || pointer.down || this.world.awakeCount > 0) {
        this.idleTime = 0
      } else {
        this.idleTime += dt
        if (this.idleTime > SIGH_INTERVAL) {
          this.world.sigh(this.rng, this.world.bounds.floorY)
          this.idleTime = 0
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const env = this.env
    if (!env) return
    drawFloor(ctx, this.world.bounds.floorY, env.w, PALETTE.ink)
    const atlas: GlyphAtlas = env.atlas
    const bodies = this.world.bodies
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      if (b.dormant) continue
      drawBody(ctx, atlas, b)
    }
  }

  hit(x: number, y: number): boolean {
    return this.hitBody(x, y) !== null
  }

  private hitBody(x: number, y: number): Body | null {
    const bodies = this.world.bodies
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i]
      if (b.dormant) continue
      const pad = Math.max(b.hw, b.hh) * 0.4 + 8
      if (
        x > b.x - b.hw - pad &&
        x < b.x + b.hw + pad &&
        y > b.y - b.hh - pad &&
        y < b.y + b.hh + pad
      )
        return b
    }
    return null
  }

  pointerDown(x: number, y: number): boolean {
    return this.drag.grab(this.world, x, y)
  }

  pointerMove(_x: number, _y: number): void {
    void _x
    void _y
  }

  pointerUp(vel: Vec2): void {
    this.drag.release(vel)
  }

  fling(): void {
    const env = this.env
    const bodies = this.world.bodies
    for (const b of bodies) {
      this.world.wake(b)
      b.dormant = false
      b.dragged = false
      b.vy -= this.rng.range(500, 1300)
      b.vx += this.rng.signed() * 260 + (env ? (b.x - env.w / 2) * 0.45 : 0)
      b.angleVel += this.rng.signed() * 2.2
    }
    this.drag = new BodyDragger()
  }

  glyphCount(): number {
    let n = 0
    for (const b of this.world.bodies) if (!b.dormant) n++
    return n
  }

  settled(): boolean {
    return this.world.awakeCount === 0 && this.glyphCount() > 0
  }
}
