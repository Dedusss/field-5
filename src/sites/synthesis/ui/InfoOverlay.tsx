'use client'

const SECTION_TITLE =
  'mb-2 font-mono text-[10px] uppercase tracking-[0.3em] text-[#b6f34d]'

export default function InfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a0510]/80 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border border-white/10 bg-[#120a14]/95 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.4em] text-[#e84fd0]">
              Эксп. 02 · Synthesis
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-tight text-[#f6eef8] sm:text-3xl">
              О саде
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm border border-white/15 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f6eef8]/70 transition-colors hover:border-[#e84fd0]/60 hover:text-[#f6eef8]"
          >
            ✕ Закрыть
          </button>
        </div>

        <div className="flex flex-col gap-6 text-sm leading-relaxed text-[#f6eef8]/75">
          <section>
            <h3 className={SECTION_TITLE}>Концепция</h3>
            <p>
              Сад, где каждое растение — инструмент, а клумба — микшерный пульт. Весь звук
              синтезируется браузером на лету: ни одного аудиофайла, только осциляторы, фильтры,
              шум и свёртка с процедурным импульсом. Гармония — цикл Am–F–C–G, мелодика —
              пентатоника ля-минор, ритмы — евклидовы решётки, уникальные для каждого семени.
            </p>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Позиция = аранжировка</h3>
            <p>
              Горизонтальное место растения — его место в стереопанораме: посадили слева — звучит
              слева. Чем дальше от центра сада, тем больше «влажности» — сигнала в реверб.
              Перетащите растение во время звучания, и микс изменится на слух.
            </p>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Технологии</h3>
            <p>
              Web Audio: собственный планировщик (92 BPM, 16-е доли, lookahead 120 мс),
              расстроенные пилы с медленным LFO на фильтре, формантные полосовые фильтры хора,
              мембранный удар с падением высоты, синтетический импульс реверберации (шум,
              затухающий по экспоненте), мягкий лимитер и анализатор FFT 512 для аудиореактива.
              Графика: WebGL2-шейдер фона с fbm-дюнами и луной, Canvas 2D с рекурсивными
              растениями и спорами, динамическое разрешение рендера.
            </p>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Что попробовать</h3>
            <ul className="flex list-disc flex-col gap-1.5 pl-4">
              <li>Посадите хор по краям сада, а удар — в центре.</li>
              <li>Потащите растение во время игры: панорама и реверб меняются на слух.</li>
              <li>Выкрутите погоду на максимум и слушайте призрачные ноты.</li>
              <li>Заглушите всё пробелом и наблюдайте, как сад медленно затихает.</li>
            </ul>
          </section>

          <section>
            <h3 className={SECTION_TITLE}>Управление</h3>
            <p className="font-mono text-[11px] leading-relaxed text-[#f6eef8]/60">
              клик по почве — посадить · клик по растению — заглушить · перетаскивание —
              аранжировка · долгое нажатие или ✕ — удалить · клавиши 1–4 — выбор семени ·
              пробел — тишина
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
