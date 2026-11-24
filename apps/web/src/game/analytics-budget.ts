import { ANALYTICS_KEY, readStored, writeStored } from './storage.ts'

/** A session may record this many events outright before sampling starts. */
const SAMPLE_AFTER = 300
/** Deeper sessions keep one in every SAMPLE_EVERY events, so the tail stays visible. */
const SAMPLE_EVERY = 3
/** The hard attempt limit, so one open tab cannot record forever. */
const SESSION_LIMIT = 1_500
const MONTH_LIMIT = 3_000

const FUNNEL = new Set([
  'app:session_start',
  'app:session_end',
  'company:founded',
  'company:era_reached',
  'company:exited',
])

type Counts = Readonly<{
  events: number
  sessionEvents: number
}>

type Store = Counts &
  Readonly<{
    month: string
    session: string
  }>

let memory: Store | null = null

const isStore = (value: unknown): value is Store => {
  if (typeof value !== 'object' || value === null) return false
  const store = value as Record<string, unknown>
  return (
    typeof store['month'] === 'string' &&
    typeof store['events'] === 'number' &&
    Number.isFinite(store['events']) &&
    store['events'] >= 0 &&
    typeof store['session'] === 'string' &&
    typeof store['sessionEvents'] === 'number' &&
    Number.isFinite(store['sessionEvents']) &&
    store['sessionEvents'] >= 0
  )
}

const session = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const monthOf = (now: number): string => new Date(now).toISOString().slice(0, 7)

const read = (now: number): Store => {
  const month = monthOf(now)
  const fresh: Store = { month, events: 0, session, sessionEvents: 0 }
  const raw = readStored(ANALYTICS_KEY)
  const fallback = (): Store =>
    memory !== null && memory.month === month ? memory : (memory = fresh)
  if (raw === null) return fallback()
  try {
    const stored: unknown = JSON.parse(raw)
    if (!isStore(stored) || stored.month !== month) return fresh
    return stored.session === session ? stored : { ...stored, session, sessionEvents: 0 }
  } catch {
    return fallback()
  }
}

const write = (store: Store): void => {
  memory = store
  writeStored(ANALYTICS_KEY, JSON.stringify(store))
}

export const isFunnel = (event: string): boolean => FUNNEL.has(event)

/**
 * The budget decision for one event. Funnel events skip sampling but still
 * count toward the month. A sampled-out event still uses a session attempt,
 * so a long session reaches its hard limit instead of recording forever.
 */
export const stepBudget = (
  counts: Counts,
  event: string,
): Readonly<{ allowed: boolean; next: Counts }> => {
  if (counts.events >= MONTH_LIMIT) return { allowed: false, next: counts }
  if (isFunnel(event)) return { allowed: true, next: { ...counts, events: counts.events + 1 } }
  const attempt = counts.sessionEvents + 1
  if (attempt > SESSION_LIMIT || (attempt > SAMPLE_AFTER && attempt % SAMPLE_EVERY !== 0))
    return { allowed: false, next: { ...counts, sessionEvents: attempt } }
  return {
    allowed: true,
    next: { events: counts.events + 1, sessionEvents: attempt },
  }
}

export const allow = (event: string, now: number): boolean => {
  const store = read(now)
  const { allowed, next } = stepBudget(store, event)
  if (next !== store) write({ ...store, ...next })
  return allowed
}
