'use client'

/**
 * ЭКСП. 03 — HUD Архива: верхняя панель, точки экспонатов, карточка,
 * инфо-оверлей, boot-экран, фолбэк без GPU.
 * Единственная светлая палитра сетки: кость / терракота / чернила.
 */

import { useEffect, useState } from 'react'
import { SCULPTURES } from './sculptures'
import type { ExhibitInfo } from './theme'

/* ------------------------------------------------------------------ */
/* Верхняя панель                                                     */
/* ------------------------------------------------------------------ */

export function TopBar({
  onExit,
  onInfo,
  visitedCount,
}: {
  onExit: () => void
  onInfo: () => void
  visitedCount: number
}) {
  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-4 flex items-center gap-4 md:left-6 md:top-6">
        <button
          onClick={onExit}
          className="rounded-sm border border-[#2b2118]/20 bg-[#efe6d4]/60 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#2b2118]/80 backdrop-blur-sm transition-colors hover:border-[#c4592f] hover:bg-[#c4592f] hover:text-[#efe9dc]"
        >
          ← ПОЛЕ ОПЫТОВ
        </button>
        <div className="hidden sm:block">
          <div className="font-display text-[13px] tracking-[0.06em] text-[#2b2118]">
            АРХИВ НЕВОЗМОЖНОГО
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.32em] text-[#c4592f]">
            ЭКСП. 03 · ARCHIVE OF IMPOSSIBLE THINGS
          </div>
        </div>
      </div>
      <div className="pointer-events-auto absolute right-4 top-4 flex items-center gap-3 md:right-6 md:top-6">
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-[#2b2118]/60 sm:inline">
          осмотрено {visitedCount}/9
        </span>
        <span className="font-mono text-[10px] tracking-[0.2em] text-[#c4592f] sm:hidden">
          {visitedCount}/9
        </span>
        <button
          onClick={onInfo}
          aria-label="О эксперименте"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#2b2118]/25 bg-[#efe6d4]/60 font-serif text-lg italic leading-none text-[#2b2118]/80 backdrop-blur-sm transition-colors hover:border-[#c4592f] hover:bg-[#c4592f] hover:text-[#efe9dc] hover:italic"
        >
          ?
        </button>
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Точки-индикатор экспонатов (кликабельны — полёт к экспонату)        */
/* ------------------------------------------------------------------ */

export function Dots({
  visited,
  current,
  onPick,
}: {
  visited: ReadonlySet<string>
  current: number
  onPick: (i: number) => void
}) {
  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 md:bottom-6">
      {SCULPTURES.map((s, i) => {
        const isVisited = visited.has(s.id)
        const isCurrent = i === current
        return (
          <button
            key={s.id}
            onClick={() => onPick(i)}
            title={s.ru}
            aria-label={s.ru}
            className={[
              'h-2.5 w-2.5 rounded-full border transition-all duration-300',
              isVisited
                ? 'border-[#c4592f] bg-[#c4592f]'
                : 'border-[#2b2118]/30 bg-transparent hover:border-[#c4592f]/60',
              isCurrent ? 'scale-[1.7] border-[#c4592f] shadow-[0_0_0_3px_rgba(196,89,47,0.18)]' : '',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Подсказка режима                                                   */
/* ------------------------------------------------------------------ */

export function ModeHint({ mode }: { mode: string }) {
  const text =
    mode === 'orbit'
      ? 'орбита · драг — вращение · колесо — дистанция · esc — отпустить'
      : mode === 'drift'
        ? 'дрейф · задержите курсор на скульптуре — притянет · клик — полёт · края экрана / wasd — курс'
        : mode === 'flight'
          ? 'полёт к экспонату'
          : 'возврат в дрейф'
  return (
    <div className="pointer-events-none absolute bottom-4 left-4 hidden max-w-[240px] font-mono text-[9px] uppercase leading-relaxed tracking-[0.22em] text-[#2b2118]/45 md:bottom-6 md:left-6 lg:block">
      {text}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Карточка экспоната                                                 */
/* ------------------------------------------------------------------ */

export function ExhibitCard({
  info,
  onReseed,
  onPrev,
  onNext,
  onRelease,
}: {
  info: ExhibitInfo
  onReseed: () => void
  onPrev: () => void
  onNext: () => void
  onRelease: () => void
}) {
  return (
    <div
      key={info.id + info.seedHex}
      className="card-in pointer-events-auto absolute inset-x-0 bottom-0 z-10 border-t border-[#2b2118]/15 bg-[#efe9dc]/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md md:inset-x-auto md:bottom-24 md:w-[560px] md:-translate-x-1/2 md:left-1/2 md:rounded-sm md:border md:border-[#2b2118]/12 md:px-7 md:py-6 md:pb-5 md:shadow-[0_18px_50px_-18px_rgba(43,33,24,0.35)]"
    >
      <div className="px-5 md:px-0">
        <div className="mb-1 flex items-baseline justify-between gap-3 font-mono text-[9px] uppercase tracking-[0.3em]">
          <span className="text-[#c4592f]">
            экспонат {String(info.index + 1).padStart(2, '0')}/09
          </span>
          <span className="text-[#2b2118]/45">
            семя <span className="text-[#2b2118]/75">{info.seedHex}</span>
          </span>
        </div>
        <h2 className="font-serif text-[26px] italic leading-[1.05] text-[#2b2118] md:text-[34px]">
          {info.ru}
        </h2>
        <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.36em] text-[#2b2118]/40">
          {info.latin}
        </div>
        <p className="mb-3 text-[12.5px] leading-snug text-[#2b2118]/70 md:text-[13.5px]">{info.algo}</p>

        <div
          data-hud-scroll
          className="mb-3 grid max-h-[104px] grid-cols-2 gap-x-5 gap-y-1 overflow-y-auto pr-1 font-mono text-[10px] leading-tight md:max-h-none md:grid-cols-3"
        >
          {info.params.map((p) => (
            <div key={p.label} className="flex items-baseline justify-between gap-2 border-b border-[#2b2118]/8 pb-0.5">
              <span className="text-[#2b2118]/45">{p.label}</span>
              <span className="text-right text-[#2b2118]/90">{p.value}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onReseed}
            className="rounded-sm border border-[#c4592f]/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#c4592f] transition-colors hover:bg-[#c4592f] hover:text-[#efe9dc]"
          >
            Пересеять · {info.seedHex.slice(0, 4)}
          </button>
          <div className="mx-auto flex gap-2 md:mx-0 md:ml-auto">
            <button
              onClick={onPrev}
              className="rounded-sm border border-[#2b2118]/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2b2118]/70 transition-colors hover:border-[#2b2118]/50"
            >
              ← пред.
            </button>
            <button
              onClick={onNext}
              className="rounded-sm border border-[#2b2118]/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2b2118]/70 transition-colors hover:border-[#2b2118]/50"
            >
              след. →
            </button>
            <button
              onClick={onRelease}
              className="rounded-sm border border-[#2b2118]/20 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2b2118]/70 transition-colors hover:border-[#c4592f] hover:text-[#c4592f]"
            >
              отпустить · esc
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Вступительная подпись                                              */
/* ------------------------------------------------------------------ */

export function IntroLine({ visible }: { visible: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 top-[38%] flex -translate-y-1/2 flex-col items-center gap-3 px-6 text-center transition-opacity duration-[1400ms] ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div className="font-mono text-[9px] uppercase tracking-[0.4em] text-[#c4592f]">
        эксп. 03 · архив невозможного
      </div>
      <div className="font-serif text-[26px] italic leading-tight text-[#2b2118]/85 md:text-4xl">
        Девять невозможных вещей.
        <br />
        Ваше внимание — навигация.
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Boot-экран: честная сборка скульптур                               */
/* ------------------------------------------------------------------ */

export function BootScreen({ done, total, fading }: { done: number; total: number; fading: boolean }) {
  const label = done > 0 ? SCULPTURES[Math.min(done, total) - 1].ru : 'пространство'
  return (
    <div
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-[#efe6d4] transition-opacity duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="h-2 w-2 animate-pulse rounded-full bg-[#c4592f]" />
      <div className="text-center">
        <div className="font-display text-lg tracking-[0.1em] text-[#2b2118] md:text-2xl">
          АРХИВ НЕВОЗМОЖНОГО
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.4em] text-[#2b2118]/50">
          exp. 03 · archive of impossible things
        </div>
      </div>
      <div className="flex w-56 flex-col items-center gap-3">
        <div className="h-px w-full overflow-hidden bg-[#2b2118]/12">
          <div
            className="h-full bg-[#c4592f] transition-[width] duration-300 ease-out"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#c4592f]">
          сборка скульптур {done}/{total} · {label.toLowerCase()}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Инфо-оверлей «?»                                                   */
/* ------------------------------------------------------------------ */

export function InfoOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-[#2b2118]/25 px-4 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="card-in max-h-[86vh] w-full max-w-xl overflow-y-auto rounded-sm border border-[#2b2118]/15 bg-[#efe9dc] p-6 shadow-[0_24px_70px_-20px_rgba(43,33,24,0.45)] md:p-8"
        onClick={(e) => e.stopPropagation()}
        data-hud-scroll
      >
        <div className="mb-1 font-mono text-[9px] uppercase tracking-[0.34em] text-[#c4592f]">
          эксп. 03 · о эксперименте
        </div>
        <h2 className="mb-4 font-serif text-3xl italic leading-tight text-[#2b2118]">
          Архив невозможного
        </h2>
        <div className="space-y-3 text-[13.5px] leading-relaxed text-[#2b2118]/75">
          <p>
            Галерея из девяти процедурных скульптур, парящих в тёплом молоке тумана. Здесь нет
            полок и стендов: каждое тело — чистый алгоритм, от ленты Клейна до города Вороного,
            выращенный из 32-битного семени.
          </p>
          <p>
            Навигация — «гравитация внимания». Камера дрейфует сама, но стоит задержать курсор
            на скульптуре — пространство притянет вас к ней. Клик — и вы уже на орбите
            экспоната, где карточка расскажет, из каких величин он собран.
          </p>
          <p className="font-mono text-[11px] uppercase leading-loose tracking-[0.14em] text-[#2b2118]/60">
            three.js r186 · buffergeometry · l-системы · суперформула · fbm-шум ·
            катмулл-ром · acesfilmic · srgb · fogexp2
          </p>
        </div>
        <div className="mt-5 border-t border-[#2b2118]/12 pt-4">
          <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#c4592f]">
            что попробовать
          </div>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-[#2b2118]/75">
            <li>— задержать курсор на скульптуре дольше полсекунды и позволить себе притянуться;</li>
            <li>— клик по телу: полёт на 1.6 секунды и орбитальный обход; колесо — дистанция;</li>
            <li>— «пересеять» экспонат: геометрия рождается заново прямо на глазах;</li>
            <li>— в дрейфе: края экрана и WASD добавляют вектор, свайп от края — импульс;</li>
            <li>— Esc или двойной клик отпускает камеру обратно в туман.</li>
          </ul>
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-sm border border-[#2b2118]/25 px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.28em] text-[#2b2118]/75 transition-colors hover:border-[#c4592f] hover:bg-[#c4592f] hover:text-[#efe9dc]"
        >
          закрыть · esc
        </button>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Фолбэк без GPU                                                     */
/* ------------------------------------------------------------------ */

export function GpuFallback({ onExit }: { onExit: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-5 bg-[#efe6d4] px-6 text-center">
      <div className="h-2 w-2 rounded-full bg-[#c4592f]" />
      <h2 className="font-display text-2xl tracking-[0.08em] text-[#2b2118] md:text-3xl">
        НУЖЕН GPU
      </h2>
      <p className="max-w-sm text-sm leading-relaxed text-[#2b2118]/70">
        Архив невозможного живёт в WebGL2: девять скульптур рисуются вашей видеокартой.
        Похоже, браузер не дал нам контекст — проверьте аппаратное ускорение или откройте
        эксперимент на другом устройстве.
      </p>
      <button
        onClick={onExit}
        className="rounded-sm border border-[#c4592f] px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#c4592f] transition-colors hover:bg-[#c4592f] hover:text-[#efe9dc]"
      >
        ← ПОЛЕ ОПЫТОВ
      </button>
    </div>
  )
}
