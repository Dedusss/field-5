/**
 * Глиф-атлас: каждая литера (char, size, weight, color) растеризуется один раз
 * в оффскрин-канвас (с учётом DPR) и дальше рисуется одним drawImage.
 * Здесь же — метрики реального шрифта (measureText + actualBoundingBox*),
 * из которых физический движок берёт габариты и массу тел.
 */

export interface GlyphMetrics {
  /** ширина очерка глифа (без боковых полей), px */
  inkW: number
  /** высота очерка глифа, px */
  inkH: number
  /** расстояние от базовой линии до верха очерка */
  ascent: number
  /** ширина площадки глифа (advance), px */
  advance: number
}

interface AtlasEntry {
  canvas: HTMLCanvasElement
  w: number
  h: number
}

const PROBE_FONT_SIZE = 100

export class GlyphAtlas {
  private entries = new Map<string, AtlasEntry>()
  private metrics = new Map<string, GlyphMetrics>()
  private probe: CanvasRenderingContext2D
  readonly family: string
  private dpr: number

  constructor(family: string, dpr: number) {
    this.family = family
    this.dpr = dpr
    const c = document.createElement('canvas')
    c.width = 8
    c.height = 8
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D недоступен')
    this.probe = ctx
  }

  setDpr(dpr: number): void {
    if (Math.abs(dpr - this.dpr) < 1e-6) return
    this.dpr = dpr
    this.entries.clear()
  }

  private fontStr(weight: number, size: number): string {
    return `${weight} ${Math.round(size * 100) / 100}px ${this.family}`
  }

  /** Метрики глифа в логических px. Кэшируются по (char, size, weight). */
  measure(char: string, size: number, weight: number): GlyphMetrics {
    const key = `${char}|${size.toFixed(1)}|${weight}`
    const cached = this.metrics.get(key)
    if (cached) return cached
    this.probe.font = this.fontStr(weight, size)
    this.probe.textAlign = 'left'
    this.probe.textBaseline = 'alphabetic'
    const m = this.probe.measureText(char)
    const left = m.actualBoundingBoxLeft > 0 ? m.actualBoundingBoxLeft : 0
    const right =
      m.actualBoundingBoxRight > 0 ? m.actualBoundingBoxRight : m.width
    const ascent =
      m.actualBoundingBoxAscent > 0 ? m.actualBoundingBoxAscent : size * 0.73
    const descent =
      m.actualBoundingBoxDescent > 0 ? m.actualBoundingBoxDescent : size * 0.02
    const met: GlyphMetrics = {
      inkW: left + right,
      inkH: ascent + descent,
      ascent,
      advance: m.width,
    }
    this.metrics.set(key, met)
    return met
  }

  /** Полная ширина строки (advance), полезно для вёрстки. */
  measureTextWidth(text: string, size: number, weight: number): number {
    this.probe.font = this.fontStr(weight, size)
    this.probe.textAlign = 'left'
    this.probe.textBaseline = 'alphabetic'
    return this.probe.measureText(text).width
  }

  /** Базовая высота заглавных для строки — усреднённая ascent по выборке. */
  lineAscent(size: number, weight: number): number {
    return this.measure('АБВ', size, weight).ascent
  }

  private build(char: string, size: number, weight: number, color: string): AtlasEntry {
    const met = this.measure(char, size, weight)
    const pad = Math.max(2, Math.ceil(size * 0.08))
    const w = Math.max(2, Math.ceil(met.inkW) + pad * 2)
    const h = Math.max(2, Math.ceil(met.inkH) + pad * 2)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(w * this.dpr)
    canvas.height = Math.ceil(h * this.dpr)
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(this.dpr, this.dpr)
      ctx.font = this.fontStr(weight, size)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = color
      ctx.fillText(char, pad, pad + met.ascent)
    }
    const entry: AtlasEntry = { canvas, w, h }
    this.entries.set(`${char}|${size.toFixed(1)}|${weight}|${color}`, entry)
    return entry
  }

  /** Нарисовать глиф с центром в (cx, cy). angle — наклон в радианах. */
  draw(
    ctx: CanvasRenderingContext2D,
    char: string,
    size: number,
    weight: number,
    color: string,
    cx: number,
    cy: number,
    angle = 0,
  ): void {
    const key = `${char}|${size.toFixed(1)}|${weight}|${color}`
    let entry = this.entries.get(key)
    if (!entry) entry = this.build(char, size, weight, color)
    if (angle === 0) {
      ctx.drawImage(
        entry.canvas,
        Math.round(cx - entry.w / 2),
        Math.round(cy - entry.h / 2),
        entry.w,
        entry.h,
      )
      return
    }
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.drawImage(
      entry.canvas,
      -entry.w / 2,
      -entry.h / 2,
      entry.w,
      entry.h,
    )
    ctx.restore()
  }

  /** Прогреть атлас: заранее растеризовать глифы строки. */
  warm(text: string, size: number, weight: number, colors: string[]): void {
    for (const ch of text) {
      if (ch === ' ') continue
      for (const color of colors) this.build(ch, size, weight, color)
    }
  }

  get probeFontSize(): number {
    return PROBE_FONT_SIZE
  }
}
