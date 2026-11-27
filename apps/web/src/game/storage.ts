import type { SaveIndex } from './saves.ts'

export const SAVE_INDEX_KEY = 'quorum.saves.v1'
export const SAVE_PREFIX = 'quorum.save.v3.'
export const BROKEN_SAVE_KEY = 'quorum.save.broken.v1'
export const HELD_FILES_KEY = 'quorum.save.held.v1'
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

const storedKeys = (): ReadonlyArray<string> => {
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

export const heldCompanyIds = (): ReadonlyArray<string> => {
  try {
    const held: unknown = JSON.parse(readStored(HELD_FILES_KEY) ?? '[]')
    return Array.isArray(held) ? held.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

export const holdCompanyFiles = (ids: ReadonlyArray<string>): void => {
  if (ids.length === 0) return
  writeStored(HELD_FILES_KEY, JSON.stringify([...new Set([...heldCompanyIds(), ...ids])]))
}

export const pruneCompanyFiles = (index: SaveIndex): void => {
  const keep = new Set(
    [...index.companies.map((file) => file.id), ...heldCompanyIds()].map(saveKeyOf),
  )
  for (const key of storedKeys())
    if (key.startsWith(SAVE_PREFIX) && !keep.has(key)) removeStored(key)
}
