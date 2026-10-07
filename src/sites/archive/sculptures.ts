/**
 * ЭКСП. 03 — девять генераторов процедурных скульптур.
 * Каждый генератор детерминирован своим 32-битным семенем и возвращает
 * живые параметры (реальные переменные генерации) для карточки экспоната.
 */

import * as THREE from 'three'
import { COLORS, type ParamView } from './theme'
import { fbm3, mulberry32, pick, rand, randInt } from './rng'

/* ------------------------------------------------------------------ */
/* Публичные типы                                                      */
/* ------------------------------------------------------------------ */

export interface SculptureBuild {
  /** Готовая к масштабированию группа (без позиции — её ставит движок) */
  object: THREE.Group
  /** Опциональная собственная анимация (нить гиперболоида, дрожь города) */
  anim?: (t: number, dt: number) => void
  dispose(): void
  params: ParamView[]
}

export interface SculptureDef {
  id: string
  ru: string
  latin: string
  /** 1–2 строки об алгоритме для карточки */
  algo: string
  /** Целевой габарит, м (4–10) */
  size: number
  /** Скорость собственного вращения, рад/с */
  spin: number
  build: (seed: number) => SculptureBuild
}

/* ------------------------------------------------------------------ */
/* Общие помощники                                                     */
/* ------------------------------------------------------------------ */

/** Индексная параметрическая поверхность (u×v сетка). */
function paramSurface(
  uSeg: number,
  vSeg: number,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  fn: (u: number, v: number, out: THREE.Vector3) => void,
): THREE.BufferGeometry {
  const verts = new Float32Array((uSeg + 1) * (vSeg + 1) * 3)
  const p = new THREE.Vector3()
  let k = 0
  for (let i = 0; i <= uSeg; i++) {
    const u = u0 + (u1 - u0) * (i / uSeg)
    for (let j = 0; j <= vSeg; j++) {
      const v = v0 + (v1 - v0) * (j / vSeg)
      fn(u, v, p)
      verts[k++] = p.x
      verts[k++] = p.y
      verts[k++] = p.z
    }
  }
  const idx = new Uint32Array(uSeg * vSeg * 6)
  let t = 0
  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * (vSeg + 1) + j
      const b = a + vSeg + 1
      idx[t++] = a
      idx[t++] = b
      idx[t++] = a + 1
      idx[t++] = b
      idx[t++] = b + 1
      idx[t++] = a + 1
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(verts, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  return g
}

/** Счётчик ресурсов сборки — для честного dispose при пересеве. */
class Tracker {
  readonly group = new THREE.Group()
  private readonly geos: THREE.BufferGeometry[] = []
  private readonly mats: THREE.Material[] = []
  private tris = 0

  geometry<G extends THREE.BufferGeometry>(g: G): G {
    this.geos.push(g)
    this.tris += g.index ? g.index.count / 3 : g.attributes.position ? g.attributes.position.count / 3 : 0
    return g
  }

  material<M extends THREE.Material>(m: M): M {
    this.mats.push(m)
    return m
  }

  mesh(geometry: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(this.geometry(geometry), this.material(material))
    this.group.add(m)
    return m
  }

  triangles(): number {
    return Math.round(this.tris)
  }

  disposer(): () => void {
    return () => {
      const instanced: THREE.Object3D[] = []
      this.group.traverse((o) => {
        const im = o as THREE.Object3D & { isInstancedMesh?: boolean; dispose?: () => void }
        if (im.isInstancedMesh) instanced.push(im)
      })
      for (const im of instanced) im.dispose?.()
      for (const g of this.geos) g.dispose()
      for (const m of this.mats) m.dispose()
      this.group.clear()
    }
  }
}

function std(opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(opts)
}

/* ------------------------------------------------------------------ */
/* 01 · Лента Клейна — фигурная восьмёрка, погружение в R³            */
/* ------------------------------------------------------------------ */

function buildKlein(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const r = rand(rng, 1.9, 2.5) // поперечина «восьмёрки»
  const uSeg = 180
  const vSeg = 42

  const geo = tr.geometry(
    paramSurface(uSeg, vSeg, 0, Math.PI * 2, 0, Math.PI * 2, (u, v, p) => {
      const cu = Math.cos(u)
      const su = Math.sin(u)
      const cu2 = Math.cos(u / 2)
      const su2 = Math.sin(u / 2)
      const sv = Math.sin(v)
      const s2v = Math.sin(2 * v)
      const h = r + cu2 * sv - su2 * s2v
      // y — вверх: классическое погружение повёрнуто, чтобы «лента» стояла
      p.set(h * cu, su2 * sv + cu2 * s2v, h * su)
    }),
  )

  const mat = std({
    color: COLORS.terra,
    roughness: 0.65,
    metalness: 0.05,
    side: THREE.DoubleSide,
    envMapIntensity: 0.18,
  })
  const mesh = new THREE.Mesh(geo, tr.material(mat))
  mesh.rotation.z = Math.PI / 2.3
  tr.group.add(mesh)

  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'поперечина восьмёрки', value: r.toFixed(2) },
      { label: 'сетка U×V', value: `${uSeg}×${vSeg}` },
      { label: 'треугольников', value: String(tr.triangles()) },
      { label: 'стороны', value: 'двусторонняя' },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 02 · Гироид-сфера — поле sin·cos, пары вершин наружу/внутрь        */
/* ------------------------------------------------------------------ */

function buildGyroid(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const detail = 5
  const freq = rand(rng, 1.5, 2.4)
  const amp = rand(rng, 0.1, 0.17)
  const sharp = rand(rng, 1.1, 2.2)

  const geo = tr.geometry(new THREE.IcosahedronGeometry(1, detail))
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  let outCount = 0
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    const x = n.x * freq * Math.PI
    const y = n.y * freq * Math.PI
    const z = n.z * freq * Math.PI
    const g = Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x)
    const d = amp * Math.max(-1, Math.min(1, g * sharp))
    if (d > 0) outCount++
    v.copy(n).multiplyScalar(1 + d)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  geo.computeVertexNormals()

  const mat = std({
    color: COLORS.boneMatte,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
    envMapIntensity: 0.15,
  })
  tr.group.add(new THREE.Mesh(geo, tr.material(mat)))

  const pushedOut = Math.round((outCount / pos.count) * 100)
  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'частота поля', value: freq.toFixed(2) },
      { label: 'амплитуда прорезей', value: amp.toFixed(3) },
      { label: 'жёсткость порога', value: sharp.toFixed(2) },
      { label: 'грань икосаэдра', value: `detail ${detail}` },
      { label: 'вершин наружу', value: `${pushedOut}%` },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 03 · Мёбиусов собор — вложенные ленты с поворотами                  */
/* ------------------------------------------------------------------ */

function buildMobiusCathedral(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const count = randInt(rng, 5, 7)
  const R0 = rand(rng, 1.8, 2.3)
  const uSeg = 160
  const tSeg = 8

  const mat = std({
    color: COLORS.ink,
    roughness: 0.2,
    metalness: 0.45,
    side: THREE.DoubleSide,
    envMapIntensity: 0.55,
  })

  let totalW = 0
  for (let i = 0; i < count; i++) {
    const R = R0 * (1 - i * rand(rng, 0.055, 0.11))
    const w = rand(rng, 0.16, 0.3)
    totalW += w
    const geo = tr.geometry(
      paramSurface(uSeg, tSeg, 0, Math.PI * 2, -1, 1, (u, t, p) => {
        const c = R + t * w * Math.cos(u / 2)
        p.set(c * Math.cos(u), t * w * Math.sin(u / 2) * 1.45, c * Math.sin(u))
      }),
    )
    const m = new THREE.Mesh(geo, tr.material(mat))
    m.rotation.y = (i / count) * Math.PI * 2 + rand(rng, -0.3, 0.3)
    m.rotation.x = rand(rng, -0.42, 0.42)
    m.rotation.z = rand(rng, -0.18, 0.18)
    tr.group.add(m)
  }

  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'лент Мёбиуса', value: String(count) },
      { label: 'радиус основания', value: R0.toFixed(2) },
      { label: 'средняя ширина ленты', value: (totalW / count).toFixed(2) },
      { label: 'разрезов в петле', value: String(uSeg) },
      { label: 'склеек', value: '1 на ленту' },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 04 · Цветок суперформулы — сферическое произведение двух форм       */
/* ------------------------------------------------------------------ */

function superR(angle: number, m: number, n1: number, n2: number, n3: number): number {
  const t1 = Math.pow(Math.abs(Math.cos((m * angle) / 4)), n2)
  const t2 = Math.pow(Math.abs(Math.sin((m * angle) / 4)), n3)
  const sum = t1 + t2
  if (sum <= 1e-9) return 0
  const r = Math.pow(sum, -1 / n1)
  return isFinite(r) ? Math.min(r, 2.4) : 0
}

function buildSuperflower(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const m1 = 2 * randInt(rng, 2, 5) + 1
  const m2 = 2 * randInt(rng, 1, 4) + 1
  const nA = [rand(rng, 0.25, 1.1), rand(rng, 0.4, 1.8), rand(rng, 0.4, 1.8)]
  const nB = [rand(rng, 0.25, 1.1), rand(rng, 0.4, 1.8), rand(rng, 0.4, 1.8)]
  const thetaSeg = 160
  const phiSeg = 80

  const geo = tr.geometry(
    paramSurface(thetaSeg, phiSeg, -Math.PI, Math.PI, -Math.PI / 2, Math.PI / 2, (theta, phi, p) => {
      const r1 = superR(theta, m1, nA[0], nA[1], nA[2])
      const r2 = superR(phi, m2, nB[0], nB[1], nB[2])
      const cp = Math.cos(phi)
      p.set(r1 * Math.cos(theta) * r2 * cp, r2 * Math.sin(phi), r1 * Math.sin(theta) * r2 * cp)
      // страховка от шипов суперуравнения
      const len = p.length()
      if (len > 2.2) p.multiplyScalar(2.2 / len)
    }),
  )

  tr.group.add(
    new THREE.Mesh(
      geo,
      tr.material(
        std({
          color: COLORS.terra,
          roughness: 0.6,
          metalness: 0.05,
          side: THREE.DoubleSide,
          envMapIntensity: 0.18,
        }),
      ),
    ),
  )

  // «пыльники» — тонкие кольца вокруг цветка
  const rings = randInt(rng, 2, 3)
  const dustMat = std({
    color: COLORS.boneMatte,
    roughness: 0.35,
    metalness: 0.45,
    envMapIntensity: 0.5,
  })
  for (let i = 0; i < rings; i++) {
    const ring = tr.mesh(new THREE.TorusGeometry(rand(rng, 1.12, 1.55), rand(rng, 0.012, 0.02), 6, 140), dustMat)
    ring.rotation.set(rand(rng, 0, Math.PI), rand(rng, 0, Math.PI), rand(rng, 0, Math.PI))
  }

  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'симметрия m₁ (тета)', value: String(m1) },
      { label: 'симметрия m₂ (фи)', value: String(m2) },
      { label: 'n₁ тета / фи', value: `${nA[0].toFixed(2)} / ${nB[0].toFixed(2)}` },
      { label: 'n₂,n₃ тета', value: `${nA[1].toFixed(2)}, ${nA[2].toFixed(2)}` },
      { label: 'пыльных колец', value: String(rings) },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 05 · Узел-башня — торический узел (p,q) с переменным радиусом       */
/* ------------------------------------------------------------------ */

class KnotCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly p: number,
    private readonly q: number,
    private readonly stretch: number,
  ) {
    super()
  }
  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    const u = t * Math.PI * 2
    const r = 1 + 0.42 * Math.cos(this.q * u)
    return target.set(r * Math.cos(this.p * u), this.stretch * Math.sin(this.q * u), r * Math.sin(this.p * u))
  }
}

function buildKnotTower(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const [p, q] = pick(rng, [
    [2, 3],
    [3, 2],
    [2, 5],
    [5, 2],
    [3, 4],
    [4, 3],
    [3, 5],
    [5, 3],
    [2, 7],
  ] as const) as [number, number]
  const stretch = rand(rng, 1.15, 1.5)
  const taper = rand(rng, 0.55, 0.8)
  const r0 = rand(rng, 0.2, 0.28)
  const tubular = 260
  const radial = 12

  const curve = new KnotCurve(p, q, stretch)
  const frames = curve.computeFrenetFrames(tubular, true)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= tubular; i++) pts.push(curve.getPoint(i / tubular))

  const ringVerts: number[] = []
  for (let i = 0; i <= tubular; i++) {
    const radius = r0 * (1 - taper * (i / tubular))
    const P = pts[i]
    const N = frames.normals[Math.min(i, tubular - 1)]
    const B = frames.binormals[Math.min(i, tubular - 1)]
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2
      const s = Math.sin(a)
      const c = Math.cos(a)
      ringVerts.push(
        P.x + (N.x * c + B.x * s) * radius,
        P.y + (N.y * c + B.y * s) * radius,
        P.z + (N.z * c + B.z * s) * radius,
      )
    }
  }
  const idx: number[] = []
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j
      const b = (i + 1) * radial + ((j + 1) % radial)
      const c = (i + 1) * radial + j
      const d = i * radial + ((j + 1) % radial)
      idx.push(a, c, d, d, c, b)
    }
  }
  // торцы — веера
  const bottomCenter = ringVerts.length / 3
  ringVerts.push(pts[0].x, pts[0].y, pts[0].z)
  const topCenter = ringVerts.length / 3
  ringVerts.push(pts[tubular].x, pts[tubular].y, pts[tubular].z)
  const topBase = tubular * radial
  for (let j = 0; j < radial; j++) {
    idx.push(bottomCenter, (j + 1) % radial, j)
    idx.push(topCenter, topBase + j, topBase + ((j + 1) % radial))
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(ringVerts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  tr.geometry(geo)

  tr.group.add(
    new THREE.Mesh(
      geo,
      tr.material(
        std({
          color: COLORS.bronze,
          roughness: 0.3,
          metalness: 0.85,
          envMapIntensity: 0.8,
        }),
      ),
    ),
  )

  const length = curve.getLength()
  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'узел (p, q)', value: `(${p}, ${q})` },
      { label: 'зацеплений', value: String((p - 1) * (q - 1) / 2) },
      { label: 'сужение к вершине', value: `${Math.round(taper * 100)}%` },
      { label: 'диаметр прутка', value: (r0 * 2).toFixed(2) },
      { label: 'длина нити, м', value: length.toFixed(1) },
      { label: 'сегментов трубки', value: String(tubular) },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 06 · Хром-древо — L-система, инстансы цилиндров, чистый металл      */
/* ------------------------------------------------------------------ */

interface LSystemRule {
  name: string
  axiom: string
  rules: Record<string, string>
  iterations: number
}

const L_RULES: readonly LSystemRule[] = [
  {
    name: 'I · моноподий',
    axiom: 'A',
    rules: { A: 'F[&FA]////[&FA]////[&FA]', F: 'FF' },
    iterations: 4,
  },
  {
    name: 'II · куст',
    axiom: 'F',
    rules: { F: 'FF-[&F^F][-F]+[&F]' },
    iterations: 4,
  },
  {
    name: 'III · фрактальный лист',
    axiom: 'F',
    rules: { F: 'F[+F]F[-F][F]' },
    iterations: 4,
  },
  {
    name: 'IV · спираль',
    axiom: 'FFA',
    rules: { F: 'F[&FA]////[&FA]', A: 'F[&FA]\\[&FA]' },
    iterations: 3,
  },
]

function expandLSystem(rule: LSystemRule): { word: string; iterations: number } {
  let word = rule.axiom
  let iterations = rule.iterations
  for (let i = 0; i < iterations; i++) {
    let next = ''
    for (const ch of word) next += rule.rules[ch] ?? ch
    word = next
    if (word.length > 24000) {
      iterations = i + 1
      break
    }
  }
  return { word, iterations }
}

function buildChromeTree(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const rule = pick(rng, L_RULES)
  const angle = rand(rng, (18 * Math.PI) / 180, (32 * Math.PI) / 180)
  const roll = rand(rng, (78 * Math.PI) / 180, (102 * Math.PI) / 180)
  const { word, iterations } = expandLSystem(rule)

  // черепашья интерпретация в 3D
  const positions: THREE.Vector3[] = []
  const quats: THREE.Quaternion[] = []
  const scales: number[] = []
  const segLen = 1
  const rBase = 0.05
  let maxDepth = 0

  const pos = new THREE.Vector3()
  const quat = new THREE.Quaternion()
  const stack: { p: THREE.Vector3; q: THREE.Quaternion; depth: number }[] = []
  let depth = 0
  const tmpQ = new THREE.Quaternion()
  const tmpV = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)

  for (const ch of word) {
    if (ch === 'F') {
      tmpV.copy(UP).applyQuaternion(quat).multiplyScalar(segLen)
      const np = pos.clone().add(tmpV)
      const len = np.distanceTo(pos)
      if (len > 1e-4) {
        positions.push(pos.clone().add(np).multiplyScalar(0.5))
        quats.push(quat.clone())
        scales.push(rBase * Math.pow(0.66, depth))
        maxDepth = Math.max(maxDepth, depth)
      }
      pos.copy(np)
    } else if (ch === '+') {
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle)
      quat.multiply(tmpQ)
    } else if (ch === '-') {
      tmpQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle)
      quat.multiply(tmpQ)
    } else if (ch === '&') {
      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle)
      quat.multiply(tmpQ)
    } else if (ch === '^') {
      tmpQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -angle)
      quat.multiply(tmpQ)
    } else if (ch === '\\') {
      tmpQ.setFromAxisAngle(UP, roll)
      quat.multiply(tmpQ)
    } else if (ch === '/') {
      tmpQ.setFromAxisAngle(UP, -roll)
      quat.multiply(tmpQ)
    } else if (ch === '[') {
      stack.push({ p: pos.clone(), q: quat.clone(), depth })
      depth++
    } else if (ch === ']') {
      const s = stack.pop()
      if (s) {
        pos.copy(s.p)
        quat.copy(s.q)
        depth = s.depth
      }
    }
  }

  const count = positions.length
  const cyl = tr.geometry(new THREE.CylinderGeometry(1, 1, 1, 5, 1, true))
  const mat = tr.material(
    std({
      color: COLORS.chrome,
      metalness: 1.0,
      roughness: 0.12,
      envMapIntensity: 1.5,
    }),
  )
  const inst = new THREE.InstancedMesh(cyl, mat, count)
  const m4 = new THREE.Matrix4()
  const scl = new THREE.Vector3()
  for (let i = 0; i < count; i++) {
    // длина единичного цилиндра = 1 → растягиваем по сегменту с запасом на стыки
    scl.set(scales[i], segLen * 1.3, scales[i])
    m4.compose(positions[i], quats[i], scl)
    inst.setMatrixAt(i, m4)
  }
  inst.instanceMatrix.needsUpdate = true
  tr.group.add(inst)

  // металл без env-карты мёртв — оживляем точечными подсветками
  const size2 = 4.5
  const lights: [number, number, number, number][] = [
    [size2, size2 * 0.9, size2, 0xffe2bd],
    [-size2 * 0.9, size2 * 1.4, -size2 * 0.6, 0xffb089],
    [-size2 * 0.4, -size2 * 0.5, size2 * 1.1, 0xfff3df],
  ]
  for (const [x, y, z, color] of lights) {
    const l = new THREE.PointLight(color, 90, 26, 2)
    l.position.set(x, y, z)
    tr.group.add(l)
  }

  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'правило', value: rule.name },
      { label: 'итераций', value: String(iterations) },
      { label: 'угол ветвления', value: `${Math.round((angle * 180) / Math.PI)}°` },
      { label: 'веточек', value: String(count) },
      { label: 'глубина ветвления', value: String(maxDepth) },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 07 · Город Вороного — джиттер-решётка, ячейки отсечением, экструзия */
/* ------------------------------------------------------------------ */

interface VCell {
  site: THREE.Vector2
  poly: THREE.Vector2[]
  height: number
}

function clipHalfPlane(poly: THREE.Vector2[], site: THREE.Vector2, other: THREE.Vector2): THREE.Vector2[] {
  // оставляем точки, ближе к site, чем к other
  const mx = (site.x + other.x) / 2
  const mz = (site.y + other.y) / 2
  const nx = site.x - other.x
  const nz = site.y - other.y
  const out: THREE.Vector2[] = []
  const side = (p: THREE.Vector2) => (p.x - mx) * nx + (p.y - mz) * nz
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const sa = side(a)
    const sb = side(b)
    if (sa >= 0) out.push(a)
    if ((sa >= 0 && sb < 0) || (sa < 0 && sb >= 0)) {
      const t = sa / (sa - sb)
      out.push(new THREE.Vector2(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))
    }
  }
  return out
}

function buildVoronoiCity(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const gridN = 6
  const spacing = 1.5
  const jitter = rand(rng, 0.42, 0.62)
  const drop = rand(rng, 0.06, 0.16)
  const half = ((gridN - 1) * spacing) / 2
  const bound = half + 1.1

  const sites: THREE.Vector2[] = []
  for (let gx = 0; gx < gridN; gx++) {
    for (let gz = 0; gz < gridN; gz++) {
      if (rng() < drop) continue
      sites.push(
        new THREE.Vector2(
          gx * spacing - half + rand(rng, -jitter, jitter),
          gz * spacing - half + rand(rng, -jitter, jitter),
        ),
      )
    }
  }

  const cells: VCell[] = []
  let maxH = 0
  for (const s of sites) {
    let poly: THREE.Vector2[] = [
      new THREE.Vector2(-bound, -bound),
      new THREE.Vector2(bound, -bound),
      new THREE.Vector2(bound, bound),
      new THREE.Vector2(-bound, bound),
    ]
    for (const o of sites) {
      if (o === s) continue
      poly = clipHalfPlane(poly, s, o)
      if (poly.length < 3) break
    }
    if (poly.length < 3) continue
    const d = s.length() / (half + 0.001)
    const h = Math.min(2.6, (0.3 + 1.6 * Math.exp(-Math.pow(d * 2.1, 2))) * rand(rng, 0.55, 1.5))
    maxH = Math.max(maxH, h)
    cells.push({ site: s, poly, height: h })
  }

  // экструзия кварталов одной геометрией
  const verts: number[] = []
  const centroid = new THREE.Vector2()
  for (const c of cells) {
    centroid.set(0, 0)
    for (const p of c.poly) centroid.add(p)
    centroid.divideScalar(c.poly.length)
    // крыша — веер из центроида (ячейка выпуклая)
    for (let i = 0; i < c.poly.length; i++) {
      const a = c.poly[i]
      const b = c.poly[(i + 1) % c.poly.length]
      verts.push(centroid.x, c.height, centroid.y, a.x, c.height, a.y, b.x, c.height, b.y)
      verts.push(centroid.x, 0, centroid.y, b.x, 0, b.y, a.x, 0, a.y)
    }
    // стены
    for (let i = 0; i < c.poly.length; i++) {
      const a = c.poly[i]
      const b = c.poly[(i + 1) % c.poly.length]
      verts.push(a.x, 0, a.y, a.x, c.height, a.y, b.x, c.height, b.y)
      verts.push(a.x, 0, a.y, b.x, c.height, b.y, b.x, 0, b.y)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.computeVertexNormals()
  tr.geometry(geo)
  tr.group.add(
    new THREE.Mesh(
      geo,
      tr.material(
        std({
          color: COLORS.boneMatte,
          roughness: 0.9,
          metalness: 0.03,
          envMapIntensity: 0.12,
        }),
      ),
    ),
  )

  // терракотовые «окна» — инстансы тонких светящихся пластин на стенах
  const winGeo = tr.geometry(new THREE.BoxGeometry(1, 1, 1))
  const winMat = tr.material(
    std({
      color: 0x241a12,
      emissive: COLORS.terraLight,
      emissiveIntensity: 2.1,
      roughness: 0.6,
    }),
  )
  const winCount = cells.reduce((acc, c) => acc + Math.min(3, c.poly.length), 0)
  const inst = new THREE.InstancedMesh(winGeo, winMat, winCount)
  const m4 = new THREE.Matrix4()
  const m4lookAt = new THREE.Matrix4()
  const zeroV = new THREE.Vector3()
  const q = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const mv = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const wallDir = new THREE.Vector3()
  const wallNrm = new THREE.Vector3()
  const toCentroid = new THREE.Vector2()
  let wi = 0
  for (const c of cells) {
    const walls = Math.min(3, c.poly.length)
    for (let k = 0; k < walls; k++) {
      const i = (k + Math.floor(rng() * c.poly.length)) % c.poly.length
      const a = c.poly[i]
      const b = c.poly[(i + 1) % c.poly.length]
      wallDir.set(b.x - a.x, 0, b.y - a.y)
      const len = wallDir.length()
      if (len < 0.4) continue
      toCentroid.set((a.x + b.x) / 2 - c.site.x, (a.y + b.y) / 2 - c.site.y)
      wallNrm.set(-wallDir.z, 0, wallDir.x).normalize()
      if (wallNrm.x * toCentroid.x + wallNrm.z * toCentroid.y > 0) wallNrm.negate()
      const w = len * rand(rng, 0.28, 0.5)
      const h = c.height * rand(rng, 0.3, 0.62)
      const y = rand(rng, 0.15, Math.max(0.16, c.height - h - 0.1)) + h / 2
      /* z-пластин вдоль нормали стены, x — вдоль стены (up-стабилизированный поворот) */
      m4lookAt.identity()
      m4lookAt.lookAt(zeroV, wallNrm, yAxis)
      q.setFromRotationMatrix(m4lookAt)
      mv.set((a.x + b.x) / 2 + wallNrm.x * 0.035, y, (a.y + b.y) / 2 + wallNrm.z * 0.035)
      scl.set(w, h, 0.03)
      m4.compose(mv, q, scl)
      inst.setMatrixAt(wi++, m4)
    }
  }
  inst.count = wi
  inst.instanceMatrix.needsUpdate = true
  tr.group.add(inst)

  // дрожь города — лёгкое непрерывное покачивание
  const phase = rand(rng, 0, Math.PI * 2)
  const anim = (t: number): void => {
    tr.group.rotation.z = Math.sin(t * 0.9 + phase) * 0.012
    tr.group.rotation.x = Math.cos(t * 0.7 + phase) * 0.008
  }

  return {
    object: tr.group,
    anim,
    dispose: tr.disposer(),
    params: [
      { label: 'кварталов', value: String(cells.length) },
      { label: 'решётка', value: `${gridN}×${gridN} · шаг ${spacing.toFixed(1)}` },
      { label: 'разброс узлов', value: `±${jitter.toFixed(2)}` },
      { label: 'самая высокая башня', value: `${maxH.toFixed(2)} ур.` },
      { label: 'светящихся окон', value: String(wi) },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 08 · Метеорит шума — fbm-смещения и расчёсанные нормали            */
/* ------------------------------------------------------------------ */

function buildMeteorite(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const detail = 5
  const octaves = randInt(rng, 3, 4)
  const freq = rand(rng, 1.1, 1.9)
  const amp = rand(rng, 0.28, 0.42)
  const comb = rand(rng, 0.25, 0.55)

  const geo = tr.geometry(new THREE.IcosahedronGeometry(1, detail))
  const pos = geo.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = fbm3(v.x * freq, v.y * freq, v.z * freq, seed & 0xffff, octaves)
    const k = 1 + amp * n
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k)
  }
  geo.computeVertexNormals()

  // «расчёс» нормалей: снос по обтекающему направлению вокруг случайной оси
  const axis = new THREE.Vector3(rand(rng, -1, 1), rand(rng, -1, 1), rand(rng, -1, 1)).normalize()
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const n2 = new THREE.Vector3()
  const swirl = new THREE.Vector3()
  for (let i = 0; i < nrm.count; i++) {
    n2.fromBufferAttribute(nrm, i)
    v.fromBufferAttribute(pos, i)
    swirl.copy(axis).cross(v).normalize()
    n2.addScaledVector(swirl, comb).normalize()
    nrm.setXYZ(i, n2.x, n2.y, n2.z)
  }
  nrm.needsUpdate = true

  tr.group.add(
    new THREE.Mesh(
      geo,
      tr.material(
        std({
          color: COLORS.stone,
          roughness: 0.9,
          metalness: 0.05,
          envMapIntensity: 0.08,
        }),
      ),
    ),
  )

  return {
    object: tr.group,
    dispose: tr.disposer(),
    params: [
      { label: 'октав шума', value: String(octaves) },
      { label: 'частота', value: freq.toFixed(2) },
      { label: 'амплитуда рельефа', value: amp.toFixed(2) },
      { label: 'сила начёса', value: comb.toFixed(2) },
      { label: 'вершин', value: pos.count.toLocaleString('ru-RU') },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* 09 · Решётка гиперболоида — кольца, прямые прутья, нить накали     */
/* ------------------------------------------------------------------ */

function buildHyperboloid(seed: number): SculptureBuild {
  const tr = new Tracker()
  const rng = mulberry32(seed)
  const R = rand(rng, 1.35, 1.75)
  const H = rand(rng, 4.2, 5.2)
  const N = randInt(rng, 44, 64)
  const twist = rand(rng, (100 * Math.PI) / 180, (165 * Math.PI) / 180)
  const strutR = rand(rng, 0.016, 0.024)

  const latMat = std({
    color: COLORS.bone,
    roughness: 0.42,
    metalness: 0.3,
    envMapIntensity: 0.35,
  })

  // прутья — инстансы цилиндров, повёрнутых по развёрстке гиперболоида
  const cyl = tr.geometry(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true))
  const inst = new THREE.InstancedMesh(cyl, tr.material(latMat), N)
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const scl = new THREE.Vector3()
  const mv = new THREE.Vector3()
  const dir = new THREE.Vector3()
  const B = new THREE.Vector3()
  const T = new THREE.Vector3()
  const yAxis = new THREE.Vector3(0, 1, 0)
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * Math.PI * 2
    const a1 = a0 + twist
    B.set(R * Math.cos(a0), -H / 2, R * Math.sin(a0))
    T.set(R * Math.cos(a1), H / 2, R * Math.sin(a1))
    dir.copy(T).sub(B)
    const len = dir.length()
    q.setFromUnitVectors(yAxis, dir.clone().normalize())
    mv.copy(B).add(T).multiplyScalar(0.5)
    scl.set(strutR, len, strutR)
    m4.compose(mv, q, scl)
    inst.setMatrixAt(k, m4)
  }
  inst.instanceMatrix.needsUpdate = true
  tr.group.add(inst)

  // кольца
  const ringGeo = tr.geometry(new THREE.TorusGeometry(R, 0.05, 8, 96))
  for (const y of [-H / 2, H / 2]) {
    const ring = tr.mesh(ringGeo, latMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = y
  }

  // внутренняя светящаяся нить
  const threadPts: THREE.Vector3[] = []
  const knotN = randInt(rng, 7, 9)
  for (let i = 0; i < knotN; i++) {
    const a = (i / knotN) * Math.PI * 2 + rand(rng, -0.3, 0.3)
    const rr = rand(rng, 0.3, R * 0.62)
    threadPts.push(
      new THREE.Vector3(
        rr * Math.cos(a),
        -H / 2 + (i / knotN) * H + rand(rng, -0.3, 0.3),
        rr * Math.sin(a),
      ),
    )
  }
  const threadCurve = new THREE.CatmullRomCurve3(threadPts, true, 'catmullrom', 0.6)
  const thread = tr.mesh(
    new THREE.TubeGeometry(threadCurve, 220, 0.028, 6, true),
    std({
      color: COLORS.ink,
      emissive: COLORS.terra,
      emissiveIntensity: 2.2,
      roughness: 0.5,
    }),
  )
  const glow = new THREE.PointLight(COLORS.terraLight, 26, 10, 2)
  tr.group.add(glow)

  const anim = (t: number): void => {
    thread.rotation.y = t * 0.22
    glow.intensity = 22 + Math.sin(t * 2.1) * 6
  }

  return {
    object: tr.group,
    anim,
    dispose: tr.disposer(),
    params: [
      { label: 'прутьев', value: String(N) },
      { label: 'закрутка', value: `${Math.round((twist * 180) / Math.PI)}°` },
      { label: 'высота', value: H.toFixed(2) },
      { label: 'радиус колец', value: R.toFixed(2) },
      { label: 'узлов нити', value: String(knotN) },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* Реестр девяти экспонатов                                           */
/* ------------------------------------------------------------------ */

export const SCULPTURES: readonly SculptureDef[] = [
  {
    id: 'klein',
    ru: 'Лента Клейна',
    latin: 'KLEIN STRIP',
    algo: 'Погружение бутылки Клейна «восьмёркой» в R³: одна сторона, ноль краёв.',
    size: 7.4,
    spin: 0.09,
    build: buildKlein,
  },
  {
    id: 'gyroid',
    ru: 'Гироид-сфера',
    latin: 'GYROID SPHERE',
    algo: 'Икосфера, рассечённая полем гироида: вершины уходят наружу и внутрь, образуя прорези.',
    size: 6.2,
    spin: 0.07,
    build: buildGyroid,
  },
  {
    id: 'mobius',
    ru: 'Мёбиусов собор',
    latin: 'MOBIUS CATHEDRAL',
    algo: 'Вложенные мёбиус-ленты, повёрнутые друг к другу скользящей симметрией.',
    size: 7.6,
    spin: 0.06,
    build: buildMobiusCathedral,
  },
  {
    id: 'flower',
    ru: 'Цветок суперформулы',
    latin: 'SUPERFORMULA BLOOM',
    algo: 'Сферическое произведение двух суперформул Гилиса: лепестки из чистой математики.',
    size: 6.6,
    spin: 0.08,
    build: buildSuperflower,
  },
  {
    id: 'knot',
    ru: 'Узел-башня',
    latin: 'KNOT TOWER',
    algo: 'Торический узел (p,q), вытянутый в вертикаль и сужающийся к вершине.',
    size: 8.4,
    spin: 0.1,
    build: buildKnotTower,
  },
  {
    id: 'tree',
    ru: 'Хром-древо',
    latin: 'CHROME TREE',
    algo: 'Трёхмерная L-система: переписывание символов становится ветвлением металла.',
    size: 9.4,
    spin: 0.05,
    build: buildChromeTree,
  },
  {
    id: 'city',
    ru: 'Город Вороного',
    latin: 'VORONOI CITY',
    algo: 'Джиттер-решётка, ячейки отсечением биссектрис, экструзия кварталов и терракотовые окна.',
    size: 9.0,
    spin: 0.055,
    build: buildVoronoiCity,
  },
  {
    id: 'meteor',
    ru: 'Метеорит шума',
    latin: 'NOISE METEORITE',
    algo: 'Фрактальный шум сжимает и растягивает кору; нормали расчёсаны встречным ветром.',
    size: 5.6,
    spin: 0.11,
    build: buildMeteorite,
  },
  {
    id: 'hyper',
    ru: 'Решётка гиперболоида',
    latin: 'HYPERBOLOID LATTICE',
    algo: 'Прямые прутья между двумя повёрнутыми кольцами плетут гиперболоид; внутри — нить накали.',
    size: 8.0,
    spin: 0.12,
    build: buildHyperboloid,
  },
]
