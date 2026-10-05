'use client'

import { SEEDS } from '../meta'

/** Вход-гейт: AudioContext создаётся только по клику «Войти в сад». */
export default function Gate({ onEnter, onExit }: { onEnter: () => void; onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0c0610]/90 via-[#120a14]/70 to-[#0c0610]/92 px-6 text-center">
      <button
        type="button"
        onClick={onExit}
        className="absolute left-3 top-3 flex h-8 items-center rounded-sm border border-white/15 bg-[#120a14]/60 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-[#f6eef8]/70 backdrop-blur-sm transition-colors hover:border-[#e84fd0]/60 hover:text-[#f6eef8] sm:left-5 sm:top-5"
      >
        ← Поле опытов
      </button>

      <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-[#e84fd0]/90">
        Эксп. 02 · генеративный звуковой сад
      </p>
      <h1 className="font-display text-[15vw] font-semibold leading-none tracking-tight text-[#f6eef8] sm:text-7xl">
        СИНТЕЗ
      </h1>
      <p className="-mt-2 font-serif text-lg italic text-[#f6eef8]/80 sm:text-2xl">
        сад звуков, который вы выращиваете сами
      </p>
      <p className="max-w-md text-sm leading-relaxed text-[#f6eef8]/60">
        Ни одного аудиофайла: каждый звук рождается из осциляторов, фильтров и свёртки прямо в
        браузере. Кликайте по ночной почве — из семян вырастут растения, и каждое сыграет свою
        партию. Позиция растения в саду — это его панорама и реверб.
      </p>
      <div className="flex items-center gap-3">
        {SEEDS.map((s) => (
          <span key={s.id} className="flex items-center gap-1.5" title={s.label}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#f6eef8]/45">
              {s.label}
            </span>
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="motion-safe:animate-pulse mt-3 border border-[#e84fd0]/50 px-10 py-4 font-mono text-xs uppercase tracking-[0.34em] text-[#e84fd0] transition-colors hover:bg-[#e84fd0] hover:text-[#120a14] motion-reduce:animate-none"
      >
        Войти в сад
      </button>
      <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#f6eef8]/35">
        звук включится после нажатия · наушники рекомендуются
      </p>
    </div>
  )
}
