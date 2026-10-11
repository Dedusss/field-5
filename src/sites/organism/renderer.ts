/**
 * ЭКСП. 05 «ОРГАНИЗМ» — рендер колонии на Canvas 2D.
 *
 * Производительность (200+ ветвей, тысячи сегментов):
 *   - один canvas, один RAF;
 *   - сегменты батчатся в Path2D по (уровень, толщина) — единицы stroke() на кадр;
 *   - свечение — заранее растеризованные спрайты (drawImage), режим 'lighter';
 *   - глоу только для глубоких терминалей (level >= 2) и с общим капом;
 *   - фон и виньетка кэшируются в offscreen-канвасах.
 */

import type { Mutation } from './api'
import { buildBeads, buildBranch, clamp, levelsForPotency, type GBranch } from './growth'
import { hash32 } from './rng'

const TAU = Math.PI * 2

/** цвета уровней: мох → биолюминесцентный зелёный */
const LEVEL_COLORS = ['#1c5636', '#256b43', '#2f8453', '#3aa465', '#49cf82']
const GREEN = '#4ef08a'
const AMBER = '#e8b34d'

const GLOW_CAP = 240
const WAVE_DURATION = 1900
const WAVE_DURATION_RM = 4200
const WAVE_BAND = 0.24

interface BranchState {
  branch: GBranch
  mutation: Mutation
  /** performance.now() старта прорастания; null — выросла */
  growStart: number | null
  /** длительность прорастания, ms */
  growDur: number
}

interface Wave {
  t0: number
  strength: number
}

interface PlanktonPoint {
  x: number
  y: number
  spd: number
  size: number
  ph: number
}

export interface HoverPayload {
  mutation: Mutation
}

export interface Gene {
  angle: number
  distance: number
  potency: number
}

export interface RendererCallbacks {
  onHoverChange: (payload: HoverPayload | null) => void
  onHoverMove: (x: number, y: number) => void
}

function makeRadialSprite(size: number, stops: Array<[number, string]>): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const g = c.getContext('2d')
  if (!g) return c
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [offset, color] of stops) grd.addColorStop(offset, color)
  g.fillStyle = grd
  g.fillRect(0, 0, size, size)
  return c
}

export class OrganismRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cb: RendererCallbacks
  private dpr = 1
  private w = 0
  private h = 0
  private cx = 0
  private cy = 0
  private R = 300

  private raf = 0
  private ro: ResizeObserver | null = null
  private t0 = performance.now()
  private last = performance.now()

  private branches = new Map<number, BranchState>()
  private pulseList: Mutation[] = []
  private beads: Array<{ x: number; y: number; seed: number }> = []
  private waves: Wave[] = []
  private firstSync = true

  private gen = 1
  private reduced = false

  private pointer = { x: -1, y: -1, inside: false }
  private graftMode = false
  private hoverId: number | null = null

  private plankton: PlanktonPoint[] = []

  private bg: HTMLCanvasElement | null = null
  private vig: HTMLCanvasElement | null = null
  private glowSprite: HTMLCanvasElement
  private coreSprite: HTMLCanvasElement
  private beadSprite: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement, cb: RendererCallbacks) {
    this.canvas = canvas
    this.cb = cb
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D недоступен')
    this.ctx = ctx

    this.glowSprite = makeRadialSprite(96, [
      [0, 'rgba(140,255,180,0.85)'],
      [0.22, 'rgba(78,240,138,0.45)'],
      [0.55, 'rgba(78,240,138,0.12)'],
      [1, 'rgba(78,240,138,0)'],
    ])
    this.coreSprite = makeRadialSprite(256, [
      [0, 'rgba(255,238,196,1)'],
      [0.16, 'rgba(232,179,77,0.85)'],
      [0.42, 'rgba(232,179,77,0.26)'],
      [1, 'rgba(232,179,77,0)'],
    ])
    this.beadSprite = makeRadialSprite(48, [
      [0, 'rgba(255,214,138,0.9)'],
      [0.3, 'rgba(232,179,77,0.35)'],
      [1, 'rgba(232,179,77,0)'],
    ])

    this.resize()
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize())
      this.ro.observe(canvas)
    }

    this.raf = requestAnimationFrame(this.frame)
  }

  /* ------------------------------ публичное API ----------------------------- */

  /** Полная синхронизация множества мутаций; новые прорастают анимацией. */
  setMutations(list: Mutation[]): void {
    const now = performance.now()
    const grafts = list.filter((m) => m.kind === 'graft').sort((a, b) => a.id - b.id)
    this.pulseList = list.filter((m) => m.kind === 'pulse')

    const alive = new Set(grafts.map((m) => m.id))
    for (const id of [...this.branches.keys()]) {
      if (!alive.has(id)) this.branches.delete(id)
    }

    const cascade = this.firstSync
    const n = grafts.length
    const step = Math.min(70, 1500 / Math.max(1, n))
    grafts.forEach((m, i) => {
      const existing = this.branches.get(m.id)
      if (existing) {
        existing.mutation = m
        return
      }
      const branch = buildBranch(m, i)
      const growDur = (this.reduced ? 750 : 1500) * (0.75 + 0.25 * (branch.segs.length / 12))
      this.branches.set(m.id, {
        branch,
        mutation: m,
        growStart: cascade ? now + i * step : now,
        growDur,
      })
    })
    this.firstSync = false
    this.rebuildBeads()
  }

  /** Оптимистичная прививка получила настоящий id с сервера — пересобрать сид. */
  adopt(tempId: number, m: Mutation): void {
    this.branches.delete(tempId)
    const index = this.branches.size // подтверждённая прививка — самая свежая
    this.branches.set(m.id, {
      branch: buildBranch(m, index),
      mutation: m,
      growStart: null,
      growDur: 1,
    })
    this.rebuildBeads()
  }

  /** Снять оптимистичную ветвь (например, 429 от сервера). */
  discard(tempId: number): void {
    this.branches.delete(tempId)
  }

  /** Шок-волна от ядра по всей колонии. */
  triggerWave(strength = 1): void {
    this.waves.push({ t0: performance.now(), strength })
  }

  /** // maturity — зрелость организма от поколения (виньетка, планктон) */
  setStats(gen: number): void {
    const g = Math.max(1, gen | 0)
    if (g === this.gen) return
    this.gen = g
    this.syncPlankton()
    this.buildVignette()
  }

  setReducedMotion(v: boolean): void {
    this.reduced = v
  }

  setGraftMode(v: boolean): void {
    this.graftMode = v
    if (v) this.emitHover(null)
  }

  pointerMove(x: number, y: number): void {
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.inside = true
    if (this.graftMode) return
    const hit = this.hitTest(x, y)
    if (hit) {
      if (this.hoverId !== hit.id) {
        this.hoverId = hit.id
        this.emitHover(hit)
      }
      this.cb.onHoverMove(x, y)
    } else if (this.hoverId !== null) {
      this.hoverId = null
      this.emitHover(null)
    }
  }

  pointerLeave(): void {
    this.pointer.inside = false
    if (this.hoverId !== null) {
      this.hoverId = null
      this.emitHover(null)
    }
  }

  /** Ближайшая ветвь к точке (для тултипа). */
  hitTest(x: number, y: number): Mutation | null {
    const now = performance.now()
    const thr = 30 * 30
    let best: Mutation | null = null
    let bestD = thr
    for (const st of this.branches.values()) {
      if (st.growStart !== null && now - st.growStart < 350) continue
      for (const p of st.branch.hits) {
        const sx = this.cx + p.x * this.R
        const sy = this.cy + p.y * this.R
        const dx = sx - x
        const dy = sy - y
        const d = dx * dx + dy * dy
        if (d < bestD) {
          bestD = d
          best = st.mutation
        }
      }
    }
    return best
  }

  /** Перевод точки экрана в «ген» прививки (угол/дистанция/потенция). */
  pointToGene(x: number, y: number): Gene | null {
    const dx = x - this.cx
    const dy = y - this.cy
    const d = Math.hypot(dx, dy) / this.R
    if (d > 1.15) return null
    const angle = (Math.atan2(dy, dx) + TAU) % TAU
    const distance = clamp(d, 0.05, 1)
    // ближе к ядру — глубже ветвление (сильнее потенция)
    const potency = clamp(1.25 - 0.95 * distance, 0.15, 1)
    return { angle, distance, potency }
  }

  destroy(): void {
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.ro = null
    this.waves.length = 0
    this.branches.clear()
  }

  /* ------------------------------- внутреннее ------------------------------- */

  private emitHover(m: Mutation | null): void {
    this.cb.onHoverChange(m ? { mutation: m } : null)
  }

  private rebuildBeads(): void {
    const list: GBranch[] = []
    for (const st of this.branches.values()) list.push(st.branch)
    this.beads = buildBeads(this.pulseList, list)
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width))
    const h = Math.max(1, Math.round(rect.height))
    if (w === this.w && h === this.h) return
    this.w = w
    this.h = h
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.canvas.width = Math.round(w * this.dpr)
    this.canvas.height = Math.round(h * this.dpr)

    this.cx = w / 2
    this.cy = h * 0.68
    this.R = clamp(Math.min(w * 0.5, h * 0.42), 110, 560)

    this.buildBackground()
    this.buildVignette()
    this.syncPlankton()
  }

  private buildBackground(): void {
    const c = document.createElement('canvas')
    c.width = this.w
    c.height = this.h
    const g = c.getContext('2d')
    if (!g) return
    const grd = g.createRadialGradient(
      this.cx,
      this.cy,
      0,
      this.cx,
      this.cy,
      Math.hypot(this.w, this.h) * 0.72,
    )
    grd.addColorStop(0, '#123c26')
    grd.addColorStop(0.32, '#0c2b1a')
    grd.addColorStop(0.66, '#071b10')
    grd.addColorStop(1, '#05130c')
    g.fillStyle = grd
    g.fillRect(0, 0, this.w, this.h)
    this.bg = c
  }

  /** // maturity — глубина виньетки растёт с поколением */
  private buildVignette(): void {
    const c = document.createElement('canvas')
    c.width = this.w
    c.height = this.h
    const g = c.getContext('2d')
    if (!g) return
    const alpha = Math.min(0.86, 0.42 + this.gen * 0.05)
    const grd = g.createRadialGradient(
      this.cx,
      this.cy,
      this.R * 0.9,
      this.cx,
      this.cy,
      Math.hypot(this.w, this.h) * 0.62,
    )
    grd.addColorStop(0, 'rgba(2,8,5,0)')
    grd.addColorStop(1, `rgba(2,8,5,${alpha})`)
    g.fillStyle = grd
    g.fillRect(0, 0, this.w, this.h)
    this.vig = c
  }

  /** // maturity — плотность планктона растёт с поколением */
  private syncPlankton(): void {
    const target = Math.min(84, 26 + this.gen * 7)
    while (this.plankton.length < target) {
      this.plankton.push({
        x: Math.random(),
        y: Math.random(),
        spd: 0.006 + Math.random() * 0.016,
        size: 0.7 + Math.random() * 1.2,
        ph: Math.random() * TAU,
      })
    }
    if (this.plankton.length > target) this.plankton.length = target
  }

  private waveR(w: Wave, now: number): number {
    const dur = this.reduced ? WAVE_DURATION_RM : WAVE_DURATION
    return ((now - w.t0) / dur) * 1.75
  }

  private growProgress(st: BranchState, now: number): number {
    if (st.growStart === null) return 1
    if (now < st.growStart) return 0
    const p = (now - st.growStart) / st.growDur
    if (p >= 1) {
      st.growStart = null
      return 1
    }
    return 1 - Math.pow(1 - p, 3)
  }

  private frame = (now: number): void => {
    const dt = clamp((now - this.last) / 1000, 0, 0.05)
    this.last = now
    const t = (now - this.t0) / 1000

    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)

    if (this.bg) ctx.drawImage(this.bg, 0, 0)
    else {
      ctx.fillStyle = '#05130c'
      ctx.fillRect(0, 0, this.w, this.h)
    }

    this.drawPlankton(ctx, t, dt)
    this.drawCore(ctx, t)
    this.drawBranches(ctx, t, now)
    this.drawBeads(ctx, t)
    ctx.globalCompositeOperation = 'lighter'
    this.drawTerminals(ctx, t, now)
    this.drawWaves(ctx, now)
    ctx.globalCompositeOperation = 'source-over'
    if (this.vig) ctx.drawImage(this.vig, 0, 0)
    this.drawGraftCursor(ctx)

    this.raf = requestAnimationFrame(this.frame)
  }

  private drawPlankton(ctx: CanvasRenderingContext2D, t: number, dt: number): void {
    const slow = this.reduced ? 0.3 : 1
    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.plankton) {
      p.y -= p.spd * dt * slow
      if (p.y < -0.04) {
        p.y = 1.04
        p.x = Math.random()
      }
      const a = 0.05 + 0.09 * (0.5 + 0.5 * Math.sin(t * 0.6 + p.ph))
      ctx.fillStyle = `rgba(78,240,138,${a.toFixed(3)})`
      ctx.beginPath()
      ctx.arc(p.x * this.w, p.y * this.h, p.size, 0, TAU)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawCore(ctx: CanvasRenderingContext2D, t: number): void {
    const beat = this.reduced ? 0.45 : 1
    const s1 = this.R * (0.46 + 0.035 * Math.sin(t * 1.35) * beat)
    const s2 = this.R * (0.14 + 0.014 * Math.sin(t * 1.35 + 0.5) * beat)
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(this.coreSprite, this.cx - s1, this.cy - s1, s1 * 2, s1 * 2)
    ctx.drawImage(this.coreSprite, this.cx - s2, this.cy - s2, s2 * 2, s2 * 2)
    // мембрана ядра
    ctx.strokeStyle = 'rgba(232,179,77,0.16)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(this.cx, this.cy, this.R * 0.125, 0, TAU)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawBranches(ctx: CanvasRenderingContext2D, t: number, now: number): void {
    const R = this.R
    const cx = this.cx
    const cy = this.cy
    const swaySpeed = this.reduced ? 0.35 : 0.72
    const swayAmp = this.reduced ? 0.0035 : 0.016
    const wavePush = this.reduced ? 0.02 : 0.05
    const scale = R / 560
    const hasWaves = this.waves.length > 0

    // батчи: ключ — уровень + квантованная толщина
    const batches = new Map<string, Path2D>()
    const widths = new Map<string, number>()

    for (const st of this.branches.values()) {
      const grown = this.growProgress(st, now)
      if (grown <= 0.001) continue
      const b = st.branch
      for (const seg of b.segs) {
        // прорастание сегмента: окно [order-0.16, order]
        let p = (grown - (seg.order - 0.16)) / 0.16
        if (p <= 0) continue
        if (p > 1) p = 1

        // покачивание + толчок волной
        const sway =
          Math.sin(t * swaySpeed + seg.swayPh) * swayAmp * (0.4 + seg.level * 0.5)
        let wx = 0
        let wy = 0
        if (hasWaves) {
          for (const wv of this.waves) {
            const wr = this.waveR(wv, now)
            const d = Math.abs(wr - seg.dist)
            if (d < WAVE_BAND) {
              const k = 1 - d / WAVE_BAND
              const push = k * k * wv.strength * wavePush
              wx += seg.urx * push
              wy += seg.ury * push
            }
          }
        }
        const dx = (sway + wx) * R
        const dy = wy * R

        const wpx = Math.max(1, Math.round(seg.w * scale))
        const key = `${seg.level}:${wpx}`
        let path = batches.get(key)
        if (!path) {
          path = new Path2D()
          batches.set(key, path)
          widths.set(key, wpx)
        }

        const x0 = cx + seg.x0 * R + dx
        const y0 = cy + seg.y0 * R + dy
        if (p >= 1) {
          path.moveTo(x0, y0)
          path.quadraticCurveTo(
            cx + seg.cx * R + dx,
            cy + seg.cy * R + dy,
            cx + seg.x1 * R + dx,
            cy + seg.y1 * R + dy,
          )
        } else {
          // частичная квадратичная кривая (де Кастельжо)
          const cx2 = seg.x0 + (seg.cx - seg.x0) * p
          const cy2 = seg.y0 + (seg.cy - seg.y0) * p
          const om = 1 - p
          const ex = om * om * seg.x0 + 2 * om * p * seg.cx + p * p * seg.x1
          const ey = om * om * seg.y0 + 2 * om * p * seg.cy + p * p * seg.y1
          path.moveTo(x0, y0)
          path.quadraticCurveTo(cx + cx2 * R + dx, cy + cy2 * R + dy, cx + ex * R + dx, cy + ey * R + dy)
        }
      }
    }

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const [key, path] of batches) {
      const level = key.charCodeAt(0) - 48
      ctx.strokeStyle = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)]
      ctx.lineWidth = widths.get(key) ?? 1
      ctx.stroke(path)
      // светящаяся кромка у глубоких уровней
      if (level >= 2) {
        ctx.strokeStyle = 'rgba(78,240,138,0.14)'
        ctx.lineWidth = (widths.get(key) ?? 1) + 2.5
        ctx.stroke(path)
      }
    }
  }

  private drawTerminals(ctx: CanvasRenderingContext2D, t: number, now: number): void {
    const R = this.R
    const cx = this.cx
    const cy = this.cy
    // период терминальной пульс-волны ~3 c (медленнее при reduced motion)
    const period = this.reduced ? 7 : 3
    const dots = new Path2D()
    type GlowItem = { x: number; y: number; b: number; level: number }
    const glows: GlowItem[] = []

    for (const st of this.branches.values()) {
      const grown = this.growProgress(st, now)
      if (grown <= 0.001) continue
      for (const term of st.branch.terminals) {
        if (grown < term.order) continue
        const b = 0.5 + 0.5 * Math.sin((t / period) * TAU - term.dist * 3.4 + st.branch.phase)
        const x = cx + term.x * R
        const y = cy + term.y * R
        dots.moveTo(x + 1.1 + term.level * 0.22, y)
        dots.arc(x, y, 1.1 + term.level * 0.22, 0, TAU)
        if (term.level >= 2) glows.push({ x, y, b, level: term.level })
      }
    }

    // точки-терминали
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = 'rgba(140,255,180,0.8)'
    ctx.fill(dots)

    // глоу: только глубокие терминали и с капом числа спрайтов
    const stride = glows.length > GLOW_CAP ? Math.ceil(glows.length / GLOW_CAP) : 1
    const gs = R / 560
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < glows.length; i += stride) {
      const g = glows[i]
      const size = (13 + 30 * g.b) * gs
      ctx.globalAlpha = 0.08 + 0.36 * g.b
      ctx.drawImage(this.glowSprite, g.x - size / 2, g.y - size / 2, size, size)
    }
    ctx.globalAlpha = 1
  }

  private drawBeads(ctx: CanvasRenderingContext2D, t: number): void {
    if (this.beads.length === 0) return
    const R = this.R
    const cx = this.cx
    const cy = this.cy
    ctx.globalCompositeOperation = 'lighter'
    const max = Math.min(this.beads.length, 64)
    for (let i = 0; i < max; i++) {
      const bead = this.beads[i]
      const x = cx + bead.x * R
      const y = cy + bead.y * R
      const flick = 0.55 + 0.45 * Math.sin(t * 2 + (bead.seed % 13))
      const s = 9 * flick + 3
      ctx.globalAlpha = 0.16 + 0.2 * flick
      ctx.drawImage(this.beadSprite, x - s, y - s, s * 2, s * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = AMBER
      ctx.beginPath()
      ctx.arc(x, y, 1.9, 0, TAU)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawWaves(ctx: CanvasRenderingContext2D, now: number): void {
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i]
      const r = this.waveR(wv, now)
      if (r > 1.75) {
        this.waves.splice(i, 1)
        continue
      }
      const k = 1 - r / 1.75
      const alpha = Math.pow(k, 1.4) * 0.4 * wv.strength
      if (alpha <= 0.004) continue
      ctx.strokeStyle = `rgba(78,240,138,${alpha.toFixed(3)})`
      ctx.lineWidth = 1.2 + 2.6 * k
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, r * this.R, 0, TAU)
      ctx.stroke()
      // эхо-кольцо
      ctx.strokeStyle = `rgba(232,179,77,${(alpha * 0.35).toFixed(3)})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.arc(this.cx, this.cy, r * this.R * 0.86, 0, TAU)
      ctx.stroke()
    }
  }

  private drawGraftCursor(ctx: CanvasRenderingContext2D): void {
    if (!this.graftMode || !this.pointer.inside) return
    const { x, y } = this.pointer
    ctx.strokeStyle = 'rgba(78,240,138,0.95)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x - 10, y)
    ctx.lineTo(x - 4, y)
    ctx.moveTo(x + 4, y)
    ctx.lineTo(x + 10, y)
    ctx.moveTo(x, y - 10)
    ctx.lineTo(x, y - 4)
    ctx.moveTo(x, y + 4)
    ctx.lineTo(x, y + 10)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(78,240,138,0.4)'
    ctx.beginPath()
    ctx.arc(x, y, 13, 0, TAU)
    ctx.stroke()
    ctx.fillStyle = AMBER
    ctx.beginPath()
    ctx.arc(x, y, 1.6, 0, TAU)
    ctx.fill()
  }
}

/** Экспорт для HUD: глубина ветвления по потенции (для подписей). */
export { levelsForPotency, hash32 }
