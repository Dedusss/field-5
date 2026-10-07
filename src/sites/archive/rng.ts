/**
 * Сидированный ГПСЧ (mulberry32) + детерминированный value-noise 3D / fbm.
 * Каждая скульптура строится исключительно от своего семени — «пересев» воспроизводим.
 */

export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Равномерное в [a, b). */
export function rand(rng: RNG, a: number, b: number): number {
  return a + (b - a) * rng()
}

/** Целое в [a, b]. */
export function randInt(rng: RNG, a: number, b: number): number {
  return Math.floor(rand(rng, a, b + 1 - 1e-9))
}

/** Случайный элемент массива. */
export function pick<T>(rng: RNG, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]
}

/** Семя в hex-виде (8 знаков) для карточки экспоната. */
export function seedHex(seed: number): string {
  return (seed >>> 0).toString(16).padStart(8, '0')
}

/** Стабильное 32-битное семя из строки (id экспоната + номер пересева). */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) >>> 0
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}

/* ------------------------------------------------------------------ */
/* Value noise 3D (хеш решётки + трилинейная интерполяция) и fbm      */
/* ------------------------------------------------------------------ */

function hash3(ix: number, iy: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1274126177) ^ Math.imul(seed, 9728)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t)
}

/** Value noise в [-1, 1]. */
export function noise3(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const fz = smooth(z - iz)

  const c000 = hash3(ix, iy, iz, seed)
  const c100 = hash3(ix + 1, iy, iz, seed)
  const c010 = hash3(ix, iy + 1, iz, seed)
  const c110 = hash3(ix + 1, iy + 1, iz, seed)
  const c001 = hash3(ix, iy, iz + 1, seed)
  const c101 = hash3(ix + 1, iy, iz + 1, seed)
  const c011 = hash3(ix, iy + 1, iz + 1, seed)
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed)

  const x00 = c000 + (c100 - c000) * fx
  const x10 = c010 + (c110 - c010) * fx
  const x01 = c001 + (c101 - c001) * fx
  const x11 = c011 + (c111 - c011) * fx
  const y0 = x00 + (x10 - x00) * fy
  const y1 = x01 + (x11 - x01) * fy
  return (y0 + (y1 - y0) * fz) * 2 - 1
}

/** Фрактальный шум, октавы с удвоением частоты и затуханием 0.5. Возвращает [-1, 1]-ish. */
export function fbm3(x: number, y: number, z: number, seed: number, octaves: number): number {
  let sum = 0
  let amp = 1
  let norm = 0
  let f = 1
  for (let o = 0; o < octaves; o++) {
    sum += noise3(x * f, y * f, z * f, seed + o * 1013) * amp
    norm += amp
    amp *= 0.5
    f *= 2.03
  }
  return sum / norm
}
