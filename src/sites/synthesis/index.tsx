'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { SynthEngine } from './audio/engine'
import { HORIZON, MAX_PLANTS, SEEDS, SEED_MAP } from './meta'
import { BackgroundRenderer } from './render/background'
import { GardenRenderer, type PlantRuntime } from './render/garden'
import type { AudioFrame, Bands, PlantData, SeedType } from './types'
import { clamp } from './util'
import Gate from './ui/Gate'
import Hud from './ui/Hud'
import InfoOverlay from './ui/InfoOverlay'
import PlantLabel, { type LabelSnapshot } from './ui/PlantLabel'

const SOIL_TOP = HORIZON + 0.015
const SOIL_BOTTOM = 0.955
const LONG_PRESS_MS = 480

/** Тихое «дыхание» сцены до входа (вместо реального FFT). */
function syntheticBands(t: number): Bands {
  return {
    bass: 0.16 + 0.08 * Math.sin(t * 0.5),
    lowMid: 0.1 + 0.05 * Math.sin(t * 0.33 + 1),
    mid: 0.1 + 0.05 * Math.sin(t * 0.42 + 2),
    high: 0.05 + 0.03 * Math.sin(t * 0.61 + 3),
  }
}

export default function SynthesisSite({ onExit }: { onExit: () => void }) {
  const [phase, setPhase] = useState<'gate' | 'live'>('gate')
  const [infoOpen, setInfoOpen] = useState(false)
  const [selectedSeed, setSelectedSeed] = useState<SeedType>('pluck')
  const [plantCount, setPlantCount] = useState(0)
  const [muted, setMuted] = useState(false)
  const [weather, setWeather] = useState(0.35)
  const [hoveredPlant, setHoveredPlant] = useState<PlantRuntime | null>(null)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const gardenCanvasRef = useRef<HTMLCanvasElement>(null)
  const spectrumCanvasRef = useRef<HTMLCanvasElement>(null)

  const engineRef = useRef<SynthEngine | null>(null)
  const bgRef = useRef<BackgroundRenderer | null>(null)
  const gardenRef = useRef<GardenRenderer | null>(null)
  const idRef = useRef(1)
  const toastIdRef = useRef(0)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const weatherRef = useRef(weather)
  const selectedRef = useRef(selectedSeed)
  const mutedRef = useRef(muted)
  const hoveredIdRef = useRef<number | null>(null)
  const infoOpenRef = useRef(infoOpen)
  const reducedRef = useRef(false)
  const soilHintRef = useRef(false)
  const onboardingRef = useRef(false)

  useEffect(() => {
    infoOpenRef.current = infoOpen
  }, [infoOpen])

  // ---------- тосты ----------

  const showToast = useCallback((text: string) => {
    toastIdRef.current += 1
    setToast({ id: toastIdRef.current, text })
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current)
    },
    [],
  )

  // ---------- растения ----------

  const plantSeed = useCallback(
    (nx: number, ny: number) => {
      const garden = gardenRef.current
      const engine = engineRef.current
      if (!garden) return
      if (garden.plants.length >= MAX_PLANTS) {
        showToast('Сад полон: удалите растение')
        return
      }
      const data: PlantData = {
        id: idRef.current++,
        seed: (Math.random() * 0xffffffff) >>> 0,
        type: selectedRef.current,
        nx: clamp(nx, 0.04, 0.96),
        ny: clamp(ny, SOIL_TOP + 0.005, SOIL_BOTTOM),
        muted: false,
      }
      garden.plant(data)
      engine?.addPlant(data)
      engine?.playPlantSound(data.type, data.nx)
      setPlantCount(garden.plants.length)
    },
    [showToast],
  )

  const readPlantInfo = useCallback(
    (plant: PlantRuntime): LabelSnapshot => {
      const engine = engineRef.current
      return {
        note: engine ? engine.plantNoteName(plant.data) : '—',
        chord: engine ? engine.chordName() : '',
        muted: plant.data.muted,
      }
    },
    [],
  )

  const removePlant = useCallback(
    (id: number, notify: boolean) => {
      const garden = gardenRef.current
      gardenRef.current?.removePlant(id)
      engineRef.current?.removePlant(id)
      setPlantCount(garden ? garden.plants.length : 0)
      if (hoveredIdRef.current === id) {
        hoveredIdRef.current = null
        setHoveredPlant(null)
      }
      if (notify) showToast('Растение убрано из сада')
    },
    [showToast],
  )

  // ---------- глобальные режимы ----------

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    engineRef.current?.setMutedAll(next)
    setMuted(next)
  }, [])

  const handleWeather = useCallback((v: number) => {
    const val = clamp(v, 0, 1)
    weatherRef.current = val
    engineRef.current?.setWeather(val)
    setWeather(val)
  }, [])

  const handleSelect = useCallback((s: SeedType) => {
    selectedRef.current = s
    setSelectedSeed(s)
  }, [])

  const enterGarden = useCallback(() => {
    if (engineRef.current) {
      setPhase('live')
      return
    }
    try {
      const engine = new SynthEngine(new AudioContext())
      void engine.ctx.resume().catch(() => {})
      engine.setWeather(weatherRef.current)
      engineRef.current = engine
    } catch {
      // даже без аудио сад остаётся визуальным
      engineRef.current = null
    }
    setPhase('live')
  }, [])

  // ---------- фон + главный цикл (живёт с монтирования) ----------

  useEffect(() => {
    const root = rootRef.current
    const bgCanvas = bgCanvasRef.current
    if (!root || !bgCanvas) return

    const bg = new BackgroundRenderer(bgCanvas)
    bgRef.current = bg

    const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onReduced = () => {
      reducedRef.current = reducedMq.matches
    }
    onReduced()
    reducedMq.addEventListener('change', onReduced)

    const applySize = () => {
      const w = root.clientWidth
      const h = root.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      bg.resize(w, h, dpr)
      gardenRef.current?.resize(w, h, dpr)
    }
    const ro = new ResizeObserver(applySize)
    ro.observe(root)
    applySize()

    const drawSpectrum = (frame: AudioFrame) => {
      const cv = spectrumCanvasRef.current
      const data = frame.spectrum
      if (!cv || !data) return
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const W = cv.width
      const H = cv.height
      ctx.clearRect(0, 0, W, H)
      const bars = 12
      const bw = W / bars
      for (let i = 0; i < bars; i++) {
        const lo = Math.floor(Math.pow(200, i / bars))
        const hi = Math.max(lo + 1, Math.floor(Math.pow(200, (i + 1) / bars)))
        let s = 0
        for (let j = lo; j < hi && j < data.length; j++) s += data[j]
        const v = s / ((hi - lo) * 255)
        const bh = Math.max(2, v * (H - 4))
        ctx.fillStyle = i < 4 ? '#e84fd0' : i < 8 ? '#cf6fdd' : '#b6f34d'
        ctx.globalAlpha = 0.35 + v * 0.65
        ctx.fillRect(i * bw + 1, H - bh - 1, bw - 2, bh)
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      const engine = engineRef.current
      const garden = gardenRef.current
      const reduced = reducedRef.current
      const frame: AudioFrame = engine
        ? engine.getFrame()
        : { ...syntheticBands(now / 1000), spectrum: null }
      if (bg.ok) bg.render(dt, frame, weatherRef.current, reduced)
      if (engine && garden) {
        for (const ev of engine.drainEvents()) {
          garden.triggerNote(ev.plantId, ev.velocity, ev.ghost)
        }
        garden.render(dt, now, frame, weatherRef.current, reduced)
        drawSpectrum(frame)
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      reducedMq.removeEventListener('change', onReduced)
      bg.dispose()
      bgRef.current = null
    }
  }, [])

  // ---------- аудиодвижок умирает вместе с видом ----------

  useEffect(
    () => () => {
      void engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  // ---------- живой режим: сад + указатель + клавиатура ----------

  useEffect(() => {
    if (phase !== 'live') return
    const root = rootRef.current
    const canvas = gardenCanvasRef.current
    if (!root || !canvas) return

    const garden = new GardenRenderer(canvas)
    gardenRef.current = garden
    garden.resize(
      root.clientWidth,
      root.clientHeight,
      Math.min(window.devicePixelRatio || 1, 2),
    )
    canvas.style.cursor = 'crosshair'

    let drag: { id: number; moved: boolean; longFired: boolean } | null = null
    let longTimer: ReturnType<typeof setTimeout> | null = null
    const clearLong = () => {
      if (longTimer !== null) {
        clearTimeout(longTimer)
        longTimer = null
      }
    }

    const pos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { px: e.clientX - rect.left, py: e.clientY - rect.top, w: rect.width, h: rect.height }
    }

    const onDown = (e: PointerEvent) => {
      if (infoOpenRef.current) return
      const { px, py, w, h } = pos(e)
      const hit = garden.hitTest(px, py)
      canvas.setPointerCapture(e.pointerId)
      if (hit) {
        drag = { id: hit.data.id, moved: false, longFired: false }
        hoveredIdRef.current = hit.data.id
        setHoveredPlant(hit)
        const id = hit.data.id
        clearLong()
        longTimer = setTimeout(() => {
          if (drag && drag.id === id && !drag.moved) {
            drag.longFired = true
            removePlant(id, true)
          }
        }, LONG_PRESS_MS)
      } else {
        hoveredIdRef.current = null
        setHoveredPlant(null)
        const ny = py / h
        if (ny > SOIL_TOP && ny < SOIL_BOTTOM + 0.01) {
          plantSeed(px / w, ny)
        } else if (ny <= HORIZON && !soilHintRef.current) {
          soilHintRef.current = true
          showToast('Семена растут только в почве — ниже линии горизонта')
        }
      }
    }

    const normY = (py: number, h: number) => py / h

    const onMove = (e: PointerEvent) => {
      const { px, py, w, h } = pos(e)
      if (drag) {
        const rt = garden.plants.find((p) => p.data.id === drag?.id)
        if (!rt || !drag) return
        const dx = px - rt.data.nx * w
        const dy = py - rt.data.ny * h
        if (!drag.moved && Math.hypot(dx, dy) > 6) {
          drag.moved = true
          clearLong()
          hoveredIdRef.current = null
          setHoveredPlant(null)
          canvas.style.cursor = 'grabbing'
        }
        if (drag.moved) {
          rt.data.nx = clamp(px / w, 0.04, 0.96)
          rt.data.ny = clamp(py / h, SOIL_TOP + 0.005, SOIL_BOTTOM)
          engineRef.current?.updatePosition(rt.data.id)
        }
        return
      }
      if (e.pointerType === 'mouse') {
        const hit = garden.hitTest(px, py)
        const id = hit ? hit.data.id : null
        if (id !== hoveredIdRef.current) {
          hoveredIdRef.current = id
          setHoveredPlant(hit)
        }
        canvas.style.cursor = hit ? 'grab' : ny(py, h) > HORIZON ? 'crosshair' : 'default'
      }
    }

    const ny = (py: number, h: number) => py / h

    const onUp = () => {
      clearLong()
      const d = drag
      drag = null
      if (!d || d.longFired) return
      if (!d.moved) {
        const rt = garden.plants.find((p) => p.data.id === d.id)
        if (rt) {
          rt.data.muted = !rt.data.muted
          engineRef.current?.setPlantMuted(rt.data.id, rt.data.muted)
          showToast(
            rt.data.muted
              ? `${SEED_MAP[rt.data.type].label} заглушен`
              : `${SEED_MAP[rt.data.type].label} снова звучит`,
          )
        }
      }
      canvas.style.cursor = 'crosshair'
    }

    const onLeave = () => {
      if (!drag) {
        hoveredIdRef.current = null
        setHoveredPlant(null)
      }
    }
    const onContext = (e: Event) => e.preventDefault()

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('contextmenu', onContext)

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const interactive =
        target && (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.tagName === 'TEXTAREA')
      if (e.key === 'Escape') {
        setInfoOpen(false)
        return
      }
      if (interactive) return
      if (e.key >= '1' && e.key <= '4') {
        const s = SEEDS[Number(e.key) - 1]
        if (s) handleSelect(s.id)
      } else if (e.code === 'Space') {
        e.preventDefault()
        toggleMute()
      }
    }
    window.addEventListener('keydown', onKey)

    if (!onboardingRef.current) {
      onboardingRef.current = true
      showToast('Кликните по почве ниже горизонта — вырастите первое семя')
    }

    return () => {
      clearLong()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
      gardenRef.current = null
    }
  }, [phase, plantSeed, removePlant, showToast, handleSelect, toggleMute])

  // ---------- JSX ----------

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-40 select-none overflow-hidden bg-[#0c0610] text-[#f6eef8]"
    >
      <style>{`
        .syn-range { -webkit-appearance: none; appearance: none; height: 18px; background: transparent; cursor: pointer; }
        .syn-range::-webkit-slider-runnable-track { height: 2px; background: linear-gradient(to right, #e84fd0, #b6f34d); }
        .syn-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 12px; height: 12px; border-radius: 9999px; background: #f6eef8; border: 1px solid #e84fd0; margin-top: -5px; }
        .syn-range::-moz-range-track { height: 2px; background: linear-gradient(to right, #e84fd0, #b6f34d); }
        .syn-range::-moz-range-thumb { width: 12px; height: 12px; border-radius: 9999px; background: #f6eef8; border: 1px solid #e84fd0; }
        .toast-in { animation: toastIn 0.28s ease-out; }
        @keyframes toastIn { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>

      <canvas ref={bgCanvasRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <canvas
        ref={gardenCanvasRef}
        className={`absolute inset-0 h-full w-full touch-none ${phase === 'live' ? '' : 'pointer-events-none'}`}
        aria-hidden
      />

      {phase === 'live' && (
        <>
          <Hud
            plantCount={plantCount}
            maxPlants={MAX_PLANTS}
            muted={muted}
            onToggleMute={toggleMute}
            selected={selectedSeed}
            onSelect={handleSelect}
            weather={weather}
            onWeather={handleWeather}
            onInfo={() => setInfoOpen(true)}
            onExit={onExit}
            spectrumRef={spectrumCanvasRef}
          />
          {hoveredPlant && (
            <PlantLabel
              plant={hoveredPlant}
              readInfo={readPlantInfo}
              onRemove={() => removePlant(hoveredPlant.data.id, true)}
            />
          )}
        </>
      )}

      {toast && (
        <div
          key={toast.id}
          className="toast-in absolute bottom-24 left-1/2 z-30 rounded-sm border border-[#e84fd0]/40 bg-[#1a0c1c]/90 px-4 py-2 font-mono text-[11px] tracking-[0.06em] text-[#f6eef8] backdrop-blur-sm"
        >
          {toast.text}
        </div>
      )}

      {phase === 'gate' && <Gate onEnter={enterGarden} onExit={onExit} />}
      {infoOpen && <InfoOverlay onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
