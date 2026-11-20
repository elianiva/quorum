import { RUNNING, warming, withWarm } from './life.ts'
import { PROMOTE_DATA_LOSS } from './components/replica.ts'
import { step as roundStep } from './era-round-machine.ts'
import {
  type Action,
  Refusal,
  endIncident,
  answered,
  answering,
  no,
  notAllowed,
  ok,
  patch,
  spend,
  withNode,
} from './action-kit.ts'
import { Result } from 'effect'
import {
  ALERT_THRESHOLDS,
  CACHE_TTLS,
  CDN_TTLS,
  COMPONENTS,
  DOCK_GROUPS,
  DOCK_OF,
  STANDBY_TYPES,
  ZONES,
  rttOf,
  CREDIT_CAP,
  DRAIN_SECONDS,
  GOGC,
  DEFAULT_FPM_WORKERS,
  DNS_TTLS,
  ERAS,
  FIRST_INCIDENT_AFTER_SECONDS,
  FRAMEWORKS,
  KINDS,
  LANGUAGES,
  DELETE_CHURN,
  POOL_LIMITS,
  PRICING_FROM_STAGE,
  REQUEST_KINDS,
  RESEARCH,
  RUNTIMES,
  DATA_KINDS,
  MAX_STUDIES,
  RESERVED_SECONDS,
  SIZES,
  WARMED,
  type ComponentId,
  type FamilyId,
  type FrameworkId,
  type IncidentId,
  type Kind,
  type RequestKind,
  type ResearchId,
  type RuntimeId,
  HOME_REGION,
  OPEN_REGION_PRICE,
  REGION_INFO,
  REGIONS_FROM_STAGE,
  FAMILIES,
} from './catalog.ts'
import {
  frameworkReady,
  has,
  eraOf,
  dataGroupOf,
  certLifeOf,
  inCluster,
  isDown,
  isFinalEra,
  isUnlocked,
  maxSize,
  nextEra,
  owedOf,
  priceOf,
  pricingOf,
  refundOf,
  replacePrice,
  missingPrerequisites,
  needs,
  resizePrice,
  restarted,
  warmAfterRestart,
  runtimeReady,
  vcpuOf,
} from './lookups.ts'
import { nextOrdinal } from './labels.ts'
import { link } from './company.ts'
import { goGlobal, isGlobal, openRegions, survivesRegion } from './regions.ts'
import {
  alumniOf,
  dilutionOf,
  grantOf,
  perkLevel,
  placeRefusal,
  placedLife,
  retryRefusal,
  runtimeRefusal,
  ventureOf,
} from './founding.ts'
import { restoreSeconds, startIncident, zoned } from './director.ts'
import { IPO_BURN_SECONDS, PRE_IPO_STAGE, ipoReady, newDrill } from './ipo.ts'
import { firstQuarter, guidanceOpen } from './quarters.ts'
import { QuarterState, step as quarterStep } from './quarter-machine.ts'
import { activeIncident } from './state.ts'
import { currentStudy, queueStep, studyList, studyOf } from './study-machine.ts'
import { solveFlow } from './solve.ts'
import { boosterFor } from './research-team.ts'
import type { AlertRule } from './events.ts'
import { POLICY_LEVEL } from './catalog/legacy.ts'
import type {
  Policies,
  Collector,
  Game,
  GameLink,
  GameNode,
  PmMode,
  Pricing,
  Retries,
  Zone,
  Region,
  DbEngine,
  IopsClass,
} from './state.ts'
import { EMPTY_PARTS, FULL_PARTS } from './state.ts'
import { cpuInstallPrice, diskPartPrice, ramPartPrice, provisioned } from './parts.ts'

export { Refusal, describeRefusal, type Action } from './action-kit.ts'
export { setProvider, switchProvider } from './components/psp.rule.ts'
export { setSample, setRetention } from './components/analytics.rule.ts'
export { setRollout } from './components/ff.rule.ts'
export { setLogOptions } from './components/log.rule.ts'
export { setVecIndex } from './components/vec.rule.ts'
export { setDocOptions } from './components/doc.rule.ts'
export { setStoreVariant, setStorageClass, setLifecycle } from './components/storage.rule.ts'
export { setSearchOptions, setSearchRefresh } from './components/search.rule.ts'
export { setSync, promoteReplica } from './components/replica.rule.ts'
export {
  setBackup,
  rollRestore,
  runRestoreDrill,
  setMaterialized,
  setStorageIops,
  setShards,
  setShardKey,
  setDbRetention,
  setTopology,
  expandVolume,
} from './components/database.rule.ts'
export { setQuorum } from './components/wide.rule.ts'
export { setCompression, setShed, setDegrade, setRyw, setFanout } from './components/server.rule.ts'
export { setGpuType, setPrecision, setBatch, setGpuModel } from './components/gpu.rule.ts'
export { setAutoscaler } from './components/autoscaler.rule.ts'
export { setDeployStrategy } from './components/ci.rule.ts'
export { setHubOptions } from './components/ws.rule.ts'
export { setRateLimit, setGatewayBucket, setGatewayOptions } from './components/gw.rule.ts'
export { setParanoia, setUnderAttack, disableRule } from './components/waf.rule.ts'
export { setPoolerMode } from './components/pooler.rule.ts'
export { setCdnOptions } from './components/cdn.rule.ts'
export {
  setLbVariant,
  setPolicy,
  setSticky,
  setSlowStart,
  setHealthCheck,
} from './components/lb.rule.ts'
export { setCacheEngine, setCacheGuard, setCacheStrategy } from './components/cache.rule.ts'
export { setPrefetch } from './components/worker.rule.ts'
export { setDlq, setAttempts, setMaxLength, deleteMessage } from './components/queue.rule.ts'

export const sellAll = (game: Game, ids: ReadonlyArray<string>): Action => {
  let next = game
  let refusal: Action = sell(game, '')
  for (const id of ids) {
    const sold = sell(next, id)
    if (Result.isSuccess(sold)) next = sold.success
    else refusal = sold
  }
  return next === game ? refusal : Result.succeed(next)
}

export const shortOfCash = (game: Game): boolean => !game.sandbox && game.cash <= 0

const shortfall = (): Action =>
  notAllowed('Out of Cash: no placement, upgrade, or hire until Cash is above zero.')

const WIDE_COLUMN_REPLICAS = 3
const EVENT_STREAM_COPIES = 1

export const blankNode = (
  game: Game,
  id: string,
  type: ComponentId,
  x: number,
  y: number,
  region: Region = HOME_REGION,
): GameNode => {
  const stack = game.nodes.find((node) => node.type === 'server')
  return {
    id,
    type,
    ordinal: nextOrdinal(game, type),
    x: Math.round(x),
    y: Math.round(y),
    size: 1,
    family: 'general',
    parts: { ...FULL_PARTS },
    runtime: stack?.runtime ?? 'mod_php',
    framework: stack?.framework ?? 'none',
    workers: stack?.workers ?? DEFAULT_FPM_WORKERS,
    localDb: false,
    sample: 1,
    sampleRate: 0.1,
    retention: 900,
    life: COMPONENTS[type].coldStart ? warming(0) : RUNNING,
    credits: 0,
    leak: 0,
    service: { _tag: 'InService' },
    compress: stack?.compress ?? false,
    certUntil: null,
    recycle: stack?.recycle ?? false,
    authEdge: false,
    merge: false,
    downAt: 0,
    policy: 'weighted',
    variant: 'l7',
    sticky: false,
    slowStart: false,
    provider: 'first',
    purge: false,
    cacheKey: 'full',
    staleUntil: 0,
    earlyExpiry: false,
    swr: false,
    shardKey: 'hash',
    sync: false,
    searchVariant: 'elasticsearch',
    searchShards: 1,
    searchReplicas: 0,
    heap: 'half',
    storeVariant: 's3',
    burst: 0,
    checkEvery: 10,
    deepCheck: false,
    ttl: type === 'cache' ? 60 : 300,
    engine: 'redis',
    dbEngine: 'postgres',
    iops: 'general',
    shards: 1,
    storageClass: 'standard',
    crashes: 0,
    keep: 'keep',
    lifecycle: 0,
    cacheStrategy: 'aside',
    refresh: 1,
    restore: 'ok',
    pm: 'static',
    mode: 'transaction',
    depth: 0,
    dlq: false,
    attempts: 25,
    maxLength: 0,
    prefetch: 10,
    upgradedAt: game.time,
    coalesce: false,
    warming: false,
    paranoia: 2,
    underAttack: false,
    rateLimit: 0,
    strategy: 'rolling',
    presence: false,
    backoff: false,
    clustering: false,
    zone: 'a',
    standby: false,
    standbySync: true,
    pricing: 'on-demand',
    pricingUntil: null,
    replicas: 1,
    scaler: { _tag: 'Steady' },
    scaledAt: 0,
    signal: 'cpu',
    target: 0.6,
    minCopies: 1,
    maxCopies: 8,
    gpu: 't4',
    precision: 'fp16',
    gpuModel: 'medium',
    batch: 1,
    collector: 'g1',
    gogc: 100,
    shed: false,
    degrade: false,
    schedule: false,
    materialized: false,
    ryw: false,
    region,
    n: type === 'log' ? EVENT_STREAM_COPIES : WIDE_COLUMN_REPLICAS,
    r: 1,
    w: 1,
    lost: 0,
    spread: false,
    backup: 'none',
    fanout: 'pull',
    split: false,
    transactions: false,
    indexType: 'exact',
    partitions: 3,
    acks: 'all',
    retain: 3_600,
    keyed: true,
    topology: 'single',
  }
}

export const place = (
  game: Game,
  type: ComponentId,
  x: number,
  y: number,
  region: Region = HOME_REGION,
): Action => {
  const def = COMPONENTS[type]
  if (def.fixed) return notAllowed(`${def.name} cannot be placed.`)
  if (shortOfCash(game)) return shortfall()
  if (!isUnlocked(game, type) && def.unlock)
    return no(Refusal.Locked({ what: def.name, research: RESEARCH[def.unlock].name }))
  const banned = placeRefusal(game, type, region)
  if (banned) return notAllowed(banned)
  if (!openRegions(game).includes(region)) return notAllowed('Open that region first.')
  const node = blankNode(game, `n${game.nextId}`, type, x, y, region)
  const parts =
    (type === 'server' || type === 'database') && !game.fixedMix
      ? { ...EMPTY_PARTS }
      : { ...FULL_PARTS }
  return spend(game, priceOf(game, type), def.name, (paid) => ({
    ...paid,
    nextId: paid.nextId + 1,
    nodes: [...paid.nodes, { ...node, parts, life: placedLife(paid, node) }],
  }))
}

export const placeBox = (game: Game, chosen: ReadonlyArray<string>, name?: string): Game => {
  const number =
    game.boxes.reduce((most, box) => Math.max(most, Number(box.id.slice(3)) || 0), 0) + 1
  const kept = game.boxes
    .map((box) => ({ ...box, nodes: box.nodes.filter((id) => !chosen.includes(id)) }))
    .filter((box) => box.nodes.length >= 2)
  const docks = new Set(
    chosen.flatMap((id) => {
      const node = game.nodes.find((entry) => entry.id === id)
      return node ? [DOCK_OF[node.type]] : []
    }),
  )
  const dock = docks.size === 1 ? [...docks][0] : null
  const shared = dock ? DOCK_GROUPS.find((group) => group.key === dock)?.label : null
  const databases = game.nodes.filter(
    (node) => node.type === 'database' && chosen.includes(node.id),
  )
  const sharded = databases.length > 1 && databases.every((node) => node.topology === 'single')
  return {
    ...game,
    ...(sharded
      ? {
          nodes: game.nodes.map((node) =>
            databases.some((database) => database.id === node.id)
              ? { ...node, topology: 'sharded' as const }
              : node,
          ),
        }
      : {}),
    boxes: [
      ...kept,
      { id: `box${number}`, name: name ?? shared ?? `Box ${number}`, nodes: chosen },
    ],
  }
}

export const boxNodes = (game: Game, ids: ReadonlyArray<string>): Action => {
  const chosen = ids.filter((id) => game.nodes.some((node) => node.id === id))
  if (chosen.length < 2) return notAllowed('Select two or more Nodes to box.')
  return ok(placeBox(game, chosen))
}

export const unboxNodes = (game: Game, ids: ReadonlyArray<string>): Action => {
  const boxes = game.boxes.filter((box) => !box.nodes.some((id) => ids.includes(id)))
  return boxes.length === game.boxes.length
    ? notAllowed('No box holds these Nodes.')
    : ok({ ...game, boxes })
}

export const sell = (game: Game, id: string): Action =>
  withNode(game, id, (node) =>
    COMPONENTS[node.type].fixed
      ? notAllowed(`${COMPONENTS[node.type].name} stays.`)
      : ok({
          ...game,
          cash: game.cash + refundOf(game, node) - owedOf(game, node),
          nodes: game.nodes.filter((entry) => entry.id !== id),
          links: game.links.filter((link) => link.from !== id && link.to !== id),
        }),
  )

export const move = (game: Game, id: string, x: number, y: number): Game =>
  patch(game, id, { x: Math.round(x), y: Math.round(y) })

const emitsOf = (node: GameNode): ReadonlyArray<Kind> => COMPONENTS[node.type].sends

const relays = (from: GameNode, to: GameNode, kind: Kind): boolean =>
  !(DATA_KINDS as ReadonlyArray<Kind>).includes(kind) ||
  [from, to].every((node) => node.type !== 'lb' || node.variant === 'l4')

const reaches = (links: ReadonlyArray<GameLink>, from: string, to: string): boolean => {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length > 0) {
    const at = stack.pop() as string
    if (at === to) return true
    if (seen.has(at)) continue
    seen.add(at)
    for (const link of links) if (link.from === at) stack.push(link.to)
  }
  return false
}

const kindList = (kinds: ReadonlyArray<Kind>): string =>
  kinds.map((kind) => KINDS[kind].label.toLowerCase()).join(', ')

const DATASET_KINDS: ReadonlyArray<Kind> = ['q-read', 'q-write', 'q-tx']
const DATASET_STORES: ReadonlyArray<ComponentId> = ['database', 'doc', 'wide', 'dsql', 'replica']

export const connect = (game: Game, from: string, to: string): Action => {
  const source = game.nodes.find((node) => node.id === from)
  const target = game.nodes.find((node) => node.id === to)
  if (!source || !target || from === to) return notAllowed('Link two different Nodes.')
  const sourceDef = COMPONENTS[source.type]
  const targetDef = COMPONENTS[target.type]
  if (game.links.some((link) => link.from === from && link.to === to))
    return notAllowed('Already linked.')
  if (source.type === 'server' && target.type === 'worker')
    return notAllowed(
      'A Worker takes tasks from a Queue or an Event Stream. Link the App Server into one first.',
    )
  if ((source.type === 'fn' || source.type === 'edge') && targetDef.accepts.includes('task'))
    return notAllowed(
      'Only an App Server hands work to a Queue. A Function or Edge Function runs its work inline.',
    )
  if (targetDef.control) {
    if (source.type !== 'server' && source.type !== 'worker')
      return notAllowed(`Link App Servers or Workers into the ${targetDef.name}.`)
    const taken = game.links.some(
      (entry) =>
        entry.from === from &&
        game.nodes.some((node) => node.id === entry.to && node.type === target.type),
    )
    if (taken) return notAllowed(`${sourceDef.name} already has a ${targetDef.name}.`)
    if (target.type === 'mesh' && !inCluster(game, source))
      return notAllowed(
        `Link ${sourceDef.name} into a Kubernetes Cluster first: the sidecar rides in its pod.`,
      )
    return ok({ ...game, links: [...game.links, link(from, to)] })
  }
  if (target.type === 'replica' && source.type === 'database') {
    if (
      game.links.some(
        (entry) =>
          entry.to === to && game.nodes.some((n) => n.id === entry.from && n.type === 'database'),
      )
    )
      return notAllowed('A Read Replica copies one Database.')
    return ok({ ...game, links: [...game.links, link(from, to)] })
  }
  if (targetDef.mirror) {
    if (source.type !== 'database')
      return notAllowed(`Link a Database into the ${targetDef.name}: it reads its write log.`)
    if (game.links.some((entry) => entry.from === from && entry.to === to))
      return notAllowed('Already linked.')
    return ok({ ...game, links: [...game.links, link(from, to)] })
  }
  if (targetDef.tap) {
    if (sourceDef.tap || source.type === 'payments')
      return notAllowed(`${sourceDef.name} has no traffic to sample.`)
    return ok({ ...game, links: [...game.links, link(from, to)] })
  }
  if (source.type === 'database' && (target.type === 'database' || target.type === 'replica'))
    return notAllowed(
      target.type === 'replica'
        ? 'A Read Replica copies its primary automatically. Link App Servers to the replica to send reads there.'
        : 'Databases do not link to each other. The topology decides how they share rows. Link App Servers to each Database.',
    )
  if (sourceDef.maxOut === 0 || emitsOf(source).length === 0)
    return notAllowed(`${sourceDef.name} sends nothing on. Link it into Analytics to sample it.`)
  if (targetDef.accepts.length === 0) return notAllowed(`${targetDef.name} has no input.`)
  const carried = emitsOf(source).filter(
    (kind) => targetDef.accepts.includes(kind) && relays(source, target, kind),
  )
  if (carried.length === 0 && emitsOf(source).some((kind) => targetDef.accepts.includes(kind)))
    return notAllowed('An L7 Load Balancer reads HTTP. Switch it to L4 to balance queries.')
  if (carried.length === 0)
    return notAllowed(
      `${targetDef.name} takes ${kindList(targetDef.accepts)}. ${sourceDef.name} sends ${kindList(emitsOf(source))}.`,
    )
  if (
    DATASET_STORES.includes(target.type) &&
    carried.some((kind) => DATASET_KINDS.includes(kind))
  ) {
    const group = dataGroupOf(game, target)
    const other = game.links
      .filter((link) => link.from === from && link.to !== to)
      .map((link) => game.nodes.find((node) => node.id === link.to))
      .find(
        (node) =>
          node !== undefined &&
          DATASET_STORES.includes(node.type) &&
          dataGroupOf(game, node) !== group,
      )
    if (other)
      return notAllowed(
        'One caller reads one Data Group. Box the Databases into one group, or route a second store through an API Gateway and its own App Server.',
      )
  }
  const routing = game.links.filter((link) => {
    const end = game.nodes.find((node) => node.id === link.to)
    return link.from === from && end && !COMPONENTS[end.type].tap
  })
  if (routing.length >= sourceDef.maxOut)
    return notAllowed(
      source.type === 'users'
        ? 'A domain resolves to one host. Put DNS or a Load Balancer in front to reach more.'
        : source.type === 'pooler'
          ? 'A Connection Pooler pools to one host. Put a Load Balancer after it to reach more.'
          : `${sourceDef.name} takes ${sourceDef.maxOut} links.`,
    )
  if (reaches(game.links, to, from)) return notAllowed('That link would make a loop.')
  const linked: Game = { ...game, links: [...game.links, link(from, to)] }
  return ok(
    source.localDb &&
      (target.type === 'database' || target.type === 'pooler' || target.type === 'cache')
      ? patch(linked, from, { localDb: false })
      : linked,
  )
}

export const LINK_TIMEOUTS = [1, 5, 30] as const

export const setLinkPolicy = (
  game: Game,
  from: string,
  to: string,
  change: Readonly<{
    timeout?: number
    retries?: Retries
    breaker?: boolean
    bulkhead?: boolean
    hedge?: boolean
  }>,
): Action => {
  const index = game.links.findIndex((entry) => entry.from === from && entry.to === to)
  const current = game.links[index]
  if (!current) return no(Refusal.Missing())
  if (!has(game, 'timeouts'))
    return no(Refusal.Locked({ what: 'Call policy', research: RESEARCH.timeouts.name }))
  if (change.retries === 'backoff' && !has(game, 'backoff-jitter'))
    return no(Refusal.Locked({ what: 'Backoff', research: RESEARCH['backoff-jitter'].name }))
  const banned = change.retries === undefined ? null : retryRefusal(game, change.retries)
  if (banned) return notAllowed(banned)
  if (change.breaker && !has(game, 'circuit-breakers'))
    return no(
      Refusal.Locked({ what: 'A circuit breaker', research: RESEARCH['circuit-breakers'].name }),
    )
  if (change.bulkhead && !has(game, 'bulkheads'))
    return no(Refusal.Locked({ what: 'A bulkhead', research: RESEARCH.bulkheads.name }))
  if (change.hedge && !has(game, 'hedged-requests'))
    return no(Refusal.Locked({ what: 'Hedging', research: RESEARCH['hedged-requests'].name }))
  if (
    change.timeout !== undefined &&
    !(LINK_TIMEOUTS as ReadonlyArray<number>).includes(change.timeout)
  )
    return notAllowed('A timeout is 1, 5, or 30 seconds.')
  const next = {
    ...current,
    ...change,
    failure: 0,
    fuse: change.breaker === false ? ({ _tag: 'Closed' } as const) : current.fuse,
  }
  return ok({ ...game, links: game.links.map((entry, at) => (at === index ? next : entry)) })
}

export const setLinkKinds = (
  game: Game,
  from: string,
  to: string,
  kinds: ReadonlyArray<RequestKind> | null,
): Action => {
  const index = game.links.findIndex((entry) => entry.from === from && entry.to === to)
  const current = game.links[index]
  const source = game.nodes.find((node) => node.id === from)
  if (!current || !source) return no(Refusal.Missing())
  if (source.type !== 'gw') return notAllowed('Only an API Gateway routes by request kind.')
  const next = { ...current, kinds: kinds && REQUEST_KINDS.filter((kind) => kinds.includes(kind)) }
  return ok({ ...game, links: game.links.map((entry, at) => (at === index ? next : entry)) })
}

export const disconnect = (game: Game, from: string, to: string): Game => ({
  ...game,
  links: game.links.filter((link) => !(link.from === from && link.to === to)),
})

const REBALANCE_TYPES: ReadonlyArray<ComponentId> = ['doc', 'wide', 'log']

export const resize = (game: Game, id: string, direction: 1 | -1): Action =>
  withNode(game, id, (node) => {
    const def = COMPONENTS[node.type]
    const lowest = def.sized ? 0 : 1
    if (def.sized && !provisioned(node))
      return notAllowed('Install the missing parts before changing the size.')
    const rebalances = !game.sandbox && REBALANCE_TYPES.includes(node.type) && !isDown(node)
    if (direction === -1) {
      if (node.size <= lowest) return notAllowed(`${def.name} is at its smallest size.`)
      return ok(
        patch(game, id, {
          size: node.size - 1,
          ...(rebalances ? { life: warming(0) } : def.sized ? restarted(node) : {}),
        }),
      )
    }
    const price = resizePrice(game, node)
    if (price === null || node.size >= maxSize(node))
      return notAllowed(`${def.name} is at its largest size.`)
    if (shortOfCash(game)) return shortfall()
    const label = def.sized
      ? `${SIZES[node.size + 1]?.name ?? 'Next size'}`
      : `Size ${node.size + 1}`
    return spend(game, price, label, (paid) =>
      patch(paid, id, {
        size: node.size + 1,
        ...(rebalances ? { life: warming(0) } : def.sized ? restarted(node) : {}),
      }),
    )
  })

export type UpgradeAllOutcome = Readonly<{
  readonly game: Game
  readonly upgraded: number
  readonly skipped: number
  readonly short: boolean
}>

export const upgradeAll = (
  game: Game,
  type: ComponentId,
  region?: Region,
): Result.Result<UpgradeAllOutcome, Refusal> => {
  const nodes = game.nodes.filter(
    (node) => node.type === type && (region === undefined || node.region === region),
  )
  if (nodes.length === 0) return Result.fail(Refusal.Missing())
  if (shortOfCash(game))
    return Result.fail(
      Refusal.NotAllowed({
        reason: 'Out of Cash: no placement, upgrade, or hire until Cash is above zero.',
      }),
    )
  let next = game
  let upgraded = 0
  let skipped = 0
  let short = false
  let price = 0
  for (const node of nodes) {
    const current = next.nodes.find((entry) => entry.id === node.id)
    if (!current) continue
    if (current.size >= maxSize(current)) {
      skipped += 1
      continue
    }
    const step = resize(next, node.id, 1)
    if (Result.isFailure(step)) {
      if (step.failure._tag === 'Unaffordable') price = step.failure.price
      short = true
      break
    }
    next = step.success
    upgraded += 1
  }
  if (upgraded === 0) {
    if (short)
      return Result.fail(Refusal.Unaffordable({ what: 'An upgrade', price, currency: 'cash' }))
    return Result.fail(
      Refusal.NotAllowed({ reason: `Every ${COMPONENTS[type].name} is at its largest size.` }),
    )
  }
  return Result.succeed({ game: next, upgraded, skipped, short })
}

export const setFamily = (game: Game, id: string, family: FamilyId): Action =>
  withNode(game, id, (node) => {
    if (!COMPONENTS[node.type].sized) return notAllowed('Only VMs have an instance family.')
    if (family === 'arm' && !has(game, 'arm-instances'))
      return no(
        Refusal.Locked({ what: FAMILIES.arm.name, research: RESEARCH['arm-instances'].name }),
      )
    if (node.family === family) return ok(game)
    const port =
      family === 'arm' && (node.type === 'server' || node.type === 'worker') && !game.sandbox
        ? LANGUAGES[RUNTIMES[node.runtime].language].armPortDh
        : 0
    if (game.devHours < port)
      return notAllowed(
        `Porting ${LANGUAGES[RUNTIMES[node.runtime].language].name} to ARM needs ${port} Dev Hours.`,
      )
    return ok({
      ...patch(game, id, {
        family,
        ...restarted(node),
        credits: family === 'burstable' ? (CREDIT_CAP * vcpuOf(node)) / 2 : 0,
      }),
      devHours: game.devHours - port,
    })
  })

const partNode = (node: GameNode): boolean => node.type === 'server' || node.type === 'database'

export const installCpu = (game: Game, id: string, size: number): Action =>
  withNode(game, id, (node) => {
    if (!partNode(node)) return notAllowed('Only an App Server or Database takes parts.')
    if (!Number.isInteger(size) || size < 0 || size >= SIZES.length)
      return notAllowed('That CPU does not exist.')
    if (node.parts.cpu && node.size === size) return ok(game)
    const price = game.sandbox ? 0 : cpuInstallPrice(game, node, size)
    return spend(game, price, `${SIZES[size]?.name ?? 'CPU'} CPU`, (paid) =>
      patch(paid, id, {
        size,
        parts: { ...node.parts, cpu: true },
        ...restarted(node),
      }),
    )
  })

export const installRam = (game: Game, id: string, family: FamilyId): Action =>
  withNode(game, id, (node) => {
    if (!partNode(node)) return notAllowed('Only an App Server or Database takes parts.')
    if (!node.parts.cpu) return notAllowed('Install a CPU before a memory kit.')
    if (family === 'arm' && !has(game, 'arm-instances'))
      return no(
        Refusal.Locked({ what: FAMILIES.arm.name, research: RESEARCH['arm-instances'].name }),
      )
    if (node.parts.ram && node.family === family) return ok(game)
    const price = game.sandbox ? 0 : ramPartPrice(game, family)
    return spend(game, price, `${FAMILIES[family].name} memory kit`, (paid) =>
      patch(paid, id, {
        family,
        parts: { ...node.parts, ram: true },
        ...restarted(node),
        credits: family === 'burstable' ? (CREDIT_CAP * vcpuOf(node)) / 2 : 0,
      }),
    )
  })

export const installDisk = (game: Game, id: string, iops: IopsClass): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database has a volume slot.')
    if (node.parts.disk && node.iops === iops) return ok(game)
    const price = game.sandbox ? 0 : diskPartPrice(game, iops)
    return spend(
      game,
      price,
      iops === 'provisioned' ? 'Provisioned IOPS' : 'General purpose',
      (paid) =>
        patch(paid, id, {
          iops,
          parts: { ...node.parts, disk: true },
        }),
    )
  })

const defaultWorkers = (node: GameNode, runtime: RuntimeId): number =>
  runtime === 'gunicorn' ? 2 * Math.max(1, Math.round(vcpuOf(node))) + 1 : DEFAULT_FPM_WORKERS

export const setRuntime = (game: Game, id: string, runtime: RuntimeId): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server' && node.type !== 'worker' && node.type !== 'ws')
      return notAllowed('Only App Servers, Workers and Realtime Hubs run a Stack.')
    const def = RUNTIMES[runtime]
    if (!runtimeReady(game, runtime) && def.research)
      return no(Refusal.Locked({ what: def.name, research: RESEARCH[def.research].name }))
    const banned = runtimeRefusal(game, runtime)
    if (banned) return notAllowed(banned)
    if (node.runtime === runtime) return ok(game)
    const framework = FRAMEWORKS[node.framework].language === def.language ? node.framework : 'none'
    return ok(
      patch(game, id, {
        runtime,
        framework,
        workers: def.pool ? defaultWorkers(node, runtime) : node.workers,
        ...restarted({ ...node, runtime }),
      }),
    )
  })

export const setFramework = (game: Game, id: string, framework: FrameworkId): Action =>
  withNode(game, id, (node) => {
    const def = FRAMEWORKS[framework]
    const research = def.language ? RESEARCH[`fw-${framework}` as ResearchId] : undefined
    if (!frameworkReady(game, framework) && research)
      return no(Refusal.Locked({ what: def.name, research: research.name }))
    if (def.language !== null && def.language !== RUNTIMES[node.runtime].language)
      return notAllowed(`${def.name} needs ${LANGUAGES[def.language].name}.`)
    if (node.framework === framework) return ok(game)
    return ok(patch(game, id, { framework, ...restarted(node) }))
  })

export const setWorkers = (game: Game, id: string, workers: number): Action =>
  withNode(game, id, (node) =>
    RUNTIMES[node.runtime].pool
      ? ok(
          patch(game, id, {
            workers: Math.round(Math.max(POOL_LIMITS.min, Math.min(POOL_LIMITS.max, workers))),
          }),
        )
      : notAllowed(`${RUNTIMES[node.runtime].name} sizes its own pool.`),
  )

export const setRecycle = (game: Game, id: string, recycle: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'server' && node.type !== 'worker')
      return notAllowed('Only App Servers and Workers recycle their processes.')
    if (!RUNTIMES[node.runtime].persistent)
      return notAllowed(
        `${RUNTIMES[node.runtime].name} starts every request clean: nothing to recycle.`,
      )
    return ok(node.recycle === recycle ? game : patch(game, id, { recycle, leak: 0 }))
  })

export const setTtl = (game: Game, id: string, ttl: number): Action =>
  withNode(game, id, (node) => {
    if (node.type === 'cache')
      return CACHE_TTLS.some((entry) => entry.ttl === ttl)
        ? ok(
            node.ttl === ttl
              ? game
              : patch(game, id, {
                  ttl,
                  life: withWarm(
                    node.life,
                    node.warming && has(game, 'cache-warming') ? WARMED : 0,
                  ),
                }),
          )
        : notAllowed('A cache TTL is 10 seconds, 1 minute, or 1 hour.')
    if (node.type === 'cdn')
      return CDN_TTLS.some((entry) => entry.ttl === ttl)
        ? ok(node.ttl === ttl ? game : patch(game, id, { ttl, life: withWarm(node.life, 0) }))
        : notAllowed('A CDN TTL is 1 minute, 5 minutes, or 1 hour.')
    if (node.type !== 'dns') return notAllowed('Only DNS, CDNs and Caches have a TTL.')
    if (!(DNS_TTLS as ReadonlyArray<number>).includes(ttl))
      return notAllowed('A TTL is 30 seconds, 5 minutes, or 1 hour.')
    if (!has(game, 'health-checks'))
      return no(Refusal.Locked({ what: 'TTL', research: RESEARCH['health-checks'].name }))
    return ok(patch(game, id, { ttl }))
  })

export const setPm = (game: Game, id: string, pm: PmMode): Action =>
  withNode(game, id, (node) =>
    (node.type === 'server' || node.type === 'worker') && node.runtime === 'php_fpm'
      ? ok(node.pm === pm ? game : patch(game, id, { pm }))
      : notAllowed('Only PHP-FPM has a process manager.'),
  )

export const setZone = (game: Game, id: string, zone: Zone): Action =>
  withNode(game, id, (node) => {
    if (!has(game, 'multi-az'))
      return no(Refusal.Locked({ what: 'Zones', research: RESEARCH['multi-az'].name }))
    if (!zoned(node)) return notAllowed(`${COMPONENTS[node.type].name} spans every zone.`)
    if (node.zone === zone) return ok(game)
    return ok(
      patch(game, id, {
        zone,
        ...(COMPONENTS[node.type].sized && !isDown(node) ? restarted(node) : {}),
      }),
    )
  })

export const setStandby = (game: Game, id: string, standby: boolean, sync = true): Action =>
  withNode(game, id, (node) => {
    if (!STANDBY_TYPES.includes(node.type))
      return notAllowed('Only a Database, Pooler, Cache, Search Engine, or Queue keeps a standby.')
    if (standby && !has(game, 'multi-az'))
      return no(Refusal.Locked({ what: 'A standby', research: RESEARCH['multi-az'].name }))
    if (standby && node.type === 'cache' && node.engine === 'memcached')
      return notAllowed('Memcached has no replication, so it cannot keep a standby.')
    if (node.standby === standby && node.standbySync === sync) return ok(game)
    return ok(patch(game, id, { standby, standbySync: sync }))
  })

export const setPricing = (game: Game, id: string, pricing: Pricing): Action =>
  withNode(game, id, (node) => {
    if (game.stage < PRICING_FROM_STAGE)
      return no(
        Refusal.TooEarly({
          what: 'A pricing model',
          era: ERAS[PRICING_FROM_STAGE]?.name ?? 'a later Era',
        }),
      )
    if (COMPONENTS[node.type].group !== 'compute')
      return notAllowed('Only compute Nodes have a pricing model.')
    if (!COMPONENTS[node.type].sized) return notAllowed('Only VMs have a pricing model.')
    if (pricing === 'reserved' && !has(game, 'reserved-instances'))
      return notAllowed('Reserved pricing needs research: Reserved instances.')
    if (pricing === 'spot' && !has(game, 'spot-instances'))
      return notAllowed('Spot pricing needs research: Spot instances.')
    const current = pricingOf(game, node)
    if (current === pricing) return ok(game)
    if (current === 'reserved')
      return notAllowed('A reserved Node stays reserved until its calendar week ends.')
    return ok(
      patch(game, id, {
        pricing,
        pricingUntil: pricing === 'reserved' ? game.time + RESERVED_SECONDS : null,
      }),
    )
  })

export const setCollector = (game: Game, id: string, collector: Collector): Action =>
  withNode(game, id, (node) => {
    if (RUNTIMES[node.runtime].language !== 'java')
      return notAllowed('Only Java runs a choice of collector.')
    if (collector === 'zgc' && !has(game, 'zgc'))
      return no(Refusal.Locked({ what: 'ZGC', research: RESEARCH.zgc.name }))
    if (node.collector === collector) return ok(game)
    return ok(patch(game, id, { collector, ...restarted(node) }))
  })

export const setGogc = (game: Game, id: string, gogc: number): Action =>
  withNode(game, id, (node) => {
    if (RUNTIMES[node.runtime].language !== 'go') return notAllowed('Only Go has GOGC.')
    if (!has(game, 'gogc-tuning'))
      return no(Refusal.Locked({ what: 'GOGC', research: RESEARCH['gogc-tuning'].name }))
    if (!GOGC.some((entry) => entry.gogc === gogc)) return notAllowed('GOGC is 50, 100 or 200.')
    return ok(node.gogc === gogc ? game : patch(game, id, { gogc }))
  })

export const setChaos = (game: Game, chaos: boolean): Action => {
  if (game.sandbox) return notAllowed('A Sandbox runs no experiments of its own.')
  if (chaos && !has(game, 'chaos-engineering'))
    return no(Refusal.Locked({ what: 'Chaos', research: RESEARCH['chaos-engineering'].name }))
  return ok(game.chaos === chaos ? game : { ...game, chaos, weakest: chaos ? game.weakest : null })
}

export const openRegion = (game: Game, region: Region): Action => {
  if (!has(game, 'multi-region'))
    return no(Refusal.Locked({ what: 'Regions', research: RESEARCH['multi-region'].name }))
  if (openRegions(game).includes(region)) return notAllowed('That region is open.')
  const home = game.nodes.find((node) => node.type === 'users')
  const id = `users-${region}`
  const users: GameNode = {
    ...blankNode(game, id, 'users', home?.x ?? 80, home?.y ?? 280, region),
    life: RUNNING,
  }
  return spend(
    game,
    game.sandbox ? 0 : Math.round(OPEN_REGION_PRICE * eraOf(game).costIndex),
    REGION_INFO[region].name,
    (paid) => ({ ...paid, nodes: [...paid.nodes, users] }),
  )
}

export const setRegion = (game: Game, id: string, region: Region): Action =>
  withNode(game, id, (node) => {
    if (COMPONENTS[node.type].fixed || isGlobal(node))
      return notAllowed(`${COMPONENTS[node.type].name} serves every region.`)
    if (!openRegions(game).includes(region)) return notAllowed('Open that region first.')
    if (node.region === region) return ok(game)
    return ok(
      patch(game, id, {
        region,
        ...(COMPONENTS[node.type].sized && !isDown(node) ? restarted(node) : {}),
      }),
    )
  })

export const setSpread = (game: Game, id: string, spread: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'wide' && node.type !== 'dsql')
      return notAllowed('Only a Wide-column Store or Distributed SQL spreads across regions.')
    if (spread && openRegions(game).length < 2) return notAllowed('Open a second region first.')
    return ok(node.spread === spread ? game : patch(game, id, { spread }))
  })

export const setDbEngine = (game: Game, id: string, dbEngine: DbEngine): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database picks an engine.')
    return ok({
      ...game,
      nodes: game.nodes.map((entry) =>
        entry.type === 'database' ? { ...entry, dbEngine } : entry,
      ),
    })
  })

export const setSplit = (game: Game, id: string, split: boolean): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'cache' && node.type !== 'wide')
      return notAllowed('Only a Cache or Wide-column Store splits keys.')
    if (split && !has(game, 'hybrid-fanout'))
      return no(Refusal.Locked({ what: 'Key splitting', research: RESEARCH['hybrid-fanout'].name }))
    return ok(node.split === split ? game : patch(game, id, { split }))
  })

export const rollBackRoutes = (game: Game): Action =>
  endIncident(game, 'bgp', 'No routing change to roll back.')

export const PHISH_CHURN_SHARE = 0.1

export const phished = (game: Game): Action => {
  if (game.sandbox) return notAllowed('A Sandbox has no credentials to leak.')
  if (has(game, 'secrets-management'))
    return notAllowed('The credentials live in the vault. The page has nothing to take.')
  if (activeIncident(game) !== null) return notAllowed('Wait for the incident to end.')
  const started = startIncident(game, solveFlow(game), 'credential-leak', 0)
  if (!started) return notAllowed('There is nothing left to leak.')
  return ok({
    ...started.game,
    users: Math.max(1, Math.floor(started.game.users * (1 - PHISH_CHURN_SHARE))),
  })
}

export const payFakeInvoice = (game: Game, amount: number): Action =>
  spend(game, amount, 'A fake invoice', (paid) => paid)

export const rollBackConfig = (game: Game): Action =>
  endIncident(game, 'config', 'No config push to roll back.')

export const fenceLeader = (game: Game): Action =>
  endIncident(game, 'partition', 'No partition to fence.')

export const runDrill = (game: Game): Action => {
  if (!has(game, 'dr-drills'))
    return no(Refusal.Locked({ what: 'The DR drill', research: RESEARCH['dr-drills'].name }))
  if (activeIncident(game) !== null) return notAllowed('Wait for the incident to end.')
  if (game.drill._tag === 'Running') return notAllowed('A drill is running.')
  const ledger = solveFlow(game)
  const started = startIncident(game, ledger, 'dr-drill', 0)
  if (!started) return notAllowed('Nothing runs in the home region.')
  return ok({ ...started.game, drill: newDrill(game, ledger) })
}

export const setGuidance = (game: Game, growth: number, margin: number): Action => {
  if (QuarterState.guards.NotStarted(game.quarter))
    return notAllowed('Guidance starts after the IPO.')
  if (!guidanceOpen(game)) return notAllowed('Guidance is set on the first day of a quarter.')
  if (![0, 1, 2].includes(growth) || ![0, 1, 2].includes(margin))
    return notAllowed('Pick a level for each.')
  return ok({
    ...game,
    quarter: quarterStep(game.quarter, { _tag: 'GuidanceSet', growth, margin }),
  })
}

export const cancelReport = (game: Game): Action =>
  endIncident(game, 'report-db', 'No report is scanning the Database.')

export const renewCertificate = (game: Game): Action =>
  activeIncident(game)?.kind === 'certificate'
    ? ok({
        ...game,
        incident: answered(game, { remaining: 0 }),
        nodes: game.nodes.map((node) =>
          node.certUntil === null ? node : { ...node, certUntil: game.time + certLifeOf(game) },
        ),
      })
    : notAllowed('No certificate has expired.')

export const cancelMigration = (game: Game): Action =>
  endIncident(game, 'migration-lock', 'No migration is locking a table.')

export const pinAndRedeploy = (game: Game): Action =>
  endIncident(game, 'supply-chain', 'No compromised dependency is deployed.')

export const restoreBackup = (game: Game): Action => {
  const incident = activeIncident(game)
  if (incident?.kind !== 'accidental-delete') return notAllowed('No table was deleted.')
  const target = game.nodes.find((node) => node.id === incident.nodeId)
  const good = target !== undefined && target.backup !== 'none' && target.restore !== 'failed'
  return ok({
    ...game,
    users: good ? game.users : Math.max(1, Math.floor(game.users * (1 - DELETE_CHURN))),
    incident: answered(game, {
      remaining: good
        ? Math.min(incident.remaining, restoreSeconds(game, target?.backup ?? 'none'))
        : 0,
    }),
  })
}

export const restartClocks = (game: Game): Action =>
  endIncident(game, 'leap-second', 'No clock has jumped.')

export const installBackdoor = (game: Game): Action => {
  if (game.sandbox) return notAllowed('A Sandbox has nothing to compromise.')
  if (has(game, 'dependency-scanning'))
    return notAllowed('Dependency scanning caught the dropper before it ran.')
  if (game.backdoorAt !== null) return notAllowed('The backdoor is already in.')
  return ok({ ...game, backdoorAt: game.time })
}

export const takeDiscount = (game: Game, id: ResearchId): Action => {
  if (game.sandbox) return notAllowed('A Sandbox has no vendors.')
  if (has(game, id)) return notAllowed(`${RESEARCH[id].name} is already yours.`)
  if (game.discounts.includes(id)) return notAllowed('You already took that demo.')
  return ok({ ...game, discounts: [...game.discounts, id] })
}

export const setPolicyOn = (game: Game, policy: keyof Policies, on: boolean): Action => {
  if (game.sandbox || perkLevel(game, 'autopilot') < POLICY_LEVEL[policy])
    return notAllowed('The Autopilot perk has not reached that policy.')
  return ok(
    game.policies[policy] === on ? game : { ...game, policies: { ...game.policies, [policy]: on } },
  )
}

export const setAlertRule = (game: Game, rule: AlertRule, threshold: number): Action => {
  if (!has(game, 'alerting'))
    return no(Refusal.Locked({ what: 'Alert rules', research: RESEARCH.alerting.name }))
  if (!(ALERT_THRESHOLDS[rule] as ReadonlyArray<number>).includes(threshold))
    return notAllowed('That threshold is not on offer.')
  if (game.alertRules[rule] === threshold) return ok(game)
  return ok({
    ...game,
    alertRules: { ...game.alertRules, [rule]: threshold },
    falseAlarms: { ...game.falseAlarms, [rule]: 0 },
  })
}

export const replace = (game: Game, id: string): Action =>
  withNode(game, id, (node) =>
    node.life._tag !== 'Stopped'
      ? notAllowed(`${COMPONENTS[node.type].name} has not failed.`)
      : spend(game, replacePrice(game, node), 'A replacement', (paid) =>
          patch(paid, id, restarted(node)),
        ),
  )

export const restartable = (node: GameNode): boolean => {
  const def = COMPONENTS[node.type]
  return !def.fixed && !def.control && !def.tap && !def.mirror && !isGlobal(node)
}

const RESTART_FIXES: ReadonlyArray<IncidentId> = [
  'stale-opcache',
  'bun-compat',
  'gevent-compat',
  'split-brain',
  'gc-storm',
]

export const restart = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    const name = COMPONENTS[node.type].name
    if (!restartable(node)) return notAllowed(`${name} has no process of yours to restart.`)
    if (node.life._tag === 'Stopped') return notAllowed(`${name} is down for good. Replace it.`)
    if (isDown(node)) return notAllowed('It is already restarting.')
    const restarting = patch(game, id, restarted(node))
    const incident = activeIncident(game)
    return ok(
      incident?.nodeId === id && RESTART_FIXES.includes(incident.kind)
        ? { ...restarting, incident: answered(game, { remaining: 0 }) }
        : restarting,
    )
  })

export const failOverZone = (game: Game): Action => {
  if (!has(game, 'multi-az'))
    return no(Refusal.Locked({ what: 'Failing over', research: RESEARCH['multi-az'].name }))
  const zone = activeIncident(game)?.kind === 'zone' ? activeIncident(game)?.zone : null
  if (zone === null) return notAllowed('No zone is down.')
  const standbys = game.nodes.filter((node) => node.zone === zone && node.standby && isDown(node))
  if (standbys.length === 0)
    return notAllowed('No Node in that zone has a standby to promote. Give one a standby first.')
  let next = game
  for (const node of standbys) {
    const promoted = failOver(next, node.id)
    if (Result.isFailure(promoted)) return promoted
    next = promoted.success
  }
  return ok(next)
}

const holdsState = (node: GameNode): boolean =>
  (COMPONENTS[node.type].group === 'data' && node.type !== 'cache' && node.type !== 'pooler') ||
  node.type === 'queue' ||
  node.type === 'log'

export const failOver = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (!has(game, 'multi-az'))
      return no(Refusal.Locked({ what: 'Failing over', research: RESEARCH['multi-az'].name }))
    const name = COMPONENTS[node.type].name
    if (!STANDBY_TYPES.includes(node.type))
      return notAllowed(`${name} keeps no standby. Copies of an App Server spread across zones.`)
    if (!node.standby) return notAllowed(`${name} has no standby. Give it one before a zone fails.`)
    if (!isDown(node)) return notAllowed(`${name} is serving: there is nothing to fail over.`)
    const out = activeIncident(game)?.zone ?? null
    const zone = ZONES.find((entry) => entry !== node.zone && entry !== out) ?? node.zone
    const loss = !node.standbySync && node.type === 'database' ? PROMOTE_DATA_LOSS : 0
    const promoted = patch({ ...game, data: game.data * (1 - loss) }, id, {
      life: warming(warmAfterRestart(node)),
      zone,
      standby: false,
    })
    return ok(activeIncident(game) !== null ? { ...promoted, incident: answering(game) } : promoted)
  })

export const failOverRegion = (game: Game): Action => {
  if (!has(game, 'multi-az'))
    return no(Refusal.Locked({ what: 'Failing over', research: RESEARCH['multi-az'].name }))
  const incident = activeIncident(game)
  if ((incident?.kind !== 'region' && incident?.kind !== 'dr-drill') || incident.region === null)
    return notAllowed('No region is down.')
  const out = incident.region
  const target = openRegions(game)
    .filter((region) => region !== out)
    .reduce<Region | undefined>(
      (best, region) => (!best || rttOf(out, region) < rttOf(out, best) ? region : best),
      undefined,
    )
  if (!target) return notAllowed('Open a second region first: there is nowhere to fail over to.')
  const moving = game.nodes.filter(
    (node) =>
      node.region === out &&
      isDown(node) &&
      !survivesRegion(game, node) &&
      !holdsState(node) &&
      !COMPONENTS[node.type].fixed,
  )
  if (moving.length === 0)
    return notAllowed('Nothing here can move: the data of the region stays until it is back.')
  const price = moving.reduce((sum, node) => sum + replacePrice(game, node), 0)
  return spend(game, price, 'Failing over', (paid) => ({
    ...paid,
    nodes: paid.nodes.map((node) =>
      moving.some((entry) => entry.id === node.id)
        ? { ...node, region: target, ...restarted(node) }
        : node,
    ),
    incident: activeIncident(paid) !== null ? answering(paid) : paid.incident,
  }))
}

export const throttleConnects = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    const incident = activeIncident(game)
    if (node.type !== 'ws') return notAllowed('Only a Realtime Hub takes connects.')
    if (incident?.kind !== 'reconnect' || incident.nodeId !== id)
      return notAllowed('No reconnect wave is hitting this Hub.')
    if (incident.throttled === true) return notAllowed('Its connects are already throttled.')
    return ok({ ...game, incident: answered(game, { throttled: true }) })
  })

const onLoop = (node: GameNode): boolean =>
  node.type === 'server' && RUNTIMES[node.runtime].blocking === 'loop'

const reachable = (game: Game, from: GameNode): ReadonlyArray<GameNode> => {
  const seen = new Set<string>([from.id])
  const found: Array<GameNode> = [from]
  const stack = game.links.filter((link) => link.from === from.id).map((link) => link.to)
  while (stack.length > 0) {
    const id = stack.pop() as string
    if (seen.has(id)) continue
    seen.add(id)
    const node = game.nodes.find((entry) => entry.id === id)
    if (!node) continue
    found.push(node)
    for (const link of game.links) if (link.from === id && !seen.has(link.to)) stack.push(link.to)
  }
  return found
}

export const moveKind = (game: Game): Action => {
  const incident = activeIncident(game)
  if (incident?.kind !== 'loop') return notAllowed('No event loop is blocked.')
  const gateways = game.nodes.filter(
    (node) => node.type === 'gw' && !isDown(node) && reachable(game, node).some(onLoop),
  )
  if (gateways.length === 0)
    return notAllowed('Put an API Gateway in front of the App Servers to route login elsewhere.')
  let links = game.links
  let routed = false
  for (const gateway of gateways) {
    const routes = links
      .filter((entry) => entry.from === gateway.id)
      .map((entry) => {
        const target = game.nodes.find((node) => node.id === entry.to)
        const below = target ? reachable(game, target) : []
        return {
          entry,
          loops: below.some(onLoop),
          answers: below.some((node) => node.type === 'server' || node.type === 'fn'),
        }
      })
    if (!routes.some((route) => route.loops)) continue
    if (!routes.some((route) => !route.loops && route.answers))
      return notAllowed(
        'Link the Gateway to a Service on a runtime without an event loop to route login there.',
      )
    routed = true
    const carried = (entry: GameLink, kind: RequestKind): boolean =>
      entry.kinds === null || entry.kinds.includes(kind)
    const keeps = new Map(
      routes.map((route) => [
        route.entry.to,
        route.loops
          ? REQUEST_KINDS.filter((kind) => kind !== 'login' && carried(route.entry, kind))
          : route.answers
            ? REQUEST_KINDS.filter((kind) => kind === 'login' || carried(route.entry, kind))
            : route.entry.kinds,
      ]),
    )
    links = links.map((entry) =>
      entry.from === gateway.id ? { ...entry, kinds: keeps.get(entry.to) ?? entry.kinds } : entry,
    )
  }
  if (!routed) return notAllowed('No event loop is behind an API Gateway.')
  return ok({ ...game, links, incident: answering(game) })
}

export const drain = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (!has(game, 'health-checks'))
      return no(
        Refusal.Locked({ what: 'Draining a Node', research: RESEARCH['health-checks'].name }),
      )
    if (node.service._tag === 'Shut') return notAllowed('It is shut down.')
    if (isDown(node)) return notAllowed('It is already down.')
    if (node.service._tag === 'Draining') return notAllowed('It is already draining.')
    const active = activeIncident(game)
    const incident =
      active?.nodeId === id
        ? answered(game, { remaining: Math.min(active.remaining, DRAIN_SECONDS) })
        : game.incident
    return ok({
      ...patch(game, id, { service: { _tag: 'Draining', since: game.time } }),
      incident,
    })
  })

export const acknowledge = (game: Game): Game =>
  activeIncident(game) === null ? game : { ...game, incident: answering(game) }

export const filePostmortem = (game: Game, id: number, take: boolean): Action => {
  const postmortem = game.postmortems.find((entry) => entry.id === id)
  if (!postmortem) return no(Refusal.Missing())
  const filed: Game = {
    ...game,
    postmortems: game.postmortems.filter((entry) => entry.id !== id),
  }
  const action = postmortem.action
  if (!take || !action || has(game, action)) return ok(filed)
  return study(filed, action, true)
}

const keepBooster = (before: Game, after: Game): Game => ({
  ...after,
  researchTeam: boosterFor(after, before.researchTeam, currentStudy(after.studies)?.id),
})

export const study = (game: Game, id: ResearchId, first = false): Action => {
  const entry = RESEARCH[id]
  if (has(game, id)) return notAllowed(`${entry.name} is already yours.`)
  const chain = [...missingPrerequisites(game, id), id]
  const era = Math.max(...chain.map((needed) => RESEARCH[needed].era))
  if (era > game.stage)
    return no(Refusal.TooEarly({ what: entry.name, era: ERAS[era]?.name ?? 'a later Era' }))
  const queued = new Map(studyList(game.studies).map((item) => [item.id, item]))
  if (!first && queued.has(id)) return notAllowed(`${entry.name} is in the queue.`)
  const fresh = chain.filter((needed) => !queued.has(needed)).length
  if (studyList(game.studies).length + fresh > MAX_STUDIES)
    return notAllowed(
      fresh > 1
        ? `The queue holds ${MAX_STUDIES} Studies, and ${entry.name} needs ${fresh} of them.`
        : `The queue holds ${MAX_STUDIES} Studies.`,
    )
  const items = chain.map(
    (needed) =>
      queued.get(needed) ?? { id: needed, phase: { _tag: 'Queued' as const, progress: 0 } },
  )
  const added = first ? items : items.filter((item) => !queued.has(item.id))
  return ok(
    keepBooster(game, {
      ...game,
      studies: queueStep(game.studies, { _tag: 'Added', studies: added, first }),
    }),
  )
}

export const moveStudyTo = (game: Game, id: ResearchId, index: number): Action => {
  const list = studyList(game.studies)
  const from = list.findIndex((item) => item.id === id)
  if (from === -1) return no(Refusal.Missing())
  const to = Math.max(0, Math.min(list.length - 1, Math.trunc(index)))
  if (to === from) return ok(game)
  const up = to < from
  const crossed = up ? list.slice(to, from).reverse() : list.slice(from + 1, to + 1)
  const blocker = crossed.find((item) => (up ? needs(id, item.id) : needs(item.id, id)))
  if (blocker) {
    const [before, after] = up ? [blocker.id, id] : [id, blocker.id]
    return notAllowed(`${RESEARCH[after].name} needs ${RESEARCH[before].name} first.`)
  }
  return ok(
    keepBooster(game, {
      ...game,
      studies: queueStep(game.studies, { _tag: 'Moved', id, to }),
    }),
  )
}

export const moveStudy = (game: Game, id: ResearchId, direction: 1 | -1): Action => {
  const index = studyList(game.studies).findIndex((item) => item.id === id)
  if (index === -1) return no(Refusal.Missing())
  return moveStudyTo(game, id, index + direction)
}

export const cancelStudy = (game: Game, id: ResearchId): Action => {
  if (!studyOf(game.studies, id)) return no(Refusal.Missing())
  const gone = new Set<ResearchId>(
    studyList(game.studies)
      .filter((item) => item.id === id || needs(item.id, id))
      .map((item) => item.id),
  )
  return ok(
    keepBooster(game, {
      ...game,
      studies: queueStep(game.studies, { _tag: 'Cancelled', ids: [...gone] }),
      backlog: game.backlog.filter(
        (item) => !(item.kind === 'spike' && gone.has(item.ref as ResearchId)),
      ),
    }),
  )
}

export const collect = (game: Game): Game => ({
  ...game,
  cash: game.cash + game.pending,
  pending: 0,
})

export const canRaise = (game: Game): boolean =>
  !game.sandbox &&
  !isFinalEra(game) &&
  game.users >= eraOf(game).raiseAt &&
  (game.stage !== PRE_IPO_STAGE || ipoReady(game, solveFlow(game)))

const advanceEra = (game: Game, raised: boolean, firstIncidentAfter: number): Action => {
  if (!canRaise(game)) {
    const era = eraOf(game)
    return notAllowed(
      game.stage === PRE_IPO_STAGE && game.users >= era.raiseAt
        ? 'Complete the IPO checklist first.'
        : `Reach ${era.raiseAt.toLocaleString('en-US')} users first.`,
    )
  }
  if (game.round._tag !== 'Offered') return notAllowed('No round is on the table.')
  const era = eraOf(game)
  const stage = game.stage + 1
  const bootstrapped = ventureOf(game).bootstrapped
  if (raised && bootstrapped && game.stage !== PRE_IPO_STAGE)
    return notAllowed('A bootstrapped Company takes no rounds.')
  const dilution = bootstrapped ? 0 : dilutionOf(game, era.dilution)
  if (game.stage === PRE_IPO_STAGE) {
    if (!raised) return notAllowed('The IPO cannot be declined.')
    const ledger = solveFlow(game)
    return ok({
      ...game,
      stage,
      stageAt: game.time,
      cash: game.cash + ledger.burn * IPO_BURN_SECONDS,
      equity: game.equity * (1 - dilution),
      round: roundStep(game.round, { _tag: 'Raised' }),
      quarter: firstQuarter(game, ledger.revenue),
    })
  }
  const alumni = stage === 1 ? alumniOf(game, perkLevel(game, 'alumni-network')) : []
  return ok({
    ...(stage === REGIONS_FROM_STAGE ? goGlobal(game) : game),
    stage,
    stageAt: game.time,
    cash: game.cash + (raised ? grantOf(game, era.grant) : 0),
    equity: raised ? game.equity * (1 - dilution) : game.equity,
    round: roundStep(game.round, { _tag: raised ? 'Raised' : 'Declined' }),
    nextIncidentAt: stage === 1 ? game.time + firstIncidentAfter : game.nextIncidentAt,
    engineers: alumni.length > 0 ? [...game.engineers, ...alumni] : game.engineers,
    workSeq: game.workSeq + alumni.length,
  })
}

export const raise = (game: Game, firstIncidentAfter = FIRST_INCIDENT_AFTER_SECONDS): Action =>
  advanceEra(game, true, firstIncidentAfter)

export const decline = (game: Game, firstIncidentAfter = FIRST_INCIDENT_AFTER_SECONDS): Action =>
  advanceEra(game, false, firstIncidentAfter)

export const offer = (game: Game) => {
  if (game.round._tag !== 'Offered') return null
  const next = nextEra(game)
  if (!next) return null
  const grant =
    game.stage === PRE_IPO_STAGE
      ? solveFlow(game).burn * IPO_BURN_SECONDS
      : grantOf(game, eraOf(game).grant)
  const dilution = ventureOf(game).bootstrapped ? 0 : dilutionOf(game, eraOf(game).dilution)
  return { era: next, grant, dilution, bootstrapped: ventureOf(game).bootstrapped }
}
