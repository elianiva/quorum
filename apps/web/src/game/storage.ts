import type { SaveIndex } from './saves.ts'

export const SAVE_INDEX_KEY = 'quorum.saves.v1'
export const SAVE_PREFIX = 'quorum.save.v3.'
export const BROKEN_SAVE_KEY = 'quorum.save.broken.v1'
export const PREFS_KEY = 'quorum.prefs.v1'
export const FOUNDER_KEY = 'quorum.founder.v1'
export const SANDBOX_KEY = 'quorum.sandbox.v1'
export const AGENT_ROOMS_KEY = 'quorum.agent.rooms'
export const ANALYTICS_KEY = 'quorum.analytics.v1'
export const LOG_KEY = 'quorum.playlog.v1'
export const ROOM_NAME_KEY = 'quorum.room.name'

export const saveKeyOf = (id: string): string => `${SAVE_PREFIX}${id}`

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export const readStored = (key: string): string | null => {
  const target = storage()
  if (target === null) return null
  try {
    return target.getItem(key)
  } catch {
    return null
  }
}

export const writeStored = (key: string, value: string): boolean => {
  const target = storage()
  if (target === null) return false
  try {
    target.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export const removeStored = (key: string): void => {
  const target = storage()
  if (target === null) return
  try {
    target.removeItem(key)
  } catch {}
}

export const storedKeys = (): ReadonlyArray<string> => {
  const target = storage()
  if (target === null) return []
  try {
    const keys: Array<string> = []
    for (let at = 0; at < target.length; at += 1) {
      const key = target.key(at)
      if (key !== null) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

const LEGACY_KEYS = ['quorum.save.v1', 'quorum.save.v2', 'quorum.save.v2.broken'] as const

export const sweepLegacyStorage = (): void => {
  for (const key of LEGACY_KEYS) removeStored(key)
}

export const pruneCompanyFiles = (index: SaveIndex): void => {
  const keep = new Set(index.companies.map((file) => saveKeyOf(file.id)))
  for (const key of storedKeys())
    if (key.startsWith(SAVE_PREFIX) && !keep.has(key)) removeStored(key)
}
