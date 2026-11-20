import { Effect, Schema } from 'effect'
import { Life } from './life.ts'
import {
  MUTATOR_IDS,
  VENTURE_IDS,
  COMPONENT_IDS,
  DATA_PATTERNS,
  FAMILY_IDS,
  FEATURE_IDS,
  FIXES,
  FRAMEWORK_IDS,
  INCIDENT_IDS,
  INSIGHT_POOLS,
  LANGUAGE_IDS,
  LEVER_KINDS,
  POLICY_IDS,
  PRICING_IDS,
  REQUEST_KINDS,
  REGIONS,
  RESEARCH_IDS,
  RUNTIME_IDS,
  START_KLOC,
  IAC_TOOLS,
  SYNC_MODES,
  ZONES,
  MOOD_START,
  DEVICES,
  NO_DEVICE_LATENCY,
} from './catalog.ts'
import { COMPONENT_FIELDS } from './components/fields.ts'
import { DrillPhase } from './drill-machine.ts'
import { BridgeState } from './bridge-machine.ts'
import { QuarterPhase } from './quarter-machine.ts'
import { HirePhase } from './hire-machine.ts'
import { Breaker } from './breaker-machine.ts'
import { Autoscaler } from './autoscaler-machine.ts'
import { EraRound } from './era-round-machine.ts'
import { DataMovePhase } from './data-move-machine.ts'
import { StudyPhase } from './study-machine.ts'
import { NodeService } from './node-service-machine.ts'
import { BlockKind, WorkBlock } from './work-item-machine.ts'
import { IncidentPhase } from './incident-machine.ts'
import { MirrorSync, NodeSpec, Observed } from './mirror-machine.ts'
import { FeaturePhase } from './feature-machine.ts'

export const ComponentId = Schema.Literals(COMPONENT_IDS)
export const FamilyId = Schema.Literals(FAMILY_IDS)
export const RuntimeId = Schema.Literals(RUNTIME_IDS)
export const FrameworkId = Schema.Literals(FRAMEWORK_IDS)
export const ResearchId = Schema.Literals(RESEARCH_IDS)
export const IncidentId = Schema.Literals(INCIDENT_IDS)

export const RequestKindId = Schema.Literals(REQUEST_KINDS)
export const LeverKindId = Schema.Literals(LEVER_KINDS)
export const LanguageId = Schema.Literals(LANGUAGE_IDS)
export const PolicyId = Schema.Literals(POLICY_IDS)
export const FeatureId = Schema.Literals(FEATURE_IDS)
export const FixId = Schema.Literals(FIXES)
export const VentureId = Schema.Literals(VENTURE_IDS)
export const MutatorId = Schema.Literals(MUTATOR_IDS)

export const DbEngine = Schema.Literals(['postgres', 'mysql'])
export type DbEngine = typeof DbEngine.Type

export { DownCause } from './life.ts'

export const Zone = Schema.Literals(ZONES)
export type Zone = typeof Zone.Type

export const Region = Schema.Literals(REGIONS)
export type Region = typeof Region.Type

export const PerRegion = Schema.Struct({
  na: Schema.Finite,
  eu: Schema.Finite,
  apac: Schema.Finite,
  sa: Schema.Finite,
})
export type PerRegion = typeof PerRegion.Type

export const Backup = Schema.Literals(['none', 'nightly', 'pitr'])
export type Backup = typeof Backup.Type

export const Pricing = Schema.Literals(PRICING_IDS)
export type Pricing = typeof Pricing.Type

export { LbPolicy } from './components/lb.ts'
export { PmMode, Collector, Fanout } from './components/server.ts'
export { CacheEngine, CacheStrategy } from './components/cache.ts'
export { IopsClass, DbRetention, ShardKey, DbTopology } from './components/database.ts'
import { DbTopology, ShardKey } from './components/database.ts'
export { VecIndexType } from './components/vec.ts'
export { Acks } from './components/log.ts'
export { SearchRefresh, SearchVariant, SearchHeap } from './components/search.ts'
export { StorageClass, StoreVariant } from './components/storage.ts'
export { PoolerMode } from './components/pooler.ts'
export { GpuType } from './components/gpu.ts'
export { ScaleSignal } from './components/autoscaler.ts'
export { DeployStrategy } from './components/ci.ts'
export { CacheKey } from './components/cdn.ts'

const NODE_FIELD_ORDER = [
  'id',
  'type',
  'ordinal',
  'x',
  'y',
  'size',
  'family',
  'runtime',
  'framework',
  'workers',
  'localDb',
  'sample',
  'sampleRate',
  'retention',
  'credits',
  'leak',
  'service',
  'crashes',
  'recycle',
  'compress',
  'downAt',
  'policy',
  'sticky',
  'provider',
  'slowStart',
  'purge',
  'cacheKey',
  'staleUntil',
  'earlyExpiry',
  'swr',
  'shardKey',
  'sync',
  'searchVariant',
  'searchShards',
  'searchReplicas',
  'heap',
  'storeVariant',
  'variant',
  'authEdge',
  'merge',
  'burst',
  'checkEvery',
  'deepCheck',
  'ttl',
  'pm',
  'certUntil',
  'engine',
  'dbEngine',
  'iops',
  'shards',
  'storageClass',
  'keep',
  'lifecycle',
  'cacheStrategy',
  'refresh',
  'restore',
  'mode',
  'depth',
  'dlq',
  'attempts',
  'maxLength',
  'prefetch',
  'upgradedAt',
  'coalesce',
  'warming',
  'paranoia',
  'underAttack',
  'rateLimit',
  'strategy',
  'presence',
  'backoff',
  'clustering',
  'zone',
  'standby',
  'standbySync',
  'pricing',
  'pricingUntil',
  'replicas',
  'scaler',
  'scaledAt',
  'signal',
  'target',
  'minCopies',
  'maxCopies',
  'gpu',
  'precision',
  'gpuModel',
  'batch',
  'collector',
  'gogc',
  'shed',
  'degrade',
  'schedule',
  'materialized',
  'ryw',
  'region',
  'serviceId',
  'n',
  'r',
  'w',
  'lost',
  'spread',
  'backup',
  'fanout',
  'split',
  'transactions',
  'indexType',
  'partitions',
  'acks',
  'retain',
  'keyed',
  'topology',
] as const

const NODE_FIELDS_UNORDERED = {
  id: Schema.String,
  type: ComponentId,
  ordinal: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  x: Schema.Finite,
  y: Schema.Finite,
  size: Schema.Finite,
  family: FamilyId,
  runtime: RuntimeId,
  framework: FrameworkId,
  sample: Schema.Finite,
  credits: Schema.Finite,
  leak: Schema.Finite,
  service: NodeService.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'InService' } as const)),
  ),
  downAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  ttl: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(300))),
  certUntil: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  dbEngine: DbEngine.pipe(Schema.withDecodingDefaultKey(Effect.succeed('postgres' as const))),
  restore: Schema.Literals(['ok', 'failed']).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('ok' as const)),
  ),
  depth: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  attempts: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(25))),
  prefetch: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(10))),
  zone: Zone.pipe(Schema.withDecodingDefaultKey(Effect.succeed('a' as const))),
  standby: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  standbySync: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  pricing: Pricing.pipe(Schema.withDecodingDefaultKey(Effect.succeed('on-demand' as const))),
  pricingUntil: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  replicas: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(1))),
  scaler: Autoscaler.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed<Autoscaler>({ _tag: 'Steady' })),
  ) as unknown as typeof Autoscaler,
  scaledAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  region: Region.pipe(Schema.withDecodingDefaultKey(Effect.succeed('na' as const))),
  serviceId: Schema.optionalKey(Schema.String),
  n: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  spread: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  backup: Backup.pipe(Schema.withDecodingDefaultKey(Effect.succeed('none' as const))),
  ...COMPONENT_FIELDS,
} as const

const NODE_FIELDS = Object.fromEntries(
  NODE_FIELD_ORDER.map((key) => [key, NODE_FIELDS_UNORDERED[key]]),
) as typeof NODE_FIELDS_UNORDERED

export const GameNode = Schema.Struct({ ...NODE_FIELDS, life: Life })
export type GameNode = typeof GameNode.Type

export const Retries = Schema.Literals(['none', 'naive', 'backoff'])
export type Retries = typeof Retries.Type

export const GameLink = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  timeout: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(30))),
  retries: Retries.pipe(Schema.withDecodingDefaultKey(Effect.succeed('none' as const))),
  kinds: Schema.NullOr(Schema.Array(RequestKindId)).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  breaker: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  bulkhead: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  hedge: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  fuse: Breaker.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed<Breaker>({ _tag: 'Closed' })),
  ) as unknown as typeof Breaker,
  failure: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
})
export type GameLink = typeof GameLink.Type

export const Incident = Schema.Struct({
  kind: IncidentId,
  remaining: Schema.Finite,
  nodeId: Schema.NullOr(Schema.String),
  startedAt: Schema.Finite,
  baseline: Schema.Finite,
  usersAtStart: Schema.Finite,
  impaired: Schema.Finite,
  lostRevenue: Schema.Finite,
  failed: Schema.Finite,
  phase: IncidentPhase.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'Quiet' } as const)),
  ),
  severity: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  magnitude: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  zone: Schema.NullOr(Zone).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  region: Schema.NullOr(Region).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  service: Schema.optionalKey(Schema.NullOr(Schema.String)),
  causedBy: Schema.NullOr(IncidentId).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  throttled: Schema.optionalKey(Schema.Boolean),
  rollingBack: Schema.optionalKey(Schema.Boolean),
})
export type Incident = typeof Incident.Type

export const Postmortem = Schema.Struct({
  id: Schema.Finite,
  kind: IncidentId,
  target: Schema.NullOr(Schema.String),
  duration: Schema.Finite,
  mttr: Schema.Finite,
  mttd: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  mtta: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  lostUsers: Schema.Finite,
  lostRevenue: Schema.Finite,
  failed: Schema.Finite,
  action: Schema.NullOr(ResearchId),
  severity: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(3))),
  endedAt: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  auto: Schema.optionalKey(Schema.Boolean),
  causedBy: Schema.NullOr(IncidentId).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  service: Schema.optionalKey(Schema.NullOr(Schema.String)),
})
export type Postmortem = typeof Postmortem.Type

export const Sample = Schema.Struct({
  users: Schema.Finite,
  demand: Schema.Finite,
  served: Schema.Finite,
  revenue: Schema.Finite,
  burn: Schema.Finite,
  cash: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  latency: Schema.Finite,
  p99: Schema.Finite,
  apdex: Schema.Finite,
  errors: Schema.Finite,
  device: Schema.Record(Schema.Literals(DEVICES), Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(NO_DEVICE_LATENCY)),
  ),
  slow: Schema.NullOr(RequestKindId).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
})
export type Sample = typeof Sample.Type

export const BudgetHour = Schema.Struct({
  hour: Schema.Finite,
  requests: Schema.Finite,
  failed: Schema.Finite,
  users: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
})
export type BudgetHour = typeof BudgetHour.Type

export const Alarms = Schema.Struct({
  errors: Schema.Finite,
  latency: Schema.Finite,
  saturation: Schema.Finite,
  queue: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  budget: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
})
export type Alarms = typeof Alarms.Type

export const AlertRules = Schema.Struct({
  errors: Schema.Finite,
  latency: Schema.Finite,
  saturation: Schema.Finite,
  queue: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(30))),
  budget: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(10))),
})
export type AlertRules = typeof AlertRules.Type

export const FalseAlarms = Schema.Struct({
  day: Schema.Finite,
  errors: Schema.Finite,
  latency: Schema.Finite,
  saturation: Schema.Finite,
  queue: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  budget: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
})
export type FalseAlarms = typeof FalseAlarms.Type

export const Engineer = Schema.Struct({
  id: Schema.String,
  team: Schema.String,
  language: LanguageId,
  hiredAt: Schema.Finite,
  salary: Schema.NullOr(Schema.Finite).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  mood: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(MOOD_START))),
  pages: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  offUntil: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  unhappyAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
})
export type Engineer = typeof Engineer.Type

export const NEW_ENGINEER = {
  salary: null,
  mood: MOOD_START,
  pages: 0,
  offUntil: 0,
  unhappyAt: 0,
} as const

export const Hire = Schema.Struct({
  id: Schema.String,
  team: Schema.String,
  language: LanguageId,
  phase: HirePhase,
})
export type Hire = typeof Hire.Type

export const Training = Schema.Struct({
  engineer: Schema.String,
  language: LanguageId,
  readyAt: Schema.Finite,
})
export type Training = typeof Training.Type

export const TeamKind = Schema.Literals(['product', 'platform', 'sre', 'data', 'security'])
export type TeamKind = typeof TeamKind.Type

export const Team = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: TeamKind.pipe(Schema.withDecodingDefaultKey(Effect.succeed('product' as const))),
  policy: PolicyId,
  previous: PolicyId,
  since: Schema.Finite,
  kindAt: Schema.optionalKey(Schema.Finite),
})
export type Team = typeof Team.Type

const MIGRATION_FIELDS = {
  runtime: RuntimeId,
  framework: FrameworkId,
  fromRuntime: RuntimeId,
  fromFramework: FrameworkId,
  total: Schema.Finite,
  bugs: Schema.Boolean,
} as const

export const Migration = Schema.TaggedUnion({
  Building: {
    ...MIGRATION_FIELDS,
    step: Schema.Finite,
  },
  Ready: {
    ...MIGRATION_FIELDS,
    step: Schema.Finite,
  },
  Finishing: { ...MIGRATION_FIELDS },
})
export type Migration = typeof Migration.Type

export const MigrationState = Migration
export type MigrationState = typeof MigrationState.Type

export const EngineChange = Schema.Struct({
  node: Schema.String,
  to: DbEngine,
  phase: DataMovePhase,
})
export type EngineChange = typeof EngineChange.Type

export const Resharding = Schema.Struct({
  node: Schema.String,
  shards: Schema.Finite,
  key: ShardKey,
  group: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(''))),
  topology: DbTopology.pipe(Schema.withDecodingDefaultKey(Effect.succeed('single' as const))),
  phase: DataMovePhase,
})
export type Resharding = typeof Resharding.Type

export const Service = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  debt: Schema.Finite,
  codebase: Schema.Finite,
  fixes: Schema.Array(FixId),
  shapes: Schema.Finite,
  indexes: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  migration: Schema.NullOr(MigrationState),
  nextDeployAt: Schema.Finite,
  lastDeploy: Schema.Array(FeatureId),
  owner: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed('core'))),
  features: Schema.Array(FeatureId).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  datastore: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
})
export type Service = typeof Service.Type

export const WorkKind = Schema.Literals([
  'feature',
  'task',
  'migration',
  'spike',
  'patch',
  'split',
  'move',
  'lever',
])
export type WorkKind = typeof WorkKind.Type

export { BlockKind }

export const WorkItem = Schema.Struct({
  id: Schema.Finite,
  kind: WorkKind,
  ref: Schema.String,
  cost: Schema.Finite,
  spent: Schema.Finite,
  rushed: Schema.optionalKey(Schema.Finite),
  held: Schema.optionalKey(Schema.Boolean),
  due: Schema.optionalKey(Schema.Finite),
  target: Schema.optionalKey(Schema.String),
  service: Schema.optionalKey(Schema.String),
  owner: Schema.optionalKey(Schema.String),
  block: WorkBlock.pipe(Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'Free' } as const))),
  answered: Schema.NullOr(Schema.Literals(['now', 'queued'])).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  step: Schema.optionalKey(Schema.Finite),
})
export type WorkItem = typeof WorkItem.Type

export const CORE_TEAM: Team = {
  id: 'core',
  name: 'Core',
  kind: 'product',
  policy: 'balanced',
  previous: 'balanced',
  since: 0,
}

export const monolith = (fixes: ReadonlyArray<typeof FixId.Type>): Service => ({
  id: 'monolith',
  name: 'Monolith',
  debt: 0,
  codebase: START_KLOC,
  fixes,
  shapes: 0,
  indexes: 0,
  migration: null,
  nextDeployAt: 0,
  lastDeploy: [],
  owner: 'core',
  features: [],
  datastore: null,
})

const OLD_MONOLITH = monolith([
  'eager-loading',
  'session-state',
  'idempotency-keys',
  'off-loop',
  'graceful-shutdown',
  'health-check',
])

export const QuarterResult = Schema.Struct({
  beat: Schema.Boolean,
  growth: Schema.Finite,
  margin: Schema.Finite,
})
export type QuarterResult = typeof QuarterResult.Type

export const Quarter = Schema.Struct({
  index: Schema.Finite,
  startedAt: Schema.Finite,
  growth: Schema.Finite,
  margin: Schema.Finite,
  revenue: Schema.Finite,
  streak: Schema.Finite,
  bonus: Schema.Finite,
  last: Schema.NullOr(QuarterResult),
  phase: QuarterPhase,
})
export type Quarter = typeof Quarter.Type

export const Founding = Schema.Struct({
  venture: VentureId,
  mutators: Schema.Array(MutatorId),
  perks: Schema.Record(Schema.String, Schema.Finite),
})
export type Founding = typeof Founding.Type

export const DEFAULT_FOUNDING: Founding = { venture: 'b2b-saas', mutators: [], perks: {} }

export const InsightPools = Schema.Struct(
  Object.fromEntries(
    INSIGHT_POOLS.map((pool) => [
      pool,
      Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
    ]),
  ) as Record<(typeof INSIGHT_POOLS)[number], Schema.withDecodingDefaultKey<typeof Schema.Finite>>,
)
export type InsightPools = typeof InsightPools.Type

export const NO_INSIGHT: InsightPools = Object.fromEntries(
  INSIGHT_POOLS.map((pool) => [pool, 0]),
) as InsightPools

export const Study = Schema.Struct({ id: ResearchId, phase: StudyPhase })
export type Study = typeof Study.Type

export const Scenario = Schema.Struct({
  mix: Schema.optionalKey(Schema.Record(Schema.String, Schema.Finite)),
  daily: Schema.optionalKey(Schema.Boolean),
  tasks: Schema.optionalKey(Schema.Boolean),
  value: Schema.optionalKey(Schema.Record(Schema.String, Schema.Finite)),
})
export type Scenario = typeof Scenario.Type

export const IacTool = Schema.Literals(IAC_TOOLS)
export type IacTool = typeof IacTool.Type

export const SyncMode = Schema.Literals(SYNC_MODES)
export type SyncMode = typeof SyncMode.Type

export const DataPattern = Schema.Literals(DATA_PATTERNS)
export type DataPattern = typeof DataPattern.Type

export const Infra = Schema.Struct({
  tool: IacTool,
  until: Schema.Finite,
  sync: Schema.NullOr(SyncMode),
})
export type Infra = typeof Infra.Type

export { NodeSpec, Observed }

export const Mirror = Schema.Struct({
  region: Region,
  source: Region,
  nodes: Schema.Record(Schema.String, Schema.String),
  data: Schema.Record(Schema.String, DataPattern),
  code: Schema.Record(Schema.String, NodeSpec),
  links: Schema.Array(Schema.String),
  sync: MirrorSync.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'InSync', seen: null } as const)),
  ),
  hold: Schema.Array(Schema.String),
  overrides: Schema.Record(Schema.String, Schema.Array(Schema.String)),
  computed: Schema.Boolean,
})
export type Mirror = typeof Mirror.Type

export const Policies = Schema.Struct({
  research: Schema.Boolean,
  hire: Schema.Boolean,
  upgrade: Schema.Boolean,
})
export type Policies = typeof Policies.Type

export const DEFAULT_ALERT_RULES: AlertRules = {
  errors: 0.01,
  latency: 4,
  saturation: 0.9,
  queue: 30,
  budget: 10,
}
export const NO_FALSE_ALARMS: FalseAlarms = {
  day: 0,
  errors: 0,
  latency: 0,
  saturation: 0,
  queue: 0,
  budget: 0,
}

export const Box = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  nodes: Schema.Array(Schema.String),
})
export type Box = typeof Box.Type

export const Game = Schema.Struct({
  nodes: Schema.Array(GameNode),
  boxes: Schema.Array(Box).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  links: Schema.Array(GameLink),
  nextId: Schema.Finite,
  cash: Schema.Finite,
  bridge: BridgeState.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'None' } as const)),
  ),
  insight: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  pools: InsightPools.pipe(Schema.withDecodingDefaultKey(Effect.succeed(NO_INSIGHT))),
  studies: Schema.Array(Study).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  users: Schema.Finite,
  pending: Schema.Finite,
  spilled: Schema.Finite,
  researched: Schema.Array(ResearchId),
  stage: Schema.Finite,
  stageAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  equity: Schema.Finite,
  round: EraRound.pipe(Schema.withDecodingDefaultKey(Effect.succeed({ _tag: 'Waiting' } as const))),
  time: Schema.Finite,
  seed: Schema.Finite,
  apdex: Schema.Finite,
  userShares: Schema.NullOr(PerRegion).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  steady: Schema.NullOr(PerRegion).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  regionApdex: Schema.NullOr(PerRegion).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  incident: Schema.NullOr(Incident),
  lastIncident: Schema.NullOr(IncidentId),
  nextIncidentAt: Schema.Finite,
  postmortems: Schema.Array(Postmortem),
  postmortemSeq: Schema.Finite,
  openActions: Schema.Array(ResearchId),
  handled: Schema.Array(IncidentId).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  runbooks: Schema.Array(IncidentId).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  alarms: Alarms,
  servedKinds: Schema.Array(RequestKindId).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(['page', 'read'] as const)),
  ),
  alertRules: AlertRules.pipe(Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_ALERT_RULES))),
  falseAlarms: FalseAlarms.pipe(Schema.withDecodingDefaultKey(Effect.succeed(NO_FALSE_ALARMS))),
  earned: Schema.Finite,
  history: Schema.Array(Sample),
  sandbox: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  scenario: Schema.optionalKey(Scenario),
  devHours: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  engineers: Schema.Array(Engineer).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  hires: Schema.Array(Hire).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  training: Schema.Array(Training).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  teams: Schema.Array(Team).pipe(Schema.withDecodingDefaultKey(Effect.succeed([CORE_TEAM]))),
  moraleUntil: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  loadTestUntil: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  reshard: Schema.NullOr(Resharding).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  engineChange: Schema.NullOr(EngineChange).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  services: Schema.Array(Service).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed([OLD_MONOLITH])),
  ),
  backlog: Schema.Array(WorkItem).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  workSeq: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  cves: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  features: Schema.Record(Schema.String, FeaturePhase).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({})),
  ),
  rushedFeatures: Schema.Record(Schema.String, Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({})),
  ),
  outcomes: Schema.Record(Schema.String, Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({})),
  ),
  backdoorAt: Schema.NullOr(Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  discounts: Schema.Array(ResearchId).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  policies: Policies.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({ research: false, hire: false, upgrade: false })),
  ),
  researchTeam: Schema.NullOr(Schema.String).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed(null)),
  ),
  policyAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  autopilot: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  deploys: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  badDeploys: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  stored: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  data: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  uploads: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  budget: Schema.Array(BudgetHour).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  drill: Schema.NullOr(DrillPhase).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  chaos: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  weakest: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  quarter: Schema.NullOr(Quarter).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  founding: Founding.pipe(Schema.withDecodingDefaultKey(Effect.succeed(DEFAULT_FOUNDING))),
  banked: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  peak: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  iac: Schema.optionalKey(Infra),
  mirrors: Schema.optionalKey(Schema.Array(Mirror)),
  levers: Schema.Record(Schema.String, Schema.Finite).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed({})),
  ),
  fixedMix: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
})
export type Game = typeof Game.Type
