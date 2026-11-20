import {
  CACHE_ENGINES,
  AUTH_PRICE_PER_USER,
  COMPONENTS,
  COMPONENT_IDS,
  COPY_PRICE_GROWTH,
  CROSS_ZONE_MS,
  DRAWER_MIN,
  DRAWER_SECONDS,
  ERAS,
  FAMILIES,
  FRAMEWORKS,
  FRAMEWORK_RESEARCH,
  RESEARCH,
  researchList,
  RUNTIMES,
  SAMPLE_RATES,
  RETENTION_STORAGE,
  RETENTION_WINDOWS,
  SAMPLE_STORAGE,
  GPU_TYPES,
  HANDSHAKE_MS,
  HOP_MS,
  L4_BURN,
  POD_BURN,
  PRICINGS,
  DEPLOY_STRATEGIES,
  RESTART_SECONDS,
  SELL_REFUND,
  SIZES,
  STORAGE_PRICE,
  VCPU_PRICE,
  SAVINGS_PLAN_RATE,
  WARMED,
  VM_RESTART_SECONDS,
  type DockGroup,
  DOCK_OF,
  type ComponentId,
  type EraDef,
  type FrameworkId,
  type PerkId,
  type ResearchId,
  type RuntimeId,
  BACKUPS,
  DB_RETENTIONS,
  DB_STORAGE_MULT,
  SPREAD_REGIONS,
  STORAGE_CLASSES,
  STORAGE_IOPS,
  COLD_START_MS,
  NATIVE_COLD_MS,
  EDGE_REQUEST_PRICE,
  SERVERLESS_GB_SECOND,
  SERVERLESS_MEMORY_GB,
  SERVERLESS_REQUEST_PRICE,
  LOG_LOSS,
  LOG_REPLICAS,
  LOG_REPLICA_BURN,
  VEC_INDEXES,
  PERKS,
  CALENDAR_DAY,
  CERT_DAYS,
  CERT_DAYS_SHORT,
  CERT_SHORT_FROM,
  TLS_TERMINATORS,
  MESH_OVERHEAD,
  LIVE_TUNING,
  SHARD_KEYS,
  SCATTER_CPU,
  SCATTER_MS,
  DISTRIBUTED_TX_FAILURE,
  SYNC_MS,
  REPLICA_BOX_PRICE,
  rttOf,
  CACHE_KEYS,
  SEARCH_VARIANTS,
  SEARCH_INDEX_SHARE,
  STORE_VARIANTS,
  ZONE_SPANNING_COMPONENTS,
  type Tuning,
} from './catalog.ts'
import { partsValueOf, provisioned } from './parts.ts'
import { teamBoosting, teamReady } from './research-team.ts'
import { restarting, type DownCause } from './life.ts'
import type {
  DbEngine,
  DbTopology,
  Game,
  GameNode,
  Pricing,
  Service,
  StorageClass,
} from './state.ts'
import { activeIncident } from './state.ts'

export const perkLevel = (game: Game, id: PerkId): number =>
  game.sandbox ? 0 : Math.min(PERKS[id].costs.length, game.founding.perks[id] ?? 0)

const researchedSets = new WeakMap<ReadonlyArray<ResearchId>, ReadonlySet<ResearchId>>()

export const has = (game: Game, id: ResearchId): boolean => {
  let set = researchedSets.get(game.researched)
  if (!set) {
    set = new Set(game.researched)
    researchedSets.set(game.researched, set)
  }
  return set.has(id)
}

export const insightTotal = (pools: Readonly<Record<string, number>>): number =>
  Object.values(pools).reduce((sum, value) => sum + value, 0)

export const sreStaffed = (game: Game): boolean =>
  game.teams.some(
    (team) =>
      team.kind === 'sre' &&
      teamReady(game, team) &&
      !teamBoosting(game, team) &&
      game.engineers.some((engineer) => engineer.team === team.id),
  )

export const securityStaffed = (game: Game): boolean =>
  game.teams.some(
    (team) =>
      team.kind === 'security' &&
      teamReady(game, team) &&
      !teamBoosting(game, team) &&
      game.engineers.some((engineer) => engineer.team === team.id),
  )

export const eraOf = (game: Game): EraDef => ERAS[Math.min(game.stage, ERAS.length - 1)] as EraDef

export const nextEra = (game: Game): EraDef | undefined => ERAS[game.stage + 1]

export const isFinalEra = (game: Game): boolean => game.stage >= ERAS.length - 1

export const buildItems = (group: DockGroup): ReadonlyArray<ComponentId> =>
  COMPONENT_IDS.filter((type) => DOCK_OF[type] === group && !COMPONENTS[type].fixed)

export const isUnlocked = (game: Game, type: ComponentId): boolean => {
  const unlock = COMPONENTS[type].unlock
  return unlock === null || has(game, unlock)
}

export const researchReady = (game: Game, id: ResearchId): boolean =>
  RESEARCH[id].era <= game.stage && RESEARCH[id].requires.every((needed) => has(game, needed))

export const needs = (id: ResearchId, other: ResearchId): boolean =>
  RESEARCH[id].requires.some((needed) => needed === other || needs(needed, other))

export const missingPrerequisites = (game: Game, id: ResearchId): ReadonlyArray<ResearchId> => {
  const missing: Array<ResearchId> = []
  const visit = (needed: ResearchId): void => {
    if (has(game, needed) || missing.includes(needed)) return
    for (const before of RESEARCH[needed].requires) visit(before)
    missing.push(needed)
  }
  for (const needed of RESEARCH[id].requires) visit(needed)
  return missing
}

export const researchAffordable = (game: Game): boolean =>
  insightTotal(game.pools) >=
  Math.min(
    ...researchList
      .filter((entry) => !has(game, entry.id) && researchReady(game, entry.id))
      .map((entry) => entry.cost),
  )

export const runtimeReady = (game: Game, runtime: RuntimeId): boolean => {
  const needed = RUNTIMES[runtime].research
  return needed === null || has(game, needed)
}

export const frameworkReady = (game: Game, framework: FrameworkId): boolean => {
  const needed = FRAMEWORK_RESEARCH[framework]
  return needed === null || has(game, needed)
}

export const sizeName = (node: GameNode): string => SIZES[node.size]?.name ?? 'custom'

export const sizeLabel = (node: GameNode, size = node.size): string =>
  COMPONENTS[node.type].sized ? (SIZES[size]?.name ?? '') : `size ${size}`

export const flatScale = (node: GameNode): number => grown(1, 2, node.size - 1)

export const hasPricing = (node: GameNode): boolean =>
  COMPONENTS[node.type].sized && COMPONENTS[node.type].group === 'compute'

export const sampleIndex = (node: GameNode): number => {
  const index = (SAMPLE_RATES as ReadonlyArray<number>).indexOf(node.sampleRate)
  return index === -1 ? 2 : index
}

export const vcpuOf = (node: GameNode): number =>
  node.parts.cpu ? (SIZES[node.size]?.vcpu ?? 1) : 0

export const stuffing = (game: Game): boolean => activeIncident(game)?.kind === 'stuffing'

export const hopMs = (game: Game): number => HOP_MS + (has(game, 'keepalive') ? 0 : HANDSHAKE_MS)

export const zoned = (node: GameNode): boolean =>
  COMPONENTS[node.type].limiting &&
  !COMPONENTS[node.type].fixed &&
  !ZONE_SPANNING_COMPONENTS.includes(node.type) &&
  !((node.type === 'wide' || node.type === 'dsql') && node.spread)

export const zoneMs = (from: GameNode, to: GameNode): number =>
  zoned(from) && zoned(to) && from.zone !== to.zone ? CROSS_ZONE_MS : 0

export const ramOf = (node: GameNode): number =>
  node.parts.ram ? vcpuOf(node) * FAMILIES[node.family].ramPerVcpu : 0

export const isDown = (node: GameNode): boolean =>
  node.life._tag === 'Restarting' || node.life._tag === 'Stopped'

export const inCluster = (game: Game, node: GameNode): boolean =>
  clusterOf(game, node) !== undefined

export const clusterOf = (game: Game, node: GameNode): string | undefined =>
  node.type === 'server' || node.type === 'worker' ? clusteredOf(game).get(node.id) : undefined

const clustered = new WeakMap<Game, ReadonlyMap<string, string>>()
const clusteredOf = (game: Game): ReadonlyMap<string, string> => {
  let ids = clustered.get(game)
  if (!ids) {
    const live = new Set(
      game.nodes
        .filter((entry) => entry.type === 'cluster' && !isDown(entry))
        .map((entry) => entry.id),
    )
    const found = new Map<string, string>()
    for (const link of game.links)
      if (live.has(link.to) && !found.has(link.from)) found.set(link.from, link.to)
    ids = found
    clustered.set(game, ids)
  }
  return ids
}

export const podsOf = (game: Game, cluster: GameNode): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => clusterOf(game, node) === cluster.id)

export const bootingOf = (node: GameNode): number =>
  node.scaler._tag === 'Scaling' ? node.scaler.pending : 0

export const copiesOf = (node: GameNode): number => node.replicas + bootingOf(node)

export const restartSeconds = (node: GameNode): number =>
  node.type === 'server'
    ? Math.max(
        VM_RESTART_SECONDS,
        RUNTIMES[node.runtime].startupSeconds + FRAMEWORKS[node.framework].startupSeconds,
      )
    : RESTART_SECONDS

export const warmAfterRestart = (node: GameNode, warming = false): number =>
  node.type === 'cache'
    ? Math.max(CACHE_ENGINES[node.engine].warmAfterRestart, warming ? WARMED : 0)
    : 0

export const restarted = (node: GameNode, cause: DownCause = 'restart', warming = false) => ({
  leak: 0,
  life: restarting(restartSeconds(node), cause, warmAfterRestart(node, warming)),
  ...(node.service._tag === 'Shut' ? { service: { _tag: 'InService' as const } } : {}),
})

export const languageOf = (node: GameNode) => RUNTIMES[node.runtime].language

export const coldStartMs = (node: GameNode): number => {
  const runtime = RUNTIMES[node.runtime]
  return runtime.id === 'graal' || runtime.id === 'native_aot'
    ? NATIVE_COLD_MS
    : (COLD_START_MS[runtime.language] ?? NATIVE_COLD_MS)
}

export const hasEdge = (game: Game): boolean =>
  game.nodes.some((node) => node.type === 'edge' && !isDown(node))

export const logReplicas = (node: GameNode): number =>
  Math.max(1, Math.min(LOG_REPLICAS[LOG_REPLICAS.length - 1] ?? 3, Math.floor(node.n)))

export const logLoss = (node: GameNode): number =>
  logReplicas(node) <= 1 ? 1 : LOG_LOSS[node.acks]

const meshed = new WeakMap<Game, ReadonlyMap<string, ReadonlyArray<GameNode>>>()

const meshMembersOf = (game: Game): ReadonlyMap<string, ReadonlyArray<GameNode>> => {
  let map = meshed.get(game)
  if (!map) {
    const live = new Set(
      game.nodes
        .filter((entry) => entry.type === 'mesh' && !isDown(entry))
        .map((entry) => entry.id),
    )
    const found = new Map<string, Array<GameNode>>()
    const byId = new Map(game.nodes.map((node) => [node.id, node]))
    for (const link of game.links) {
      if (!live.has(link.to)) continue
      const member = byId.get(link.from)
      if (!member || (member.type !== 'server' && member.type !== 'worker')) continue
      if (!inCluster(game, member)) continue
      found.set(link.to, [...(found.get(link.to) ?? []), member])
    }
    map = found
    meshed.set(game, map)
  }
  return map
}

export const meshOf = (game: Game, node: GameNode): boolean => {
  if (node.type !== 'server' && node.type !== 'worker') return false
  for (const members of meshMembersOf(game).values())
    if (members.some((member) => member.id === node.id)) return true
  return false
}

export const meshMembers = (game: Game, mesh: GameNode): ReadonlyArray<GameNode> =>
  meshMembersOf(game).get(mesh.id) ?? []

export const certLifeOf = (game: Game, tuning: Tuning = LIVE_TUNING): number =>
  ((game.stage >= CERT_SHORT_FROM ? CERT_DAYS_SHORT : CERT_DAYS) * CALENDAR_DAY) /
  tuning.calendarPace

export const certNodes = (game: Game): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => TLS_TERMINATORS.includes(node.type) && node.certUntil !== null)

export const certExpired = (game: Game, node: GameNode): boolean =>
  node.certUntil !== null && game.time >= node.certUntil

export const certLeftOf = (game: Game, node: GameNode): number | null =>
  node.certUntil === null ? null : node.certUntil - game.time

export const certDaysOf = (game: Game): number =>
  game.stage >= CERT_SHORT_FROM ? CERT_DAYS_SHORT : CERT_DAYS

export const nodeCertDaysLeft = (
  game: Game,
  node: GameNode,
  tuning: Tuning = LIVE_TUNING,
): number | null => {
  const left = certLeftOf(game, node)
  return left === null ? null : (left * tuning.calendarPace) / CALENDAR_DAY
}

export const certDaysLeft = (game: Game, tuning: Tuning = LIVE_TUNING): number | null => {
  let soonest: number | null = null
  for (const node of certNodes(game)) {
    const left = nodeCertDaysLeft(game, node, tuning)
    if (left !== null && (soonest === null || left < soonest)) soonest = left
  }
  return soonest
}

export const certManaged = (game: Game): boolean =>
  game.nodes.some((node) => node.type === 'pki' && !isDown(node))

export const grown = (base: number, factor: number, steps: number): number => {
  let value = base
  for (let index = 0; index < steps; index += 1) value *= factor
  for (let index = 0; index > steps; index -= 1) value /= factor
  return value
}

export const spreadCount = (game: Game): number =>
  Math.min(
    SPREAD_REGIONS,
    new Set([
      'na',
      ...game.nodes.filter((node) => node.type === 'users').map((node) => node.region),
    ]).size,
  )

export const pricingOf = (game: Game, node: GameNode): Pricing =>
  node.pricing === 'reserved' && !(node.pricingUntil !== null && node.pricingUntil > game.time)
    ? 'on-demand'
    : node.pricing

const CLASS_ORDER: ReadonlyArray<StorageClass> = ['standard', 'infrequent', 'archive']

const SIM_SECONDS_PER_CALENDAR_DAY = 1_440

export const agedShareOf = (game: Game, days: number): number => {
  if (days <= 0) return 0
  const perDay = game.uploads * SIM_SECONDS_PER_CALENDAR_DAY
  if (perDay <= 0 || game.stored <= 0) return 0
  return Math.max(0, Math.min(1, 1 - days / (game.stored / perDay)))
}

export type StorageBand = Readonly<{
  gb: number
  price: number
  retrieval: number
  archived: boolean
}>

export const storageBands = (game: Game, node: GameNode): ReadonlyArray<StorageBand> => {
  const mine = STORAGE_CLASSES[node.storageClass]
  const share = node.lifecycle > 0 ? agedShareOf(game, node.lifecycle) : 0
  if (share <= 0) return [{ gb: game.stored, ...mine }]
  const older =
    CLASS_ORDER[Math.min(CLASS_ORDER.length - 1, CLASS_ORDER.indexOf(node.storageClass) + 1)] ??
    node.storageClass
  return [
    { gb: game.stored * (1 - share), ...mine },
    { gb: game.stored * share, ...STORAGE_CLASSES[older] },
  ]
}

export const storageBurnOf = (game: Game, node: GameNode): number =>
  storageBands(game, node).reduce((sum, band) => sum + band.gb * STORAGE_PRICE * band.price, 0)

export const DB_GB_PRICE = STORAGE_PRICE * DB_STORAGE_MULT

const databases = new WeakMap<Game, ReadonlyArray<GameNode>>()
export const databasesOf = (game: Game): ReadonlyArray<GameNode> => {
  let found = databases.get(game)
  if (!found) {
    found = game.nodes.filter((node) => node.type === 'database')
    databases.set(game, found)
  }
  return found
}

export const dataGroupOf = (game: Game, node: GameNode): string => {
  const primary = primaryOf(game, node)
  if (primary) return dataGroupOf(game, primary)
  const box = game.boxes.find((entry) => entry.nodes.includes(node.id))
  return box ? box.id : node.id
}

export const databasesOfGroup = (game: Game, group: string): ReadonlyArray<GameNode> =>
  databasesOf(game).filter((node) => dataGroupOf(game, node) === group)

export const topologyOfGroup = (game: Game, group: string): DbTopology => {
  const databases = databasesOfGroup(game, group)
  if (databases.length <= 1) return 'single'
  if (databases.some((node) => node.topology === 'multi')) return 'multi'
  if (databases.some((node) => node.topology === 'sharded')) return 'sharded'
  return 'single'
}

export const leaderOfGroup = (game: Game, group: string): GameNode | null => {
  const databases = databasesOfGroup(game, group)
  return databases.length === 1 && topologyOfGroup(game, group) === 'single' ? databases[0]! : null
}

export const replicasOfGroup = (game: Game, group: string): ReadonlyArray<GameNode> =>
  game.nodes.filter((node) => node.type === 'replica' && dataGroupOf(game, node) === group)

export const replicationPairsOf = (game: Game): ReadonlyArray<{ from: GameNode; to: GameNode }> =>
  game.nodes.flatMap((node) => {
    const primary = primaryOf(game, node)
    return primary ? [{ from: primary, to: node }] : []
  })

export const datastoreNodeOf = (game: Game, service: Service): GameNode | null => {
  const pinned = service.datastore._tag === 'Pinned' ? service.datastore.id : undefined
  const id =
    pinned !== undefined && game.nodes.some((node) => node.id === pinned)
      ? pinned
      : databasesOf(game)[0]?.id
  return id ? (game.nodes.find((node) => node.id === id) ?? null) : null
}

export const dataGroupOfService = (game: Game, service: Service): string | null => {
  const node = datastoreNodeOf(game, service)
  return node ? dataGroupOf(game, node) : null
}

export const groupDataOf = (game: Game, group: string): number => {
  const services = game.services
  if (services.length === 0) {
    const first = databasesOf(game)[0]
    return first && dataGroupOf(game, first) === group ? game.data : 0
  }
  const share = game.data / services.length
  return services.reduce(
    (sum, service) => (dataGroupOfService(game, service) === group ? sum + share : sum),
    0,
  )
}

export const groupServicesOf = (game: Game, group: string): ReadonlyArray<Service> =>
  servicesByGroupOf(game).get(group) ?? []

const servicesByGroup = new WeakMap<Game, ReadonlyMap<string | null, ReadonlyArray<Service>>>()
const servicesByGroupOf = (game: Game): ReadonlyMap<string | null, ReadonlyArray<Service>> => {
  let found = servicesByGroup.get(game)
  if (!found) {
    const grouped = new Map<string | null, Array<Service>>()
    for (const service of game.services) {
      const group = dataGroupOfService(game, service)
      const list = grouped.get(group)
      if (list) list.push(service)
      else grouped.set(group, [service])
    }
    found = grouped
    servicesByGroup.set(game, found)
  }
  return found
}

export const usersOfGroup = (game: Game, group: string): number => {
  const services = game.services
  if (services.length === 0) {
    const first = databasesOf(game)[0]
    return first && dataGroupOf(game, first) === group ? game.users : 0
  }
  return (game.users * groupServicesOf(game, group).length) / services.length
}

export const dataOf = (game: Game, node: GameNode): number => {
  if (node.type !== 'database') return 0
  const group = dataGroupOf(game, node)
  const databases = databasesOfGroup(game, group)
  if (databases.length <= 1) return groupDataOf(game, group)
  return topologyOfGroup(game, group) === 'multi'
    ? groupDataOf(game, group)
    : groupDataOf(game, group) / databases.length
}

export const primaryOf = (game: Game, node: GameNode): GameNode | undefined => {
  if (node.type !== 'replica') return undefined
  for (const link of game.links) {
    if (link.to !== node.id) continue
    const from = game.nodes.find((entry) => entry.id === link.from)
    if (from?.type === 'database') return from
  }
  return undefined
}

export const engineOf = (game: Game, node: GameNode): DbEngine => {
  if (node.type !== 'replica') return node.dbEngine
  return primaryOf(game, node)?.dbEngine ?? node.dbEngine
}

export const dataBurnOf = (game: Game, node: GameNode): number =>
  dataOf(game, node) *
  DB_GB_PRICE *
  (node.type === 'database' ? DB_RETENTIONS[node.keep].price : 1) *
  eraOf(game).costIndex

export const searchVolumeBurnOf = (game: Game, node: GameNode): number =>
  node.type === 'search'
    ? game.data *
      SEARCH_INDEX_SHARE *
      (SEARCH_VARIANTS[node.searchVariant].jvm ? 1 + node.searchReplicas : 1) *
      DB_GB_PRICE
    : 0

export const storageRequestBurnOf = (node: GameNode, gets: number, puts: number): number =>
  node.type === 'storage'
    ? gets * STORE_VARIANTS[node.storeVariant].get + puts * STORE_VARIANTS[node.storeVariant].put
    : 0

export const burnOf = (game: Game, node: GameNode): number => {
  if (node.service._tag === 'Shut') return 0
  const def = COMPONENTS[node.type]
  if (def.sized && !provisioned(node)) return 0
  const index = eraOf(game).costIndex
  if (def.sized) {
    const savings = def.group === 'compute' && has(game, 'savings-plans') ? SAVINGS_PLAN_RATE : 1
    const box =
      vcpuOf(node) *
      VCPU_PRICE *
      FAMILIES[node.family].price *
      PRICINGS[pricingOf(game, node)].price *
      savings *
      index
    const one =
      node.type === 'database'
        ? box *
            (node.backup !== 'none' ? 1 + BACKUPS[node.backup].burn : 1) *
            STORAGE_IOPS[node.iops].burn *
            Math.max(1, Math.floor(node.shards)) +
          dataBurnOf(game, node)
        : node.type === 'replica'
          ? box * REPLICA_BOX_PRICE
          : box
    if (node.standby) return one * 2
    if (copiesOf(node) === 1 && !inCluster(game, node)) return one
    return one * copiesOf(node) * (inCluster(game, node) ? POD_BURN : 1)
  }
  if (node.type === 'analytics')
    return (
      def.burn *
      (SAMPLE_STORAGE[sampleIndex(node)] ?? 1) *
      (RETENTION_STORAGE[(RETENTION_WINDOWS as ReadonlyArray<number>).indexOf(node.retention)] ??
        1) *
      flatScale(node) *
      index
    )
  if (node.type === 'auth') return game.users * AUTH_PRICE_PER_USER
  if (node.type === 'ci')
    return (
      def.burn *
      DEPLOY_STRATEGIES[node.strategy].burn *
      flatScale(node) *
      index *
      (node.standby ? 2 : 1)
    )
  if (node.type === 'storage') return (def.burn + storageBurnOf(game, node)) * index
  if (node.type === 'search') {
    const variant = SEARCH_VARIANTS[node.searchVariant]
    const copies = variant.jvm ? Math.max(1, node.searchShards) * (1 + node.searchReplicas) : 1
    return (
      (def.burn * flatScale(node) * variant.burn * copies * (node.standby ? 2 : 1) +
        searchVolumeBurnOf(game, node)) *
      index
    )
  }
  if (node.type === 'vec')
    return def.burn * VEC_INDEXES[node.indexType].burn * flatScale(node) * index
  if (node.type === 'log')
    return (
      def.burn *
      (1 + (logReplicas(node) - 1) * LOG_REPLICA_BURN) *
      flatScale(node) *
      index *
      (node.standby ? 2 : 1)
    )
  if (node.type === 'gpu') return GPU_TYPES[node.gpu].burn * flatScale(node) * index
  if (node.type === 'mesh')
    return (
      MESH_OVERHEAD * meshMembers(game, node).reduce((sum, member) => sum + burnOf(game, member), 0)
    )
  if ((node.type === 'wide' || node.type === 'dsql') && node.spread)
    return def.burn * flatScale(node) * index * spreadCount(game)
  const variant = node.type === 'lb' && node.variant === 'l4' ? L4_BURN : 1
  return def.burn * flatScale(node) * index * (node.standby ? 2 : 1) * variant
}

export const serverlessBurnOf = (
  game: Game,
  node: GameNode,
  done: number,
  meanMs: number,
): number =>
  node.type !== 'fn'
    ? 0
    : done *
      (SERVERLESS_REQUEST_PRICE + SERVERLESS_GB_SECOND * SERVERLESS_MEMORY_GB * (meanMs / 1_000)) *
      eraOf(game).costIndex

export const edgeBurnOf = (game: Game, node: GameNode, done: number): number =>
  node.type !== 'edge' ? 0 : done * EDGE_REQUEST_PRICE * eraOf(game).costIndex

export type BurnShares = Readonly<{
  compute: number
  data: number
  storage: number
  observability: number
}>

export const burnSharesOf = (game: Game): BurnShares => {
  const index = eraOf(game).costIndex
  let compute = 0
  let data = 0
  let storage = 0
  let observability = 0
  for (const node of game.nodes) {
    const burn = burnOf(game, node)
    if (node.type === 'analytics') {
      observability += burn
      continue
    }
    if (COMPONENTS[node.type].group === 'data') {
      data += burn
      if (node.type === 'database') storage += dataBurnOf(game, node)
      if (node.type === 'storage') storage += storageBurnOf(game, node) * index
      if (node.type === 'search') storage += searchVolumeBurnOf(game, node) * index
    } else compute += burn
  }
  return { compute, data: data - storage, storage, observability }
}

const copyPrice = (game: Game, type: ComponentId, count: number): number =>
  Math.round(grown(COMPONENTS[type].cost, COPY_PRICE_GROWTH, count) * eraOf(game).costIndex)

export const priceOf = (game: Game, type: ComponentId): number => {
  if (game.sandbox) return 0
  return copyPrice(game, type, game.nodes.filter((node) => node.type === type).length)
}

export const refundOf = (game: Game, node: GameNode): number => {
  if (game.sandbox) return 0
  const count = game.nodes.filter((entry) => entry.type === node.type).length
  return Math.round(
    (copyPrice(game, node.type, Math.max(0, count - 1)) + partsValueOf(game, node)) * SELL_REFUND,
  )
}

export const owedOf = (game: Game, node: GameNode): number =>
  game.sandbox || node.pricing !== 'reserved' || node.pricingUntil === null
    ? 0
    : burnOf(game, node) * Math.max(0, node.pricingUntil - game.time)

export const maxSize = (node: GameNode): number =>
  COMPONENTS[node.type].sized ? SIZES.length - 1 : Math.max(node.size, COMPONENTS[node.type].steps)

export const resizePrice = (game: Game, node: GameNode): number | null => {
  if (node.size >= maxSize(node)) return null
  if (game.sandbox) return 0
  const index = eraOf(game).costIndex
  if (node.type === 'payments') return Math.round(grown(40, 3, node.size - 1) * index)
  if (node.type === 'analytics') return Math.round(grown(40, 2, node.size) * index)
  if (COMPONENTS[node.type].sized)
    return Math.round(COMPONENTS[node.type].cost * 2 * (SIZES[node.size + 1]?.vcpu ?? 0) * index)
  return Math.round(grown(COMPONENTS[node.type].cost, 2, node.size + 1) * index)
}

export const replacePrice = (game: Game, node: GameNode): number =>
  game.sandbox ? 0 : Math.round(COMPONENTS[node.type].cost * 0.5 * eraOf(game).costIndex)

export const drawerSize = (game: Game, revenue: number): number => {
  const payments = game.nodes.find((node) => node.type === 'payments')
  return Math.max(DRAWER_MIN, revenue * DRAWER_SECONDS) * grown(1, 2, (payments?.size ?? 1) - 1)
}

export const shardingOf = (node: GameNode) => {
  const shards = Math.max(1, Math.floor(node.shards))
  const key = SHARD_KEYS[node.shardKey]
  const cross = shards > 1 ? key.cross * (1 - 1 / shards) : 0
  return {
    shards,
    hot: shards > 1 ? key.hot + (1 - key.hot) / shards : 1,
    cross,
    scatter: 1 + SCATTER_CPU * (shards - 1),
    scatterMs: SCATTER_MS * (shards - 1),
    farMs: shards > 1 ? key.farMs * (1 - 1 / shards) : 0,
    failure: cross * DISTRIBUTED_TX_FAILURE * shards,
  }
}

export const syncReplicasOf = (game: Game, group: string): ReadonlyArray<GameNode> =>
  has(game, 'sync-replication')
    ? game.nodes.filter(
        (node) =>
          node.type === 'replica' &&
          node.sync &&
          node.service._tag !== 'Shut' &&
          dataGroupOf(game, node) === group,
      )
    : []

export const syncWaitMs = (game: Game, database: GameNode): number => {
  const replicaWait = syncReplicasOf(game, dataGroupOf(game, database)).reduce(
    (most, replica) =>
      Math.max(
        most,
        SYNC_MS +
          (replica.region !== database.region
            ? rttOf(database.region, replica.region)
            : replica.zone !== database.zone
              ? CROSS_ZONE_MS
              : 0),
      ),
    0,
  )
  const standbyWait =
    database.standby && database.standbySync && database.type === 'database'
      ? SYNC_MS + CROSS_ZONE_MS
      : 0
  return Math.max(replicaWait, standbyWait)
}

export const syncStalled = (game: Game, group: string): boolean =>
  syncReplicasOf(game, group).some((replica) => isDown(replica))

export const cacheKeyHit = (node: GameNode): number => CACHE_KEYS[node.cacheKey].hit

export const rampedOf = (game: Game, node: GameNode): boolean => rampedIdsOf(game).has(node.id)

const ramped = new WeakMap<Game, ReadonlySet<string>>()
const rampedIdsOf = (game: Game): ReadonlySet<string> => {
  let ids = ramped.get(game)
  if (!ids) {
    const slowStart = new Set(
      game.nodes.filter((entry) => entry.type === 'lb' && entry.slowStart).map((entry) => entry.id),
    )
    ids = new Set(game.links.filter((link) => slowStart.has(link.from)).map((link) => link.to))
    ramped.set(game, ids)
  }
  return ids
}
