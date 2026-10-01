import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const ALLOWED_SITES = new Set([
  'monolith',
  'synthesis',
  'archive',
  'textfield',
  'organism',
  'lab',
  'report',
])

function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd ? fwd.split(',')[0].trim() : 'local'
}

export async function POST(req: Request) {
  try {
    if (!rateLimit(`telemetry:${clientKey(req)}`, 60, 60_000)) {
      return NextResponse.json({ ok: false, error: 'Слишком часто' }, { status: 429 })
    }
    const body = (await req.json()) as { site?: string }
    const site = body.site ?? ''
    if (!ALLOWED_SITES.has(site)) {
      return NextResponse.json({ ok: false, error: 'Неизвестная сцена' }, { status: 400 })
    }
    await db.visit.create({ data: { site } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Ошибка записи' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const grouped = await db.visit.groupBy({
      by: ['site'],
      _count: { site: true },
    })
    const sites: Record<string, number> = {}
    let total = 0
    for (const g of grouped) {
      sites[g.site] = g._count.site
      total += g._count.site
    }
    for (const s of ALLOWED_SITES) {
      if (!(s in sites)) sites[s] = 0
    }
    return NextResponse.json({ total, sites })
  } catch {
    return NextResponse.json({ total: 0, sites: {} }, { status: 200 })
  }
}
