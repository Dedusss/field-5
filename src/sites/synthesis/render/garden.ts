import { HORIZON, SEED_MAP } from '../meta'
import type { Bands, PlantData, SeedType } from '../types'
import { clamp, easeOutCubic, mulberry32, rgba } from '../util'
import { buildPlantSkeleton, type Branch, type PlantSkeleton } from './plantShape'

const TAU = Math.PI * 2
const SPORE_COUNT = 60

export interface PlantRuntime {
  data: PlantData
  skeleton: PlantSkeleton
  /** performance.now() посадки — рост 0→1 за 2 c */
  createdAt: number
  /** пульс от события ноты, затухает */
  pulse: number
  /** сглаженная полоса FFT своего типа */
  band: number
}

interface Spore {
  x: number
  y: number
  r: number
  vy: number
  phase: number
  flash: number
  mag: number
}

interface GrassBlade {
  x: number
  y: number
  len: number
  lean: number
  phase: number
  alpha: number
}

function bandFor(type: SeedType, b: Bands): number {
  if (type === 'drone') return b.bass
  if (type === 'pluck') return b.lowMid
  if (type === 'choir') return b.mid
  return b.high
}

/**
 * Слой 2 — Canvas 2D поверх WebGL-фона: растения, споры, почва.
 * Рендерится из общего хранилища растений (мутабельный массив).
 */
export class GardenRenderer {
  readonly plants: PlantRuntime[] = []
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D | null
  private w = 1
  private h = 1
  private time = 0
  private grass: GrassBlade[] = []
  private spores: Spore[] = []

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
  }

  resize(w: number, h: number, dpr: number) {
    this.w = Math.max(1, w)
    this.h = Math.max(1, h)
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    if (this.ctx) this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.regrowGrass()
    this.rebuildSkeletons()
    this.resetSpores()
  }

  private unit(): number {
    return clamp(Math.min(this.w, this.h) * 0.24, 80, 220)
  }

  private regrowGrass() {
    const rng = mulberry32(20260213)
    const count = clamp(Math.round(this.w / 26), 18, 64)
    const soilTop = this.h * HORIZON
    const soilH = this.h * (0.965 - HORIZON)
    this.grass = []
    for (let i = 0; i < count; i++) {
      const t = rng()
      this.grass.push({
        x: rng() * this.w,
        y: soilTop + 3 + t * t * soilH,
        len: 5 + rng() * 11,
        lean: (rng() * 2 - 1) * 0.55,
        phase: rng() * TAU,
        alpha: 0.08 + rng() * 0.2,
      })
    }
  }

  private resetSpores() {
    const rng = mulberry32(777333)
    this.spores = []
    for (let i = 0; i < SPORE_COUNT; i++) {
      this.spores.push({
        x: rng() * this.w,
        y: rng() * this.h,
        r: 0.7 + rng() * 1.4,
        vy: 6 + rng() * 13,
        phase: rng() * TAU,
        flash: 0,
        mag: rng(),
      })
    }
  }

  private rebuildSkeletons() {
    const unit = this.unit()
    for (const p of this.plants) {
      p.skeleton = buildPlantSkeleton(p.data.seed, p.data.type, unit)
    }
  }

  plant(data: PlantData): PlantRuntime {
    const runtime: PlantRuntime = {
      data,
      skeleton: buildPlantSkeleton(data.seed, data.type, this.unit()),
      createdAt: performance.now(),
      pulse: 0,
      band: 0,
    }
    this.plants.push(runtime)
    return runtime
  }

  removePlant(id: number) {
    const i = this.plants.findIndex((p) => p.data.id === id)
    if (i >= 0) this.plants.splice(i, 1)
  }

  hitTest(px: number, py: number): PlantRuntime | null {
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i]
      const x = p.data.nx * this.w
      const y = p.data.ny * this.h
      const halfW = p.skeleton.width / 2 + 16
      if (px >= x - halfW && px <= x + halfW && py >= y - p.skeleton.height - 14 && py <= y + 18) {
        return p
      }
    }
    return null
  }

  /** Событие ноты из планировщика: пульс кончиков + вспышка спор рядом. */
  triggerNote(plantId: number, velocity: number, ghost: boolean) {
    const p = this.plants.find((q) => q.data.id === plantId)
    if (!p) return
    const v = ghost ? velocity * 0.55 : velocity
    p.pulse = Math.min(1.6, Math.max(p.pulse, v))
    const cx = p.data.nx * this.w
    const cy = p.data.ny * this.h - p.skeleton.height * 0.6
    for (const s of this.spores) {
      const d = Math.hypot(s.x - cx, s.y - cy)
      if (d < 110) s.flash = Math.max(s.flash, (1 - d / 110) * v * 0.95)
    }
  }

  render(dt: number, now: number, bands: Bands, weather: number, reduced: boolean) {
    const ctx = this.ctx
    if (!ctx) return
    this.time += dt * (reduced ? 0.6 : 1)
    const horizonY = this.h * HORIZON
    const wind = (0.45 + weather * 1.7 + bands.bass * 0.4) * (reduced ? 0.4 : 1)
    ctx.clearRect(0, 0, this.w, this.h)
    this.drawSoil(ctx, horizonY, bands, wind)
    for (const p of this.plants) {
      this.drawPlant(ctx, p, now, dt, bands, wind)
    }
    this.drawSpores(ctx, dt, bands, wind, reduced)
  }

  private drawSoil(ctx: CanvasRenderingContext2D, y: number, bands: Bands, wind: number) {
    // линия горизонта
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(this.w, y)
    ctx.strokeStyle = 'rgba(246,238,248,0.20)'
    ctx.lineWidth = 1
    ctx.stroke()
    // маджента-подсветка под линией, дышит от баса
    ctx.beginPath()
    ctx.moveTo(0, y + 1.5)
    ctx.lineTo(this.w, y + 1.5)
    ctx.strokeStyle = rgba([232, 79, 208], 0.08 + bands.bass * 0.16)
    ctx.lineWidth = 2
    ctx.stroke()
    // пепел-травинки с волной от баса
    for (const b of this.grass) {
      const sway = Math.sin(this.time * 1.3 + b.phase) * (0.05 + wind * 0.06)
      const wave = Math.sin(b.x * 0.02 - this.time * 2.1) * bands.bass * 6
      const tipX = b.x + Math.sin(b.lean + sway) * b.len
      const tipY = b.y - Math.cos(b.lean + sway) * b.len + wave
      ctx.beginPath()
      ctx.moveTo(b.x, b.y)
      ctx.quadraticCurveTo(b.x + (tipX - b.x) * 0.3, b.y - b.len * 0.6, tipX, tipY)
      ctx.strokeStyle = rgba([198, 178, 212], b.alpha)
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  private drawPlant(
    ctx: CanvasRenderingContext2D,
    p: PlantRuntime,
    now: number,
    dt: number,
    bands: Bands,
    wind: number,
  ) {
    const d = p.data
    const g = clamp((now - p.createdAt) / 2000, 0, 1)
    p.band += (bandFor(d.type, bands) - p.band) * 0.18
    p.pulse *= Math.exp(-dt * 3.3)
    const meta = SEED_MAP[d.type]
    const mutedK = d.muted ? 0.3 : 1
    const x = d.nx * this.w
    const y = d.ny * this.h

    // свечение почвы под растением
    const glowR = 26 + p.skeleton.height * 0.3
    const grad = ctx.createRadialGradient(x, y, 0, x, y, glowR)
    grad.addColorStop(0, rgba(meta.rgb, 0.1 * mutedK))
    grad.addColorStop(1, rgba(meta.rgb, 0))
    ctx.fillStyle = grad
    ctx.fillRect(x - glowR, y - 26, glowR * 2, 52)

    // стебли
    const stemAlpha = (0.5 + 0.45 * g) * (d.muted ? 0.6 : 1)
    ctx.strokeStyle = d.muted ? rgba([124, 106, 132], stemAlpha) : rgba([64, 26, 66], stemAlpha)
    ctx.lineCap = 'round'
    const tips: { x: number; y: number; phase: number; size: number }[] = []
    const maxDepth = p.skeleton.maxDepth
    const drawBranch = (b: Branch, px: number, py: number, parentA: number) => {
      const bg = clamp(g * (maxDepth + 1.4) - b.depth, 0, 1)
      if (bg <= 0) return
      const e = easeOutCubic(bg)
      const sway =
        Math.sin(this.time * (0.7 + b.depth * 0.21) + b.phase) * wind * 0.06 * (0.35 + b.depth * 0.3) * b.flex
      const a = parentA + b.angle + sway
      const len = b.len * e
      const ex = px + Math.cos(a) * len
      const ey = py + Math.sin(a) * len
      const mx = (px + ex) / 2 - Math.sin(a) * b.curve * len * 0.55
      const my = (py + ey) / 2 + Math.cos(a) * b.curve * len * 0.55
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.quadraticCurveTo(mx, my, ex, ey)
      ctx.lineWidth = Math.max(0.6, b.weight * (0.45 + 0.55 * e))
      ctx.stroke()
      if (b.children.length === 0 && bg > 0.55) {
        tips.push({ x: ex, y: ey, phase: b.phase, size: b.tipSize })
      }
      for (const c of b.children) drawBranch(c, ex, ey, a)
    }
    drawBranch(p.skeleton.root, x, y, -Math.PI / 2)

    // биолюминесцентные кончики
    ctx.globalCompositeOperation = 'lighter'
    for (const tip of tips) {
      const tw = 0.72 + 0.28 * Math.sin(this.time * 2.2 + tip.phase * 6)
      const energy = (0.32 + p.band * 0.9 + p.pulse * 2) * mutedK * tw
      const rr = (1.5 + p.pulse * 3.2 + p.band * 1.1) * tip.size * tw
      ctx.fillStyle = rgba(meta.rgb, energy * 0.14)
      ctx.beginPath()
      ctx.arc(tip.x, tip.y, rr * 3.4, 0, TAU)
      ctx.fill()
      ctx.fillStyle = rgba(meta.rgb, energy * 0.6)
      ctx.beginPath()
      ctx.arc(tip.x, tip.y, rr, 0, TAU)
      ctx.fill()
      if (p.pulse > 0.35) {
        ctx.fillStyle = rgba([255, 246, 255], (p.pulse - 0.3) * 0.8)
        ctx.beginPath()
        ctx.arc(tip.x, tip.y, rr * 0.5, 0, TAU)
        ctx.fill()
      }
    }
    ctx.globalCompositeOperation = 'source-over'
  }

  private drawSpores(ctx: CanvasRenderingContext2D, dt: number, bands: Bands, wind: number, reduced: boolean) {
    ctx.globalCompositeOperation = 'lighter'
    const k = reduced ? 0.8 : 1
    for (const s of this.spores) {
      s.y -= s.vy * dt
      s.x += Math.sin(this.time * 0.6 + s.phase) * (5 + wind * 10) * dt
      s.flash *= Math.exp(-dt * 2.6)
      if (s.y < -8) {
        s.y = this.h + 8
        s.x = Math.random() * this.w
      }
      if (s.x < -8) s.x = this.w + 8
      else if (s.x > this.w + 8) s.x = -8
      const a = (0.08 + bands.high * 0.42 + s.flash * 0.85) * k
      const rgb: [number, number, number] = [
        Math.round(198 + (232 - 198) * s.mag),
        Math.round(178 + (79 - 178) * s.mag),
        Math.round(212 + (208 - 212) * s.mag),
      ]
      ctx.fillStyle = rgba(rgb, a)
      ctx.beginPath()
      ctx.arc(s.x, s.y, s.r * (1 + s.flash * 1.3), 0, TAU)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
