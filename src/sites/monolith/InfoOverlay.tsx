'use client'

const TECH = [
  'WebGL2',
  'GLSL ES 3.00',
  'Raymarching по SDF',
  'Доменное повторение',
  'Мягкие тени',
  'Тонмаппинг ACES',
  'Динамическое разрешение',
]

const TRY = [
  'Ведите светоч вдоль грани монолита — рельеф проявляется живыми тенями.',
  'Ищите тлеющие точки в дымке: на гранях спрятаны сигилы, они зовут вглубь.',
  'Соберите все пять — пустошь ответит восхождением, а путь не закончится.',
]

export default function InfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="О эксперименте Монолит"
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b0a09]/85 p-4 backdrop-blur-md [animation:fadeIn_0.3s_ease-out] sm:p-8"
    >
      <div className="max-h-full w-full max-w-xl overflow-y-auto border border-[#f2e3c6]/12 bg-[#100e0c]/95 p-6 sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#d9a05b]">
            Эксп. 01 · Монолит
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-[#f2e3c6]/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#b5ac9e] transition-colors duration-300 hover:border-[#f2e3c6]/45 hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
          >
            Закрыть
          </button>
        </div>

        <h2 className="mt-5 font-display text-2xl leading-tight font-semibold tracking-tight text-[#f2e3c6] sm:text-3xl">
          Пустошь одного шейдера
        </h2>

        <p className="mt-4 font-serif text-lg leading-relaxed text-[#f2e3c6]/85 italic">
          «Монолит» — бесконечная процедурная пустошь, целиком отрисованная одним
          фрагментным шейдером: геометрия, свет и туман считаются для каждого луча
          на GPU.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-[#9c937f]">
          Скролл уносит вглубь между чёрными стенами каньона, курсор — парящий
          уголь-светоч, от которого расступается мрак. В гранях монолитов спрятаны
          пять сигил: приблизьтесь к каждому — и мир станет теплее. Все пять —
          восхождение.
        </p>

        <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.4em] text-[#8b8175]">
          Технологии
        </h3>
        <ul className="mt-3 flex flex-wrap gap-2">
          {TECH.map((t) => (
            <li
              key={t}
              className="rounded-full border border-[#f2e3c6]/12 px-3 py-1 font-mono text-[10px] tracking-[0.12em] text-[#b5ac9e]"
            >
              {t}
            </li>
          ))}
        </ul>

        <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.4em] text-[#8b8175]">
          Что попробовать
        </h3>
        <ol className="mt-3 space-y-2.5">
          {TRY.map((t, i) => (
            <li key={t} className="flex gap-3 text-sm leading-relaxed text-[#c7bda9]">
              <span className="mt-0.5 font-mono text-[10px] text-[#d9a05b]">
                0{i + 1}
              </span>
              <span>{t}</span>
            </li>
          ))}
        </ol>

        <p className="mt-8 border-t border-[#f2e3c6]/10 pt-4 font-mono text-[10px] uppercase tracking-[0.3em] text-[#8b8175]/70">
          Esc — закрыть
        </p>
      </div>
    </div>
  )
}
