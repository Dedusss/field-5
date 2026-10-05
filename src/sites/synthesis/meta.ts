import type { SeedType } from './types'

export interface SeedMeta {
  id: SeedType
  label: string
  latin: string
  hint: string
  color: string
  rgb: readonly [number, number, number]
  description: string
}

export const SEEDS: readonly SeedMeta[] = [
  {
    id: 'drone',
    label: 'ДРОН',
    latin: 'DRONE',
    hint: '1',
    color: '#e84fd0',
    rgb: [232, 79, 208],
    description: 'тягучий корень аккорда',
  },
  {
    id: 'pluck',
    label: 'ЩИПОК',
    latin: 'PLUCK',
    hint: '2',
    color: '#b6f34d',
    rgb: [182, 243, 77],
    description: 'евклидовая искра',
  },
  {
    id: 'choir',
    label: 'ХОР',
    latin: 'CHOIR',
    hint: '3',
    color: '#f6eef8',
    rgb: [246, 238, 248],
    description: 'далёкий формантный голос',
  },
  {
    id: 'hit',
    label: 'УДАР',
    latin: 'PERC',
    hint: '4',
    color: '#ff6ec9',
    rgb: [255, 110, 201],
    description: 'мембрана земли',
  },
]

export const SEED_MAP: Record<SeedType, SeedMeta> = {
  drone: SEEDS[0],
  pluck: SEEDS[1],
  choir: SEEDS[2],
  hit: SEEDS[3],
}

export const MAX_PLANTS = 12
/** Доля высоты сцены, на которой проходит линия горизонта (почва ниже). */
export const HORIZON = 0.78
