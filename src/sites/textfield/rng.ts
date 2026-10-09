/** Детерминированный ГПСЧ mulberry32 — вся случайность сцены воспроизводима по seed. */
export class Rng {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let t = this.state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  /** [-1, 1) */
  signed(): number {
    return this.range(-1, 1)
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }
}

export const ACT_SEEDS = [0x7a04f1, 0x7b04f2, 0x7c04f3, 0x7d04f4] as const
