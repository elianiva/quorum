// Components, their groups, and the per-component tables are written in content/components.qm and
// compiled by qmc.
export {
  BUILD_GROUPS,
  COMPONENT_IDS,
  COMPONENTS,
  DOCK_GROUPS,
  DOCK_OF,
  FLAT_CAPACITY,
  GLOBAL_COMPONENTS,
  STANDBY_TYPES,
  TLS_TERMINATORS,
  ZONE_SPANNING_COMPONENTS,
  type BuildGroup,
  type ComponentDef,
  type ComponentId,
  type DockGroup,
  GATES,
  type GateDef,
  type GateKey,
  type GateValue,
} from '../generated/components.ts'

export type PricingId = (typeof PRICING_IDS)[number]

export type PricingDef = Readonly<{
  id: PricingId
  name: string
  price: number
  blurb: string
}>

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
} from '../generated/fn.ts'
export {
  EDGE_MS,
  EDGE_REQUEST_PRICE,
  EDGE_CPU_MS,
  EDGE_MEMORY_MB,
  EDGE_LANGUAGES,
  EDGE_READ_HIT,
} from '../generated/edge.ts'
export {
  DOC_OPS,
  DOC_JOIN_COST,
  DOC_OP_MS,
  DOC_TXN_LATENCY,
  DOC_PARTIAL,
  DOC_PATTERN_FACTOR,
  DOC_SHAPE_DH,
} from '../generated/doc.ts'
export { VEC_QUERIES, VEC_INDEXES, VEC_AI_LIFT } from '../generated/vec.ts'
export {
  LOG_RATE,
  LOG_READ_RATE,
  LOG_PARTITIONS,
  LOG_ACKS,
  LOG_RETENTION,
  LOG_REPLICA_BURN,
  LOG_REPLICAS,
  LOG_LOSS,
} from '../generated/log.ts'
export { CDC_MS, CDC_RATE, CDC_CHANGES } from '../generated/cdc.ts'
export { MESH_HOP_MS, MESH_OVERHEAD, MESH_INSIGHT, MESH_TAX } from '../generated/mesh.ts'
export { ROLLOUT_STEPS, ROLLOUT_ALL } from '../generated/ff.ts'
export {
  CERT_DAYS,
  CERT_DAYS_SHORT,
  CERT_FROM_STAGE,
  CERT_SHORT_FROM,
  CERT_RENEW,
} from '../generated/pki.ts'
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
} from '../generated/lb.ts'
export { DNS_TTLS } from '../generated/dns.ts'
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
} from '../generated/cache.ts'
export {
  CDN_HIT,
  ANONYMOUS_PAGE,
  TIERED_MEDIA_HIT,
  CDN_TTLS,
  ESI_PAGE_HIT,
  STALE_AFTER_DEPLOY,
  CACHE_KEYS,
} from '../generated/cdn.ts'
export { PARANOIA, UNDER_ATTACK, BOT_MANAGEMENT_FALSE } from '../generated/waf.ts'
export {
  QUEUE_RATE,
  BACKLOG_MS,
  DRAIN_SECONDS,
  MAX_ATTEMPTS,
  FOREVER_ATTEMPTS,
  QUEUE_LENGTHS,
  QUEUE_MESSAGE_PRICE,
} from '../generated/queue.ts'
export { POISON_SHARE, TASK_RETRY_SECONDS, PREFETCH, FETCH_MS } from '../generated/worker.ts'
export { HUB_RAM_KB, PRESENCE_CPU, PRESENCE_VALUE, HERD_REFUSED } from '../generated/ws.ts'
export {
  SEARCH_QPS,
  SEARCH_REFRESH,
  SEARCH_SHARDS,
  SEARCH_REPLICAS,
  SEARCH_FANOUT,
  SEARCH_HEAPS,
  SEARCH_VARIANTS,
  SEARCH_INDEX_SHARE,
} from '../generated/search.ts'
export {
  STORAGE_PRICE,
  STORAGE_CLASSES,
  LIFECYCLE_DAYS,
  R2_FIRST_BYTE_MS,
  STORE_VARIANTS,
} from '../generated/storage.ts'
export {
  DB_ENGINES,
  STORAGE_IOPS,
  SHARD_COUNTS,
  DB_RETENTIONS,
  ROW_KB,
  DB_STORAGE_MULT,
  RESTORE_FAILURE,
  RESTORE_DRILL_DH,
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
} from '../generated/database.ts'
export { PSP_RATE, PSP_FIXED, SECOND_PROVIDER_FEE, PSP_CAPACITY } from '../generated/psp.ts'
export {
  GATEWAY_PRICE,
  GATEWAY_LIMITS,
  GATEWAY_BURST,
  GATEWAY_AUTH_MS,
  COALESCE_KINDS,
  COALESCE_HOT,
  COALESCE_WINDOW,
} from '../generated/gw.ts'
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
} from '../generated/autoscaler.ts'
export {
  POD_BURN,
  NOISY_SHARE,
  NOISY_MS,
  POD_RESCHEDULE_SECONDS,
  UPGRADE_CRASHES,
  SUPPORTED_QUARTERS,
  PLATFORM_TAX,
} from '../generated/cluster.ts'
export {
  ROLLOUT_SHARE,
  DEPLOY_STRATEGY_IDS,
  DEPLOY_STRATEGIES,
  STRATEGY_RESEARCH,
} from '../generated/ci.ts'
export type { DeployStrategyId, DeployStrategyDef } from '../components/ci.ts'
export { SCAN_PRICE } from '../generated/warehouse.ts'
export {
  GPU_TYPES,
  GPU_MODELS,
  type GpuModel,
  GPU_CACHE_GB,
  GPU_FIRST_TOKEN_MS,
  GPU_PRECISIONS,
  type GpuPrecision,
  GPU_BATCHES,
} from '../generated/gpu.ts'
export { LLM_FIRST_TOKEN_MS, LLM_PRICE, LLM_RATE } from '../generated/llm.ts'
export { AUTH_PRICE_PER_USER } from '../generated/auth.ts'
export {
  SAMPLE_RATES,
  SAMPLE_OVERHEAD,
  SAMPLE_LATENCY,
  SAMPLE_STORAGE,
  RETENTION_WINDOWS,
  RETENTION_STORAGE,
  ANALYTICS_CAPACITY,
} from '../generated/analytics.ts'
export { MSGP_RATE, MSGP_PRICE } from '../generated/msgp.ts'
export {
  WIDE_OPS,
  QUORUM_N,
  WIDE_STALE,
  WIDE_TX_STALE,
  WIDE_TX_DUPLICATE,
} from '../generated/wide.ts'
export { DSQL_TX, DSQL_READ_COST } from '../generated/dsql.ts'
export { SYNC_MS, REPLICA_SYNC_MINUTES_PER_GB, REPLICA_BOX_PRICE } from '../generated/replica.ts'
export { SEARCH_COPY_MINUTES_PER_GB } from '../generated/search.ts'
export {
  INTERNET_MS,
  UPLOAD_MB,
  EGRESS_ORIGIN,
  EGRESS_CDN,
  AUTHENTICATED_KINDS,
  AUTH_CHECK_MS,
  ZONES,
  CROSS_ZONE_MS,
  EGRESS_CROSS_ZONE,
  BACKEND_KB,
  FAILOVER_SECONDS,
  TOKENS_PER_PROMPT,
  BREAKER_THRESHOLD,
  BREAKER_OPEN,
  BULKHEAD_MS,
  HEDGE_LOAD,
  SERIALIZE_MS,
  DUAL_WRITE_STALE,
  OUTBOX_STALE,
  CDC_LAG_STALE,
  CDC_DROP_STALE,
  CHAOS_EVERY,
  CHAOS_SECONDS,
  CHAOS_FAILURE,
  CHAOS_INSIGHT,
  LOAD_TEST_INSIGHT,
  DRILL_INSIGHT,
  FIRST_KIND_INSIGHT,
  INSIGHT_YIELD,
  FAILURE_YIELD,
  POOL_FLOOR,
  SPREAD_REGIONS,
  SPREAD_REPLICATION_KB,
  WIDE_SPREAD_LAG_STALE,
  WIDE_REBALANCE_MINUTES_PER_GB,
  DOC_REBALANCE_MINUTES_PER_GB,
  LOG_REPLICATE_MINUTES_PER_GB,
  HOT_KEY_SHARE,
  PRICING_IDS,
  PRICINGS,
  SAVINGS_PLAN_RATE,
  PRICING_FROM_STAGE,
  RESERVED_SECONDS,
  STICKY_LOCAL_READ,
  STICKY_HERD,
  FLAG_PROPAGATION_SECONDS,
} from '../generated/components.ts'
import { PRICING_IDS } from '../generated/components.ts'
