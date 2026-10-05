export type SeedType = 'drone' | 'pluck' | 'choir' | 'hit'

export interface PlantData {
  id: number
  seed: number
  type: SeedType
  /** 0..1 — нормализованная позиция по ширине сцены */
  nx: number
  /** 0..1 — нормализованная позиция по высоте (полоса почвы) */
  ny: number
  muted: boolean
}

export interface NoteEvent {
  plantId: number
  /** время в системе AudioContext */
  time: number
  velocity: number
  ghost: boolean
}

export interface Bands {
  bass: number
  lowMid: number
  mid: number
  high: number
}

export interface AudioFrame extends Bands {
  spectrum: Uint8Array | null
}
