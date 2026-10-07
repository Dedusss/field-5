'use client'

/**
 * ЭКСП. 03 «АРХИВ НЕВОЗМОЖНОГО» — точка входа.
 * three.js-движок и HUD: гравитация внимания, полёты, карточки экспонатов.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArchiveEngine, hasWebGL2, installQaHook, type ArchiveMode } from './engine'
import { SCULPTURES } from './sculptures'
import type { ExhibitInfo } from './theme'
import { BootScreen, Dots, ExhibitCard, GpuFallback, InfoOverlay, IntroLine, ModeHint, TopBar } from './hud'

type Phase = 'boot' | 'ready' | 'failed'

export default function ArchiveSite({ onExit }: { onExit: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<ArchiveEngine | null>(null)

  const [phase, setPhase] = useState<Phase>(() =>
    typeof window !== 'undefined' && !hasWebGL2() ? 'failed' : 'boot',
  )
  const [bootGone, setBootGone] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: SCULPTURES.length })
  const [mode, setMode] = useState<ArchiveMode>('drift')
  const [card, setCard] = useState<ExhibitInfo | null>(null)
  const [visited, setVisited] = useState<Set<string>>(() => new Set())
  const [infoOpen, setInfoOpen] = useState(false)
  const [introVisible, setIntroVisible] = useState(true)

  /* движок: создание один раз, полный разбор при выходе */
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    if (!hasWebGL2()) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const engine = new ArchiveEngine(
      host,
      { reducedMotion: reduced },
      {
        onProgress: (done, total) => setProgress({ done, total }),
        onReady: () => setPhase('ready'),
        onMode: (m) => {
          setMode(m)
          if (m === 'flight') setIntroVisible(false)
        },
        onVisit: (id) =>
          setVisited((prev) => {
            if (prev.has(id)) return prev
            const next = new Set(prev)
            next.add(id)
            return next
          }),
        onCard: (info) => setCard(info),
      },
    )
    engineRef.current = engine
    installQaHook(engine)
    void engine.start()
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  /* boot-оверлей: fade, затем unmount */
  useEffect(() => {
    if (phase !== 'ready') return
    const t = setTimeout(() => setBootGone(true), 800)
    return () => clearTimeout(t)
  }, [phase])

  /* вступительная подпись гаснет через 5 c */
  useEffect(() => {
    if (phase !== 'ready') return
    const t = setTimeout(() => setIntroVisible(false), 5000)
    return () => clearTimeout(t)
  }, [phase])

  /* инфо-оверлей блокирует управление сценой; Esc закрывает */
  useEffect(() => {
    engineRef.current?.setUiBlocked(infoOpen)
    if (!infoOpen) return
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [infoOpen])

  const flyTo = useCallback((i: number) => engineRef.current?.flyToIndex(i), [])
  const release = useCallback(() => engineRef.current?.release(), [])
  const reseed = useCallback(() => engineRef.current?.reseedCurrent(), [])
  const next = useCallback(() => {
    if (!card) return
    engineRef.current?.flyToIndex((card.index + 1) % SCULPTURES.length)
  }, [card])
  const prev = useCallback(() => {
    if (!card) return
    engineRef.current?.flyToIndex((card.index - 1 + SCULPTURES.length) % SCULPTURES.length)
  }, [card])

  const current = mode === 'orbit' && card ? card.index : -1

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden bg-[#efe6d4] font-sans text-[#2b2118]">
      {/* локальные keyframes карточек (глобальные стили проекта не трогаем) */}
      <style>{`
        @keyframes archiveCardIn {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-in { animation: archiveCardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (min-width: 768px) {
          .card-in { animation-name: archiveCardInDesktop; }
          @keyframes archiveCardInDesktop {
            from { opacity: 0; transform: translate(-50%, 18px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        }
      `}</style>

      {/* three.js canvas + подписи + хинт (движок) */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0">
        <TopBar onExit={onExit} onInfo={() => setInfoOpen(true)} visitedCount={visited.size} />
        {phase === 'ready' && <IntroLine visible={introVisible && mode === 'drift'} />}
        {phase === 'ready' && <ModeHint mode={mode} />}
        <Dots visited={visited} current={current} onPick={flyTo} />
        {card && mode === 'orbit' && (
          <ExhibitCard info={card} onReseed={reseed} onPrev={prev} onNext={next} onRelease={release} />
        )}
      </div>

      {!bootGone && (
        <BootScreen
          done={phase === 'ready' ? progress.total : progress.done}
          total={progress.total}
          fading={phase === 'ready'}
        />
      )}
      {infoOpen && <InfoOverlay onClose={() => setInfoOpen(false)} />}
      {phase === 'failed' && <GpuFallback onExit={onExit} />}
    </div>
  )
}
