'use client'

/** Бут-экран: стилизованное ожидание компиляции шейдера. */
export function BootGate({ label, fade }: { label: string; fade: boolean }) {
  return (
    <div
      aria-hidden={fade}
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0b0a09] transition-opacity duration-700 ease-out ${
        fade ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.44em] text-[#8b8175]">
        Эксп. 01
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-wide text-[#f2e3c6] sm:text-5xl">
        МОНОЛИТ
      </h1>
      <div className="h-px w-44 overflow-hidden bg-[#f2e3c6]/10">
        <div className="h-full w-1/4 bg-[#d9a05b] [animation:bootSweep_1.15s_ease-in-out_infinite]" />
      </div>
      <p
        role="status"
        className="font-mono text-[9px] uppercase tracking-[0.34em] text-[#d9a05b]/85"
      >
        {label}
      </p>
    </div>
  )
}

/** Экран отсутствия WebGL2. */
export function FailGate({ msg, onExit }: { msg: string; onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#0b0a09] p-6 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.44em] text-[#8b8175]">
        Эксп. 01 · Монолит
      </p>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-[#f2e3c6] sm:text-5xl">
        Нужен GPU
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-[#9c937f]">
        Для этого эксперимента требуется WebGL2, но браузер не отдал контекст.
        Включите аппаратное ускорение в настройках браузера или откройте «Монолит»
        на другой машине — пустошь живёт на графическом процессоре.
      </p>
      {msg && (
        <p className="max-w-md break-words font-mono text-[10px] leading-relaxed text-[#8b8175]/60">
          диагностика: {msg}
        </p>
      )}
      <button
        type="button"
        onClick={onExit}
        className="rounded-sm border border-[#f2e3c6]/20 px-6 py-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#b5ac9e] transition-colors duration-300 hover:border-[#f2e3c6]/50 hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
      >
        В Поле опытов
      </button>
    </div>
  )
}
