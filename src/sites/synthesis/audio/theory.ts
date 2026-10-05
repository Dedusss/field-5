import type { SeedType } from '../types'
import { mulberry32 } from '../util'

export const BPM = 92
export const STEPS_PER_BAR = 16
export const BARS_PER_CHORD = 8
/** Корни аккордов цикла: Am — F — C — G (A2 / F2 / C3 / G2). */
export const CHORD_ROOTS = [45, 41, 48, 43] as const
export const CHORD_NAMES = ['Am', 'F', 'C', 'G'] as const
/** Длительность шестнадцатой доли в секундах. */
export const STEP_DURATION = 60 / BPM / 4

/** Пентатоника ля-минор (A C D E G) в диапазоне A2..A5. */
export const SCALE: readonly number[] = [45, 48, 50, 52, 55, 57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81]

/** Возможные интервалы семени от корня аккорда. */
const INTERVALS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24] as const

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12)
}

export function midiToName(m: number): string {
  const n = Math.round(m)
  return `${NOTE_NAMES[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`
}

/** Квантование к ближайшей ноте пентатоники. */
export function quantizeToScale(m: number): number {
  let best = SCALE[0]
  let bestD = Infinity
  for (const s of SCALE) {
    const d = Math.abs(s - m)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

/** Евклидово распределение k ударов по n шагам (ротация по seed). */
export function plantEuclid(seed: number, type: SeedType): { k: number; pattern: boolean[] } {
  const rng = mulberry32((seed ^ 0x9e37) >>> 0)
  const lo = type === 'pluck' ? 3 : 5
  const hi = type === 'pluck' ? 8 : 11
  const k = lo + Math.floor(rng() * (hi - lo + 1))
  const n = STEPS_PER_BAR
  const pattern: boolean[] = new Array<boolean>(n).fill(false)
  let bucket = 0
  for (let i = 0; i < n; i++) {
    bucket += k
    if (bucket >= n) {
      bucket -= n
      pattern[i] = true
    }
  }
  const rot = Math.floor(rng() * n)
  const rotated = pattern.slice(rot).concat(pattern.slice(0, rot))
  return { k, pattern: rotated }
}

/** Интервал семени (в полутонах) от корня текущего аккорда. */
export function plantInterval(seed: number): number {
  const rng = mulberry32((seed ^ 0x77aa) >>> 0)
  return INTERVALS[Math.floor(rng() * INTERVALS.length)]
}
