import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const GENERATION_SIZE = 12 // поколение = 1 + каждые 12 прививок

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'local'
}

async function ensureOrganism() {
  let org = await db.organism.findUnique({ where: { id: 'singleton' } })
  if (!org) {
    org = await db.organism.create({ data: { id: 'singleton' } })
  }
  return org
}

function serialize(org: {
  energy: number
  totalGrafts: number
  totalPulses: number
  updatedAt: Date
}) {
  return {
    energy: org.energy,
    totalGrafts: org.totalGrafts,
    totalPulses: org.totalPulses,
    generation: 1 + Math.floor(org.totalGrafts / GENERATION_SIZE),
    updatedAt: org.updatedAt,
  }
}

export async function GET() {
  try {
    const org = await ensureOrganism()
    const mutations = await db.mutation.findMany({
      orderBy: { id: 'desc' },
      take: 200,
    })
    return NextResponse.json({
      organism: serialize(org),
      mutations: mutations.reverse(),
    })
  } catch {
    return NextResponse.json({ error: 'Организм недоступен' }, { status: 500 })
  }
}

interface FeedBody {
  type?: string
  angle?: number
  distance?: number
  potency?: number
  visitorId?: string
  clientEnergy?: number
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(`organism:${clientKey(req)}`, 30, 60_000)) {
      return NextResponse.json({ error: 'Слишком много энергии за минуту' }, { status: 429 })
    }
    const body = (await req.json()) as FeedBody
    const type = body.type === 'pulse' ? 'pulse' : body.type === 'graft' ? 'graft' : null
    if (!type) {
      return NextResponse.json({ error: 'Неизвестный тип мутации' }, { status: 400 })
    }

    const org = await ensureOrganism()
    void org

    if (type === 'graft') {
      const angle = clamp(Number(body.angle), 0, Math.PI * 2, Math.random() * Math.PI * 2)
      const distance = clamp(Number(body.distance), 0.05, 1, 0.5)
      const potency = clamp(Number(body.potency), 0.1, 1, 0.6)
      const energy = Math.round(clamp(Number(body.clientEnergy), 0, 120, 40))
      const visitor = sanitizeVisitor(body.visitorId)
      const updated = await db.organism.update({
        where: { id: 'singleton' },
        data: {
          energy: { increment: energy },
          totalGrafts: { increment: 1 },
        },
      })
      const mutation = await db.mutation.create({
        data: { kind: 'graft', angle, distance, potency, visitor, energy },
      })
      return NextResponse.json({ organism: serialize(updated), mutation })
    }

    // pulse
    const energy = Math.round(clamp(Number(body.clientEnergy), 0, 30, 10))
    const visitor = sanitizeVisitor(body.visitorId)
    const updated = await db.organism.update({
      where: { id: 'singleton' },
      data: {
        energy: { increment: energy },
        totalPulses: { increment: 1 },
      },
    })
    const mutation = await db.mutation.create({
      data: { kind: 'pulse', angle: 0, distance: 0, potency: 0.2, visitor, energy },
    })
    return NextResponse.json({ organism: serialize(updated), mutation })
  } catch {
    return NextResponse.json({ error: 'Организм не принял энергию' }, { status: 500 })
  }
}

function clamp(v: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function sanitizeVisitor(raw: unknown): string {
  if (typeof raw !== 'string') return 'гость #????'
  const clean = raw
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toLowerCase()
  return `гость #${clean || 'anon'}`
}
