import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { expect, test } from 'vitest'
import { newGame } from '@quorum/simulation/company'
import type { RoomStub } from '../contexts/room/directory.ts'
import { MAX_ROOMS } from '../contexts/room/room.ts'
import { admit, roomDirectory } from './room-directory.ts'
import { sqliteRunner } from './sqlite-runner.ts'

/** Rooms by code, as the Durable Object namespace holds them. */
const world = () => {
  const rooms = new Set<string>()
  const idle = new Set<string>()
  const stubOf = (code: string): RoomStub => ({
    info: () => Promise.resolve({ exists: rooms.has(code), seats: 0, idle: idle.has(code) }),
    publish: () => {
      rooms.add(code)
      return Promise.resolve()
    },
    fetch: () => Promise.resolve(new Response()),
  })
  return { rooms, idle, stubOf }
}

const request = { name: 'Quorum', game: newGame(), samples: [], wall: 1, simVersion: 'v' }

test('a deployment runs 20 Rooms, and a slot frees when a Room is gone', async () => {
  const { rooms, idle, stubOf } = world()
  const directory = roomDirectory(stubOf, sqliteRunner())
  const publish = () => Effect.runPromiseExit(directory.publish(request))

  for (let index = 0; index < MAX_ROOMS; index += 1)
    expect(Exit.isSuccess(await publish())).toBe(true)
  const refused = await publish()
  expect(Exit.isFailure(refused)).toBe(true)
  expect(JSON.stringify(refused)).toContain('RoomFull')
  expect(rooms.size).toBe(MAX_ROOMS)

  // One Room expires; the next publish finds its row stale and takes the slot.
  rooms.delete([...rooms][0]!)
  expect(Exit.isSuccess(await publish())).toBe(true)
  expect(rooms.size).toBe(MAX_ROOMS)
  expect(Exit.isFailure(await publish())).toBe(true)

  // The last player leaves a Room: it still exists, but its slot is free.
  idle.add([...rooms][0]!)
  expect(Exit.isSuccess(await publish())).toBe(true)
  expect(Exit.isFailure(await publish())).toBe(true)
})

test('a returning Room is refused when 20 other Rooms are active', async () => {
  const { rooms, idle, stubOf } = world()
  const db = sqliteRunner()
  const directory = roomDirectory(stubOf, db)
  for (let index = 0; index < MAX_ROOMS; index += 1)
    await Effect.runPromise(directory.publish(request))
  const sleeper = [...rooms][0]!
  idle.add(sleeper)
  await Effect.runPromise(directory.publish(request)) // takes the sleeper's slot
  expect(await admit(sleeper, stubOf, db)).toBe(false)
  // Another Room expires, so the sleeper's owner can come back.
  rooms.delete([...rooms].find((code) => code !== sleeper)!)
  expect(await admit(sleeper, stubOf, db)).toBe(true)
  expect(await admit('NOROOM', stubOf, db)).toBe(true)
})
