/**
 * ЭКСП. 05 «ОРГАНИЗМ» — API-клиент.
 * Бэкенд: src/app/api/organism/route.ts (Prisma + SQLite, готов, не меняем).
 * Все значения сервер клампит сам; здесь только типы и мягкая обработка ошибок.
 */

export type MutationKind = 'graft' | 'pulse'

export interface Mutation {
  id: number
  kind: MutationKind
  /** рад, 0..2π */
  angle: number
  /** 0.05..1 — доля радиуса колонии */
  distance: number
  /** 0.1..1 — сила мутации (глубина ветвления) */
  potency: number
  /** «гость #xxxx» */
  visitor: string
  energy: number
  createdAt: string
}

export interface OrganismStats {
  energy: number
  totalGrafts: number
  totalPulses: number
  generation: number
  updatedAt: string
}

export interface OrganismFeed {
  organism: OrganismStats
  mutations: Mutation[]
}

export interface MutateResponse {
  organism: OrganismStats
  mutation: Mutation
}

export interface MutatePayload {
  type: MutationKind
  angle?: number
  distance?: number
  potency?: number
  visitorId?: string
  clientEnergy?: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parse(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function getOrganism(signal?: AbortSignal): Promise<OrganismFeed> {
  const res = await fetch('/api/organism', { signal, cache: 'no-store' })
  if (!res.ok) throw new ApiError('Организм недоступен', res.status)
  return (await parse(res)) as OrganismFeed
}

export async function mutateOrganism(
  payload: MutatePayload,
  signal?: AbortSignal,
): Promise<MutateResponse> {
  const res = await fetch('/api/organism', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
  if (!res.ok) throw new ApiError('Организм не принял энергию', res.status)
  return (await parse(res)) as MutateResponse
}
