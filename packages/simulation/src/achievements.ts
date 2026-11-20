import {
  COMPONENTS,
  DIURNAL_AMPLITUDE,
  ERAS,
  FALLACY_IDS,
  LET_IT_CRASH,
  MIGRATION_STEPS,
  REGIONS,
  RUNTIMES,
  SPREAD_REGIONS,
  VENTURES,
  VENTURE_IDS,
  fallacyOf,
  type AchievementId,
  type ComponentId,
  type FallacyId,
  type LanguageId,
} from './catalog.ts'
import type { StepEvent } from './events.ts'
import { PRE_IPO_STAGE } from './ipo.ts'
import type { Ledger } from './ledger.ts'
import { isDown, pricingOf } from './lookups.ts'
import { openRegions, regionDiurnal, regionUsers, spreadRegions } from './regions.ts'
import { budgetOf, budgeted } from './slo.ts'
import { Migration, QuarterState, type Game, type GameNode } from './state.ts'
import { activeIncident } from './state.ts'
import { valuationOf } from './valuation.ts'

export type AchievementStats = Readonly<{
  postmortems: number
  terminations: number
  fallacies: ReadonlyArray<FallacyId>
}>

export type Moment = Readonly<{
  before: Game
  after: Game
  ledger: Ledger
  previousLedger: Ledger | null
  events: ReadonlyArray<StepEvent>
  stats: AchievementStats
}>

const SERIES_A = ERAS.findIndex((era) => era.name === 'Series A')
const SERIES_B = ERAS.findIndex((era) => era.name === 'Series B')
const SEED = ERAS.findIndex((era) => era.name === 'Seed')
const PUBLIC = PRE_IPO_STAGE + 1
const WEEK_HOURS = 7 * 24
const POSTGRES: ReadonlySet<ComponentId> = new Set(['database', 'pooler', 'replica'])
const DATA_TIER: ReadonlySet<ComponentId> = new Set([
  'database',
  'pooler',
  'cache',
  'replica',
  'wide',
  'dsql',
])
const FAR_MS = 150
const BUSY = 0.7
const PEAK = 1 + DIURNAL_AMPLITUDE * 0.98
const BILLION = 1e9
const SIX_BILLION = 6e9

const reached = (moment: Moment, stage: number): boolean =>
  moment.before.stage < stage && moment.after.stage >= stage

const languages = (game: Game): ReadonlySet<LanguageId> =>
  new Set(
    game.nodes
      .filter((node) => COMPONENTS[node.type].group === 'compute')
      .map((node) => RUNTIMES[node.runtime].language),
  )

const servers = (game: Game): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'server')

const foundedEquity = (game: Game): number =>
  VENTURES[game.founding.venture].bootstrapped ? 1 : 1 - (ERAS[0]?.dilution ?? 0)

export const isTermination = (event: StepEvent): boolean =>
  event._tag === 'IncidentResolved' && event.postmortem.kind === 'instance'

export const countStats = (
  stats: AchievementStats,
  events: ReadonlyArray<StepEvent>,
): AchievementStats => {
  const met = events.flatMap((event) =>
    event._tag === 'IncidentResolved' ? (fallacyOf(event.postmortem.kind) ?? []) : [],
  )
  return {
    postmortems:
      stats.postmortems + events.filter((event) => event._tag === 'IncidentResolved').length,
    terminations: stats.terminations + events.filter(isTermination).length,
    fallacies: [...new Set([...stats.fallacies, ...met])],
  }
}

const grew = (before: Game, node: GameNode): boolean => {
  const was = before.nodes.find((entry) => entry.id === node.id)
  return was === undefined || node.size > was.size || node.replicas > was.replicas
}

const anyGrew = (before: Game, after: Game, where: (node: GameNode) => boolean): boolean =>
  after.nodes.some((node) => where(node) && grew(before, node))

const memoryIncident = (game: Game, events: ReadonlyArray<StepEvent>): boolean =>
  activeIncident(game)?.kind === 'leak' ||
  game.nodes.some((node) => node.leak > 0) ||
  game.postmortems.some((postmortem) => postmortem.kind === 'leak') ||
  events.some(
    (event) =>
      event._tag === 'OutOfMemory' ||
      (event._tag === 'IncidentResolved' && event.postmortem.kind === 'leak'),
  )

const atLocalPeak = (game: Game): boolean =>
  REGIONS.some((region) => regionDiurnal(game.time, region) >= PEAK)

const wideStores = (game: Game): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'wide' && !isDown(node))

const CHECKS: Partial<Record<AchievementId, (moment: Moment) => boolean>> = {
  'hello-world': ({ ledger }) => ledger.served > 0,
  'works-on-my-machine': ({ events }) =>
    events.some((event) => event._tag === 'Deployed' && event.bad),
  'split-brain': ({ before, after }) =>
    !before.nodes.some((node) => node.type === 'database') &&
    after.nodes.some((node) => node.type === 'database'),
  'averages-lie': ({ before, after, ledger }) =>
    !before.researched.includes('percentiles') &&
    after.researched.includes('percentiles') &&
    ledger.p99 > 5 * ledger.latency,
  'shared-nothing': (moment) => {
    const apps = servers(moment.after)
    return (
      reached(moment, SEED) &&
      apps.length > 0 &&
      apps.every((node) => node.runtime === 'php_fpm') &&
      !memoryIncident(moment.after, moment.events)
    )
  },
  blocked: ({ before, events }) =>
    activeIncident(before)?.kind === 'loop' &&
    before.nodes.some(
      (node) =>
        node.type === 'server' &&
        RUNTIMES[node.runtime].language === 'node' &&
        RUNTIMES[node.runtime].blocking === 'loop',
    ) &&
    events.some((event) => event._tag === 'IncidentResolved' && event.postmortem.kind === 'loop'),
  'off-by-one-region': ({ ledger }) =>
    Object.values(ledger.regionKinds).some((kinds) =>
      Object.values(kinds ?? {}).some(
        (entry) =>
          entry !== undefined && entry.rate > 0 && entry.success > 0 && entry.hopMs > FAR_MS,
      ),
    ),
  'littles-law': ({ before, after, ledger, previousLedger }) => {
    const was = previousLedger
      ? before.nodes.find((node) => {
          if (node.type !== 'server') return false
          const prev = previousLedger.nodes[node.id]
          return prev !== undefined && prev.utilization >= BUSY && prev.limit === 'workers'
        })
      : undefined
    if (was === undefined) return false
    if (!anyGrew(before, after, (node) => DATA_TIER.has(node.type))) return false
    if (anyGrew(before, after, (node) => node.type === 'server')) return false
    const now = ledger.nodes[was.id]
    return now === undefined || now.limit !== 'workers' || now.utilization < BUSY
  },
  metastable: ({ events }) =>
    events.some(
      (event) => event._tag === 'IncidentResolved' && event.postmortem.kind === 'retry-storm',
    ),
  'big-rewrite': ({ before, after }) => {
    const moved = before.services.find(
      (service) =>
        !Migration.guards.Idle(service.migration) &&
        RUNTIMES[service.migration.runtime].language !==
          RUNTIMES[service.migration.fromRuntime].language,
    )
    if (moved === undefined || Migration.guards.Idle(moved.migration)) return false
    if (after.services.some((service) => !Migration.guards.Idle(service.migration))) return false
    const target = RUNTIMES[moved.migration.runtime].language
    const apps = servers(after)
    return apps.length > 0 && apps.every((node) => RUNTIMES[node.runtime].language === target)
  },
  strangler: ({ events, ledger }) =>
    events.some(
      (event) => event._tag === 'MigrationShifted' && event.step === MIGRATION_STEPS.length - 1,
    ) && ledger.errorShare < 0.01,
  polyglot: ({ after }) => languages(after).size >= 5,
  'zero-gc': ({ after, ledger }) =>
    after.nodes.some(
      (node) =>
        RUNTIMES[node.runtime].language === 'rust' &&
        COMPONENTS[node.type].group === 'compute' &&
        (ledger.nodes[node.id]?.inbound ?? 0) >= 100_000,
    ),
  'no-cache': (moment) =>
    reached(moment, SERIES_A) &&
    !moment.after.nodes.some((node) => node.type === 'cache' || node.type === 'cdn'),
  'postgres-for-everything': (moment) =>
    reached(moment, SERIES_B) &&
    moment.after.nodes.every(
      (node) => COMPONENTS[node.type].group !== 'data' || POSTGRES.has(node.type),
    ),
  'hug-of-death': ({ before, events }) => {
    const incident = activeIncident(before)
    return (
      incident?.kind === 'spike' &&
      incident.magnitude >= 10 &&
      events.some(
        (event) =>
          event._tag === 'IncidentResolved' &&
          event.postmortem.kind === 'spike' &&
          event.postmortem.lostUsers <= 0,
      )
    )
  },
  'egress-shock': ({ ledger }) => {
    const lines = ledger.burnLines
    return (
      lines.egress > 0 &&
      Object.entries(lines).every(([line, value]) => line === 'egress' || value < lines.egress)
    )
  },
  'chaos-monkey': ({ stats }) => stats.terminations >= 100,
  blameless: ({ stats }) => stats.postmortems >= 50,
  nines: ({ after }) => {
    if (!budgeted(after) || after.budget.length < WEEK_HOURS) return false
    const budget = budgetOf(after)
    return budget.requests > 0 && budget.availability >= 0.9999
  },
  monoglot: (moment) => reached(moment, PUBLIC) && languages(moment.after).size === 1,
  'default-alive': (moment) =>
    reached(moment, PUBLIC) && moment.before.equity >= foundedEquity(moment.before) - 1e-9,
  unicorn: ({ after, ledger }) =>
    after.stage >= SERIES_A && valuationOf(after, ledger).valuation >= 1e9,
  decacorn: ({ after, ledger }) =>
    after.stage >= SERIES_A && valuationOf(after, ledger).valuation >= 1e10,
  'everyone-online': ({ after }) => after.users >= SIX_BILLION,
  'rule-of-40': ({ after, ledger }) =>
    QuarterState.guards.Active(after.quarter) && valuationOf(after, ledger).ruleOf40 >= 80,
  'beat-and-raise': ({ after }) =>
    QuarterState.guards.Active(after.quarter) && after.quarter.streak >= 8,
  quorum: ({ after, ledger }) =>
    openRegions(after).length >= SPREAD_REGIONS &&
    wideStores(after).some(
      (node) =>
        node.spread &&
        node.r + node.w > node.n &&
        spreadRegions(after, node, SPREAD_REGIONS).length >= SPREAD_REGIONS &&
        (ledger.nodes[node.id]?.inbound ?? 0) > 0,
    ),
  eventually: ({ after }) =>
    after.users >= BILLION && wideStores(after).some((node) => node.r === 1 && node.w === 1),
  'warm-start': ({ before, after, ledger }) => {
    const prior = before.history.at(-1)?.p99
    if (activeIncident(before)?.kind !== 'spike' || prior === undefined || prior <= 0) return false
    const scaled = after.nodes.some((node) => {
      if (node.type !== 'server' || RUNTIMES[node.runtime].language !== 'java') return false
      const was = before.nodes.find((entry) => entry.id === node.id)
      return (
        was !== undefined &&
        (node.replicas > was.replicas ||
          (node.scaler._tag === 'Scaling' ? node.scaler.pending : 0) >
            (was.scaler._tag === 'Scaling' ? was.scaler.pending : 0))
      )
    })
    return scaled && ledger.p99 <= prior
  },
  celebrity: ({ before, events }) =>
    activeIncident(before)?.kind === 'hot-key' &&
    events.some(
      (event) =>
        event._tag === 'IncidentResolved' &&
        event.postmortem.kind === 'hot-key' &&
        event.postmortem.failed <= 0,
    ),
  'follow-the-sun': ({ after, ledger }) => {
    if (openRegions(after).length < REGIONS.length) return false
    const users = regionUsers(after)
    if (!REGIONS.every((region) => users[region] > 0)) return false
    return (
      atLocalPeak(after) && Object.values(ledger.nodes).every((node) => node.utilization <= BUSY)
    )
  },
  'two-hard-things': ({ events }) =>
    events.some(
      (event) => event._tag === 'IncidentResolved' && event.postmortem.kind === 'stale-read',
    ),
  'conways-law': ({ before, after }) =>
    before.services.length > before.teams.length &&
    after.services.length > 0 &&
    after.teams.length >= after.services.length,
  fallacies: ({ stats }) => new Set(stats.fallacies).size >= FALLACY_IDS.length,
  'thundering-herd': ({ events }) =>
    events.some(
      (event) =>
        event._tag === 'IncidentResolved' &&
        event.postmortem.kind === 'reconnect' &&
        event.postmortem.failed <= 0,
    ),
  runbook: ({ events }) =>
    events.some((event) => event._tag === 'IncidentResolved' && event.postmortem.auto === true),
  finops: ({ after }) => {
    const models = new Set(
      after.nodes
        .filter((node) => COMPONENTS[node.type].group === 'compute')
        .map((node) => pricingOf(after, node)),
    )
    return models.has('reserved') && models.has('on-demand') && models.has('spot')
  },
  'spot-the-difference': ({ events }) =>
    events.some(
      (event) =>
        event._tag === 'IncidentResolved' &&
        event.postmortem.kind === 'spot-reclaim' &&
        event.postmortem.failed <= 0,
    ),
  'let-it-crash': ({ after, ledger }) =>
    ledger.errorShare === 0 &&
    after.nodes.some(
      (node) =>
        node.type === 'server' &&
        RUNTIMES[node.runtime].language === 'elixir' &&
        node.crashes >= LET_IT_CRASH &&
        (ledger.nodes[node.id]?.inbound ?? 0) > 0,
    ),
}

export const detectAchievements = (
  moment: Moment,
  owned: ReadonlyArray<AchievementId>,
): ReadonlyArray<AchievementId> => {
  if (moment.after.sandbox) return []
  return Object.entries(CHECKS)
    .filter(([id, check]) => !owned.includes(id as AchievementId) && check(moment))
    .map(([id]) => id as AchievementId)
}

export const everyVenture = (ventures: ReadonlyArray<string>): boolean =>
  VENTURE_IDS.every((id) => ventures.includes(id))
