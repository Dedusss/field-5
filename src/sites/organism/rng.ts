/**
 * ЭКСП. 05 «ОРГАНИЗМ» — детерминированная случайность.
 * Форма организма полностью выводится из данных в БД: одна и та же мутация
 * всегда даёт одну и ту же ветвь у всех посетителей во всех вкладках.
 */

/** Классический mulberry32 — быстрый seeded PRNG */
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

/** Целочисленный хеш (для бусин-шрамов пульсов) */
export function hash32(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
  return (h ^ (h >>> 16)) >>> 0
}
