import * as Effect from 'effect/Effect'
import {
  RoomDirectory,
  RoomError,
  RoomFull,
  type Published,
  type RoomStub,
} from '../contexts/room/directory.ts'
import { MAX_ROOMS } from '../contexts/room/room.ts'
import type { SqlRunner } from './sql.ts'

/** Room codes: no 0, O, 1, or I, so a code can be read aloud. */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const CODE_LENGTH = 6
const TRIES = 6

const text = (bytes: number): string => {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return [...buffer].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const code = (): string => {
  const buffer = new Uint8Array(CODE_LENGTH)
  crypto.getRandomValues(buffer)
  return [...buffer].map((byte) => ALPHABET[byte % ALPHABET.length]).join('')
}

/**
 * Takes one of the cap's slots for `code`. The insert and the count are one statement, so two
 * publishes cannot both take the last slot. Rows outlive their Room, so a full table is checked
 * against the Rooms themselves once before the answer is no: a Room that is gone, or that holds
 * nobody, gives its slot up.
 */
const reserve = async (
  code: string,
  stubOf: (code: string) => RoomStub,
  db: SqlRunner,
): Promise<boolean> => {
  const claim = async (): Promise<boolean> => {
    const rows = await db
      .prepare(
        `INSERT INTO live_rooms (code, created_at) SELECT ?, ?
          WHERE (SELECT COUNT(*) FROM live_rooms) < ? ON CONFLICT (code) DO NOTHING RETURNING code`,
      )
      .bind(code, Date.now(), MAX_ROOMS)
      .all()
    return rows.results.length > 0
  }
  if (await claim()) return true
  const held = await db.prepare(`SELECT code FROM live_rooms`).all<{ code: string }>()
  const gone = await Promise.all(
    held.results.map(async (row) => {
      const info = await stubOf(row.code).info()
      return info.exists && !info.idle ? null : row.code
    }),
  )
  for (const dead of gone)
    if (dead !== null) await db.prepare(`DELETE FROM live_rooms WHERE code = ?`).bind(dead).all()
  return claim()
}

/**
 * Whether a Room that already exists may take a connection. It holds a slot already, or takes one
 * if the cap has room: an empty Room gave its slot up, so its owner coming back has to claim one.
 */
export const admit = async (
  code: string,
  stubOf: (code: string) => RoomStub,
  db: SqlRunner,
): Promise<boolean> => {
  if (!(await stubOf(code).info()).exists) return true
  const held = await db.prepare(`SELECT code FROM live_rooms WHERE code = ?`).bind(code).all()
  return held.results.length > 0 || reserve(code, stubOf, db)
}

/**
 * The Room namespace as the context sees it. One Room per code, and the code
 * is the object's name. `db` keeps the count of live Rooms against `MAX_ROOMS`.
 */
export const roomDirectory = (
  stubOf: (code: string) => RoomStub,
  db: SqlRunner,
): RoomDirectory['Service'] => ({
  publish: (request) =>
    Effect.gen(function* () {
      const token = text(24)
      for (let attempt = 0; attempt < TRIES; attempt += 1) {
        const candidate = code()
        const taken = yield* Effect.tryPromise({
          try: () => stubOf(candidate).info(),
          catch: (cause) => new RoomError({ cause }),
        })
        if (taken.exists) continue
        const reserved = yield* Effect.tryPromise({
          try: () => reserve(candidate, stubOf, db),
          catch: (cause) => new RoomError({ cause }),
        })
        if (!reserved) return yield* new RoomFull({ max: MAX_ROOMS })
        yield* Effect.tryPromise({
          try: () => stubOf(candidate).publish({ ...request, token }),
          catch: (cause) => new RoomError({ cause }),
        }).pipe(
          Effect.tapError(() =>
            Effect.promise(() =>
              db.prepare(`DELETE FROM live_rooms WHERE code = ?`).bind(candidate).all(),
            ),
          ),
        )
        return { code: candidate, token } satisfies Published
      }
      return yield* new RoomError({ cause: 'No room code was free.' })
    }),
  info: (candidate) =>
    Effect.tryPromise({
      try: () => stubOf(candidate).info(),
      catch: (cause) => new RoomError({ cause }),
    }),
})
