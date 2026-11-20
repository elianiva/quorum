import { Option, Result, Schema } from 'effect'
import { Refusal } from '@quorum/simulation/action-kit'
import * as Actions from '@quorum/simulation/actions'
import {
  applyIntents,
  ROOM_MAX_SAMPLES,
  ROOM_MAX_SEATS,
  votePasses,
  type Intent,
  type Seat,
  type Vote,
  type VoteKind,
} from '@quorum/simulation/room'
import { step } from '@quorum/simulation/step'
import { Game, type Sample } from '@quorum/simulation/state'
import { openVoteOf, RoomVote, RoomVoteEvent, voteStep } from '@quorum/simulation/vote-machine'
import {
  RoomLifecycle,
  RoomLifecycleEvent,
  step as stepLifecycle,
} from './room-lifecycle-machine.ts'

const STEP_SECONDS = 0.1
export const ALARM_MS = 500

export const MAX_CATCH_UP_STEPS = 60

const MAX_OWE_MS = MAX_CATCH_UP_STEPS * STEP_SECONDS * 1_000

export const ROOM_IDLE_MS = 24 * 60 * 60 * 1000

export const MAX_NODES = 800
export const MAX_LINKS = 3_200
export const STORAGE_VALUE_BYTES = 2 * 1024 * 1024

export const MAX_ROOMS = 20

const VOTE_SECONDS = 60

export type RoomState = Readonly<{
  name: string
  game: Game
  samples: ReadonlyArray<Sample>
  seats: ReadonlyArray<Seat>
  ownerSeat: string
  token: string
  speed: number
  revision: number
  vote: RoomVote
  voteSeq: number
  simVersion: string
  lifecycle: RoomLifecycle
  startedAt: number
  lastStepAt: number
  owe: number
}>

export type SeatFault = 'closed' | 'full' | 'stale' | 'missing' | 'not-owner' | 'vote-open'

export type Joining = Readonly<{ id: string; name: string; token?: string }>

const live: RoomLifecycle = RoomLifecycle.cases.Live.make({})

const idle = (since: number): RoomLifecycle => RoomLifecycle.cases.Idle.make({ since })

const ended: RoomLifecycle = RoomLifecycle.cases.Ended.make({ reason: 'handover' })

const noVote: RoomVote = RoomVote.cases.Idle.make({})

const closeVote = RoomVoteEvent.cases.Closed.make({})

const trim = (name: string): string => {
  const clean = name.trim().slice(0, 24)
  return clean.length > 0 ? clean : 'Guest'
}

const colourFor = (seats: ReadonlyArray<Seat>): number => {
  const used = new Set(seats.map((seat) => seat.colour))
  for (let index = 0; index < ROOM_MAX_SEATS; index += 1) if (!used.has(index)) return index
  return seats.length % ROOM_MAX_SEATS
}

export const openRoom = (input: {
  name: string
  game: Game
  samples: ReadonlyArray<Sample>
  token: string
  simVersion: string
  wall: number
}): RoomState => ({
  name: input.name,
  game: { ...input.game, history: [] },
  samples: input.samples.slice(-ROOM_MAX_SAMPLES),
  seats: [],
  ownerSeat: '',
  token: input.token,
  speed: 1,
  revision: 1,
  vote: noVote,
  voteSeq: 1,
  simVersion: input.simVersion,
  lifecycle: idle(input.wall),
  startedAt: input.wall,
  lastStepAt: input.wall,
  owe: 0,
})

const decodeGame = Schema.decodeUnknownOption(Game)

export const restoreRoom = (state: RoomState, version: string): RoomState | null => {
  if (state.simVersion !== version) return null
  const game = decodeGame(state.game)
  return Option.isSome(game) ? { ...state, game: game.value } : null
}

export const GAME_KEY = 'game'
export const SAMPLES_KEY = 'samples'
export const REST_KEY = 'rest'
export const WHOLE_KEY = 'room'
export const ROOM_KEYS = [REST_KEY, GAME_KEY, SAMPLES_KEY, WHOLE_KEY] as const

export const writesOf = (
  next: RoomState,
  previous: RoomState | null,
): Readonly<Record<string, unknown>> => {
  if (next === previous) return {}
  const { game, samples, ...rest } = next
  return {
    [REST_KEY]: rest,
    ...(game === previous?.game ? {} : { [GAME_KEY]: game }),
    ...(samples === previous?.samples ? {} : { [SAMPLES_KEY]: samples }),
  }
}

type StoredRoom = Readonly<{
  lifecycle?: RoomLifecycle
  open?: boolean
  ended?: 'handover' | null
  idleAt?: number | null
  vote?: RoomVote | Vote | null
}>

const lifecycleOfStored = (held: StoredRoom): RoomLifecycle => {
  if (held.lifecycle !== undefined) return held.lifecycle
  if (held.ended === 'handover') return ended
  return typeof held.idleAt === 'number' ? idle(held.idleAt) : live
}

const voteOfStored = (held: StoredRoom): RoomVote => {
  const vote = held.vote
  if (vote === undefined || vote === null) return noVote
  if ('_tag' in vote && (vote._tag === 'Idle' || vote._tag === 'Open')) return vote
  return RoomVote.cases.Open.make({ vote })
}

const withoutStoredFlags = <T extends StoredRoom>(
  held: T,
): Omit<T, 'lifecycle' | 'open' | 'ended' | 'idleAt' | 'vote'> => {
  const {
    lifecycle: _lifecycle,
    open: _open,
    ended: _ended,
    idleAt: _idleAt,
    vote: _vote,
    ...rest
  } = held
  return rest
}

export const storedRoom = (
  read: ReadonlyMap<string, unknown>,
): Readonly<{ state: RoomState; whole: boolean }> | null => {
  const rest = read.get(REST_KEY) as
    | (Omit<RoomState, 'game' | 'samples' | 'vote'> & StoredRoom)
    | undefined
  const game = read.get(GAME_KEY) as Game | undefined
  if (rest !== undefined && game !== undefined) {
    const samples = (read.get(SAMPLES_KEY) as ReadonlyArray<Sample> | undefined) ?? []
    return {
      state: {
        ...withoutStoredFlags(rest),
        lifecycle: lifecycleOfStored(rest),
        vote: voteOfStored(rest),
        game,
        samples,
      },
      whole: false,
    }
  }
  const whole = read.get(WHOLE_KEY) as (Omit<RoomState, 'vote'> & StoredRoom) | undefined
  return whole === undefined
    ? null
    : {
        state: {
          ...withoutStoredFlags(whole),
          lifecycle: lifecycleOfStored(whole),
          vote: voteOfStored(whole),
        },
        whole: true,
      }
}

export const expired = (state: RoomState, now: number): boolean =>
  (state.lifecycle._tag === 'Idle' || state.lifecycle._tag === 'Abandoned') &&
  now - state.lifecycle.since > ROOM_IDLE_MS

const sameSeat = (seat: Seat, id: string): boolean => seat.id === id

const watching = (state: RoomState, now: number): RoomState => ({
  ...state,
  lifecycle: stepLifecycle(state.lifecycle, RoomLifecycleEvent.cases.Joined.make({})),
  lastStepAt: now,
  owe: 0,
})

export const resting = (state: RoomState, now: number): RoomState => {
  if (state.lifecycle._tag === 'Ended') return state
  const lifecycle = stepLifecycle(
    state.lifecycle,
    state.seats.length === 0
      ? RoomLifecycleEvent.cases.Emptied.make({ at: now })
      : RoomLifecycleEvent.cases.Abandoned.make({ at: now }),
  )
  return lifecycle === state.lifecycle ? state : { ...state, lifecycle }
}

export const connected = (state: RoomState): ReadonlyArray<string> =>
  state.seats.map((seat) => seat.id)

export const join = (
  state: RoomState,
  entering: Joining,
  now: number,
): Result.Result<Readonly<{ state: RoomState; seat: Seat; newSeat: boolean }>, SeatFault> => {
  if (state.lifecycle._tag === 'Ended') return Result.fail('closed')
  if (expired(state, now)) return Result.fail('stale')

  const owner = entering.token !== undefined && entering.token === state.token
  if (owner) {
    const existing = state.seats.find((seat) => seat.owner)
    const seat: Seat = {
      id: existing?.id ?? (state.ownerSeat || entering.id),
      name: trim(entering.name),
      colour: existing?.colour ?? colourFor(state.seats),
      owner: true,
    }
    const seats = existing
      ? state.seats.map((entry) => (sameSeat(entry, seat.id) ? seat : entry))
      : [...state.seats, seat]
    return Result.succeed({
      state: watching({ ...state, seats, ownerSeat: seat.id }, now),
      seat,
      newSeat: existing === undefined,
    })
  }

  const existing = state.seats.find((seat) => seat.id === entering.id && !seat.owner)
  if (existing) {
    const seat: Seat = { ...existing, name: trim(entering.name) }
    return Result.succeed({
      state: watching(
        { ...state, seats: state.seats.map((entry) => (sameSeat(entry, seat.id) ? seat : entry)) },
        now,
      ),
      seat,
      newSeat: false,
    })
  }
  if (state.seats.length >= ROOM_MAX_SEATS) return Result.fail('full')
  const seat: Seat = {
    id: entering.id,
    name: trim(entering.name),
    colour: colourFor(state.seats),
    owner: false,
  }
  return Result.succeed({
    state: watching({ ...state, seats: [...state.seats, seat] }, now),
    seat,
    newSeat: true,
  })
}

export const enter = (
  state: RoomState,
  held: string,
  entering: Joining,
  now: number,
): ReturnType<typeof join> =>
  Result.map(join(state, entering, now), (joined) =>
    held === '' || held === joined.seat.id
      ? joined
      : { ...joined, state: leave(joined.state, held, now) },
  )

export const leave = (state: RoomState, id: string, now: number): RoomState => {
  const seats = state.seats.filter((seat) => !sameSeat(seat, id))
  if (seats.length === state.seats.length) return state
  const vote =
    seats.length === 0
      ? noVote
      : RoomVote.match(state.vote, {
          Idle: () => noVote,
          Open: ({ vote }) => {
            const dropped: Vote = {
              ...vote,
              yes: vote.yes.filter((entry) => entry !== id),
              no: vote.no.filter((entry) => entry !== id),
            }
            return voteStep(state.vote, RoomVoteEvent.cases.Balloted.make({ vote: dropped }))
          },
        })
  const lifecycle = stepLifecycle(
    state.lifecycle,
    seats.length === 0
      ? RoomLifecycleEvent.cases.Emptied.make({ at: now })
      : RoomLifecycleEvent.cases.Joined.make({}),
  )
  return {
    ...state,
    seats,
    vote,
    lifecycle,
    lastStepAt: seats.length === 0 ? now : state.lastStepAt,
    owe: seats.length === 0 ? 0 : state.owe,
  }
}

export const advance = (
  state: RoomState,
  now: number,
  wall: number = now,
): Readonly<{ state: RoomState; steps: number }> => {
  if (state.lifecycle._tag !== 'Live') return { state, steps: 0 }
  const owed = Math.min(MAX_OWE_MS, state.owe + Math.max(0, now - state.lastStepAt) * state.speed)
  const steps = Math.min(MAX_CATCH_UP_STEPS, Math.floor(owed / (STEP_SECONDS * 1_000)))
  const base: RoomState = {
    ...state,
    lastStepAt: wall,
    owe: owed - steps * (STEP_SECONDS * 1_000),
  }
  if (steps === 0) return { state: base, steps: 0 }

  let game = state.game
  let samples = state.samples
  for (let index = 0; index < steps; index += 1) {
    const result = step(game, STEP_SECONDS)
    game = result.game
    if (game.history.length > 0) {
      samples = [...samples, ...game.history].slice(-ROOM_MAX_SAMPLES)
      game = { ...game, history: [] }
    }
  }
  const vote =
    base.vote._tag === 'Open' && game.time >= base.vote.vote.closesAt
      ? voteStep(base.vote, closeVote)
      : base.vote
  return { state: { ...base, game, samples, vote }, steps }
}

export const apply = (
  state: RoomState,
  intents: ReadonlyArray<Intent>,
): Result.Result<RoomState, Refusal> => {
  if (state.lifecycle._tag !== 'Live')
    return Result.fail(Refusal.NotAllowed({ reason: 'The session has ended.' }))
  return Result.match(applyIntents(state.game, intents), {
    onFailure: (refusal) => Result.fail(refusal),
    onSuccess: (game) =>
      (game.nodes.length > MAX_NODES && game.nodes.length > state.game.nodes.length) ||
      (game.links.length > MAX_LINKS && game.links.length > state.game.links.length)
        ? Result.fail(Refusal.NotAllowed({ reason: 'An online Company cannot grow any larger.' }))
        : Result.succeed({
            ...state,
            game: { ...game, history: [] },
            revision: state.revision + 1,
          }),
  })
}

export const startVote = (
  state: RoomState,
  by: string,
  kind: VoteKind,
): Result.Result<RoomState, SeatFault> => {
  if (state.lifecycle._tag !== 'Live') return Result.fail('closed')
  if (state.vote._tag !== 'Idle') return Result.fail('vote-open')
  if (!state.seats.some((seat) => seat.id === by)) return Result.fail('missing')
  const vote: Vote = {
    id: state.voteSeq,
    kind,
    by,
    yes: [by],
    no: [],
    closesAt: state.game.time + VOTE_SECONDS,
  }
  return Result.succeed({
    ...state,
    vote: voteStep(state.vote, RoomVoteEvent.cases.Opened.make({ vote })),
    voteSeq: state.voteSeq + 1,
  })
}

export type BallotOutcome = Readonly<{
  state: RoomState
  passed: VoteKind | null
}>

export const ballot = (state: RoomState, seat: string, yes: boolean): BallotOutcome => {
  const vote = openVoteOf(state.vote)
  if (vote === null) return { state, passed: null }
  if (!state.seats.some((entry) => entry.id === seat)) return { state, passed: null }
  if (state.game.time >= vote.closesAt)
    return { state: { ...state, vote: voteStep(state.vote, closeVote) }, passed: null }

  const next: Vote = {
    ...vote,
    yes: [...vote.yes.filter((id) => id !== seat), ...(yes ? [seat] : [])],
    no: [...vote.no.filter((id) => id !== seat), ...(yes ? [] : [seat])],
  }
  if (!votePasses(next, connected(state)))
    return {
      state: {
        ...state,
        vote: voteStep(state.vote, RoomVoteEvent.cases.Balloted.make({ vote: next })),
      },
      passed: null,
    }

  if (next.kind === 'exit')
    return {
      state: {
        ...state,
        vote: voteStep(state.vote, closeVote),
        lifecycle: stepLifecycle(
          state.lifecycle,
          RoomLifecycleEvent.cases.Ended.make({ reason: 'handover' }),
        ),
      },
      passed: 'exit',
    }

  const answered = next.kind === 'fund' ? Actions.raise(state.game) : Actions.decline(state.game)
  if (Result.isFailure(answered))
    return { state: { ...state, vote: voteStep(state.vote, closeVote) }, passed: null }
  return {
    state: {
      ...state,
      game: { ...answered.success, history: [] },
      revision: state.revision + 1,
      vote: voteStep(state.vote, closeVote),
    },
    passed: next.kind,
  }
}

export const setSpeed = (state: RoomState, value: number): RoomState => ({
  ...state,
  speed: value,
})

export const kick = (state: RoomState, seat: string, now: number): RoomState =>
  state.seats.some((entry) => entry.id === seat && !entry.owner) ? leave(state, seat, now) : state

export const finalOf = (
  state: RoomState,
): Readonly<{ game: Game; samples: ReadonlyArray<Sample> }> => ({
  game: { ...state.game, history: [...state.samples] },
  samples: state.samples,
})

export const snapshotOf = (
  state: RoomState,
  from = 0,
): Readonly<{
  revision: number
  time: number
  game: Game
  samples: ReadonlyArray<Sample>
  seats: ReadonlyArray<Seat>
  owner: string
  speed: number
  vote: Vote | null
}> => ({
  revision: state.revision,
  time: state.game.time,
  game: state.game,
  samples: state.samples.slice(from),
  seats: state.seats,
  owner: state.ownerSeat,
  speed: state.speed,
  vote: openVoteOf(state.vote),
})
