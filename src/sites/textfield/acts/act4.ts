/**
 * АКТ IV «ВАШ ГОЛОС» — общая песочница.
 * На полу уже лежит материя: куча заголовка акта I + обрывки ткани.
 * Текст из инпута (до 90 знаков, санитизированный) падает в мир красными
 * глифами. Панель: Ветер (от края к краю), Антигравитация (g < 0,
 * буквы всплывают и жмутся к потолку), Встряхнуть, Сброс.
 */

import { World } from '../physics'
import { Rng, ACT_SEEDS } from '../rng'
import {
  PALETTE,
  clamp,
  floorLineY,
  sanitizeUserText,
  type PointerState,
  type Vec2,
} from '../types'
import {
  BodyDragger,
  drawBody,
  drawFloor,
  type Act,
  type ActEnv,
} from './act-utils'
import { SCRAPS } from './act2'

const TITLE_LINES = ['ЯЗЫК — ЭТО', 'ВЕЩЕСТВО']
const DISPLAY_WEIGHT = 800
const USER_WEIGHT = 800
const MATTER_WEIGHT = 700

export class ActSandbox implements Act {
  readonly index = 3
  private world = new World()
  private drag = new BodyDragger()
  private rng = new Rng(ACT_SEEDS[3])
  private env: ActEnv | null = null
  windOn = false
  antigravity = false

  build(env: ActEnv): void {
    this.env = env
    this.rng = new Rng(ACT_SEEDS[3])
    this.drag = new BodyDragger()
    this.buildBaseMatter()
  }

  /** Начальная материя: куча заголовка + обрывки ткани. */
  private buildBaseMatter(): void {
    const env = this.env
    if (!env) return
    const { w, h, atlas } = env
    this.world.clear()
    const floorY = floorLineY(h)
    this.world.gravity = env.gravity
    this.world.setBounds({
      floorY,
      leftX: 6,
      rightX: w - 6,
      ceilingY: this.antigravity ? 0 : -1600,
    })

    // куча заголовка акта I (чуть компактнее)
    let size = w * 0.085
    const lineWidth = (line: string): number => {
      let width = 0
      for (const ch of line)
        width += atlas.measure(ch, size, DISPLAY_WEIGHT).advance
      return width + size * 0.03 * (line.length - 1)
    }
    let maxLine = 0
    for (const line of TITLE_LINES)
      maxLine = Math.max(maxLine, lineWidth(line))
    if (maxLine > w * 0.7) size *= (w * 0.7) / maxLine

    const heapCX = w * 0.38
    let order = 0
    TITLE_LINES.forEach((line) => {
      const lw = lineWidth(line)
      let cursor = heapCX - lw / 2
      for (const ch of line) {
        const met = atlas.measure(ch, size, DISPLAY_WEIGHT)
        if (ch !== ' ') {
          this.world.add({
            char: ch,
            size,
            weight: DISPLAY_WEIGHT,
            color: PALETTE.ink,
            x: cursor + met.advance / 2 + this.rng.signed() * 6,
            y: floorY - 200 - order * 14 - this.rng.range(0, 120),
            hw: met.inkW / 2 + size * 0.02,
            hh: met.inkH / 2 + size * 0.02,
            vx: this.rng.signed() * 30,
          })
          order++
        }
        cursor += met.advance + size * 0.03
      }
    })

    // обрывки ткани — справа, отдельно
    const scrapSize = clamp(
      (w * 0.2) / (atlas.measureTextWidth(SCRAPS[2], 100, MATTER_WEIGHT) / 100),
      16,
      34,
    )
    SCRAPS.forEach((frag, fi) => {
      const fw = atlas.measureTextWidth(frag, scrapSize, MATTER_WEIGHT)
      let cursor = w * 0.78 - fw / 2 + this.rng.signed() * 20
      const baseY = floorY - 60 - fi * (scrapSize * 1.5)
      for (const ch of frag) {
        const met = atlas.measure(ch, scrapSize, MATTER_WEIGHT)
        if (ch !== ' ') {
          this.world.add({
            char: ch,
            size: scrapSize,
            weight: MATTER_WEIGHT,
            color: PALETTE.ink,
            x: cursor + met.advance / 2,
            y: baseY - this.rng.range(0, 60),
            hw: met.inkW / 2 + scrapSize * 0.02,
            hh: met.inkH / 2 + scrapSize * 0.02,
            vx: this.rng.signed() * 20,
          })
        }
        cursor += met.advance
      }
    })

    // мгновенная укладка всей материи (куча «уже лежит»)
    this.world.settle(560)
  }

  /** Выпуск пользовательского текста в мир. */
  releaseText(raw: string): number {
    const env = this.env
    if (!env) return 0
    const text = sanitizeUserText(raw).trim()
    if (!text) return 0
    const { w, h, atlas } = env

    let size = clamp(w * 0.058, 30, 66)
    const widthAt = (s: number): number => {
      let width = 0
      for (const ch of text) {
        width +=
          ch === ' ' ? s * 0.42 : atlas.measure(ch, s, USER_WEIGHT).advance
      }
      return width
    }
    if (widthAt(size) > w * 0.86) size *= (w * 0.86) / widthAt(size)

    let cursor = (w - widthAt(size)) / 2
    let order = 0
    let spawned = 0
    for (const ch of text) {
      if (ch !== ' ') {
        const met = atlas.measure(ch, size, USER_WEIGHT)
        this.world.add({
          char: ch,
          size,
          weight: USER_WEIGHT,
          color: PALETTE.red,
          x: cursor + met.advance / 2,
          y: this.antigravity ? 90 + order * 6 : -(70 + order * 9),
          hw: met.inkW / 2 + size * 0.02,
          hh: met.inkH / 2 + size * 0.02,
          vx: this.rng.signed() * 26,
          spawnDelay: order * 0.05,
          accent: true,
        })
        spawned++
      }
      cursor += ch === ' ' ? size * 0.42 : atlas.measure(ch, size, USER_WEIGHT).advance
      order++
    }
    return spawned
  }

  setWind(on: boolean): void {
    this.windOn = on
  }

  setAntigravity(on: boolean): void {
    this.antigravity = on
    if (!this.env) return
    this.world.gravity = on ? -this.env.gravity * 0.58 : this.env.gravity
    this.world.setBounds({ ceilingY: on ? 0 : -1600 })
    if (on) {
      // всё всплывает к потолку
      this.world.wakeAll()
      for (const b of this.world.bodies) b.vy -= 120
    } else {
      this.world.wakeAll()
    }
  }

  shake(): void {
    this.world.shake(this.rng)
  }

  reset(): void {
    this.windOn = false
    this.antigravity = false
    this.buildBaseMatter()
  }

  update(dt: number, now: number, pointer: PointerState): void {
    const env = this.env
    if (!env) return
    if (this.drag.active) this.drag.update(dt, pointer)

    if (this.windOn) {
      // обдув от края к краю: направление плавно перекатывается
      const wind = Math.sin(now * 0.55)
      const strength = wind * 1050
      for (const b of this.world.bodies) {
        if (b.dormant) continue
        b.vx += strength * dt
        b.vy += Math.sin(now * 0.9 + b.x * 0.012) * 130 * dt
        if (Math.abs(strength) > 240 && b.sleeping) this.world.wake(b)
      }
    }

    this.world.step(dt)
  }

  render(ctx: CanvasRenderingContext2D): void {
    const env = this.env
    if (!env) return
    drawFloor(ctx, this.world.bounds.floorY, env.w, PALETTE.ink)
    const atlas = env.atlas
    const bodies = this.world.bodies
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]
      if (b.dormant) continue
      drawBody(ctx, atlas, b)
    }
  }

  hit(x: number, y: number): boolean {
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
        return true
    }
    return false
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
    for (const b of this.world.bodies) {
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
    return this.world.awakeCount === 0
  }
}
