/**
 * Оркестратор сцены: канвас на весь экран, RAF-цикл, DPR (кап 2),
 * переключение актов со «снаряжением» (унос старых глифов + fade),
 * зерно бумаги, ввод (драг/колесо/свайп/клавиши), QA-хук window.__textfield.
 * Полный teardown через destroy().
 */

import { ActFall } from './acts/act1'
import { ActCloth } from './acts/act2'
import { ActWind, type WindMode } from './acts/act3'
import { ActSandbox } from './acts/act4'
import type { Act, ActEnv } from './acts/act-utils'
import { GlyphAtlas } from './atlas'
import { ACT_COUNT, clamp, type PointerState } from './types'

export type ActCommand =
  | { type: 'restore' }
  | { type: 'mode'; mode: WindMode }
  | { type: 'wind'; on: boolean }
  | { type: 'antigravity'; on: boolean }
  | { type: 'shake' }
  | { type: 'reset' }
  | { type: 'release'; text: string }

export interface SceneCallbacks {
  onActChange(act: number): void
  onReady(): void
}

const TRANS_OUT = 0.3
const TRANS_IN = 0.34
const WHEEL_THRESHOLD = 130
const NAV_COOLDOWN = 950
const SWIPE_MIN = 70

interface Sample {
  x: number
  y: number
  t: number
}

interface Transition {
  from: Act
  to: number
  t: number
  switched: boolean
}

export class TextFieldScene {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private atlas: GlyphAtlas | null = null
  private acts: Act[] = []
  private actIndex = 0
  private transition: Transition | null = null
  private entryAlpha = 1
  private w = 0
  private h = 0
  private dpr = 1
  private raf = 0
  private lastNow = 0
  private destroyed = false
  private reducedMotion: boolean
  private cb: SceneCallbacks
  private ro: ResizeObserver | null = null

  private pointer: PointerState = {
    x: -9999,
    y: -9999,
    vx: 0,
    vy: 0,
    down: false,
    inside: false,
  }
  private samples: Sample[] = []
  private dragging = false
  private swipeStart: { x: number; y: number; t: number; touch: boolean } | null =
    null
  private wheelAccum = 0
  private lastWheelAt = 0
  private navCooldownUntil = 0

  private grainPattern: CanvasPattern | null = null
  private fpsEma = 60

  constructor(
    canvas: HTMLCanvasElement,
    reducedMotion: boolean,
    cb: SceneCallbacks,
  ) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D недоступен')
    this.ctx = ctx
    this.reducedMotion = reducedMotion
    this.cb = cb
    this.acts = [new ActFall(), new ActCloth(), new ActWind(), new ActSandbox()]
  }

  /** Асинхронная инициализация: шрифты → атлас → вёрстка акта → готово. */
  async init(): Promise<void> {
    const family = getComputedStyle(document.body).fontFamily || 'sans-serif'
    try {
      await document.fonts.ready
      await Promise.all([
        document.fonts.load(`800 100px ${family}`).catch(() => null),
        document.fonts.load(`700 100px ${family}`).catch(() => null),
        document.fonts.load(`500 100px ${family}`).catch(() => null),
      ])
    } catch {
      // шрифты могут быть уже готовы — продолжаем с тем, что есть
    }
    if (this.destroyed) return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.atlas = new GlyphAtlas(family, this.dpr)
    this.resize()
    this.entryAlpha = this.reducedMotion ? 1 : 0
    this.attachListeners()
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.canvas)
    this.cb.onReady()
  }

  start(): void {
    if (this.destroyed || this.raf) return
    this.lastNow = performance.now()
    this.raf = requestAnimationFrame(this.loop)
  }

  stop(): void {
    if (this.raf) {
      cancelAnimationFrame(this.raf)
      this.raf = 0
    }
  }

  destroy(): void {
    this.destroyed = true
    this.stop()
    this.detachListeners()
    this.ro?.disconnect()
    this.ro = null
    this.acts.length = 0
    if (typeof window !== 'undefined') {
      delete (window as unknown as Record<string, unknown>).__textfield
    }
  }

  // ——— размеры ———

  resize(): void {
    if (this.destroyed || !this.atlas) return
    const w = this.canvas.clientWidth || window.innerWidth
    const h = this.canvas.clientHeight || window.innerHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = w
    this.h = h
    if (dpr !== this.dpr) {
      this.dpr = dpr
      this.atlas.setDpr(dpr)
    }
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.buildGrain()
    // переход, если был, завершаем мгновенно и пересобираем текущий акт
    this.transition = null
    this.entryAlpha = 1
    this.buildAct(this.actIndex)
  }

  private get env(): ActEnv {
    if (!this.atlas) throw new Error('Сцена не инициализирована')
    return {
      w: this.w,
      h: this.h,
      atlas: this.atlas,
      reducedMotion: this.reducedMotion,
      gravity: 2000 * clamp(this.h / 900, 0.7, 1.5),
    }
  }

  private buildAct(i: number): void {
    const act = this.acts[i]
    if (!act) return
    act.build(this.env)
  }

  // ——— навигация ———

  goto(index: number): void {
    if (this.destroyed) return
    const i = Math.max(0, Math.min(ACT_COUNT - 1, index))
    if (i === this.actIndex || this.transition) return
    const from = this.acts[this.actIndex]
    const to = this.acts[i]
    if (!from || !to) return
    from.fling()
    this.transition = { from, to: i, t: 0, switched: false }
    this.actIndex = i
    this.dragging = false
    this.swipeStart = null
    this.setDragCursor(false)
    if (this.reducedMotion) {
      // без полёта: мгновенная пересборка и короткий кроссфейд
      this.transition.t = TRANS_OUT
      this.transition.switched = true
      this.buildAct(i)
    }
    this.cb.onActChange(i)
  }

  get currentActIndex(): number {
    return this.actIndex
  }

  command(cmd: ActCommand): void {
    if (this.destroyed) return
    const act = this.acts[this.actIndex]
    if (!act) return
    switch (cmd.type) {
      case 'restore':
        if (act instanceof ActCloth) act.restore()
        break
      case 'mode':
        if (act instanceof ActWind) act.setMode(cmd.mode)
        break
      case 'wind':
        if (act instanceof ActSandbox) act.setWind(cmd.on)
        break
      case 'antigravity':
        if (act instanceof ActSandbox) act.setAntigravity(cmd.on)
        break
      case 'shake':
        if (act instanceof ActSandbox) act.shake()
        break
      case 'reset':
        if (act instanceof ActSandbox) act.reset()
        break
      case 'release':
        if (act instanceof ActSandbox) act.releaseText(cmd.text)
        break
    }
  }

  // ——— цикл ———

  private loop = (now: number): void => {
    if (this.destroyed) return
    this.raf = requestAnimationFrame(this.loop)
    const dt = clamp((now - this.lastNow) / 1000, 0.0001, 0.05)
    this.lastNow = now
    this.fpsEma = this.fpsEma * 0.94 + (1 / dt) * 0.06

    this.updatePointerVelocity(now)
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.w, this.h)
    ctx.fillStyle = '#f4f1ea'
    ctx.fillRect(0, 0, this.w, this.h)

    const tr = this.transition
    if (tr) {
      tr.t += dt
      if (tr.t < TRANS_OUT) {
        tr.from.update(dt, now, this.pointer)
        this.renderAct(tr.from, 1 - tr.t / TRANS_OUT)
      } else {
        if (!tr.switched) {
          tr.switched = true
          this.buildAct(tr.to)
        }
        const target = this.acts[tr.to]
        target.update(dt, now, this.pointer)
        this.renderAct(target, clamp((tr.t - TRANS_OUT) / TRANS_IN, 0, 1))
        if (tr.t >= TRANS_OUT + TRANS_IN) this.transition = null
      }
    } else {
      const act = this.acts[this.actIndex]
      if (this.entryAlpha < 1) {
        this.entryAlpha = Math.min(1, this.entryAlpha + dt / 0.35)
      }
      act.update(dt, now, this.pointer)
      this.renderAct(act, this.entryAlpha)
    }

    // зерно бумаги поверх всего
    if (this.grainPattern) {
      ctx.fillStyle = this.grainPattern
      ctx.fillRect(0, 0, this.w, this.h)
    }
  }

  private renderAct(act: Act, alpha: number): void {
    if (alpha <= 0.004) return
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = clamp(alpha, 0, 1)
    act.render(ctx)
    ctx.restore()
  }

  // ——— ввод ———

  private updatePointerVelocity(now: number): void {
    const s = this.samples
    while (s.length && now - s[0].t > 140) s.shift()
    if (s.length >= 2) {
      const a = s[0]
      const b = s[s.length - 1]
      const dt = (b.t - a.t) / 1000
      if (dt > 0.016) {
        this.pointer.vx = clamp((b.x - a.x) / dt, -4000, 4000)
        this.pointer.vy = clamp((b.y - a.y) / dt, -4000, 4000)
      }
    } else {
      this.pointer.vx *= 0.8
      this.pointer.vy *= 0.8
    }
  }

  private pushSample(x: number, y: number, t: number): void {
    this.samples.push({ x, y, t })
    if (this.samples.length > 8) this.samples.shift()
  }

  private currentAct(): Act | null {
    const tr = this.transition
    if (tr) {
      return tr.t < TRANS_OUT ? tr.from : this.acts[tr.to] ?? null
    }
    return this.acts[this.actIndex] ?? null
  }

  private setDragCursor(on: boolean): void {
    this.canvas.style.cursor = on ? 'grabbing' : ''
  }

  private onPointerDown = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.down = true
    this.pointer.inside = true
    this.pushSample(x, y, e.timeStamp)
    const act = this.currentAct()
    let grabbed = false
    if (act) grabbed = act.pointerDown(x, y)
    if (grabbed) {
      this.dragging = true
      this.setDragCursor(true)
      this.swipeStart = null
    } else {
      this.swipeStart = {
        x,
        y,
        t: e.timeStamp,
        touch: e.pointerType !== 'mouse',
      }
    }
    try {
      this.canvas.setPointerCapture(e.pointerId)
    } catch {
      // некоторые браузеры бросают при потере указателя
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this.pointer.x = x
    this.pointer.y = y
    this.pointer.inside = true
    this.pushSample(x, y, e.timeStamp)
  }

  private onPointerUp = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    this.pointer.down = false
    this.pushSample(x, y, e.timeStamp)
    const vel = { x: this.pointer.vx, y: this.pointer.vy }
    if (this.dragging) {
      const act = this.currentAct()
      act?.pointerUp(vel)
      this.dragging = false
      this.setDragCursor(false)
    } else if (this.swipeStart) {
      const sw = this.swipeStart
      this.swipeStart = null
      if (sw.touch) {
        const dy = y - sw.y
        const dt = (e.timeStamp - sw.t) / 1000
        if (Math.abs(dy) > SWIPE_MIN && dt > 0.02 && dt < 0.6) {
          this.goto(this.actIndex + (dy < 0 ? 1 : -1))
        }
      }
    }
  }

  private onPointerLeave = (): void => {
    this.pointer.inside = false
    this.pointer.vx = 0
    this.pointer.vy = 0
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    const now = performance.now()
    if (now - this.lastWheelAt > 260) this.wheelAccum = 0
    this.lastWheelAt = now
    this.wheelAccum += e.deltaY
    if (
      Math.abs(this.wheelAccum) > WHEEL_THRESHOLD &&
      now > this.navCooldownUntil
    ) {
      this.goto(this.actIndex + (this.wheelAccum > 0 ? 1 : -1))
      this.navCooldownUntil = now + NAV_COOLDOWN
      this.wheelAccum = 0
    }
  }

  private onKey = (e: KeyboardEvent): void => {
    const target = e.target
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      this.goto(this.actIndex + 1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      this.goto(this.actIndex - 1)
    } else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') {
      this.goto(Number(e.key) - 1)
    }
  }

  private attachListeners(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointercancel', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onPointerLeave)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    window.addEventListener('keydown', this.onKey)
    this.installQaHook()
  }

  private detachListeners(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave)
    this.canvas.removeEventListener('wheel', this.onWheel)
    window.removeEventListener('keydown', this.onKey)
  }

  // ——— фактура ———

  private buildGrain(): void {
    const g = document.createElement('canvas')
    g.width = 256
    g.height = 256
    const gctx = g.getContext('2d')
    if (!gctx) return
    const img = gctx.createImageData(256, 256)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 23
      d[i + 1] = 20
      d[i + 2] = 15
      d[i + 3] = Math.random() < 0.5 ? 0 : Math.floor(Math.random() * 15)
    }
    gctx.putImageData(img, 0, 0)
    this.grainPattern = this.ctx.createPattern(g, 'repeat')
  }

  // ——— QA ———

  private installQaHook(): void {
    const api = {
      act: () => this.actIndex,
      goto: (i: number) => this.goto(i),
      fps: () => Math.round(this.fpsEma),
      glyphs: () => this.acts.map((a) => a.glyphCount()),
      settled: () => this.acts[this.actIndex]?.settled() ?? false,
    }
    ;(window as unknown as Record<string, unknown>).__textfield = api
  }
}
