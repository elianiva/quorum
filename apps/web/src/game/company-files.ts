import type { SaveIndex } from './saves.ts'
import { pruneCompanyFiles, readStored, removeStored, saveKeyOf, writeStored } from './storage.ts'

const COMPANY_DB = 'quorum'
const COMPANY_STORE = 'companies'
const COMPANY_DB_VERSION = 1
const OPEN_TIMEOUT_MS = 3000

export type Durability = 'strict' | 'relaxed'

export type CompanyDb = Readonly<{
  get: (id: string) => Promise<string | null>
  put: (id: string, json: string, durability: Durability) => Promise<void>
  remove: (id: string) => Promise<void>
  keys: () => Promise<ReadonlyArray<string>>
}>

const openDatabase = (factory: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    let settled = false
    const fail = (reason: unknown): void => {
      settled = true
      reject(reason instanceof Error ? reason : new Error('The Company database did not open.'))
    }
    const request = factory.open(COMPANY_DB, COMPANY_DB_VERSION)
    const timer = setTimeout(() => fail(null), OPEN_TIMEOUT_MS)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(COMPANY_STORE))
        request.result.createObjectStore(COMPANY_STORE)
    }
    request.onblocked = () => fail(null)
    request.onerror = () => {
      clearTimeout(timer)
      fail(request.error)
    }
    request.onsuccess = () => {
      clearTimeout(timer)
      if (settled) return request.result.close()
      settled = true
      resolve(request.result)
    }
  })

const transact = <Result>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  durability: Durability,
  ask: (store: IDBObjectStore) => IDBRequest<Result>,
): Promise<Result> =>
  new Promise((resolve, reject) => {
    const transaction = database.transaction(COMPANY_STORE, mode, { durability })
    const request = ask(transaction.objectStore(COMPANY_STORE))
    const fail = (): void =>
      reject(transaction.error ?? request.error ?? new Error('The Company database refused.'))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = fail
    transaction.onerror = fail
  })

const browserDb = (): CompanyDb | null => {
  let factory: IDBFactory | undefined
  try {
    factory = typeof indexedDB === 'undefined' ? undefined : indexedDB
  } catch {}
  if (!factory) return null
  const from = factory
  let opening: Promise<IDBDatabase> | null = null
  const database = (): Promise<IDBDatabase> => {
    if (opening !== null) return opening
    const attempt = openDatabase(from).then((opened) => {
      const forget = (): void => {
        if (opening === attempt) opening = null
      }
      opened.onversionchange = () => {
        opened.close()
        forget()
      }
      opened.onclose = forget
      return opened
    })
    opening = attempt
    attempt.catch(() => {
      if (opening === attempt) opening = null
    })
    return attempt
  }
  return {
    get: async (id) => {
      const found: unknown = await transact(await database(), 'readonly', 'relaxed', (store) =>
        store.get(id),
      )
      return typeof found === 'string' ? found : null
    },
    put: async (id, json, durability) => {
      await transact(await database(), 'readwrite', durability, (store) => store.put(json, id))
    },
    remove: async (id) => {
      await transact(await database(), 'readwrite', 'strict', (store) => store.delete(id))
    },
    keys: async () => {
      const keys = await transact(await database(), 'readonly', 'relaxed', (store) =>
        store.getAllKeys(),
      )
      return keys.filter((key) => typeof key === 'string')
    },
  }
}

let shared: CompanyDb | null | undefined

export const companyDb = (): CompanyDb | null => {
  if (shared === undefined) shared = browserDb()
  return shared
}

const savedTime = (json: string): number | null => {
  try {
    const parsed: unknown = JSON.parse(json)
    if (typeof parsed !== 'object' || parsed === null) return null
    const time = (parsed as Record<string, unknown>)['time']
    return typeof time === 'number' ? time : null
  } catch {
    return null
  }
}

export const newerSave = (kept: string | null, old: string | null): string | null => {
  if (kept === null || old === null) return kept ?? old
  const keptAt = savedTime(kept)
  if (keptAt === null) return old
  const oldAt = savedTime(old)
  return oldAt !== null && oldAt >= keptAt ? old : kept
}

export type CompanyRead = Readonly<{ json: string | null; unread: boolean }>

export const readCompany = async (db: CompanyDb | null, id: string): Promise<CompanyRead> => {
  const old = readStored(saveKeyOf(id))
  if (db === null) return { json: old, unread: false }
  try {
    return { json: newerSave(await db.get(id), old), unread: false }
  } catch {
    return { json: old, unread: old === null }
  }
}

let turns = 0
const lastWrite = new Map<string, number>()
const lastSafety = new Map<string, number>()

export const writeCompany = async (
  db: CompanyDb | null,
  id: string,
  json: string,
  closing = false,
): Promise<boolean> => {
  const key = saveKeyOf(id)
  const turn = (turns += 1)
  lastWrite.set(id, turn)
  const wroteOldKeyNow = closing && writeStored(key, json)
  if (wroteOldKeyNow) lastSafety.set(id, turn)
  if (db !== null) {
    try {
      const removesOldKey = wroteOldKeyNow || readStored(key) !== null
      await db.put(id, json, removesOldKey ? 'strict' : 'relaxed')
      if ((lastSafety.get(id) ?? 0) <= turn) removeStored(key)
      return true
    } catch {}
  }
  if (lastWrite.get(id) !== turn) return true
  const wrote = wroteOldKeyNow || writeStored(key, json)
  if (wrote && db !== null) await db.remove(id).catch(() => undefined)
  return wrote
}

export const deleteCompany = async (db: CompanyDb | null, id: string): Promise<void> => {
  removeStored(saveKeyOf(id))
  if (db === null) return
  await db.remove(id).catch(() => undefined)
}

export const pruneCompanies = async (db: CompanyDb | null, index: SaveIndex): Promise<void> => {
  pruneCompanyFiles(index)
  if (db === null) return
  const keep = new Set(index.companies.map((file) => file.id))
  try {
    for (const id of await db.keys()) if (!keep.has(id) && !lastWrite.has(id)) await db.remove(id)
  } catch {}
}
