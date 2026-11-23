import { COMPONENT_DEFS } from '../components/defs.ts'
import { CALENDAR_DAY } from './team.ts'
import type { Kind, RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'

export const COMPONENT_IDS = [
  'users',
  'payments',
  'analytics',
  'server',
  'database',
  'dns',
  'lb',
  'pooler',
  'cache',
  'replica',
  'auth',
  'search',
  'storage',
  'doc',
  'queue',
  'worker',
  'log',
  'fn',
  'cdn',
  'waf',
  'gw',
  'ws',
  'psp',
  'autoscaler',
  'ci',
  'cluster',
  'warehouse',
  'vec',
  'gpu',
  'edge',
  'llm',
  'msgp',
  'wide',
  'dsql',
  'cdc',
  'mesh',
  'ff',
  'pki',
] as const
export type ComponentId = (typeof COMPONENT_IDS)[number]

export type BuildGroup = 'edge' | 'compute' | 'data' | 'ops'

export const BUILD_GROUPS: ReadonlyArray<Readonly<{ key: BuildGroup; label: string }>> = [
  { key: 'edge', label: 'Edge' },
  { key: 'compute', label: 'Compute' },
  { key: 'data', label: 'Data' },
  { key: 'ops', label: 'Ops' },
]

export type DockGroup =
  | 'edge'
  | 'compute'
  | 'data'
  | 'messaging'
  | 'platform'
  | 'insight'
  | 'managed'

export const DOCK_GROUPS: ReadonlyArray<
  Readonly<{ key: DockGroup; label: string; family: BuildGroup }>
> = [
  { key: 'edge', label: 'Edge', family: 'edge' },
  { key: 'compute', label: 'Compute', family: 'compute' },
  { key: 'data', label: 'Data', family: 'data' },
  { key: 'messaging', label: 'Messaging', family: 'compute' },
  { key: 'platform', label: 'Platform', family: 'ops' },
  { key: 'insight', label: 'Observability', family: 'ops' },
  { key: 'managed', label: 'Managed', family: 'data' },
]

export const DOCK_OF: Readonly<Record<ComponentId, DockGroup>> = {
  users: 'edge',
  dns: 'edge',
  lb: 'edge',
  cdn: 'edge',
  waf: 'edge',
  gw: 'edge',
  server: 'compute',
  worker: 'compute',
  fn: 'compute',
  cluster: 'compute',
  gpu: 'compute',
  edge: 'compute',
  database: 'data',
  pooler: 'data',
  cache: 'data',
  replica: 'data',
  search: 'data',
  storage: 'data',
  doc: 'data',
  warehouse: 'data',
  vec: 'data',
  wide: 'data',
  dsql: 'data',
  queue: 'messaging',
  log: 'messaging',
  cdc: 'messaging',
  ws: 'messaging',
  autoscaler: 'platform',
  ci: 'platform',
  mesh: 'platform',
  ff: 'platform',
  pki: 'platform',
  analytics: 'insight',
  payments: 'insight',
  auth: 'managed',
  psp: 'managed',
  llm: 'managed',
  msgp: 'managed',
}

export type ComponentDef = Readonly<{
  id: ComponentId
  code: string
  name: string
  product: string
  group: BuildGroup
  blurb: string
  cost: number
  burn: number
  sized: boolean
  steps: number
  latency: number
  accepts: ReadonlyArray<Kind>
  sends: ReadonlyArray<Kind>
  fallback: ReadonlyArray<Kind>
  stack: boolean
  limiting: boolean
  coldStart: boolean
  maxOut: number
  tap: boolean
  mirror: boolean
  control: boolean
  unlock: ResearchId | null
  fixed: boolean
}>

export const TLS_TERMINATORS: ReadonlyArray<ComponentId> = ['lb', 'cdn', 'waf', 'gw', 'ws', 'edge']

export const COMPONENTS: Record<ComponentId, ComponentDef> = COMPONENT_DEFS

export const INTERNET_MS = 30

export const UPLOAD_MB = 2

export const EGRESS_ORIGIN = 0.45
export const EGRESS_CDN = 0.1

export const AUTHENTICATED_KINDS: ReadonlyArray<RequestKind> = [
  'read',
  'write',
  'search',
  'upload',
  'buy',
  'job',
  'report',
  'ai',
  'feed',
  'hook',
]
export const AUTH_CHECK_MS = 0.02

export const ZONES = ['a', 'b', 'c'] as const
export const GLOBAL_COMPONENTS: ReadonlyArray<ComponentId> = [
  'psp',
  'llm',
  'msgp',
  'auth',
  'cdn',
  'analytics',
  'payments',
]
export const ZONE_SPANNING_COMPONENTS: ReadonlyArray<ComponentId> = [
  'psp',
  'llm',
  'lb',
  'waf',
  'gw',
]
export const CROSS_ZONE_MS = 1
export const EGRESS_CROSS_ZONE = 0.01
export const BACKEND_KB = 4
export const STANDBY_TYPES: ReadonlyArray<ComponentId> = [
  'database',
  'pooler',
  'cache',
  'search',
  'queue',
]
export const FAILOVER_SECONDS = 20

export const TOKENS_PER_PROMPT = 400

export const BREAKER_THRESHOLD = 0.5
export const BREAKER_OPEN = 5

export const BULKHEAD_MS = 1_000
export const HEDGE_LOAD = 0.1
export const SERIALIZE_MS = 0.02
export const DUAL_WRITE_STALE = 0.005
export const OUTBOX_STALE = 0.0005
export const CDC_LAG_STALE = 0.0002
export const CDC_DROP_STALE = 0.005
export const CHAOS_EVERY = 120
export const CHAOS_SECONDS = 10
export const CHAOS_FAILURE = 0.2
export const CHAOS_INSIGHT = 1
export const LOAD_TEST_INSIGHT = 2
export const DRILL_INSIGHT = 5

export const FIRST_KIND_INSIGHT = 20
export const INSIGHT_YIELD = 1
export const FAILURE_YIELD = 3
export const POOL_FLOOR = 100

export const SPREAD_REGIONS = 3
export const SPREAD_REPLICATION_KB = 1
export const WIDE_SPREAD_LAG_STALE = 0.015
export const WIDE_REBALANCE_MINUTES_PER_GB = 0.4
export const DOC_REBALANCE_MINUTES_PER_GB = 0.4
export const LOG_REPLICATE_MINUTES_PER_GB = 0.25

export const HOT_KEY_SHARE = 0.3

export const PRICING_IDS = ['on-demand', 'reserved', 'spot'] as const
export type PricingId = (typeof PRICING_IDS)[number]

export type PricingDef = Readonly<{
  id: PricingId
  name: string
  price: number
  blurb: string
}>

export const PRICINGS: Record<PricingId, PricingDef> = {
  'on-demand': {
    id: 'on-demand',
    name: 'On-demand',
    price: 1,
    blurb: 'Full rate. Remove the Node at any time.',
  },
  reserved: {
    id: 'reserved',
    name: 'Reserved',
    price: 0.6,
    blurb:
      '0.6×, for a commitment of one calendar week. Selling before the term ends owes the Burn.',
  },
  spot: {
    id: 'spot',
    name: 'Spot',
    price: 0.3,
    blurb: '0.3×. The provider can reclaim the Node after 10 s of warning.',
  },
}

export const SAVINGS_PLAN_RATE = 0.8

export const PRICING_FROM_STAGE = 3
export const RESERVED_SECONDS = 7 * CALENDAR_DAY

export const STICKY_LOCAL_READ = 0.15
export const STICKY_HERD = 0.5

export {
  SERVERLESS_MS,
  SERVERLESS_REQUEST_PRICE,
  SERVERLESS_GB_SECOND,
  SERVERLESS_MEMORY_GB,
  SERVERLESS_CONCURRENCY,
  SERVERLESS_IDLE_SECONDS,
  COLD_START_MS,
  NATIVE_COLD_MS,
  FUNCTION_LIMIT_MS,
  EXPORT_MS_PER_GB,
} from '../components/fn.ts'
export {
  EDGE_MS,
  EDGE_REQUEST_PRICE,
  EDGE_CPU_MS,
  EDGE_MEMORY_MB,
  EDGE_LANGUAGES,
  EDGE_READ_HIT,
} from '../components/edge.ts'
export {
  DOC_OPS,
  DOC_JOIN_COST,
  DOC_OP_MS,
  DOC_TXN_LATENCY,
  DOC_PARTIAL,
  DOC_PATTERN_FACTOR,
  DOC_SHAPE_DH,
} from '../components/doc.ts'
export { VEC_QUERIES, VEC_INDEXES, VEC_AI_LIFT } from '../components/vec.ts'
export {
  LOG_RATE,
  LOG_READ_RATE,
  LOG_PARTITIONS,
  LOG_ACKS,
  LOG_RETENTION,
  LOG_REPLICA_BURN,
  LOG_REPLICAS,
  LOG_LOSS,
} from '../components/log.ts'
export { CDC_MS, CDC_RATE, CDC_CHANGES } from '../components/cdc.ts'
export { MESH_HOP_MS, MESH_OVERHEAD, MESH_INSIGHT, MESH_TAX } from '../components/mesh.ts'
export { ROLLOUT_STEPS, ROLLOUT_ALL } from '../components/ff.ts'
export {
  CERT_DAYS,
  CERT_DAYS_SHORT,
  CERT_FROM_STAGE,
  CERT_SHORT_FROM,
  CERT_RENEW,
} from '../components/pki.ts'
export {
  LB_POLICIES,
  P2C_CAPACITY,
  P2C_IMBALANCE,
  CHECK_INTERVALS,
  L4_CAPACITY,
  L4_MS,
  L4_BURN,
  LB_VARIANTS,
  type LbVariant,
  STICKY_SHARE,
  STICKY_DECAY,
} from '../components/lb.ts'
export { DNS_TTLS } from '../components/dns.ts'
export {
  CACHE_ENGINES,
  CACHE_TTLS,
  HOT_KB_PER_USER,
  HOT_BASE_USERS,
  CACHE_OPS,
  WRITE_BEHIND_SECONDS,
  CACHE_STRATEGIES,
  COALESCED,
  WARMED,
  EARLY_LIFT,
  EARLY_REFRESH,
} from '../components/cache.ts'
export {
  CDN_HIT,
  ANONYMOUS_PAGE,
  TIERED_MEDIA_HIT,
  CDN_TTLS,
  ESI_PAGE_HIT,
  STALE_AFTER_DEPLOY,
  CACHE_KEYS,
} from '../components/cdn.ts'
export { PARANOIA, UNDER_ATTACK, BOT_MANAGEMENT_FALSE } from '../components/waf.ts'
export {
  QUEUE_RATE,
  BACKLOG_MS,
  DRAIN_SECONDS,
  MAX_ATTEMPTS,
  FOREVER_ATTEMPTS,
  QUEUE_LENGTHS,
  QUEUE_MESSAGE_PRICE,
} from '../components/queue.ts'
export { POISON_SHARE, TASK_RETRY_SECONDS, PREFETCH, FETCH_MS } from '../components/worker.ts'
export { HUB_RAM_KB, PRESENCE_CPU, PRESENCE_VALUE, HERD_REFUSED } from '../components/ws.ts'
export {
  SEARCH_QPS,
  SEARCH_REFRESH,
  SEARCH_SHARDS,
  SEARCH_REPLICAS,
  SEARCH_FANOUT,
  SEARCH_HEAPS,
  SEARCH_VARIANTS,
  SEARCH_INDEX_SHARE,
} from '../components/search.ts'
export {
  STORAGE_PRICE,
  STORAGE_CLASSES,
  LIFECYCLE_DAYS,
  R2_FIRST_BYTE_MS,
  STORE_VARIANTS,
} from '../components/storage.ts'
export {
  DB_ENGINES,
  STORAGE_IOPS,
  SHARD_COUNTS,
  DB_RETENTIONS,
  ROW_KB,
  DB_STORAGE_MULT,
  RESTORE_FAILURE,
  RESTORE_DRILL_DH,
  diskMs,
  MATERIALIZED_SCAN,
  MATERIALIZED_STALE,
  DENORMALIZED_READ,
  DENORMALIZED_WRITE,
  BACKUPS,
  SHARD_KEYS,
  SCATTER_CPU,
  SCATTER_MS,
  DISTRIBUTED_TX_FAILURE,
  RESHARD_DH,
  RESHARD_IOPS,
  RESHARD_MINUTES_PER_GB,
  ONLINE_MIGRATION_DH,
  EXPAND_CONTRACT_DH,
  INDEX_WRITE_COST,
  RESTORE_MINUTES_PER_GB,
  RESTORE_MIN_MINUTES,
  MIGRATION_LOCK_PER_GB,
  MULTI_WRITE_CPU,
  MULTI_CONFLICT,
} from '../components/database.ts'
export { PSP_RATE, PSP_FIXED, SECOND_PROVIDER_FEE, PSP_CAPACITY } from '../components/psp.ts'
export {
  GATEWAY_PRICE,
  GATEWAY_LIMITS,
  GATEWAY_BURST,
  GATEWAY_AUTH_MS,
  COALESCE_KINDS,
  COALESCE_HOT,
  COALESCE_WINDOW,
} from '../components/gw.ts'
export {
  VM_REACTION_SECONDS,
  POD_REACTION_SECONDS,
  SCALE_COOLDOWN_SECONDS,
  SCALE_TARGETS,
  SCALE_MINIMA,
  SCALE_MAXIMA,
  SCALE_IN,
  SCHEDULE_LEAD_MINUTES,
  SCALE_RPS_PER_VCPU,
  SCALE_QUEUE_DEPTH,
} from '../components/autoscaler.ts'
export {
  POD_BURN,
  NOISY_SHARE,
  NOISY_MS,
  POD_RESCHEDULE_SECONDS,
  UPGRADE_CRASHES,
  SUPPORTED_QUARTERS,
  PLATFORM_TAX,
} from '../components/cluster.ts'
export {
  ROLLOUT_SHARE,
  DEPLOY_STRATEGY_IDS,
  type DeployStrategyId,
  type DeployStrategyDef,
  DEPLOY_STRATEGIES,
  STRATEGY_RESEARCH,
} from '../components/ci.ts'
export { SCAN_PRICE } from '../components/warehouse.ts'
export {
  GPU_TYPES,
  GPU_MODELS,
  type GpuModel,
  GPU_CACHE_GB,
  GPU_FIRST_TOKEN_MS,
  GPU_PRECISIONS,
  type GpuPrecision,
  GPU_BATCHES,
} from '../components/gpu.ts'
export { LLM_FIRST_TOKEN_MS, LLM_PRICE, LLM_RATE } from '../components/llm.ts'
export { AUTH_PRICE_PER_USER } from '../components/auth.ts'
export {
  SAMPLE_RATES,
  SAMPLE_OVERHEAD,
  SAMPLE_LATENCY,
  SAMPLE_STORAGE,
  RETENTION_WINDOWS,
  RETENTION_STORAGE,
  ANALYTICS_CAPACITY,
} from '../components/analytics.ts'
export { MSGP_RATE, MSGP_PRICE } from '../components/msgp.ts'
export {
  WIDE_OPS,
  QUORUM_N,
  WIDE_STALE,
  WIDE_TX_STALE,
  WIDE_TX_DUPLICATE,
} from '../components/wide.ts'
export { DSQL_TX, DSQL_READ_COST } from '../components/dsql.ts'
export { SYNC_MS, REPLICA_SYNC_MINUTES_PER_GB, REPLICA_BOX_PRICE } from '../components/replica.ts'
export { SEARCH_COPY_MINUTES_PER_GB } from '../components/search.ts'

export const FLAG_PROPAGATION_SECONDS = 2

export const FLAT_CAPACITY: Readonly<Record<string, number>> = {
  lb: 2_000,
  cache: 50_000,
  pooler: 10_000,
  search: 400,
  queue: 20_000,
  log: 100_000,
  waf: 5_000,
  gw: 10_000,
  edge: Number.POSITIVE_INFINITY,
}
