import type { SaveIndex } from './saves.ts'
import { pruneCompanyFiles, readStored, removeStored, saveKeyOf, writeStored } from './storage.ts'

/* ==========================================================================
   Where a Company file lives: one IndexedDB record per Company, keyed by the
   Company's id and holding the JSON text `save-file.ts` writes. The key
   `quorum.save.v3.<id>` is the place before it, and the fallback where
   IndexedDB is absent or refuses. `docs/storage.md` is the contract.
   ========================================================================== */

/** The database Quorum opens, and the object store that holds the Company files. */
export const COMPANY_DB = 'quorum'
export const COMPANY_STORE = 'companies'
const COMPANY_DB_VERSION = 1
/** A database that does not open in this long is treated as blocked, so a save never waits on it. */
const OPEN_TIMEOUT_MS = 3000

/**
 * How hard a write is pushed to disk before it counts as committed. `strict` is for a write whose
 * commit removes the other copy; `relaxed` is for the autosave that the next one replaces.
 */
export type Durability = 'strict' | 'relaxed'

/**
 * The Company files, by Company id. Every call rejects when the database cannot do it, and `put`
 * resolves only once its transaction has committed.
 */
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
      // A database that opens after the caller gave up has nobody to use it.
      if (settled) return request.result.close()
      settled = true
      resolve(request.result)
    }
  })

/** One request in its own transaction. It resolves on the transaction's `complete`, not on the request's `success`. */
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

/** The browser's IndexedDB behind `CompanyDb`, or null where the browser has none. */
const browserDb = (): CompanyDb | null => {
  let factory: IDBFactory | undefined
  try {
    factory = typeof indexedDB === 'undefined' ? undefined : indexedDB
  } catch {
    // Some private modes throw on the first touch.
  }
  if (!factory) return null
  const from = factory
  let opening: Promise<IDBDatabase> | null = null
  const database = (): Promise<IDBDatabase> => {
    if (opening !== null) return opening
    const attempt = openDatabase(from).then((opened) => {
      const forget = (): void => {
        if (opening === attempt) opening = null
      }
      // Another tab on a later build wants to upgrade: let it, and reopen on the next call.
      opened.onversionchange = () => {
        opened.close()
        forget()
      }
      opened.onclose = forget
      return opened
    })
    opening = attempt
    // A failed open is tried again on the next call, so one refusal does not last the session.
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

/** This browser's Company files, opened once. Null where IndexedDB is absent. */
export const companyDb = (): CompanyDb | null => {
  if (shared === undefined) shared = browserDb()
  return shared
}

/** The sim time a stored Company file was saved at, or null when the text carries none. */
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

/**
 * The copy to open when a Company has one in each place: the one saved at the later sim time, the
 * stamp every Company file already carries. The old key wins a tie, because it outlives a commit
 * only when the page closed on the write that put it there.
 */
export const newerSave = (kept: string | null, old: string | null): string | null => {
  if (kept === null || old === null) return kept ?? old
  const keptAt = savedTime(kept)
  if (keptAt === null) return old
  const oldAt = savedTime(old)
  return oldAt !== null && oldAt >= keptAt ? old : kept
}

/** One Company's file. `unread` says the database refused and no other copy answered: the file may still exist. */
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

/** The order writes began in, and per Company the last write and the last one that wrote the old key. */
let turns = 0
const lastWrite = new Map<string, number>()
const lastSafety = new Map<string, number>()

/**
 * Writes one Company's file and says whether it is stored. The database is tried first, and the
 * old key goes only after that write has committed. `closing` is the save of a tab that may not
 * come back: the old key is written first, in the same turn, because a page that closes does not
 * wait for a database. A database that is absent or refuses leaves the file under the old key.
 */
export const writeCompany = async (
  db: CompanyDb | null,
  id: string,
  json: string,
  closing = false,
): Promise<boolean> => {
  const key = saveKeyOf(id)
  const turn = (turns += 1)
  lastWrite.set(id, turn)
  const safe = closing && writeStored(key, json)
  if (safe) lastSafety.set(id, turn)
  if (db !== null) {
    try {
      // Strict when this commit removes the other copy, so the only copy left is on disk.
      await db.put(id, json, safe || readStored(key) !== null ? 'strict' : 'relaxed')
      // A later closing save may have written the old key since: that copy is newer than this one.
      if ((lastSafety.get(id) ?? 0) <= turn) removeStored(key)
      return true
    } catch {
      // The database refused: the old key holds the file, as it did before the move.
    }
  }
  // A later save of this Company has begun: an older file must not land over it, and that save
  // answers for the Company.
  if (lastWrite.get(id) !== turn) return true
  const wrote = safe || writeStored(key, json)
  // The record the database still holds is older now. A read must not find it.
  if (wrote && db !== null) await db.remove(id).catch(() => undefined)
  return wrote
}

/** Removes one Company's file from both places. */
export const deleteCompany = async (db: CompanyDb | null, id: string): Promise<void> => {
  removeStored(saveKeyOf(id))
  if (db === null) return
  // A record that stays is one the list does not name: the next prune removes it.
  await db.remove(id).catch(() => undefined)
}

/**
 * Removes the Company files the list does not name, from both places. A Company written since the
 * page loaded is left alone: the list this prune read is older than that Company.
 */
export const pruneCompanies = async (db: CompanyDb | null, index: SaveIndex): Promise<void> => {
  pruneCompanyFiles(index)
  if (db === null) return
  const keep = new Set(index.companies.map((file) => file.id))
  try {
    for (const id of await db.keys()) if (!keep.has(id) && !lastWrite.has(id)) await db.remove(id)
  } catch {
    // A database that refuses holds nothing this build can remove.
  }
}
