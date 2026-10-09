'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import type { WindMode } from './acts/act3'
import { TextFieldScene, type ActCommand } from './scene'
import { ACT_META, sanitizeUserText } from './types'

const CSS = `
@keyframes tfLoad { 0% { transform: translateX(-130%); } 100% { transform: translateX(330%); } }
@keyframes tfFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.tf-fade { animation: tfFade 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both; }
.tf-subtitle { animation: tfFade 1.1s cubic-bezier(0.22, 0.61, 0.36, 1) 2.8s both; }
.tf-loader { animation: tfLoad 1.15s ease-in-out infinite; }
`

function Toggle({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center justify-between gap-6 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em] text-[#17140f]"
    >
      <span className="group-hover:text-[#d43d1f]">{label}</span>
      <span
        className={`relative block h-[14px] w-[28px] border transition-colors ${
          on ? 'border-[#d43d1f]' : 'border-[#17140f]/35'
        }`}
      >
        <span
          className={`absolute top-[1px] h-[10px] w-[10px] transition-all duration-200 ${
            on ? 'left-[15px] bg-[#d43d1f]' : 'left-[1px] bg-[#8a867c]'
          }`}
        />
      </span>
    </button>
  )
}

export default function TextfieldSite({ onExit }: { onExit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const sceneRef = useRef<TextFieldScene | null>(null)
  const [booted, setBooted] = useState(false)
  const [act, setAct] = useState(0)
  const [showInfo, setShowInfo] = useState(false)
  const [windMode, setWindMode] = useState<WindMode>(1)
  const [sandWind, setSandWind] = useState(false)
  const [sandAnti, setSandAnti] = useState(false)
  const [text, setText] = useState('')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cancelled = false
    let scene: TextFieldScene | null = null
    try {
      scene = new TextFieldScene(canvas, reduced, {
        onActChange: (i) => setAct(i),
        onReady: () => {
          if (cancelled) return
          setBooted(true)
          scene?.start()
        },
      })
      sceneRef.current = scene
      scene.init().catch(() => {
        if (!cancelled) setBooted(true)
      })
    } catch {
      // даже при отказе Canvas 2D снимаем бут-оверлей (асинхронно)
      requestAnimationFrame(() => {
        if (!cancelled) setBooted(true)
      })
    }
    return () => {
      cancelled = true
      sceneRef.current = null
      scene?.destroy()
    }
  }, [])

  const command = useCallback((cmd: ActCommand) => {
    sceneRef.current?.command(cmd)
  }, [])

  const goto = useCallback((i: number) => {
    sceneRef.current?.goto(i)
  }, [])

  const selectMode = useCallback(
    (m: WindMode) => {
      setWindMode(m)
      command({ type: 'mode', mode: m })
    },
    [command],
  )

  const toggleWind = useCallback(() => {
    setSandWind((v) => {
      command({ type: 'wind', on: !v })
      return !v
    })
  }, [command])

  const toggleAnti = useCallback(() => {
    setSandAnti((v) => {
      command({ type: 'antigravity', on: !v })
      return !v
    })
  }, [command])

  const resetSandbox = useCallback(() => {
    setSandWind(false)
    setSandAnti(false)
    command({ type: 'reset' })
  }, [command])

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      if (!text.trim()) return
      command({ type: 'release', text })
    },
    [command, text],
  )

  const meta = ACT_META[act]

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden bg-[#f4f1ea] text-[#17140f]">
      <style>{CSS}</style>

      <canvas
        ref={canvasRef}
        className="crosshair-cursor absolute inset-0 block h-full w-full touch-none"
      />

      {/* Шапка */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 sm:p-6">
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={onExit}
            className="pointer-events-auto border border-[#17140f]/25 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#17140f]/70 transition-colors hover:border-[#17140f] hover:text-[#17140f]"
          >
            ← ПОЛЕ ОПЫТОВ
          </button>
          <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#17140f]/55">
            ТЕКСТОВОЕ ПОЛЕ · ЭКСП. 04
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          aria-label="О эксперименте"
          className="pointer-events-auto flex h-9 w-9 items-center justify-center border border-[#17140f]/25 font-mono text-[13px] text-[#17140f]/70 transition-colors hover:border-[#d43d1f] hover:text-[#d43d1f]"
        >
          ?
        </button>
      </div>

      {/* Этикетка акта */}
      {booted && (
        <div
          key={act}
          className="tf-fade pointer-events-none absolute left-5 top-[96px] z-10 max-w-[72vw] sm:left-6 sm:top-[104px]"
        >
          <div className="flex items-center gap-2.5">
            <span className="block h-[7px] w-[7px] bg-[#d43d1f]" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.3em] text-[#17140f]">
              {meta.label}
            </span>
          </div>
          <p className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-[#8a867c]">
            {meta.hint}
          </p>
        </div>
      )}

      {/* Точки актов: слева вертикально / на мобильном снизу горизонтально */}
      {booted && (
        <nav
          aria-label="Акты"
          className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 sm:left-7 sm:gap-1.5
            max-sm:inset-x-0 max-sm:bottom-4 max-sm:left-1/2 max-sm:top-auto max-sm:-translate-x-1/2 max-sm:translate-y-0 max-sm:flex-row max-sm:justify-center"
        >
          {ACT_META.map((m, i) => (
            <button
              key={m.roman}
              type="button"
              onClick={() => goto(i)}
              aria-label={`${m.roman} — ${m.name}`}
              className="group flex items-center gap-3 p-1.5"
            >
              <span
                className={`block h-[9px] w-[9px] rounded-full border transition-all duration-200 ${
                  i === act
                    ? 'border-[#d43d1f] bg-[#d43d1f] scale-110'
                    : 'border-[#17140f]/35 bg-transparent group-hover:border-[#17140f]'
                }`}
              />
              <span
                className={`whitespace-nowrap font-mono text-[9px] uppercase tracking-[0.24em] transition-opacity duration-200 max-sm:hidden ${
                  i === act
                    ? 'text-[#17140f] opacity-100'
                    : 'text-[#8a867c] opacity-0 group-hover:opacity-100'
                }`}
              >
                {m.roman} · {m.name}
              </span>
            </button>
          ))}
        </nav>
      )}

      {/* АКТ I: подводка */}
      {booted && act === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-[23%] z-10 flex justify-center px-6">
          <p className="tf-subtitle text-center font-serif text-[clamp(19px,2.6vw,30px)] italic leading-snug text-[#17140f]/85">
            Буквы тяжелее, чем кажутся — <span className="text-[#d43d1f]">потяните</span> любую
          </p>
        </div>
      )}

      {/* АКТ II: восстановление ткани */}
      {booted && act === 1 && (
        <div className="tf-fade absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-9">
          <button
            type="button"
            onClick={() => command({ type: 'restore' })}
            className="border border-[#17140f] bg-transparent px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.24em] text-[#17140f] transition-colors hover:bg-[#17140f] hover:text-[#f4f1ea]"
          >
            Восстановить
          </button>
        </div>
      )}

      {/* АКТ III: сила ветра */}
      {booted && act === 2 && (
        <div className="tf-fade absolute inset-x-0 bottom-5 z-20 flex justify-center px-4 sm:bottom-9">
          <div className="flex overflow-hidden border border-[#17140f]">
            {(['Штиль', 'Бриз', 'Шторм'] as const).map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => selectMode(i as WindMode)}
                className={`px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors sm:px-5 ${
                  windMode === i
                    ? 'bg-[#d43d1f] text-[#f4f1ea]'
                    : 'text-[#17140f] hover:bg-[#17140f]/6'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* АКТ IV: инпут + панель песочницы */}
      {booted && act === 3 && (
        <>
          <form
            onSubmit={submit}
            className="tf-fade absolute inset-x-0 top-[92px] z-20 flex justify-center px-5 sm:top-[108px]"
          >
            <div className="w-full max-w-xl">
              <div className="flex items-end gap-3 border-b border-[#17140f]/30 transition-colors focus-within:border-[#17140f]">
                <input
                  value={text}
                  onChange={(e) => setText(sanitizeUserText(e.target.value))}
                  maxLength={90}
                  placeholder="напишите что-нибудь…"
                  aria-label="Ваш текст"
                  className="w-full bg-transparent py-2.5 font-mono text-[15px] text-[#17140f] caret-[#d43d1f] outline-none placeholder:text-[#8a867c]/70"
                />
                <span className="pb-2.5 font-mono text-[10px] tabular-nums text-[#8a867c]">
                  {text.length} / 90
                </span>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={!text.trim()}
                  className="border border-[#17140f] px-5 py-2.5 font-sans text-[11px] font-extrabold uppercase tracking-[0.22em] text-[#17140f] transition-all enabled:hover:bg-[#17140f] enabled:hover:text-[#f4f1ea] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Выпустить в мир
                </button>
              </div>
            </div>
          </form>

          <div className="tf-fade absolute bottom-20 right-4 z-20 sm:bottom-9 sm:right-6">
            <div className="flex min-w-[196px] flex-col gap-2 border border-[#17140f]/25 bg-[#f4f1ea]/90 p-3.5 backdrop-blur-[2px]">
              <div className="border-b border-[#17140f]/10 pb-2 font-mono text-[9px] uppercase tracking-[0.3em] text-[#8a867c]">
                Песочница
              </div>
              <Toggle label="Ветер" on={sandWind} onClick={toggleWind} />
              <Toggle label="Антигравитация" on={sandAnti} onClick={toggleAnti} />
              <button
                type="button"
                onClick={() => command({ type: 'shake' })}
                className="mt-1 border border-[#17140f]/30 px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-[#17140f] transition-colors hover:border-[#17140f]"
              >
                Встряхнуть
              </button>
              <button
                type="button"
                onClick={resetSandbox}
                className="border border-[#17140f]/30 px-3 py-1.5 text-left font-mono text-[11px] uppercase tracking-[0.1em] text-[#17140f] transition-colors hover:border-[#d43d1f] hover:text-[#d43d1f]"
              >
                Сброс
              </button>
            </div>
          </div>
        </>
      )}

      {/* Инфо-оверлей */}
      {showInfo && (
        <div className="absolute inset-0 z-40 overflow-y-auto bg-[#f4f1ea]/[0.97] backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-6 pb-20 pt-20 sm:pt-24">
            <button
              type="button"
              onClick={() => setShowInfo(false)}
              className="absolute right-5 top-5 border border-[#17140f]/25 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#17140f]/70 transition-colors hover:border-[#17140f] hover:text-[#17140f] sm:right-6"
            >
              Закрыть ×
            </button>

            <p className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#8a867c]">
              ЭКСП. 04 — ТЕКСТОВОЕ ПОЛЕ
            </p>
            <h2 className="mt-4 font-sans text-[clamp(34px,6vw,64px)] font-extrabold uppercase leading-[0.98] tracking-tight">
              Текст —<br />
              это вещество
            </h2>
            <p className="mt-6 max-w-2xl font-serif text-[clamp(18px,2.2vw,24px)] italic leading-snug text-[#17140f]/85">
              Здесь буквы весят: у каждой есть масса, пропорциональная площади её
              очерка, инерция и право падать. Типографика — не оформление текста,
              а сам текст, с которым можно работать руками.
            </p>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-[#17140f]/75">
              Четыре акта. В первом манифест «Язык — это вещество» осыпается с неба
              и складывается в кучу. Во втором предложение висит гирляндой на двух
              крюках: смысл держится на связях, пока их не порвать. В третьем
              абзац помнит свои места и возвращается к ним сквозь ветер от
              курсора. В четвёртом в мир падает ваш собственный текст — в общую
              песочницу, где уже лежит материя предыдущих актов.
            </p>

            <div className="mt-12 border-t border-[#17140f]/15 pt-8">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#d43d1f]">
                Технологии
              </h3>
              <ul className="mt-4 space-y-3">
                {[
                  'Собственный импульсный солвер тел: broad-фаза на равномерной сетке, AABB-пары, позиционная релаксация за три итерации, трение, восстановление 0.32 и сон тел — ни одной физической библиотеки',
                  'Интегратор Верле с дистанционными ограничениями и разрывом связи при растяжении свыше 1.6×',
                  'Глиф-атлас: каждая литера растеризуется в оффскрин-канвас один раз и дальше рисуется как drawImage — сотни глифов при 60 fps',
                  'Габариты и масса букв — из метрик реального шрифта: measureText, actualBoundingBoxAscent и actualBoundingBoxDescent',
                  'Зерно бумаги — процедурный 256-пиксельный паттерн; вся сцена — один Canvas 2D',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-[#17140f]/80">
                    <span className="mt-[7px] block h-[6px] w-[6px] shrink-0 bg-[#d43d1f]" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-12 border-t border-[#17140f]/15 pt-8">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.34em] text-[#d43d1f]">
                Что попробовать
              </h3>
              <ol className="mt-4 space-y-3">
                {[
                  'В акте I потяните букву из кучи и швырните её — остальные проснутся от удара',
                  'В акте II дёрните гирлянду резко: связь лопнет с красной вспышкой, и кусок упадёт на пол',
                  'В акте III включите «Шторм» и посмотрите, как абзац разлетается вихрем и собирается обратно',
                  'В акте IV напишите своё слово, включите антигравитацию и встряхните мир',
                ].map((item, i) => (
                  <li key={item} className="flex gap-3 text-[14px] leading-relaxed text-[#17140f]/80">
                    <span className="font-mono text-[11px] tabular-nums text-[#d43d1f]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-12 border-t border-[#17140f]/15 pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8a867c]">
              Колесо мыши, свайп, стрелки или точки слева — переход между актами
            </p>
          </div>
        </div>
      )}

      {/* Бут-оверлей */}
      <div
        className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#f4f1ea] transition-opacity duration-500 ${
          booted ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <div className="h-px w-24 overflow-hidden bg-[#17140f]/15">
          <div className="tf-loader h-full w-1/3 bg-[#d43d1f]" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-[#8a867c]">
          ЭКСП. 04 · РАСТЕРИЗАЦИЯ ГЛИФОВ
        </p>
      </div>
    </div>
  )
}
