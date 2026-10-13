/**
 * Хаб · FIELD·5 — телеграфный отклик интерфейса (Web Audio, без единого ассета).
 *
 * Два коротких механических звука: тик при наведении на строку списка
 * (пишущая машинка) и низкий удар при переходе в сцену (телеграфный ключ).
 * Модуль — внешнее хранилище (useSyncExternalStore): включение/выключение
 * мгновенно отражается в UI без зеркального React-стейта.
 *
 * Политика звука: по умолчанию выключен (тихий вход), выбор хранится
 * в localStorage и переживает перезагрузку. Контекст создаётся лениво;
 * без жеста пользователя остаётся suspended и тики честно молчат —
 * автозапуск не ломаем.
 */

const STORAGE_KEY = 'field5.hub-sound'

let ctx: AudioContext | null = null
let enabled = false
let initialized = false
const listeners = new Set<() => void>()

function readStored(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function persist(v: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

function notify(): void {
  for (const cb of listeners) cb()
}

/** Создать/разбудить контекст. null — API недоступен (вернуть тишину). */
function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC: typeof AudioContext | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** Подписка для useSyncExternalStore; здесь же — первичное чтение localStorage
    (после монтирования, в эффекте React — безопасно для гидратации). */
export function subscribeHubSound(cb: () => void): () => void {
  if (!initialized) {
    initialized = true
    enabled = readStored()
    if (enabled) ensureContext() /* без жеста останется suspended — тики подождут */
  }
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Снимок для useSyncExternalStore (сервер — всегда «выключено»). */
export function hubSoundOn(): boolean {
  return enabled
}

export function getServerHubSound(): boolean {
  return false
}

/** Переключить звук: сохраняет выбор, уведомляет подписчиков;
    при включении из клика даёт подтверждающий удар — сразу, если контекст
    уже активен, либо после асинхронного пробуждения. */
export function setHubSound(v: boolean): boolean {
  enabled = v
  persist(v)
  if (v) {
    const c = ensureContext()
    if (c) {
      if (c.state === 'running') blip(c, 'press')
      else {
        void c
          .resume()
          .then(() => {
            if (enabled && c.state === 'running') blip(c, 'press')
          })
          .catch(() => {})
      }
    }
  }
  notify()
  return enabled
}

/** Тик (наведение/ход по списку) либо удар (переход в сцену). No-op без включения. */
export function hubTick(kind: 'hover' | 'press'): void {
  if (!enabled) return
  const c = ensureContext()
  if (!c || c.state !== 'running') return
  blip(c, kind)
}

function blip(c: AudioContext, kind: 'hover' | 'press'): void {
  const t = c.currentTime
  const master = c.createGain()
  master.connect(c.destination)

  if (kind === 'hover') {
    /* машинописный тик: звонкий квадрат 22 мс, лёгкий разброс частоты */
    master.gain.value = 0.05
    const osc = c.createOscillator()
    osc.type = 'square'
    osc.frequency.value = 1850 + Math.random() * 260
    const g = c.createGain()
    g.gain.setValueAtTime(1, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.032)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + 0.04)
  } else {
    /* телеграфный удар: низкий синус с падением высоты + механический щелчок */
    master.gain.value = 0.11
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(215, t)
    osc.frequency.exponentialRampToValueAtTime(118, t + 0.09)
    const g = c.createGain()
    g.gain.setValueAtTime(1, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.connect(g)
    g.connect(master)
    osc.start(t)
    osc.stop(t + 0.12)

    const click = c.createOscillator()
    click.type = 'square'
    click.frequency.value = 1450
    const cg = c.createGain()
    cg.gain.setValueAtTime(0.5, t)
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.015)
    click.connect(cg)
    cg.connect(master)
    click.start(t)
    click.stop(t + 0.02)
  }
}
