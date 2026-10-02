'use client'

import type { RefObject } from 'react'

interface HudProps {
  depthRef: RefObject<HTMLSpanElement | null>
  ascendRef: RefObject<HTMLDivElement | null>
  captured: number
  flashKey: number
  hintVisible: boolean
  touchHint: boolean
  onInfo: () => void
  onExit: () => void
}

const DOT = 'h-2 w-2 rounded-full border transition-[background-color,box-shadow,border-color] duration-500'

export default function Hud({
  depthRef,
  ascendRef,
  captured,
  flashKey,
  hintVisible,
  touchHint,
  onInfo,
  onExit,
}: HudProps) {
  const quest = Math.min(captured, 5)
  return (
    <div className="pointer-events-none absolute inset-0 z-10 font-mono select-none">
      {/* выход и инфо */}
      <div className="absolute left-4 top-4 sm:left-6 sm:top-6 [animation:hudIn_0.9s_ease-out_both]">
        <button
          type="button"
          onClick={onExit}
          className="pointer-events-auto rounded-sm border border-[#f2e3c6]/15 px-3.5 py-2 text-[10px] uppercase tracking-[0.22em] text-[#b5ac9e] transition-colors duration-300 hover:border-[#f2e3c6]/45 hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
        >
          ← Поле опытов
        </button>
      </div>
      <div className="absolute right-4 top-4 sm:right-6 sm:top-6 [animation:hudIn_0.9s_ease-out_both]">
        <button
          type="button"
          onClick={onInfo}
          aria-label="Об эксперименте"
          aria-haspopup="dialog"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-[#f2e3c6]/15 text-sm text-[#b5ac9e] transition-colors duration-300 hover:border-[#d9a05b]/70 hover:text-[#d9a05b] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
        >
          ?
        </button>
      </div>

      {/* стартовая подсказка */}
      {hintVisible && (
        <p className="absolute left-1/2 top-6 w-max max-w-[86vw] -translate-x-1/2 text-center text-[9px] uppercase leading-relaxed tracking-[0.34em] text-[#8b8175] [animation:hintFade_7s_ease-out_forwards] sm:text-[10px]">
          {touchHint ? 'Веди пальцем — идти · Касание — светоч' : 'Скролл — идти · Курсор — светоч'}
        </p>
      )}

      {/* глубина */}
      <div
        className="absolute bottom-4 left-4 text-[10px] uppercase tracking-[0.3em] sm:bottom-6 sm:left-6 sm:text-[11px] [animation:hudIn_1.1s_0.2s_ease-out_both]"
        aria-label="Пройденная глубина"
      >
        <span className="text-[#8b8175]">Глубина </span>
        <span data-depth ref={depthRef} className="text-[#f2e3c6] tabular-nums">
          000
        </span>
        <span className="text-[#8b8175]"> м</span>
      </div>

      {/* сигилы */}
      <div
        className="absolute right-4 bottom-5 flex items-center gap-2 sm:right-6 sm:bottom-7 [animation:hudIn_1.1s_0.35s_ease-out_both]"
        role="img"
        aria-label={`Найдено сигил: ${quest} из 5${captured > 5 ? `, всего ${captured}` : ''}`}
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden
            className={
              i < quest
                ? `${DOT} border-[#d9a05b] bg-[#d9a05b] shadow-[0_0_10px_2px_rgba(217,160,91,0.55)]`
                : `${DOT} border-[#8b8175]/50`
            }
          />
        ))}
        {captured > 5 && (
          <span className="ml-1 text-[10px] tracking-[0.22em] text-[#d9a05b]">
            +{captured - 5}
          </span>
        )}
      </div>

      {/* строка захвата */}
      {flashKey > 0 && (
        <p
          key={flashKey}
          aria-live="polite"
          className="absolute bottom-16 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.42em] text-[#d9a05b] [animation:capLine_2.4s_ease-out_forwards] sm:bottom-20"
        >
          {captured <= 5 ? `Сигил ${quest}/5` : `Сигил ${captured}`}
        </p>
      )}

      {/* прогресс восхождения */}
      <div className="absolute top-1/2 right-4 h-36 w-px -translate-y-1/2 bg-[#f2e3c6]/10 sm:right-6 sm:h-44" aria-hidden>
        <div
          ref={ascendRef}
          className="h-full w-full origin-bottom bg-[#d9a05b] shadow-[0_0_8px_rgba(217,160,91,0.6)]"
          style={{ transform: 'scaleY(0)', opacity: 0 }}
        />
      </div>
    </div>
  )
}
