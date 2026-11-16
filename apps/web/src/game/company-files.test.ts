import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { Effect } from 'effect'
import { preseedGame } from '@quorum/simulation/company'
import { LoadCompany } from './commands.ts'
import {
  deleteCompany,
  newerSave,
  pruneCompanies,
  readCompany,
  writeCompany,
  type CompanyDb,
  type Durability,
} from './company-files.ts'
import { Message } from './message.ts'
import { SAVE_FORMAT } from './save-file.ts'
import { fileFor, type SaveIndex } from './saves.ts'
import { SAVE_PREFIX } from './storage.ts'
import { TICK_MS, initialModel, update } from './update.ts'

/** A Company file's text, saved at one sim time. */
const fileAt = (time: number, note = ''): string =>
  JSON.stringify({ format: SAVE_FORMAT, time, note })

const keyOf = (id: string): string => `${SAVE_PREFIX}${id}`

/** `window.localStorage` as a map. `full` makes every write throw, as a browser over quota does. */
const local = { map: new Map<string, string>(), full: false }

const scope = globalThis as unknown as { window: unknown }
let priorWindow: unknown

beforeEach(() => {
  local.map = new Map()
  local.full = false
  priorWindow = scope.window
  scope.window = {
    localStorage: {
      getItem: (key: string) => local.map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (local.full) throw new Error('QuotaExceededError')
        local.map.set(key, value)
      },
      removeItem: (key: string) => void local.map.delete(key),
      key: (index: number) => [...local.map.keys()][index] ?? null,
      get length() {
        return local.map.size
      },
    },
  }
})

afterEach(() => {
  scope.window = priorWindow
})

/**
 * The Company database in memory. A `put` commits when its promise resolves, as the real one
 * resolves on the transaction's `complete`. `refuse` makes a call reject; `hold` keeps every `put`
 * uncommitted until `commit` runs.
 */
const memoryDb = (seed: Record<string, string> = {}) => {
  const records = new Map(Object.entries(seed))
  const refuse = { get: false, put: false, remove: false }
  const puts: Array<{ id: string; durability: Durability; oldKeyAtCommit: string | null }> = []
  const held: Array<() => void> = []
  const state = { hold: false }
  const db: CompanyDb = {
    get: async (id) => {
      if (refuse.get) throw new Error('refused')
      return records.get(id) ?? null
    },
    put: async (id, json, durability) => {
      if (state.hold) await new Promise<void>((resolve) => held.push(resolve))
      if (refuse.put) throw new Error('refused')
      puts.push({ id, durability, oldKeyAtCommit: local.map.get(keyOf(id)) ?? null })
      records.set(id, json)
    },
    remove: async (id) => {
      if (refuse.remove) throw new Error('refused')
      records.delete(id)
    },
    keys: async () => [...records.keys()],
  }
  /** Commits the oldest held `put` and lets its caller run on. */
  const commit = async (): Promise<void> => {
    held.shift()?.()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return { db, records, refuse, puts, state, commit }
}

const indexOf = (...ids: ReadonlyArray<string>): SaveIndex => {
  const game = preseedGame()
  return {
    current: ids[0] ?? null,
    companies: ids.map((id) =>
      fileFor({ id, name: id, logo: 'signal', founding: game.founding, game, now: 1 }),
    ),
  }
}

describe('a Company file in the database', () => {
  test('a written Company is read back from the database, and the old key stays empty', async () => {
    const { db, records } = memoryDb()
    expect(await writeCompany(db, 'c-a', fileAt(10))).toBe(true)
    expect(records.get('c-a')).toBe(fileAt(10))
    expect(local.map.has(keyOf('c-a'))).toBe(false)
    expect(await readCompany(db, 'c-a')).toEqual({ json: fileAt(10), unread: false })
  })

  test('an autosave with no copy to remove does not wait for the disk', async () => {
    const { db, puts } = memoryDb()
    await writeCompany(db, 'c-b', fileAt(10))
    expect(puts.map((put) => put.durability)).toEqual(['relaxed'])
  })
})

describe('the move from the old key', () => {
  test('a Company that is only under the old key is read, and reading does not move it', async () => {
    const { db, records } = memoryDb()
    local.map.set(keyOf('c-c'), fileAt(10))
    expect(await readCompany(db, 'c-c')).toEqual({ json: fileAt(10), unread: false })
    expect(local.map.get(keyOf('c-c'))).toBe(fileAt(10))
    expect(records.has('c-c')).toBe(false)
  })

  test('the next save puts it in the database, and only then removes the old key', async () => {
    const { db, records, puts } = memoryDb()
    local.map.set(keyOf('c-d'), fileAt(10))
    expect(await writeCompany(db, 'c-d', fileAt(15))).toBe(true)
    expect(records.get('c-d')).toBe(fileAt(15))
    expect(local.map.has(keyOf('c-d'))).toBe(false)
    // The old copy was still there when the write committed, and that write went to disk first.
    expect(puts).toEqual([{ id: 'c-d', durability: 'strict', oldKeyAtCommit: fileAt(10) }])
  })

  test('the old key is not removed while the database write has not committed', async () => {
    const { db, state, commit } = memoryDb()
    local.map.set(keyOf('c-e'), fileAt(10))
    state.hold = true
    const writing = writeCompany(db, 'c-e', fileAt(15))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(local.map.get(keyOf('c-e'))).toBe(fileAt(10))
    await commit()
    expect(await writing).toBe(true)
    expect(local.map.has(keyOf('c-e'))).toBe(false)
  })

  test('a database write that fails leaves the Company under the old key, saved', async () => {
    const { db, records, refuse } = memoryDb({ 'c-f': fileAt(5) })
    local.map.set(keyOf('c-f'), fileAt(10))
    refuse.put = true
    expect(await writeCompany(db, 'c-f', fileAt(15))).toBe(true)
    expect(local.map.get(keyOf('c-f'))).toBe(fileAt(15))
    // The record the failed write could not replace is older, so it must not answer a read.
    expect(records.has('c-f')).toBe(false)
    expect(await readCompany(db, 'c-f')).toEqual({ json: fileAt(15), unread: false })
  })

  test('when both places refuse, the save fails and the old copy is still there', async () => {
    const { db, refuse } = memoryDb()
    local.map.set(keyOf('c-g'), fileAt(10))
    refuse.put = true
    local.full = true
    expect(await writeCompany(db, 'c-g', fileAt(15))).toBe(false)
    expect(local.map.get(keyOf('c-g'))).toBe(fileAt(10))
  })
})

describe('a Company with a copy in each place', () => {
  test('the copy saved at the later sim time opens, whichever place holds it', async () => {
    const newerOld = memoryDb({ 'c-h': fileAt(10, 'database') })
    local.map.set(keyOf('c-h'), fileAt(12, 'old key'))
    expect((await readCompany(newerOld.db, 'c-h')).json).toBe(fileAt(12, 'old key'))

    const newerDb = memoryDb({ 'c-i': fileAt(20, 'database') })
    local.map.set(keyOf('c-i'), fileAt(12, 'old key'))
    expect((await readCompany(newerDb.db, 'c-i')).json).toBe(fileAt(20, 'database'))
  })

  test('a copy with no sim time loses to one that has it', () => {
    expect(newerSave('{broken', fileAt(1))).toBe(fileAt(1))
    expect(newerSave(fileAt(1), '{broken')).toBe(fileAt(1))
    expect(newerSave(null, fileAt(1))).toBe(fileAt(1))
    expect(newerSave(fileAt(1), null)).toBe(fileAt(1))
    expect(newerSave(null, null)).toBeNull()
  })
})

describe('the save of a tab that may not come back', () => {
  test('it is under the old key before the database commits, and leaves it after', async () => {
    const { db, records, state, commit, puts } = memoryDb({ 'c-j': fileAt(10) })
    state.hold = true
    const writing = writeCompany(db, 'c-j', fileAt(15), true)
    // Nothing was awaited: a page that closes here has the file.
    expect(local.map.get(keyOf('c-j'))).toBe(fileAt(15))
    // The page closed before the commit: the next load opens the newer copy.
    expect((await readCompany(db, 'c-j')).json).toBe(fileAt(15))
    await commit()
    expect(await writing).toBe(true)
    expect(records.get('c-j')).toBe(fileAt(15))
    expect(local.map.has(keyOf('c-j'))).toBe(false)
    expect(puts[0]?.durability).toBe('strict')
  })

  test('an earlier autosave that commits late does not remove the newer copy', async () => {
    const { db, records, state, commit } = memoryDb()
    state.hold = true
    const autosave = writeCompany(db, 'c-k', fileAt(10))
    const closing = writeCompany(db, 'c-k', fileAt(15), true)
    await commit()
    expect(await autosave).toBe(true)
    expect(local.map.get(keyOf('c-k'))).toBe(fileAt(15))
    await commit()
    expect(await closing).toBe(true)
    expect(records.get('c-k')).toBe(fileAt(15))
    expect(local.map.has(keyOf('c-k'))).toBe(false)
  })

  test('an earlier autosave that fails late does not land over the newer copy', async () => {
    const { db, refuse, state, commit } = memoryDb()
    state.hold = true
    refuse.put = true
    const autosave = writeCompany(db, 'c-l', fileAt(10))
    const closing = writeCompany(db, 'c-l', fileAt(15), true)
    await commit()
    await commit()
    expect(await autosave).toBe(true)
    expect(await closing).toBe(true)
    expect(local.map.get(keyOf('c-l'))).toBe(fileAt(15))
  })

  test('a hidden tab asks for that save, and the autosave does not', () => {
    const founded = update(initialModel(), Message.CompanyFounded()).model
    const tick = (model: typeof founded) =>
      update(model, Message.Ticked({ elapsedMs: TICK_MS })).model
    const blurred = update(tick(tick(founded)), Message.WindowBlurred())
    expect(blurred.commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'WriteCompany',
          args: expect.objectContaining({ closing: true }),
        }),
      ]),
    )
    let model = founded
    let autosave: unknown = null
    for (let at = 0; at < 40 && autosave === null; at += 1) {
      const result = update(model, Message.Ticked({ elapsedMs: TICK_MS }))
      model = result.model
      autosave = (result.commands ?? []).find((command) => command.name === 'WriteCompany') ?? null
    }
    expect(autosave).toMatchObject({ name: 'WriteCompany' })
    expect(autosave).not.toMatchObject({ args: { closing: true } })
  })
})

describe('deleting and pruning', () => {
  test('deleting a Company removes both copies', async () => {
    const { db, records } = memoryDb({ 'c-m': fileAt(10), 'c-keep': fileAt(1) })
    local.map.set(keyOf('c-m'), fileAt(12))
    local.map.set(keyOf('c-keep'), fileAt(1))
    await deleteCompany(db, 'c-m')
    expect(records.has('c-m')).toBe(false)
    expect(local.map.has(keyOf('c-m'))).toBe(false)
    expect(records.has('c-keep')).toBe(true)
    expect(local.map.has(keyOf('c-keep'))).toBe(true)
  })

  test('pruning removes both copies of a Company the list does not name, and keeps the rest', async () => {
    const { db, records } = memoryDb({ 'c-n': fileAt(1), 'gone-db': fileAt(1) })
    local.map.set(keyOf('c-n'), fileAt(1))
    local.map.set(keyOf('gone-old'), fileAt(1))
    local.map.set('quorum.prefs.v1', '{}')
    await pruneCompanies(db, indexOf('c-n'))
    expect([...records.keys()]).toEqual(['c-n'])
    expect([...local.map.keys()].sort()).toEqual([keyOf('c-n'), 'quorum.prefs.v1'].sort())
  })

  test('pruning leaves a Company founded since the list was read', async () => {
    const { db, records } = memoryDb({ 'gone-late': fileAt(1) })
    await writeCompany(db, 'c-new', fileAt(1))
    await pruneCompanies(db, indexOf())
    expect([...records.keys()]).toEqual(['c-new'])
  })
})

describe('a browser without the database', () => {
  test('the Company is written, read, pruned, and deleted under the old key', async () => {
    expect(await writeCompany(null, 'c-o', fileAt(10))).toBe(true)
    expect(local.map.get(keyOf('c-o'))).toBe(fileAt(10))
    expect(await readCompany(null, 'c-o')).toEqual({ json: fileAt(10), unread: false })
    local.map.set(keyOf('gone'), fileAt(1))
    await pruneCompanies(null, indexOf('c-o'))
    expect([...local.map.keys()]).toEqual([keyOf('c-o')])
    await deleteCompany(null, 'c-o')
    expect(local.map.size).toBe(0)
  })

  test('a full browser fails the save, and a missing file reads as missing', async () => {
    local.full = true
    expect(await writeCompany(null, 'c-p', fileAt(10))).toBe(false)
    expect(await readCompany(null, 'c-p')).toEqual({ json: null, unread: false })
  })

  test('the load Command reads the old key where the test run has no IndexedDB', async () => {
    local.map.set(keyOf('c-q'), fileAt(10))
    expect(await Effect.runPromise(LoadCompany({ id: 'c-q', open: true }).effect)).toEqual(
      Message.CompanyLoaded({ id: 'c-q', open: true, json: fileAt(10) }),
    )
  })
})

describe('a database that will not read', () => {
  test('the old key answers when it has a copy; otherwise the file is unread, not missing', async () => {
    const { db, refuse } = memoryDb({ 'c-r': fileAt(10) })
    refuse.get = true
    expect(await readCompany(db, 'c-r')).toEqual({ json: null, unread: true })
    local.map.set(keyOf('c-r'), fileAt(8))
    expect(await readCompany(db, 'c-r')).toEqual({ json: fileAt(8), unread: false })
  })

  test('an unread Company keeps its row and its file', () => {
    const index = indexOf('c-s')
    const loaded = update(
      initialModel(),
      Message.SavesLoaded({ index: JSON.stringify(index), now: 0 }),
    )
    const unread = update(loaded.model, Message.CompanyUnread({ id: 'c-s', open: true }))
    expect(unread.model.saves.companies.map((file) => file.id)).toEqual(['c-s'])
    expect(unread.model.companyPhase).toEqual({ _tag: 'None' })
    expect(unread.model.toast?.tone).toBe('warn')
    expect((unread.commands ?? []).map((command) => command.name)).not.toContain('DeleteCompany')
  })
})
