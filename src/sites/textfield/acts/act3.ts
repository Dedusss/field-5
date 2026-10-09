/**
 * АКТ III «ВЕТЕР» — абзац из трёх строк, где каждый глиф имеет «дом»
 * и пружину домой. Курсор — ветер (сила от скорости курсора, радиус ~140px),
 * плюс поле завихрений на «Шторме». Красное слово легче — его сдувает сильнее.
 * Режимы: Штиль / Бриз / Шторм.
 */

import type { GlyphAtlas } from '../atlas'
import { Rng, ACT_SEEDS } from '../rng'
import { PALETTE, clamp, type PointerState, type Vec2 } from '../types'
import type { Act, ActEnv } from './act-utils'

const LINES = [
  'Слова не приколоты к странице.',
  'Каждый порыв ветра их сдвигает,',
  'но они всегда возвращаются к себе.',
]
const RED_WORD = 'возвращаются'
const WEIGHT = 700
const RADIUS = 140

interface WindGlyph {
  char: string
  hx: number
  hy: number
  x: number
  y: number
  vx: number
  vy: number
  accent: boolean
  /** множитель массы: акцентное слово легче */
  mass: number
}

export type WindMode = 0 | 1 | 2

const GUST_PERIOD = 7
const GUST_SHARE = 0.42

export class ActWind implements Act {
  readonly index = 2
  private glyphs: WindGlyph[] = []
  private env: ActEnv | null = null
  private rng = new Rng(ACT_SEEDS[2])
  mode: WindMode = 1
  private size = 36

  build(env: ActEnv): void {
    this.env = env
    this.rng = new Rng(ACT_SEEDS[2])
    this.glyphs.length = 0

    const { w, h, atlas } = env
    let size = (w * 0.8) / (atlas.measureTextWidth(LINES[2], 100, WEIGHT) / 100)
    size = clamp(size, 20, 46)
    this.size = size
    const lineH = size * 1.34
    const blockH = lineH * (LINES.length - 1)
    const topY = h * 0.36 - blockH / 2

    const redIdx = LINES[2].indexOf(RED_WORD)
    LINES.forEach((line, li) => {
      const lw = atlas.measureTextWidth(line, size, WEIGHT)
      let cursor = (w - lw) / 2
      const baseline = topY + li * lineH
      let ci = 0
      for (const ch of line) {
        const met = atlas.measure(ch, size, WEIGHT)
        if (ch !== ' ') {
          const accent = li === 2 && ci >= redIdx && ci < redIdx + RED_WORD.length
          this.glyphs.push({
            char: ch,
            hx: cursor + met.advance / 2,
            hy: baseline - met.ascent / 2,
            x: cursor + met.advance / 2,
            y: baseline - met.ascent / 2,
            vx: 0,
            vy: 0,
            accent,
            mass: accent ? 0.34 : 1,
          })
        }
        cursor += met.advance
        ci++
      }
    })

    if (env.reducedMotion) {
      // глифы уже в «домах» — без автоколебаний
      for (const g of this.glyphs) {
        g.x = g.hx
        g.y = g.hy
        g.vx = 0
        g.vy = 0
      }
    }
  }

  setMode(mode: WindMode): void {
    this.mode = mode
  }

  update(dt: number, now: number, pointer: PointerState): void {
    const env = this.env
    if (!env) return
    const k = 130
    const c = 8.6
    const t = now
    const mode = this.mode

    // огибающая порыва «Шторма»: сдувает, затем затишье — абзац собирается
    let gust = 0
    if (mode === 2) {
      const phase = (now % GUST_PERIOD) / GUST_PERIOD
      if (phase < GUST_SHARE) {
        const q = phase / GUST_SHARE
        gust = Math.sin(q * Math.PI)
        gust *= gust
      }
    }

    for (const g of this.glyphs) {
      let ax = -k * (g.x - g.hx) - c * g.vx
      let ay = -k * (g.y - g.hy) - c * g.vy

      // ветер от курсора (только пока курсор движется)
      if (pointer.inside) {
        const dx = g.x - pointer.x
        const dy = g.y - pointer.y
        const d2 = dx * dx + dy * dy
        if (d2 < RADIUS * RADIUS) {
          const d = Math.sqrt(d2)
          const fall = 1 - d / RADIUS
          const f = fall * fall * (mode === 0 ? 0.45 : mode === 1 ? 0.85 : 1.25)
          ax += (pointer.vx * 4.4 * f) / g.mass
          ay += (pointer.vy * 4.4 * f) / g.mass
        }
      }

      // бриз: лёгкое дыхание страницы (не в reduced-motion)
      if (mode === 1 && !env.reducedMotion) {
        ax += Math.sin(t * 1.6 + g.hy * 0.013 + g.hx * 0.004) * 66 / g.mass
        ay += Math.cos(t * 1.1 + g.hx * 0.009) * 20 / g.mass
      }

      // шторм: поле завихрений (curl-подобное из sin/cos времени)
      if (mode === 2 && gust > 0) {
        const fx =
          Math.sin(g.y * 0.012 + t * 2.1) + 0.6 * Math.sin(g.y * 0.027 - t * 1.4)
        const fy =
          Math.cos(g.x * 0.011 - t * 1.8) + 0.6 * Math.cos(g.x * 0.023 + t * 1.2)
        // вихрь вокруг центра абзаца
        const cx = env.w / 2
        const cy = env.h * 0.36
        const rx = g.x - cx
        const ry = g.y - cy
        const rd = Math.max(120, Math.hypot(rx, ry))
        const swirl = 1500 * gust
        ax += ((fx * 2100 + (-ry / rd) * swirl) * gust) / g.mass
        ay += ((fy * 2100 + (rx / rd) * swirl) * gust) / g.mass
      }

      g.vx += ax * dt
      g.vy += ay * dt
      g.x += g.vx * dt
      g.y += g.vy * dt
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const env = this.env
    if (!env) return
    const atlas: GlyphAtlas = env.atlas
    const size = this.size
    for (const g of this.glyphs) {
      atlas.draw(
        ctx,
        g.char,
        size,
        WEIGHT,
        g.accent ? PALETTE.red : PALETTE.ink,
        g.x,
        g.y,
      )
    }
  }

  hit(_x: number, _y: number): boolean {
    return false
  }

  pointerDown(_x: number, _y: number): boolean {
    return false
  }

  pointerMove(_x: number, _y: number): void {
    void _x
    void _y
  }

  pointerUp(_vel: Vec2): void {
    void _vel
  }

  fling(): void {
    // абзац уносится вихрем
    for (const g of this.glyphs) {
      g.vx += this.rng.signed() * 900
      g.vy -= this.rng.range(300, 1100)
    }
  }

  glyphCount(): number {
    return this.glyphs.length
  }

  settled(): boolean {
    for (const g of this.glyphs) {
      if (Math.abs(g.x - g.hx) > 2 || Math.abs(g.y - g.hy) > 2) return false
      if (Math.abs(g.vx) > 6 || Math.abs(g.vy) > 6) return false
    }
    return true
  }
}
