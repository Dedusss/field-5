/**
 * Простой скользящий rate-limit в памяти (без внешних зависимостей).
 * Для исследовательского проекта достаточно; масштабируется заменой на Redis.
 */
const buckets = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = (buckets.get(key) ?? []).filter((ts) => now - ts < windowMs)
  if (arr.length >= limit) {
    buckets.set(key, arr)
    return false
  }
  arr.push(now)
  buckets.set(key, arr)
  if (buckets.size > 5000) {
    // гигиена: чистка старых корзин
    for (const [k, v] of buckets) {
      if (v.every((ts) => now - ts >= windowMs)) buckets.delete(k)
    }
  }
  return true
}
