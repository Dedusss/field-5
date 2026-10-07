/**
 * ЭКСП. 03 «АРХИВ НЕВОЗМОЖНОГО» — общая палитра и типы.
 * Единственный светлый проект сетки: кость, терракота, чернила, тёплое молоко тумана.
 */

export const COLORS = {
  /** кость — светлая база */
  bone: 0xefe9dc,
  /** кость вторая — матовые скульптуры */
  boneMatte: 0xd8c7ad,
  /** терракота — акцент */
  terra: 0xc4592f,
  /** терракота светлая (окна, эмиссия) */
  terraLight: 0xe06a35,
  /** чернильный — тёмный контраст */
  ink: 0x2b2118,
  /** камень — метеорит */
  stone: 0x3a2f24,
  /** бронза — узел-башня */
  bronze: 0x9a6a3a,
  /** хром — древо */
  chrome: 0xe8e6e0,
  /** туман (экспоненциальный, тёплое молоко) */
  fog: 0xe8dcc4,
  /** фон кадра */
  bg: 0xefe6d4,
} as const

export const CSS = {
  bone: '#efe9dc',
  boneMatte: '#d8c7ad',
  terra: '#c4592f',
  ink: '#2b2118',
  fog: '#e8dcc4',
  bg: '#efe6d4',
} as const

/** Живой параметр экспоната для карточки (подпись русская, значение из генератора). */
export interface ParamView {
  label: string
  value: string
}

/** Карточка экспоната, собираемая из реальных переменных генерации. */
export interface ExhibitInfo {
  id: string
  index: number
  ru: string
  latin: string
  algo: string
  seedHex: string
  params: ParamView[]
}
