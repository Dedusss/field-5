'use client'

/**
 * ЛАБОРАТОРИЯ · FIELD·5 — карточка-прибор.
 *
 * Устройство карточки:
 *  - шапка: индекс L·NN, название, латиница, чип категории;
 *  - живой экран: canvas 4:3, рендер стартует по IntersectionObserver
 *    и полностью разбирается при уходе из вьюпорта (пауза = teardown);
 *  - панель параметров: слайдеры/тумблеры/сегменты из ParamDef демо;
 *  - футер: что показывает прибор + техническая начинка.
 *
 * Курсор пишется прямо в объект демо (inst.pointer) — без ререндеров React.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoInstance, DemoModule, ParamDef, ParamValue } from '@/lib/lab/types'
import { useDemoLoop } from '@/lib/lab/useDemoLoop'
import { CATEGORY_META } from './demos'

interface LabCardProps {
  demo: DemoModule
  index: number
  reduced: boolean
}

/** Отформатированное значение параметра для приборной панели. */
function formatValue(p: ParamDef, v: ParamValue): string {
  if (typeof v === 'boolean') return v ? 'ВКЛ' : 'ВЫКЛ'
  if (typeof v === 'number') {
    const step = p.step ?? 1
    if (step >= 1) return String(Math.round(v))
    return v.toFixed(step >= 0.1 ? 1 : 2)
  }
  const opt = p.options?.find((o) => o.value === v)
  return opt?.label ?? v
}

export default function LabCard({ demo, index, reduced }: LabCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const instRef = useRef<DemoInstance | null>(null)
  const [visible, setVisible] = useState(false)

  const [params, setParams] = useState<Record<string, ParamValue>>(() =>
    Object.fromEntries(demo.params.map((p) => [p.key, p.value])),
  )
  const paramsRef = useRef(params)
  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const loop = useDemoLoop((t, dt) => instRef.current?.frame(t, dt), { reduced })

  // Жизненный цикл демо: видима → создать и запустить; скрыта → полный teardown.
  useEffect(() => {
    if (!visible) return
    const canvas = canvasRef.current
    if (!canvas) return
    let inst: DemoInstance
    try {
      inst = demo.create(canvas, paramsRef.current, { reduced })
    } catch (err) {
      console.error(`lab/${demo.id}: не удалось создать демо`, err)
      return
    }
    instRef.current = inst
    loop.start()
    return () => {
      loop.stop()
      instRef.current = null
      inst.destroy()
    }
  }, [visible, demo, reduced, loop])

  // Видимость: старт/пауза рендера по вьюпорту (с запасом на предпрогрев).
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) setVisible(en.isIntersecting)
      },
      { rootMargin: '160px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Размер: подгонка демо под контейнер.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      instRef.current?.resize?.()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Курсор: пишем позицию и состояние кнопки в слот демо.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const apply = (e: PointerEvent): void => {
      const inst = instRef.current
      if (!inst?.pointer) return
      const r = canvas.getBoundingClientRect()
      inst.pointer.x = e.clientX - r.left
      inst.pointer.y = e.clientY - r.top
    }
    const onMove = (e: PointerEvent): void => apply(e)
    const onDown = (e: PointerEvent): void => {
      canvas.setPointerCapture(e.pointerId)
      apply(e)
      const inst = instRef.current
      if (inst?.pointer) inst.pointer.down = true
    }
    const onUp = (e: PointerEvent): void => {
      apply(e)
      const inst = instRef.current
      if (inst?.pointer) inst.pointer.down = false
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onLeave = (): void => {
      const inst = instRef.current
      if (!inst?.pointer) return
      inst.pointer.x = -9999
      inst.pointer.y = -9999
      inst.pointer.down = false
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  const setParamValue = useCallback(
    (key: string, value: ParamValue) => {
      setParams((prev) => ({ ...prev, [key]: value }))
      instRef.current?.setParam(key, value)
      if (reduced) loop.once() // статичный кадр, но параметры работают
    },
    [loop, reduced],
  )

  const cat = CATEGORY_META[demo.category]
  const idx = `L·${String(index + 1).padStart(2, '0')}`

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-white/[0.08] bg-[#14120f]/90 shadow-[0_10px_40px_rgba(0,0,0,0.35)] transition-colors duration-300 hover:border-white/[0.16]">
      {/* Шапка прибора */}
      <header className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-3">
        <span className="font-mono text-[10px] tracking-[0.18em] text-[#e8b34d]">{idx}</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[13px] font-semibold tracking-wide text-[#ece7dd]">
            {demo.title}
          </h3>
          <span className="block truncate font-mono text-[9px] uppercase tracking-[0.2em] text-[#5e574c]">
            {demo.latin}
          </span>
        </div>
        <span
          className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em]"
          style={{ borderColor: `${cat.color}38`, color: cat.color }}
        >
          <span className="block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
          {cat.label}
        </span>
      </header>

      {/* Живой экран */}
      <div ref={wrapRef} className="relative aspect-[4/3] w-full bg-black">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
          style={{ touchAction: 'pan-y' }}
          aria-label={`Живое демо «${demo.title}» — реагирует на курсор`}
          role="img"
        />
        {/* приборные уголки */}
        <span className="pointer-events-none absolute left-1.5 top-1.5 h-2.5 w-2.5 border-l border-t border-white/25" />
        <span className="pointer-events-none absolute right-1.5 top-1.5 h-2.5 w-2.5 border-r border-t border-white/25" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-2.5 w-2.5 border-b border-l border-white/25" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-2.5 w-2.5 border-b border-r border-white/25" />
        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em]">
          <span
            className={`block h-1.5 w-1.5 rounded-full transition-colors ${
              visible ? 'bg-[#4ef08a]' : 'bg-white/25'
            }`}
          />
          <span className={visible ? 'text-[#9fe7bd]/80' : 'text-white/30'}>
            {visible ? 'живой' : 'пауза'}
          </span>
        </div>
      </div>

      {/* Панель параметров */}
      <div className="space-y-2.5 border-t border-white/[0.08] px-4 py-3.5">
        {demo.params.map((p) => (
          <div key={p.key} className="grid grid-cols-[104px_1fr_auto] items-center gap-3">
            <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-[#8b8175]">
              {p.label}
            </span>
            {p.kind === 'range' && typeof params[p.key] === 'number' && (
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={params[p.key] as number}
                onChange={(e) => setParamValue(p.key, parseFloat(e.target.value))}
                aria-label={p.label}
                className="h-1 w-full cursor-pointer appearance-none rounded-full outline-offset-4 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8b34d]/70 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-[#e8b34d] [&::-moz-range-thumb]:bg-[#161411] [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-[#e8b34d] [&::-webkit-slider-thumb]:bg-[#161411] [&::-webkit-slider-thumb]:shadow-[0_0_0_3px_rgba(232,179,77,0.14)]"
                style={{
                  background: `linear-gradient(90deg, rgba(232,179,77,0.85) ${rangePct(p, params[p.key] as number)}%, rgba(255,255,255,0.12) ${rangePct(p, params[p.key] as number)}%)`,
                }}
              />
            )}
            {p.kind === 'toggle' && typeof params[p.key] === 'boolean' && (
              <button
                type="button"
                role="switch"
                aria-checked={params[p.key] as boolean}
                aria-label={p.label}
                onClick={() => setParamValue(p.key, !(params[p.key] as boolean))}
                className={`flex h-5 w-9 items-center rounded-full border px-0.5 outline-offset-4 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8b34d] ${
                  params[p.key]
                    ? 'border-[#e8b34d]/60 bg-[#e8b34d]/15'
                    : 'border-white/15 bg-white/[0.04]'
                }`}
              >
                <span
                  className={`block h-3.5 w-3.5 rounded-full transition-transform duration-200 ${
                    params[p.key] ? 'translate-x-[16px] bg-[#e8b34d]' : 'translate-x-0 bg-white/30'
                  }`}
                />
              </button>
            )}
            {p.kind === 'select' && (
              <div className="flex flex-wrap gap-1">
                {p.options?.map((o) => {
                  const active = params[p.key] === o.value
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setParamValue(p.key, o.value)}
                      aria-pressed={active}
                      className={`rounded-sm border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] outline-offset-2 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e8b34d] ${
                        active
                          ? 'border-[#e8b34d]/55 bg-[#e8b34d]/10 text-[#e8b34d]'
                          : 'border-white/10 text-[#8b8175] hover:border-white/25 hover:text-[#b5ac9e]'
                      }`}
                    >
                      {o.label}
                    </button>
                  )
                })}
              </div>
            )}
            <span className="w-14 text-right font-mono text-[10px] tabular-nums text-[#e8b34d]">
              {formatValue(p, params[p.key])}
            </span>
          </div>
        ))}
      </div>

      {/* Футер прибора: назначение + начинка */}
      <footer className="mt-auto border-t border-white/[0.08] px-4 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-[#9c937f]">{demo.description}</p>
        <p className="mt-2.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#5e574c]">
          {demo.tech}
        </p>
      </footer>
    </article>
  )
}

/** Процент заполнения трека слайдера. */
function rangePct(p: ParamDef, v: number): number {
  const min = p.min ?? 0
  const max = p.max ?? 1
  return Math.round(((v - min) / (max - min)) * 100)
}
