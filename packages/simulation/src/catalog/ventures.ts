import type { IncidentId } from './incidents.ts'
import type { RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'
import type { LanguageId, RuntimeId } from './runtimes.ts'
export {
  VENTURE_IDS,
  START_CASH,
  GARAGE_START,
  MONEY_KINDS,
  NO_CONSTRAINT,
  MUTATOR_IDS,
  MUTATORS,
  MUTATOR_BANS,
  MONOLITH_KLOC,
  MONOLITH_MIGRATION,
  MONOLITH_DEBT,
  CHAOS_WEIGHT,
  CHAOS_FROM_STAGE,
  STEAL_MAX,
  STEAL_SECONDS,
  HN_WEIGHT,
  SLO_LEVELS,
} from '../generated/ventures.ts'
import { VENTURE_IDS, MUTATOR_IDS } from '../generated/ventures.ts'
export { VENTURES } from '../generated/ventures.ts'

export type VentureId = (typeof VENTURE_IDS)[number]

export type VentureStart = Readonly<{
  cash: number
  equity: number
  stage: number
  runtime: RuntimeId | null
  researched: ReadonlyArray<ResearchId>
}>

export type VentureConstraint = Readonly<{
  noNaiveRetries: boolean
  residency: number | null
  deadline: number | null
  procurement: boolean
  languages: ReadonlyArray<LanguageId> | null
  sla: number | null
  gpus: number
  hubsPerRegion: number | null
  egress: number
  spikeWeight: number
  staleFine: number
  sale: SaleSchedule | null
}>

export type SaleSchedule = Readonly<{
  everyDays: number
  startMinute: number
  minutes: number
  kind: RequestKind
  lift: number
}>

export type VentureShares = Readonly<Partial<Record<RequestKind, number>>>

export type VentureDef = Readonly<{
  id: VentureId
  name: string
  peak: number
  amplitude: number
  weekend: number
  shares: VentureShares | null
  value: number
  market: number
  bootstrapped: boolean
  start: VentureStart
  constraint: VentureConstraint
  signature: IncidentId | null
  legacy: number
  summary: string
}>

export type MutatorId = (typeof MUTATOR_IDS)[number]

export type MutatorDef = Readonly<{
  id: MutatorId
  name: string
  rule: string
  legacy: number
}>
