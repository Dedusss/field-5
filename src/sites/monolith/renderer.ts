/**
 * ЭКСП. 01 «МОНОЛИТ» — рендерер: WebGL2, raymarching-сцена из shaders.ts.
 *
 * Владеет канвасом (сам создаёт и сам убирает), циклом кадров, вводом,
 * камерой, логикой сигилов/восхождения и динамическим разрешением (0.5–1.0
 * по EMA времени кадра, DPR-кап 2).
 */

import { FRAG_SRC, VERT_SRC } from './shaders'
import { SIGIL_X, SIGIL_Y, sigilSide, sigilZ } from './world'

export interface FrameStats {
  depth: number
  fps: number
  ascendProg: number
}

export interface RendererCallbacks {
  onFrame?: (s: FrameStats) => void
  onCapture?: (count: number) => void
  onFirstInput?: () => void
  onAscendStart?: () => void
  onAscendDone?: (depthMeters: number, seconds: number) => void
}

type Phase = 'walk' | 'ascend' | 'summit' | 'endless'

interface SigilState {
  idx: number
  z: number
  captured: boolean
}

const CAPTURE_RANGE = 6
const ASCEND_DURATION = 3.4
const BASE_Y = 1.7
const SUMMIT_Y = 9.2
const SIGIL_SLOTS = 6

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v
}
function lerp(a: number, b: number, k: number): number {
  return a + (b - a) * k
}

export class MonolithRenderer {
  private host: HTMLElement
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private lose: WEBGL_lose_context | null = null
  private u: Record<string, WebGLUniformLocation | null> = {}
  private cb: RendererCallbacks
  private reduced: boolean
  private ro: ResizeObserver | null = null
  private raf = 0
  private disposed = false

  // камера и мир
  private t = 0
  private lastNow = 0
  private camZ = 0
  private camY = BASE_Y
  private targetZ = -1.6 // лёгкий кинематографический дрейф на входе
  private lookX = 0
  private lookY = 0.02
  private lookTX = 0
  private lookTY = 0.02
  private pitchExtra = 0
  private bobPhase = 0
  private sway = 0
  private bobY = 0
  private speed = 0
  private light = { x: 0.9, y: 2.35, z: -7.2 }
  private lightTX = 0.9
  private lightTY = 2.35
  private flare = 0.7
  private fogDens = 1

  // квест
  private phase: Phase = 'walk'
  private sigils: SigilState[] = []
  private captured = 0
  private shift = 0
  private ascend = 0
  private ascendT0 = 0
  private endlessOn = false
  private startT = 0
  private inputEnabled = true
  private firstInputFired = false

  // ввод
  private keys = { fwd: false, back: false }
  private dragId = -1
  private dragX = 0
  private dragY = 0

  // производительность
  private scale = 1
  private emaDt = 16.7
  private lastAdjust = 0
  private frames = 0
  private fpsWindow = 0
  private fps = 60
  private stepsBudget = 112
  private slowStreak = 0

  private sigNearArr = new Float32Array(SIGIL_SLOTS * 4)

  constructor(host: HTMLElement, reduced: boolean, cb: RendererCallbacks) {
    this.host = host
    this.reduced = reduced
    this.cb = cb

    const canvas = document.createElement('canvas')
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:crosshair;'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)
    this.canvas = canvas

    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    if (!gl) {
      canvas.remove()
      throw new Error('WebGL2 недоступен: браузер не отдал контекст')
    }
    this.gl = gl
    this.lose = gl.getExtension('WEBGL_lose_context')

    this.initProgram()
    this.initSigils()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(host)
    window.addEventListener('resize', this.onWinResize)
    canvas.addEventListener('webglcontextlost', this.onContextLost)
    canvas.addEventListener('wheel', this.onWheel, { passive: false })
    canvas.addEventListener('pointerdown', this.onPointerDown)
    canvas.addEventListener('pointermove', this.onPointerMove)
    canvas.addEventListener('pointerup', this.onPointerUp)
    canvas.addEventListener('pointercancel', this.onPointerUp)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.resize()
    this.lastNow = performance.now()
    this.startT = this.t
    this.raf = requestAnimationFrame(this.frame)
  }

  // -------------------------------------------------------------- публичное
  beginEndless(): void {
    this.phase = 'endless'
    this.endlessOn = true
    this.inputEnabled = true
  }

  setInputEnabled(v: boolean): void {
    this.inputEnabled = v
    if (!v) {
      this.keys.fwd = false
      this.keys.back = false
      this.dragId = -1
    }
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.ro?.disconnect()
    this.ro = null
    window.removeEventListener('resize', this.onWinResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('pointercancel', this.onPointerUp)
    if (this.program) {
      this.gl.deleteProgram(this.program)
      this.program = null
    }
    if (this.vao) {
      this.gl.deleteVertexArray(this.vao)
      this.vao = null
    }
    this.lose?.loseContext()
    this.lose = null
    this.canvas.remove()
    this.u = {}
  }

  // -------------------------------------------------------------- GL-инициализация
  private initProgram(): void {
    const gl = this.gl
    const vs = this.compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = this.compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    const prog = gl.createProgram()
    if (!prog) throw new Error('Не удалось создать программу WebGL2')
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(prog) ?? 'без деталей'
      gl.deleteProgram(prog)
      throw new Error('Линковка шейдера: ' + log)
    }
    this.program = prog
    this.vao = gl.createVertexArray()
    for (const name of [
      'uRes',
      'uTime',
      'uCam',
      'uLook',
      'uLight',
      'uLightI',
      'uShift',
      'uAscend',
      'uFogDens',
      'uEndless',
      'uSteps',
      'uSigNear[0]',
    ]) {
      this.u[name] = gl.getUniformLocation(prog, name)
    }
  }

  private compile(type: number, src: string): WebGLShader {
    const gl = this.gl
    const sh = gl.createShader(type)
    if (!sh) throw new Error('Не удалось создать шейдер')
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? 'без деталей'
      gl.deleteShader(sh)
      throw new Error('Компиляция шейдера: ' + log)
    }
    return sh
  }

  private initSigils(): void {
    for (let i = 0; i < 5; i++) this.sigils.push({ idx: i, z: sigilZ(i), captured: false })
  }

  // -------------------------------------------------------------- ввод
  private markInput(): void {
    if (this.firstInputFired) return
    this.firstInputFired = true
    this.cb.onFirstInput?.()
  }

  private onWinResize = (): void => {
    this.resize()
  }

  private onContextLost = (e: Event): void => {
    e.preventDefault()
    cancelAnimationFrame(this.raf)
  }

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault()
    if (!this.inputEnabled || this.phase === 'summit') return
    this.markInput()
    let dy = e.deltaY
    if (e.deltaMode === 1) dy *= 16
    else if (e.deltaMode === 2) dy *= 100
    this.targetZ -= clamp(dy, -300, 300) * 0.05
  }

  private applyAim(nx: number, ny: number, withLook: boolean): void {
    this.lightTX = clamp(nx * 4.4, -4.4, 4.4)
    this.lightTY = clamp(0.6 + (ny * 0.5 + 0.5) * 3.4, 0.6, 4.0)
    if (withLook) {
      this.lookTX = clamp(nx * 0.25, -0.28, 0.28)
      this.lookTY = 0.02 + clamp(ny, -1, 1) * 0.12
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.markInput()
    this.flare = Math.min(this.flare + 1.5, 2.3)
    const rect = this.canvas.getBoundingClientRect()
    const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2
    if (e.pointerType !== 'mouse') {
      this.dragId = e.pointerId
      this.dragX = e.clientX
      this.dragY = e.clientY
      this.applyAim(nx, ny, false)
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) {
      this.markInput()
      const rect = this.canvas.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2
      const dx = e.clientX - this.dragX
      const dy = e.clientY - this.dragY
      this.dragX = e.clientX
      this.dragY = e.clientY
      this.lookTX = clamp(this.lookTX + dx * 0.0035, -0.42, 0.42)
      this.targetZ -= dy * 0.02
      this.applyAim(nx, ny, false)
      return
    }
    if (e.pointerType === 'mouse') {
      const rect = this.canvas.getBoundingClientRect()
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const ny = 1 - ((e.clientY - rect.top) / rect.height) * 2
      this.applyAim(nx, ny, true)
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId === this.dragId) this.dragId = -1
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.code === 'KeyW' || e.code === 'ArrowUp') {
      if (this.inputEnabled && this.phase !== 'summit') {
        this.keys.fwd = true
        this.markInput()
        e.preventDefault()
      }
    } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
      if (this.inputEnabled && this.phase !== 'summit') {
        this.keys.back = true
        this.markInput()
        e.preventDefault()
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.fwd = false
    else if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.back = false
  }

  // -------------------------------------------------------------- кадр
  private resize = (): void => {
    if (this.disposed) return
    const w = this.host.clientWidth || 1
    const h = this.host.clientHeight || 1
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const bw = Math.max(2, Math.round(w * dpr * this.scale))
    const bh = Math.max(2, Math.round(h * dpr * this.scale))
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw
      this.canvas.height = bh
    }
  }

  private updateSigils(): void {
    // бесконечная генерация: держим сигилы на 260 м вперёд
    if (this.endlessOn) {
      let last = this.sigils[this.sigils.length - 1]
      while (last && last.z > this.camZ - 260) {
        const idx = last.idx + 1
        const s: SigilState = { idx, z: sigilZ(idx), captured: false }
        this.sigils.push(s)
        last = s
      }
    }
    if (this.phase !== 'walk' && this.phase !== 'endless') return
    for (const s of this.sigils) {
      if (!s.captured && Math.abs(this.camZ - s.z) < CAPTURE_RANGE) {
        s.captured = true
        this.captured++
        this.cb.onCapture?.(this.captured)
        if (this.captured === 5 && this.phase === 'walk') {
          this.phase = 'ascend'
          this.ascendT0 = this.t
          this.cb.onAscendStart?.()
        }
      }
    }
  }

  private fillSigNear(): void {
    const a = this.sigNearArr
    for (let i = 0; i < SIGIL_SLOTS; i++) {
      a[i * 4] = 0
      a[i * 4 + 1] = 0
      a[i * 4 + 2] = 0
      a[i * 4 + 3] = -1
    }
    const sorted = [...this.sigils].sort(
      (x, y) => Math.abs(x.z - this.camZ) - Math.abs(y.z - this.camZ),
    )
    let n = 0
    const put = (s: SigilState): void => {
      if (n >= SIGIL_SLOTS) return
      a[n * 4] = sigilSide(s.idx) * SIGIL_X
      a[n * 4 + 1] = SIGIL_Y
      a[n * 4 + 2] = s.z
      a[n * 4 + 3] = s.captured ? 1 : 0
      n++
    }
    for (let i = 0; i < Math.min(4, sorted.length); i++) put(sorted[i] as SigilState)
    // слоты 5–6: ближайшие НЕ найденные (маяки впереди)
    for (const s of sorted) {
      if (n >= SIGIL_SLOTS) break
      if (s.captured) continue
      let dup = false
      for (let k = 0; k < n; k++) {
        if (Math.abs(a[k * 4 + 2] - s.z) < 0.6) {
          dup = true
          break
        }
      }
      if (!dup) put(s)
    }
  }

  private update(dt: number): void {
    if (this.phase === 'summit') this.targetZ -= 1.2 * dt
    if (this.reduced && (this.phase === 'walk' || this.phase === 'endless')) {
      this.targetZ -= 1.05 * dt
    }
    if (this.inputEnabled) {
      if (this.keys.fwd) this.targetZ -= 15 * dt
      if (this.keys.back) this.targetZ += 11 * dt
    }
    this.targetZ = Math.min(this.targetZ, 6)

    const dz = this.targetZ - this.camZ
    const v = clamp(dz * 3.4, -46, 46)
    this.camZ += v * dt
    this.speed = Math.abs(v)

    let camYTarget = BASE_Y
    if (this.phase === 'ascend') {
      const a = clamp((this.t - this.ascendT0) / ASCEND_DURATION, 0, 1)
      const e = a * a * (3 - 2 * a)
      this.ascend = e
      this.fogDens = 1 - 0.68 * e
      this.pitchExtra = -0.17 * e
      camYTarget = BASE_Y + (SUMMIT_Y - BASE_Y) * e
      if (a >= 1) {
        this.phase = 'summit'
        this.cb.onAscendDone?.(Math.max(0, -this.camZ), this.t - this.startT)
      }
    } else if (this.phase === 'summit') {
      camYTarget = SUMMIT_Y
    } else if (this.phase === 'endless') {
      camYTarget = BASE_Y
      this.ascend = lerp(this.ascend, 0.8, Math.min(1, dt * 0.8))
      this.fogDens = lerp(this.fogDens, 0.74, Math.min(1, dt * 0.8))
      this.pitchExtra = lerp(this.pitchExtra, 0, Math.min(1, dt * 0.8))
    }
    this.camY = lerp(this.camY, camYTarget, Math.min(1, dt * 3))

    // покачивание при движении (отключается при reduced-motion)
    const sp = Math.min(this.speed / 9, 1)
    if (!this.reduced && this.phase !== 'summit') {
      this.bobPhase += dt * (1.6 + this.speed * 0.22)
      this.sway = Math.sin(this.bobPhase) * 0.05 * sp
      this.bobY = Math.sin(this.bobPhase * 2) * 0.045 * sp
    } else {
      this.sway = 0
      this.bobY = 0
    }

    this.lookX = lerp(this.lookX, this.lookTX, Math.min(1, dt * 5))
    this.lookY = lerp(this.lookY, this.lookTY + this.pitchExtra, Math.min(1, dt * 5))

    this.light.x = lerp(this.light.x, this.lightTX, Math.min(1, dt * 6))
    this.light.y = lerp(this.light.y, this.lightTY, Math.min(1, dt * 6))
    this.light.z = lerp(this.light.z, this.camZ - 7, Math.min(1, dt * 7))
    this.flare *= Math.exp(-2.6 * dt)

    this.updateSigils()

    const target = Math.min(this.captured / 5, 1)
    this.shift = lerp(this.shift, target, Math.min(1, dt * 1.5))
  }

  private render(): void {
    const gl = this.gl
    const w = this.canvas.width
    const h = this.canvas.height
    if (w < 2 || h < 2 || !this.program) return
    if (gl.isContextLost()) return
    gl.viewport(0, 0, w, h)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    const lightI = Math.min(0.92 + 0.08 * Math.sin(this.t * 2.3) + this.flare, 2.4)
    this.fillSigNear()
    gl.uniform2f(this.u['uRes'] ?? null, w, h)
    gl.uniform1f(this.u['uTime'] ?? null, this.t)
    gl.uniform3f(this.u['uCam'] ?? null, this.sway, this.camY + this.bobY, this.camZ)
    gl.uniform2f(this.u['uLook'] ?? null, this.lookX, this.lookY)
    gl.uniform3f(this.u['uLight'] ?? null, this.light.x, this.light.y, this.light.z)
    gl.uniform1f(this.u['uLightI'] ?? null, lightI)
    gl.uniform1f(this.u['uShift'] ?? null, this.shift)
    gl.uniform1f(this.u['uAscend'] ?? null, this.ascend)
    gl.uniform1f(this.u['uFogDens'] ?? null, this.fogDens)
    gl.uniform1f(this.u['uEndless'] ?? null, this.endlessOn ? 1 : 0)
    gl.uniform1f(this.u['uSteps'] ?? null, this.stepsBudget)
    gl.uniform4fv(this.u['uSigNear[0]'] ?? null, this.sigNearArr)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  private frame = (now: number): void => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.frame)
    const rawDt = this.lastNow ? now - this.lastNow : 16.7
    this.lastNow = now
    const dt = Math.min(0.05, Math.max(0.0001, rawDt / 1000))
    this.t += dt
    this.update(dt)
    this.render()

    // счётчик кадров
    this.frames++
    this.fpsWindow += Math.min(rawDt, 250)
    if (this.fpsWindow >= 500) {
      this.fps = Math.round((this.frames * 1000) / this.fpsWindow)
      this.frames = 0
      this.fpsWindow = 0
    }

    // динамическое разрешение по EMA времени кадра
    this.emaDt = this.emaDt * 0.9 + Math.min(rawDt, 100) * 0.1
    if (now - this.lastAdjust > 480 && this.t > 1) {
      this.lastAdjust = now
      if (this.emaDt > 19.8 && this.scale > 0.5) {
        this.scale = Math.max(0.5, this.scale - 0.12)
        this.resize()
      } else if (this.emaDt > 34 && this.stepsBudget > 76) {
        this.slowStreak++
        if (this.slowStreak >= 2) this.stepsBudget = 76
      } else if (this.emaDt < 13.2 && this.scale < 1) {
        this.scale = Math.min(1, this.scale + 0.06)
        this.resize()
        this.slowStreak = 0
      } else if (this.emaDt < 15 && this.stepsBudget < 112) {
        this.stepsBudget = 112
      }
    }

    this.cb.onFrame?.({
      depth: Math.max(0, -this.camZ),
      fps: this.fps,
      ascendProg: this.phase === 'ascend' ? this.ascend : 0,
    })
  }
}
