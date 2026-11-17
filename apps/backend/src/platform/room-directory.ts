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

export const admit = async (
  code: string,
  stubOf: (code: string) => RoomStub,
  db: SqlRunner,
): Promise<boolean> => {
  if (!(await stubOf(code).info()).exists) return true
  const held = await db.prepare(`SELECT code FROM live_rooms WHERE code = ?`).bind(code).all()
  return held.results.length > 0 || reserve(code, stubOf, db)
}

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
