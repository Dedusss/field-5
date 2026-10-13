'use client'

/**
 * ЛАБОРАТОРИЯ · FIELD·5 (Этап V) — галерея живых микро-демо.
 *
 * Одиннадцать приборных панелей, из которых выросли пять экспериментов проекта.
 * Страница скроллится: липкая шапка с фильтрами категорий, сетка карточек,
 * прижатый футер. Каждая карточка — автономное демо с параметрами.
 */

import { useMemo, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { DemoCategory } from '@/lib/lab/types'
import { DEMOS, FILTERS } from './demos'
import LabCard from './LabCard'

export default function LabSite({ onExit }: { onExit: () => void }) {
  const reduced = useReducedMotion() ?? false
  const [filter, setFilter] = useState<'all' | DemoCategory>('all')

  const demos = useMemo(
    () => (filter === 'all' ? DEMOS : DEMOS.filter((d) => d.category === filter)),
    [filter],
  )
  const rangeLabel = useMemo(() => {
    if (demos.length === 0) return ''
    const a = DEMOS.indexOf(demos[0]) + 1
    const b = DEMOS.indexOf(demos[demos.length - 1]) + 1
    const pad = (n: number) => String(n).padStart(2, '0')
    return `L·${pad(a)} — L·${pad(b)}`
  }, [demos])

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-[#0e0d0b] text-[#ece7dd]">
      <div className="flex min-h-full flex-col">
        {/* Липкая шапка: выход, заголовок, фильтры */}
        <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#0e0d0b]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 md:px-10">
            <button
              onClick={onExit}
              className="flex items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b5ac9e] transition-colors hover:border-[#e8b34d]/50 hover:text-[#f2e3c6]"
            >
              ← ПОЛЕ ОПЫТОВ
            </button>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[13px] font-semibold tracking-[0.14em] text-[#ece7dd]">
                ЛАБОРАТОРИЯ
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#5e574c]">
                THE LAB · FIELD·5
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-1.5 md:ml-auto" aria-label="Фильтр категорий">
              {FILTERS.map((f) => {
                const active = filter === f.id
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    aria-pressed={active}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? 'border-[#e8b34d]/55 bg-[#e8b34d]/10 text-[#e8b34d]'
                        : 'border-white/[0.09] text-[#8b8175] hover:border-white/25 hover:text-[#b5ac9e]'
                    }`}
                  >
                    {f.color && (
                      <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: f.color }} />
                    )}
                    {f.label}
                  </button>
                )
              })}
            </nav>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 pb-20 pt-12 md:px-10 md:pt-16">
          {/* Герой */}
          <section>
            <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.42em] text-[#e8b34d]">
              Этап V · прототипы, из которых выросли эксперименты 01–05
            </p>
            <h1 className="font-display text-[clamp(2.4rem,6vw,4.6rem)] font-bold leading-none tracking-tight text-[#f2e3c6]">
              ЛАБОРАТОРИЯ
            </h1>
            <p className="mt-5 max-w-2xl font-serif text-[clamp(1.25rem,2.6vw,1.7rem)] italic leading-snug text-[#c9bfa9]">
              <span className="text-[#e8b34d]">Одиннадцать приборных панелей</span>, из которых
              выросли пять экспериментов
            </p>
            <div className="mt-7 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/[0.07] pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b8175]">
              <span>11 демо · 4 категории</span>
              <span>canvas 2d · webgl2</span>
              <span>модули: math / glkit / useDemoLoop</span>
              <span>курсор — часть прибора</span>
            </div>
            <p className="mt-6 max-w-3xl border-l-2 border-[#e8b34d]/50 pl-4 text-sm leading-relaxed text-[#9c937f]">
              Как читать карточки: индекс и категория — в шапке прибора, живой экран — в центре
              (водите курсором и кликайте), панель параметров — под экраном, внизу — назначение
              и техническая начинка.
            </p>
          </section>

          {/* Сетка приборов */}
          <section className="mt-12" aria-label="Демо лаборатории">
            <div className="mb-7 flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-[0.42em] text-[#8b8175]">
                {filter === 'all' ? 'Все приборы' : 'Отобрано по категории'}
              </h2>
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#5e574c]">
                {rangeLabel}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {demos.map((demo) => {
                const globalIndex = DEMOS.indexOf(demo)
                return (
                  <div
                    key={demo.id}
                    className="animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
                  >
                    <LabCard demo={demo} index={globalIndex} reduced={reduced} />
                  </div>
                )
              })}
            </div>
            {demos.length === 0 && (
              <p className="py-16 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-[#5e574c]">
                В этой категории приборов нет
              </p>
            )}
          </section>
        </main>

        {/* Прижатый футер */}
        <footer className="mt-auto border-t border-white/[0.07] bg-[#0b0a09]/70">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-2.5 px-5 py-7 pb-[calc(1.75rem+env(safe-area-inset-bottom))] font-mono text-[10px] tracking-[0.14em] text-[#5e574c] md:flex-row md:items-center md:justify-between md:px-10">
            <span className="uppercase">
              Лаборатория · FIELD·5 — модули: src/lib/lab (useDemoLoop, math, glkit)
            </span>
            <span>Всё считается в вашем браузере · без ассетов и библиотек</span>
            <span>ПОЛЕ ОПЫТОВ · исследовательский проект · {new Date().getFullYear()}</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
