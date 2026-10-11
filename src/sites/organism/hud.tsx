'use client'

/**
 * ЭКСП. 05 «ОРГАНИЗМ» — HUD: шапка-статы, шкала энергии, кнопки действий,
 * лента мутаций, инфо-оверлей, boot-«пробуждение», баннеры и тосты.
 * Палитра: бездна #05130c / #0c2b1a · свечение #4ef08a · янтарь #e8b34d.
 */

import type { RefObject } from 'react'
import { memo } from 'react'

export const relTime = (at: number, now: number): string => {
  const s = Math.max(0, Math.floor((now - at) / 1000))
  if (s < 45) return 'только что'
  if (s < 90) return '1 мин назад'
  if (s < 2700) return `${Math.floor(s / 60)} мин назад`
  if (s < 7200) return '1 ч назад'
  return `${Math.floor(s / 3600)} ч назад`
}

/* --------------------------------- стили ---------------------------------- */

export function SceneStyles(): React.JSX.Element {
  return (
    <style>{`
      @keyframes org-tentacle {
        from { transform: scaleY(0.55) rotate(-4deg); opacity: 0.35; }
        to { transform: scaleY(1.08) rotate(4deg); opacity: 1; }
      }
      @keyframes org-toast-in {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      @keyframes org-pulse-soft {
        0%, 100% { opacity: 0.35; }
        50% { opacity: 1; }
      }
      .org-tentacle { animation: org-tentacle 1.5s ease-in-out infinite alternate; transform-origin: center bottom; }
      .org-toast { animation: org-toast-in 0.28s ease-out both; }
      .org-pulse-soft { animation: org-pulse-soft 1.6s ease-in-out infinite; }
      .org-scroll { scrollbar-width: thin; scrollbar-color: rgba(78,240,138,0.28) transparent; }
      .org-scroll::-webkit-scrollbar { width: 5px; }
      .org-scroll::-webkit-scrollbar-track { background: transparent; }
      .org-scroll::-webkit-scrollbar-thumb { background: rgba(78,240,138,0.28); border-radius: 3px; }
      .org-scroll::-webkit-scrollbar-thumb:hover { background: rgba(78,240,138,0.5); }
      @media (prefers-reduced-motion: reduce) {
        .org-tentacle, .org-toast, .org-pulse-soft { animation: none; }
      }
    `}</style>
  )
}

/* --------------------------------- шапка ---------------------------------- */

export function ExitButton({ onExit }: { onExit: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onExit}
      className="pointer-events-auto border border-[#dff5e5]/15 bg-[#03100a]/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#dff5e5]/70 backdrop-blur-sm transition-colors hover:border-[#e8b34d]/60 hover:text-[#e8b34d]"
    >
      ← Поле опытов
    </button>
  )
}

interface HeaderStatsProps {
  generation: number
  grafts: number
  pulses: number
  energy: number
}

export function HeaderStats({ generation, grafts, pulses, energy }: HeaderStatsProps): React.JSX.Element {
  return (
    <div className="pointer-events-none">
      <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#4ef08a]/75">
        Организм · Эксп. 05
      </p>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.3em] text-[#dff5e5]/40">
        поколение
      </p>
      <p className="font-display text-[42px] leading-[0.95] text-[#dff5e5] [text-shadow:0_0_28px_rgba(78,240,138,0.28)] sm:text-[52px] md:text-[58px]">
        {String(generation).padStart(2, '0')}
      </p>
      <p className="mt-2.5 font-mono text-[10px] tracking-wide text-[#8fb89c]/75">
        ветвей {grafts} · пульсов {pulses} · общая энергия {energy}
      </p>
    </div>
  )
}

/* ------------------------------ шкала энергии ------------------------------ */

export function EnergyScale({ value }: { value: number }): React.JSX.Element {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#8fb89c]/50"
        style={{ writingMode: 'vertical-rl' }}
      >
        энергия
      </span>
      <div className="relative h-32 w-[6px] border border-[#4ef08a]/20 bg-[#07150d]/80 md:h-48">
        <div
          className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#1e7a45] via-[#2fae63] to-[#4ef08a] shadow-[0_0_14px_rgba(78,240,138,0.55)]"
          style={{ height: `${pct}%`, transition: 'height 160ms linear' }}
        />
        {[40, 100].map((v) => (
          <span
            key={v}
            className="absolute -right-1 h-px w-2 bg-[#4ef08a]/40"
            style={{ bottom: `${v}%` }}
          />
        ))}
      </div>
      <span className="font-mono text-sm tabular-nums text-[#4ef08a] [text-shadow:0_0_10px_rgba(78,240,138,0.5)]">
        {value}
      </span>
      <span className="font-mono text-[8px] text-[#5c8a6c]">из 100</span>
    </div>
  )
}

/* ------------------------------- кнопки действий --------------------------- */

interface ActionBarProps {
  graftMode: boolean
  canGraft: boolean
  canPulse: boolean
  pulseLock: boolean
  onGraft: () => void
  onPulse: () => void
  hintRef: RefObject<HTMLSpanElement | null>
  readoutRef: RefObject<HTMLSpanElement | null>
}

export function ActionBar({
  graftMode,
  canGraft,
  canPulse,
  pulseLock,
  onGraft,
  onPulse,
  hintRef,
  readoutRef,
}: ActionBarProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onGraft}
          className={
            graftMode
              ? 'border border-[#e8b34d]/70 bg-[#e8b34d]/10 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#e8b34d] shadow-[0_0_18px_rgba(232,179,77,0.15)] transition-all hover:bg-[#e8b34d]/20'
              : canGraft
                ? 'border border-[#4ef08a]/40 bg-[#4ef08a]/5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#9ff2bf] transition-all hover:border-[#4ef08a]/80 hover:bg-[#4ef08a]/10 hover:text-[#4ef08a]'
                : 'cursor-not-allowed border border-[#4ef08a]/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#4ef08a]/30'
          }
        >
          {graftMode ? 'Отмена · esc' : `Привить ветвь · 40`}
        </button>
        <button
          type="button"
          onClick={onPulse}
          disabled={pulseLock}
          className={
            pulseLock
              ? 'cursor-wait border border-[#4ef08a]/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#4ef08a]/30'
              : canPulse
                ? 'border border-[#4ef08a]/40 bg-[#4ef08a]/5 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#9ff2bf] transition-all hover:border-[#4ef08a]/80 hover:bg-[#4ef08a]/10 hover:text-[#4ef08a]'
                : 'cursor-not-allowed border border-[#4ef08a]/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#4ef08a]/30'
          }
        >
          {pulseLock ? 'Волна идёт' : 'Пульс · 10'}
        </button>
      </div>
      <p className="flex flex-wrap items-center justify-center gap-1.5 font-mono text-[10px] text-[#8fb89c]/60">
        <span ref={hintRef}>
          {graftMode
            ? 'клик по существу — точка прививки'
            : !canGraft
              ? 'движение пополняет запас'
              : 'движение и присутствие наполняют энергию внимания'}
        </span>
        <span ref={readoutRef} className="hidden font-mono text-[10px] text-[#e8b34d]/80" />
      </p>
    </div>
  )
}

/* --------------------------------- лента ----------------------------------- */

export interface FeedEntry {
  key: string
  actor: string
  mine: boolean
  action: string
  at: number
}

export const FeedList = memo(function FeedList({
  entries,
  now,
}: {
  entries: FeedEntry[]
  now: number
}): React.JSX.Element {
  return (
    <div className="org-scroll max-h-96 overflow-y-auto" aria-live="polite">
      {entries.length === 0 ? (
        <p className="px-3 py-4 font-mono text-[10px] leading-relaxed text-[#8fd8ac]/35">
          Тишина. Существо ждёт первой мутации.
        </p>
      ) : (
        entries.map((e) => (
          <div
            key={e.key}
            className="flex items-baseline gap-2 border-b border-[#4ef08a]/8 px-3 py-[7px] font-mono text-[11px] leading-tight last:border-b-0"
          >
            <span className={e.mine ? 'text-[#e8b34d]' : 'text-[#4ef08a]'}>{e.actor}</span>
            <span className="min-w-0 flex-1 truncate text-[#a9cdb4]/75">{e.action}</span>
            <span className="whitespace-nowrap text-[#5c8a6c]">{relTime(e.at, now)}</span>
          </div>
        ))
      )}
    </div>
  )
})

export function FeedPanel({ entries, now }: { entries: FeedEntry[]; now: number }): React.JSX.Element {
  return (
    <div className="pointer-events-auto absolute right-4 top-16 z-20 hidden w-[288px] flex-col border border-[#4ef08a]/15 bg-[#03100a]/70 backdrop-blur-md md:flex">
      <div className="flex items-center justify-between border-b border-[#4ef08a]/15 px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#4ef08a]/80">
          Лента мутаций
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[#5c8a6c]">{entries.length}</span>
      </div>
      <FeedList entries={entries} now={now} />
    </div>
  )
}

export function FeedSheet({
  entries,
  now,
  open,
  onClose,
}: {
  entries: FeedEntry[]
  now: number
  open: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <div
      className={
        open
          ? 'absolute inset-x-0 bottom-0 z-30 border-t border-[#4ef08a]/25 bg-[#03100a]/95 backdrop-blur-md md:hidden'
          : 'pointer-events-none absolute inset-x-0 bottom-0 z-30 translate-y-full border-t border-[#4ef08a]/25 bg-[#03100a]/95 backdrop-blur-md transition-transform duration-300 md:hidden'
      }
      aria-hidden={!open}
    >
      <div className="flex items-center justify-between border-b border-[#4ef08a]/15 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#4ef08a]/80">
          Лента мутаций · {entries.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto border border-[#4ef08a]/25 px-2 py-0.5 font-mono text-[10px] text-[#9ff2bf]"
        >
          скрыть
        </button>
      </div>
      <div className="org-scroll max-h-56 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        <FeedList entries={entries} now={now} />
      </div>
    </div>
  )
}

/* ------------------------------ визитор-бейдж ------------------------------ */

interface VisitorBadgeProps {
  visitorId: string
  sessionGrafts: number
  sessionPulses: number
}

export function VisitorBadge({ visitorId, sessionGrafts, sessionPulses }: VisitorBadgeProps): React.JSX.Element {
  return (
    <div className="pointer-events-none text-right">
      <p className="font-mono text-[10px] text-[#8fb89c]/60">
        вы — <span className="text-[#4ef08a]">гость #{visitorId}</span>
      </p>
      <p className="mt-1 font-mono text-[10px] text-[#5c8a6c]">
        за сессию: ветвей {sessionGrafts} · пульсов {sessionPulses}
      </p>
    </div>
  )
}

/* ------------------------------ инфо-оверлей ------------------------------- */

export function InfoOverlay({ onClose }: { onClose: () => void }): React.JSX.Element {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[#020a06]/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Организм — о эксперименте"
    >
      <div
        className="org-scroll max-h-[86vh] w-full max-w-2xl overflow-y-auto border border-[#4ef08a]/20 bg-[#04130c]/95 p-6 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#4ef08a]/75">
              Эксп. 05 · Организм
            </p>
            <h2 className="mt-2 font-display text-2xl text-[#dff5e5] sm:text-3xl">
              Одно существо на всех
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-[#dff5e5]/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#dff5e5]/70 transition-colors hover:border-[#4ef08a]/60 hover:text-[#4ef08a]"
          >
            закрыть
          </button>
        </div>

        <p className="mt-6 font-serif text-lg leading-relaxed text-[#d7ecd9]">
          Это цифровое существо живёт на сервере, и оно одно на всех посетителей поля. Каждая
          прививка каждого гостя записывается в общую базу и навсегда меняет его форму. Всё, что
          вы видите на экране, выросло из действий других людей — а ваши действия останутся в
          организме после того, как вы уйдёте. Существо взрослеет поколениями: каждые двенадцать
          прививок — новое поколение.
        </p>

        <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[#e8b34d]/90">
          Технологии
        </h3>
        <ul className="mt-3 space-y-1.5 font-mono text-[11px] leading-relaxed text-[#a9cdb4]/80">
          <li>— Canvas 2D без графических библиотек: тысячи сегментов батчатся в единственные stroke-вызовы</li>
          <li>— Детерминированный рост: форма каждой ветви вычисляется seeded-генератором (mulberry32) из идентификатора мутации в базе — существо одинаково собирается у всех</li>
          <li>— Энергия внимания: внутренняя валюта сессии, пополняется движением курсора, присутствием и кликами</li>
          <li>— Синхронизация поллингом каждые 5 секунд; персистентность — Prisma и SQLite</li>
        </ul>

        <h3 className="mt-8 font-mono text-[10px] uppercase tracking-[0.3em] text-[#e8b34d]/90">
          Что попробовать
        </h3>
        <ol className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-[#cdeed6]/85">
          <li>1. Подвигайте мышью — вертикальная шкала слева начнёт наполняться зелёным светом.</li>
          <li>2. Накопите 40 и привейте ветвь: выберите точку на теле существа.</li>
          <li>3. Пошлите пульс — волна вздрогнет по всем ветвям сразу.</li>
          <li>4. Наведите курсор на ветвь, чтобы узнать, кто её привил и когда.</li>
          <li>5. Перезагрузите страницу — организм помнит. Откройте сайт в двух вкладках и следите, как чужие прививки прорастают на ваших глазах.</li>
        </ol>

        <p className="mt-8 border-t border-[#4ef08a]/10 pt-4 font-mono text-[10px] leading-relaxed text-[#5c8a6c]">
          Эксперимент 05 из серии «Поле опытов» — пять радикально разных сайтов о будущем веба.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------ прочие баннеры ----------------------------- */

export function OfflineBanner(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-30 -translate-x-1/2 border border-[#e8b34d]/40 bg-[#1a1206]/85 px-4 py-1.5 font-mono text-[10px] tracking-[0.14em] text-[#e8b34d] backdrop-blur-sm">
      Связь с бездной потеряна — наблюдаю локальную копию
    </div>
  )
}

export function ToastView({ text }: { text: string }): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute bottom-[92px] left-1/2 z-30 w-max max-w-[86vw] -translate-x-1/2 md:bottom-24">
      <div className="org-toast border-l-2 border-[#4ef08a] bg-[#03100a]/90 px-4 py-2 font-mono text-[11px] text-[#cdeed6] shadow-[0_0_24px_rgba(0,0,0,0.5)] backdrop-blur-sm">
        {text}
      </div>
    </div>
  )
}

export function EmptyHint(): React.JSX.Element {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[38%] z-10 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-6 text-center">
      <p className="font-serif text-xl italic leading-snug text-[#d7ecd9]/90 sm:text-2xl">
        Оно только родилось.
        <br />
        Первая прививка — ваша.
      </p>
      <p className="mt-3 font-mono text-[10px] tracking-[0.14em] text-[#8fb89c]/60">
        подвигайте курсором — и шкала энергии слева наполнится
      </p>
    </div>
  )
}

export function TooltipView({
  boxRef,
  visitor,
  at,
  now,
}: {
  boxRef: RefObject<HTMLDivElement | null>
  visitor: string
  at: number
  now: number
}): React.JSX.Element {
  return (
    <div
      ref={boxRef}
      className="pointer-events-none absolute left-0 top-0 z-30 border border-[#4ef08a]/30 bg-[#03100a]/92 px-2.5 py-1.5 font-mono text-[10px] whitespace-nowrap text-[#cdeed6] backdrop-blur-sm"
    >
      привил <span className="text-[#4ef08a]">{visitor}</span>
      <span className="text-[#5c8a6c]"> · {relTime(at, now)}</span>
    </div>
  )
}

/* --------------------------------- boot ------------------------------------ */

/**
 * Boot-«пробуждение»: анимированные линии-щупальца.
 * // maturity — число щупалец растёт с поколением организма.
 */
export function BootScreen({ generation }: { generation: number }): React.JSX.Element {
  const tentacles = Math.min(9, 3 + Math.max(1, generation))
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-7 bg-[#05130c]">
      <div className="flex h-20 items-end gap-2.5" aria-hidden="true">
        {Array.from({ length: tentacles }, (_, i) => (
          <span
            key={i}
            className="org-tentacle block w-px bg-gradient-to-t from-[#4ef08a]/10 via-[#2fae63]/70 to-[#4ef08a]"
            style={{ height: `${34 + ((i * 37) % 46)}px`, animationDelay: `${i * 0.13}s` }}
          />
        ))}
      </div>
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#4ef08a]/75">
          Организм · Эксп. 05
        </p>
        <p className="org-pulse-soft mt-2 font-mono text-[10px] tracking-[0.2em] text-[#8fb89c]/60">
          пробуждение
        </p>
      </div>
    </div>
  )
}
