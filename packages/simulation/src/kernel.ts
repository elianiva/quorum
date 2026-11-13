import type { CostCause, CostLine, Limit, Receipt, WorkUnit } from './capacity.ts'
import * as S from './catalog.ts'
import type { Kind, RequestKind } from './catalog.ts'
import { ERROR_CAUSES } from './distribution.ts'
import {
  marketOf,
  mixOf,
  payloadFactor,
  queryFactor,
  subscriptionsOf,
  valueFactor,
} from './features.ts'
import { insightPerk, stealOf, ventureOf } from './founding.ts'
import type { Ledger, NodeLedger, NodeStatus, ServiceLedger } from './ledger.ts'
import { causeOf, warmOf } from './life.ts'
import {
  burnOf,
  burnSharesOf,
  clusterOf,
  dataGroupOf,
  databasesOfGroup,
  engineOf,
  eraOf,
  inCluster,
  isDown,
  meshOf,
  primaryOf,
  rampedOf,
  storageBands,
  storageRequestBurnOf,
  syncStalled,
  syncWaitMs,
  topologyOfGroup,
  usersOfGroup,
  zoneMs,
} from './lookups.ts'
import { isGlobal, userRoutes } from './regions.ts'
import { demandOf, forecastPeakOf } from './solve-demand.ts'
import {
  type Graph,
  delegates,
  edgeOf,
  graphOf,
  offloads,
  samplingMsOf,
  samplingOf,
} from './solve-graph.ts'
import type { Game } from './state.ts'
import {
  badDeployShareOf,
  blastService,
  buggy,
  dataStaffed,
  failsKind,
  payrollOf,
  serviceOf,
  serviceOfKind,
} from './team.ts'

/* ==========================================================================
   The solve runs in a WebAssembly kernel built from `kernel/` (Rust). This
   file is its host side: it writes a Game into the kernel's blocks and reads
   the Ledger back. The Simulation names no host globals, so each host
   instantiates the module itself and hands its exports to `installKernel`.

   The block ids and scalar slots mirror `kernel/src/abi.rs`, and the Ledger
   stream mirrors `kernel/src/wire.rs`. They change together; `installKernel`
   checks the scalar count, so a slot added on one side cannot drift.
   ========================================================================== */

/** What the solve calls on the kernel. */
type Exports = Readonly<{
  memory: Readonly<{ buffer: ArrayBuffer }>
  scalar_len: () => number
  node_field_len: () => number
  summary_len: () => number
  reserve: (block: number, length: number) => number
  ptr: (block: number) => number
  len: (block: number) => number
  design_set: (healthChecked: number, time: number) => number
  solve_run: (boost: number, passes: number, revenueOnly: number) => number
  bottleneck_run: (passes: number) => number
  forget_solve: () => number
}>

const FUNCTIONS = [
  'scalar_len',
  'node_field_len',
  'summary_len',
  'reserve',
  'ptr',
  'len',
  'design_set',
  'solve_run',
  'bottleneck_run',
  'forget_solve',
] as const

let kernel: Exports | null = null

/**
 * Hands the solve a kernel instance's exports. Every host calls it once at start, before the
 * first solve: `new WebAssembly.Instance(module).exports`.
 */
export const installKernel = (exports: Readonly<Record<string, unknown>>): void => {
  const memory = exports['memory']
  if (typeof memory !== 'object' || memory === null || !('buffer' in memory))
    throw new Error('The kernel exports no memory.')
  for (const name of FUNCTIONS)
    if (typeof exports[name] !== 'function') throw new Error(`The kernel exports no ${name}.`)
  // Checked above: the memory and every function the solve calls.
  const checked = exports as Exports
  if (checked.scalar_len() !== SCALARS)
    throw new Error(
      `The kernel has ${checked.scalar_len()} scalar slots; the host writes ${SCALARS}.`,
    )
  if (checked.node_field_len() !== NODE_FIELDS)
    throw new Error(
      `The kernel reads ${checked.node_field_len()} Node fields; the host writes ${NODE_FIELDS}.`,
    )
  kernel = checked
  converged = new WeakSet()
}

const installed = (): Exports => {
  if (kernel === null) throw new Error('No solve kernel is installed. Call installKernel first.')
  return kernel
}

const ALL: ReadonlyArray<Kind> = [...S.REQUEST_KINDS, ...S.BACKEND_KINDS]
const NK = ALL.length

/** Block ids, from `kernel/src/abi.rs`. */
const BLOCK = {
  scalars: 1,
  nodeFields: 2,
  edgeFields: 3,
  outStarts: 4,
  outEdges: 5,
  weights: 6,
  nominal: 7,
  sick: 8,
  demand: 9,
  intake: 10,
  latency: 11,
  payload: 12,
  probe: 13,
  routes: 14,
  value: 15,
  research: 16,
  query: 17,
  links: 18,
  kindService: 19,
  ledger: 23,
  summary: 24,
} as const

/** Scalar slots, from `kernel/src/abi.rs`. Slots the host leaves at 0 are listed too. */
const SLOT = {
  users: 0,
  seed: 1,
  time: 2,
  sandbox: 3,
  scenarioTasks: 4,
  incidentNode: 5,
  size: 6,
  workers: 7,
  replicas: 8,
  runtime: 9,
  framework: 10,
  family: 11,
  compress: 12,
  localDb: 13,
  leak: 14,
  credits: 15,
  prefetch: 16,
  pm: 17,
  gogc: 18,
  collector: 19,
  recycle: 20,
  warm: 21,
  down: 22,
  zone: 23,
  region: 24,
  dbEngine: 25,
  boost: 26,
  inflight: 27,
  sampling: 28,
  hashing: 29,
  delegated: 30,
  local: 31,
  offloaded: 32,
  worker: 33,
  pod: 34,
  mesh: 35,
  typeCode: 36,
  id: 37,
  incident: 38,
  shards: 39,
  shardKey: 40,
  iops: 41,
  keep: 42,
  topology: 43,
  depth: 44,
  connections: 45,
  usersInGroup: 46,
  serviceIndexes: 47,
  stage: 48,
  venture: 49,
  fixedMix: 50,
  scenarioDaily: 51,
  variant: 52,
  policy: 53,
  sticky: 54,
  fanout: 55,
  mode: 56,
  materialized: 57,
  sync: 58,
  ryw: 59,
  certUntil: 60,
  rateLimit: 61,
  burst: 62,
  maxLength: 63,
  dlq: 64,
  attempts: 65,
  blast: 66,
  buggy: 67,
  databasesInGroup: 68,
  syncStalled: 69,
  primary: 70,
  poisoned: 71,
  transactions: 72,
  samplingMs: 73,
  downOom: 74,
  fixes: 75,
  r2: 76,
  archived: 77,
  searchVariant: 78,
  searchShards: 79,
  heap: 80,
  searchReplicas: 81,
  refresh: 82,
  secondProvider: 83,
  gpu: 84,
  gpuModel: 85,
  precision: 86,
  batch: 87,
  quorumN: 88,
  quorumR: 89,
  quorumW: 90,
  lost: 91,
  spread: 92,
  dataStaffed: 93,
  cacheEngine: 94,
  ttl: 95,
  swr: 96,
  earlyExpiry: 97,
  coalesce: 98,
  cacheStrategy: 99,
  split: 100,
  paranoia: 101,
  underAttack: 102,
  incidentStarted: 103,
  incidentRegion: 104,
  chaosTarget: 105,
  ramped: 106,
  cluster: 107,
  deployShare: 108,
  deployKinds: 109,
  runtimeFailure: 110,
  indexType: 111,
  staleUntil: 112,
  cacheKey: 113,
  presence: 114,
  backoff: 115,
  clustering: 116,
  warming: 117,
  incidentThrottled: 118,
  partitions: 119,
  acks: 120,
  retain: 121,
  keyed: 122,
  authEdge: 123,
  merge: 124,
  shut: 125,
  data: 126,
  subscriptions: 127,
  sampleRate: 128,
  insightPerk: 129,
  burn: 130,
  retrieval: 131,
  storeGet: 132,
  storePut: 133,
  costIndex: 134,
  egressFactor: 135,
  salaries: 136,
  shareCompute: 137,
  shareData: 138,
  shareStorage: 139,
  shareObservability: 140,
  serviceCount: 141,
  syncWait: 142,
  iopsFactor: 143,
  steal: 144,
  shed: 145,
  degrade: 146,
} as const
const SCALARS = Object.keys(SLOT).length
const NODE_FIELDS = 12
const EDGE_FIELDS = 10

/** `SUMMARY_*` in `kernel/src/run.rs`. */
const SUMMARY_BOTTLENECK = 1

const MODES = ['session', 'transaction', 'statement']
const POLICIES = ['weighted', 'round-robin', 'least-conn', 'p2c', 'hash']
const RETRIES = ['none', 'naive', 'backoff']
const POOLING = ['static', 'dynamic', 'ondemand']
const COLLECTORS = ['g1', 'parallel', 'zgc']
const SHARD_KEYS = ['hash', 'range', 'tenant', 'region']
const IOPS = ['general', 'provisioned']
const RETENTION = ['keep', 'archive', 'delete']
const TOPOLOGY = ['single', 'multi', 'sharded']

/** The index of `value` in `list`, or 0 when it is not there. */
/** Each catalog list's or record's keys, as a map from name to position, built once. */
const positions = new WeakMap<object, ReadonlyMap<string, number>>()

/** `list.indexOf(value)`, or `Object.keys(record).indexOf(value)`, without the scan. */
const positionOf = (source: ReadonlyArray<string> | object, value: string): number => {
  let map = positions.get(source)
  if (!map) {
    const names: ReadonlyArray<string> = Array.isArray(source) ? source : Object.keys(source)
    const built = new Map<string, number>()
    names.forEach((name, index) => {
      if (!built.has(name)) built.set(name, index)
    })
    map = built
    positions.set(source, map)
  }
  return map.get(value) ?? -1
}

const indexIn = (source: ReadonlyArray<string> | object, value: string): number =>
  Math.max(0, positionOf(source, value))

/** The bit for `index`, as a number: exact up to 2⁵³, past the 32 bits `<<` keeps. */
const bit = (index: number): number => Number(1n << BigInt(index))

const kindMask = (kinds: ReadonlyArray<Kind>): number => {
  let mask = 0n
  for (const kind of kinds) {
    const index = positionOf(ALL, kind)
    if (index >= 0) mask |= 1n << BigInt(index)
  }
  return Number(mask)
}
const EVERY_KIND = Number((1n << BigInt(NK)) - 1n)

/** A view into the kernel's memory. Any call that grows memory detaches it, so take a fresh one. */
const view = <T>(
  exports: Exports,
  Type: new (buffer: ArrayBuffer, offset: number, length: number) => T,
  block: number,
  length: number,
): T => new Type(exports.memory.buffer, exports.ptr(block), length)

const reserve = (exports: Exports, block: number, length: number): void => {
  if (exports.reserve(block, length) !== 0) throw new Error(`The kernel refused block ${block}.`)
}

const fill = (exports: Exports, block: number, values: ArrayLike<number>): void => {
  reserve(exports, block, values.length)
  view(exports, Float64Array, block, values.length).set(values)
}

/** Sets every slot of a block to one value, in place, so nothing is allocated to copy in. */
const fillWith = (exports: Exports, block: number, length: number, value: number): void => {
  reserve(exports, block, length)
  view(exports, Float64Array, block, length).fill(value)
}

const fillInt = (exports: Exports, block: number, values: ArrayLike<number>): void => {
  reserve(exports, block, values.length)
  view(exports, Int32Array, block, values.length).set(values)
}

const fillBytes = (exports: Exports, block: number, values: ArrayLike<number>): void => {
  reserve(exports, block, values.length)
  view(exports, Uint8Array, block, values.length).set(values)
}

/** Writes the Design's blocks: its Nodes, Edges, adjacency, and Links. */
const writeDesign = (exports: Exports, game: Game, design: Graph): void => {
  const nodes = game.nodes.length
  const nodeFields = new Float64Array(nodes * NODE_FIELDS)
  game.nodes.forEach((node, index) => {
    const base = index * NODE_FIELDS
    nodeFields[base] = positionOf(S.COMPONENT_IDS, node.type)
    nodeFields[base + 1] = isDown(node) ? 1 : 0
    nodeFields[base + 2] = node.sticky ? 1 : 0
    nodeFields[base + 3] = indexIn(POLICIES, node.policy)
    nodeFields[base + 4] = node.ttl
    nodeFields[base + 5] = node.checkEvery
    nodeFields[base + 6] = node.deepCheck ? 1 : 0
    nodeFields[base + 7] = node.type === 'replica' ? 1 : 0
    nodeFields[base + 8] = node.type === 'replica' && primaryOf(game, node) !== undefined ? 1 : 0
    nodeFields[base + 9] = node.service._tag === 'Draining' ? 1 : 0
    // When it went down, and whether it was a planned restart, which drains first.
    nodeFields[base + 10] = node.downAt
    nodeFields[base + 11] = isDown(node) && causeOf(node.life) === 'restart' ? 1 : 0
  })

  const slotOf = design.at
  const edgeFields = new Float64Array(design.edges.length * EDGE_FIELDS)
  design.edges.forEach((edge, index) => {
    const base = index * EDGE_FIELDS
    edgeFields[base] = slotOf.get(edge.from.id) ?? -1
    edgeFields[base + 1] = edge.toAt
    edgeFields[base + 2] = edge.link.kinds ? kindMask(edge.link.kinds) : EVERY_KIND
    edgeFields[base + 3] = positionOf(RETRIES, edge.policy.retry)
    edgeFields[base + 4] = edge.policy.timeout
    edgeFields[base + 5] = edge.policy.open ? 1 : 0
    edgeFields[base + 6] = edge.policy.bulkhead ? 1 : 0
    edgeFields[base + 7] = edge.policy.hedge ? 1 : 0
    edgeFields[base + 8] = edge.link.failure
    // How the Edge's bytes leave their zone: 0 not at all, 1 to another zone, 2 to another region.
    const crossRegion =
      edge.from.region !== edge.to.region && !isGlobal(edge.from) && !isGlobal(edge.to)
    edgeFields[base + 9] = crossRegion ? 2 : zoneMs(edge.from, edge.to) > 0 ? 1 : 0
  })

  const starts = new Int32Array(nodes + 1)
  const outEdges: Array<number> = []
  game.nodes.forEach((node, index) => {
    starts[index] = outEdges.length
    for (const edge of design.out.get(node.id) ?? []) outEdges.push(edge.index)
  })
  starts[nodes] = outEdges.length

  // Each Link in Game order: its ends, the Edge that carries it or -1, and its breaker.
  const links = new Float64Array(game.links.length * 4)
  game.links.forEach((link, index) => {
    const edge = edgeOf(design, link.from, link.to)
    links.set(
      [
        slotOf.get(link.from) ?? -1,
        slotOf.get(link.to) ?? -1,
        edge ? edge.index : -1,
        link.breaker ? 1 : 0,
      ],
      index * 4,
    )
  })
  fill(exports, BLOCK.links, links)
  fill(exports, BLOCK.nodeFields, nodeFields)
  fill(exports, BLOCK.edgeFields, edgeFields)
  fillInt(exports, BLOCK.outStarts, starts)
  fillInt(exports, BLOCK.outEdges, outEdges)
  // The kernel probes each Node's capacity itself; these are the probe's starting points.
  fillWith(exports, BLOCK.weights, nodes, 1)
  fillWith(exports, BLOCK.nominal, nodes, 1)
  reserve(exports, BLOCK.sick, nodes)
  view(exports, Uint8Array, BLOCK.sick, nodes).fill(0)
}

/** Writes every Game-level block: the scalar rows, research, demand, intake, routes, and factors. */
const writeGame = (exports: Exports, game: Game, design: Graph): void => {
  const nodes = game.nodes.length
  const serviceIndexes = game.services.reduce((sum, service) => sum + service.indexes, 0)
  const serviceFixes = new Set(serviceOf(game).fixes)
  const fixes = S.FIXES.reduce(
    (bits, fix, index) => (serviceFixes.has(fix) ? bits + bit(index) : bits),
    0,
  )
  const venture = indexIn(S.VENTURE_IDS, game.founding?.venture ?? 'b2b-saas')
  // What the bill reads that the solve does not change.
  const costIndex = eraOf(game).costIndex
  const egressFactor = ventureOf(game).constraint.egress
  const salaries = payrollOf(game)
  const shares = burnSharesOf(game)
  const subscriptions = subscriptionsOf(game)
  const perk = insightPerk(game)
  const staffed = dataStaffed(game) ? 1 : 0
  const incident = game.incident
  const incidentNode = game.nodes.findIndex((entry) => entry.id === incident?.nodeId)
  const target = chaosTarget(game)
  const chaos = game.nodes.findIndex((entry) => entry.id === target)
  const deploying = incident?.kind === 'bad-deploy'
  const deployShare = deploying ? badDeployShareOf(game, blastService(game)) : 0
  const deployKinds = deploying
    ? S.REQUEST_KINDS.reduce(
        (bits, kind, index) => (failsKind(game, kind) ? bits + bit(index) : bits),
        0,
      )
    : 0
  const runtimeFailure = incident ? (S.RUNTIME_INCIDENT_FAILURES[incident.kind] ?? 0) : 0
  fill(
    exports,
    BLOCK.kindService,
    S.REQUEST_KINDS.map((kind) => game.services.indexOf(serviceOfKind(game, kind))),
  )
  // The slots every Node's row repeats: the Game's, not the Node's.
  const template = new Float64Array(SCALARS)
  template[SLOT.users] = game.users
  template[SLOT.seed] = game.seed
  template[SLOT.time] = game.time
  template[SLOT.sandbox] = game.sandbox ? 1 : 0
  template[SLOT.scenarioTasks] = game.scenario?.tasks ? 1 : 0
  template[SLOT.fixes] = fixes
  template[SLOT.incidentNode] = incidentNode
  template[SLOT.incidentStarted] = incident?.startedAt ?? 0
  template[SLOT.incidentRegion] = incident?.region ? positionOf(S.REGIONS, incident.region) : -1
  template[SLOT.chaosTarget] = chaos
  template[SLOT.incident] = incident ? positionOf(S.INCIDENT_IDS, incident.kind) + 1 : 0
  template[SLOT.serviceIndexes] = serviceIndexes
  template[SLOT.stage] = game.stage
  template[SLOT.venture] = venture
  template[SLOT.fixedMix] = game.fixedMix ? 1 : 0
  template[SLOT.scenarioDaily] = game.scenario?.daily ? 1 : 0
  template[SLOT.deployShare] = deployShare
  template[SLOT.deployKinds] = deployKinds
  template[SLOT.incidentThrottled] = incident?.throttled === true ? 1 : 0
  template[SLOT.data] = game.data
  template[SLOT.subscriptions] = subscriptions
  template[SLOT.costIndex] = costIndex
  template[SLOT.egressFactor] = egressFactor
  template[SLOT.salaries] = salaries
  template[SLOT.shareCompute] = shares.compute
  template[SLOT.shareData] = shares.data
  template[SLOT.shareStorage] = shares.storage
  template[SLOT.shareObservability] = shares.observability
  template[SLOT.serviceCount] = game.services.length
  template[SLOT.insightPerk] = perk
  template[SLOT.runtimeFailure] = runtimeFailure
  template[SLOT.dataStaffed] = staffed
  // Rows go straight into the kernel's block. Nothing below calls the kernel, so the view holds.
  reserve(exports, BLOCK.scalars, nodes * SCALARS)
  const scalars = view(exports, Float64Array, BLOCK.scalars, nodes * SCALARS)
  game.nodes.forEach((node, index) => {
    const row = scalars.subarray(index * SCALARS, (index + 1) * SCALARS)
    row.set(template)
    const group = dataGroupOf(game, node)
    const data = node.type === 'database' || node.type === 'replica'
    row[SLOT.size] = node.size
    row[SLOT.workers] = node.workers
    row[SLOT.replicas] = node.replicas
    row[SLOT.runtime] = positionOf(S.RUNTIME_IDS, node.runtime)
    row[SLOT.framework] = positionOf(S.FRAMEWORK_IDS, node.framework)
    row[SLOT.family] = positionOf(S.FAMILY_IDS, node.family)
    row[SLOT.compress] = node.compress ? 1 : 0
    row[SLOT.localDb] = node.localDb ? 1 : 0
    row[SLOT.leak] = node.leak
    row[SLOT.credits] = node.credits
    row[SLOT.prefetch] = node.prefetch
    row[SLOT.pm] = indexIn(POOLING, node.pm)
    // `gogcOf`: the Node's GOGC row, or the default row when none matches.
    const gogc = S.GOGC.findIndex((entry) => entry.gogc === node.gogc)
    row[SLOT.gogc] = gogc < 0 ? 1 : gogc
    row[SLOT.collector] = indexIn(COLLECTORS, node.collector)
    row[SLOT.recycle] = node.recycle ? 1 : 0
    row[SLOT.warm] = warmOf(node.life)
    row[SLOT.down] = isDown(node) ? 1 : 0
    row[SLOT.zone] = positionOf(S.ZONES, node.zone)
    row[SLOT.region] = positionOf(S.REGIONS, node.region)
    row[SLOT.dbEngine] = engineOf(game, node) === 'mysql' ? 1 : 0
    row[SLOT.sampling] = samplingOf(game, design, node)
    row[SLOT.samplingMs] = samplingMsOf(design, node)
    row[SLOT.delegated] = delegates(design, node) ? 1 : 0
    row[SLOT.offloaded] = offloads(design, node) ? 1 : 0
    row[SLOT.pod] = inCluster(game, node) ? 1 : 0
    row[SLOT.mesh] = meshOf(game, node) ? 1 : 0
    row[SLOT.typeCode] = positionOf(S.COMPONENT_IDS, node.type)
    row[SLOT.id] = index
    row[SLOT.shards] = node.shards ?? 1
    row[SLOT.shardKey] = indexIn(SHARD_KEYS, node.shardKey)
    row[SLOT.iops] = indexIn(IOPS, node.iops)
    row[SLOT.keep] = indexIn(RETENTION, node.keep)
    row[SLOT.topology] = positionOf(
      TOPOLOGY,
      node.type === 'database' ? topologyOfGroup(game, group) : 'single',
    )
    row[SLOT.depth] = node.depth ?? 0
    row[SLOT.usersInGroup] = usersOfGroup(game, group)
    row[SLOT.variant] = node.variant === 'l4' ? 1 : 0
    row[SLOT.policy] = indexIn(POLICIES, node.policy)
    row[SLOT.sticky] = node.sticky ? 1 : 0
    row[SLOT.fanout] = node.fanout === 'push' ? 1 : 0
    row[SLOT.mode] = indexIn(MODES, node.mode)
    row[SLOT.materialized] = node.materialized ? 1 : 0
    row[SLOT.sync] = node.sync ? 1 : 0
    row[SLOT.ryw] = node.ryw ? 1 : 0
    row[SLOT.certUntil] = node.certUntil ?? -1
    row[SLOT.rateLimit] = node.rateLimit ?? 0
    row[SLOT.burst] = node.burst ?? 0
    row[SLOT.maxLength] = node.maxLength ?? 0
    row[SLOT.dlq] = node.dlq ? 1 : 0
    row[SLOT.attempts] = node.attempts ?? 25
    row[SLOT.blast] = S.BLAST_FACTOR[S.LANGUAGES[S.RUNTIMES[node.runtime].language].blast]
    row[SLOT.buggy] = buggy(game, node) ? 1 : 0
    row[SLOT.databasesInGroup] = data ? databasesOfGroup(game, group).length : 0
    row[SLOT.syncStalled] = syncStalled(game, group) ? 1 : 0
    row[SLOT.primary] = node.type === 'replica' && primaryOf(game, node) !== undefined ? 1 : 0
    // `solver.poisoned`: a poison message sits in a Queue with no DLQ that feeds this Node.
    row[SLOT.poisoned] =
      incident?.kind === 'poison' &&
      game.links.some((link) => {
        const queue = game.nodes.find((entry) => entry.id === link.from)
        return link.to === node.id && link.from === incident.nodeId && queue && !queue.dlq
      })
        ? 1
        : 0
    row[SLOT.ramped] = rampedOf(game, node) ? 1 : 0
    const cluster = clusterOf(game, node)
    row[SLOT.cluster] = cluster === undefined ? -1 : (design.at.get(cluster) ?? -1)
    row[SLOT.staleUntil] = node.staleUntil
    row[SLOT.cacheKey] = indexIn(S.CACHE_KEYS, node.cacheKey)
    row[SLOT.presence] = node.presence ? 1 : 0
    row[SLOT.backoff] = node.backoff ? 1 : 0
    row[SLOT.clustering] = node.clustering ? 1 : 0
    row[SLOT.warming] = node.life._tag === 'Warming' ? 1 : 0
    row[SLOT.partitions] = node.partitions
    row[SLOT.acks] = indexIn(S.LOG_ACKS, node.acks)
    row[SLOT.retain] = node.retain
    row[SLOT.keyed] = node.keyed ? 1 : 0
    row[SLOT.authEdge] = node.authEdge ? 1 : 0
    row[SLOT.merge] = node.merge ? 1 : 0
    row[SLOT.shut] = node.service._tag === 'Shut' ? 1 : 0
    row[SLOT.sampleRate] = node.sampleRate
    row[SLOT.burn] = burnOf(game, node)
    row[SLOT.retrieval] =
      node.type === 'storage' ? S.STORAGE_CLASSES[node.storageClass].retrieval : 0
    row[SLOT.storeGet] = storageRequestBurnOf(node, 1, 0)
    row[SLOT.storePut] = storageRequestBurnOf(node, 0, 1)
    row[SLOT.syncWait] = data ? syncWaitMs(game, node) : 0
    row[SLOT.iopsFactor] =
      game.reshard?.node === node.id &&
      game.reshard.phase._tag === 'Copying' &&
      game.time < game.reshard.phase.until
        ? S.RESHARD_IOPS
        : 1
    row[SLOT.steal] = stealOf(game, node)
    row[SLOT.shed] = node.shed ? 1 : 0
    row[SLOT.degrade] = node.degrade ? 1 : 0
    row[SLOT.indexType] = indexIn(S.VEC_INDEXES, node.indexType)
    row[SLOT.transactions] = node.transactions ? 1 : 0
    row[SLOT.downOom] = node.life._tag !== 'Running' && causeOf(node.life) === 'oom' ? 1 : 0
    row[SLOT.cacheEngine] = indexIn(S.CACHE_ENGINES, node.engine)
    row[SLOT.ttl] = node.ttl
    row[SLOT.swr] = node.swr ? 1 : 0
    row[SLOT.earlyExpiry] = node.earlyExpiry ? 1 : 0
    row[SLOT.coalesce] = node.coalesce ? 1 : 0
    row[SLOT.cacheStrategy] = indexIn(S.CACHE_STRATEGIES, node.cacheStrategy)
    row[SLOT.split] = node.split ? 1 : 0
    row[SLOT.paranoia] = node.paranoia
    row[SLOT.underAttack] = node.underAttack ? 1 : 0
    if (node.type === 'storage') {
      row[SLOT.r2] = node.storeVariant === 'r2' ? 1 : 0
      // `storageRule.outcome`: the share of the store's GB in an archive class.
      const bands = storageBands(game, node)
      const all = bands.reduce((sum, band) => sum + band.gb, 0)
      const archived = bands.reduce((sum, band) => sum + (band.archived ? band.gb : 0), 0)
      row[SLOT.archived] =
        all > 0 ? archived / all : S.STORAGE_CLASSES[node.storageClass].archived ? 1 : 0
    }
    if (node.type === 'search') {
      row[SLOT.searchVariant] = positionOf(S.SEARCH_VARIANTS, node.searchVariant)
      row[SLOT.searchShards] = node.searchShards
      row[SLOT.heap] = positionOf(S.SEARCH_HEAPS, node.heap)
      row[SLOT.searchReplicas] = node.searchReplicas
      row[SLOT.refresh] = node.refresh
    }
    row[SLOT.secondProvider] = node.provider === 'second' ? 1 : 0
    if (node.type === 'gpu') {
      row[SLOT.gpu] = positionOf(S.GPU_TYPES, node.gpu)
      row[SLOT.gpuModel] = positionOf(S.GPU_MODELS, node.gpuModel)
      row[SLOT.precision] = positionOf(S.GPU_PRECISIONS, node.precision)
      row[SLOT.batch] = node.batch
    }
    row[SLOT.quorumN] = node.n
    row[SLOT.quorumR] = node.r
    row[SLOT.quorumW] = node.w
    row[SLOT.lost] = node.lost
    row[SLOT.spread] = node.spread ? 1 : 0
  })

  // A kernel call inside the loop would have detached the view and dropped every row after it.
  if (scalars.length !== nodes * SCALARS)
    throw new Error('The scalar view detached while it was written.')

  const researched = new Set(game.researched)
  const research = new Uint8Array(Math.ceil(S.RESEARCH_IDS.length / 8))
  S.RESEARCH_IDS.forEach((id, index) => {
    if (researched.has(id)) research[index >> 3] = (research[index >> 3] ?? 0) | (1 << (index & 7))
  })
  fillBytes(exports, BLOCK.research, research)

  const rates = demandOf(game)
  fill(
    exports,
    BLOCK.demand,
    ALL.map((kind) => rates[kind as RequestKind] ?? 0),
  )
  const routes = userRoutes(game, (node) => (design.routes.get(node.id)?.length ?? 0) > 0)
  const intake = new Float64Array(nodes)
  const routeRows = new Float64Array(routes.length * 4)
  routes.forEach((entry, index) => {
    const slot = entry.source ? (design.at.get(entry.source.id) ?? -1) : -1
    if (slot >= 0) intake[slot] = (intake[slot] ?? 0) + entry.share
    routeRows.set(
      [positionOf(S.REGIONS, entry.region), slot, entry.share, entry.extraMs],
      index * 4,
    )
  })
  fill(exports, BLOCK.intake, intake)
  fill(exports, BLOCK.routes, routeRows)
  const mix = mixOf(game)
  fill(
    exports,
    BLOCK.probe,
    S.REQUEST_KINDS.map((kind) => mix[kind] ?? 0),
  )
  // The Features at their exposure and the Product levers, as the per-kind factors the solve reads.
  fill(
    exports,
    BLOCK.value,
    S.REQUEST_KINDS.map((kind) => valueFactor(game, kind)),
  )
  fill(
    exports,
    BLOCK.payload,
    S.REQUEST_KINDS.map((kind) => payloadFactor(game, kind)),
  )
  fill(
    exports,
    BLOCK.query,
    S.BACKEND_KINDS.map((kind) => queryFactor(game, kind)),
  )
  fillWith(exports, BLOCK.latency, nodes * NK, 0)
}

/** Writes a Game into the kernel and compiles its Design. */
const write = (exports: Exports, game: Game): void => {
  const design = graphOf(game)
  writeDesign(exports, game, design)
  writeGame(exports, game, design)
  check(exports.design_set(design.healthChecked ? 1 : 0, design.time), 'design_set')
}

const check = (status: number, call: string): void => {
  if (status !== 0) throw new Error(`The kernel's ${call} returned status ${status}.`)
}

/** The chaos experiment's target, as `solve.ts` exports it; here so the encoder needs no cycle. */
const chaosTarget = (game: Game): string | null =>
  game.chaos && game.time % S.CHAOS_EVERY < S.CHAOS_SECONDS ? game.weakest : null

/**
 * The Games whose converged state the kernel holds: the last one it solved, and every Game
 * `carryKernel` carried it to. The Bottleneck search starts from that state.
 */
let converged = new WeakSet<Game>()

/** The flow solve: the pass loop and its Ledger, without the Bottleneck search. */
export const kernelFlow = (game: Game): Ledger => {
  const exports = installed()
  write(exports, game)
  check(exports.solve_run(-1, 0, 0), 'solve_run')
  converged = new WeakSet([game])
  return readLedger(exports, game)
}

/** `to` holds the state `from` solved to: the Step between them changed nothing the solve reads. */
export const carryKernel = (from: Game, to: Game): void => {
  if (converged.has(from)) converged.add(to)
}

/** The Node whose doubled capacity would earn the most, searched from the flow solve's state. */
export const kernelBottleneck = (game: Game): string | null => {
  const exports = installed()
  if (!converged.has(game)) kernelFlow(game)
  check(exports.bottleneck_run(0), 'bottleneck_run')
  const slot =
    view(exports, Float64Array, BLOCK.summary, exports.summary_len())[SUMMARY_BOTTLENECK] ?? -1
  return slot >= 0 ? (game.nodes[slot]?.id ?? null) : null
}

/* ==========================================================================
   The Ledger stream. `kernel/src/wire.rs` writes every record in the key
   order the Ledger type lists it, so each object literal below reads its
   fields in source order: the result has the same keys, in the same order,
   with the same nulls.
   ========================================================================== */

const LIMITS = [
  'none',
  'cpu',
  'workers',
  'network',
  'memory',
  'credits',
  'throughput',
  'disk',
  'connections',
] as const satisfies ReadonlyArray<Limit>
const WORK_UNITS = ['cpu', 'workers', 'network', 'disk'] as const satisfies ReadonlyArray<WorkUnit>
const STATUSES = [
  'idle',
  'ok',
  'warn',
  'danger',
  'down',
] as const satisfies ReadonlyArray<NodeStatus>
/** `Cause` in `kernel/src/model.rs`, in order. */
const CAUSES = [
  'runtime',
  'collector',
  'opcache',
  'variant',
  'arm',
  'recycle',
  'warmup',
  'framework',
  'jit',
  'hashing',
  'async',
  'compression',
  'local-db',
  'serialization',
  'auth',
  'sampling',
  'neighbours',
  'swapping',
  'gc',
  'slow-query',
  'disk',
  'eviction',
  'hot-shard',
  'bloat',
  'denormalization',
  'indexes',
  'features',
  'engine',
  'multi-leader',
  'scatter',
  'report',
  'retention',
  'view',
  'busiest-shard',
] as const satisfies ReadonlyArray<CostCause>

/** A record keyed by the Ledger's ids, written once while it is decoded. */
type Building<V> = Record<string, V>

const readLedger = (exports: Exports, game: Game): Ledger => {
  const block = view(exports, Float64Array, BLOCK.ledger, exports.len(BLOCK.ledger))
  let at = 0
  const num = (): number => block[at++] as number
  const flag = (): boolean => block[at++] !== 0
  const opt = (): number | null => {
    const present = flag()
    const value = num()
    return present ? value : null
  }
  const pair = <T>(shape: (a: number, b: number) => T): T | null => {
    const present = flag()
    const a = num()
    const b = num()
    return present ? shape(a, b) : null
  }
  const gauge = () => pair((used, total) => ({ used, total }))
  const kind = (): Kind => ALL[num()] as Kind
  const keyed = (): Building<number> => {
    const record: Building<number> = {}
    for (let left = num(); left > 0; left -= 1) {
      const key = kind()
      record[key] = num()
    }
    return record
  }
  const kindList = (): Array<Kind> => {
    const list: Array<Kind> = []
    for (let left = num(); left > 0; left -= 1) list.push(kind())
    return list
  }
  const receipts = (): Building<Receipt> => {
    const record: Building<Receipt> = {}
    for (let left = num(); left > 0; left -= 1) {
      const key = kind()
      const base = num()
      const lines: Array<CostLine> = []
      for (let count = num(); count > 0; count -= 1)
        lines.push({
          cause: CAUSES[num()] as CostCause,
          op: flag() ? 'plus' : 'times',
          value: num(),
        })
      record[key] = { base, lines, total: num() }
    }
    return record
  }
  const nodeId = (slot: number): string | null =>
    slot >= 0 ? (game.nodes[slot]?.id ?? null) : null

  const nodes: Building<NodeLedger> = {}
  const count = num()
  for (let index = 0; index < count; index += 1)
    nodes[game.nodes[index]?.id ?? ''] = {
      inbound: num(),
      traffic: keyed(),
      capacity: num(),
      utilization: num(),
      limit: LIMITS[num()] as Limit,
      latency: num(),
      p99: num(),
      hopByKind: keyed(),
      waitByKind: keyed(),
      workShare: keyed(),
      workUnit: WORK_UNITS[num()] ?? null,
      cost: num(),
      receipts: receipts(),
      repeated: num(),
      origins: keyed(),
      dropped: num(),
      refused: num(),
      stranded: num(),
      strandedKinds: kindList(),
      connections: pair((used, max) => ({ used, max })),
      hitRatio: opt(),
      evictions: opt(),
      age: opt(),
      lagMs: opt(),
      disk: flag(),
      out: keyed(),
      resources: {
        cpuCores: gauge(),
        ramGb: gauge(),
        slots: gauge(),
        networkKbps: gauge(),
        creditsCoreSeconds: pair((balance, rate) => ({ balance, rate })),
      },
      throttled: flag(),
      swapping: flag(),
      status: STATUSES[num()] as NodeStatus,
    }
  const links = game.links.map((link) => ({
    ...link,
    rate: num(),
    traffic: keyed(),
    kind: kind(),
    failing: flag(),
    failure: num(),
  }))
  const services = game.services.map((service) => service.id)
  const serviceKeyed = (): Building<number> => {
    const record: Building<number> = {}
    for (let left = num(); left > 0; left -= 1) {
      const id = services[num()] ?? ''
      record[id] = num()
    }
    return record
  }
  const serviceRows = (): Building<ServiceLedger> => {
    const record: Building<ServiceLedger> = {}
    for (let index = 0, rows = num(); index < rows; index += 1) {
      const served = kindList() as Array<RequestKind>
      const rate = num()
      const done = num()
      const satisfied = num()
      const spent = num()
      record[services[index] ?? ''] = {
        kinds: served,
        rate,
        served: done,
        failed: rate - done,
        apdex: rate > 0 ? satisfied / rate : 1,
        mean: done > 0 ? spent / done : 0,
        p99: num(),
      }
    }
    return record
  }
  const causes = (): Record<(typeof ERROR_CAUSES)[number], number> =>
    Object.fromEntries(ERROR_CAUSES.map((cause) => [cause, num()])) as Record<
      (typeof ERROR_CAUSES)[number],
      number
    >
  const regionApdex = (): Building<number> => {
    const record: Building<number> = {}
    for (let left = num(); left > 0; left -= 1) {
      const region = S.REGIONS[num()] ?? ''
      record[region] = num()
    }
    return record
  }
  const regionRows = (): Ledger['regionKinds'] => {
    const record: Building<Building<unknown>> = {}
    for (let left = num(); left > 0; left -= 1) {
      const rows: Building<unknown> = {}
      record[S.REGIONS[num()] ?? ''] = rows
      for (let rowCount = num(); rowCount > 0; rowCount -= 1)
        rows[kind()] = {
          rate: num(),
          success: num(),
          apdex: num(),
          near: num(),
          fail: causes(),
          hopMs: num(),
          p99: num(),
        }
    }
    return record as Ledger['regionKinds']
  }
  const kinds: Building<unknown> = {}
  for (let left = num(); left > 0; left -= 1)
    kinds[kind()] = {
      rate: num(),
      success: num(),
      apdex: num(),
      completion: opt(),
      mean: num(),
      p50: num(),
      p95: num(),
      p99: num(),
    }
  const demand = num()
  const served = num()
  const errors = causes()
  const errorShare = num()
  const latency = num()
  const p50 = num()
  const p95 = num()
  const p99 = num()
  const apdex = num()
  const regions = regionApdex()
  const ledger = {
    nodes,
    links,
    kinds: kinds as Ledger['kinds'],
    demand,
    served,
    errors,
    errorShare,
    latency,
    p50,
    p95,
    p99,
    apdex,
    regions,
    // Each device's mean: `latency` plus its own radio round trip.
    deviceLatency: Object.fromEntries(
      S.DEVICES.map((device) => [device, latency + S.DEVICE_INFO[device].rttMs]),
    ) as Ledger['deviceLatency'],
    regionKinds: regionRows(),
    revenue: num(),
    subscriptions: num(),
    insight: Object.fromEntries(S.INSIGHT_POOLS.map((pool) => [pool, num()])) as Ledger['insight'],
    breadth: keyed(),
    breadthRegions: keyed(),
    burn: num(),
    fines: num(),
    salaries: num(),
    egress: num(),
    fees: num(),
    burnLines: {
      compute: num(),
      data: num(),
      storage: num(),
      egress: num(),
      thirdParty: num(),
      requests: num(),
      observability: num(),
      salaries: num(),
    },
    revenueByKind: keyed(),
    finesByKind: keyed(),
    costPerKind: keyed(),
    costPerService: serviceKeyed(),
    services: serviceRows(),
    market: marketOf(game),
    velocity: num(),
    failing: kindList() as Array<RequestKind>,
    forecastPeak: forecastPeakOf(game, demand),
    bottleneck: nodeId(num()),
    bottleneckByKind: {} as Building<string | null>,
  }
  for (let left = num(); left > 0; left -= 1) {
    const key = kind()
    ledger.bottleneckByKind[key] = nodeId(num())
  }
  if (at !== block.length)
    throw new Error(`The Ledger stream ran ${at} of ${block.length} figures.`)
  return ledger as Ledger
}
