'use client'

/**
 * ЭКСП. 05 «ОРГАНИЗМ» — энергия внимания (клиентская сессия, 0..100).
 *
 * Пробуждение (первые AWAKE_MS сессии): существо только что увидело вас —
 * присутствие и движение наполняют шкалу заметно быстрее, чтобы первая
 * прививка случилась прежде, чем гость заскучает. Дальше — рабочий темп.
 *
 * Рабочий темп: pointermove +0.5 за событие (не больше +8/с), тик
 * присутствия +1.9/с, клик по фону +2. Трата: прививка 40, пульс 10.
 *
 * Чужие действия (приходят поллингом) дают всплеск +6: чужое внимание
 * подогревает ваше — так сцена вознаграждает наблюдение за колонией.
 *
 * Значение живёт в ref (без ререндеров на каждое движение мыши),
 * отображение синхронизируется 8 раз в секунду.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const ENERGY_MAX = 100
export const GRAFT_COST = 40
export const PULSE_COST = 10

/** Длительность окна пробуждения, мс. */
const AWAKE_MS = 18_000
/** Присутствие: пробуждение / рабочий темп (в секунду). */
const AWAKE_PRESENCE = 3.4
const BASE_PRESENCE = 1.9
/** Движение: порция за событие и потолок в секунду. */
const AWAKE_PORTION = 0.5
const AWAKE_MOVE_CAP = 12
const BASE_PORTION = 0.4
const BASE_MOVE_CAP = 8
const CLICK_BONUS = 2
/** Всплеск от чужого действия (graft или pulse другого гостя). */
export const FOREIGN_BONUS = 6

export function useEnergy() {
  const valueRef = useRef(0)
  const [value, setValue] = useState(0)
  const [awake, setAwake] = useState(true)
  /** Счётчик всплесков от чужих действий — HUD мигает шкалой. */
  const [foreignPulse, setForeignPulse] = useState(0)
  const moveBudget = useRef({ sec: -1, left: 0 })
  const bornAt = useRef(performance.now())

  const addMovement = useCallback(() => {
    const now = performance.now()
    const sec = Math.floor(now / 1000)
    const b = moveBudget.current
    if (sec !== b.sec) {
      b.sec = sec
      b.left = now - bornAt.current < AWAKE_MS ? AWAKE_MOVE_CAP : BASE_MOVE_CAP
    }
    if (b.left <= 0) return
    const portion = Math.min(now - bornAt.current < AWAKE_MS ? AWAKE_PORTION : BASE_PORTION, b.left)
    b.left -= portion
    valueRef.current = Math.min(ENERGY_MAX, valueRef.current + portion)
  }, [])

  const addClick = useCallback(() => {
    valueRef.current = Math.min(ENERGY_MAX, valueRef.current + CLICK_BONUS)
  }, [])

  const add = useCallback((n: number) => {
    if (!Number.isFinite(n)) return
    valueRef.current = Math.min(ENERGY_MAX, Math.max(0, valueRef.current + n))
    setValue(Math.round(valueRef.current))
  }, [])

  /** Чужое действие в ленте: всплеск внимания. */
  const addForeign = useCallback(() => {
    valueRef.current = Math.min(ENERGY_MAX, valueRef.current + FOREIGN_BONUS)
    setValue(Math.round(valueRef.current))
    setForeignPulse((v) => v + 1)
  }, [])

  const spend = useCallback((n: number) => {
    if (valueRef.current < n) return false
    valueRef.current -= n
    setValue(Math.round(valueRef.current))
    return true
  }, [])

  const refund = useCallback((n: number) => {
    valueRef.current = Math.min(ENERGY_MAX, valueRef.current + n)
    setValue(Math.round(valueRef.current))
  }, [])

  // тик присутствия + синхронизация дисплея
  useEffect(() => {
    const presence = window.setInterval(() => {
      const rate = performance.now() - bornAt.current < AWAKE_MS ? AWAKE_PRESENCE : BASE_PRESENCE
      valueRef.current = Math.min(ENERGY_MAX, valueRef.current + rate)
    }, 1000)
    const sync = window.setInterval(() => {
      setValue(Math.round(valueRef.current))
      const stillAwake = performance.now() - bornAt.current < AWAKE_MS
      setAwake((prev) => (prev === stillAwake ? prev : stillAwake))
    }, 120)
    return () => {
      window.clearInterval(presence)
      window.clearInterval(sync)
    }
  }, [])

  return { value, valueRef, awake, foreignPulse, addMovement, addClick, add, addForeign, spend, refund }
}

export type EnergyApi = ReturnType<typeof useEnergy>
