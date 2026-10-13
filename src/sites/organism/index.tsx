'use client'

/**
 * ЭКСП. 05 «ОРГАНИЗМ» — коллективное цифровое существо.
 *
 * Одно существо на всех посетителей: все прививки пишутся в общую базу
 * (готовый API /api/organism, Prisma + SQLite), форма детерминированно
 * восстанавливается из истории мутаний, клиентская «энергия внимания»
 * оплачивает прививки и пульсы. Поллинг 5 с подсматривает чужие действия.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ApiError,
  getOrganism,
  mutateOrganism,
  type Mutation,
  type OrganismFeed,
  type OrganismStats,
} from './api'
import { GRAFT_COST, PULSE_COST, useEnergy } from './energy'
import {
  ActionBar,
  BootScreen,
  EmptyHint,
  EnergyScale,
  ExitButton,
  FeedPanel,
  FeedSheet,
  FeedEntry,
  HeaderStats,
  InfoOverlay,
  OfflineBanner,
  SceneStyles,
  ToastView,
  TooltipView,
  VisitorBadge,
} from './hud'
import { OrganismRenderer } from './renderer'

const POLL_MS = 5000
const BOOT_MIN_MS = 950
const TOAST_MS = 4200
const PULSE_LOCK_MS = 2600

interface PendingGraft {
  tempId: number
  mutation: Mutation
}

function initVisitorId(): string {
  if (typeof window === 'undefined') return '0000'
  try {
    const stored = window.localStorage.getItem('field5-visitor')
    if (stored && /^[0-9a-f]{4}$/.test(stored)) return stored
  } catch {
    /* приватный режим — просто генерируем новый */
  }
  let hex: string
  const c = window.crypto
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint8Array(2)
    c.getRandomValues(buf)
    hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
  } else {
    hex = Math.floor(Math.random() * 0xffff)
      .toString(16)
      .padStart(4, '0')
  }
  try {
    window.localStorage.setItem('field5-visitor', hex)
  } catch {
    /* не критично */
  }
  return hex
}

export default function OrganismSite({ onExit }: { onExit: () => void }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)
  const hintRef = useRef<HTMLSpanElement | null>(null)
  const readoutRef = useRef<HTMLSpanElement | null>(null)
  const rendererRef = useRef<OrganismRenderer | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lastMaxIdRef = useRef(0)
  const lastGraftToastRef = useRef(0)
  const toastTimerRef = useRef<number | null>(null)
  const pulseTimerRef = useRef<number | null>(null)

  const [phase, setPhase] = useState<'boot' | 'live'>('boot')
  const [fatal, setFatal] = useState(false)
  const [stats, setStats] = useState<OrganismStats | null>(null)
  const [serverMutations, setServerMutations] = useState<Mutation[]>([])
  const [pending, setPending] = useState<PendingGraft[]>([])
  const [localGrafts, setLocalGrafts] = useState<PendingGraft[]>([])
  const [localEvents, setLocalEvents] = useState<Array<{ kind: 'pulse'; at: number }>>([])
  const [graftMode, setGraftMode] = useState(false)
  const [pulseLock, setPulseLock] = useState(false)
  const [offline, setOffline] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [feedOpen, setFeedOpen] = useState(false)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [session, setSession] = useState({ grafts: 0, pulses: 0 })
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [tooltipState, setTooltipState] = useState<{ visitor: string; at: number } | null>(null)
  const [myId] = useState(initVisitorId)

  const energy = useEnergy()

  /* ------------------------------- утилиты --------------------------------- */

  const showToast = (text: string): void => {
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    setToast({ id: Date.now(), text })
    toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_MS)
  }

  /**
   * Применение данных с сервера: статы + мутации + реакция на чужие свежие
   * действия (тост о прививке не чаще 1 в 10 с, лёгкая волна на чужой пульс).
   */
  const applyServerDataRef = useRef((data: OrganismFeed, initial: boolean) => {
    const prevMax = lastMaxIdRef.current
    for (const m of data.mutations) {
      if (m.id > lastMaxIdRef.current) lastMaxIdRef.current = m.id
    }
    setStats(data.organism)
    setServerMutations(data.mutations)
    if (initial) return
    const myTag = `гость #${myId}`
    const others = data.mutations.filter((m) => m.id > prevMax && m.visitor !== myTag)
    if (others.length === 0) return
    // чужое внимание подогревает ваше: всплеск за каждую партию чужих действий
    energy.addForeign()
    if (
      others.some((m) => m.kind === 'graft') &&
      Date.now() - lastGraftToastRef.current > 10_000
    ) {
      lastGraftToastRef.current = Date.now()
      showToast('Кто-то только что привил ветвь')
    }
    if (others.some((m) => m.kind === 'pulse')) {
      rendererRef.current?.triggerWave(0.55)
    }
  })

  /* ------------------------------ boot: пробуждение -------------------------- */

  useEffect(() => {
    const ac = new AbortController()
    abortRef.current = ac
    const started = performance.now()
    let alive = true

    getOrganism(ac.signal)
      .then((data) => {
        if (!alive) return
        applyServerDataRef.current(data, true)
        const wait = Math.max(0, BOOT_MIN_MS - (performance.now() - started))
        window.setTimeout(() => {
          if (alive) setPhase('live')
        }, wait)
      })
      .catch((err: unknown) => {
        if (!alive || (err as Error)?.name === 'AbortError') return
        setOffline(true)
        setPhase('live')
      })

    return () => {
      alive = false
      ac.abort()
    }
  }, [])

  /* ------------------------------ рендерер ---------------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: OrganismRenderer
    try {
      renderer = new OrganismRenderer(canvas, {
        onHoverChange: (payload) => {
          setTooltipState(
            payload
              ? { visitor: payload.mutation.visitor, at: Date.parse(payload.mutation.createdAt) }
              : null,
          )
        },
        onHoverMove: (x, y) => {
          const el = tooltipRef.current
          if (el) el.style.transform = `translate(${Math.round(x + 16)}px, ${Math.round(y + 14)}px)`
        },
      })
    } catch {
      // Canvas 2D недоступен (крайне редкий случай) — фолбэк-панель
      requestAnimationFrame(() => setFatal(true))
      return
    }
    rendererRef.current = renderer
    return () => {
      renderer.destroy()
      rendererRef.current = null
    }
  }, [])

  /* --------------------------- синхронизация данных -------------------------- */

  // ветви: серверные мутации + оптимистичные + локальные (после boot — каскад)
  useEffect(() => {
    if (phase !== 'live') return
    rendererRef.current?.setMutations([
      ...serverMutations,
      ...pending.map((p) => p.mutation),
      ...localGrafts.map((g) => g.mutation),
    ])
  }, [phase, serverMutations, pending, localGrafts])

  useEffect(() => {
    rendererRef.current?.setStats(stats?.generation ?? 1)
  }, [stats])

  useEffect(() => {
    rendererRef.current?.setGraftMode(graftMode)
  }, [graftMode])

  // поллинг: чужие мутации прорастают, статы обновляются, офлайн детектится
  useEffect(() => {
    if (phase !== 'live') return
    const iv = window.setInterval(() => {
      if (document.hidden) return
      getOrganism()
        .then((data) => {
          setOffline(false)
          applyServerDataRef.current(data, false)
        })
        .catch(() => setOffline(true))
    }, POLL_MS)
    return () => window.clearInterval(iv)
  }, [phase])

  /* ------------------------------ среда и QA --------------------------------- */

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => rendererRef.current?.setReducedMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  // QA-хук: window.__organism.addEnergy(n)
  useEffect(() => {
    const w = window as unknown as { __organism?: { addEnergy: (n: number) => void } }
    w.__organism = { addEnergy: (n: number) => energy.add(n) }
    return () => {
      delete w.__organism
    }
  }, [])

  // тик относительного времени ленты
  useEffect(() => {
    const iv = window.setInterval(() => setNowTick(Date.now()), 15_000)
    return () => window.clearInterval(iv)
  }, [])

  // esc: закрыть оверлеи / выйти из режима прививки
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (infoOpen) {
        setInfoOpen(false)
        return
      }
      if (feedOpen) {
        setFeedOpen(false)
        return
      }
      if (graftMode) setGraftMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [graftMode, infoOpen, feedOpen])

  // общий teardown таймеров
  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
      if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
      abortRef.current?.abort()
    },
    [],
  )

  /* ------------------------------- действия ---------------------------------- */

  const doGraft = (x: number, y: number): void => {
    const renderer = rendererRef.current
    if (!renderer || !graftMode) return
    const gene = renderer.pointToGene(x, y)
    if (!gene) {
      showToast('Прививка принимается только на теле существа')
      return
    }
    if (!energy.spend(GRAFT_COST)) {
      setGraftMode(false)
      showToast('Движение пополняет запас энергии')
      return
    }
    const tempId = -Date.now()
    const optimistic: Mutation = {
      id: tempId,
      kind: 'graft',
      angle: gene.angle,
      distance: gene.distance,
      potency: gene.potency,
      visitor: `гость #${myId}`,
      energy: GRAFT_COST,
      createdAt: new Date().toISOString(),
    }
    setPending((prev) => [...prev, { tempId, mutation: optimistic }])
    setGraftMode(false)
    setSession((s) => ({ ...s, grafts: s.grafts + 1 }))

    mutateOrganism(
      {
        type: 'graft',
        angle: gene.angle,
        distance: gene.distance,
        potency: gene.potency,
        visitorId: myId,
        clientEnergy: GRAFT_COST,
      },
      abortRef.current?.signal,
    )
      .then(({ organism, mutation }) => {
        setPending((prev) => prev.filter((p) => p.tempId !== tempId))
        setServerMutations((prev) => [...prev, mutation])
        setStats(organism)
        if (mutation.id > lastMaxIdRef.current) lastMaxIdRef.current = mutation.id
        rendererRef.current?.adopt(tempId, mutation)
      })
      .catch((err: unknown) => {
        if ((err as ApiError)?.status === 429) {
          setPending((prev) => prev.filter((p) => p.tempId !== tempId))
          rendererRef.current?.discard(tempId)
          energy.refund(GRAFT_COST)
          setSession((s) => ({ ...s, grafts: Math.max(0, s.grafts - 1) }))
          showToast('Слишком много энергии — существо отдыхает')
          return
        }
        if ((err as Error)?.name === 'AbortError') return
        // сеть пропала: ветвь остаётся в локальной копии
        setOffline(true)
        setPending((prev) => prev.filter((p) => p.tempId !== tempId))
        setLocalGrafts((prev) => [...prev, { tempId, mutation: optimistic }])
      })
  }

  const doPulse = (): void => {
    if (pulseLock || !energy.spend(PULSE_COST)) return
    setPulseLock(true)
    if (pulseTimerRef.current !== null) window.clearTimeout(pulseTimerRef.current)
    pulseTimerRef.current = window.setTimeout(() => setPulseLock(false), PULSE_LOCK_MS)
    rendererRef.current?.triggerWave(1)
    setSession((s) => ({ ...s, pulses: s.pulses + 1 }))

    mutateOrganism(
      { type: 'pulse', visitorId: myId, clientEnergy: PULSE_COST },
      abortRef.current?.signal,
    )
      .then(({ organism, mutation }) => {
        setServerMutations((prev) => [...prev, mutation])
        setStats(organism)
        if (mutation.id > lastMaxIdRef.current) lastMaxIdRef.current = mutation.id
      })
      .catch((err: unknown) => {
        if ((err as ApiError)?.status === 429) {
          energy.refund(PULSE_COST)
          setSession((s) => ({ ...s, pulses: Math.max(0, s.pulses - 1) }))
          showToast('Слишком много энергии — существо отдыхает')
          return
        }
        if ((err as Error)?.name === 'AbortError') return
        setOffline(true)
        setLocalEvents((prev) => [...prev, { kind: 'pulse', at: Date.now() }])
      })
  }

  const toggleGraftMode = (): void => {
    if (!graftMode && energy.valueRef.current < GRAFT_COST) return
    setGraftMode((v) => !v)
  }

  /* ------------------------------- указатель --------------------------------- */

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    energy.addMovement()
    const renderer = rendererRef.current
    if (!renderer) return
    renderer.pointerMove(x, y)
    if (graftMode) {
      const gene = renderer.pointToGene(x, y)
      const el = readoutRef.current
      if (el) {
        if (gene) {
          el.classList.remove('hidden')
          el.textContent = `θ ${Math.round((gene.angle * 180) / Math.PI)}° · r ${gene.distance.toFixed(2)} · потенция ${gene.potency.toFixed(2)}`
        } else {
          el.classList.add('hidden')
        }
      }
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    if (graftMode) {
      doGraft(x, y)
      return
    }
    energy.addClick()
  }

  const handlePointerLeave = (): void => {
    rendererRef.current?.pointerLeave()
    readoutRef.current?.classList.add('hidden')
  }

  /* --------------------------------- лента ----------------------------------- */

  const feed = useMemo<FeedEntry[]>(() => {
    const myTag = `гость #${myId}`
    const entries: FeedEntry[] = []
    for (const m of serverMutations) {
      const mine = m.visitor === myTag
      entries.push({
        key: `s${m.id}`,
        actor: mine ? 'вы' : m.visitor,
        mine,
        action: mine
          ? m.kind === 'graft'
            ? 'привили ветвь'
            : 'послали пульс'
          : m.kind === 'graft'
            ? 'привил ветвь'
            : 'послал пульс',
        at: Date.parse(m.createdAt),
      })
    }
    for (const p of pending) {
      entries.push({
        key: `p${p.tempId}`,
        actor: 'вы',
        mine: true,
        action: 'привили ветвь',
        at: Date.parse(p.mutation.createdAt),
      })
    }
    for (const g of localGrafts) {
      entries.push({
        key: `l${g.tempId}`,
        actor: 'вы',
        mine: true,
        action: 'привили ветвь (локально)',
        at: Date.parse(g.mutation.createdAt),
      })
    }
    for (const ev of localEvents) {
      entries.push({
        key: `e${ev.at}`,
        actor: 'вы',
        mine: true,
        action: 'послали пульс (локально)',
        at: ev.at,
      })
    }
    entries.sort((a, b) => b.at - a.at)
    return entries.slice(0, 30)
  }, [serverMutations, pending, localGrafts, localEvents, myId])

  const graftCount =
    serverMutations.filter((m) => m.kind === 'graft').length + pending.length + localGrafts.length
  const gen = stats?.generation ?? 1

  /* ---------------------------------- HUD ------------------------------------ */

  return (
    <div className="fixed inset-0 z-40 select-none overflow-hidden bg-[#05130c] text-[#dff5e5]">
      <SceneStyles />

      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ cursor: graftMode ? 'none' : 'default' }}
        role="img"
        aria-label="Коллективный организм: колония ветвей, выращенная действиями всех посетителей"
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={handlePointerLeave}
      />

      {/* верхняя левая колонка: выход + шапка-статы */}
      <div className="absolute left-4 top-4 z-20 flex flex-col gap-4">
        <ExitButton onExit={onExit} />
        <HeaderStats
          generation={gen}
          grafts={stats?.totalGrafts ?? 0}
          pulses={stats?.totalPulses ?? 0}
          energy={stats?.energy ?? 0}
        />
        <p className="font-mono text-[10px] text-[#8fb89c]/60 md:hidden">
          вы — <span className="text-[#4ef08a]">гость #{myId}</span>
        </p>
      </div>

      {/* инфо-кнопка */}
      <button
        type="button"
        onClick={() => setInfoOpen(true)}
        aria-label="О эксперименте Организм"
        className="absolute right-4 top-4 z-30 h-9 w-9 border border-[#4ef08a]/25 bg-[#03100a]/60 font-mono text-sm text-[#9ff2bf] backdrop-blur-sm transition-colors hover:border-[#4ef08a]/70 hover:text-[#4ef08a]"
      >
        ?
      </button>

      {/* лента мутаций (десктоп) */}
      <FeedPanel entries={feed} now={nowTick} />

      {/* мобильный тумблер ленты */}
      <button
        type="button"
        onClick={() => setFeedOpen(true)}
        className="absolute right-4 top-[68px] z-20 border border-[#4ef08a]/25 bg-[#03100a]/60 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9ff2bf] backdrop-blur-sm md:hidden"
      >
        Лента · {feed.length}
      </button>

      {offline && <OfflineBanner />}

      {/* пустое состояние: только что родилось */}
      {phase === 'live' && graftCount === 0 && <EmptyHint />}

      {/* шкала энергии внимания */}
      <div className="absolute bottom-5 left-4 z-20">
        <EnergyScale value={energy.value} awake={energy.awake} foreignPulse={energy.foreignPulse} />
      </div>

      {/* кнопки действий */}
      <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center px-14 md:bottom-6 md:px-4">
        <ActionBar
          graftMode={graftMode}
          canGraft={energy.value >= GRAFT_COST}
          canPulse={energy.value >= PULSE_COST}
          pulseLock={pulseLock}
          awake={energy.awake}
          onGraft={toggleGraftMode}
          onPulse={doPulse}
          hintRef={hintRef}
          readoutRef={readoutRef}
        />
      </div>

      {/* визитор-бейдж (десктоп) */}
      <div className="absolute bottom-6 right-4 z-20 hidden md:block">
        <VisitorBadge
          visitorId={myId}
          sessionGrafts={session.grafts}
          sessionPulses={session.pulses}
        />
      </div>

      {/* мобильная шторка ленты */}
      <FeedSheet entries={feed} now={nowTick} open={feedOpen} onClose={() => setFeedOpen(false)} />

      {tooltipState && (
        <TooltipView
          boxRef={tooltipRef}
          visitor={tooltipState.visitor}
          at={tooltipState.at}
          now={nowTick}
        />
      )}

      {toast && <ToastView key={toast.id} text={toast.text} />}

      {infoOpen && <InfoOverlay onClose={() => setInfoOpen(false)} />}

      {phase === 'boot' && <BootScreen generation={gen} />}

      {fatal && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#05130c] px-6 text-center">
          <p className="font-mono text-xs text-[#e8b34d]">
            Глубина недоступна: браузер не дал двумерный контекст отрисовки.
          </p>
          <button
            type="button"
            onClick={onExit}
            className="border border-[#dff5e5]/20 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#dff5e5]/70"
          >
            ← Вернуться на поле
          </button>
        </div>
      )}
    </div>
  )
}
