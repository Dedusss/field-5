/**
 * Собственный физический движок ЭКСП. 04 (никаких библиотек).
 * Глиф = AABB-тело с массой, пропорциональной площади очерка.
 * Конвейер шага: интеграция → broad-фаза (равномерная сетка ячеек) →
 * narrow-фаза (AABB-пары) → позиционная релаксация + импульс по нормали →
 * границы → учёт сна. Движок детерминирован: никакой случайности внутри.
 */

import type { Rng } from './rng'
import { clamp } from './types'

export interface Body {
  id: number
  char: string
  size: number
  weight: number
  color: string
  /** центр */
  x: number
  y: number
  /** полуразмеры AABB (от метрик очерка глифа) */
  hw: number
  hh: number
  vx: number
  vy: number
  /** косметический наклон (физика — AABB) */
  angle: number
  angleVel: number
  mass: number
  invMass: number
  restitution: number
  /** доля тангенциальной скорости, сохраняемой при трении */
  friction: number
  sleeping: boolean
  sleepTimer: number
  /** ещё не родился ( staggered-появление акта I / пользовательский текст) */
  dormant: boolean
  spawnDelay: number
  age: number
  dragged: boolean
  /** красный акцент глифа */
  accent: boolean
}

export interface WorldBounds {
  /** линия пола (нижняя граница тел) */
  floorY: number
  leftX: number
  rightX: number
  /** верхняя граница (при антигравитации — 0) */
  ceilingY: number
}

interface Contact {
  a: Body
  b: Body
}

const WAKE_IMPACT_SPEED = 130
const SLOP = 0.4

export class World {
  bodies: Body[] = []
  gravity = 2000
  bounds: WorldBounds = { floorY: 600, leftX: 0, rightX: 1000, ceilingY: -800 }
  autoSleep = true
  sleepSpeed = 15
  sleepFramesNeeded = 46
  /** статистика последнего шага, мс */
  stepMs = 0

  private grid = new Map<number, Body[]>()
  private nextId = 1
  private contacts: Contact[] = []
  /** адаптация под просадки: если шаги тяжёлые, тела засыпают охотнее */
  private heavyFrames = 0

  setBounds(b: Partial<WorldBounds>): void {
    Object.assign(this.bounds, b)
  }

  add(params: {
    char: string
    size: number
    weight: number
    color: string
    x: number
    y: number
    hw: number
    hh: number
    vx?: number
    vy?: number
    restitution?: number
    friction?: number
    spawnDelay?: number
    accent?: boolean
  }): Body {
    const area = params.hw * params.hh * 4
    const mass = Math.max(0.12, area / 12000)
    const body: Body = {
      id: this.nextId++,
      char: params.char,
      size: params.size,
      weight: params.weight,
      color: params.color,
      x: params.x,
      y: params.y,
      hw: params.hw,
      hh: params.hh,
      vx: params.vx ?? 0,
      vy: params.vy ?? 0,
      angle: 0,
      angleVel: 0,
      mass,
      invMass: 1 / mass,
      restitution: params.restitution ?? 0.32,
      friction: params.friction ?? 0.88,
      sleeping: false,
      sleepTimer: 0,
      dormant: params.spawnDelay !== undefined && params.spawnDelay > 0,
      spawnDelay: params.spawnDelay ?? 0,
      age: 0,
      dragged: false,
      accent: params.accent ?? false,
    }
    this.bodies.push(body)
    return body
  }

  remove(body: Body): void {
    const i = this.bodies.indexOf(body)
    if (i >= 0) this.bodies.splice(i, 1)
  }

  clear(): void {
    this.bodies.length = 0
    this.contacts.length = 0
    this.grid.clear()
  }

  wake(body: Body): void {
    if (!body.sleeping) return
    body.sleeping = false
    body.sleepTimer = 0
  }

  wakeAll(): void {
    for (const b of this.bodies) this.wake(b)
  }

  /** Импульс всем телам (встряска): пробуждает и подкидывает. */
  shake(rng: Rng, power = 1): void {
    for (const b of this.bodies) {
      this.wake(b)
      b.vy -= rng.range(380, 980) * power
      b.vx += rng.signed() * 320 * power
      b.angleVel += rng.signed() * 1.6
      b.sleepTimer = 0
    }
  }

  /** «Вздох» кучи: мягкий микро-импульс нижним телам. */
  sigh(rng: Rng, floorY: number): void {
    for (const b of this.bodies) {
      if (b.y < floorY - b.hh * 2.2) continue
      if (rng.next() < 0.45) {
        this.wake(b)
        b.vy -= rng.range(50, 150)
        b.vx += rng.signed() * 22
        b.sleepTimer = 0
      }
    }
  }

  get awakeCount(): number {
    let n = 0
    for (const b of this.bodies) if (!b.sleeping && !b.dormant) n++
    return n
  }

  /** Быстрый headless-прогон физики (мгновенная укладка кучи для reduced-motion). */
  settle(steps: number, dt = 1 / 60): void {
    for (const b of this.bodies) b.dormant = false
    for (let i = 0; i < steps; i++) this.step(dt)
    for (const b of this.bodies) {
      b.vx = 0
      b.vy = 0
      b.angleVel = 0
      b.sleeping = true
    }
  }

  step(dt: number): void {
    const t0 = performance.now()
    const bodies = this.bodies
    const n = bodies.length

    // — сон целиком: если мир замер, пропускаем шаг (рендер продолжается)
    let anyAwake = false
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      if (b.dormant) {
        b.age += dt
        if (b.age >= b.spawnDelay) b.dormant = false
        else continue
      }
      if (!b.sleeping) {
        anyAwake = true
        break
      }
    }
    if (!anyAwake) {
      this.stepMs = performance.now() - t0
      return
    }

    const g = this.gravity
    const airK = Math.exp(-0.06 * dt)

    // 1. Интеграция
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      if (b.dormant) {
        b.age += dt
        if (b.age >= b.spawnDelay) b.dormant = false
        continue
      }
      if (b.sleeping) continue
      b.vy += g * dt
      b.vx *= airK
      b.vy *= airK
      b.x += b.vx * dt
      b.y += b.vy * dt
      // косметический наклон
      b.angle += b.angleVel * dt
      b.angleVel *= Math.exp(-3.2 * dt)
      const sp = Math.abs(b.vx) + Math.abs(b.vy)
      if (sp < 60) b.angle *= Math.exp(-2.4 * dt)
      if (b.angle > 0.6) b.angle = 0.6
      else if (b.angle < -0.6) b.angle = -0.6
    }

    // 2. Broad-фаза: равномерная сетка
    let maxW = 48
    for (let i = 0; i < n; i++) {
      const w = bodies[i].hw * 2
      if (w > maxW) maxW = w
    }
    const cell = maxW * 1.05
    const grid = this.grid
    grid.clear()
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      if (b.dormant) continue
      const gx = Math.floor(b.x / cell) + 512
      const gy = Math.floor(b.y / cell) + 512
      const key = gx * 2048 + gy
      const list = grid.get(key)
      if (list) list.push(b)
      else grid.set(key, [b])
    }

    // 3. Пары кандидатов (каждая пара ровно один раз)
    const contacts = this.contacts
    contacts.length = 0
    for (const [key, list] of grid) {
      const ln = list.length
      for (let i = 0; i < ln; i++) {
        const a = list[i]
        for (let j = i + 1; j < ln; j++) {
          const b = list[j]
          if (a.sleeping && b.sleeping) continue
          contacts.push({ a, b })
        }
      }
      const right = grid.get(key + 2048)
      if (right) this.crossPairs(list, right, contacts)
      const bl = grid.get(key + 2047)
      if (bl) this.crossPairs(list, bl, contacts)
      const bottom = grid.get(key + 1);
      if (bottom) this.crossPairs(list, bottom, contacts)
      const br = grid.get(key + 2049);
      if (br) this.crossPairs(list, br, contacts)
    }

    // 4. Позиционная релаксация + импульс (итеративно)
    const iterations = 3
    for (let it = 0; it < iterations; it++) {
      const positional = it < 2
      for (let ci = 0; ci < contacts.length; ci++) {
        const { a, b } = contacts[ci]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const px = a.hw + b.hw - Math.abs(dx)
        if (px <= 0) continue
        const py = a.hh + b.hh - Math.abs(dy)
        if (py <= 0) continue
        const imA = a.sleeping ? 0 : a.invMass
        const imB = b.sleeping ? 0 : b.invMass
        const imSum = imA + imB
        if (imSum === 0) continue

        // будим спящего соседа при заметном взаимодействии
        this.wakeOnContact(a, b)

        let nx = 0
        let ny = 0
        let pen = 0
        if (px < py) {
          nx = dx >= 0 ? 1 : -1
          pen = px
        } else {
          ny = dy >= 0 ? 1 : -1
          pen = py
        }

        if (positional) {
          const corr = ((pen - SLOP) * 0.42) / imSum
          if (corr > 0) {
            a.x -= nx * corr * imA
            a.y -= ny * corr * imA
            b.x += nx * corr * imB
            b.y += ny * corr * imB
          }
        }

        // импульс по нормали
        const rvx = b.vx - a.vx
        const rvy = b.vy - a.vy
        const vn = rvx * nx + rvy * ny
        if (vn < 0) {
          const e = Math.min(a.restitution, b.restitution)
          const j = (-(1 + e) * vn) / imSum
          if (j > 0.0001) {
            a.vx -= j * nx * imA
            a.vy -= j * ny * imA
            b.vx += j * nx * imB
            b.vy += j * ny * imB
            // трение: гасим тангенциальную составляющую
            const tx = -ny
            const ty = nx
            const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty
            const mu = Math.min(a.friction, b.friction)
            const jt = clamp(-vt * 0.55, -j * (1 - mu), j * (1 - mu))
            a.vx -= jt * tx * imA
            a.vy -= jt * ty * imA
            b.vx += jt * tx * imB
            b.vy += jt * ty * imB
            // косметика: лёгкое вращение от касательного скольжения
            const spin = vt * 0.0022
            a.angleVel += spin
            b.angleVel -= spin
          }
        }
      }
    }

    // 5. Границы мира
    const { floorY, leftX, rightX, ceilingY } = this.bounds
    for (let i = 0; i < n; i++) {
      const b = bodies[i]
      if (b.dormant || b.sleeping) continue
      if (b.y + b.hh > floorY) {
        b.y = floorY - b.hh
        if (b.vy > 0) {
          b.vy = Math.abs(b.vy) > 60 ? -b.vy * b.restitution : 0
          b.angleVel += b.vx * 0.0016
        }
        b.vx *= 0.9
      }
      if (b.x - b.hw < leftX) {
        b.x = leftX + b.hw
        if (b.vx < 0) b.vx = -b.vx * b.restitution
      } else if (b.x + b.hw > rightX) {
        b.x = rightX - b.hw
        if (b.vx > 0) b.vx = -b.vx * b.restitution
      }
      if (ceilingY > -500 && b.y - b.hh < ceilingY) {
        b.y = ceilingY + b.hh
        if (b.vy < 0) {
          b.vy = Math.abs(b.vy) > 60 ? -b.vy * b.restitution : 0
        }
      }
    }

    // 6. Учёт сна
    if (this.autoSleep) {
      for (let i = 0; i < n; i++) {
        const b = bodies[i]
        if (b.dormant || b.dragged || b.sleeping) continue
        const speed2 = b.vx * b.vx + b.vy * b.vy
        if (speed2 < this.sleepSpeed * this.sleepSpeed) {
          b.sleepTimer++
          if (b.sleepTimer > this.sleepFramesNeeded) {
            b.sleeping = true
            b.vx = 0
            b.vy = 0
            b.angleVel = 0
          }
        } else {
          b.sleepTimer = 0
        }
      }
    }

    // 7. Адаптация под производительность
    const ms = performance.now() - t0
    this.stepMs = ms
    if (ms > 7) {
      this.heavyFrames++
      if (this.heavyFrames > 30) {
        this.sleepFramesNeeded = Math.max(18, this.sleepFramesNeeded - 8)
        this.sleepSpeed = Math.min(34, this.sleepSpeed + 4)
        this.heavyFrames = 0
      }
    } else if (this.heavyFrames > 0) {
      this.heavyFrames--
    }
  }

  private crossPairs(listA: Body[], listB: Body[], out: Contact[]): void {
    for (let i = 0; i < listA.length; i++) {
      const a = listA[i]
      for (let j = 0; j < listB.length; j++) {
        const b = listB[j]
        if (a.sleeping && b.sleeping) continue
        out.push({ a, b })
      }
    }
  }

  private wakeOnContact(a: Body, b: Body): void {
    if (a.sleeping && !b.sleeping) {
      if (Math.abs(b.vx) + Math.abs(b.vy) > WAKE_IMPACT_SPEED) this.wake(a)
    } else if (b.sleeping && !a.sleeping) {
      if (Math.abs(a.vx) + Math.abs(a.vy) > WAKE_IMPACT_SPEED) this.wake(b)
    }
  }
}

/** Пружинная тяга захваченного тела к курсору с инерцией (учитывает массу). */
export function applyDragSpring(
  body: Body,
  tx: number,
  ty: number,
  dt: number,
): void {
  const k = 340
  const c = 17
  const inv = 1 / clamp(Math.pow(body.mass, 0.3), 0.35, 2.6)
  body.vx += ((tx - body.x) * k - body.vx * c) * inv * dt
  body.vy += ((ty - body.y) * k - body.vy * c) * inv * dt
  // наклон при драге — от горизонтальной скорости
  const target = clamp(body.vx * 0.00045, -0.34, 0.34)
  body.angle += (target - body.angle) * clamp(dt * 8, 0, 1)
}
