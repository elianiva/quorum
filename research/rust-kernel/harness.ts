/**
 * The one place that fills the kernel's blocks from a Game, and reads the
 * figures back. Every harness imports this, so the ABI lives in one file.
 *
 * The block ids and slot numbers mirror `src/abi.rs`; `scalar_len()` must match
 * `SLOT`, which `load()` checks, so a slot added on one side cannot silently
 * drift from the other.
 */
import { readFileSync } from 'node:fs'
import { causeOf, warmOf } from '../../packages/simulation/src/life.ts'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
export const S = await import(`${ROOT}/catalog.ts`)
export const company = await import(`${ROOT}/company.ts`)
export const graph = await import(`${ROOT}/solve-graph.ts`)
export const lookups = await import(`${ROOT}/lookups.ts`)
export const team = await import(`${ROOT}/team.ts`)
export const pass = await import(`${ROOT}/solve-pass.ts`)
export const regions = await import(`${ROOT}/regions.ts`)
export const demand = await import(`${ROOT}/solve-demand.ts`)
export const features = await import(`${ROOT}/features.ts`)
export const founding = await import(`${ROOT}/founding.ts`)
const solveOutcomes = await import(`${ROOT}/solve-outcomes.ts`)
const solveLedger = await import(`${ROOT}/solve-ledger.ts`)
const { ERROR_CAUSES } = await import(`${ROOT}/distribution.ts`)
import { decodeLedger, compareDeep } from './ledger-wire.ts'

export const ALL = [...S.REQUEST_KINDS, ...S.BACKEND_KINDS]
export const NK = ALL.length
export const NR = S.REQUEST_KINDS.length
export const NB = S.BACKEND_KINDS.length

/** Block ids, from `src/abi.rs`. */
export const BLOCK = {
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
  arriving: 20,
  models: 21,
  outcomes: 22,
  ledger: 23,
  summary: 24,
  splits: 25,
  links: 18,
  kindService: 19,
}

/** Scalar slots, from `src/abi.rs`. */
export const SLOT = {
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
}
export const SCALARS = Object.keys(SLOT).length
const NODE_FIELDS = 10
const EDGE_FIELDS = 10

const MODES = ['session', 'transaction', 'statement']
const POLICIES = ['weighted', 'round-robin', 'least-conn', 'p2c', 'hash']
const RETRIES = ['none', 'naive', 'backoff']
const POOLING = ['static', 'dynamic', 'ondemand']
const COLLECTORS = ['g1', 'parallel', 'zgc']
const SHARD_KEYS = ['hash', 'range', 'tenant', 'region']
const IOPS = ['general', 'provisioned']
const RETENTION = ['keep', 'archive', 'delete']
const TOPOLOGY = ['single', 'multi', 'sharded']

export const load = async () => {
  const wasm = await WebAssembly.instantiate(
    readFileSync(new URL('./target/wasm32-unknown-unknown/release/qsim.wasm', import.meta.url)),
  )
  const X = wasm.instance.exports
  if (X.scalar_len() !== SCALARS) {
    throw new Error(`scalar slots: kernel ${X.scalar_len()}, harness ${SCALARS}`)
  }
  /** Views into linear memory. Any call that grows memory detaches them. */
  const view = (id, Type, length) => new Type(X.memory.buffer, X.ptr(id), length)
  const reserve = (id, length) => {
    if (X.reserve(id, Math.max(0, length)) !== 0) throw new Error(`reserve ${id} failed`)
  }
  const fill = (id, values) => {
    reserve(id, values.length)
    view(id, Float64Array, values.length).set(values)
  }
  const fillInt = (id, values) => {
    reserve(id, values.length)
    view(id, Int32Array, values.length).set(values)
  }
  const fillBytes = (id, values) => {
    reserve(id, values.length)
    view(id, Uint8Array, values.length).set(values)
  }
  const bitset = (ids, present) => {
    const bytes = new Uint8Array(Math.ceil(ids.length / 8))
    for (const id of present) {
      const index = ids.indexOf(id)
      if (index >= 0) bytes[index >> 3] |= 1 << (index & 7)
    }
    return bytes
  }
  return { X, view, reserve, fill, fillInt, fillBytes, bitset }
}

/** Writes the Design's blocks and compiles it. */
export const writeDesign = (kernel, game, design, options = {}) => {
  const { fill, fillInt, fillBytes } = kernel
  const slotOf = new Map(game.nodes.map((n, i) => [n.id, i]))
  const nodes = game.nodes.length
  const edges = design.edges.length

  const nodeFields = new Float64Array(nodes * NODE_FIELDS)
  game.nodes.forEach((n, i) => {
    const b = i * NODE_FIELDS
    nodeFields[b] = S.COMPONENT_IDS.indexOf(n.type)
    nodeFields[b + 1] = lookups.isDown(n) ? 1 : 0
    nodeFields[b + 2] = n.sticky ? 1 : 0
    nodeFields[b + 3] = Math.max(0, POLICIES.indexOf(n.policy))
    nodeFields[b + 4] = n.ttl
    nodeFields[b + 5] = n.checkEvery
    nodeFields[b + 6] = n.deepCheck ? 1 : 0
    nodeFields[b + 7] = n.type === 'replica' ? 1 : 0
    nodeFields[b + 8] = n.type === 'replica' && lookups.primaryOf(game, n) !== undefined ? 1 : 0
    nodeFields[b + 9] = n.service._tag === 'Draining' ? 1 : 0
  })

  const edgeFields = new Float64Array(edges * EDGE_FIELDS)
  design.edges.forEach((e, i) => {
    const b = i * EDGE_FIELDS
    edgeFields[b] = slotOf.get(e.from.id)
    edgeFields[b + 1] = slotOf.get(e.to.id)
    edgeFields[b + 2] = e.link.kinds ? kindMask(e.link.kinds) : Number((1n << BigInt(NK)) - 1n)
    edgeFields[b + 3] = RETRIES.indexOf(e.policy.retry)
    edgeFields[b + 4] = e.policy.timeout
    edgeFields[b + 5] = e.policy.open ? 1 : 0
    edgeFields[b + 6] = e.policy.bulkhead ? 1 : 0
    edgeFields[b + 7] = e.policy.hedge ? 1 : 0
    edgeFields[b + 8] = e.link.failure
    // How the Edge's bytes leave their zone: 0 not at all, 1 to another zone, 2 to another region.
    const crossRegion =
      e.from.region !== e.to.region && !regions.isGlobal(e.from) && !regions.isGlobal(e.to)
    edgeFields[b + 9] = crossRegion ? 2 : lookups.zoneMs(e.from, e.to) > 0 ? 1 : 0
  })

  const starts = new Int32Array(nodes + 1)
  const outEdges = []
  game.nodes.forEach((n, i) => {
    starts[i] = outEdges.length
    for (const e of design.out.get(n.id) ?? []) outEdges.push(e.index)
  })
  starts[nodes] = outEdges.length

  // Each Link in Game order: its ends, the Edge that carries it or -1, and its breaker.
  const linkFields = []
  for (const link of game.links) {
    const edge = graph.edgeOf(design, link.from, link.to)
    linkFields.push(slotOf.get(link.from), slotOf.get(link.to), edge ? edge.index : -1, link.breaker ? 1 : 0)
  }
  fill(BLOCK.links, linkFields)
  fill(BLOCK.nodeFields, Array.from(nodeFields))
  fill(BLOCK.edgeFields, Array.from(edgeFields))
  fillInt(BLOCK.outStarts, Array.from(starts))
  fillInt(BLOCK.outEdges, outEdges)

  const weights = options.weights ?? new Array(nodes).fill(1)
  const nominal = options.nominal ?? new Array(nodes).fill(1)
  const sick = options.sick ?? new Uint8Array(nodes)
  fill(BLOCK.weights, weights)
  fill(BLOCK.nominal, nominal)
  fillBytes(BLOCK.sick, sick)
  return { slotOf, nodes, edges }
}

const kindMask = (kinds) => {
  let mask = 0n
  for (const kind of kinds) {
    const index = ALL.indexOf(kind)
    if (index >= 0) mask |= 1n << BigInt(index)
  }
  return Number(mask)
}

/** Writes every Game-level block: the scalar rows, research, demand, intake. */
export const writeGame = (kernel, game, design, info, options = {}) => {
  const { fill, fillBytes, bitset } = kernel
  const { slotOf, nodes } = info
  const scalars = new Float64Array(nodes * SCALARS)
  const serviceIndexes = game.services.reduce((sum, service) => sum + service.indexes, 0)
  // `team.ts` reads the fixes of the Service the Company runs: `serviceOf(game)`.
  const serviceFixes = new Set(team.serviceOf(game).fixes)
  const venture = S.VENTURE_IDS.indexOf(game.founding?.venture ?? 'b2b-saas')
  // What the bill reads that the solve does not change.
  const costIndex = lookups.eraOf(game).costIndex
  const egressFactor = founding.ventureOf(game).constraint.egress
  const salaries = team.payrollOf(game)
  const shares = lookups.burnSharesOf(game)
  fill(
    BLOCK.kindService,
    S.REQUEST_KINDS.map((kind) => game.services.indexOf(team.serviceOfKind(game, kind))),
  )
  game.nodes.forEach((n, i) => {
    const base = i * SCALARS
    const put = (slot, value) => {
      scalars[base + slot] = value
    }
    put(SLOT.users, game.users)
    put(SLOT.seed, game.seed)
    put(SLOT.time, game.time)
    put(SLOT.sandbox, game.sandbox ? 1 : 0)
    put(SLOT.scenarioTasks, game.scenario?.tasks ? 1 : 0)
    put(
      SLOT.fixes,
      S.FIXES.reduce((bits, fix, index) => (serviceFixes.has(fix) ? bits + 2 ** index : bits), 0),
    )
    put(SLOT.incidentNode, game.nodes.findIndex((entry) => entry.id === game.incident?.nodeId))
    put(SLOT.incidentStarted, game.incident?.startedAt ?? 0)
    put(SLOT.incidentRegion, game.incident?.region ? S.REGIONS.indexOf(game.incident.region) : -1)
    put(SLOT.chaosTarget, game.nodes.findIndex((entry) => entry.id === solveOutcomes.chaosTarget(game)))
    put(SLOT.size, n.size)
    put(SLOT.workers, n.workers)
    put(SLOT.replicas, n.replicas)
    put(SLOT.runtime, S.RUNTIME_IDS.indexOf(n.runtime))
    put(SLOT.framework, S.FRAMEWORK_IDS.indexOf(n.framework))
    put(SLOT.family, S.FAMILY_IDS.indexOf(n.family))
    put(SLOT.compress, n.compress ? 1 : 0)
    put(SLOT.localDb, n.localDb ? 1 : 0)
    put(SLOT.leak, n.leak)
    put(SLOT.credits, n.credits)
    put(SLOT.prefetch, n.prefetch)
    put(SLOT.pm, Math.max(0, POOLING.indexOf(n.pm)))
    // `gogcOf`: the Node's GOGC row, or the default row when none matches.
    const gogc = S.GOGC.findIndex((entry) => entry.gogc === n.gogc)
    put(SLOT.gogc, gogc < 0 ? 1 : gogc)
    put(SLOT.collector, Math.max(0, COLLECTORS.indexOf(n.collector)))
    put(SLOT.recycle, n.recycle ? 1 : 0)
    put(SLOT.warm, warmOf(n.life))
    put(SLOT.down, lookups.isDown(n) ? 1 : 0)
    put(SLOT.zone, S.ZONES.indexOf(n.zone))
    put(SLOT.region, S.REGIONS.indexOf(n.region))
    put(SLOT.dbEngine, lookups.engineOf(game, n) === 'mysql' ? 1 : 0)
    put(SLOT.inflight, 0)
    put(SLOT.sampling, graph.samplingOf(game, design, n))
    put(SLOT.samplingMs, graph.samplingMsOf(design, n))
    put(SLOT.delegated, graph.delegates(design, n) ? 1 : 0)
    put(SLOT.offloaded, graph.offloads(design, n) ? 1 : 0)
    put(SLOT.pod, lookups.inCluster(game, n) ? 1 : 0)
    put(SLOT.mesh, lookups.meshOf(game, n) ? 1 : 0)
    put(SLOT.typeCode, S.COMPONENT_IDS.indexOf(n.type))
    put(SLOT.id, i)
    put(SLOT.incident, game.incident ? S.INCIDENT_IDS.indexOf(game.incident.kind) + 1 : 0)
    put(SLOT.shards, n.shards ?? 1)
    put(SLOT.shardKey, Math.max(0, SHARD_KEYS.indexOf(n.shardKey)))
    put(SLOT.iops, Math.max(0, IOPS.indexOf(n.iops)))
    put(SLOT.keep, Math.max(0, RETENTION.indexOf(n.keep)))
    put(
      SLOT.topology,
      TOPOLOGY.indexOf(n.type === 'database' ? lookups.topologyOfGroup(game, lookups.dataGroupOf(game, n)) : 'single'),
    )
    put(SLOT.depth, n.depth ?? 0)
    put(SLOT.connections, 0)
    put(SLOT.usersInGroup, lookups.usersOfGroup(game, lookups.dataGroupOf(game, n)))
    put(SLOT.serviceIndexes, serviceIndexes)
    put(SLOT.stage, game.stage)
    put(SLOT.venture, Math.max(0, venture))
    put(SLOT.fixedMix, game.fixedMix ? 1 : 0)
    put(SLOT.scenarioDaily, game.scenario?.daily ? 1 : 0)
    put(SLOT.variant, n.variant === 'l4' ? 1 : 0)
    put(SLOT.policy, Math.max(0, POLICIES.indexOf(n.policy)))
    put(SLOT.sticky, n.sticky ? 1 : 0)
    put(SLOT.fanout, n.fanout === 'push' ? 1 : 0)
    put(SLOT.mode, Math.max(0, MODES.indexOf(n.mode)))
    put(SLOT.materialized, n.materialized ? 1 : 0)
    put(SLOT.sync, n.sync ? 1 : 0)
    put(SLOT.ryw, n.ryw ? 1 : 0)
    put(SLOT.certUntil, n.certUntil ?? -1)
    put(SLOT.rateLimit, n.rateLimit ?? 0)
    put(SLOT.burst, n.burst ?? 0)
    put(SLOT.maxLength, n.maxLength ?? 0)
    put(SLOT.dlq, n.dlq ? 1 : 0)
    put(SLOT.attempts, n.attempts ?? 25)
    put(
      SLOT.blast,
      S.BLAST_FACTOR[S.LANGUAGES[S.RUNTIMES[n.runtime].language].blast],
    )
    put(SLOT.buggy, team.buggy(game, n) ? 1 : 0)
    put(
      SLOT.databasesInGroup,
      n.type === 'database' || n.type === 'replica'
        ? lookups.databasesOfGroup(game, lookups.dataGroupOf(game, n)).length
        : 0,
    )
    put(SLOT.syncStalled, lookups.syncStalled(game, lookups.dataGroupOf(game, n)) ? 1 : 0)
    put(SLOT.primary, n.type === 'replica' && lookups.primaryOf(game, n) !== undefined ? 1 : 0)
    // `solver.poisoned`: a poison message sits in a Queue with no DLQ that feeds this Node.
    put(
      SLOT.poisoned,
      game.incident?.kind === 'poison' &&
        game.links.some((link) => {
          const queue = game.nodes.find((entry) => entry.id === link.from)
          return link.to === n.id && link.from === game.incident.nodeId && queue && !queue.dlq
        })
        ? 1
        : 0,
    )
    put(SLOT.ramped, lookups.rampedOf(game, n) ? 1 : 0)
    const cluster = lookups.clusterOf(game, n)
    put(SLOT.cluster, cluster === undefined ? -1 : game.nodes.findIndex((entry) => entry.id === cluster))
    const deploying = game.incident?.kind === 'bad-deploy'
    put(SLOT.deployShare, deploying ? team.badDeployShareOf(game, team.blastService(game)) : 0)
    put(
      SLOT.deployKinds,
      deploying
        ? S.REQUEST_KINDS.reduce((bits, kind, index) => (team.failsKind(game, kind) ? bits + 2 ** index : bits), 0)
        : 0,
    )
    put(SLOT.staleUntil, n.staleUntil)
    put(SLOT.cacheKey, Math.max(0, Object.keys(S.CACHE_KEYS).indexOf(n.cacheKey)))
    put(SLOT.presence, n.presence ? 1 : 0)
    put(SLOT.backoff, n.backoff ? 1 : 0)
    put(SLOT.clustering, n.clustering ? 1 : 0)
    put(SLOT.warming, n.life._tag === 'Warming' ? 1 : 0)
    put(SLOT.incidentThrottled, game.incident?.throttled === true ? 1 : 0)
    put(SLOT.partitions, n.partitions)
    put(SLOT.acks, Math.max(0, Object.keys(S.LOG_ACKS).indexOf(n.acks)))
    put(SLOT.retain, n.retain)
    put(SLOT.keyed, n.keyed ? 1 : 0)
    put(SLOT.authEdge, n.authEdge ? 1 : 0)
    put(SLOT.merge, n.merge ? 1 : 0)
    put(SLOT.shut, n.service._tag === 'Shut' ? 1 : 0)
    put(SLOT.data, game.data)
    put(SLOT.subscriptions, features.subscriptionsOf(game))
    put(SLOT.sampleRate, n.sampleRate)
    put(SLOT.burn, lookups.burnOf(game, n))
    put(SLOT.retrieval, n.type === 'storage' ? S.STORAGE_CLASSES[n.storageClass].retrieval : 0)
    put(SLOT.storeGet, lookups.storageRequestBurnOf(n, 1, 0))
    put(SLOT.storePut, lookups.storageRequestBurnOf(n, 0, 1))
    put(SLOT.costIndex, costIndex)
    put(SLOT.egressFactor, egressFactor)
    put(SLOT.salaries, salaries)
    put(SLOT.shareCompute, shares.compute)
    put(SLOT.shareData, shares.data)
    put(SLOT.shareStorage, shares.storage)
    put(SLOT.shareObservability, shares.observability)
    put(SLOT.serviceCount, game.services.length)
    put(SLOT.syncWait, n.type === 'database' || n.type === 'replica' ? lookups.syncWaitMs(game, n) : 0)
    put(
      SLOT.iopsFactor,
      game.reshard?.node === n.id && game.reshard.phase._tag === 'Copying' && game.time < game.reshard.phase.until
        ? S.RESHARD_IOPS
        : 1,
    )
    put(SLOT.steal, founding.stealOf(game, n))
    put(SLOT.shed, n.shed ? 1 : 0)
    put(SLOT.degrade, n.degrade ? 1 : 0)
    put(SLOT.insightPerk, founding.insightPerk(game))
    put(SLOT.indexType, Math.max(0, Object.keys(S.VEC_INDEXES).indexOf(n.indexType)))
    put(SLOT.runtimeFailure, game.incident ? (S.RUNTIME_INCIDENT_FAILURES[game.incident.kind] ?? 0) : 0)
    put(SLOT.transactions, n.transactions ? 1 : 0)
    put(SLOT.downOom, n.life._tag !== 'Running' && causeOf(n.life) === 'oom' ? 1 : 0)
    put(SLOT.dataStaffed, team.dataStaffed(game) ? 1 : 0)
    put(SLOT.cacheEngine, Math.max(0, Object.keys(S.CACHE_ENGINES).indexOf(n.engine)))
    put(SLOT.ttl, n.ttl)
    put(SLOT.swr, n.swr ? 1 : 0)
    put(SLOT.earlyExpiry, n.earlyExpiry ? 1 : 0)
    put(SLOT.coalesce, n.coalesce ? 1 : 0)
    put(SLOT.cacheStrategy, Math.max(0, Object.keys(S.CACHE_STRATEGIES).indexOf(n.cacheStrategy)))
    put(SLOT.split, n.split ? 1 : 0)
    put(SLOT.paranoia, n.paranoia)
    put(SLOT.underAttack, n.underAttack ? 1 : 0)
    if (n.type === 'storage') {
      put(SLOT.r2, n.storeVariant === 'r2' ? 1 : 0)
      // `storageRule.outcome`: the share of the store's GB in an archive class.
      const bands = lookups.storageBands(game, n)
      const all = bands.reduce((sum, band) => sum + band.gb, 0)
      const archived = bands.reduce((sum, band) => sum + (band.archived ? band.gb : 0), 0)
      put(SLOT.archived, all > 0 ? archived / all : S.STORAGE_CLASSES[n.storageClass].archived ? 1 : 0)
    }
    if (n.type === 'search') {
      put(SLOT.searchVariant, Object.keys(S.SEARCH_VARIANTS).indexOf(n.searchVariant))
      put(SLOT.searchShards, n.searchShards)
      put(SLOT.heap, Object.keys(S.SEARCH_HEAPS).indexOf(n.heap))
      put(SLOT.searchReplicas, n.searchReplicas)
      put(SLOT.refresh, n.refresh)
    }
    put(SLOT.secondProvider, n.provider === 'second' ? 1 : 0)
    if (n.type === 'gpu') {
      put(SLOT.gpu, Object.keys(S.GPU_TYPES).indexOf(n.gpu))
      put(SLOT.gpuModel, Object.keys(S.GPU_MODELS).indexOf(n.gpuModel))
      put(SLOT.precision, Object.keys(S.GPU_PRECISIONS).indexOf(n.precision))
      put(SLOT.batch, n.batch)
    }
    put(SLOT.quorumN, n.n)
    put(SLOT.quorumR, n.r)
    put(SLOT.quorumW, n.w)
    put(SLOT.lost, n.lost)
    put(SLOT.spread, n.spread ? 1 : 0)
  })
  fill(BLOCK.scalars, Array.from(scalars))
  fillBytes(BLOCK.research, bitset(S.RESEARCH_IDS, game.researched))

  const demandRates = demand.demandOf(game)
  fill(
    BLOCK.demand,
    Array.from({ length: NK }, (_, k) => demandRates[S.REQUEST_KINDS[k]] ?? 0),
  )
  const routes = regions.userRoutes(game, (n) => (design.routes.get(n.id)?.length ?? 0) > 0)
  const intake = new Float64Array(nodes)
  for (const entry of routes)
    if (entry.source) {
      const slot = info.slotOf.get(entry.source.id)
      intake[slot] = (intake[slot] ?? 0) + entry.share
    }
  fill(BLOCK.intake, Array.from(intake))
  fill(
    BLOCK.probe,
    S.REQUEST_KINDS.map((kind) => features.mixOf(game)[kind] ?? 0),
  )
  const routeRows = []
  for (const entry of routes)
    routeRows.push(
      S.REGIONS.indexOf(entry.region),
      entry.source ? info.slotOf.get(entry.source.id) : -1,
      entry.share,
      entry.extraMs,
    )
  fill(BLOCK.routes, routeRows)
  // The Features at their exposure and the Product levers, as the per-kind factors the solve reads.
  fill(BLOCK.value, S.REQUEST_KINDS.map((kind) => features.valueFactor(game, kind)))
  fill(BLOCK.payload, S.REQUEST_KINDS.map((kind) => features.payloadFactor(game, kind)))
  fill(BLOCK.query, S.BACKEND_KINDS.map((kind) => features.queryFactor(game, kind)))
  const latency = options.latency ?? new Array(nodes * NK).fill(0)
  fill(BLOCK.latency, latency)
  return { routes, intake }
}

/** One pass: the arriving rates and the models. */
export const forwardRun = (kernel, nodes) => {
  const { X, view } = kernel
  const status = X.forward_run()
  if (status !== 0) throw new Error(`forward_run: status ${status}`)
  return {
    arriving: view(BLOCK.arriving, Float64Array, nodes * NK),
    models: view(BLOCK.models, Float64Array, nodes * X.model_stride()),
    stride: X.model_stride(),
  }
}

/** The outcome tree for every Users Node. */
export const outcomeRun = (kernel, nodes) => {
  const { X, view } = kernel
  const status = X.outcome_run()
  if (status !== 0) throw new Error(`outcome_run: status ${status}`)
  return view(BLOCK.outcomes, Float64Array, nodes * NR * X.outcome_stride())
}

/** The pass loop and its Ledger. */
export const solveRun = (kernel, game, options = {}) => {
  const { X } = kernel
  const status = X.solve_run(options.boost ?? -1, options.passes ?? 0, options.revenueOnly ? 1 : 0)
  if (status !== 0) throw new Error(`solve_run: status ${status}`)
  return readLedger(kernel, game)
}

/** The pass loop plus the Bottleneck search. */
export const bottleneckRun = (kernel, game, options = {}) => {
  const { X } = kernel
  const status = X.bottleneck_run(options.passes ?? 0)
  if (status !== 0) throw new Error(`bottleneck_run: status ${status}`)
  return readLedger(kernel, game)
}

/** The Ledger figures the kernel does not write yet. */
export const PENDING = [
  'nodes.*.receipts',
]

/**
 * Every Ledger figure, compared with the TypeScript Ledger by `Object.is` and
 * key order, so a sign of zero, a NaN, or a reordered record counts as a difference.
 */
export const compareLedger = (game, flow, ledger) => compareDeep(flow, ledger, PENDING)

/** The Ledger the last solve wrote, rebuilt in the TypeScript shape. */
export const readLedger = (kernel, game) => {
  const { X, view } = kernel
  const block = view(BLOCK.ledger, Float64Array, X.len(BLOCK.ledger))
  return decodeLedger(block, game, { kinds: ALL, causes: ERROR_CAUSES, pools: S.INSIGHT_POOLS, regions: S.REGIONS, devices: S.DEVICES.map((device) => [device, S.DEVICE_INFO[device].rttMs]),
    services: game.services.map((service) => service.id),
    extras: { market: features.marketOf(game), forecastPeak: (demand) => solveLedger.forecastPeakOf(game, demand) },
  })
}

/** How many passes the last solve ran. */
export const passesOf = (kernel) => kernel.view(BLOCK.summary, Float64Array, kernel.X.summary_len())[2]

/** The 200-Node stress board the TypeScript benchmark measures. */
export const stressBoard = () => {
  const nodes = [company.node('users', 'users', 0, 0), company.node('lb', 'lb', 100, 0)]
  const links = [company.link('users', 'lb')]
  for (let group = 0; group < 6; group += 1) {
    const lb = `lb${group}`
    const pool = `pool${group}`
    const database = `db${group}`
    nodes.push(
      company.node(lb, 'lb', 200, group * 100),
      company.node(pool, 'pooler', 400, group * 100),
      company.node(database, 'database', 500, group * 100, { size: 5 }),
    )
    links.push(company.link('lb', lb), company.link(pool, database))
    for (let index = 0; index < 30; index += 1) {
      const id = `s${group}-${index}`
      nodes.push(
        company.node(id, 'server', 300, group * 100 + index, {
          size: 3,
          runtime: 'php_fpm',
          workers: 40,
        }),
      )
      links.push(company.link(lb, id), company.link(id, pool))
    }
  }
  const preseed = company.preseedGame()
  return {
    ...preseed,
    nodes,
    links,
    users: 400_000,
    researched: [...preseed.researched, 'pooling', 'opcache'],
  }
}
