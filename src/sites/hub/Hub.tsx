'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, FlaskConical, FileSearch, Activity } from 'lucide-react'
import { SITES, LAB_META, REPORT_META, type SiteMeta } from '@/sites/manifest'
import { SitePreviewCanvas, type PreviewKind } from '@/sites/hub/previews'
import BackDrop from '@/sites/hub/BackDrop'
import type { RouteSlug } from '@/lib/router'

interface Telemetry {
  total: number
  sites: Record<string, number>
}

interface OrganismStats {
  generation: number
  totalGrafts: number
}

export default function Hub({ navigate }: { navigate: (slug: RouteSlug) => void }) {
  const reducedMotion = useReducedMotion()
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [organism, setOrganism] = useState<OrganismStats | null>(null)
  const [hovered, setHovered] = useState<PreviewKind | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/telemetry')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTelemetry(d))
      .catch(() => {})
    fetch('/api/organism')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.organism && setOrganism(d.organism))
      .catch(() => {})
  }, [])

  const onListMouseMove = useCallback((e: React.MouseEvent) => {
    const panel = panelRef.current
    if (!panel) return
    const x = Math.min(e.clientX + 28, window.innerWidth - 360)
    const y = Math.min(Math.max(e.clientY - 130, 16), window.innerHeight - 250)
    panel.style.transform = `translate3d(${x}px, ${y}px, 0)`
  }, [])

  const scrollToProjects = () => {
    document.getElementById('projects')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const maxVisits = telemetry
    ? Math.max(1, ...Object.values(telemetry.sites ?? {}))
    : 1

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-[#0b0a09] text-[#ece7dd]">
      <BackDrop />

      {/* Шапка */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#0b0a09]/75 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-5 md:px-10">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })}
            className="group flex items-center gap-3 rounded-sm outline-offset-4 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
            aria-label="Наверх"
          >
            <span className="block h-2.5 w-2.5 bg-[#d9a05b] transition-transform duration-300 group-hover:rotate-45" />
            <span className="font-display text-[11px] font-semibold tracking-[0.22em] text-[#ece7dd]">
              ПОЛЕ ОПЫТОВ
            </span>
            <span className="font-mono text-[10px] tracking-[0.3em] text-[#8b8175] hidden sm:inline">
              FIELD·5
            </span>
          </button>
          <nav className="flex items-center gap-1 md:gap-2" aria-label="Основная навигация">
            {/* на узких экранах «Эксперименты» скрыты — список занимает всю страницу ниже,
                а шапке оставляем короткие пути к отчёту и лаборатории */}
            <button
              onClick={scrollToProjects}
              className="hidden rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#b5ac9e] outline-offset-4 transition-colors hover:bg-white/[0.05] hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b] sm:inline-block"
            >
              Эксперименты
            </button>
            <button
              onClick={() => navigate('report')}
              className="rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#b5ac9e] outline-offset-4 transition-colors hover:bg-white/[0.05] hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
            >
              Отчёт
            </button>
            <button
              onClick={() => navigate('lab')}
              className="rounded-sm px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#b5ac9e] outline-offset-4 transition-colors hover:bg-white/[0.05] hover:text-[#f2e3c6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]"
            >
              Лаборатория
            </button>
          </nav>
        </div>
      </header>

      <main className="relative z-10 flex-1">
        {/* Герой */}
        <section className="mx-auto max-w-[1440px] px-5 pb-14 pt-16 md:px-10 md:pb-20 md:pt-24">
          <motion.p
            initial={reducedMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-7 font-mono text-[10px] uppercase tracking-[0.42em] text-[#d9a05b] md:text-[11px]"
          >
            Исследовательский проект · эксперименты 01–05
          </motion.p>
          <motion.h1
            initial={reducedMotion ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.08 }}
            className="max-w-5xl font-serif text-[clamp(2.6rem,7.2vw,6.4rem)] font-medium leading-[0.98] tracking-tight text-[#f2e3c6]"
          >
            Пять ответов на вопрос,{' '}
            <em className="text-[#d9a05b]">чем ещё может быть сайт</em>
          </motion.h1>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85, delay: 0.2 }}
            className="mt-9 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
          >
            <p className="max-w-xl text-[15px] leading-relaxed text-[#b5ac9e] md:text-base">
              Каждый эксперимент — законченный мир со своей физикой, эстетикой и способом
              взаимодействия: шейдерная пустошь, звуковой сад, галерея невозможного,
              типографика с массой и коллективный организм. Всё живое, всё считается
              в вашем браузере, всё можно потрогать.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {['WebGL2', 'Raymarching', 'Web Audio', 'three.js r186', 'Canvas 2D', 'Prisma'].map(
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

          {/* Живая статистика */}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-white/[0.07] pt-5 font-mono text-[11px] tracking-[0.12em] text-[#8b8175]">
            <span className="flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-[#d9a05b]" />
              СЦЕН ОТКРЫТО: {telemetry ? telemetry.total : '—'}
            </span>
            <span>
              ОРГАНИЗМ: ПОКОЛЕНИЕ {organism ? organism.generation : '—'} · ВЕТВЕЙ{' '}
              {organism ? organism.totalGrafts : '—'}
            </span>
            <span className="text-[#5e574c]">ДАННЫЕ: /api/telemetry · /api/organism</span>
          </div>
        </section>

        {/* Пять экспериментов */}
        <section id="projects" className="mx-auto max-w-[1440px] px-5 pb-20 md:px-10">
          <div className="mb-8 flex items-baseline justify-between">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.42em] text-[#8b8175]">
              Пять экспериментов
            </h2>
            <span className="font-mono text-[10px] tracking-[0.2em] text-[#5e574c]">01 — 05</span>
          </div>

          <div onMouseMove={onListMouseMove} onMouseLeave={() => setHovered(null)}>
            {SITES.map((site, i) => (
              <ProjectRow
                key={site.slug}
                site={site}
                index={i}
                visits={telemetry?.sites?.[site.slug] ?? 0}
                onEnter={() => navigate(site.slug)}
                onHover={setHovered}
              />
            ))}
          </div>

          {/* Плавающая превью-панель (только десктоп) */}
          {hovered && (
            <div
              ref={panelRef}
              className="pointer-events-none fixed left-0 top-0 z-40 hidden w-[330px] lg:block"
            >
              <div className="overflow-hidden rounded-md border border-white/[0.12] bg-[#0b0a09]/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur">
                <SitePreviewCanvas kind={hovered} className="block aspect-[16/10] w-full" />
                <div className="flex items-center justify-between border-t border-white/[0.08] px-3.5 py-2.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[#8b8175]">
                    Живое превью · {hovered}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.2em] text-[#d9a05b]">
                    {SITES.find((s) => s.slug === hovered)?.index}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Отчёт и лаборатория */}
        <section className="mx-auto grid max-w-[1440px] gap-4 px-5 pb-20 md:grid-cols-2 md:px-10">
          <button
            onClick={() => navigate('report')}
            className="group relative overflow-hidden rounded-lg border border-white/[0.09] bg-white/[0.02] p-7 text-left outline-offset-[-3px] transition-colors hover:border-[#d9a05b]/40 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]/70 md:p-9"
          >
            <FileSearch className="mb-5 h-5 w-5 text-[#d9a05b]" />
            <h3 className="font-serif text-3xl italic text-[#f2e3c6] md:text-4xl">
              Исследовательский отчёт
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#b5ac9e]">
              Что исследовалось, какие направления выбраны и почему, что сработало и что
              нет. Сравнение пяти экспериментов и живая телеметрия.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#d9a05b]">
              Открыть отчёт
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </button>
          <button
            onClick={() => navigate('lab')}
            className="group relative overflow-hidden rounded-lg border border-white/[0.09] bg-white/[0.02] p-7 text-left outline-offset-[-3px] transition-colors hover:border-[#e8b34d]/40 hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8b34d]/70 md:p-9"
          >
            <FlaskConical className="mb-5 h-5 w-5 text-[#e8b34d]" />
            <h3 className="font-serif text-3xl italic text-[#f2e3c6] md:text-4xl">
              Лаборатория
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#b5ac9e]">
              Микро-демо с живыми параметрами: шумы, SDF, дизеринг, физика, генерация.
              Прототипы и переиспользуемые инструменты проекта.
            </p>
            <span className="mt-6 inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[#e8b34d]">
              В лабораторию
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </button>
        </section>

        {/* Телеметрия по сценам */}
        {telemetry && telemetry.total > 0 && (
          <section className="mx-auto max-w-[1440px] px-5 pb-24 md:px-10">
            <h2 className="mb-7 font-mono text-[11px] uppercase tracking-[0.42em] text-[#8b8175]">
              Живая телеметрия посещений
            </h2>
            <div className="space-y-3">
              {SITES.map((s) => {
                const v = telemetry.sites?.[s.slug] ?? 0
                return (
                  <div key={s.slug} className="flex items-center gap-4">
                    <span className="w-28 shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9c937f]">
                      {s.index} {s.title}
                    </span>
                    <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.max(2, (v / maxVisits) * 100)}%`,
                          backgroundColor: s.accent,
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-mono text-[11px] text-[#b5ac9e]">
                      {v}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>

      {/* Подвал (прижат к низу) */}
      <footer className="relative z-10 mt-auto border-t border-white/[0.07] bg-[#0b0a09]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-5 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))] font-mono text-[10px] tracking-[0.14em] text-[#5e574c] md:flex-row md:items-center md:justify-between md:px-10">
          <span className="uppercase">ПОЛЕ ОПЫТОВ — FIELD·5 · Исследовательский проект</span>
          <span>NEXT.JS 16 · THREE.JS R186 · WEBGL2 · WEB AUDIO · CANVAS 2D · PRISMA</span>
          <span>Савелий Гарбес · {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  )
}

function ProjectRow({
  site,
  index,
  visits,
  onEnter,
  onHover,
}: {
  site: SiteMeta
  index: number
  visits: number
  onEnter: () => void
  onHover: (kind: PreviewKind | null) => void
}) {
  return (
    <button
      onClick={onEnter}
      onMouseEnter={() => onHover(site.slug)}
      onFocus={() => onHover(site.slug)}
      onBlur={() => onHover(null)}
      className="group block w-full border-t border-white/[0.08] py-7 text-left outline-offset-[-3px] transition-colors duration-300 last:border-b hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#d9a05b]/60 md:py-8"
      style={{ '--site-accent': site.accent } as React.CSSProperties}
      aria-label={`Открыть эксперимент ${site.index} «${site.title}»`}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 md:grid-cols-[64px_1fr_280px_120px] md:gap-8">
        <span
          className="font-mono text-sm text-[#5e574c] transition-colors duration-300 group-hover:text-[var(--site-accent)]"
        >
          {site.index}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-display text-xl font-semibold tracking-tight text-[#f2e3c6] transition-transform duration-300 group-hover:translate-x-1 md:text-[2rem]">
            {site.title}
          </h3>
          <p className="mt-1.5 truncate text-sm text-[#9c937f] md:whitespace-normal">
            {site.tagline}
          </p>
          <p className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#5e574c] lg:block">
            {site.direction}
          </p>
        </div>
        <div className="hidden flex-wrap gap-1.5 md:flex md:justify-end">
          {site.tech.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/[0.08] px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#8b8175]"
            >
              {t}
            </span>
          ))}
        </div>
        <span className="flex items-center justify-end gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#8b8175] transition-colors duration-300 group-hover:text-[var(--site-accent)]">
          {visits > 0 ? (
            <span className="hidden xl:inline">{visits}</span>
          ) : null}
          Открыть
          <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
        </span>
      </div>

      {/* Палитра и мобильное превью */}
      <div className="mt-5 flex items-center gap-4 md:hidden">
        <div className="flex gap-1.5">
          {site.palette.map((c) => (
            <span
              key={c}
              className="block h-3 w-3 rounded-[3px]"
              style={{ backgroundColor: c }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-white/[0.08] lg:hidden">
        <SitePreviewCanvas kind={site.slug} className="block aspect-[16/8] w-full" />
      </div>
      <span className="sr-only">Эксперимент {index + 1} из 5</span>
    </button>
  )
}
