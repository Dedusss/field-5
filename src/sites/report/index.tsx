'use client'

/**
 * ОТЧЁТ · FIELD·5 (Этап VIII) — интерактивный исследовательский отчёт.
 *
 * Витрина пяти экспериментов (из SITES), сравнительный радар и матрица,
 * результаты разведки, находки и ограничения, лаборатория, живые данные
 * из /api/telemetry и /api/organism. Скроллится внутри fixed-контейнера,
 * футер прижат (flex-col + mt-auto + safe-area).
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Activity, ArrowUpRight } from 'lucide-react'
import { LAB_META, SITES, type SiteMeta } from '@/sites/manifest'
import RadarCompare from './radar'
import { SceneSignature } from './signatures'
import {
  CONCLUSIONS,
  GPU_LOAD,
  LAB_DEMOS,
  LAB_MODULES,
  LIMITS,
  REFERENCES,
  RESEARCH_AREAS,
  STATUS,
  WORKED,
} from './data'

interface Telemetry {
  total: number
  sites: Record<string, number>
}

interface OrganismStats {
  generation: number
  totalGrafts: number
}

const NAV = [
  { id: 'showcase', label: 'Витрина' },
  { id: 'compare', label: 'Сравнение' },
  { id: 'research', label: 'Исследование' },
  { id: 'findings', label: 'Находки' },
  { id: 'lab', label: 'Лаборатория' },
] as const

/* Сцены для живых баров: 5 экспериментов + лаборатория + сам отчёт */
const LIVE_SCENES = [
  ...SITES.map((s) => ({ slug: s.slug as string, index: s.index, title: s.title, accent: s.accent })),
  { slug: LAB_META.slug as string, index: 'L', title: LAB_META.title, accent: LAB_META.accent },
  { slug: 'report', index: 'R', title: 'ОТЧЁТ', accent: '#d9a05b' },
]

export default function ReportSite({ onExit }: { onExit: () => void }) {
  const reducedMotion = useReducedMotion() ?? false
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [organism, setOrganism] = useState<OrganismStats | null>(null)

  /* Живые данные: только при монтировании, setState — в промис-колбэках */
  useEffect(() => {
    let alive = true
    fetch('/api/telemetry')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Telemetry | null) => {
        if (alive && d && typeof d.total === 'number') setTelemetry(d)
      })
      .catch(() => {})
    fetch('/api/organism')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { organism?: OrganismStats } | null) => {
        if (alive && d?.organism) setOrganism(d.organism)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const scrollToId = useCallback(
    (id: string) => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
    },
    [reducedMotion],
  )

  const openScene = useCallback((slug: string) => {
    window.location.hash = `#/${slug}`
  }, [])

  const maxVisits = telemetry ? Math.max(1, ...Object.values(telemetry.sites ?? {})) : 1

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-[#0b0a09] font-sans text-[#ece7dd]">
      <div className="relative flex min-h-full flex-col">
        {/* Тёплое свечение над героем */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(900px_420px_at_50%_-80px,rgba(217,160,91,0.09),transparent_70%)]"
        />

        {/* Шапка */}
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0a09]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 md:px-10">
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-2 rounded-sm border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#b5ac9e] transition-colors hover:border-[#d9a05b]/50 hover:text-[#f2e3c6]"
            >
              ← ПОЛЕ ОПЫТОВ
            </button>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[13px] font-semibold tracking-[0.14em] text-[#ece7dd]">
                ОТЧЁТ
              </span>
              <span className="hidden font-mono text-[9px] uppercase tracking-[0.3em] text-[#5e574c] sm:inline">
                RESEARCH REPORT · FIELD·5
              </span>
            </div>
            <nav className="flex flex-wrap items-center gap-0.5 md:ml-auto" aria-label="Разделы отчёта">
              {NAV.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToId(item.id)}
                  className="rounded-sm px-2.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[#8b8175] transition-colors hover:bg-white/[0.05] hover:text-[#f2e3c6]"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="relative z-10 flex-1">
          {/* ГЕРОЙ */}
          <section className="mx-auto max-w-[1440px] px-5 pb-14 pt-14 md:px-10 md:pb-20 md:pt-20">
            <motion.p
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="mb-7 font-mono text-[10px] uppercase tracking-[0.42em] text-[#d9a05b] md:text-[11px]"
            >
              Исследовательский отчёт · FIELD·5
            </motion.p>
            <motion.h1
              initial={reducedMotion ? false : { opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08 }}
              className="max-w-5xl font-serif text-[clamp(2.3rem,6.2vw,5.4rem)] font-medium leading-[1.02] tracking-tight text-[#f2e3c6]"
            >
              Что случается с сайтом,{' '}
              <em className="text-[#d9a05b]">когда перестаёшь считать его страницей</em>
            </motion.h1>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.18 }}
              className="mt-9 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
            >
              <p className="max-w-xl text-[15px] leading-relaxed text-[#b5ac9e] md:text-base">
                Пять экспериментов — шейдерная пустошь, звуковой сад, галерея невозможного,
                типографика с массой и коллективный организм, — плюс лаборатория прототипов
                и разведка современного веба, собранные в одном проекте. Этот отчёт — витрина
                результатов, сравнение по осям и честные оговорки. Всё живое, всё считается
                в вашем браузере.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {['5 экспериментов', '8 приборов лаборатории', '20 референсов разведки', '1 маршрут'].map(
                  (t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/[0.09] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[#9c937f]"
                    >
                      {t}
                    </span>
                  ),
                )}
              </div>
            </motion.div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-2 border-t border-white/[0.07] pt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8b8175]">
              <span>Next.js 16</span>
              <span>three.js r186</span>
              <span>WebGL2</span>
              <span>Web Audio</span>
              <span>Canvas 2D</span>
              <span>Prisma</span>
              <span className="text-[#5e574c]">13 октября 2026</span>
            </div>
          </section>

          {/* 01 · ВИТРИНА */}
          <section
            id="showcase"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-20 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="01"
              title="Витрина: пять миров, один маршрут"
              note="sites/manifest.ts · хеш-роутер"
            />
            <div className="grid gap-4 md:grid-cols-2">
              {SITES.map((site) => (
                <SiteCard key={site.slug} site={site} onOpen={openScene} />
              ))}
            </div>
          </section>

          {/* 02 · СРАВНЕНИЕ */}
          <section
            id="compare"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-20 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="02"
              title="Сравнение: пять осей и одна матрица"
              note="авторские оценки · шкала 0–5"
            />
            <RadarCompare />

            <div className="mt-14">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-2xl italic text-[#f2e3c6] md:text-3xl">
                  Матрица экспериментов
                </h3>
                <span className="font-mono text-[10px] tracking-[0.18em] text-[#5e574c]">
                  наведите на строку
                </span>
              </div>
              <div className="max-w-full overflow-x-auto rounded-lg border border-white/[0.08]">
                <table className="w-full min-w-[960px] border-collapse text-left font-mono">
                  <caption className="sr-only">
                    Матрица пяти экспериментов: направление, ядро технологий, уникальная
                    механика, нагрузка на GPU, статус проверки
                  </caption>
                  <thead>
                    <tr className="border-b border-white/[0.1] bg-white/[0.02]">
                      {['#', 'Направление', 'Ядро технологий', 'Уникальная механика', 'GPU', 'Статус проверки'].map(
                        (h) => (
                          <th
                            key={h}
                            scope="col"
                            className="whitespace-nowrap px-4 py-3 text-[9px] font-normal uppercase tracking-[0.18em] text-[#8b8175]"
                          >
                            {h}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {SITES.map((s) => (
                      <tr
                        key={s.slug}
                        className="border-b border-white/[0.05] align-top transition-colors last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-4">
                          <span className="block text-[10px] tracking-[0.1em]" style={{ color: s.accent }}>
                            {s.index}
                          </span>
                          <span className="mt-1 block whitespace-nowrap text-[11px] font-semibold tracking-[0.08em] text-[#f2e3c6]">
                            {s.title}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-[11px] leading-relaxed text-[#9c937f]">
                          {s.direction}
                        </td>
                        <td className="px-4 py-4 text-[11px] leading-relaxed text-[#9c937f]">
                          {s.tech.join(' · ')}
                        </td>
                        <td className="max-w-[250px] px-4 py-4 text-[11px] leading-relaxed text-[#c9bfa9]">
                          {s.interaction}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[10px] uppercase tracking-[0.08em] text-[#b5ac9e]">
                            <span
                              className="block h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: GPU_LOAD[s.slug].color }}
                            />
                            {GPU_LOAD[s.slug].label}
                          </span>
                        </td>
                        <td className="max-w-[320px] px-4 py-4 text-[10px] leading-relaxed text-[#8b8175]">
                          {STATUS[s.slug]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 03 · ИССЛЕДОВАНИЕ */}
          <section
            id="research"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-20 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="03"
              title="Исследование: разведка перед полем"
              note="этап I · 20 позиций · MDN + caniuse"
            />
            <p className="max-w-3xl text-[15px] leading-relaxed text-[#b5ac9e] md:text-base">
              Прежде чем строить, проект разобрал современный иммерсивный веб: канон Awwwards
              за десять лет, статус свежих API, синтез звука без единого ассета, физику текста
              и генеративные методы. Разведка отвечала на один вопрос — чем сегодня может
              быть сайт, если не считать его страницей.
            </p>
            <div className="mt-6 flex flex-wrap gap-1.5">
              {RESEARCH_AREAS.map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-white/[0.08] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8b8175]"
                >
                  {a}
                </span>
              ))}
            </div>

            <ol className="mt-10 grid gap-x-12 md:grid-cols-2">
              {CONCLUSIONS.map((c, i) => (
                <li key={c.title} className="flex gap-4 border-t border-white/[0.07] py-5">
                  <span className="shrink-0 pt-0.5 font-mono text-[10px] tracking-[0.1em] text-[#d9a05b]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <p className="text-[15px] font-medium leading-snug text-[#f2e3c6]">{c.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-[#9c937f]">{c.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-14">
              <div className="mb-5 flex items-baseline justify-between gap-4">
                <h3 className="font-serif text-2xl italic text-[#f2e3c6] md:text-3xl">
                  Источники и референсы
                </h3>
                <span className="font-mono text-[10px] tracking-[0.18em] text-[#5e574c]">
                  research/references.md
                </span>
              </div>
              <div className="grid gap-x-12 md:grid-cols-2">
                {REFERENCES.map((r, i) => (
                  <a
                    key={r.url}
                    href={r.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-start gap-4 border-t border-white/[0.06] py-3.5 transition-colors hover:bg-white/[0.02]"
                  >
                    <span className="shrink-0 pt-0.5 font-mono text-[10px] text-[#5e574c]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-[13px] font-medium text-[#ece7dd] transition-colors group-hover:text-[#d9a05b]">
                        {r.name}
                      </span>
                      <span className="ml-2 font-mono text-[9px] tracking-[0.08em] text-[#5e574c]">
                        {hostOf(r.url)}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-[#8b8175]">
                        {r.note}
                      </span>
                    </span>
                    <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5e574c] transition-colors group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#d9a05b]" />
                  </a>
                ))}
              </div>
            </div>
          </section>

          {/* 04 · НАХОДКИ */}
          <section
            id="findings"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-20 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="04"
              title="Находки и ограничения"
              note="этап IX · протокол испытаний"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#d9a05b]/20 bg-[#d9a05b]/[0.03] p-6 md:p-8">
                <h3 className="font-serif text-2xl italic text-[#f2e3c6]">Что сработало</h3>
                <ul className="mt-6 space-y-4">
                  {WORKED.map((w) => (
                    <li key={w} className="flex gap-3.5">
                      <span className="mt-px shrink-0 font-mono text-[12px] leading-relaxed text-[#d9a05b]">
                        +
                      </span>
                      <p className="text-[13px] leading-relaxed text-[#c9bfa9]">{w}</p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.015] p-6 md:p-8">
                <h3 className="font-serif text-2xl italic text-[#f2e3c6]">
                  Ограничения и честные оговорки
                </h3>
                <ul className="mt-6 space-y-4">
                  {LIMITS.map((l) => (
                    <li key={l} className="flex gap-3.5">
                      <span className="mt-px shrink-0 font-mono text-[12px] leading-relaxed text-[#8b8175]">
                        —
                      </span>
                      <p className="text-[13px] leading-relaxed text-[#9c937f]">{l}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 05 · ЛАБОРАТОРИЯ */}
          <section
            id="lab"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-20 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="05"
              title="Лаборатория: приборы, из которых всё выросло"
              note="этап V · 9 демо · src/lib/lab"
            />
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <p className="max-w-2xl text-[15px] leading-relaxed text-[#b5ac9e]">
                  Девять приборных панелей с живыми параметрами — прототипы, на которых
                  приёмы отрабатывались до попадания в эксперименты. Каждое демо —
                  автономный прибор: экран реагирует на курсор, панель параметров честно
                  пересчитывает кадр.
                </p>
                <ul className="mt-6 grid gap-x-10 sm:grid-cols-2">
                  {LAB_DEMOS.map((d) => (
                    <li key={d.index} className="flex gap-4 border-t border-white/[0.06] py-3.5">
                      <span className="shrink-0 pt-0.5 font-mono text-[10px] tracking-[0.08em] text-[#e8b34d]">
                        {d.index}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-[#ece7dd]">{d.title}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-[#8b8175]">{d.note}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <aside className="flex flex-col rounded-lg border border-[#e8b34d]/20 bg-[#e8b34d]/[0.03] p-6 md:p-7">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#e8b34d]">
                  Библиотека src/lib/lab
                </h3>
                <ul className="mt-5 space-y-4">
                  {LAB_MODULES.map((m) => (
                    <li key={m.name}>
                      <p className="font-mono text-[12px] text-[#f2e3c6]">{m.name}</p>
                      <p className="mt-0.5 text-[12px] leading-snug text-[#9c937f]">{m.note}</p>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => openScene(LAB_META.slug)}
                  className="mt-7 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-sm border border-[#e8b34d]/45 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#e8b34d] transition-colors hover:border-[#e8b34d] hover:bg-[#e8b34d]/10 hover:text-[#f6e9c8]"
                >
                  В лабораторию
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </aside>
            </div>
          </section>

          {/* 06 · ЖИВЫЕ ДАННЫЕ */}
          <section
            id="data"
            className="mx-auto max-w-[1440px] scroll-mt-28 px-5 pb-24 md:scroll-mt-20 md:px-10"
          >
            <SectionHead
              index="06"
              title="Живые данные: что считает сам проект"
              note="get /api/telemetry · get /api/organism"
            />
            <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div>
                <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8175]">
                  <Activity className="h-3.5 w-3.5 text-[#d9a05b]" />
                  Открытий сцен всего
                </p>
                <p className="mt-3 font-display text-5xl font-bold leading-none text-[#f2e3c6]">
                  {telemetry ? telemetry.total : '—'}
                </p>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8b8175]">
                  Организм
                </p>
                <p className="mt-2 font-mono text-[13px] leading-relaxed text-[#c9bfa9]">
                  {organism
                    ? `поколение ${organism.generation} · ветвей привито ${organism.totalGrafts}`
                    : 'поколение — · ветвей привито —'}
                </p>
                <p className="mt-6 max-w-xs text-[12px] leading-relaxed text-[#8b8175]">
                  Счётчик ведётся с первого запуска проекта: каждый вход в любую сцену —
                  включая этот отчёт — записывается в базу. Организм растёт из прививок
                  всех посетителей и помнит их после перезагрузки.
                </p>
              </div>
              <div className="space-y-3.5">
                {LIVE_SCENES.map((scene) => {
                  const v = telemetry?.sites?.[scene.slug]
                  const value = typeof v === 'number' ? v : null
                  return (
                    <div key={scene.slug} className="flex items-center gap-4">
                      <span className="w-[120px] shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-[#9c937f] sm:w-[150px]">
                        {scene.index} · {scene.title}
                      </span>
                      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: value === null ? '0%' : `${Math.max(2, (value / maxVisits) * 100)}%`,
                            backgroundColor: scene.accent,
                          }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-[11px] text-[#b5ac9e]">
                        {value === null ? '—' : value}
                      </span>
                    </div>
                  )
                })}
                <p className="pt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-[#5e574c]">
                  данные обновляются при входе в отчёт · недоступность API — прочерки
                </p>
              </div>
            </div>
          </section>
        </main>

        {/* Подвал (прижат к низу) */}
        <footer className="relative z-10 mt-auto border-t border-white/[0.07] bg-[#0b0a09]/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] font-mono text-[10px] tracking-[0.14em] text-[#5e574c] md:flex-row md:items-center md:justify-between md:px-10">
            <span className="uppercase">
              ПОЛЕ ОПЫТОВ · FIELD·5 — исследовательский проект · Савелий Гарбес · 2026
            </span>
            <span className="uppercase">Next.js 16 · three.js r186 · WebGL2 · Web Audio · Canvas 2D · Prisma</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function SectionHead({ index, title, note }: { index: string; title: string; note?: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-white/[0.07] pb-5 md:mb-10">
      <div className="flex items-baseline gap-4">
        <span className="font-mono text-[11px] tracking-[0.2em] text-[#d9a05b]">{index}</span>
        <h2 className="font-serif text-[clamp(1.7rem,3.4vw,2.5rem)] font-medium italic leading-tight tracking-tight text-[#f2e3c6]">
          {title}
        </h2>
      </div>
      {note && (
        <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#5e574c]">
          {note}
        </span>
      )}
    </div>
  )
}

function SiteCard({ site, onOpen }: { site: SiteMeta; onOpen: (slug: string) => void }) {
  return (
    <article
      className="group flex min-w-0 flex-col rounded-lg border border-white/[0.08] bg-white/[0.015] p-6 transition-colors duration-300 hover:border-[var(--acc)] hover:bg-white/[0.03] md:p-7"
      style={{ '--acc': site.accent } as React.CSSProperties}
    >
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-xs tracking-[0.1em] text-[#5e574c] transition-colors duration-300 group-hover:text-[var(--acc)]">
              {site.index}
            </span>
            <h3 className="font-display text-xl font-semibold tracking-tight text-[#f2e3c6] md:text-2xl">
              {site.title}
            </h3>
          </div>
          <p className="mt-1.5 truncate font-mono text-[9px] uppercase tracking-[0.22em] text-[#5e574c]">
            {site.latin}
          </p>
        </div>
        <div className="w-[84px] shrink-0 overflow-hidden rounded border border-white/[0.08]">
          <SceneSignature slug={site.slug} />
        </div>
      </div>

      <p className="mt-5 font-serif text-[1.15rem] italic leading-snug text-[#d9cdb8]">
        {site.tagline}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-[#8b8175]">
        {site.direction}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-[#b5ac9e]">{site.description}</p>

      <div className="mt-5 border-l-2 border-[var(--acc)] pl-3.5">
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#8b8175]">
          Главная механика
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-[#ece7dd]">{site.interaction}</p>
      </div>

      <div className="mt-auto pt-6">
        <div className="flex flex-wrap gap-1.5">
          {site.tech.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/[0.09] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-[#8b8175]"
            >
              {t}
            </span>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
          <div className="flex gap-1.5" aria-label="Палитра сцены">
            {site.palette.map((c) => (
              <span
                key={c}
                className="block h-3 w-3 rounded-[3px]"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onOpen(site.slug)}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-sm border border-white/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#b5ac9e] transition-colors hover:border-[var(--acc)] hover:text-[#f2e3c6]"
          >
            Открыть эксперимент
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </article>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
