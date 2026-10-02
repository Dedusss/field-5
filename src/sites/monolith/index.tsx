'use client'

/**
 * ЭКСП. 01 «МОНОЛИТ» — точка входа.
 *
 * Слои: canvas-хост (MonolithRenderer) → Hud (z-10) → FinalOverlay (z-30) →
 * InfoOverlay (z-40) → FailGate/BootGate (z-50). Глубина и прогресс восхождения
 * прокидываются в HUD императивно через ref — ни одного setState на кадр.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { MonolithRenderer } from './renderer'
import Hud from './Hud'
import InfoOverlay from './InfoOverlay'
import FinalOverlay from './FinalOverlay'
import { BootGate, FailGate } from './Overlays'
import './monolith.css'

type Boot = 'wait' | 'fade' | 'done'

interface FinalStats {
  depth: number
  seconds: number
}

const BOOT_FADE_MS = 780

export default function MonolithSite({ onExit }: { onExit: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MonolithRenderer | null>(null)
  const depthRef = useRef<HTMLSpanElement>(null)
  const ascendRef = useRef<HTMLDivElement>(null)

  const [boot, setBoot] = useState<Boot>('wait')
  const [failed, setFailed] = useState<string | null>(null)
  const [captured, setCaptured] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [hintVisible, setHintVisible] = useState(true)
  const [infoOpen, setInfoOpen] = useState(false)
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null)
  const [touchHint] = useState<boolean>(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(pointer: coarse)').matches,
  )

  // Зеркала для колбэков рендерера и разовых порогов (без перерисовок на кадр).
  const fpsRef = useRef(0)
  const bootTimerRef = useRef(0)
  const firstFrameRef = useRef(false)
  const finalOpenRef = useRef(false)
  const lastDepthRef = useRef(-1)
  const lastAscendRef = useRef(-1)

  // ---------------------------------------------------------------- монтирование
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let renderer: MonolithRenderer | null = null

    // Инициализацию уводим на следующий тик: бут-экран успевает отрисоваться,
    // сбои (нет WebGL2, компиляция шейдера) репортятся из колбэка таймера.
    const initTimer = window.setTimeout(() => {
      // Проверка WebGL2 ДО создания рендерера; пробный контекст освобождаем.
      const probe = document.createElement('canvas')
      const gl2 = probe.getContext('webgl2')
      probe.remove()
      gl2?.getExtension('WEBGL_lose_context')?.loseContext()
      if (!gl2) {
        setFailed('браузер не отдал контекст WebGL2')
        return
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      try {
        renderer = new MonolithRenderer(host, reduced, {
          onFrame: (s) => {
            if (!firstFrameRef.current) {
              firstFrameRef.current = true
              setBoot('fade')
              bootTimerRef.current = window.setTimeout(
                () => setBoot('done'),
                BOOT_FADE_MS,
              )
            }
            // Глубина: лёгкая запись в DOM по порогу 1 м.
            const d = Math.floor(s.depth)
            if (d !== lastDepthRef.current) {
              lastDepthRef.current = d
              const el = depthRef.current
              if (el) el.textContent = String(d).padStart(3, '0')
            }
            // Прогресс восхождения — вертикальная шкала справа.
            const p = s.ascendProg
            if (Math.abs(p - lastAscendRef.current) > 0.003) {
              lastAscendRef.current = p
              const bar = ascendRef.current
              if (bar) {
                bar.style.transform = `scaleY(${p.toFixed(3)})`
                bar.style.opacity = p > 0.004 ? '1' : '0'
              }
            }
            // FPS живёт в ref, HUD не перерисовываем.
            fpsRef.current = s.fps
          },
          onCapture: (count) => {
            setCaptured(count)
            setFlashKey((k) => k + 1)
          },
          onFirstInput: () => setHintVisible(false),
          onAscendStart: () => setHintVisible(false),
          onAscendDone: (depthMeters, seconds) => {
            rendererRef.current?.setInputEnabled(false)
            finalOpenRef.current = true
            setInfoOpen(false)
            setFinalStats({ depth: Math.round(depthMeters), seconds })
          },
        })
      } catch (err) {
        // Частично созданный рендерер мог оставить canvas в хосте — чистим.
        host.replaceChildren()
        setFailed(
          err instanceof Error
            ? err.message
            : 'не удалось инициализировать сцену WebGL2',
        )
        return
      }
      rendererRef.current = renderer
    }, 0)

    return () => {
      window.clearTimeout(initTimer)
      window.clearTimeout(bootTimerRef.current)
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [])

  // Ввод рендерера синхронизируем с модальными оверлеями.
  useEffect(() => {
    if (failed) return
    const r = rendererRef.current
    if (!r) return
    if (infoOpen) r.setInputEnabled(false)
    else if (!finalOpenRef.current) r.setInputEnabled(true)
  }, [infoOpen, failed])

  // Esc — закрыть инфо-оверлей; если закрыт — ничего.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setInfoOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---------------------------------------------------------------- колбэки UI
  const openInfo = useCallback(() => setInfoOpen(true), [])
  const closeInfo = useCallback(() => setInfoOpen(false), [])
  const handleContinue = useCallback(() => {
    finalOpenRef.current = false
    setFinalStats(null)
    rendererRef.current?.beginEndless()
  }, [])

  return (
    <div
      aria-label="Эксперимент 01 — Монолит: пустошь одного шейдера"
      className="monolith-root fixed inset-0 z-40 overflow-hidden bg-[#0b0a09]"
    >
      {/* Хост canvas: рендерер сам создаёт и убирает канвас. */}
      <div ref={hostRef} className="absolute inset-0" aria-hidden="true" />

      {!failed && (
        <Hud
          depthRef={depthRef}
          ascendRef={ascendRef}
          captured={captured}
          flashKey={flashKey}
          hintVisible={hintVisible}
          touchHint={touchHint}
          onInfo={openInfo}
          onExit={onExit}
        />
      )}

      {finalStats && (
        <FinalOverlay
          depth={finalStats.depth}
          seconds={finalStats.seconds}
          onContinue={handleContinue}
          onExit={onExit}
        />
      )}

      {infoOpen && <InfoOverlay onClose={closeInfo} />}

      {failed && <FailGate msg={failed} onExit={onExit} />}

      {!failed && boot !== 'done' && (
        <BootGate label="прогрев шейдеров" fade={boot === 'fade'} />
      )}
    </div>
  )
}
