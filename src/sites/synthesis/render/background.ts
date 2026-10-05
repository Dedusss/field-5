import type { Bands } from '../types'
import { FRAG_SRC, VERT_SRC } from './shaders'

/**
 * Слой 1 — фон WebGL2: слива-градиент, fbm-дюны, луна, пыль.
 * Полноэкранный треугольник, динамическое разрешение 0.5..1.0 по времени кадра.
 */
export class BackgroundRenderer {
  readonly ok: boolean
  private readonly canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext | null = null
  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null
  private readonly u: Record<string, WebGLUniformLocation | null> = {}
  private cssW = 1
  private cssH = 1
  private dpr = 1
  private scale = 1
  private time = 0
  private ema = 16.7
  private frames = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    })
    if (!gl) {
      this.ok = false
      return
    }
    this.gl = gl
    const compile = (type: number, src: string): WebGLShader | null => {
      const sh = gl.createShader(type)
      if (!sh) return null
      gl.shaderSource(sh, src)
      gl.compileShader(sh)
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh)
        return null
      }
      return sh
    }
    const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) {
      this.ok = false
      this.gl = null
      return
    }
    const prog = gl.createProgram()
    if (!prog) {
      this.ok = false
      this.gl = null
      return
    }
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    gl.deleteShader(vs)
    gl.deleteShader(fs)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      gl.deleteProgram(prog)
      this.ok = false
      this.gl = null
      return
    }
    this.program = prog
    const vao = gl.createVertexArray()
    if (!vao) {
      this.ok = false
      this.gl = null
      return
    }
    gl.bindVertexArray(vao)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'aPos')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    this.vao = vao
    for (const name of ['uRes', 'uTime', 'uBass', 'uMid', 'uHigh', 'uWind', 'uReduced']) {
      this.u[name] = gl.getUniformLocation(prog, name)
    }
    this.ok = true
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.cssW = Math.max(1, cssW)
    this.cssH = Math.max(1, cssH)
    this.dpr = dpr
    this.applySize()
  }

  private applySize() {
    const gl = this.gl
    if (!gl) return
    const w = Math.max(2, Math.round(this.cssW * this.dpr * this.scale))
    const h = Math.max(2, Math.round(this.cssH * this.dpr * this.scale))
    if (this.canvas.width !== w) this.canvas.width = w
    if (this.canvas.height !== h) this.canvas.height = h
  }

  render(dt: number, bands: Bands, weather: number, reduced: boolean) {
    const gl = this.gl
    if (!gl || !this.program || !this.vao) return
    this.time += dt * (reduced ? 0.55 : 1)
    this.ema = this.ema * 0.9 + Math.min(dt * 1000, 100) * 0.1
    this.frames++
    if (this.frames % 50 === 0) {
      if (this.ema > 20 && this.scale > 0.5) {
        this.scale = Math.max(0.5, this.scale - 0.1)
        this.applySize()
      } else if (this.ema < 13.5 && this.scale < 1) {
        this.scale = Math.min(1, this.scale + 0.05)
        this.applySize()
      }
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)
    gl.uniform2f(this.u['uRes'] ?? null, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.u['uTime'] ?? null, this.time)
    gl.uniform1f(this.u['uBass'] ?? null, bands.bass)
    gl.uniform1f(this.u['uMid'] ?? null, bands.mid)
    gl.uniform1f(this.u['uHigh'] ?? null, bands.high)
    gl.uniform1f(this.u['uWind'] ?? null, weather)
    gl.uniform1f(this.u['uReduced'] ?? null, reduced ? 1 : 0)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  dispose() {
    const gl = this.gl
    if (!gl) return
    if (this.vao) gl.deleteVertexArray(this.vao)
    if (this.program) gl.deleteProgram(this.program)
    const lose = gl.getExtension('WEBGL_lose_context')
    if (lose) lose.loseContext()
    this.gl = null
    this.program = null
    this.vao = null
  }
}
