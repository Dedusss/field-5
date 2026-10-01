'use client'

import { useEffect, useRef } from 'react'

export type PreviewKind = 'monolith' | 'synthesis' | 'archive' | 'textfield' | 'organism'

export interface PreviewHandle {
  stop: () => void
}

const DPR_CAP = 1.5

function fit(canvas: HTMLCanvasElement): { dpr: number; w: number; h: number } | null {
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  if (w === 0 || h === 0) return null
  const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
  const pw = Math.round(w * dpr)
  const ph = Math.round(h * dpr)
  if (canvas.width !== pw || canvas.height !== ph) {
    canvas.width = pw
    canvas.height = ph
  }
  return { dpr, w, h }
}

/* ---------- 01 МОНОЛИТ: силуэты в тлеющем тумане ---------- */

function drawMonolith(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, '#191009')
  bg.addColorStop(0.55, '#0e0a07')
  bg.addColorStop(1, '#070503')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // слои монолитов: дальние светлее (туман), ближние — чернее
  const layers = 5
  for (let l = 0; l < layers; l++) {
    const depth = l / (layers - 1)
    const fog = 0.85 - depth * 0.75 // дальние — светлее
    const base = `rgb(${Math.round(11 + 30 * fog)},${Math.round(9 + 22 * fog)},${Math.round(7 + 14 * fog)})`
    ctx.fillStyle = base
    const n = 4 + l * 2
    for (let i = 0; i < n; i++) {
      const seedv = Math.sin(i * 37.7 + l * 91.3) * 43758.5453
      const r1 = seedv - Math.floor(seedv)
      const seedv2 = Math.sin(i * 74.1 + l * 13.7) * 12543.117
      const r2 = seedv2 - Math.floor(seedv2)
      const bw = w * (0.05 + r1 * 0.1)
      const bx = ((i + r2 * 0.7) / n) * w + Math.sin(t * 0.05 + l) * 2
      const bh = h * (0.3 + r2 * 0.55) * (0.5 + depth * 0.6)
      const jag = 1 + 0.12 * Math.sin(i * 5.1 + l * 3.3)
      ctx.fillRect(bx, h - bh * jag, bw, bh * jag)
    }
    // дымка поверх слоя
    ctx.fillStyle = `rgba(20, 12, 7, ${0.16 + (1 - depth) * 0.14})`
    ctx.fillRect(0, 0, w, h)
  }

  // уголь-светоч
  const lx = w * (0.5 + 0.3 * Math.sin(t * 0.35))
  const ly = h * (0.5 + 0.18 * Math.cos(t * 0.22))
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, w * 0.45)
  glow.addColorStop(0, 'rgba(217, 160, 91, 0.5)')
  glow.addColorStop(0.4, 'rgba(217, 160, 91, 0.12)')
  glow.addColorStop(1, 'rgba(217, 160, 91, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(255, 214, 150, 0.95)'
  ctx.beginPath()
  ctx.arc(lx, ly, 2.2, 0, Math.PI * 2)
  ctx.fill()

  // искры
  ctx.fillStyle = 'rgba(240, 196, 128, 0.7)'
  for (let i = 0; i < 7; i++) {
    const s = Math.sin(i * 12.9 + t * 0.9) * 0.5 + 0.5
    const px = w * (0.15 + 0.7 * ((Math.sin(i * 78.2) * 0.5 + 0.5)))
    const py = h - ((t * 12 + i * 53) % (h * 1.1))
    ctx.globalAlpha = 0.25 + 0.5 * s
    ctx.fillRect(px, py, 1.4, 1.4)
  }
  ctx.globalAlpha = 1
}

/* ---------- 02 СИНТЕЗ: пульсирующие кольца и споры ---------- */

function drawSynthesis(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.8)
  bg.addColorStop(0, '#1c0d20')
  bg.addColorStop(1, '#0d060f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const cx = w / 2
  const cy = h / 2
  ctx.globalCompositeOperation = 'lighter'

  // пульс-кольца
  for (let i = 0; i < 4; i++) {
    const phase = (t * 0.35 + i / 4) % 1
    const r = phase * w * 0.52
    ctx.strokeStyle = `rgba(232, 79, 208, ${0.4 * (1 - phase)})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  // споры на лиссажу-орбитах
  for (let i = 0; i < 22; i++) {
    const p = i / 22
    const x = cx + Math.sin(t * (0.5 + p * 0.7) + i * 1.7) * w * 0.36
    const y = cy + Math.cos(t * (0.4 + (1 - p) * 0.6) + i * 2.3) * h * 0.34
    const pulse = Math.sin(t * 3 + i * 1.3) * 0.5 + 0.5
    const rad = 1.2 + pulse * 2.2
    ctx.fillStyle = i % 3 === 0 ? 'rgba(182, 243, 77, 0.85)' : 'rgba(232, 79, 208, 0.8)'
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }

  // ядро-семя
  const coreR = 5 + Math.sin(t * 2.6) * 2.2
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 3)
  core.addColorStop(0, 'rgba(246, 238, 248, 0.95)')
  core.addColorStop(0.4, 'rgba(232, 79, 208, 0.5)')
  core.addColorStop(1, 'rgba(232, 79, 208, 0)')
  ctx.fillStyle = core
  ctx.fillRect(cx - coreR * 3, cy - coreR * 3, coreR * 6, coreR * 6)

  // земля
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = 'rgba(182, 243, 77, 0.25)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, h * 0.82 + Math.sin(t * 1.8) * 2)
  ctx.lineTo(w, h * 0.82 + Math.cos(t * 1.5) * 2)
  ctx.stroke()
}

/* ---------- 03 АРХИВ: каркасный торус-узел ---------- */

function drawArchive(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#efe9dc'
  ctx.fillRect(0, 0, w, h)
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.75)
  vg.addColorStop(0, 'rgba(216, 199, 173, 0)')
  vg.addColorStop(1, 'rgba(122, 100, 74, 0.35)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)

  // пьедестал
  ctx.strokeStyle = 'rgba(43, 33, 24, 0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(w / 2, h * 0.78, w * 0.3, h * 0.06, 0, 0, Math.PI * 2)
  ctx.stroke()

  const p = 2
  const q = 3
  const N = 160
  const rotY = t * 0.5
  const rotX = 0.5 + Math.sin(t * 0.23) * 0.25
  const scale = Math.min(w, h) * 0.3
  const pts: Array<[number, number, number]> = []
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * Math.PI * 2
    const r = Math.cos(q * u) + 2
    let x = r * Math.cos(p * u)
    let y = r * Math.sin(p * u)
    let z = -Math.sin(q * u)
    // поворот Y
    const x1 = x * Math.cos(rotY) - z * Math.sin(rotY)
    const z1 = x * Math.sin(rotY) + z * Math.cos(rotY)
    // поворот X
    const y1 = y * Math.cos(rotX) - z1 * Math.sin(rotX)
    const z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX)
    x = x1
    y = y1
    pts.push([x, y, z2])
  }
  ctx.lineWidth = 1.1
  for (let i = 0; i < N; i++) {
    const [x0, y0, z0] = pts[i]
    const [x1, y1, z1] = pts[i + 1]
    const p0 = { x: w / 2 + x0 * scale, y: h / 2 + y0 * scale }
    const p1 = { x: w / 2 + x1 * scale, y: h / 2 + y1 * scale }
    const depth = (z0 + 3) / 6
    ctx.strokeStyle = `rgba(196, 89, 47, ${0.25 + depth * 0.65})`
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.stroke()
  }
  // узлы
  for (let i = 0; i < N; i += 10) {
    const [x, y, z] = pts[i]
    const depth = (z + 3) / 6
    ctx.fillStyle = `rgba(43, 33, 24, ${0.3 + depth * 0.5})`
    ctx.beginPath()
    ctx.arc(w / 2 + x * scale, h / 2 + y * scale, 1.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

/* ---------- 04 ТЕКСТОВОЕ ПОЛЕ: осыпающиеся буквы ---------- */

interface FallGlyph {
  ch: string
  x: number
  y: number
  vy: number
  rot: number
  vr: number
  size: number
  red: boolean
}
let tfGlyphs: FallGlyph[] | null = null
let tfStart = 0

function drawTextfield(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, w, h)

  const word = 'ПОЛЕ ОПЫТОВ'
  if (!tfGlyphs || tfStart === 0) {
    tfStart = t
    let x = w * 0.08
    tfGlyphs = []
    for (const ch of word) {
      const size = ch === ' ' ? w * 0.03 : w * (0.1 + Math.random() * 0.04)
      tfGlyphs.push({
        ch,
        x,
        y: -30 - Math.random() * h * 0.5,
        vy: 0,
        rot: (Math.random() - 0.5) * 0.6,
        vr: (Math.random() - 0.5) * 0.04,
        size,
        red: Math.random() < 0.18,
      })
      x += size * (ch === ' ' ? 0.5 : 0.78)
    }
  }

  const floor = h * 0.84
  ctx.strokeStyle = '#17140f'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(w * 0.06, floor)
  ctx.lineTo(w * 0.94, floor)
  ctx.stroke()

  const g = h * 0.35
  for (const gl of tfGlyphs ?? []) {
    gl.vy += g * 0.016
    gl.y += gl.vy
    gl.rot += gl.vr
    if (gl.y > floor - gl.size * 0.3) {
      gl.y = floor - gl.size * 0.3
      gl.vy *= -0.32
      gl.vr *= 0.5
      if (Math.abs(gl.vy) < 8) {
        gl.vy = 0
        gl.vr = 0
      }
    }
    ctx.save()
    ctx.translate(gl.x, gl.y)
    ctx.rotate(gl.rot)
    ctx.font = `800 ${gl.size}px Onest, sans-serif`
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = gl.red ? '#d43d1f' : '#17140f'
    ctx.fillText(gl.ch, 0, 0)
    ctx.restore()
  }

  // цикл перезапуска
  if (t - tfStart > 7) {
    tfGlyphs = null
    tfStart = 0
  }
}

/* ---------- 05 ОРГАНИЗМ: дышащее ветвление ---------- */

function drawOrganism(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const bg = ctx.createRadialGradient(w / 2, h * 0.75, 0, w / 2, h * 0.75, w * 0.8)
  bg.addColorStop(0, '#0a2014')
  bg.addColorStop(1, '#04100a')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  const branch = (
    x: number,
    y: number,
    angle: number,
    len: number,
    depth: number,
    sw: number,
  ) => {
    if (depth <= 0 || len < 3) return
    const sway = Math.sin(t * 0.9 + depth * 1.4) * 0.09
    const x2 = x + Math.cos(angle + sway) * len
    const y2 = y + Math.sin(angle + sway) * len
    const mix = 1 - depth / 5
    ctx.strokeStyle = `rgba(${Math.round(12 + 62 * mix)},${Math.round(43 + 197 * mix)},${Math.round(26 + 108 * mix)},${0.5 + 0.45 * mix})`
    ctx.lineWidth = sw
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (depth === 1) {
      ctx.fillStyle = 'rgba(78, 240, 138, 0.9)'
      ctx.beginPath()
      ctx.arc(x2, y2, 1.8, 0, Math.PI * 2)
      ctx.fill()
    }
    const spread = 0.45 + Math.sin(t * 0.3 + depth) * 0.08
    branch(x2, y2, angle - spread, len * 0.72, depth - 1, sw * 0.68)
    branch(x2, y2, angle + spread, len * 0.72, depth - 1, sw * 0.68)
  }

  branch(w / 2, h * 0.88, -Math.PI / 2, h * 0.3, 5, w * 0.035)

  // янтарное ядро
  const pulse = Math.sin(t * 2.2) * 0.5 + 0.5
  const core = ctx.createRadialGradient(w / 2, h * 0.88, 0, w / 2, h * 0.88, 16 + pulse * 10)
  core.addColorStop(0, 'rgba(232, 179, 77, 0.85)')
  core.addColorStop(1, 'rgba(232, 179, 77, 0)')
  ctx.fillStyle = core
  ctx.fillRect(w / 2 - 30, h * 0.88 - 30, 60, 60)
}

const RENDERERS: Record<PreviewKind, (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void> = {
  monolith: drawMonolith,
  synthesis: drawSynthesis,
  archive: drawArchive,
  textfield: drawTextfield,
  organism: drawOrganism,
}

export function startPreview(kind: PreviewKind, canvas: HTMLCanvasElement): PreviewHandle {
  const ctx = canvas.getContext('2d')
  if (!ctx) return { stop: () => {} }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  let raf = 0
  let stopped = false
  const start = performance.now()

  const render = (t: number) => {
    const dims = fit(canvas)
    if (dims) {
      const { dpr, w, h } = dims
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      RENDERERS[kind](ctx, w, h, t)
    }
  }

  const ro = new ResizeObserver(() => render((performance.now() - start) / 1000))
  ro.observe(canvas)

  if (reduced) {
    render(1.4)
    return {
      stop: () => {
        ro.disconnect()
      },
    }
  }

  let last = 0
  const loop = (now: number) => {
    if (stopped) return
    if (now - last > 40) {
      last = now
      render((now - start) / 1000)
    }
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    stop: () => {
      stopped = true
      cancelAnimationFrame(raf)
      ro.disconnect()
    },
  }
}

export function SitePreviewCanvas({
  kind,
  className,
}: {
  kind: PreviewKind
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const handle = startPreview(kind, canvas)
    return () => handle.stop()
  }, [kind])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
