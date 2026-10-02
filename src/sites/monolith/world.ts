/**
 * ЭКСП. 01 «МОНОЛИТ» — общие константы мира.
 *
 * Числа сигилов продублированы в GLSL (shaders.ts, nearestSigil):
 * менять только синхронно в обоих файлах.
 */

/** Шаг решётки монолитов по z (м). */
export const CELL = 14

/** Высота пластины сигила на грани монолита. */
export const SIGIL_Y = 2.45

/** |x| грани монолита-носителя, на которой живёт сигил. */
export const SIGIL_X = 3.2

/** Z первых пяти сигилов квеста (м), стороны чередуются: +, -, +, -, +. */
export const QUEST_SIGIL_Z = [-60, -150, -260, -380, -520]

/** Сторона каньона сигила с индексом i: +1 — правая, -1 — левая. */
export function sigilSide(i: number): 1 | -1 {
  return i % 2 === 0 ? 1 : -1
}

/** Z сигила по индексу. Для i >= 5 (бесконечный режим) — каждые 90 м от -610. */
export function sigilZ(i: number): number {
  return i < QUEST_SIGIL_Z.length ? (QUEST_SIGIL_Z[i] as number) : -160 - 90 * i
}
