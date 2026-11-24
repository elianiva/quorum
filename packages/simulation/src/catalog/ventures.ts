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
import { VENTURE_IDS, GARAGE_START, NO_CONSTRAINT, MUTATOR_IDS } from '../generated/ventures.ts'

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

const venture = (
  entry: Pick<VentureDef, 'id' | 'name' | 'legacy' | 'summary'> & Partial<VentureDef>,
): VentureDef => ({
  peak: 20,
  amplitude: 0.45,
  weekend: 1,
  shares: null,
  value: 1,
  market: 1,
  bootstrapped: false,
  start: GARAGE_START,
  constraint: NO_CONSTRAINT,
  signature: null,
  ...entry,
})

export const VENTURES: Record<VentureId, VentureDef> = {
  'b2b-saas': venture({
    id: 'b2b-saas',
    name: 'B2B SaaS',
    legacy: 1,
    constraint: { ...NO_CONSTRAINT, sla: 4 },
    signature: 'hot-shard',
    summary: 'Evening peak; the default mix',
  }),
  'consumer-social': venture({
    id: 'consumer-social',
    name: 'Consumer social',
    weekend: 1.15,
    shares: {
      page: 0.08,
      read: 0.13,
      write: 0.05,
      login: 0.05,
      search: 0.03,
      upload: 0.06,
      bot: 0.05,
      media: 0.14,
      rt: 0.06,
      buy: 0.025,
      job: 0.025,
      report: 0.025,
      ai: 0.025,
      feed: 0.18,
      hook: 0.025,
      push: 0.035,
      bid: 0.01,
    },
    value: 0.55,
    market: 2,
    legacy: 1.1,
    signature: 'hot-key',
    constraint: { ...NO_CONSTRAINT, spikeWeight: 2 },
    summary: 'Feeds and video dominate; twice the users at half the value',
  }),
  fintech: venture({
    id: 'fintech',
    name: 'Fintech',
    peak: 14,
    amplitude: 0.6,
    weekend: 0.4,
    shares: {
      page: 0.14,
      read: 0.155,
      write: 0.12,
      login: 0.06,
      search: 0.04,
      upload: 0.03,
      bot: 0.03,
      media: 0.025,
      rt: 0.025,
      buy: 0.17,
      job: 0.025,
      report: 0.025,
      ai: 0.025,
      feed: 0.025,
      hook: 0.07,
      push: 0.025,
      bid: 0.01,
    },
    value: 0.72,
    legacy: 1.3,
    signature: 'double-charge',
    constraint: { ...NO_CONSTRAINT, staleFine: 20 },
    summary: 'Business hours; checkouts and writes dominate; a stale money read is fined',
  }),
  streaming: venture({
    id: 'streaming',
    name: 'Streaming media',
    peak: 21,
    amplitude: 0.55,
    shares: {
      page: 0.08,
      read: 0.1,
      write: 0.04,
      login: 0.05,
      search: 0.04,
      upload: 0.03,
      bot: 0.03,
      media: 0.36,
      rt: 0.03,
      buy: 0.04,
      job: 0.025,
      report: 0.025,
      ai: 0.025,
      feed: 0.04,
      hook: 0.025,
      push: 0.05,
      bid: 0.01,
    },
    value: 0.77,
    legacy: 1.2,
    signature: 'premiere-spike',
    constraint: { ...NO_CONSTRAINT, egress: 3 },
    summary: 'Late evening peak; video dominates; egress costs three times',
  }),
  'game-backend': venture({
    id: 'game-backend',
    name: 'Game backend',
    peak: 21,
    shares: {
      page: 0.08,
      read: 0.1,
      write: 0.08,
      login: 0.08,
      search: 0.03,
      upload: 0.03,
      bot: 0.03,
      media: 0.04,
      rt: 0.305,
      buy: 0.04,
      job: 0.025,
      report: 0.025,
      ai: 0.025,
      feed: 0.025,
      hook: 0.025,
      push: 0.04,
      bid: 0.02,
    },
    value: 0.83,
    legacy: 1.3,
    constraint: { ...NO_CONSTRAINT, hubsPerRegion: 3 },
    signature: 'launch-day',
    summary: 'Evening peak; realtime is most of the traffic',
  }),
  'ai-startup': venture({
    id: 'ai-startup',
    name: 'AI startup',
    amplitude: 0.1,
    shares: {
      page: 0.1,
      read: 0.11,
      write: 0.05,
      login: 0.04,
      search: 0.06,
      upload: 0.1,
      bot: 0.03,
      media: 0.03,
      rt: 0.025,
      buy: 0.03,
      job: 0.06,
      report: 0.04,
      ai: 0.23,
      feed: 0.025,
      hook: 0.03,
      push: 0.03,
      bid: 0.01,
    },
    value: 0.74,
    legacy: 1.3,
    constraint: { ...NO_CONSTRAINT, gpus: 2 },
    signature: 'gpu-shortage',
    summary: 'Flat demand; prompts and uploads dominate; GPUs are scarce',
  }),
  'e-commerce': venture({
    id: 'e-commerce',
    name: 'E-commerce',
    shares: {
      page: 0.18,
      read: 0.12,
      write: 0.05,
      login: 0.05,
      search: 0.2,
      upload: 0.025,
      bot: 0.06,
      media: 0.04,
      rt: 0.025,
      buy: 0.07,
      job: 0.025,
      report: 0.025,
      ai: 0.025,
      feed: 0.025,
      hook: 0.04,
      push: 0.03,
      bid: 0.01,
    },
    value: 0.88,
    legacy: 1.2,
    signature: 'flash-sale',
    constraint: {
      ...NO_CONSTRAINT,
      sale: { everyDays: 30, startMinute: 720, minutes: 120, kind: 'buy', lift: 20 },
    },
    summary: 'Pages and searches dominate; a scheduled monthly sale',
  }),
  'developer-platform': venture({
    id: 'developer-platform',
    name: 'Developer platform',
    amplitude: 0.1,
    shares: {
      page: 0.13,
      read: 0.22,
      write: 0.06,
      login: 0.06,
      search: 0.03,
      upload: 0.04,
      bot: 0.04,
      media: 0.025,
      rt: 0.025,
      buy: 0.03,
      job: 0.03,
      report: 0.025,
      ai: 0.04,
      feed: 0.025,
      hook: 0.16,
      push: 0.04,
      bid: 0.02,
    },
    value: 0.83,
    market: 1.5,
    legacy: 1.35,
    constraint: { ...NO_CONSTRAINT, noNaiveRetries: true },
    signature: 'retry-storm',
    summary: 'Flat, bursty; API reads and webhooks dominate; no naive retries',
  }),
  healthcare: venture({
    id: 'healthcare',
    name: 'Healthcare',
    peak: 14,
    weekend: 0.4,
    shares: {
      page: 0.11,
      read: 0.19,
      write: 0.165,
      login: 0.08,
      search: 0.1,
      upload: 0.04,
      bot: 0.02,
      media: 0.025,
      rt: 0.025,
      buy: 0.04,
      job: 0.03,
      report: 0.06,
      ai: 0.03,
      feed: 0.025,
      hook: 0.025,
      push: 0.025,
      bid: 0.01,
    },
    value: 0.87,
    legacy: 1.4,
    constraint: { ...NO_CONSTRAINT, residency: 3 },
    signature: 'audit',
    summary: 'Business hours; writes and searches dominate; data stays in region',
  }),
  'ad-tech': venture({
    id: 'ad-tech',
    name: 'Ad tech',
    amplitude: 0.05,
    shares: {
      page: 0.12,
      read: 0.11,
      write: 0.05,
      login: 0.03,
      search: 0.03,
      upload: 0.025,
      bot: 0.06,
      media: 0.06,
      rt: 0.025,
      buy: 0.025,
      job: 0.025,
      report: 0.025,
      ai: 0.04,
      feed: 0.025,
      hook: 0.025,
      push: 0.025,
      bid: 0.3,
    },
    value: 0.44,
    market: 3,
    start: { ...GARAGE_START, cash: 400 },
    legacy: 1.3,
    constraint: { ...NO_CONSTRAINT, deadline: 100 },
    signature: 'latency-regression',
    summary: 'Flat and enormous; bids dominate; a request over 100 ms earns nothing',
  }),
  government: venture({
    id: 'government',
    name: 'Government contract',
    peak: 14,
    weekend: 0.2,
    shares: {
      page: 0.195,
      read: 0.15,
      write: 0.12,
      login: 0.08,
      search: 0.06,
      upload: 0.07,
      bot: 0.02,
      media: 0.025,
      rt: 0.025,
      buy: 0.05,
      job: 0.03,
      report: 0.05,
      ai: 0.04,
      feed: 0.025,
      hook: 0.025,
      push: 0.025,
      bid: 0.01,
    },
    value: 1.51,
    market: 0.8,
    start: {
      ...GARAGE_START,
      cash: 900,
      runtime: 'tomcat',
      researched: ['lang-java'],
    },
    legacy: 1.5,
    constraint: { ...NO_CONSTRAINT, procurement: true, languages: ['java', 'csharp'] },
    signature: 'deadline-day',
    summary: 'Business hours; pages and records; Java or C#; a day to buy',
  }),
  bootstrapped: venture({
    id: 'bootstrapped',
    name: 'Bootstrapped indie',
    bootstrapped: true,
    legacy: 1.4,
    summary: 'No funding rounds; the default mix; Equity stays 100%',
  }),
}

export type MutatorId = (typeof MUTATOR_IDS)[number]

export type MutatorDef = Readonly<{
  id: MutatorId
  name: string
  rule: string
  legacy: number
}>
