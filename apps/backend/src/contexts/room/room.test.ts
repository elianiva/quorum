import { Result } from 'effect'
import { serialize } from 'node:v8'
import { describe, expect, test } from 'vitest'
import { ERAS } from '@quorum/simulation/catalog'
import { newGame } from '@quorum/simulation/company'
import { intent } from '@quorum/simulation/room'
import { sandboxOf } from '@quorum/simulation/sandbox'
import {
  advance,
  ALARM_MS,
  apply,
  ballot,
  enter,
  finalOf,
  join,
  leave,
  MAX_CATCH_UP_STEPS,
  MAX_LINKS,
  MAX_NODES,
  STORAGE_VALUE_BYTES,
  openRoom,
  restoreRoom,
  startVote,
  storedRoom,
  writesOf,
  GAME_KEY,
  REST_KEY,
  ROOM_KEYS,
  SAMPLES_KEY,
  WHOLE_KEY,
  type RoomState,
} from './room.ts'
import type { Game } from '@quorum/simulation/state'

const game = newGame()
const node = game.nodes[0]!

const open = (): RoomState =>
  openRoom({
    name: 'Acme',
    game,
    samples: [],
    token: 'secret',
    simVersion: 'test',
    wall: 0,
  })

const withSeats = (): Readonly<{ state: RoomState; owner: string; guest: string }> => {
  const room = open()
  const owner = join(room, { id: 'tab-1', name: 'Owner', token: 'secret' }, 0)
  if (Result.isFailure(owner)) throw new Error('owner did not join')
  const guest = join(owner.success.state, { id: 'tab-2', name: 'Ada' }, 0)
  if (Result.isFailure(guest)) throw new Error('guest did not join')
  return { state: guest.success.state, owner: owner.success.seat.id, guest: guest.success.seat.id }
}

describe('restore', () => {
  test('a Room from another build is dropped', () => {
    expect(restoreRoom(open(), 'another-build')).toBeNull()
  })

  test('a Game missing a field added since the Room opened gets its default', () => {
    const room = open()
    const old = { ...room.game } as unknown as Record<string, unknown>
    delete old['training']
    const restored = restoreRoom({ ...room, game: old as unknown as Game }, 'test')
    expect(restored?.game.training).toEqual([])
  })
})

describe('storage', () => {
  test('a Game at the Room limits fits in one storage value', () => {
    const size = (value: unknown): number => serialize(value).byteLength
    const widest = <Item>(items: ReadonlyArray<Item>): Item =>
      items.reduce((best, item) => (size(item) > size(best) ? item : best))
    const full: Game = {
      ...game,
      nodes: Array.from({ length: MAX_NODES }, (_, index) => ({
        ...widest(game.nodes),
        id: `node-${index}`,
      })),
      links: Array.from({ length: MAX_LINKS }, (_, index) => ({
        ...widest(game.links),
        from: `node-${index % MAX_NODES}`,
        to: `node-${(index + 1) % MAX_NODES}`,
      })),
    }
    expect(size(full)).toBeLessThan(STORAGE_VALUE_BYTES * 0.8)
  })

  const storage = () => {
    const held = new Map<string, unknown>()
    const puts: Array<ReadonlyArray<string>> = []
    return {
      held,
      puts,
      save: (next: RoomState, previous: RoomState | null) => {
        const writes = writesOf(next, previous)
        puts.push(Object.keys(writes))
        for (const [key, value] of Object.entries(writes)) held.set(key, structuredClone(value))
      },
      load: () =>
        storedRoom(
          new Map(ROOM_KEYS.flatMap((key) => (held.has(key) ? [[key, held.get(key)]] : []))),
        ),
    }
  }

  test('a saved Room loads as it was', () => {
    const store = storage()
    const { state } = withSeats()
    store.save(state, null)
    expect(store.puts).toEqual([[REST_KEY, GAME_KEY, SAMPLES_KEY]])
    expect(store.load()).toEqual({ state, whole: false })
    expect(restoreRoom(store.load()!.state, 'test')).toEqual(state)
  })

  test('empty storage holds no Room', () => {
    expect(storage().load()).toBeNull()
  })

  test('a vote and a Seat do not rewrite the Game or the samples', () => {
    const store = storage()
    const { state, guest } = withSeats()
    store.save(state, null)
    const voting = startVote(state, guest, 'exit')
    if (Result.isFailure(voting)) throw new Error('the vote did not start')
    store.save(voting.success, state)
    const left = leave(voting.success, guest, 10)
    store.save(left, voting.success)
    store.save(left, left)
    expect(store.puts.slice(1)).toEqual([[REST_KEY], [REST_KEY], []])
    expect(store.load()?.state).toEqual(left)
  })

  test('an accepted Intent rewrites the Game, and a Step the samples it added', () => {
    const store = storage()
    const room = open()
    store.save(room, null)
    const moved = apply(room, [intent('move', node.id, 4, 5)])
    if (Result.isFailure(moved)) throw new Error('the move did not apply')
    store.save(moved.success, room)
    expect(store.puts[1]).toEqual([REST_KEY, GAME_KEY])
    const stepped = advance(moved.success, 60_000).state
    store.save(stepped, moved.success)
    expect(store.puts[2]).toContain(GAME_KEY)
    expect(store.puts[2]!.includes(SAMPLES_KEY)).toBe(stepped.samples !== moved.success.samples)
    expect(store.load()?.state).toEqual(stepped)
  })

  test('a Room stored as one value is read, and its first save writes every part', () => {
    const store = storage()
    const { state } = withSeats()
    store.held.set(WHOLE_KEY, structuredClone(state))
    const loaded = store.load()
    expect(loaded).toEqual({ state, whole: true })
    store.save(loaded!.state, null)
    store.held.delete(WHOLE_KEY)
    expect(store.puts).toEqual([[REST_KEY, GAME_KEY, SAMPLES_KEY]])
    expect(store.load()).toEqual({ state, whole: false })
  })

  test('the three values win over a one-value Room left beside them', () => {
    const store = storage()
    const { state } = withSeats()
    store.held.set(WHOLE_KEY, structuredClone(open()))
    store.save(state, null)
    expect(store.load()).toEqual({ state, whole: false })
  })
})

describe('seats', () => {
  test('the token claims the owner seat', () => {
    const room = open()
    const joined = join(room, { id: 'tab-1', name: 'Owner', token: 'secret' }, 0)
    expect(Result.isSuccess(joined)).toBe(true)
    if (Result.isSuccess(joined)) {
      expect(joined.success.seat.owner).toBe(true)
      expect(joined.success.state.ownerSeat).toBe('tab-1')
      expect(joined.success.state.idleAt).toBeNull()
    }
  })

  test('a guest takes a seat and a colour', () => {
    const { state, guest } = withSeats()
    const seat = state.seats.find((entry) => entry.id === guest)
    expect(seat?.owner).toBe(false)
    expect(new Set(state.seats.map((entry) => entry.colour)).size).toBe(2)
  })

  test('a seat the Room already holds is not new', () => {
    const { state } = withSeats()
    const late = join(state, { id: 'tab-3', name: 'Grace' }, 0)
    expect(late._tag).toBe('Success')
    if (late._tag !== 'Success') return
    expect(late.success.newSeat).toBe(true)

    const again = join(late.success.state, { id: 'tab-3', name: 'Grace Hopper' }, 0)
    expect(again._tag).toBe('Success')
    if (again._tag === 'Success') expect(again.success.newSeat).toBe(false)
  })

  test('a Room holds 20 seats and refuses the 21st', () => {
    let room = withSeats().state
    for (let index = room.seats.length; index < 20; index += 1) {
      const joined = join(room, { id: `g${index}`, name: `g${index}` }, 0)
      expect(Result.isSuccess(joined)).toBe(true)
      if (Result.isSuccess(joined)) room = joined.success.state
    }
    expect(room.seats).toHaveLength(20)
    expect(Result.isFailure(join(room, { id: 'late', name: 'Late' }, 0))).toBe(true)
  })

  test('a reload takes its seat back', () => {
    const { state, guest } = withSeats()
    const again = join(state, { id: guest, name: 'Ada Lovelace' }, 0)
    expect(again._tag).toBe('Success')
    if (again._tag === 'Success') {
      expect(again.success.newSeat).toBe(false)
      expect(again.success.state.seats.length).toBe(2)
      expect(again.success.state.seats.find((entry) => entry.id === guest)?.name).toBe(
        'Ada Lovelace',
      )
    }
  })

  test('a connection that claims a second Seat leaves its first', () => {
    const { state, owner, guest } = withSeats()
    const again = enter(state, guest, { id: 'tab-3', name: 'Ada' }, 0)
    if (Result.isFailure(again)) throw new Error('the second claim failed')
    expect(again.success.state.seats.map((seat) => seat.id)).toEqual([owner, 'tab-3'])
  })

  test('a connection that claims its own Seat again keeps it', () => {
    const { state, owner, guest } = withSeats()
    const again = enter(state, guest, { id: 'tab-2', name: 'Ada' }, 0)
    if (Result.isFailure(again)) throw new Error('the second claim failed')
    expect(again.success.state.seats.map((seat) => seat.id)).toEqual([owner, guest])
  })

  test('leaving empties the Room and dates it', () => {
    const { state, owner, guest } = withSeats()
    const one = leave(state, guest, 10)
    expect(one.seats.length).toBe(1)
    expect(one.idleAt).toBeNull()
    const none = leave(one, owner, 20)
    expect(none.seats.length).toBe(0)
    expect(none.idleAt).toBe(20)
  })
})

describe('the clock', () => {
  test('a wall second is ten Steps', () => {
    const room = open()
    const { state, steps } = advance(room, 1_000)
    expect(steps).toBe(10)
    expect(state.game.time).toBeCloseTo(room.game.time + 1, 6)
  })

  test('a sim second adds one sample and leaves the Game lean', () => {
    const room = open()
    const { state } = advance(room, 4_000)
    expect(state.samples.length).toBeGreaterThan(0)
    expect(state.game.history).toEqual([])
  })

  test('a paused Room does not step', () => {
    const room = { ...open(), open: false }
    expect(advance(room, 10_000).steps).toBe(0)
  })

  test('an hour away runs one wake of Steps, not an hour', () => {
    const { state } = withSeats()
    const { state: next, steps } = advance(state, 60 * 60 * 1_000)
    expect(steps).toBe(MAX_CATCH_UP_STEPS)
    expect(next.game.time - state.game.time).toBeCloseTo(MAX_CATCH_UP_STEPS * 0.1, 6)
  })

  test('the Steps a wake drops do not come back on the next one', () => {
    const { state } = withSeats()
    const long = advance(state, 60 * 60 * 1_000)
    const next = advance(long.state, 60 * 60 * 1_000 + ALARM_MS)
    expect(next.steps).toBe(ALARM_MS / 100)
  })

  test('the time a Room spent empty is not owed', () => {
    const { state, owner, guest } = withSeats()
    const empty = leave(leave(state, guest, 10), owner, 20)
    expect(empty.owe).toBe(0)
    const back = join(empty, { id: 'tab-9', name: 'Back' }, 3_600_000)
    if (Result.isFailure(back)) throw new Error('seat did not join')
    const { steps } = advance(back.success.state, 3_600_000)
    expect(steps).toBe(0)
  })
})

describe('intents', () => {
  test('an accepted intent bumps the revision and keeps history out', () => {
    const room = open()
    const applied = apply(room, [intent('move', node.id, 4, 5)])
    expect(applied._tag).toBe('Success')
    if (applied._tag === 'Success') {
      expect(applied.success.revision).toBe(room.revision + 1)
      expect(applied.success.game.history).toEqual([])
    }
  })

  test('a refusal changes nothing', () => {
    const room = open()
    const applied = apply(room, [intent('sell', 'nope')])
    expect(applied._tag).toBe('Failure')
  })

  test("a Sandbox places for free, but not past the Room's Node limit", () => {
    const free = sandboxOf(game)
    const filled = (count: number): RoomState => ({
      ...open(),
      game: {
        ...free,
        nodes: Array.from({ length: count }, (_, index) => ({ ...node, id: `f${index}` })),
        links: [],
      },
    })
    const below = apply(filled(MAX_NODES - 1), [intent('place', 'server', 1, 1)])
    expect(below._tag).toBe('Success')
    if (below._tag === 'Success') expect(below.success.game.cash).toBe(free.cash)
    const full = filled(MAX_NODES)
    const over = apply(full, [intent('place', 'server', 1, 1)])
    expect(over._tag).toBe('Failure')
    expect(apply(full, [intent('move', 'f0', 4, 5)])._tag).toBe('Success')
  })

  test("a Link past the Room's Link limit is refused", () => {
    const free = sandboxOf(game)
    const link = free.links[0]!
    const filled = (count: number): RoomState => ({
      ...open(),
      game: {
        ...free,
        links: [
          ...free.links,
          ...Array.from({ length: count - free.links.length }, (_, index) => ({
            ...link,
            from: `a${index}`,
            to: `b${index}`,
          })),
        ],
      },
    })
    const batch = [
      intent('place', 'database', 1, 1),
      intent('connect', 'server', `n${free.nextId}`),
    ]
    expect(apply(filled(MAX_LINKS - 1), batch)._tag).toBe('Success')
    expect(apply(filled(MAX_LINKS), batch)._tag).toBe('Failure')
  })
})

describe('votes', () => {
  test('a vote passes when more than half the seats agree', () => {
    const { state, owner, guest } = withSeats()
    const started = startVote(state, owner, 'exit')
    expect(Result.isSuccess(started)).toBe(true)
    if (Result.isFailure(started)) return
    const one = ballot(started.success, guest, true)
    expect(one.passed).toBe('exit')
    expect(one.state.ended).toBe('handover')
  })

  test('a seat that leaves drops its ballot', () => {
    const { state, owner, guest } = withSeats()
    const started = startVote(state, owner, 'exit')
    if (Result.isFailure(started)) throw new Error('no vote')
    const voted = ballot(started.success, owner, true)
    expect(voted.state.vote?.yes).toContain(owner)
    const left = leave(voted.state, guest, 1)
    expect(left.vote?.yes).toContain(owner)
    const after = ballot(left, owner, true)
    expect(after.passed).toBe('exit')
  })

  test('a round is declined only when the vote to decline passes', () => {
    const { state, owner, guest } = withSeats()
    const offered: RoomState = {
      ...state,
      game: { ...game, users: ERAS[0]!.raiseAt, round: { _tag: 'Offered' } },
    }
    const started = startVote(offered, owner, 'decline')
    if (Result.isFailure(started)) throw new Error('no vote')
    expect(started.success.game.round._tag).toBe('Offered')
    const passed = ballot(started.success, guest, true)
    expect(passed.passed).toBe('decline')
    expect(passed.state.game.round._tag).toBe('Declined')
    expect(passed.state.game.stage).toBe(1)
    expect(passed.state.game.cash).toBe(offered.game.cash)
    expect(passed.state.game.equity).toBe(offered.game.equity)
  })

  test('one vote is open at a time', () => {
    const { state, owner } = withSeats()
    const started = startVote(state, owner, 'exit')
    if (Result.isFailure(started)) throw new Error('no vote')
    expect(startVote(started.success, owner, 'fund')._tag).toBe('Failure')
  })
})

describe('the handover', () => {
  test('the owner gets the samples back inside the Game', () => {
    const room = open()
    const { state } = advance(room, 4_000)
    const final = finalOf(state)
    expect(final.game.history).toEqual([...state.samples])
  })

  test('the owner can take a Company back after the vote', () => {
    const { state, owner, guest } = withSeats()
    const started = startVote(state, owner, 'exit')
    if (Result.isFailure(started)) throw new Error('no vote')
    const passed = ballot(started.success, guest, true)
    expect(passed.passed).toBe('exit')
    if (passed.state.ended === null) throw new Error('not ended')
    expect(Result.isSuccess(apply(passed.state, [intent('move', node.id, 1, 1)]))).toBe(false)
    expect(finalOf(passed.state).game.history.length).toBe(passed.state.samples.length)
  })
})
