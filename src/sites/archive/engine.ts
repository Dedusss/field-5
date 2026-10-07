/**
 * ЭКСП. 03 «АРХИВ НЕВОЗМОЖНОГО» — движок three.js.
 *
 * Навигация «гравитация внимания»:
 *  - ДРЕЙФ: камера-пружина следует за якорем, плывущим по маршруту Catmull-Rom
 *    сквозь облако скульптур. Края экрана / WASD добавляют вектор дрейфа.
 *  - ПРИТЯЖЕНИЕ: курсор над скульптурой дольше 0.6 c — якорь перетягивает камеру
 *    к точке подлёта (до ~5 м/с), у курсора возникает хинт «подлететь?».
 *  - ПОЛЁТ: клик/тап/Enter — кубический перелёт на орбитальную позицию за 1.6 c.
 *  - ОРБИТА: драг — вращение, колесо — dolly 0.6..2.6, автоповорот после 3 c покоя.
 *
 * Полный teardown: геометрии, материалы, env-карта, RAF, слушатели, DOM-надписи,
 * WebGL-контекст (forceContextLoss), window.__archive.
 */

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { SCULPTURES, type SculptureBuild, type SculptureDef } from './sculptures'
import { COLORS, type ExhibitInfo } from './theme'
import { hashString, mulberry32, rand } from './rng'

/** Обходит иерархию с учётом InstancedMesh — для честного масштаба к габариту. */
function computeMaxDim(obj: THREE.Object3D): number {
  obj.updateMatrixWorld(true)
  const box = new THREE.Box3()
  const v = new THREE.Vector3()
  const im = new THREE.Matrix4()
  obj.traverse((o) => {
    const asInstanced = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number; getMatrixAt?: (i: number, m: THREE.Matrix4) => void }
    if (asInstanced.isInstancedMesh && asInstanced.getMatrixAt && asInstanced.count !== undefined) {
      for (let i = 0; i < asInstanced.count; i++) {
        asInstanced.getMatrixAt(i, im)
        v.setFromMatrixPosition(im).applyMatrix4(asInstanced.matrixWorld)
        box.expandByPoint(v)
      }
      return
    }
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.geometry) {
      mesh.geometry.computeBoundingBox()
      const gb = mesh.geometry.boundingBox
      if (!gb) return
      for (let c = 0; c < 8; c++) {
        v.set(c & 1 ? gb.max.x : gb.min.x, c & 2 ? gb.max.y : gb.min.y, c & 4 ? gb.max.z : gb.min.z)
        v.applyMatrix4(mesh.matrixWorld)
        box.expandByPoint(v)
      }
    }
  })
  const dim = new THREE.Vector3()
  box.getSize(dim)
  return Math.max(dim.x, dim.y, dim.z) || 1
}

function safeDispose(o: THREE.Object3D): void {
  const d = o as THREE.Object3D & { dispose?: () => void }
  if (typeof d.dispose === 'function') d.dispose()
}

export type ArchiveMode = 'drift' | 'flight' | 'orbit' | 'release'

export interface EngineCallbacks {
  onProgress: (done: number, total: number) => void
  onReady: () => void
  onMode: (mode: ArchiveMode) => void
  onVisit: (id: string, visitedCount: number) => void
  onCard: (info: ExhibitInfo | null) => void
}

export interface ArchiveOptions {
  reducedMotion: boolean
}

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas')
    return c.getContext('webgl2') !== null
  } catch {
    return false
  }
}

/* ---------------- константы атмосферы и движения ---------------- */

const MASTER_SEED = 0x5eed0303
const DRIFT_SPEED = 2.2
const ATTRACT_SPEED = 5.0
const HOVER_HOLD = 0.6
const FLIGHT_TIME = 1.6
const RELEASE_TIME = 1.25
const AUTO_ORBIT_SPEED = 0.08
const ORBIT_IDLE = 3
const LABEL_RANGE = 52
const UP = new THREE.Vector3(0, 1, 0)

interface Exhibit {
  def: SculptureDef
  index: number
  seed: number
  round: number
  build: SculptureBuild
  pivot: THREE.Group
  bob: THREE.Group
  spinner: THREE.Group
  radius: number
  visited: boolean
  spinAxis: THREE.Vector3
  bobAmp: number
  bobPeriod: number
  bobPhase: number
  assembleT: number
  label: HTMLDivElement
}

interface FlightState {
  kind: 'exhibit' | 'return'
  t: number
  dur: number
  targetIndex: number
  fromPos: THREE.Vector3
  fromQuat: THREE.Quaternion
  dir: THREE.Vector3
  dist: number
}

function smootherstep(t: number): number {
  const x = Math.max(0, Math.min(1, t))
  return x * x * x * (x * (x * 6 - 15) + 10)
}

function easeOutBack(t: number): number {
  const c = 1.7
  const x = Math.max(0, Math.min(1, t)) - 1
  return 1 + (c + 1) * x * x * x + c * x * x
}

export class ArchiveEngine {
  private readonly container: HTMLElement
  private readonly cb: EngineCallbacks
  private readonly reduced: boolean

  private renderer: THREE.WebGLRenderer | null = null
  private canvas: HTMLCanvasElement | null = null
  private readonly scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera | null = null
  private envRT: THREE.WebGLRenderTarget | null = null

  private exhibits: Exhibit[] = []
  private curve!: THREE.CatmullRomCurve3
  private curveLen = 1

  private rafId = 0
  private disposed = false
  private uiBlocked = false
  private time = 0
  private visitedCount = 0

  private mode: ArchiveMode = 'drift'
  private flight: FlightState | null = null
  private readonly orbit = { index: -1, theta: 0, phi: Math.PI / 2, dist: 10, zoom: 1, idle: 99 }

  /* дрейф */
  private readonly camPos = new THREE.Vector3()
  private readonly camVel = new THREE.Vector3()
  private anchorU = 0
  private readonly steer = new THREE.Vector2()
  private readonly steerTarget = new THREE.Vector2()
  private speedTrim = 1
  private swipeImpulse = 0
  private readonly lookPoint = new THREE.Vector3()
  private lookYaw = 0
  private lookPitch = 0

  /* внимание */
  private hoverId: string | null = null
  private hoverTime = 0
  private attractId: string | null = null
  private attractS = 0

  /* указатель */
  private pointerInside = false
  private readonly ndc = new THREE.Vector2(-2, -2)
  private lastClientX = 0
  private lastClientY = 0
  private isTouch = false
  private buttonDown = false
  private dragMoved = 0
  private downTime = 0
  private downX = 0
  private downY = 0
  private lastTap = 0
  private edgeSide = 0
  private edgeFired = false
  private lastX = 0
  private lastY = 0

  private readonly keys = new Set<string>()

  /* перф */
  private dpr = 1
  private dprCap = 2
  private frameMs = 16
  private lastDprCheck = 0
  private lastFrameMs = 0
  private readonly size = new THREE.Vector2(1, 1)

  /* DOM сцены */
  private labelLayer: HTMLDivElement | null = null
  private hintEl: HTMLDivElement | null = null
  private resizeObserver: ResizeObserver | null = null
  private readonly listeners: { el: EventTarget; type: string; fn: EventListener; opts?: AddEventListenerOptions }[] = []

  /* утилиты, чтобы не аллоцировать в кадре */
  private readonly v1 = new THREE.Vector3()
  private readonly v2 = new THREE.Vector3()
  private readonly v3 = new THREE.Vector3()
  private readonly v4 = new THREE.Vector3()
  private readonly q1 = new THREE.Quaternion()
  private readonly m1 = new THREE.Matrix4()
  private readonly ray = new THREE.Raycaster()
  private readonly sphere = new THREE.Sphere()

  constructor(container: HTMLElement, opts: ArchiveOptions, cb: EngineCallbacks) {
    this.container = container
    this.reduced = opts.reducedMotion
    this.cb = cb
  }

  /* ------------------------------------------------------------ */
  /* Жизненный цикл                                                */
  /* ------------------------------------------------------------ */

  async start(): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    const r = this.renderer
    r.setPixelRatio(1)
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 1.1
    r.outputColorSpace = THREE.SRGBColorSpace
    r.domElement.style.position = 'absolute'
    r.domElement.style.inset = '0'
    r.domElement.style.width = '100%'
    r.domElement.style.height = '100%'
    r.domElement.style.touchAction = 'none'
    r.domElement.style.display = 'block'
    this.canvas = r.domElement
    this.container.appendChild(r.domElement)

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 170)
    this.scene.background = new THREE.Color(COLORS.bg)
    this.scene.fog = new THREE.FogExp2(COLORS.fog, 0.0185)

    /* свет: тёплое солнце сквозь дымку, небо кости / земля терракотовой пыли, лёгкий контровой */
    const hemi = new THREE.HemisphereLight(0xf6ecd6, 0xbd9772, 1.05)
    this.scene.add(hemi)
    const key = new THREE.DirectionalLight(0xfff0da, 2.1)
    key.position.set(30, 38, 20)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0xead9ba, 0.75)
    rim.position.set(-32, 14, -26)
    this.scene.add(rim)

    /* мягкая env-карта: оживает только металл/глянец (envMapIntensity у матов ≈ 0) */
    const pmrem = new THREE.PMREMGenerator(r)
    const room = new RoomEnvironment()
    this.envRT = pmrem.fromScene(room, 0.04)
    this.scene.environment = this.envRT.texture
    pmrem.dispose()

    /* DOM-слои: подписи экспонатов + хинт у курсора */
    this.labelLayer = document.createElement('div')
    this.labelLayer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;'
    this.container.appendChild(this.labelLayer)
    this.hintEl = document.createElement('div')
    this.hintEl.className = 'font-mono'
    this.hintEl.style.cssText =
      'position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;' +
      'font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:#c4592f;' +
      'padding:3px 7px 3px 9px;border-left:1px solid #c4592f;background:rgba(239,230,212,0.55);' +
      'opacity:0;transition:opacity 0.25s ease;'
    this.hintEl.textContent = 'подлететь?'
    this.container.appendChild(this.hintEl)

    this.attachEvents()

    /* размещение: свободное облако-дуга в объёме ~90×26×50, зазоры 14–20 м */
    this.placeExhibits()
    this.buildRoute()

    /* сборка скульптур по одной на кадр — честный boot ~1 c */
    for (let i = 0; i < SCULPTURES.length; i++) {
      if (this.disposed) return
      this.addExhibit(i)
      this.cb.onProgress(i + 1, SCULPTURES.length)
      await new Promise<void>((res) => requestAnimationFrame(() => res()))
    }
    if (this.disposed) return

    this.dprCap = Math.min(window.devicePixelRatio || 1, 2)
    this.dpr = this.dprCap
    this.resize()
    this.camPos.copy(this.curve.getPointAt(0))
    this.lookPoint.copy(this.curve.getPointAt(0.02))
    this.camera.position.copy(this.camPos)
    this.camera.lookAt(this.lookPoint)
    this.cb.onReady()
    this.clockLoop()
  }

  /* ------------------------------------------------------------ */
  /* Размещение и маршрут                                          */
  /* ------------------------------------------------------------ */

  private placeExhibits(): void {
    const rng = mulberry32(MASTER_SEED)
    for (let i = 0; i < SCULPTURES.length; i++) {
      const ang = (i / SCULPTURES.length) * Math.PI * 2 - Math.PI / 2 + rand(rng, -0.15, 0.15)
      const rad = rand(rng, 24, 33)
      const x = Math.cos(ang) * rad * 1.22
      const z = Math.sin(ang) * rad * 0.72
      const y = rand(rng, -3.5, 6.5)
      const def = SCULPTURES[i]
      const pivot = new THREE.Group()
      pivot.position.set(x, y, z)
      const bob = new THREE.Group()
      const spinner = new THREE.Group()
      bob.add(spinner)
      pivot.add(bob)
      this.scene.add(pivot)

      /* подпись-название (3D→2D проекция в кадре) */
      const label = document.createElement('div')
      label.style.cssText =
        'position:absolute;left:0;top:0;pointer-events:none;white-space:nowrap;' +
        'transform:translate3d(-200px,-200px,0);opacity:0;transition:opacity 0.4s ease;'
      const idx = document.createElement('span')
      idx.className = 'font-mono'
      idx.style.cssText = 'font-size:9px;letter-spacing:0.24em;color:#c4592f;margin-right:7px;'
      idx.textContent = String(i + 1).padStart(2, '0')
      const name = document.createElement('span')
      name.className = 'font-serif'
      name.style.cssText = 'font-style:italic;font-size:15px;color:rgba(43,33,24,0.85);'
      name.textContent = def.ru
      label.appendChild(idx)
      label.appendChild(name)
      this.labelLayer?.appendChild(label)

      const spinAxis = new THREE.Vector3(rand(rng, -0.32, 0.32), rand(rng, 0.6, 1), rand(rng, -0.32, 0.32))
      if (def.id === 'city') spinAxis.set(0.06, 1, 0.04)
      spinAxis.normalize()

      this.exhibits.push({
        def,
        index: i,
        seed: (hashString(def.id) ^ MASTER_SEED) >>> 0,
        round: 0,
        build: { object: new THREE.Group(), params: [], dispose: () => {} },
        pivot,
        bob,
        spinner,
        radius: def.size / 2,
        visited: false,
        spinAxis,
        bobAmp: rand(rng, 0.3, 0.55),
        bobPeriod: rand(rng, 7, 13),
        bobPhase: rand(rng, 0, Math.PI * 2),
        assembleT: 1,
        label,
      })
    }
  }

  private buildRoute(): void {
    /* маршрут плетётся между скульптурами: середины соседей, подтянутые к центру */
    const rng = mulberry32(MASTER_SEED ^ 0x9e3779b9)
    const pts: THREE.Vector3[] = []
    const n = this.exhibits.length
    for (let i = 0; i < n; i++) {
      const a = this.exhibits[i].pivot.position
      const b = this.exhibits[(i + 1) % n].pivot.position
      const mid = a.clone().add(b).multiplyScalar(0.5)
      mid.multiplyScalar(0.52)
      mid.y += rand(rng, -1.4, 1.4)
      pts.push(mid)
    }
    pts.push(new THREE.Vector3(rand(rng, -4, 4), rand(rng, -1, 3), rand(rng, -5, 5)))
    pts.push(new THREE.Vector3(rand(rng, -5, 5), rand(rng, -2, 2), rand(rng, -4, 4)))
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)
    this.curveLen = this.curve.getLength()
  }

  private addExhibit(index: number): void {
    const ex = this.exhibits[index]
    const build = ex.def.build(ex.seed)
    this.mountBuild(ex, build)
    ex.assembleT = 0 /* каскад сборки при появлении */
  }

  private mountBuild(ex: Exhibit, build: SculptureBuild): void {
    ex.spinner.add(build.object)
    /* масштаб к целевому габариту (учитывая инстансы) */
    const maxDim = computeMaxDim(build.object)
    build.object.scale.setScalar(ex.def.size / maxDim)
    ex.radius = ex.def.size * 0.62
    ex.build = build
  }

  private unmountBuild(ex: Exhibit): void {
    ex.spinner.remove(ex.build.object)
    ex.build.dispose()
  }

  private exhibitInfo(ex: Exhibit): ExhibitInfo {
    return {
      id: ex.def.id,
      index: ex.index,
      ru: ex.def.ru,
      latin: ex.def.latin,
      algo: ex.def.algo,
      seedHex: ex.seed.toString(16).padStart(8, '0'),
      params: ex.build.params,
    }
  }

  /* ------------------------------------------------------------ */
  /* Публичное управление (карточка, точки, QA)                    */
  /* ------------------------------------------------------------ */

  getMode(): ArchiveMode {
    return this.mode
  }

  getCurrentIndex(): number {
    return this.orbit.index
  }

  getVisitedCount(): number {
    return this.visitedCount
  }

  setUiBlocked(b: boolean): void {
    this.uiBlocked = b
  }

  flyToIndex(i: number): void {
    if (this.disposed || !this.camera || this.uiBlocked) return
    const ex = this.exhibits[i]
    if (!ex) return
    const center = ex.bob.getWorldPosition(this.v1)
    const dir = this.v2.copy(this.camPos).sub(center)
    dir.y *= 0.4
    if (dir.lengthSq() < 0.25) dir.set(1, 0.25, 1)
    dir.normalize()
    this.mode = 'flight'
    this.flight = {
      kind: 'exhibit',
      t: 0,
      dur: this.reduced ? 1.05 : FLIGHT_TIME,
      targetIndex: i,
      fromPos: this.camera.position.clone(),
      fromQuat: this.camera.quaternion.clone(),
      dir: dir.clone(),
      dist: Math.min(24, Math.max(7, ex.def.size * 2.2)),
    }
    this.resetAttention()
    this.cb.onCard(null)
    this.cb.onMode('flight')
  }

  release(): void {
    if (this.disposed || !this.camera || this.uiBlocked) return
    if (this.mode !== 'orbit') return
    this.mode = 'release'
    this.steerTarget.set(0, 0)
    this.flight = {
      kind: 'return',
      t: 0,
      dur: this.reduced ? 0.9 : RELEASE_TIME,
      targetIndex: -1,
      fromPos: this.camera.position.clone(),
      fromQuat: this.camera.quaternion.clone(),
      dir: new THREE.Vector3(),
      dist: 0,
    }
    this.cb.onCard(null)
    this.cb.onMode('release')
  }

  reseedCurrent(): void {
    if (this.disposed || this.mode !== 'orbit' || this.orbit.index < 0) return
    const ex = this.exhibits[this.orbit.index]
    this.unmountBuild(ex)
    ex.round++
    ex.seed = (Math.random() * 0xffffffff) >>> 0
    const build = ex.def.build(ex.seed)
    this.mountBuild(ex, build)
    ex.assembleT = 0
    ex.spinner.rotation.y += 1.4
    this.cb.onCard(this.exhibitInfo(ex))
  }

  measureFps(ms: number): Promise<number> {
    return new Promise((resolve) => {
      const t0 = performance.now()
      let frames = 0
      const tick = () => {
        if (this.disposed) {
          resolve(0)
          return
        }
        frames++
        const el = performance.now() - t0
        if (el >= ms) resolve(Math.round((frames * 1000) / el))
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
  }

  private resetAttention(): void {
    this.hoverId = null
    this.hoverTime = 0
    this.attractId = null
    this.attractS = 0
    this.setHint(false)
  }

  /* ------------------------------------------------------------ */
  /* События                                                       */
  /* ------------------------------------------------------------ */

  private on<K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: Event) => void, opts?: AddEventListenerOptions): void {
    const wrapped = fn as EventListener
    el.addEventListener(type, wrapped, opts)
    this.listeners.push({ el, type, fn: wrapped, opts })
  }

  private attachEvents(): void {
    const c = this.container
    this.on(c, 'pointerdown', (e) => this.onPointerDown(e as PointerEvent))
    this.on(window, 'pointermove', (e) => this.onPointerMove(e as PointerEvent), { passive: true })
    this.on(window, 'pointerup', (e) => this.onPointerUp(e as PointerEvent))
    this.on(window, 'pointercancel', (e) => this.onPointerUp(e as PointerEvent))
    this.on(c, 'pointerleave', () => {
      this.pointerInside = false
      this.ndc.set(-2, -2)
      this.hoverId = null
      this.hoverTime = 0
    })
    this.on(c, 'wheel', (e) => {
      const we = e as WheelEvent
      const inHudScroll = (we.target as HTMLElement | null)?.closest?.('[data-hud-scroll]')
      if (inHudScroll) return
      if (this.mode === 'orbit' && !this.uiBlocked) {
        this.orbit.zoom = Math.min(2.6, Math.max(0.6, this.orbit.zoom * Math.exp(we.deltaY * 0.0011)))
        this.orbit.idle = 0
      }
      we.preventDefault()
    }, { passive: false })
    this.on(c, 'contextmenu', (e) => e.preventDefault())
    this.on(window, 'keydown', (e) => {
      const ke = e as KeyboardEvent
      if (this.uiBlocked) return
      if (ke.code === 'Escape') {
        if (this.mode === 'orbit') this.release()
        return
      }
      if (ke.code === 'Enter' && this.mode === 'drift' && this.attractId) {
        const i = this.exhibits.findIndex((x) => x.def.id === this.attractId)
        if (i >= 0) this.flyToIndex(i)
        return
      }
      this.keys.add(ke.code)
    })
    this.on(window, 'keyup', (e) => this.keys.delete((e as KeyboardEvent).code))
    this.on(window, 'blur', () => this.keys.clear())

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(this.container)
  }

  private onPointerDown(e: PointerEvent): void {
    if (this.uiBlocked) return
    /* жесты сцены — только с canvas; HUD-кнопки не дергают камеру */
    if (e.target !== this.canvas) return
    this.isTouch = e.pointerType !== 'mouse'
    this.buttonDown = true
    this.dragMoved = 0
    this.downTime = performance.now()
    this.downX = this.lastX = e.clientX
    this.downY = this.lastY = e.clientY
    this.edgeFired = false
    const w = this.size.x
    this.edgeSide = e.clientX < 30 ? -1 : e.clientX > w - 30 ? 1 : 0
    this.updateNdc(e)
  }

  private onPointerMove(e: PointerEvent): void {
    this.pointerInside = true
    this.lastClientX = e.clientX
    this.lastClientY = e.clientY
    if (!this.isTouch) this.isTouch = e.pointerType !== 'mouse'
    if (this.buttonDown) {
      const dx = e.clientX - this.lastX
      const dy = e.clientY - this.lastY
      this.dragMoved += Math.abs(dx) + Math.abs(dy)
      /* свайп от края = импульс дрейфа */
      if (this.isTouch && this.edgeSide !== 0 && !this.edgeFired) {
        const totalX = e.clientX - this.downX
        const totalY = e.clientY - this.downY
        if (Math.abs(totalX) > 70 && Math.abs(totalX) > Math.abs(totalY) * 1.4) {
          this.swipeImpulse = -Math.sign(totalX) * 16
          this.edgeFired = true
        }
      }
      if (this.mode === 'orbit') {
        this.orbit.theta -= dx * 0.0062
        this.orbit.phi = Math.min(Math.PI - 0.14, Math.max(0.14, this.orbit.phi - dy * 0.0062))
        this.orbit.idle = 0
      } else if (!this.edgeFired) {
        this.lookYaw -= dx * 0.003
        this.lookPitch = Math.min(0.6, Math.max(-0.6, this.lookPitch - dy * 0.003))
      }
      this.lastX = e.clientX
      this.lastY = e.clientY
    }
    this.updateNdc(e)
    if (!this.isTouch && this.hintEl) {
      this.hintEl.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 20}px, 0)`
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (!this.buttonDown) {
      this.updateNdc(e)
      return
    }
    this.buttonDown = false
    if (this.uiBlocked) return
    const dt = performance.now() - this.downTime
    const moved = this.dragMoved
    this.updateNdc(e)
    if (this.edgeFired) return
    if (moved > 7 || dt > 350) return
    /* тап/клик: попадание в скульптуру — полёт; двойной тап в орбите — отпустить */
    const hit = this.pickExhibit()
    const now = performance.now()
    if (this.mode === 'orbit' && now - this.lastTap < 350 && !hit) {
      this.lastTap = 0
      this.release()
      return
    }
    this.lastTap = now
    if (hit) {
      if (!(this.mode === 'orbit' && this.orbit.index === hit.index)) this.flyToIndex(hit.index)
    }
  }

  private updateNdc(e: PointerEvent): void {
    const rect = this.container.getBoundingClientRect()
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private pickExhibit(): Exhibit | null {
    if (!this.camera) return null
    this.ray.setFromCamera(this.ndc, this.camera)
    let best: Exhibit | null = null
    let bestDist = Infinity
    for (const ex of this.exhibits) {
      const center = ex.bob.getWorldPosition(this.v1)
      this.v2.copy(center).sub(this.ray.ray.origin)
      const t = this.v2.dot(this.ray.ray.direction)
      if (t < 1) continue
      this.v3.copy(this.ray.ray.origin).addScaledVector(this.ray.ray.direction, t)
      const d = this.v3.distanceTo(center)
      if (d < ex.radius * 1.18 && t < bestDist) {
        bestDist = t
        best = ex
      }
    }
    return best
  }

  /* ------------------------------------------------------------ */
  /* Кадр                                                          */
  /* ------------------------------------------------------------ */

  private resize(): void {
    if (!this.renderer || !this.camera || this.disposed) return
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.size.set(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
  }

  private setHint(on: boolean): void {
    if (!this.hintEl) return
    this.hintEl.style.opacity = on && !this.isTouch ? '1' : '0'
  }

  private clockLoop = (): void => {
    if (this.disposed || !this.camera) return
    this.rafId = requestAnimationFrame(this.clockLoop)
    const now = performance.now()
    const dt = Math.min(0.05, this.lastFrameMs ? (now - this.lastFrameMs) / 1000 : 0.016)
    this.lastFrameMs = now
    this.frameMs = this.frameMs * 0.94 + dt * 1000 * 0.06
    this.time += dt
    this.update(dt)
    this.renderer?.render(this.scene, this.camera)
  }

  private update(dt: number): void {
    /* скульптуры: вращение, покачивание, сборка, собственные анимации */
    for (const ex of this.exhibits) {
      const spin = ex.def.spin * (this.reduced ? 0.35 : 1)
      ex.spinner.rotateOnAxis(ex.spinAxis, spin * dt)
      ex.bob.position.y = ex.bobAmp * Math.sin((this.time * Math.PI * 2) / ex.bobPeriod + ex.bobPhase)
      if (ex.assembleT < 1) {
        ex.assembleT = Math.min(1, ex.assembleT + dt / 0.5)
        const pop = easeOutBack(ex.assembleT)
        ex.spinner.scale.setScalar(pop)
      }
      ex.build.anim?.(this.time, dt)
    }

    switch (this.mode) {
      case 'drift':
        this.updateDrift(dt)
        break
      case 'flight':
      case 'release':
        this.updateFlight(dt)
        break
      case 'orbit':
        this.updateOrbit(dt)
        break
    }

    this.updateAttention(dt)
    this.updateLabels()
    this.updatePerf(dt)

    if (this.container.style.cursor !== this.cursorStyle()) this.container.style.cursor = this.cursorStyle()
  }

  private cursorStyle(): string {
    if (this.buttonDown) return 'grabbing'
    if (this.mode === 'orbit') return 'grab'
    if (this.hoverId) return 'pointer'
    return 'crosshair'
  }

  /* ---------------- дрейф и притяжение ---------------- */

  private inputVector(): { lateral: number; forward: number } {
    let lateral = 0
    let forward = 0
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) lateral -= 1
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) lateral += 1
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 0.9
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 0.7
    if (this.pointerInside && !this.isTouch && !this.buttonDown) {
      const nx = (this.lastClientX / this.size.x) * 2 - 1
      const ny = (this.lastClientY / this.size.y) * 2 - 1
      if (nx < -0.7) lateral += (nx + 0.7) / 0.3
      else if (nx > 0.7) lateral += (nx - 0.7) / 0.3
      if (ny < -0.76) {
        forward += Math.min(0.65, (-ny - 0.76) / 0.24 * 0.65)
      } else if (ny > 0.8) {
        this.speedTrim = 1 - Math.min(0.55, ((ny - 0.8) / 0.2) * 0.55)
      } else {
        this.speedTrim += (1 - this.speedTrim) * 0.1
      }
    }
    return { lateral: Math.max(-1.3, Math.min(1.3, lateral)), forward: Math.max(-1, Math.min(1.6, forward)) }
  }

  private updateDrift(dt: number): void {
    const cam = this.camera!
    const input = this.inputVector()

    /* якорь плывёт по маршруту; reduced motion — только ручное продвижение */
    const auto = this.reduced ? 0 : 1
    const speed = DRIFT_SPEED * Math.max(0, auto * this.speedTrim + input.forward * (this.reduced ? 1.2 : 1))
    this.anchorU = (this.anchorU + (speed * dt) / this.curveLen) % 1
    if (this.anchorU < 0) this.anchorU += 1

    /* боковой увод: края, клавиши, свайп-импульс */
    this.swipeImpulse *= Math.exp(-dt * 0.9)
    this.steerTarget.set(input.lateral * 9 + this.swipeImpulse, input.forward * 0)
    this.steer.lerp(this.steerTarget, 1 - Math.exp(-1.7 * dt))

    const tangent = this.curve.getTangentAt(this.anchorU, this.v1).normalize()
    const right = this.v2.copy(tangent).cross(UP).normalize()
    const up2 = this.v3.copy(right).cross(tangent).normalize()
    const anchor = this.curve.getPointAt(this.anchorU, this.v4).clone()
    anchor.addScaledVector(right, this.steer.x)
    anchor.addScaledVector(up2, this.steer.y)

    /* притяжение внимания: якорь перетягивает к точке подлёта */
    if (this.attractId && this.attractS > 0.01) {
      const ex = this.exhibits.find((x) => x.def.id === this.attractId)
      if (ex) {
        const center = ex.bob.getWorldPosition(this.v1)
        const dir = this.v2.copy(this.camPos).sub(center).normalize()
        const approach = center.clone().addScaledVector(dir, ex.radius * 2.4 + 2)
        anchor.lerp(approach, this.attractS * 0.92)
      }
    }

    /* пружина к якорю */
    this.camVel.addScaledVector(this.v1.copy(anchor).sub(this.camPos), 2.1 * dt)
    this.camVel.multiplyScalar(Math.exp(-2.6 * dt))
    const maxSpeed = DRIFT_SPEED + (ATTRACT_SPEED - DRIFT_SPEED) * this.attractS + 1.4
    const sp = this.camVel.length()
    if (sp > maxSpeed) this.camVel.multiplyScalar(maxSpeed / sp)
    this.camPos.addScaledVector(this.camVel, dt)

    /* взгляд: точка впереди по маршруту + наклон к ближайшей скульптуре + ручной осмотр */
    const look = this.curve.getPointAt((this.anchorU + 7 / this.curveLen) % 1, this.v1).clone()
    let bestScore = Infinity
    let bestEx: Exhibit | null = null
    const fwd = this.v2.set(0, 0, -1).applyQuaternion(cam.quaternion)
    for (const ex of this.exhibits) {
      const center = ex.bob.getWorldPosition(this.v3)
      const d = center.distanceTo(this.camPos)
      if (d > 30) continue
      const ahead = this.v4.copy(center).sub(this.camPos).normalize().dot(fwd)
      if (ahead < 0.15) continue
      const score = d - ahead * 14
      if (score < bestScore) {
        bestScore = score
        bestEx = ex
      }
    }
    if (bestEx) {
      const center = bestEx.bob.getWorldPosition(this.v3)
      look.lerp(center, 0.42 * (1 - center.distanceTo(this.camPos) / 30))
    }
    if (this.attractId && this.attractS > 0.05) {
      const ex = this.exhibits.find((x) => x.def.id === this.attractId)
      if (ex) look.lerp(ex.bob.getWorldPosition(this.v3), this.attractS * 0.9)
    }
    /* ручной осмотр драгом */
    if (this.lookYaw !== 0 || this.lookPitch !== 0) {
      const off = look.sub(this.camPos)
      off.applyAxisAngle(UP, this.lookYaw)
      const rightV = this.v3.set(1, 0, 0).applyQuaternion(cam.quaternion)
      off.applyAxisAngle(rightV, this.lookPitch)
      look.copy(this.camPos).add(off)
      if (!this.buttonDown) {
        this.lookYaw *= Math.exp(-dt * 0.6)
        this.lookPitch *= Math.exp(-dt * 0.6)
      }
    }

    this.lookPoint.lerp(look, 1 - Math.exp(-2.4 * dt))
    cam.position.copy(this.camPos)
    this.m1.lookAt(cam.position, this.lookPoint, UP)
    this.q1.setFromRotationMatrix(this.m1)
    cam.quaternion.slerp(this.q1, 1 - Math.exp(-4.5 * dt))
  }

  private updateFlight(dt: number): void {
    const f = this.flight
    const cam = this.camera!
    if (!f) {
      this.mode = 'drift'
      return
    }
    f.t += dt / f.dur
    const e = smootherstep(f.t)

    let endPos: THREE.Vector3
    if (f.kind === 'exhibit') {
      const ex = this.exhibits[f.targetIndex]
      const center = ex.bob.getWorldPosition(this.v1)
      endPos = center.clone().addScaledVector(f.dir, f.dist)
      this.m1.lookAt(endPos, center, UP)
    } else {
      endPos = this.curve.getPointAt(this.anchorU, this.v1).clone()
      const look = this.curve.getPointAt((this.anchorU + 7 / this.curveLen) % 1, this.v2).clone()
      this.m1.lookAt(endPos, look, UP)
    }
    this.q1.setFromRotationMatrix(this.m1)
    cam.position.lerpVectors(f.fromPos, endPos, e)
    cam.quaternion.slerpQuaternions(f.fromQuat, this.q1, e)
    this.camPos.copy(cam.position)

    if (f.t >= 1) {
      if (f.kind === 'return') {
        this.enterDrift()
      } else {
        this.enterOrbit(f.targetIndex)
      }
    }
  }

  private enterDrift(): void {
    this.mode = 'drift'
    this.flight = null
    this.camVel.copy(this.curve.getTangentAt(this.anchorU, this.v1)).multiplyScalar(DRIFT_SPEED)
    this.cb.onMode('drift')
  }

  private enterOrbit(index: number): void {
    const cam = this.camera!
    const ex = this.exhibits[index]
    this.mode = 'orbit'
    this.flight = null
    this.orbit.index = index
    const center = ex.bob.getWorldPosition(this.v1)
    const off = this.v2.copy(cam.position).sub(center)
    const r = Math.max(0.5, off.length())
    this.orbit.theta = Math.atan2(off.x, off.z)
    this.orbit.phi = Math.acos(Math.max(-1, Math.min(1, off.y / r)))
    this.orbit.dist = r
    this.orbit.zoom = 1
    this.orbit.idle = 0
    if (!ex.visited) {
      ex.visited = true
      this.visitedCount++
      this.cb.onVisit(ex.def.id, this.visitedCount)
    }
    this.cb.onCard(this.exhibitInfo(ex))
    this.cb.onMode('orbit')
  }

  private updateOrbit(dt: number): void {
    const cam = this.camera!
    const ex = this.exhibits[this.orbit.index]
    if (!ex) return
    /* стрелки — ручное вращение */
    if (this.keys.has('ArrowLeft')) this.orbit.theta += 1.1 * dt
    if (this.keys.has('ArrowRight')) this.orbit.theta -= 1.1 * dt
    if (this.keys.has('ArrowUp')) this.orbit.phi = Math.min(Math.PI - 0.14, this.orbit.phi - 0.7 * dt)
    if (this.keys.has('ArrowDown')) this.orbit.phi = Math.max(0.14, this.orbit.phi + 0.7 * dt)

    this.orbit.idle += dt
    if (this.orbit.idle > ORBIT_IDLE && !this.reduced) this.orbit.theta += AUTO_ORBIT_SPEED * dt

    const center = ex.bob.getWorldPosition(this.v1)
    const r = this.orbit.dist * this.orbit.zoom
    const sp = Math.sin(this.orbit.phi)
    cam.position.set(
      center.x + r * sp * Math.sin(this.orbit.theta),
      center.y + r * Math.cos(this.orbit.phi),
      center.z + r * sp * Math.cos(this.orbit.theta),
    )
    cam.lookAt(center)
    this.camPos.copy(cam.position)
  }

  /* ---------------- внимание: ховер 0.6 c → притяжение ---------------- */

  private updateAttention(dt: number): void {
    if (this.mode !== 'drift' || this.isTouch || !this.pointerInside || this.uiBlocked) {
      this.hoverId = null
      this.hoverTime = 0
      this.attractS *= Math.exp(-dt * 4)
      if (this.attractS < 0.02) this.attractId = null
      this.setHint(false)
      return
    }
    const hit = this.pickExhibit()
    const hitId = hit ? hit.def.id : null
    if (hitId !== this.hoverId) {
      this.hoverId = hitId
      this.hoverTime = 0
    } else if (hitId) {
      this.hoverTime += dt
    }
    const attractOn = !!hitId && this.hoverTime > HOVER_HOLD && !this.reduced
    if (attractOn) this.attractId = hitId
    const target = attractOn ? 1 : 0
    this.attractS += (target - this.attractS) * (1 - Math.exp(-(attractOn ? 1.7 : 3.2) * dt))
    if (!attractOn && this.attractS < 0.02) this.attractId = null
    this.setHint(attractOn)
  }

  /* ---------------- подписи у непосещённых ---------------- */

  private updateLabels(): void {
    const cam = this.camera!
    const show = this.mode === 'drift' || this.mode === 'release'
    const w = this.size.x
    const h = this.size.y
    const candidates: { ex: Exhibit; d: number }[] = []
    for (const ex of this.exhibits) {
      if (!show || ex.visited) {
        ex.label.style.opacity = '0'
        continue
      }
      const center = ex.bob.getWorldPosition(this.v1)
      const d = center.distanceTo(cam.position)
      if (d > LABEL_RANGE) {
        ex.label.style.opacity = '0'
        continue
      }
      center.y += ex.radius * 0.55 + 0.5
      this.v2.copy(center).project(cam)
      if (this.v2.z > 1 || Math.abs(this.v2.x) > 1.05 || Math.abs(this.v2.y) > 1.05) {
        ex.label.style.opacity = '0'
        continue
      }
      candidates.push({ ex, d })
    }
    candidates.sort((a, b) => a.d - b.d)
    const max = Math.min(3, candidates.length)
    for (let i = 0; i < candidates.length; i++) {
      const { ex, d } = candidates[i]
      if (i >= max) {
        ex.label.style.opacity = '0'
        continue
      }
      const center = ex.bob.getWorldPosition(this.v1)
      center.y += ex.radius * 0.55 + 0.5
      this.v2.copy(center).project(cam)
      const x = (this.v2.x * 0.5 + 0.5) * w
      const y = (-this.v2.y * 0.5 + 0.5) * h
      ex.label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`
      ex.label.style.opacity = (0.9 * (1 - d / LABEL_RANGE)).toFixed(2)
    }
  }

  /* ---------------- перф: адаптивный DPR ---------------- */

  private updatePerf(_dt: number): void {
    if (this.time - this.lastDprCheck < 2.5) return
    this.lastDprCheck = this.time
    if (!this.renderer) return
    if (this.frameMs > 26 && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.resize()
    } else if (this.frameMs < 13.5 && this.dpr < this.dprCap) {
      this.dpr = Math.min(this.dprCap, this.dpr + 0.25)
      this.resize()
    }
  }

  /* ------------------------------------------------------------ */
  /* Разбор (teardown)                                             */
  /* ------------------------------------------------------------ */

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    cancelAnimationFrame(this.rafId)

    for (const { el, type, fn, opts } of this.listeners) el.removeEventListener(type, fn, opts)
    this.listeners.length = 0
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.keys.clear()

    for (const ex of this.exhibits) {
      ex.build.dispose()
      ex.label.remove()
      ex.pivot.removeFromParent()
      safeDispose(ex.pivot)
      safeDispose(ex.bob)
      safeDispose(ex.spinner)
    }
    this.exhibits.length = 0

    this.scene.traverse(safeDispose)
    this.scene.clear()

    this.envRT?.texture.dispose()
    this.envRT?.dispose()
    this.envRT = null

    this.labelLayer?.remove()
    this.hintEl?.remove()

    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.forceContextLoss()
      this.renderer.domElement.remove()
      this.renderer = null
    }

    this.canvas = null
    this.camera = null
    if (typeof window !== 'undefined' && '__archive' in window) {
      delete (window as { __archive?: unknown }).__archive
    }
  }
}

/** Регистрирует QA-хук window.__archive (дергается из agent-browser). */
export function installQaHook(engine: ArchiveEngine): void {
  const w = window as unknown as {
    __archive?: {
      mode: () => ArchiveMode
      focus: (i: number) => void
      release: () => void
      reseed: () => void
      fps: (ms: number) => Promise<number>
      visited: () => number
      current: () => number
    }
  }
  w.__archive = {
    mode: () => engine.getMode(),
    focus: (i: number) => engine.flyToIndex(i),
    release: () => engine.release(),
    reseed: () => engine.reseedCurrent(),
    fps: (ms: number) => engine.measureFps(ms),
    visited: () => engine.getVisitedCount(),
    current: () => engine.getCurrentIndex(),
  }
}
