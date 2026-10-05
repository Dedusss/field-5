'use client'

import { useEffect, useState } from 'react'
import { plantEuclid } from '../audio/theory'
import { SEED_MAP } from '../meta'
import type { PlantRuntime } from '../render/garden'

export interface LabelSnapshot {
  note: string
  chord: string
  muted: boolean
}

/** Мини-лейбл растения при наведении: тип, нота, евклид-паттерн, удаление. */
export default function PlantLabel({
  plant,
  readInfo,
  onRemove,
}: {
  plant: PlantRuntime
  readInfo: (plant: PlantRuntime) => LabelSnapshot
  onRemove: () => void
}) {
  const meta = SEED_MAP[plant.data.type]
  const { pattern } = plantEuclid(plant.data.seed, plant.data.type)

  const [snap, setSnap] = useState<LabelSnapshot>({
    note: '—',
    chord: '',
    muted: plant.data.muted,
  })

  useEffect(() => {
    const update = () => setSnap(readInfo(plant))
    const t0 = setTimeout(update, 80)
    const t = setInterval(update, 600)
    return () => {
      clearTimeout(t0)
      clearInterval(t)
    }
  }, [readInfo, plant])

  const left = plant.data.nx * 100
  const topOffset = plant.skeleton.height + 34

  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2"
      style={{ left: `${left}%`, top: `calc(${plant.data.ny * 100}% - ${topOffset}px)` }}
    >
      <div
        className="flex flex-col gap-1.5 rounded-md border border-white/15 border-l-2 bg-[#120a14]/90 px-3 py-2 font-mono backdrop-blur-sm"
        style={{ borderLeftColor: meta.color }}
      >
        <div className="flex items-center gap-2 whitespace-nowrap text-[10px] tracking-[0.14em]">
          <span style={{ color: meta.color }}>{meta.label}</span>
          <span className="text-[#f6eef8]/75">{snap.note}</span>
          <span className="text-[#f6eef8]/35">{snap.chord}</span>
          {snap.muted && <span className="text-[#f6eef8]/40">· ТИХО</span>}
        </div>
        <div className="flex items-center gap-[3px]">
          {pattern.map((on, i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: on ? meta.color : 'rgba(246,238,248,0.14)' }}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Удалить растение"
        className="pointer-events-auto absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#e84fd0]/60 bg-[#120a14] text-[9px] text-[#e84fd0] transition-colors hover:bg-[#e84fd0] hover:text-[#120a14]"
      >
        ✕
      </button>
    </div>
  )
}
