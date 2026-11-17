import {
  ALERT_FATIGUE,
  CALENDAR_DAY,
  ALERT_RULES,
  BREAKER_OPEN,
  BREAKER_THRESHOLD,
  APDEX_WINDOW,
  COMPONENTS,
  BEAM_CRASHES_PER_REQUESTS,
  BORDER_MIXING,
  CHURN,
  CREDIT_CAP,
  DECLINED_GROWTH,
  FEATURES,
  FICKLE_SHARE,
  FIRST_KIND_INSIGHT,
  FUNNEL_GROWTH,
  LIVE_TUNING,
  OOM_RATIO,
  PROFILES,
  REGION_INFO,
  REGIONS,
  REQUEST_KINDS,
  POD_REACTION_SECONDS,
  RUNTIMES,
  ROW_KB,
  DB_RETENTIONS,
  REPLICA_SYNC_MINUTES_PER_GB,
  SEARCH_COPY_MINUTES_PER_GB,
  SEARCH_INDEX_SHARE,
  WIDE_REBALANCE_MINUTES_PER_GB,
  DOC_REBALANCE_MINUTES_PER_GB,
  LOG_REPLICATE_MINUTES_PER_GB,
  SCALE_COOLDOWN_SECONDS,
  SCALE_QUEUE_DEPTH,
  SCALE_RPS_PER_VCPU,
  SCALE_IN,
  STEADY_CHURN,
  UPLOAD_MB,
  WRITE_BEHIND_SECONDS,
  VM_REACTION_SECONDS,
  CERT_FROM_STAGE,
  CERT_RENEW,
  TLS_TERMINATORS,
  DRAIN_SECONDS,
  WARMUP_SECONDS,
  SCHEDULE_LEAD_MINUTES,
  CHAOS_INSIGHT,
  DRILL_INSIGHT,
  LOAD_TEST_INSIGHT,
  NO_DEVICE_LATENCY,
  ANOMALY_DETECTION_HOLD,
  type RegionId,
  type RequestKind,
  type Tuning,
} from './catalog.ts'
import { advanceCves } from './cve.ts'
import {
  advanceIncident,
  directIncidents,
  markSignal,
  pentestWeakness,
  startIncident,
} from './director.ts'
import { advanceMirrors } from './mirror.ts'
import { step as roundStep } from './era-round-machine.ts'
import { StepEvent, type AlertRule } from './events.ts'
import {
  advanceFeatures,
  churnFactor,
  growthFactor,
  isFeatureLive,
  leverGrowthFactor,
} from './features.ts'
import { growthPerk, ventureOf } from './founding.ts'
import type { Ledger } from './ledger.ts'
import {
  certExpired,
  certLifeOf,
  certManaged,
  certNodes,
  copiesOf,
  drawerSize,
  eraOf,
  has,
  inCluster,
  isDown,
  logLoss,
  meshOf,
  restarted,
  vcpuOf,
  warmAfterRestart,
} from './lookups.ts'
import { causeOf, warming, warmOf, withWarm } from './life.ts'
import { isOpen, step as breakerStep } from './breaker-machine.ts'
import { step as scalerStep } from './autoscaler-machine.ts'
import { canRaise } from './actions.ts'
import { isDraining, step as serviceStep } from './node-service-machine.ts'
import { burnRateOf, recordBudget, slaCreditsOf, spendBudget } from './slo.ts'
import { cosTurns } from './calendar.ts'
import { calendarMinute, carryLedger, chaosRunning, solveFlow } from './solve.ts'
import { advanceDrill } from './ipo.ts'
import { advanceQuarter, QUARTER_SECONDS } from './quarters.ts'
import { advanceRunway } from './runway.ts'
import { accrue, advanceStudies } from './studies.ts'
import { perRegion, regional, regionApdexOf, regionUsers, withRegionUsers } from './regions.ts'
import type { Alarms, FalseAlarms, Game, GameLink, GameNode, PerRegion, Sample } from './state.ts'
import { applyPolicies } from './policies.ts'
import { advanceMorale, advanceTeam } from './work.ts'

export type StepResult = Readonly<{
  game: Game
  ledger: Ledger
  events: ReadonlyArray<StepEvent>
}>

const HISTORY = 600

const slowestKind = (ledger: Ledger): RequestKind | null => {
  let slowest: RequestKind | null = null
  let worst = 0
  for (const kind of REQUEST_KINDS) {
    const entry = ledger.kinds[kind]
    if (!PROFILES[kind].scored || !entry || entry.rate <= 0) continue
    if (entry.p99 > worst) {
      worst = entry.p99
      slowest = kind
    }
  }
  return slowest
}

type Flow = Readonly<{ fickle: number; steady: number }>

const steadyOf = (game: Game, region: RegionId): number => game.steady?.[region] ?? 1 - FICKLE_SHARE

const flowsOf = (game: Game, ledger: Ledger, pace: number): Readonly<Record<RegionId, Flow>> => {
  const era = eraOf(game)
  const users = regionUsers(game)
  const split = regional(game)
  const total = REGIONS.reduce((sum, region) => sum + users[region], 0)
  const rate =
    era.growth *
    pace *
    growthFactor(game) *
    leverGrowthFactor(game) *
    growthPerk(game) *
    (game.round._tag === 'Declined' ? DECLINED_GROWTH : 1) *
    (has(game, 'funnels') ? FUNNEL_GROWTH : 1)
  const flows = {} as Record<RegionId, Flow>
  for (const region of REGIONS) {
    const own = users[region]
    const apdex = regionApdexOf(game, region)
    const health = Math.max(-1, Math.min(1, (apdex - era.apdexTarget) / (1 - era.apdexTarget)))
    const steady = own * steadyOf(game, region)
    if (health < 0) {
      const churn = CHURN * churnFactor(game) * health
      flows[region] = { fickle: churn * (own - steady), steady: churn * STEADY_CHURN * steady }
      continue
    }
    const reachable =
      region === 'eu' &&
      split &&
      game.stage >= FEATURES['data-residency'].era &&
      !isFeatureLive(game, 'data-residency')
        ? 0
        : REGION_INFO[region].share
    const market = split ? ledger.market * reachable : ledger.market
    const talk = split ? own + BORDER_MIXING * (total - own) : own
    const growth = rate * talk * Math.max(0, 1 - own / market) * health
    flows[region] = { fickle: growth * FICKLE_SHARE, steady: growth * (1 - FICKLE_SHARE) }
  }
  return flows
}

export const regionGrowth = (game: Game, ledger: Ledger, pace = LIVE_TUNING.pace): PerRegion => {
  const flows = flowsOf(game, ledger, pace)
  return perRegion((region) => flows[region].fickle + flows[region].steady)
}

export const growthOf = (game: Game, ledger: Ledger, pace = LIVE_TUNING.pace): number => {
  const growth = regionGrowth(game, ledger, pace)
  return REGIONS.reduce((total, region) => total + growth[region], 0)
}

const grow = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  pace: number,
): Pick<Game, 'users' | 'userShares' | 'steady'> => {
  if (game.sandbox) return game
  const flows = flowsOf(game, ledger, pace)
  const users = regionUsers(game)
  const steady = perRegion((region) =>
    Math.max(0, users[region] * steadyOf(game, region) + flows[region].steady * seconds),
  )
  const fickle = perRegion((region) =>
    Math.max(0, users[region] * (1 - steadyOf(game, region)) + flows[region].fickle * seconds),
  )
  const grown = perRegion((region) => steady[region] + fickle[region])
  const shares = perRegion((region) =>
    grown[region] > 0 ? steady[region] / grown[region] : steadyOf(game, region),
  )
  if (!regional(game)) {
    const total = REGIONS.reduce((sum, region) => sum + grown[region], 0)
    return { users: Math.max(20, total), userShares: game.userShares, steady: shares }
  }
  const next = withRegionUsers(game, grown)
  return { users: Math.max(20, next.users), userShares: next.userShares, steady: shares }
}

export const forecastUsers = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  pace = LIVE_TUNING.pace,
): PerRegion => {
  let current = game
  for (let left = seconds; left > 0; left -= FORECAST_STEP) {
    const grown = grow({ ...current, sandbox: false }, ledger, Math.min(FORECAST_STEP, left), pace)
    current = { ...current, ...grown }
  }
  return regionUsers(current)
}

const FORECAST_STEP = 10

const regionApdexAfter = (game: Game, ledger: Ledger, seconds: number): PerRegion | null => {
  if (!regional(game)) return null
  const weight = Math.min(1, seconds / APDEX_WINDOW)
  return perRegion((region) => {
    const before = regionApdexOf(game, region)
    return before + ((ledger.regions[region] ?? before) - before) * weight
  })
}

const REFILL_STALL_LOAD = 0.9

const refillsStall = (game: Game, ledger: Ledger, node: GameNode): boolean =>
  node.type === 'cache' &&
  game.incident?.kind === 'stampede' &&
  game.links.some((link) => {
    if (link.from !== node.id) return false
    const target = game.nodes.find((entry) => entry.id === link.to)
    return (
      (target?.type === 'database' || target?.type === 'pooler') &&
      (ledger.nodes[link.to]?.utilization ?? 0) >= REFILL_STALL_LOAD
    )
  })

const depthAfter = (game: Game, ledger: Ledger, queue: GameNode, seconds: number): number => {
  const own = ledger.nodes[queue.id]
  if (!own) return queue.depth
  const accepted = Math.max(0, own.inbound - own.dropped)
  let drained = 0
  for (const link of ledger.links) {
    if (link.from !== queue.id) continue
    const worker = ledger.nodes[link.to]
    if (!worker || worker.inbound <= 0) continue
    drained += link.rate * ((worker.inbound - worker.dropped) / worker.inbound)
  }
  const depth = Math.max(0, queue.depth + (accepted - drained) * seconds)
  return queue.maxLength > 0 ? Math.min(queue.maxLength, depth) : depth
}

const lostOnCrash = (game: Game, from: number, seconds: number): number => {
  let lost = 0
  for (const node of game.nodes) {
    if (node.type !== 'worker' || !isDown(node) || causeOf(node.life) === 'restart') continue
    if (node.downAt < from || node.downAt >= from + seconds) continue
    const processes = RUNTIMES[node.runtime].pool ? node.workers : vcpuOf(node)
    lost += node.prefetch * Math.max(1, processes) * copiesOf(node)
  }
  return lost
}

const crashedLog = (node: GameNode, from: number, seconds: number): boolean =>
  node.type === 'log' &&
  isDown(node) &&
  causeOf(node.life) !== 'restart' &&
  node.downAt >= from &&
  node.downAt < from + seconds

const crashedCache = (node: GameNode, from: number, seconds: number): boolean =>
  node.type === 'cache' &&
  isDown(node) &&
  causeOf(node.life) !== 'restart' &&
  node.downAt >= from &&
  node.downAt < from + seconds

const lostOnBroker = (game: Game, from: number, seconds: number): number =>
  game.nodes.reduce(
    (lost, node) =>
      crashedLog(node, from, seconds)
        ? lost + node.depth * logLoss(node)
        : crashedCache(node, from, seconds)
          ? lost + node.depth
          : lost,
    0,
  )

const warmupOf = (game: Game, node: GameNode): number =>
  node.type === 'server' || node.type === 'worker'
    ? RUNTIMES[node.runtime].warmup
    : node.type === 'replica'
      ? Math.max(WARMUP_SECONDS, game.data * REPLICA_SYNC_MINUTES_PER_GB)
      : node.type === 'search'
        ? Math.max(WARMUP_SECONDS, game.data * SEARCH_INDEX_SHARE * SEARCH_COPY_MINUTES_PER_GB)
        : node.type === 'wide'
          ? Math.max(WARMUP_SECONDS, game.data * WIDE_REBALANCE_MINUTES_PER_GB)
          : node.type === 'doc'
            ? Math.max(WARMUP_SECONDS, game.data * DOC_REBALANCE_MINUTES_PER_GB)
            : node.type === 'log'
              ? Math.max(WARMUP_SECONDS, game.data * LOG_REPLICATE_MINUTES_PER_GB)
              : WARMUP_SECONDS

const autoscalers = new WeakMap<Game, ReadonlyMap<string, GameNode>>()

const autoscalerOf = (game: Game, node: GameNode): GameNode | undefined => {
  if (node.type !== 'server' && node.type !== 'worker') return undefined
  let scaled = autoscalers.get(game)
  if (scaled === undefined) {
    const byId = new Map(game.nodes.map((entry) => [entry.id, entry]))
    const found = new Map<string, GameNode>()
    for (const link of game.links) {
      const target = byId.get(link.to)
      if (target?.type === 'autoscaler' && !isDown(target) && !found.has(link.from))
        found.set(link.from, target)
    }
    scaled = found
    autoscalers.set(game, scaled)
  }
  return scaled.get(node.id)
}

const scaleLoadOf = (
  game: Game,
  node: GameNode,
  own: NonNullable<Ledger['nodes'][string]>,
  signal: GameNode['signal'],
): number => {
  const copies = Math.max(1, node.replicas)
  if (signal === 'rps')
    return own.inbound / (copies * Math.max(1, vcpuOf(node)) * SCALE_RPS_PER_VCPU)
  if (signal === 'queue') {
    let waiting = 0
    for (const link of game.links) {
      if (link.to !== node.id) continue
      const from = game.nodes.find((entry) => entry.id === link.from)
      if (from?.type === 'queue') waiting += from.depth
    }
    return waiting / (copies * SCALE_QUEUE_DEPTH)
  }
  if (signal === 'cpu') {
    const cpu = own.resources.cpuCores
    return cpu && cpu.total > 0 ? cpu.used / cpu.total : 0
  }
  return own.utilization
}

const scale = (game: Game, node: GameNode, ledger: Ledger, seconds: number): GameNode => {
  if (node.scaler._tag === 'Scaling') {
    const readyIn = node.scaler.readyIn - seconds
    if (readyIn > 0) return { ...node, scaler: { ...node.scaler, readyIn } }
    const replicas = node.replicas + node.scaler.pending
    return {
      ...node,
      replicas,
      scaler: scalerStep(node.scaler, { _tag: 'Ready' }),
      life: withWarm(node.life, (warmOf(node.life) * node.replicas) / replicas),
    }
  }
  const scaler = autoscalerOf(game, node)
  if (!scaler || isDown(node) || game.time - node.scaledAt < SCALE_COOLDOWN_SECONDS) return node
  const own = ledger.nodes[node.id]
  if (!own) return node
  const load = scaleLoadOf(game, node, own, scaler.signal)
  const planned = scaler.schedule && has(game, 'scheduled-scaling') ? peakLoadOf(game, load) : load
  const most = scaler.maxCopies > 0 ? scaler.maxCopies : Number.POSITIVE_INFINITY
  const wanted =
    game.incident?.kind === 'runaway-bill'
      ? Math.max(node.replicas, most === Number.POSITIVE_INFINITY ? 16 : most)
      : Math.min(
          most,
          Math.max(
            scaler.minCopies,
            Math.ceil((node.replicas * Math.max(load, planned)) / scaler.target),
          ),
        )
  if (wanted > node.replicas)
    return {
      ...node,
      scaler: {
        _tag: 'Scaling',
        pending: wanted - node.replicas,
        readyIn: inCluster(game, node) ? POD_REACTION_SECONDS : VM_REACTION_SECONDS,
      },
      scaledAt: game.time,
    }
  if (
    node.replicas > scaler.minCopies &&
    load < scaler.target * SCALE_IN &&
    (load * node.replicas) / (node.replicas - 1) < scaler.target
  )
    return { ...node, replicas: node.replicas - 1, scaledAt: game.time }
  return node
}

export const peakLoadOf = (game: Game, load: number): number => {
  const venture = ventureOf(game)
  const minute = calendarMinute(game.time) % 1440
  const peak = venture.peak * 60
  const ahead = (((peak - minute) % 1440) + 1440) % 1440
  if (ahead > SCHEDULE_LEAD_MINUTES) return load
  const now = 1 + venture.amplitude * cosTurns((minute - peak) / 1440)
  return now > 0 ? (load * (1 + venture.amplitude)) / now : load
}

const advanceNode = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  seconds: number,
  events: Array<StepEvent>,
): GameNode => {
  const time = game.time
  let next = node
  const life = node.life
  if (life._tag === 'Restarting') {
    const left = Math.max(0, life.left - seconds)
    next =
      left > 0
        ? { ...next, life: { ...life, left } }
        : {
            ...next,
            life: warming(warmAfterRestart(node, node.warming && has(game, 'cache-warming'))),
          }
  } else if (life._tag === 'Warming' && !refillsStall(game, ledger, node)) {
    next = { ...next, life: warming(Math.min(1, life.warm + seconds / warmupOf(game, node))) }
  }
  if (node.type === 'server' || node.type === 'worker') next = scale(game, next, ledger, seconds)
  if (
    next.type === 'server' &&
    RUNTIMES[next.runtime].language === 'elixir' &&
    !has(game, 'nifs') &&
    !isDown(next)
  ) {
    const inbound = ledger.nodes[next.id]?.inbound ?? 0
    if (inbound > 0)
      next = { ...next, crashes: next.crashes + (inbound * seconds) / BEAM_CRASHES_PER_REQUESTS }
  }
  if (node.type === 'queue' || node.type === 'log')
    next = { ...next, depth: depthAfter(game, ledger, node, seconds) }
  if (node.type === 'cache')
    next = {
      ...next,
      depth:
        !isDown(node) && has(game, 'cache-strategies') && node.cacheStrategy === 'write-behind'
          ? (ledger.nodes[node.id]?.traffic['q-write'] ?? 0) * WRITE_BEHIND_SECONDS
          : 0,
    }
  if (crashedLog(node, time, seconds)) next = { ...next, depth: next.depth * (1 - logLoss(node)) }
  if (node.lost > 0) next = { ...next, lost: Math.max(0, node.lost - seconds) }
  if (isDraining(next.service)) {
    const handoff = ledger.links
      .filter((link) => link.from === node.id)
      .reduce((sum, link) => sum + (ledger.nodes[link.to]?.capacity ?? 0), 0)
    const held =
      next.depth > 0
        ? Math.max(
            0,
            next.depth - Math.max(ledger.nodes[node.id]?.capacity ?? 0, handoff) * seconds,
          )
        : next.depth
    if (
      next.service._tag === 'Draining' &&
      Math.round((time + seconds) * 1e6) / 1e6 - next.service.since >= DRAIN_SECONDS &&
      held <= 0 &&
      next.lost <= 0
    )
      next = { ...next, depth: held, service: serviceStep(next.service, { _tag: 'DrainFinished' }) }
    else if (held !== next.depth) next = { ...next, depth: held }
  }
  if (
    node.type === 'database' &&
    (node.depth > 0 || (game.incident?.kind === 'retry-storm' && game.incident.nodeId === node.id))
  ) {
    const own = ledger.nodes[node.id]
    const drain = own && own.inbound > 0 ? own.capacity : Number.POSITIVE_INFINITY
    next = { ...next, depth: Math.max(0, node.depth + ((own?.inbound ?? 0) - drain) * seconds) }
  }
  const credits = ledger.nodes[node.id]?.resources.creditsCoreSeconds
  if (node.family === 'burstable' && credits) {
    const balance = Math.max(
      0,
      Math.min(CREDIT_CAP * vcpuOf(node), node.credits + credits.rate * seconds),
    )
    if (node.credits >= 1 && balance < 1)
      events.push(StepEvent.CreditsExhausted({ nodeId: node.id }))
    next = { ...next, credits: balance }
  }
  const ram = ledger.nodes[node.id]?.resources.ramGb
  const killable = RUNTIMES[node.runtime].pool || node.leak > 0
  if (
    (node.type === 'server' || node.type === 'worker') &&
    !isDown(node) &&
    killable &&
    ram &&
    ram.used > ram.total * OOM_RATIO
  ) {
    events.push(StepEvent.OutOfMemory({ nodeId: node.id }))
    next = { ...next, ...restarted(node, 'oom'), leak: 0, downAt: time }
  }
  return next
}

const advanceCertificate = (
  game: Game,
  ledger: Ledger,
  tuning: Tuning,
): Readonly<{ game: Game; events: ReadonlyArray<StepEvent> }> => {
  if (game.sandbox || game.stage < CERT_FROM_STAGE) return { game, events: [] }
  const life = certLifeOf(game, tuning)
  const managed = certManaged(game)
  let changed = false
  const nodes = game.nodes.map((node) => {
    if (!TLS_TERMINATORS.includes(node.type) || !managed) return node
    if (node.certUntil !== null && game.time < node.certUntil - life * (1 - CERT_RENEW)) return node
    changed = true
    return { ...node, certUntil: game.time + life }
  })
  const next = changed ? { ...game, nodes } : game
  if (!certNodes(next).some((node) => certExpired(next, node)) || next.incident)
    return { game: next, events: [] }
  const started = startIncident(next, ledger, 'certificate', 0)
  return started
    ? { game: started.game, events: [StepEvent.IncidentStarted({ incident: started.incident })] }
    : { game: next, events: [] }
}

const advanceLinks = (game: Game, ledger: Ledger, seconds: number): ReadonlyArray<GameLink> => {
  const links = game.links.map((link, index) => {
    if (isOpen(link.fuse)) {
      const fuse = breakerStep(link.fuse, { _tag: 'ClosedAt', at: game.time + seconds })
      return { ...link, fuse, failure: isOpen(fuse) ? link.failure : 0 }
    }
    const measured = ledger.links[index]?.failure ?? 0
    const source = game.nodes.find((node) => node.id === link.from)
    const watched =
      (link.breaker && has(game, 'circuit-breakers')) ||
      (source !== undefined && meshOf(game, source))
    if (watched && measured > BREAKER_THRESHOLD)
      return {
        ...link,
        fuse: breakerStep(link.fuse, {
          _tag: 'Tripped',
          until: game.time + seconds + BREAKER_OPEN,
        }),
        failure: 0,
      }
    return measured === link.failure ? link : { ...link, failure: measured }
  })
  return links.every((link, index) => link === game.links[index]) ? game.links : links
}

export const ignored = (game: Game, rule: AlertRule): boolean =>
  game.falseAlarms[rule] >= ALERT_FATIGUE

const advanceAlarms = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  events: Array<StepEvent>,
): Readonly<{ alarms: Alarms; falseAlarms: FalseAlarms }> => {
  const rules = game.alertRules
  const slowest = Object.entries(ledger.kinds).some(
    ([kind, entry]) => entry.p99 > rules.latency * PROFILES[kind as keyof typeof PROFILES].apdex,
  )
  const hottest = Math.max(
    0,
    ...game.nodes
      .filter((node) => node.type !== 'users' && node.type !== 'analytics')
      .map((node) => ledger.nodes[node.id]?.utilization ?? 0),
  )
  const oldest = Math.max(
    0,
    ...game.nodes.map((node) => (node.type === 'queue' ? (ledger.nodes[node.id]?.age ?? 0) : 0)),
  )
  const burning = burnRateOf(game, ledger) > rules.budget
  const next: Alarms = {
    errors: ledger.errorShare > rules.errors ? game.alarms.errors + seconds : 0,
    latency: slowest ? game.alarms.latency + seconds : 0,
    saturation: hottest > rules.saturation ? game.alarms.saturation + seconds : 0,
    queue: oldest > rules.queue ? game.alarms.queue + seconds : 0,
    budget: burning ? game.alarms.budget + seconds : 0,
  }
  const day = Math.floor(calendarMinute(game.time) / CALENDAR_DAY)
  const fresh = day !== game.falseAlarms.day
  const counts: Record<AlertRule, number> = {
    errors: game.falseAlarms.errors,
    latency: game.falseAlarms.latency,
    saturation: game.falseAlarms.saturation,
    queue: game.falseAlarms.queue,
    budget: game.falseAlarms.budget,
  }
  for (const rule of ['errors', 'latency', 'saturation', 'queue', 'budget'] as const) {
    if (fresh && counts[rule] < ALERT_FATIGUE) counts[rule] = 0
    if (!has(game, 'alerting')) continue
    const limit =
      ALERT_RULES[rule].seconds * (has(game, 'anomaly-detection') ? ANOMALY_DETECTION_HOLD : 1)
    if (game.alarms[rule] >= limit || next[rule] < limit) continue
    if (ignored(game, rule)) continue
    events.push(StepEvent.AlertFired({ rule }))
    if (!game.incident) {
      counts[rule] += 1
      if (counts[rule] === ALERT_FATIGUE) events.push(StepEvent.AlertIgnored({ rule }))
    }
  }
  return { alarms: next, falseAlarms: { day, ...counts } }
}

export const step = (game: Game, seconds: number, tuning: Tuning = LIVE_TUNING): StepResult => {
  const ledger = solveFlow(game)
  const events: Array<StepEvent> = []

  const earned = ledger.revenue * seconds
  let cash = game.cash
  let pending = game.pending
  let spilled = game.spilled
  if (game.sandbox) {
  } else if (has(game, 'stripe')) {
    cash += earned
  } else {
    const room = Math.max(0, drawerSize(game, ledger.revenue) - pending)
    if (room > 0 && earned >= room) events.push(StepEvent.DrawerFull())
    pending += Math.min(room, earned)
    spilled += Math.max(0, earned - room)
  }
  if (!game.sandbox) cash -= (ledger.burn + slaCreditsOf(game, ledger) + ledger.fines) * seconds

  const nodes = game.nodes.map((node) => advanceNode(game, node, ledger, seconds, events))
  const puts = game.nodes.reduce(
    (total, node) =>
      node.type === 'storage' ? total + (ledger.nodes[node.id]?.inbound ?? 0) : total,
    0,
  )
  const rows = game.nodes.reduce((sum, node) => {
    const own = ledger.nodes[node.id]?.traffic
    if (!own) return sum
    const writes = node.type === 'database' || node.type === 'wide' ? (own['q-write'] ?? 0) : 0
    const messages = node.type === 'ws' ? (own.rt ?? 0) : 0
    return sum + writes + messages
  }, 0)
  const added = ((rows * ROW_KB) / 1_000_000) * seconds
  const windows = game.nodes
    .filter((node) => node.type === 'database')
    .map((node) => DB_RETENTIONS[node.keep].days)
  const keptDays =
    windows.length === 0 || windows.some((days) => days === 0) ? 0 : Math.max(...windows)
  const kept =
    keptDays > 0 ? ((rows * ROW_KB) / 1_000_000) * keptDays * 1_440 : Number.POSITIVE_INFINITY
  const data = Math.min(kept, game.data + added)
  const { users, userShares, steady } = grow(game, ledger, seconds, tuning.pace)
  const apdex = game.apdex + (ledger.apdex - game.apdex) * Math.min(1, seconds / APDEX_WINDOW)
  const time = Math.round((game.time + seconds) * 1e6) / 1e6
  const { alarms, falseAlarms } = advanceAlarms(game, ledger, seconds, events)

  const firsts = REQUEST_KINDS.filter(
    (kind) =>
      PROFILES[kind].scored &&
      !game.servedKinds.includes(kind) &&
      (ledger.kinds[kind]?.success ?? 0) > 0.5,
  )

  const crossedSecond = Math.floor(time) > Math.floor(game.time)
  const sample: Sample = {
    users: game.users,
    demand: ledger.demand,
    served: ledger.served,
    revenue: ledger.revenue,
    burn: ledger.burn,
    cash,
    latency: ledger.latency,
    p99: ledger.p99,
    apdex: ledger.apdex,
    errors: ledger.errorShare,
    device: has(game, 'rum') ? ledger.deviceLatency : NO_DEVICE_LATENCY,
    slow: slowestKind(ledger),
  }

  const chaotic = chaosRunning(game)
  const pools = accrue(game, ledger, seconds, firsts, FIRST_KIND_INSIGHT)
  let next: Game = {
    ...game,
    nodes,
    links: advanceLinks(game, ledger, seconds),
    cash,
    pending,
    spilled,
    users,
    userShares,
    steady,
    peak: Math.max(game.peak, users),
    apdex,
    regionApdex: regionApdexAfter(game, ledger, seconds),
    alarms,
    falseAlarms,
    insight: 0,
    pools: {
      ...pools,
      failure:
        pools.failure +
        (chaotic ? CHAOS_INSIGHT * seconds : 0) +
        (game.time < game.loadTestUntil ? LOAD_TEST_INSIGHT * seconds : 0) +
        (game.drill?._tag === 'Running' ? DRILL_INSIGHT * seconds : 0),
    },
    weakest: game.chaos
      ? (game.nodes
          .filter((node) => COMPONENTS[node.type].limiting && !isDown(node))
          .map((node) => [node.id, ledger.nodes[node.id]?.utilization ?? 0] as const)
          .toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? game.weakest)
      : null,
    servedKinds: firsts.length > 0 ? [...game.servedKinds, ...firsts] : game.servedKinds,
    stored: puts > 0 ? game.stored + (puts * UPLOAD_MB * seconds) / 1_000 : game.stored,
    data,
    uploads: (puts * UPLOAD_MB) / 1_000,
    budget: recordBudget(game, ledger, seconds),
    drill: advanceDrill({ ...game, time }, ledger),
    quarter: advanceQuarter({ ...game, time }, ledger),
    time,
    earned: game.earned + earned,
    history: crossedSecond ? [...game.history, sample].slice(-HISTORY) : game.history,
  }

  next = markSignal(next, ledger)
  const running = advanceIncident(next, ledger, seconds)
  next = running.game
  events.push(...running.events)
  next = advanceStudies(next, ledger, seconds, events)
  next = advanceMirrors(next)
  if (canRaise(next) && next.round._tag !== 'Offered')
    next = { ...next, round: roundStep(next.round, { _tag: 'Offered' }) }
  const team = advanceTeam(next, ledger, seconds, tuning)
  next = team.game
  events.push(...team.events)
  next = advanceCves(next, ledger, seconds, events)
  const certificates = advanceCertificate(next, ledger, tuning)
  next = certificates.game
  events.push(...certificates.events)
  const directed = directIncidents(next, ledger, tuning.incidentGap)
  next = directed.game
  events.push(...directed.events)
  const lastWeek = Math.floor(calendarMinute(game.time) / QUARTER_SECONDS)
  const thisWeek = Math.floor(calendarMinute(time) / QUARTER_SECONDS)
  if (has(next, 'pen-testing') && thisWeek > lastWeek) {
    const revealed = pentestWeakness(next, ledger)
    if (revealed && !next.openActions.includes(revealed))
      next = { ...next, openActions: [...next.openActions, revealed] }
  }
  next = advanceFeatures(next, ledger.demand, seconds, tuning)
  next = advanceMorale(next, game, seconds, tuning, events)
  const lost = lostOnCrash(next, game.time, seconds) + lostOnBroker(game, game.time, seconds)
  if (lost > 0)
    next = {
      ...next,
      budget: spendBudget(next, lost),
      incident: next.incident ? { ...next.incident, failed: next.incident.failed + lost } : null,
    }

  next = applyPolicies(next, ledger)

  next = advanceRunway(next, ledger)

  if (sameItems(game.nodes, next.nodes)) next = { ...next, nodes: game.nodes }

  if (solveHolds(game, next, events)) carryLedger(game, next)
  return { game: next, ledger, events }
}

const sameItems = <Item>(before: ReadonlyArray<Item>, after: ReadonlyArray<Item>): boolean => {
  if (before === after) return true
  if (before.length !== after.length) return false
  for (let index = 0; index < before.length; index += 1)
    if (before[index] !== after[index]) return false
  return true
}

const solveHolds = (before: Game, after: Game, events: ReadonlyArray<StepEvent>): boolean =>
  events.length === 0 &&
  Math.floor(after.time) === Math.floor(before.time) &&
  after.stage === before.stage &&
  sameIncident(before.incident, after.incident) &&
  after.nodes.length === before.nodes.length &&
  after.links.length === before.links.length &&
  after.nodes.every((node, index) => {
    const was = before.nodes[index]
    return (
      was !== undefined &&
      node.life._tag === 'Running' &&
      was.life._tag === 'Running' &&
      node.scaler._tag === 'Steady' &&
      node.replicas === was.replicas
    )
  })

const INCIDENT_TALLIES: ReadonlySet<string> = new Set([
  'remaining',
  'impaired',
  'lostRevenue',
  'failed',
])

const sameIncident = (before: Game['incident'], after: Game['incident']): boolean => {
  if (before === after) return true
  if (before === null || after === null) return false
  const was: Readonly<Record<string, unknown>> = before
  const now: Readonly<Record<string, unknown>> = after
  const keys = new Set([...Object.keys(was), ...Object.keys(now)])
  for (const key of keys) if (!INCIDENT_TALLIES.has(key) && was[key] !== now[key]) return false
  return true
}
