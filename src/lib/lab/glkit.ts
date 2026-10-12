/**
 * ЛАБОРАТОРИЯ · FIELD·5 — минимальный набор для WebGL2-демо.
 *
 * Один полноэкранный треугольник, одна программа, uniform-кэш, DPR-кап 2.
 * Никаких буферов обмена и матриц: вся сцена живёт во фрагментном шейдере.
 */

/** Программа шейдеров с кэшем uniform-локаций. */
export interface GLProgramHandle {
  program: WebGLProgram
  /** Активирует программу (useProgram). */
  use(): void
  /** Возвращает (и кэширует) локацию uniform-а по имени. */
  u(name: string): WebGLUniformLocation | null
}

/** Контекст WebGL2, упакованный под нужды демо лаборатории. */
export interface FullscreenGL {
  gl: WebGL2RenderingContext
  /** Компилирует программу: общий вершинный шейдер + переданный фрагментный. */
  program(fragSrc: string): GLProgramHandle
  /** Подгоняет drawing buffer под CSS-размер canvas (DPR-кап 2) и viewport. */
  resize(maxDim?: number): { width: number; height: number }
  /** Текущий размер буфера в пикселях. */
  size(): { width: number; height: number }
  dispose(): void
}

/** Общий вершинный шейдер: полноэкранный треугольник из gl_VertexID. */
const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`

/** Заголовок, который glkit подставляет к фрагментному шейдеру демо. */
const FRAG_HEADER = `#version 300 es
precision highp float;
out vec4 outColor;
`

/**
 * Создаёт WebGL2-контекст с полноэкранным треугольником.
 * Возвращает null, если WebGL2 недоступен (демо само решает, как деградировать).
 */
export function createFullscreenGL(canvas: HTMLCanvasElement): FullscreenGL | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    depth: false,
    stencil: false,
    alpha: false,
    powerPreference: 'low-power',
  })
  if (!gl) return null

  // Полноэкранный треугольник не требует атрибутов и буферов.
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)

  let width = 0
  let height = 0

  const compile = (type: number, src: string): WebGLShader => {
    const sh = gl.createShader(type)
    if (!sh) throw new Error('glkit: не удалось создать шейдер')
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(sh) ?? '?'
      gl.deleteShader(sh)
      throw new Error(`glkit: ошибка компиляции шейдера — ${log}`)
    }
    return sh
  }

  const api: FullscreenGL = {
    gl,
    program(fragSrc: string): GLProgramHandle {
      const vs = compile(gl.VERTEX_SHADER, VERT_SRC)
      const fs = compile(gl.FRAGMENT_SHADER, FRAG_HEADER + fragSrc)
      const program = gl.createProgram()
      if (!program) throw new Error('glkit: не удалось создать программу')
      gl.attachShader(program, vs)
      gl.attachShader(program, fs)
      gl.linkProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) ?? '?'
        gl.deleteProgram(program)
        throw new Error(`glkit: ошибка линковки программы — ${log}`)
      }
      gl.useProgram(program)
      const cache = new Map<string, WebGLUniformLocation | null>()
      return {
        program,
        use: () => gl.useProgram(program),
        u: (name: string) => {
          let loc = cache.get(name)
          if (loc === undefined) {
            loc = gl.getUniformLocation(program, name)
            cache.set(name, loc)
          }
          return loc
        },
      }
    },
    resize(maxDim = 4096) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      // maxDim — потолок для большей стороны буфера: тяжёлые шейдеры
      // рендерятся в уменьшенном буфере, браузер масштабирует картинку сам.
      const cap = Math.min(dpr, maxDim / Math.max(canvas.clientWidth, canvas.clientHeight, 1))
      const w = Math.max(1, Math.round(canvas.clientWidth * cap))
      const h = Math.max(1, Math.round(canvas.clientHeight * cap))
      if (w !== width || h !== height) {
        width = w
        height = h
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, width, height)
      return { width, height }
    },
    size() {
      return { width, height }
    },
    dispose() {
      gl.deleteVertexArray(vao)
      // Расширение WEBGL_lose_context освобождает ресурсы GPU немедленно —
      // важно для teardown при паузе карточек.
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
    },
  }

  return api
}

/** Быстрая проверка доступности WebGL2 без создания полноценного набора. */
export function hasWebGL2(): boolean {
  try {
    const probe = document.createElement('canvas')
    const gl = probe.getContext('webgl2')
    if (gl) {
      const lose = gl.getExtension('WEBGL_lose_context')
      lose?.loseContext()
      return true
    }
    return false
  } catch {
    return false
  }
}

