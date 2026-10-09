/** Общие константы и типы ЭКСП. 04 «ТЕКСТОВОЕ ПОЛЕ». */

export const PALETTE = {
  paper: '#f4f1ea',
  ink: '#17140f',
  red: '#d43d1f',
  gray: '#8a867c',
} as const

export const ACT_COUNT = 4

export const ACT_META: ReadonlyArray<{
  roman: string
  name: string
  label: string
  hint: string
}> = [
  {
    roman: 'I',
    name: 'ПАДЕНИЕ',
    label: 'АКТ I — ПАДЕНИЕ',
    hint: 'буквы обладают массой — попробуйте поднять любую',
  },
  {
    roman: 'II',
    name: 'ТКАНЬ',
    label: 'АКТ II — ТКАНЬ',
    hint: 'резкое движение рвёт ткань',
  },
  {
    roman: 'III',
    name: 'ВЕТЕР',
    label: 'АКТ III — ВЕТЕР',
    hint: 'курсор — ветер; переключайте силу слева внизу',
  },
  {
    roman: 'IV',
    name: 'ВАШ ГОЛОС',
    label: 'АКТ IV — ВАШ ГОЛОС',
    hint: 'напишите слово — оно станет материей',
  },
]

/** Позиция и скорость указателя в координатах канваса (CSS-пиксели). */
export interface PointerState {
  x: number
  y: number
  /** скорость, px/s, сглаженная по последним сэмплам */
  vx: number
  vy: number
  down: boolean
  inside: boolean
}

export interface Vec2 {
  x: number
  y: number
}

/** Санитизация пользовательского текста: буквы, цифры, пробел, базовая пунктуация. */
export function sanitizeUserText(raw: string): string {
  return raw.replace(/[^0-9A-Za-zА-Яа-яЁё .,!?()«»"'\-—:;]/g, '').slice(0, 90)
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Линия «пола» всех актов — 86% высоты сцены. */
export function floorLineY(h: number): number {
  return Math.round(h * 0.86)
}
