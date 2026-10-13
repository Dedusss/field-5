'use client'

/**
 * Л·09 «ОСЦИЛЛОГРАФ» — фигуры Лиссажу как прибор.
 *
 * Луч рисует x = f(A·t), y = f(B·t + φ): соотношение частот задаёт
 * узор, дрейф фазы вращает его, форма волны сгибает дуги в углы.
 * Канвас помнит себя — фосфорное послесвечение, как у ЭЛТ.
 * Тумблер «Тон» поднимает генератор Web Audio (110 Гц × B) —
 * фигуру становится слышно; меняется форма волны — меняется тембр.
 */

import {
  numParam,
  strParam,
  type DemoInstance,
  type DemoModule,
} from '@/lib/lab/types'

/** Соотношения частот A:B (копримы — фигуры замкнуты и узнаваемы). */
const RATIOS: Record<string, [number, number]> = {
  '1:1': [1, 1],
  '1:2': [1, 2],
  '2:3': [2, 3],
  '3:4': [3, 4],
  '5:4': [5, 4],
}

/** Формы волны. x — фаза в радианах, значение в [-1, 1]. */
const WAVES: Record<string, (x: number) => number> = {
  sine: (x) => Math.sin(x),
  triangle: (x) => (Math.asin(Math.sin(x)) * 2) / Math.PI,
  saw: (x) => (((x / (Math.PI * 2)) % 1) + 1) % 1 * 2 - 1,
  square: (x) => (Math.sin(x) >= 0 ? 1 : -1),
}

/** Отображение формы волны на тип осциллятора Web Audio. */
const OSC_TYPES: Record<string, OscillatorType> = {
  sine: 'sine',
  triangle: 'triangle',
  saw: 'sawtooth',
  square: 'square',
}

const BG = '#040a07'
const PHOSPHOR = '88, 240, 140'

export const oscilloscopeDemo: DemoModule = {
  id: 'scope',
  title: 'Осциллограф',
  latin: 'OSCILLOGRAPH',
  category: 'gen',
  description:
    'Фигуры Лиссажу — язык старых осциллографов: соотношение частот A:B задаёт узор, дрейф фазы вращает его, форма волны сгибает дуги в углы. Луч оставляет фосфорное послесвечение, как настоящая ЭЛТ. Тумблер «Тон» включает генератор Web Audio — фигуру становится слышно.',
  tech: 'canvas 2d · фигуры Лиссажу · послесвечение ЭЛТ · генератор тона web audio',
  params: [
    {
      key: 'wave',
      label: 'Форма волны',
      kind: 'select',
      value: 'sine',
      options: [
        { value: 'sine', label: 'синус' },
        { value: 'triangle', label: 'треугольник' },
        { value: 'saw', label: 'пила' },
        { value: 'square', label: 'меандр' },
      ],
    },
    {
      key: 'ratio',
      label: 'Соотношение A:B',
      kind: 'select',
      value: '2:3',
      options: Object.keys(RATIOS).map((r) => ({ value: r, label: r })),
    },
    {
      key: 'drift',
      label: 'Дрейф фазы',
      kind: 'range',
      min: 0,
      max: 100,
      step: 1,
      value: 30,
    },
    { key: 'tone', label: 'Тон', kind: 'toggle', value: false },
  ],
  create(canvas, params, opts) {
    const ctx0 = canvas.getContext('2d')
    if (!ctx0) {
      return { frame: () => {}, setParam: () => {}, destroy: () => {} }
    }
    const ctx = ctx0

    let w = 1
    let h = 1
    let waveKey = strParam(params, 'wave', 'sine')
    let waveFn = WAVES[waveKey] ?? WAVES.sine
    let ratio = RATIOS[strParam(params, 'ratio', '2:3')] ?? RATIOS['2:3']
    let drift = numParam(params, 'drift', 30)
    let toneOn = params.tone === true

    // фаза луча (рад) и накопленный дрейф фазы фигуры
    let beamTau = 0
    let phase = 0
    let prevX = 0
    let prevY = 0
    let hasPrev = false

    let audioCtx: AudioContext | null = null
    let osc: OscillatorNode | null = null
    let gainNode: GainNode | null = null

    /** Частота тона: основной тон 110 Гц × B-частота фигуры. */
    const toneFreq = (): number => 110 * ratio[1]

    function startTone(): void {
      const Ctor = window.AudioContext
      if (!Ctor) return
      if (audioCtx === null) audioCtx = new Ctor()
      void audioCtx.resume()
      stopOsc()
      osc = audioCtx.createOscillator()
      osc.type = OSC_TYPES[waveKey] ?? 'sine'
      osc.frequency.value = toneFreq()
      gainNode = audioCtx.createGain()
      gainNode.gain.value = 0.045
      osc.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      osc.start()
    }

    function stopOsc(): void {
      if (osc) {
        try {
          osc.stop()
        } catch {
          // уже остановлен
        }
        osc.disconnect()
        osc = null
      }
      if (gainNode) {
        gainNode.disconnect()
        gainNode = null
      }
    }

    function stopTone(): void {
      stopOsc()
      if (audioCtx && audioCtx.state === 'running') void audioCtx.suspend()
    }

    /** Позиция луча на фазе tau. */
    function beamAt(tau: number): { x: number; y: number } {
      const s = Math.min(w, h)
      const r = s * 0.42
      const a = ratio[0]
      const b = ratio[1]
      return {
        x: w / 2 + waveFn(a * tau) * r,
        y: h / 2 - waveFn(b * tau + phase) * r,
      }
    }

    /** Сетка развертки — рисуется каждый кадр, послесвечение её гасит. */
    function graticule(): void {
      const s = Math.min(w, h)
      const r = s * 0.42
      const x0 = w / 2 - r
      const x1 = w / 2 + r
      const y0 = h / 2 - r
      const y1 = h / 2 + r
      ctx.strokeStyle = `rgba(${PHOSPHOR}, 0.09)`
      ctx.lineWidth = 1
      ctx.beginPath()
      const step = r / 4
      for (let i = 0; i <= 8; i++) {
        const gx = x0 + i * step
        const gy = y0 + i * step
        ctx.moveTo(gx, y0)
        ctx.lineTo(gx, y1)
        ctx.moveTo(x0, gy)
        ctx.lineTo(x1, gy)
      }
      ctx.stroke()
      // осевые чуть ярче + метки центра
      ctx.strokeStyle = `rgba(${PHOSPHOR}, 0.16)`
      ctx.beginPath()
      ctx.moveTo(w / 2, y0)
      ctx.lineTo(w / 2, y1)
      ctx.moveTo(x0, h / 2)
      ctx.lineTo(x1, h / 2)
      ctx.stroke()
      ctx.strokeStyle = `rgba(${PHOSPHOR}, 0.28)`
      ctx.beginPath()
      for (let i = 1; i < 8; i++) {
        const gx = x0 + i * step
        const gy = y0 + i * step
        ctx.moveTo(gx - 3, h / 2)
        ctx.lineTo(gx + 3, h / 2)
        ctx.moveTo(w / 2, gy - 3)
        ctx.lineTo(w / 2, gy + 3)
      }
      ctx.stroke()
    }

    /** Полная фигура одним росчерком (для reduced-motion и первого кадра). */
    function paintFigure(): void {
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, w, h)
      graticule()
      const N = 640
      ctx.lineJoin = 'round'
      for (const pass of [
        { width: 3.2, alpha: 0.22 },
        { width: 1.3, alpha: 0.95 },
      ]) {
        ctx.strokeStyle = `rgba(${PHOSPHOR}, ${pass.alpha})`
        ctx.lineWidth = pass.width
        ctx.beginPath()
        for (let i = 0; i <= N; i++) {
          const tau = (i / N) * Math.PI * 2
          const p = beamAt(tau)
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        ctx.stroke()
      }
    }

    function resize(): void {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = Math.max(1, canvas.clientWidth)
      h = Math.max(1, canvas.clientHeight)
      const bw = Math.round(w * dpr)
      const bh = Math.round(h * dpr)
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw
        canvas.height = bh
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      hasPrev = false
      if (opts.reduced) paintFigure()
    }

    resize()

    return {
      frame(_t, dt) {
        if (opts.reduced) return
        // гасим прошлое (послесвечение) и восстанавливаем сетку
        ctx.fillStyle = 'rgba(4, 10, 7, 0.10)'
        ctx.fillRect(0, 0, w, h)
        graticule()

        // дрейф фазы фигуры
        phase += (drift / 100) * 0.85 * dt

        // луч: полное обнуление фигуры — за 2π фазы
        const CYCLE = Math.PI * 2
        const prevTau = beamTau
        beamTau += dt * CYCLE * 2.2
        const sub = Math.max(6, Math.ceil(((beamTau - prevTau) / CYCLE) * 48))
        let from = prevTau
        if (beamTau - prevTau > CYCLE) beamTau = prevTau + CYCLE

        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        for (const pass of [
          { width: 3.4, alpha: 0.2 },
          { width: 1.35, alpha: 0.9 },
        ]) {
          ctx.strokeStyle = `rgba(${PHOSPHOR}, ${pass.alpha})`
          ctx.lineWidth = pass.width
          ctx.beginPath()
          for (let i = 0; i <= sub; i++) {
            const tau = from + ((beamTau - from) * i) / sub
            const p = beamAt(tau)
            if (i === 0 && hasPrev) ctx.moveTo(prevX, prevY)
            else if (i === 0) ctx.moveTo(p.x, p.y)
            else ctx.lineTo(p.x, p.y)
          }
          ctx.stroke()
        }

        // яркая точка луча
        const head = beamAt(beamTau)
        ctx.fillStyle = 'rgba(216, 255, 230, 0.95)'
        ctx.beginPath()
        ctx.arc(head.x, head.y, 1.8, 0, Math.PI * 2)
        ctx.fill()
        prevX = head.x
        prevY = head.y
        hasPrev = true
        if (beamTau >= CYCLE * 64) {
          // защита точности float: фигура периодична по 2π
          beamTau %= CYCLE
          from = 0
        }
      },
      setParam(key, value) {
        if (key === 'wave' && typeof value === 'string') {
          waveKey = value
          waveFn = WAVES[value] ?? WAVES.sine
          if (osc) osc.type = OSC_TYPES[value] ?? 'sine'
        } else if (key === 'ratio' && typeof value === 'string') {
          ratio = RATIOS[value] ?? RATIOS['2:3']
          if (osc && audioCtx) {
            osc.frequency.setTargetAtTime(
              toneFreq(),
              audioCtx.currentTime,
              0.03,
            )
          }
        } else if (key === 'drift' && typeof value === 'number') {
          drift = value
        } else if (key === 'tone' && typeof value === 'boolean') {
          toneOn = value
          if (toneOn) startTone()
          else stopTone()
        }
        hasPrev = false
        if (opts.reduced) paintFigure()
      },
      resize,
      destroy() {
        stopOsc()
        if (audioCtx) {
          void audioCtx.close()
          audioCtx = null
        }
      },
    }
  },
}
