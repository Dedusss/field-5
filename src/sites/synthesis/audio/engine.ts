import type { AudioFrame, Bands, NoteEvent, PlantData } from '../types'
import { clamp, lerp } from '../util'
import { createReverbIR } from './reverb'
import {
  BARS_PER_CHORD,
  BPM,
  CHORD_NAMES,
  CHORD_ROOTS,
  midiToFreq,
  midiToName,
  plantEuclid,
  plantInterval,
  quantizeToScale,
  STEP_DURATION,
} from './theory'

const LOOKAHEAD = 0.12
const TICK_MS = 25

interface DroneNodes {
  osc1: OscillatorNode
  osc2: OscillatorNode
  filter: BiquadFilterNode
  lfo: OscillatorNode
  lfoGain: GainNode
  env: GainNode
}

interface PlantVoice {
  data: PlantData
  input: GainNode
  panner: StereoPannerNode
  wetSend: GainNode
  level: number
  interval: number
  euclid: boolean[] | null
  choirReadyStep: number
  drone: DroneNodes | null
}

function panFor(nx: number): number {
  return clamp((nx - 0.5) * 1.9, -1, 1)
}

function wetFor(nx: number, ny: number): number {
  const dx = (nx - 0.5) * 1.55
  const dy = (ny - 0.87) * 0.75
  return clamp(0.08 + Math.hypot(dx, dy) * 0.95, 0.08, 0.8)
}

/**
 * Генеративный движок сада. Весь звук — синтез Web Audio, ни одного файла.
 * Граф: [голоса] → plantGain → StereoPanner → (dry → master) + (wetSend → Convolver → wetBus → master);
 * master → DynamicsCompressor → AnalyserNode(512) → destination.
 */
export class SynthEngine {
  readonly ctx: AudioContext
  private readonly master: GainNode
  private readonly comp: DynamicsCompressorNode
  private readonly analyser: AnalyserNode
  private readonly convolver: ConvolverNode
  private readonly wetBus: GainNode
  private readonly noiseBuffer: AudioBuffer
  private readonly freqData: Uint8Array<ArrayBuffer>
  private readonly bands: Bands = { bass: 0, lowMid: 0, mid: 0, high: 0 }
  private readonly events: NoteEvent[] = []
  private readonly voices = new Map<number, PlantVoice>()
  private timer: ReturnType<typeof setInterval> | null = null
  private nextStepTime = 0
  private step16 = 0
  private weather = 0.35
  private readonly masterLevel = 0.9
  private disposed = false
  private readonly onVisibility = () => {
    if (this.disposed) return
    if (document.hidden) void this.ctx.suspend().catch(() => {})
    else void this.ctx.resume().catch(() => {})
  }

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    const t = ctx.currentTime

    this.master = ctx.createGain()
    this.master.gain.setValueAtTime(0.0001, t)
    this.master.gain.setTargetAtTime(this.masterLevel, t, 0.5)

    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -16
    this.comp.knee.value = 24
    this.comp.ratio.value = 8
    this.comp.attack.value = 0.006
    this.comp.release.value = 0.28

    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 512
    this.analyser.smoothingTimeConstant = 0.55

    this.master.connect(this.comp)
    this.comp.connect(this.analyser)
    this.analyser.connect(ctx.destination)

    this.convolver = ctx.createConvolver()
    this.convolver.buffer = createReverbIR(ctx)
    this.wetBus = ctx.createGain()
    this.wetBus.gain.value = 0.85
    this.convolver.connect(this.wetBus)
    this.wetBus.connect(this.master)

    const noiseLen = Math.floor(ctx.sampleRate * 0.1)
    this.noiseBuffer = ctx.createBuffer(1, noiseLen, ctx.sampleRate)
    const nd = this.noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) nd[i] = Math.random() * 2 - 1

    this.freqData = new Uint8Array(this.analyser.frequencyBinCount)

    document.addEventListener('visibilitychange', this.onVisibility)
    this.nextStepTime = t + 0.25
    this.timer = setInterval(() => this.tick(), TICK_MS)
  }

  // ---------- часы ----------

  private tick() {
    if (this.disposed) return
    while (this.nextStepTime < this.ctx.currentTime + LOOKAHEAD) {
      this.scheduleStep(this.step16, this.nextStepTime)
      this.nextStepTime += STEP_DURATION
      this.step16++
    }
  }

  private scheduleStep(step: number, time: number) {
    const stepInBar = step % 16
    const bar = Math.floor(step / 16)
    const chordIdx = Math.floor(bar / BARS_PER_CHORD) % CHORD_ROOTS.length
    const root = CHORD_ROOTS[chordIdx]
    const chordChange = stepInBar === 0 && bar % BARS_PER_CHORD === 0

    for (const v of this.voices.values()) {
      if (v.drone && chordChange) {
        const f = midiToFreq(root)
        v.drone.osc1.frequency.setTargetAtTime(f, time, 0.6)
        v.drone.osc2.frequency.setTargetAtTime(f, time, 0.6)
      }
      if (v.data.muted) continue
      // гуманизация: микроджиттер ±8 мс, velocity ±10%
      const jitter = (Math.random() * 2 - 1) * 0.008
      const t = Math.max(time + jitter, this.ctx.currentTime + 0.002)
      const vel = 0.9 + Math.random() * 0.2
      if (v.data.type === 'pluck' && v.euclid && v.euclid[stepInBar]) {
        this.triggerPluck(v, root, t, vel, false)
      } else if (v.data.type === 'hit' && v.euclid && v.euclid[stepInBar]) {
        this.triggerHit(v, t, vel, false)
      } else if (v.data.type === 'choir' && step >= v.choirReadyStep && Math.random() < 0.14) {
        this.triggerChoir(v, root, t, vel)
        v.choirReadyStep = step + 26 + Math.floor(Math.random() * 10)
      }
    }
    this.tryGhost(time)
  }

  /** «Призрачные» ноты: плотность 0..35% от погоды. */
  private tryGhost(baseTime: number) {
    if (this.weather <= 0.01 || Math.random() >= this.weather * 0.35) return
    const candidates: PlantVoice[] = []
    for (const v of this.voices.values()) {
      if (!v.data.muted && (v.data.type === 'pluck' || v.data.type === 'hit')) candidates.push(v)
    }
    if (candidates.length === 0) return
    const v = candidates[Math.floor(Math.random() * candidates.length)]
    const t = Math.max(baseTime + (Math.random() * 2 - 1) * 0.02, this.ctx.currentTime + 0.002)
    const vel = 0.45 + Math.random() * 0.2
    if (v.data.type === 'pluck') this.triggerPluck(v, this.currentRoot(), t, vel, true)
    else this.triggerHit(v, t, vel, true)
  }

  // ---------- голоса ----------

  private triggerPluck(v: PlantVoice, root: number, t: number, vel: number, ghost: boolean) {
    if (this.disposed) return
    const ctx = this.ctx
    const note = quantizeToScale(root + v.interval + (ghost ? 12 : 0))
    const freq = midiToFreq(note)
    const osc = ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = Math.min(freq * 2.4, 6800)
    bp.Q.value = 7
    const g = ctx.createGain()
    const peak = (ghost ? 0.16 : 0.5) * vel
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.007)
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.26)
    osc.connect(bp)
    bp.connect(g)
    g.connect(v.input)
    osc.start(t)
    osc.stop(t + 0.3)
    osc.onended = () => {
      try {
        g.disconnect()
      } catch {
        /* контекст уже закрыт */
      }
    }
    this.events.push({ plantId: v.data.id, time: t, velocity: ghost ? vel * 0.5 : vel, ghost })
  }

  private triggerChoir(v: PlantVoice, root: number, t: number, vel: number) {
    if (this.disposed) return
    const ctx = this.ctx
    const hold = 1.5 + Math.random() * 1.3
    const base = quantizeToScale(root + v.interval)
    const midis = [base, quantizeToScale(base + 7), quantizeToScale(base + 12)]
    for (let i = 0; i < midis.length; i++) {
      const f = midiToFreq(midis[i])
      const o1 = ctx.createOscillator()
      o1.type = 'sine'
      o1.frequency.value = f
      o1.detune.value = -3
      const o2 = ctx.createOscillator()
      o2.type = 'triangle'
      o2.frequency.value = f
      o2.detune.value = 4 + i * 2
      const og1 = ctx.createGain()
      og1.gain.value = 0.7
      const og2 = ctx.createGain()
      og2.gain.value = 0.4
      const f1 = ctx.createBiquadFilter()
      f1.type = 'bandpass'
      f1.frequency.value = 700
      f1.Q.value = 8
      const f2 = ctx.createBiquadFilter()
      f2.type = 'bandpass'
      f2.frequency.value = 1200
      f2.Q.value = 8
      const env = ctx.createGain()
      const peak = 0.5 * vel * (i === 0 ? 1 : 0.72)
      const sustainEnd = t + 0.8 + hold
      env.gain.setValueAtTime(0.0001, t)
      env.gain.linearRampToValueAtTime(peak, t + 0.8)
      env.gain.linearRampToValueAtTime(peak, sustainEnd)
      env.gain.linearRampToValueAtTime(0.0001, sustainEnd + 2.0)
      o1.connect(og1)
      o2.connect(og2)
      og1.connect(f1)
      og1.connect(f2)
      og2.connect(f1)
      og2.connect(f2)
      f1.connect(env)
      f2.connect(env)
      env.connect(v.input)
      const tEnd = sustainEnd + 2.1
      o1.start(t)
      o2.start(t)
      o1.stop(tEnd)
      o2.stop(tEnd)
      o1.onended = () => {
        try {
          env.disconnect()
        } catch {
          /* контекст уже закрыт */
        }
      }
    }
    this.events.push({ plantId: v.data.id, time: t, velocity: vel, ghost: false })
  }

  private triggerHit(v: PlantVoice, t: number, vel: number, ghost: boolean) {
    if (this.disposed) return
    const ctx = this.ctx
    // мембрана: sine с падением 180 → 52 Гц за 80 мс
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(52, t + 0.08)
    const g = ctx.createGain()
    const peak = (ghost ? 0.26 : 0.75) * vel
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0008, t + (ghost ? 0.16 : 0.3))
    osc.connect(g)
    g.connect(v.input)
    osc.start(t)
    osc.stop(t + 0.34)
    osc.onended = () => {
      try {
        g.disconnect()
      } catch {
        /* контекст уже закрыт */
      }
    }
    // шумовой клик 30 мс через highpass
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    const ng = ctx.createGain()
    const nPeak = (ghost ? 0.05 : 0.14) * vel
    ng.gain.setValueAtTime(Math.max(nPeak, 0.001), t)
    ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.035)
    src.connect(hp)
    hp.connect(ng)
    ng.connect(v.input)
    src.start(t)
    src.stop(t + 0.06)
    src.onended = () => {
      try {
        ng.disconnect()
      } catch {
        /* контекст уже закрыт */
      }
    }
    this.events.push({ plantId: v.data.id, time: t, velocity: ghost ? vel * 0.55 : vel, ghost })
  }

  /** Мягкий «сополиф»-клик посадки семени. */
  playPlantSound(type: string, nx: number) {
    if (this.disposed) return
    const ctx = this.ctx
    const t = ctx.currentTime + 0.02
    const p = ctx.createStereoPanner()
    p.pan.value = panFor(nx)
    p.connect(this.master)
    const wet = ctx.createGain()
    wet.gain.value = 0.5
    p.connect(wet)
    wet.connect(this.convolver)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(type === 'hit' ? 340 : 640, t)
    o.frequency.exponentialRampToValueAtTime(type === 'hit' ? 150 : 210, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.24)
    o.connect(g)
    g.connect(p)
    o.start(t)
    o.stop(t + 0.3)
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 2600
    bp.Q.value = 2.5
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.09, t)
    ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.05)
    src.connect(bp)
    bp.connect(ng)
    ng.connect(p)
    src.start(t)
    src.stop(t + 0.08)
    const drop = () => {
      try {
        p.disconnect()
        wet.disconnect()
      } catch {
        /* контекст уже закрыт */
      }
    }
    o.onended = drop
    src.onended = drop
  }

  // ---------- управление растениями ----------

  addPlant(data: PlantData) {
    if (this.disposed || this.voices.has(data.id)) return
    const ctx = this.ctx
    const input = ctx.createGain()
    const panner = ctx.createStereoPanner()
    const wetSend = ctx.createGain()
    input.gain.value = 0.0001
    panner.pan.value = panFor(data.nx)
    wetSend.gain.value = wetFor(data.nx, data.ny)
    input.connect(panner)
    panner.connect(this.master)
    panner.connect(wetSend)
    wetSend.connect(this.convolver)

    const interval = plantInterval(data.seed)
    const level = data.type === 'drone' ? 0.16 : 1
    let drone: DroneNodes | null = null
    if (data.type === 'drone') {
      const f = midiToFreq(this.currentRoot())
      const osc1 = ctx.createOscillator()
      osc1.type = 'sawtooth'
      osc1.frequency.value = f
      osc1.detune.value = -4
      const osc2 = ctx.createOscillator()
      osc2.type = 'sawtooth'
      osc2.frequency.value = f
      osc2.detune.value = 4
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 850
      filter.Q.value = 1.1
      const lfo = ctx.createOscillator()
      lfo.type = 'sine'
      lfo.frequency.value = 0.06
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 550
      const env = ctx.createGain()
      env.gain.value = 0.0001
      lfo.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      osc1.connect(filter)
      osc2.connect(filter)
      filter.connect(env)
      env.connect(input)
      osc1.start()
      osc2.start()
      lfo.start()
      env.gain.setTargetAtTime(1, ctx.currentTime, 0.9)
      drone = { osc1, osc2, filter, lfo, lfoGain, env }
    }
    input.gain.setTargetAtTime(level, ctx.currentTime, data.type === 'drone' ? 0.8 : 0.04)

    const isRhythm = data.type === 'pluck' || data.type === 'hit'
    this.voices.set(data.id, {
      data,
      input,
      panner,
      wetSend,
      level,
      interval,
      euclid: isRhythm ? plantEuclid(data.seed, data.type).pattern : null,
      choirReadyStep: 4 + Math.floor(Math.random() * 16),
      drone,
    })
  }

  removePlant(id: number) {
    const v = this.voices.get(id)
    if (!v) return
    const t = this.ctx.currentTime
    if (v.drone) {
      v.drone.env.gain.cancelScheduledValues(t)
      v.drone.env.gain.setTargetAtTime(0.0001, t, 0.06)
      try {
        v.drone.osc1.stop(t + 0.4)
        v.drone.osc2.stop(t + 0.4)
        v.drone.lfo.stop(t + 0.4)
      } catch {
        /* уже остановлены */
      }
    }
    v.input.gain.cancelScheduledValues(t)
    v.input.gain.setTargetAtTime(0.0001, t, 0.05)
    this.voices.delete(id)
    setTimeout(() => {
      try {
        v.input.disconnect()
        v.panner.disconnect()
        v.wetSend.disconnect()
      } catch {
        /* контекст уже закрыт */
      }
    }, 600)
  }

  setPlantMuted(id: number, muted: boolean) {
    const v = this.voices.get(id)
    if (!v) return
    v.data.muted = muted
    v.input.gain.setTargetAtTime(muted ? 0.0001 : v.level, this.ctx.currentTime, 0.09)
  }

  /** Пересчёт панорамы и влажности из текущей позиции растения. */
  updatePosition(id: number) {
    const v = this.voices.get(id)
    if (!v) return
    const t = this.ctx.currentTime
    v.panner.pan.setTargetAtTime(panFor(v.data.nx), t, 0.05)
    v.wetSend.gain.setTargetAtTime(wetFor(v.data.nx, v.data.ny), t, 0.08)
  }

  // ---------- глобальные режимы ----------

  setWeather(v: number) {
    this.weather = clamp(v, 0, 1)
  }

  setMutedAll(muted: boolean) {
    this.master.gain.setTargetAtTime(muted ? 0.0001 : this.masterLevel, this.ctx.currentTime, 0.06)
  }

  // ---------- аналитика и события ----------

  getFrame(): AudioFrame {
    this.analyser.getByteFrequencyData(this.freqData)
    const d = this.freqData
    const avg = (a: number, b: number) => {
      let s = 0
      for (let i = a; i < b; i++) s += d[i]
      return s / ((b - a) * 255)
    }
    const hiEnd = Math.min(200, d.length)
    const k = 0.3
    this.bands.bass = lerp(this.bands.bass, avg(0, 7), k)
    this.bands.lowMid = lerp(this.bands.lowMid, avg(7, 21), k)
    this.bands.mid = lerp(this.bands.mid, avg(21, 65), k)
    this.bands.high = lerp(this.bands.high, avg(65, hiEnd), k)
    return { ...this.bands, spectrum: d }
  }

  drainEvents(): NoteEvent[] {
    if (this.events.length === 0) return []
    const now = this.ctx.currentTime
    const out: NoteEvent[] = []
    while (this.events.length > 0 && this.events[0].time <= now + 0.02) {
      const ev = this.events.shift()
      if (ev) out.push(ev)
    }
    return out
  }

  currentRoot(): number {
    const bar = Math.floor(this.step16 / 16)
    return CHORD_ROOTS[Math.floor(bar / BARS_PER_CHORD) % CHORD_ROOTS.length]
  }

  chordName(): string {
    const bar = Math.floor(this.step16 / 16)
    return CHORD_NAMES[Math.floor(bar / BARS_PER_CHORD) % CHORD_NAMES.length]
  }

  plantNoteName(data: PlantData): string {
    const root = this.currentRoot()
    if (data.type === 'drone') return `${midiToName(root)} · корень`
    return midiToName(quantizeToScale(root + plantInterval(data.seed)))
  }

  // ---------- завершение ----------

  async dispose() {
    if (this.disposed) return
    this.disposed = true
    document.removeEventListener('visibilitychange', this.onVisibility)
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    const t = this.ctx.currentTime
    for (const v of this.voices.values()) {
      if (v.drone) {
        try {
          v.drone.osc1.stop(t + 0.05)
          v.drone.osc2.stop(t + 0.05)
          v.drone.lfo.stop(t + 0.05)
        } catch {
          /* уже остановлены */
        }
      }
      try {
        v.input.disconnect()
        v.panner.disconnect()
        v.wetSend.disconnect()
      } catch {
        /* уже отключены */
      }
    }
    this.voices.clear()
    this.events.length = 0
    try {
      this.master.disconnect()
      this.comp.disconnect()
      this.analyser.disconnect()
      this.convolver.disconnect()
      this.wetBus.disconnect()
    } catch {
      /* уже отключены */
    }
    try {
      await this.ctx.close()
    } catch {
      /* уже закрыт */
    }
  }
}

/** Экспорт константы BPM для HUD. */
export const ENGINE_BPM = BPM
