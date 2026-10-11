'use client'

/**
 * ЭКСП. 05 «ОРГАНИЗМ» — энергия внимания (клиентская сессия, 0..100).
 *
 * Наполнение: pointermove +0.4 за событие (не больше +8/с), тик присутствия
 * +1.5/с, клик по фону +2. Трата: прививка 40, пульс 10.
 *
 * Значение живёт в ref (без ререндеров на каждое движение мыши),
 * отображение синхронизируется 8 раз в секунду.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

export const ENERGY_MAX = 100
export const GRAFT_COST = 40
export const PULSE_COST = 10

const MOVE_PORTION = 0.4
const MOVE_PER_SEC = 8
const PRESENCE_PER_SEC = 1.5
const CLICK_BONUS = 2

export function useEnergy() {
  const valueRef = useRef(0)
  const [value, setValue] = useState(0)
  const moveBudget = useRef({ sec: -1, left: 0 })

  const addMovement = useCallback(() => {
    const now = performance.now()
    const sec = Math.floor(now / 1000)
    const b = moveBudget.current
    if (sec !== b.sec) {
      b.sec = sec
      b.left = MOVE_PER_SEC
    }
    if (b.left <= 0) return
    const portion = Math.min(MOVE_PORTION, b.left)
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
      valueRef.current = Math.min(ENERGY_MAX, valueRef.current + PRESENCE_PER_SEC)
    }, 1000)
    const sync = window.setInterval(() => {
      setValue(Math.round(valueRef.current))
    }, 120)
    return () => {
      window.clearInterval(presence)
      window.clearInterval(sync)
    }
  }, [])

  return { value, valueRef, addMovement, addClick, add, spend, refund }
}

export type EnergyApi = ReturnType<typeof useEnergy>
