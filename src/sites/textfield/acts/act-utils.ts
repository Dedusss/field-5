/** Общий интерфейс акта + разделяемые помощники взаимодействия. */

import type { GlyphAtlas } from '../atlas'
import type { Body, World } from '../physics'
import { applyDragSpring } from '../physics'
import type { PointerState, Vec2 } from '../types'
import { clamp } from '../types'

export interface ActEnv {
  w: number
  h: number
  atlas: GlyphAtlas
  reducedMotion: boolean
  /** базовая гравитация, отмасштабированная от высоты экрана */
  gravity: number
}

export interface Act {
  readonly index: number
  build(env: ActEnv): void
  update(dt: number, now: number, pointer: PointerState): void
  render(ctx: CanvasRenderingContext2D): void
  /** есть ли интерактивный объект в точке (до pointerDown) */
  hit(x: number, y: number): boolean
  pointerDown(x: number, y: number): boolean
  pointerMove(x: number, y: number): void
  pointerUp(vel: Vec2): void
  /** импульс «уноса» глифов при уходе с акта */
  fling(): void
  /** сколько глифов сейчас на сцене */
  glyphCount(): number
  /** все тела уснули / абзац на местах */
  settled(): boolean
}

/** Общий драг AABB-тел (акты I, II и IV). */
export class BodyDragger {
  body: Body | null = null
  private offX = 0
  private offY = 0

  grab(world: World, x: number, y: number): boolean {
    // ищем сверху вниз (последние добавленные — ближе к «поверхности»)
    for (let i = world.bodies.length - 1; i >= 0; i--) {
      const b = world.bodies[i]
      if (b.dormant) continue
      const pad = Math.max(b.hw, b.hh) * 0.4 + 8
      if (
        x > b.x - b.hw - pad &&
        x < b.x + b.hw + pad &&
        y > b.y - b.hh - pad &&
        y < b.y + b.hh + pad
      ) {
        this.body = b
        b.dragged = true
        world.wake(b)
        this.offX = b.x - x
        this.offY = b.y - y
        return true
      }
    }
    return false
  }

  get active(): boolean {
    return this.body !== null
  }

  /** Явный захват уже известного тела (например, оторвавшейся точки цепи). */
  setBody(b: Body, x: number, y: number): void {
    this.body = b
    b.dragged = true
    this.offX = b.x - x
    this.offY = b.y - y
  }

  update(dt: number, pointer: PointerState): void {
    const b = this.body
    if (!b) return
    applyDragSpring(b, pointer.x + this.offX, pointer.y + this.offY, dt)
  }

  release(pointerVel: Vec2): Body | null {
    const b = this.body
    this.body = null
    if (!b) return null
    b.dragged = false
    const vx = clamp(pointerVel.x, -2600, 2600)
    const vy = clamp(pointerVel.y, -2600, 2600)
    // бросок: скорость курсора, слегка смешанная с собственной инерцией
    b.vx = vx * 0.88 + b.vx * 0.12
    b.vy = vy * 0.88 + b.vy * 0.12
    b.sleepTimer = 0
    return b
  }
}

/** Растеризовать тело через атлас (с наклоном). */
export function drawBody(
  ctx: CanvasRenderingContext2D,
  atlas: GlyphAtlas,
  b: Body,
): void {
  atlas.draw(ctx, b.char, b.size, b.weight, b.color, b.x, b.y, b.angle)
}

/** Линия пола: чернильная, 2px. */
export function drawFloor(
  ctx: CanvasRenderingContext2D,
  floorY: number,
  w: number,
  color: string,
): void {
  ctx.fillStyle = color
  ctx.fillRect(0, Math.round(floorY), w, 2)
}
