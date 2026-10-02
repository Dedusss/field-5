'use client'

interface FinalOverlayProps {
  depth: number
  seconds: number
  onContinue: () => void
  onExit: () => void
}

function mmss(total: number): string {
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function FinalOverlay({
  depth,
  seconds,
  onContinue,
  onExit,
}: FinalOverlayProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Пустошь пройдена"
      className="absolute inset-0 z-30 flex items-center justify-center bg-gradient-to-b from-[#0b0a09]/55 via-[#0b0a09]/78 to-[#0b0a09]/95 p-6 [animation:fadeIn_0.9s_ease-out]"
    >
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-[#d9a05b] [animation:hudIn_0.8s_0.3s_ease-out_both]">
          Восхождение завершено
        </p>
        <h2 className="font-display text-4xl leading-tight font-semibold tracking-tight text-[#f2e3c6] sm:text-6xl [animation:hudIn_0.9s_0.5s_ease-out_both]">
          Пустошь
          <br />
          пройдена
        </h2>
        <p className="max-w-sm font-serif text-lg leading-relaxed text-[#f2e3c6]/80 italic [animation:hudIn_0.9s_0.8s_ease-out_both]">
          Пять сигил зажглись — туман отступил, и пустошь ответила светом.
        </p>

        <dl className="grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-sm border border-[#f2e3c6]/10 bg-[#f2e3c6]/10 [animation:hudIn_0.9s_1s_ease-out_both]">
          {[
            { k: 'Глубина', v: `${depth} м` },
            { k: 'Время', v: mmss(seconds) },
            { k: 'Сигилы', v: '5 из 5' },
          ].map((s) => (
            <div key={s.k} className="bg-[#0e0c0a] px-2 py-4">
              <dt className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#8b8175]">
                {s.k}
              </dt>
              <dd className="mt-1.5 font-mono text-sm text-[#f2e3c6] tabular-nums">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col items-center gap-3 [animation:hudIn_0.9s_1.2s_ease-out_both] sm:flex-row">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-sm bg-[#d9a05b] px-6 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#16110a] transition-colors duration-300 hover:bg-[#f2e3c6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#f2e3c6]"
          >
            Продолжить путь
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-sm border border-[#f2e3c6]/20 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#b5ac9e] transition-colors duration-300 hover:border-[#f2e3c6]/50 hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
          >
            В Поле опытов
          </button>
        </div>
      </div>
    </div>
  )
}
