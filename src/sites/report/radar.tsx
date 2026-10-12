'use client'

/**
 * ОТЧЁТ · FIELD·5 — сравнительный радар пяти экспериментов.
 * SVG-пентагон по пяти осям (шкала 0–5): табы 01–05 + наложение всех.
 * Переключение — лёгкая анимация появления (гасится при prefers-reduced-motion).
 */

import { useState } from 'react'
import { SITES, type SiteSlug } from '@/sites/manifest'
import { RADAR_AXES, RADAR_VALUES } from './data'

type RadarMode = SiteSlug | 'all'

/* Геометрия пентагона */
const CX = 210
const CY = 186
const R = 122
const N = RADAR_AXES.length
const TAU = Math.PI / 180

function vertex(i: number, level: number): { x: number; y: number } {
  const a = (-90 + (360 / N) * i) * TAU
  const r = (R * level) / N
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

function ringPoints(level: number): string {
  return Array.from({ length: N }, (_, i) => {
    const p = vertex(i, level)
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
  }).join(' ')
}

function valuePoints(slug: SiteSlug): string {
  return RADAR_VALUES[slug]
    .map((v, i) => {
      const p = vertex(i, v)
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`
    })
    .join(' ')
}

/* Подписи осей: строки + привязка текста */
const AXIS_LABELS: { lines: string[]; anchor: 'start' | 'middle' | 'end' }[] = [
  { lines: ['Визуальная', 'новизна'], anchor: 'middle' },
  { lines: ['Техническая', 'глубина'], anchor: 'start' },
  { lines: ['Характер', 'интерактива'], anchor: 'start' },
  { lines: ['Нагрузка', 'на GPU'], anchor: 'end' },
  { lines: ['Завершённость'], anchor: 'end' },
]

function labelAnchor(i: number): { x: number; y: number } {
  const a = (-90 + (360 / N) * i) * TAU
  const r = R + 17
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }
}

export default function RadarCompare() {
  const [mode, setMode] = useState<RadarMode>('monolith')
  const active = mode === 'all' ? undefined : SITES.find((s) => s.slug === mode)
  const accent = active?.accent ?? '#d9a05b'

  const ariaLabel =
    mode === 'all'
      ? 'Радар: наложение профилей всех пяти экспериментов по пяти осям, шкала 0–5'
      : `Радар эксперимента ${active?.index} «${active?.title}»: ${RADAR_AXES.map(
          (a, i) => `${a} — ${RADAR_VALUES[mode][i]} из 5`,
        ).join('; ')}`

  return (
    <div>
      {/* Табы: 01–05 + наложение всех */}
      <div className="mb-7 flex flex-wrap items-center gap-1.5" role="group" aria-label="Выбор эксперимента для радара">
        {SITES.map((s) => {
          const isActive = mode === s.slug
          return (
            <button
              key={s.slug}
              type="button"
              onClick={() => setMode(s.slug)}
              aria-pressed={isActive}
              className={`flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                isActive
                  ? ''
                  : 'border-white/[0.09] text-[#8b8175] hover:border-white/25 hover:text-[#b5ac9e]'
              }`}
              style={isActive ? { borderColor: `${s.accent}88`, backgroundColor: `${s.accent}1a`, color: s.accent } : undefined}
            >
              <span>{s.index}</span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setMode('all')}
          aria-pressed={mode === 'all'}
          className={`flex min-h-[38px] items-center gap-2 rounded-full border px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
            mode === 'all'
              ? 'border-[#d9a05b]/55 bg-[#d9a05b]/10 text-[#d9a05b]'
              : 'border-white/[0.09] text-[#8b8175] hover:border-white/25 hover:text-[#b5ac9e]'
          }`}
        >
          Наложить все
        </button>
      </div>

      <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_250px]">
        {/* Сам радар */}
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.015] p-3 md:p-5">
          <svg
            viewBox="0 0 420 372"
            role="img"
            aria-label={ariaLabel}
            className="mx-auto block w-full max-w-[470px]"
          >
            {/* Кольца шкалы */}
            {[1, 2, 3, 4, 5].map((l) => (
              <polygon
                key={l}
                points={ringPoints(l)}
                fill="none"
                stroke="#ece7dd"
                strokeOpacity={l === 5 ? 0.16 : 0.08}
                strokeWidth={1}
              />
            ))}
            {/* Спицы */}
            {Array.from({ length: N }, (_, i) => {
              const p = vertex(i, N)
              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={p.x.toFixed(1)}
                  y2={p.y.toFixed(1)}
                  stroke="#ece7dd"
                  strokeOpacity={0.07}
                  strokeWidth={1}
                />
              )
            })}
            {/* Цифры уровней вдоль вертикальной оси */}
            {[1, 2, 3, 4].map((l) => (
              <text
                key={l}
                x={CX + 6}
                y={CY - (R * l) / N + 3}
                fontSize="7.5"
                fill="#5e574c"
                className="font-mono"
              >
                {l}
              </text>
            ))}

            {/* Профили */}
            {mode === 'all' ? (
              SITES.map((s) => (
                <polygon
                  key={s.slug}
                  points={valuePoints(s.slug)}
                  fill={s.accent}
                  fillOpacity={0.05}
                  stroke={s.accent}
                  strokeOpacity={0.55}
                  strokeWidth={1.2}
                />
              ))
            ) : (
              <g
                key={mode}
                className="animate-in fade-in zoom-in-95 duration-500 motion-reduce:animate-none"
              >
                <polygon
                  points={valuePoints(mode)}
                  fill={accent}
                  fillOpacity={0.16}
                  stroke={accent}
                  strokeWidth={1.6}
                />
                {RADAR_VALUES[mode].map((v, i) => {
                  const p = vertex(i, v)
                  return (
                    <circle
                      key={i}
                      cx={p.x.toFixed(1)}
                      cy={p.y.toFixed(1)}
                      r={3.4}
                      fill="#0b0a09"
                      stroke={accent}
                      strokeWidth={1.6}
                    />
                  )
                })}
              </g>
            )}

            {/* Подписи осей */}
            {AXIS_LABELS.map((l, i) => {
              const a = labelAnchor(i)
              const dy0 = -((l.lines.length - 1) * 11) / 2 + 3.5
              return (
                <g key={l.lines[0]}>
                  {l.lines.map((line, k) => (
                    <text
                      key={line}
                      x={a.x.toFixed(1)}
                      y={(a.y + dy0 + k * 11).toFixed(1)}
                      textAnchor={l.anchor}
                      fontSize="9"
                      letterSpacing="0.8"
                      fill="#8b8175"
                      className="font-mono"
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Легенда-расшифровка */}
        <div className="min-w-0">
          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.24em] text-[#5e574c]">
            {mode === 'all' ? 'Наложение профилей' : 'Оси и оценки'}
          </p>
          {mode === 'all' ? (
            <div>
              {SITES.map((s) => (
                <div key={s.slug} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
                  <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: s.accent }} />
                  <span className="flex-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[#9c937f]">
                    {s.index} · {s.title}
                  </span>
                </div>
              ))}
              <p className="mt-4 text-[12px] leading-relaxed text-[#8b8175]">
                Профили полупрозрачны: где полигоны расходятся — эксперименты честно
                отличаются, где сходятся — это осознанный авторский выбор.
              </p>
            </div>
          ) : (
            <div>
              {RADAR_AXES.map((axis, i) => {
                const v = RADAR_VALUES[mode][i]
                return (
                  <div key={axis} className="flex items-center gap-3 border-b border-white/[0.06] py-2.5 last:border-b-0">
                    <span className="min-w-0 flex-1 font-mono text-[10px] uppercase leading-snug tracking-[0.1em] text-[#9c937f]">
                      {axis}
                    </span>
                    <span className="h-[3px] w-14 shrink-0 overflow-hidden rounded-full bg-white/[0.07]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${(v / 5) * 100}%`, backgroundColor: accent }}
                      />
                    </span>
                    <span className="w-9 shrink-0 text-right font-mono text-[11px]" style={{ color: accent }}>
                      {v}/5
                    </span>
                  </div>
                )
              })}
              <p className="mt-4 text-[12px] leading-relaxed text-[#8b8175]">
                Оценки выставлены после приёмки сцен — это авторская
                позиция, а не измеренный метрией факт.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
