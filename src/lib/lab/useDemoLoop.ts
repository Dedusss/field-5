'use client'

/**
 * ЛАБОРАТОРИЯ · FIELD·5 — RAF-цикл демо с вежливым жизненным циклом.
 *
 * Возможности:
 * - start/stop без накопления кадров: время демо течёт только пока рисуем;
 * - авто-пауза при document.hidden (вкладка в фоне не греет GPU),
 *   при возврате на вкладку цикл продолжается с места остановки;
 * - reduced-motion: вместо цикла рисуется один статичный кадр,
 *   параметры при этом продолжают работать (once).
 *
 * Хук не содержит состояния React: вся механика — в замыкании эффекта,
 * наружу отдаётся стабильный хэндл.
 */

import { useEffect, useMemo, useRef } from 'react'

/** Управление циклом демо. Методы стабильны между рендерами. */
export interface DemoLoopHandle {
  /** Запустить непрерывный цикл (при reduced — один статичный кадр). */
  start(): void
  /** Остановить цикл. Повторный start продолжает с того же времени. */
  stop(): void
  /** Нарисовать ровно один кадр, не запуская цикл (для reduced-режима). */
  once(): void
  /** Цикл сейчас активен. */
  running(): boolean
}

/** Предел длительности кадра (с) — защита от скачков времени после паузы. */
const MAX_DT = 1 / 20

/** Внутренняя механика цикла (живёт в замыкании эффекта). */
interface LoopImpl {
  start(): void
  stop(): void
  once(): void
  running(): boolean
}

const NOOP_IMPL: LoopImpl = {
  start: () => {},
  stop: () => {},
  once: () => {},
  running: () => false,
}

export function useDemoLoop(
  onFrame: (t: number, dt: number) => void,
  opts: { reduced: boolean },
): DemoLoopHandle {
  // Актуальный колбэк кадра — в ref, чтобы не пересоздавать механику.
  const cbRef = useRef(onFrame)
  useEffect(() => {
    cbRef.current = onFrame
  }, [onFrame])

  // Механика цикла — в ref: заполняется эффектом до первого использования.
  const implRef = useRef<LoopImpl>(NOOP_IMPL)

  const handle = useMemo<DemoLoopHandle>(
    () => ({
      start: () => implRef.current.start(),
      stop: () => implRef.current.stop(),
      once: () => implRef.current.once(),
      running: () => implRef.current.running(),
    }),
    [],
  )

  useEffect(() => {
    let raf = 0
    let want = false // «пользователь хочет непрерывный цикл»
    let running = false
    let t = 0 // время демо, секунды (идёт только вместе с кадрами)
    let last = 0

    const tick = (now: number): void => {
      raf = 0
      const dt = Math.min(Math.max((now - last) / 1000, 0), MAX_DT)
      last = now
      t += dt
      cbRef.current(t, dt)
      if (want && raf === 0) raf = requestAnimationFrame(tick)
      else running = false
    }

    const schedule = (): void => {
      if (raf !== 0) return
      last = performance.now()
      running = true
      raf = requestAnimationFrame(tick)
    }

    const cancel = (): void => {
      if (raf !== 0) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      running = false
    }

    implRef.current = {
      start() {
        if (opts.reduced) {
          // Reduced-motion: один статичный кадр, цикл не заводим.
          cbRef.current(t, 1 / 60)
          return
        }
        want = true
        schedule()
      },
      stop() {
        want = false
        cancel()
      },
      once() {
        if (raf !== 0) return // непрерывный цикл и так рисует
        cbRef.current(t, 1 / 60)
      },
      running() {
        return running
      },
    }

    const onVisibility = (): void => {
      if (document.hidden) cancel() // намерение (want) сохраняем
      else if (want) schedule()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      want = false
      cancel()
      implRef.current = NOOP_IMPL
    }
  }, [opts.reduced])

  return handle
}
