/**
 * ЛАБОРАТОРИЯ · FIELD·5 — математика для процедурной графики.
 *
 * Всё детерминировано: одинаковый seed — одинаковая картина.
 * Шумы без зависимостей, работают и в Canvas 2D, и в JS-части WebGL-демо.
 */

/** Полный угол в радианах. */
export const TAU = Math.PI * 2

/** Ограничивает значение отрезком [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

/** Ограничивает значение отрезком [0, 1]. */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** Линейная интерполяция: t=0 → a, t=1 → b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Плавное замедление (cubic ease-out): t=0 → 0, t=1 → 1. */
export function easeOutCubic(t: number): number {
  const x = clamp01(t)
  return 1 - Math.pow(1 - x, 3)
}

/** Плавное замедление (quintic ease-out), резче cubic. */
export function easeOutQuint(t: number): number {
  const x = clamp01(t)
  return 1 - Math.pow(1 - x, 5)
}

/** Квинтическая функция сглаживания (как fade в перлине). */
export function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

/**
 * Детерминированный ГПСЧ (mulberry32). Возвращает функцию-генератор
 * чисел из диапазона [0, 1). Один и тот же seed даёт одну и ту же
 * последовательность — основа воспроизводимых миров.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Быстрый детерминированный хеш от двух координат, результат в [0, 1). */
export function hash21(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123
  return s - Math.floor(s)
}

/**
 * Value noise 2D: сглаженная решётка псевдослучайных значений, результат в [0, 1].
 *
 * @param octaves число октав: 1 — чистый шум, больше — фрактальная сумма
 *   (fbm) с частотой ×2 и амплитудой ×0.5 на октаву. 3–5 октав дают
 *   «облачные» поля для градиентов и полей потока.
 */
export function valueNoise2D(x: number, y: number, octaves = 1): number {
  if (octaves <= 1) {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const u = fade(x - xi)
    const v = fade(y - yi)
    const a = hash21(xi, yi)
    const b = hash21(xi + 1, yi)
    const c = hash21(xi, yi + 1)
    const d = hash21(xi + 1, yi + 1)
    return lerp(lerp(a, b, u), lerp(c, d, u), v)
  }
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise2D(x * freq, y * freq)
    norm += amp
    amp *= 0.5
    freq *= 2
  }
  return sum / norm
}
