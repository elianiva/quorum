import { Result, Schema } from 'effect'
import * as Actions from './actions.ts'
import { Refusal } from './action-kit.ts'
import { type ComponentId } from './catalog.ts'
import * as Mirrors from './mirror.ts'
import * as Runway from './runway.ts'
import { Game, RegionId, Sample } from './state.ts'
import * as Work from './work.ts'

export const ROOM_MAX_SEATS = 20

export const ROOM_SPEEDS = [0.5, 1, 3, 10] as const

export const ROOM_MAX_SAMPLES = 600

export const ROOM_MAX_INTENTS_PER_FRAME = 256

export const ROOM_MAX_TEXT_CHARS = 128

export const Seat = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  colour: Schema.Finite,
  owner: Schema.Boolean,
})
export type Seat = typeof Seat.Type

export const VoteKind = Schema.Literals(['fund', 'decline', 'exit'])
export type VoteKind = typeof VoteKind.Type

export const SeatActivity = Schema.Literals([
  'inspector',
  'research',
  'team',
  'dashboard',
  'playbooks',
  'help',
  'dev',
  'inbox',
  'cost',
  'churn',
  'mirror',
  'settings',
  'menu',
  'room',
  'exit',
  'challenge',
])
export type SeatActivity = typeof SeatActivity.Type

export const Vote = Schema.Struct({
  id: Schema.Finite,
  kind: VoteKind,
  by: Schema.String,
  yes: Schema.Array(Schema.String),
  no: Schema.Array(Schema.String),
  closesAt: Schema.Finite,
})
export type Vote = typeof Vote.Type

export const VOTE_ACTIONS = { fund: 'raise', decline: 'decline', exit: 'exit' } as const

export const votePasses = (vote: Vote, connected: ReadonlyArray<string>): boolean =>
  connected.length > 0 &&
  vote.yes.filter((id) => connected.includes(id)).length * 2 > connected.length

export const IntentNamespace = Schema.Literals(['actions', 'work', 'mirrors'])
export type IntentNamespace = typeof IntentNamespace.Type

export const Intent = Schema.Struct({
  ns: IntentNamespace,
  name: Schema.String,
  args: Schema.Array(Schema.Unknown),
})
export type Intent = typeof Intent.Type

type Rest<F> = F extends (game: Game, ...rest: infer A) => unknown ? A : never

const upgradeAll = (game: Game, type: ComponentId, region?: RegionId) =>
  Result.map(Actions.upgradeAll(game, type, region), (outcome) => outcome.game)

const seatMoves = <T extends object, Denied extends keyof T>(
  module: T,
  denied: ReadonlyArray<Denied>,
): Omit<T, Denied> =>
  Object.fromEntries(
    Object.entries(module).filter(
      ([name, value]) => typeof value === 'function' && !denied.includes(name as Denied),
    ),
  ) as Omit<T, Denied>

const NOT_A_MOVE = [
  'LINK_TIMEOUTS',
  'PHISH_CHURN_SHARE',
  'Refusal',
  'acknowledge',
  'blankNode',
  'canRaise',
  'decline',
  'describeRefusal',
  'offer',
  'raise',
  'restartable',
  'rollRestore',
  'shortOfCash',
  'upgradeAll',
] as const

const NOT_A_RUNWAY_MOVE = [
  'BRIDGE_OFFER_AT_BURN_DAYS',
  'BRIDGE_GRANT_BURN_DAYS',
  'BRIDGE_DILUTION',
  'RUNWAY_MONTH',
  'SHUTDOWN_AT_BURN_DAYS',
  'advanceRunway',
  'runwayOf',
] as const

const PLAYER_ACTIONS = {
  ...seatMoves(Actions, NOT_A_MOVE),
  ...seatMoves(Runway, NOT_A_RUNWAY_MOVE),
  upgradeAll,
}

const NOT_WORK = [
  'MAX_TEAMS',
  'PLATFORM_STAGE',
  'advanceMorale',
  'advanceTeam',
  'assignments',
  'blockReason',
  'blockRemind',
  'capabilityFeatures',
  'capabilityKloc',
  'engineCost',
  'featureHoursOf',
  'featureServiceOf',
  'featureRefusal',
  'itemName',
  'itemVelocityOf',
  'loadBalancersOf',
  'nextFeature',
  'nodesOfService',
  'removeRefusal',
  'runbookKinds',
  'runbookRefusal',
  'rushBugOf',
  'rushDebtOf',
  'serviceOfItem',
  'serviceOfNode',
  'splitCost',
  'splitRefusal',
  'takeable',
  'taskRefusal',
  'worksOn',
] as const

const PLAYER_WORK = seatMoves(Work, NOT_WORK)

const NOT_A_MIRROR_MOVE = [
  'Change',
  'MANAGED',
  'advanceMirrors',
  'applyCost',
  'applySeconds',
  'driftOf',
  'mirrorOf',
  'mirrorsOf',
  'overridable',
  'patternsFor',
  'previewApply',
  'refreshesOnPlan',
  'switchLeft',
  'toolOf',
] as const

const PLAYER_MIRRORS = seatMoves(Mirrors, NOT_A_MIRROR_MOVE)

const tables: Record<IntentNamespace, Record<string, unknown>> = {
  actions: PLAYER_ACTIONS,
  work: PLAYER_WORK,
  mirrors: PLAYER_MIRRORS,
}

export const intent = <K extends keyof typeof PLAYER_ACTIONS>(
  name: K,
  ...args: Rest<(typeof PLAYER_ACTIONS)[K]>
): Intent => ({ ns: 'actions', name: name as string, args })

export const workIntent = <K extends keyof typeof PLAYER_WORK>(
  name: K,
  ...args: Rest<(typeof PLAYER_WORK)[K]>
): Intent => ({ ns: 'work', name: name as string, args })

export const mirrorIntent = <K extends keyof typeof PLAYER_MIRRORS>(
  name: K,
  ...args: Rest<(typeof PLAYER_MIRRORS)[K]>
): Intent => ({ ns: 'mirrors', name: name as string, args })

const wireSafe = (value: unknown): boolean => {
  if (value === null) return true
  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true
    case 'number':
      return Number.isFinite(value)
    case 'object':
      return Array.isArray(value)
        ? value.every(wireSafe)
        : Object.values(value as Record<string, unknown>).every(wireSafe)
    default:
      return false
  }
}

export const planOf = (name: string, args: ReadonlyArray<unknown>): Intent | null => {
  if (!wireSafe(args)) return null
  for (const ns of ['actions', 'work', 'mirrors'] as const)
    if (Object.hasOwn(tables[ns], name)) return { ns, name, args: [...args] }
  return null
}

const valid = Schema.is(Game)

const runIntent = (game: Game, entry: Intent): Result.Result<Game, Refusal> => {
  const table = tables[entry.ns]
  if (!Object.hasOwn(table, entry.name))
    return Result.fail(Refusal.NotAllowed({ reason: 'That is not a move you can make here.' }))
  const run = table[entry.name] as (game: Game, ...args: ReadonlyArray<unknown>) => unknown
  let outcome: unknown
  try {
    outcome = run(game, ...entry.args)
  } catch {
    return Result.fail(Refusal.NotAllowed({ reason: 'That move did not apply.' }))
  }
  return Result.isResult(outcome) ? (outcome as Actions.Action) : Result.succeed(outcome as Game)
}

export const applyIntents = (
  game: Game,
  intents: ReadonlyArray<Intent>,
): Result.Result<Game, Refusal> => {
  let current = game
  for (const entry of intents) {
    const applied = runIntent(current, entry)
    if (Result.isFailure(applied)) return applied
    current = applied.success
  }
  return current === game || valid(current)
    ? Result.succeed(current)
    : Result.fail(Refusal.NotAllowed({ reason: 'That move did not apply.' }))
}

export const applyIntent = (game: Game, entry: Intent): Result.Result<Game, Refusal> =>
  applyIntents(game, [entry])

export const RefusalWire = Schema.TaggedUnion({
  Locked: { what: Schema.String, research: Schema.String },
  TooEarly: { what: Schema.String, era: Schema.String },
  Unaffordable: {
    what: Schema.String,
    price: Schema.Finite,
    currency: Schema.Literal('cash'),
  },
  NotAllowed: { reason: Schema.String },
  Missing: {},
})
export type RefusalWire = typeof RefusalWire.Type

export const RoomSnapshot = Schema.Struct({
  revision: Schema.Finite,
  time: Schema.Finite,
  game: Game,
  samples: Schema.Array(Sample),
  seats: Schema.Array(Seat),
  owner: Schema.String,
  speed: Schema.Finite,
  vote: Schema.NullOr(Vote),
})
export type RoomSnapshot = typeof RoomSnapshot.Type

export const ClientMessage = Schema.TaggedUnion({
  Hello: {
    seat: Schema.String.check(Schema.isMaxLength(ROOM_MAX_TEXT_CHARS)),
    name: Schema.String.check(Schema.isMaxLength(ROOM_MAX_TEXT_CHARS)),
    token: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(ROOM_MAX_TEXT_CHARS))),
  },
  Intents: {
    id: Schema.Finite,
    intents: Schema.Array(Intent).check(Schema.isMaxLength(ROOM_MAX_INTENTS_PER_FRAME)),
  },
  Ballot: { vote: Schema.Finite, yes: Schema.Boolean },
  StartVote: { kind: VoteKind },
  Cursor: {
    x: Schema.Finite,
    y: Schema.Finite,
    region: RegionId,
    activity: Schema.optionalKey(SeatActivity),
  },
  HideCursor: {},
  TakeOffline: {},
  Speed: { value: Schema.Literals(ROOM_SPEEDS) },
  Kick: { seat: Schema.String.check(Schema.isMaxLength(ROOM_MAX_TEXT_CHARS)) },
  Resync: {},
  Ping: { at: Schema.Finite },
})
export type ClientMessage = typeof ClientMessage.Type

export const ServerMessage = Schema.TaggedUnion({
  Welcome: {
    revision: Schema.Finite,
    simVersion: Schema.String,
    seat: Schema.String,
    game: Game,
    samples: Schema.Array(Sample),
    seats: Schema.Array(Seat),
    owner: Schema.String,
    speed: Schema.Finite,
    vote: Schema.NullOr(Vote),
  },
  Snapshot: {
    revision: Schema.Finite,
    time: Schema.Finite,
    game: Game,
    samples: Schema.Array(Sample),
    seats: Schema.Array(Seat),
    owner: Schema.String,
    speed: Schema.Finite,
    vote: Schema.NullOr(Vote),
  },
  Refused: { id: Schema.Finite, refusal: RefusalWire },
  Cursor: {
    seat: Schema.String,
    name: Schema.String,
    colour: Schema.Finite,
    x: Schema.Finite,
    y: Schema.Finite,
    region: RegionId,
    activity: Schema.optionalKey(SeatActivity),
  },
  CursorGone: { seat: Schema.String },
  Seats: {
    seats: Schema.Array(Seat),
    owner: Schema.String,
    speed: Schema.Finite,
    vote: Schema.NullOr(Vote),
  },
  Joined: { seat: Seat },
  Final: {
    revision: Schema.Finite,
    game: Game,
    samples: Schema.Array(Sample),
  },
  Ended: {
    reason: Schema.Literals(['offline', 'handover', 'expired', 'stale', 'removed']),
  },
})
export type ServerMessage = typeof ServerMessage.Type
