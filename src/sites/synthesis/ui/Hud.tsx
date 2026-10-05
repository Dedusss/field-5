'use client'

import type { RefObject } from 'react'
import { SEEDS } from '../meta'
import type { SeedType } from '../types'
import SeedIcon from './SeedIcon'

interface HudProps {
  plantCount: number
  maxPlants: number
  muted: boolean
  onToggleMute: () => void
  selected: SeedType
  onSelect: (s: SeedType) => void
  weather: number
  onWeather: (v: number) => void
  onInfo: () => void
  onExit: () => void
  spectrumRef: RefObject<HTMLCanvasElement | null>
}

export default function Hud({
  plantCount,
  maxPlants,
  muted,
  onToggleMute,
  selected,
  onSelect,
  weather,
  onWeather,
  onInfo,
  onExit,
  spectrumRef,
}: HudProps) {
  const badge =
    'flex h-8 items-center rounded-sm border border-white/10 bg-[#120a14]/60 px-2.5 font-mono text-[10px] tracking-[0.16em] text-[#f6eef8]/70 backdrop-blur-sm'
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {/* слева сверху: выход и маркер эксперимента */}
      <div className="absolute left-3 top-3 flex items-center gap-2 sm:left-5 sm:top-5">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto flex h-8 items-center rounded-sm border border-white/15 bg-[#120a14]/60 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f6eef8]/70 backdrop-blur-sm transition-colors hover:border-[#e84fd0]/60 hover:text-[#f6eef8]"
        >
          ← Поле опытов
        </button>
        <span className="hidden px-1 font-mono text-[10px] uppercase tracking-[0.3em] text-[#f6eef8]/40 md:block">
          Синтез · Эксп. 02
        </span>
      </div>

      {/* справа сверху: BPM, счётчик, MUTE, инфо */}
      <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-5 sm:top-5 sm:gap-2">
        <span className={badge}>92 BPM</span>
        <span className={badge}>
          {plantCount}/{maxPlants}
        </span>
        <button
          type="button"
          onClick={onToggleMute}
          title="Пробел"
          className={`pointer-events-auto flex h-8 items-center rounded-sm border px-2.5 font-mono text-[10px] uppercase tracking-[0.2em] backdrop-blur-sm transition-colors ${
            muted
              ? 'border-[#e84fd0] bg-[#e84fd0]/20 text-[#f6eef8]'
              : 'border-white/10 bg-[#120a14]/60 text-[#f6eef8]/70 hover:border-[#e84fd0]/50'
          }`}
        >
          Mute
        </button>
        <button
          type="button"
          onClick={onInfo}
          title="О саде"
          aria-label="О саде"
          className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-sm border border-white/10 bg-[#120a14]/60 font-mono text-[12px] text-[#f6eef8]/70 backdrop-blur-sm transition-colors hover:border-[#e84fd0]/50 hover:text-[#f6eef8]"
        >
          ?
        </button>
      </div>

      {/* снизу по центру: панель семян */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 sm:bottom-5">
        <div className="flex gap-1 rounded-lg border border-white/10 bg-[#120a14]/70 p-1 backdrop-blur-md">
          {SEEDS.map((s, i) => {
            const active = selected === s.id
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelect(s.id)}
                title={`${s.label} — ${s.description} (клавиша ${s.hint})`}
                className={`pointer-events-auto flex w-12 flex-col items-center gap-1 rounded-md border py-1.5 transition-colors sm:w-[78px] sm:py-2 ${
                  active
                    ? 'border-[#e84fd0]/70 bg-[#e84fd0]/15 text-[#f6eef8]'
                    : 'border-transparent text-[#f6eef8]/50 hover:border-white/20 hover:text-[#f6eef8]/85'
                }`}
              >
                <SeedIcon type={s.id} className="h-5 w-5" />
                <span className="hidden font-mono text-[9px] tracking-[0.16em] sm:block">
                  {s.label}
                </span>
                <span
                  className={`font-mono text-[8px] ${active ? 'text-[#e84fd0]' : 'text-[#f6eef8]/30'}`}
                >
                  {s.hint}
                </span>
                <span className="sr-only">{`семя ${i + 1}`}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* снизу слева: мини-спектр */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 sm:bottom-5 sm:left-5">
        <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f6eef8]/35">
          Спектр
        </span>
        <canvas
          ref={spectrumRef}
          width={240}
          height={72}
          className="h-6 w-[72px] rounded-sm border border-white/10 bg-[#120a14]/50 sm:h-[36px] sm:w-[120px]"
        />
      </div>

      {/* снизу справа: погода */}
      <div className="absolute bottom-3 right-3 w-20 sm:bottom-5 sm:right-5 sm:w-[150px]">
        <div className="mb-0.5 flex items-baseline justify-between">
          <span className="font-mono text-[8px] uppercase tracking-[0.3em] text-[#f6eef8]/35">
            Погода
          </span>
          <span className="font-mono text-[9px] text-[#e84fd0]">{Math.round(weather * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={weather}
          onChange={(e) => onWeather(Number(e.target.value))}
          className="syn-range pointer-events-auto w-full"
          aria-label="Погода: ветер и плотность призрачных нот"
        />
      </div>
    </div>
  )
}
