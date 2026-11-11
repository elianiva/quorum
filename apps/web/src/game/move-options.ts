import { Message } from './message.ts'
import {
  CACHE_TTLS,
  CDN_TTLS,
  DNS_TTLS,
  FAMILIES,
  FRAMEWORKS,
  GOGC,
  PRICING_IDS,
  REGION_INFO,
  REGIONS,
  RUNTIMES,
  ZONES,
  type ComponentId,
  type FrameworkId,
  type RuntimeId,
} from '@quorum/simulation/catalog'
import type { Game, GameNode } from '@quorum/simulation/state'
import type { RegionId } from '@quorum/simulation/catalog'

/* ==========================================================================
   The rest of the move surface: every Node setting and every Node command the
   inspector offers, each one as a Message the board already answers. Adding an
   action is one entry here, and the model, the option lists, and the apply path
   all pick it up.
   ========================================================================== */

export type MoveValue = Readonly<{
  id: string
  label: string
  message: (nodeId: string) => Message
}>

export type MoveOption = Readonly<{
  id: string
  label: string
  /** The Node types it applies to, or null for every Node. The board still refuses what it must. */
  types: ReadonlyArray<ComponentId> | null
  values: (game: Game, node: GameNode) => ReadonlyArray<MoveValue>
}>

export type MoveCommand = Readonly<{
  id: string
  label: string
  types: ReadonlyArray<ComponentId> | null
  message: (nodeId: string) => Message
}>

export type BoardMove = Readonly<{
  id: string
  label: string
  message: Message
}>

const value = (id: string, label: string, make: (nodeId: string) => Message): MoveValue => ({
  id,
  label,
  message: make,
})

const onOff = (
  what: string,
  make: (nodeId: string, on: boolean) => Message,
): ReadonlyArray<MoveValue> => [
  value('on', `${what}: on`, (nodeId) => make(nodeId, true)),
  value('off', `${what}: off`, (nodeId) => make(nodeId, false)),
]

const named = <T extends string>(
  entries: ReadonlyArray<Readonly<{ id: T; name: string }>>,
  make: (nodeId: string, id: T) => Message,
  note?: (entry: Readonly<{ id: T; name: string }>) => string,
): ReadonlyArray<MoveValue> =>
  entries.map((entry) =>
    value(entry.id, note ? `${entry.name} (${note(entry)})` : entry.name, (nodeId) =>
      make(nodeId, entry.id),
    ),
  )

const ladder = (
  steps: ReadonlyArray<number>,
  make: (nodeId: string, step: number) => Message,
  unit = '',
): ReadonlyArray<MoveValue> =>
  steps.map((step) => value(String(step), `${step}${unit}`, (nodeId) => make(nodeId, step)))

const seconds = (ttl: number): string =>
  ttl < 60 ? `${ttl} seconds` : ttl < 3_600 ? `${ttl / 60} minutes` : `${ttl / 3_600} hour`

/** Every kind the catalog offers, with the name the board shows. */
const families = (): ReadonlyArray<MoveValue> =>
  named(
    Object.values(FAMILIES),
    (nodeId, family) =>
      ({
        _tag: 'FamilyChosen',
        nodeId,
        family,
      }) as Message,
  )

export const NODE_OPTIONS: ReadonlyArray<MoveOption> = [
  {
    id: 'family',
    label: 'Instance family',
    types: ['server', 'worker', 'database', 'replica', 'dsql', 'search', 'vec', 'storage'],
    values: families,
  },
  {
    id: 'pricing',
    label: 'Pricing model: on-demand, reserved, or spot',
    types: null,
    values: () =>
      PRICING_IDS.map((pricing) =>
        value(
          pricing,
          pricing,
          (nodeId) => ({ _tag: 'PricingChosen', nodeId, pricing }) as Message,
        ),
      ),
  },
  {
    id: 'runtime',
    label: 'Runtime: the language the App Server or Worker runs',
    types: ['server', 'worker'],
    values: () =>
      named(
        Object.values(RUNTIMES),
        (nodeId, runtime: RuntimeId) =>
          ({
            _tag: 'RuntimeChosen',
            nodeId,
            runtime,
          }) as Message,
      ),
  },
  {
    id: 'framework',
    label: 'Framework on top of the runtime',
    types: ['server', 'worker'],
    values: () =>
      named(
        Object.values(FRAMEWORKS),
        (nodeId, framework: FrameworkId) =>
          ({
            _tag: 'FrameworkChosen',
            nodeId,
            framework,
          }) as Message,
      ),
  },
  {
    id: 'workers',
    label: 'Processes, or workers, in the Node',
    types: ['server', 'worker'],
    values: () =>
      ladder(
        [1, 2, 4, 8, 16, 32, 64],
        (nodeId, workers) => ({ _tag: 'WorkersChosen', nodeId, workers }) as Message,
      ),
  },
  {
    id: 'ttl',
    label: 'Time to live: how long a Cache, CDN, or DNS answers keep',
    types: ['cache', 'cdn', 'dns'],
    values: (_, node) => {
      if (node.type === 'dns')
        return DNS_TTLS.map((ttl) =>
          value(
            String(ttl),
            seconds(ttl),
            (nodeId) => ({ _tag: 'TtlChosen', nodeId, ttl }) as Message,
          ),
        )
      if (node.type === 'cdn')
        return CDN_TTLS.map((entry) =>
          value(
            String(entry.ttl),
            seconds(entry.ttl),
            (nodeId) => ({ _tag: 'TtlChosen', nodeId, ttl: entry.ttl }) as Message,
          ),
        )
      return CACHE_TTLS.map((entry) =>
        value(
          String(entry.ttl),
          seconds(entry.ttl),
          (nodeId) => ({ _tag: 'TtlChosen', nodeId, ttl: entry.ttl }) as Message,
        ),
      )
    },
  },
  {
    id: 'cacheEngine',
    label: 'Cache engine',
    types: ['cache'],
    values: () =>
      ['redis', 'memcached'].map((engine) =>
        value(
          engine,
          engine,
          (nodeId) => ({ _tag: 'CacheEngineChosen', nodeId, engine }) as Message,
        ),
      ),
  },
  {
    id: 'cacheStrategy',
    label: 'Cache strategy: aside, read-through, write-through, or write-behind',
    types: ['cache'],
    values: () =>
      ['aside', 'read-through', 'write-through', 'write-behind'].map((cacheStrategy) =>
        value(
          cacheStrategy,
          cacheStrategy,
          (nodeId) => ({ _tag: 'CacheStrategyChosen', nodeId, cacheStrategy }) as Message,
        ),
      ),
  },
  {
    id: 'policy',
    label: 'Load balancer policy',
    types: ['lb'],
    values: () =>
      ['weighted', 'round-robin', 'least-conn', 'p2c', 'hash'].map((policy) =>
        value(policy, policy, (nodeId) => ({ _tag: 'PolicyChosen', nodeId, policy }) as Message),
      ),
  },
  {
    id: 'lbVariant',
    label: 'Layer 7 or layer 4 balancer',
    types: ['lb'],
    values: () =>
      ['l7', 'l4'].map((variant) =>
        value(
          variant,
          variant,
          (nodeId) => ({ _tag: 'LbVariantChosen', nodeId, variant }) as Message,
        ),
      ),
  },
  {
    id: 'pooler',
    label: 'Connection pooling mode',
    types: ['pooler'],
    values: () =>
      ['session', 'transaction', 'statement'].map((mode) =>
        value(mode, mode, (nodeId) => ({ _tag: 'PoolerModeChosen', nodeId, mode }) as Message),
      ),
  },
  {
    id: 'compression',
    label: 'Compression',
    types: ['server', 'worker'],
    values: () =>
      onOff(
        'Compression',
        (nodeId, compress) => ({ _tag: 'CompressionChosen', nodeId, compress }) as Message,
      ),
  },
  {
    id: 'recycle',
    label: 'Recycle workers after so many requests',
    types: ['server', 'worker'],
    values: () =>
      onOff(
        'Recycling',
        (nodeId, recycle) => ({ _tag: 'RecycleChosen', nodeId, recycle }) as Message,
      ),
  },
  {
    id: 'sticky',
    label: 'Sticky sessions',
    types: ['lb'],
    values: () =>
      onOff(
        'Sticky sessions',
        (nodeId, sticky) => ({ _tag: 'StickyChosen', nodeId, sticky }) as Message,
      ),
  },
  {
    id: 'slowStart',
    label: 'Slow start for a warmed Node',
    types: ['lb'],
    values: () =>
      onOff(
        'Slow start',
        (nodeId, slowStart) => ({ _tag: 'SlowStartChosen', nodeId, slowStart }) as Message,
      ),
  },
  {
    id: 'sample',
    label: 'Sampling rate',
    types: ['analytics', 'log'],
    values: () =>
      ladder(
        [0.05, 0.1, 0.25, 0.5, 1],
        (nodeId, sampleRate) => ({ _tag: 'SampleChosen', nodeId, sampleRate }) as Message,
      ),
  },
  {
    id: 'dbEngine',
    label: 'Database engine: PostgreSQL or MySQL',
    types: ['database', 'replica', 'dsql'],
    values: () =>
      ['postgres', 'mysql'].map((dbEngine) =>
        value(
          dbEngine,
          dbEngine,
          (nodeId) => ({ _tag: 'DbEngineChosen', nodeId, dbEngine }) as Message,
        ),
      ),
  },
  {
    id: 'topology',
    label: 'How the Databases share rows: single, sharded, or multi-leader',
    types: ['database', 'dsql'],
    values: () =>
      ['single', 'sharded', 'multi'].map((topology) =>
        value(
          topology,
          topology,
          (nodeId) => ({ _tag: 'DbTopologyChosen', nodeId, topology }) as Message,
        ),
      ),
  },
  {
    id: 'shards',
    label: 'Shards',
    types: ['database', 'dsql'],
    values: () =>
      ladder(
        [2, 4, 8, 16],
        (nodeId, shards) => ({ _tag: 'ShardsChosen', nodeId, shards }) as Message,
      ),
  },
  {
    id: 'iops',
    label: 'Volume: general or provisioned IOPS',
    types: ['database', 'replica', 'dsql', 'search', 'vec', 'storage'],
    values: () =>
      ['general', 'provisioned'].map((iops) =>
        value(iops, iops, (nodeId) => ({ _tag: 'StorageIopsChosen', nodeId, iops }) as Message),
      ),
  },
  {
    id: 'storageClass',
    label: 'Storage class: standard, infrequent, or archive',
    types: ['storage'],
    values: () =>
      ['standard', 'infrequent', 'archive'].map((storageClass) =>
        value(
          storageClass,
          storageClass,
          (nodeId) => ({ _tag: 'StorageClassChosen', nodeId, storageClass }) as Message,
        ),
      ),
  },
  {
    id: 'keep',
    label: 'Retention: keep, archive, or delete old rows',
    types: ['database', 'dsql'],
    values: () =>
      ['keep', 'archive', 'delete'].map((keep) =>
        value(keep, keep, (nodeId) => ({ _tag: 'DbRetentionChosen', nodeId, keep }) as Message),
      ),
  },
  {
    id: 'attempts',
    label: 'Delivery attempts, or retries',
    types: ['queue'],
    values: () =>
      ladder(
        [1, 3, 5, 10],
        (nodeId, attempts) => ({ _tag: 'AttemptsChosen', nodeId, attempts }) as Message,
      ),
  },
  {
    id: 'dlq',
    label: 'Dead-letter queue',
    types: ['queue'],
    values: () =>
      onOff('Dead-letter queue', (nodeId, dlq) => ({ _tag: 'DlqChosen', nodeId, dlq }) as Message),
  },
  {
    id: 'paranoia',
    label: 'WAF paranoia level',
    types: ['waf'],
    values: () =>
      ladder(
        [1, 2, 3, 4],
        (nodeId, paranoia) => ({ _tag: 'ParanoiaChosen', nodeId, paranoia }) as Message,
      ),
  },
  {
    id: 'rateLimit',
    label: 'Requests allowed per second',
    types: ['waf', 'gw'],
    values: () =>
      ladder(
        [10, 50, 100, 500, 1_000],
        (nodeId, rateLimit) => ({ _tag: 'RateLimitChosen', nodeId, rateLimit }) as Message,
        '/s',
      ),
  },
  {
    id: 'zone',
    label: 'Zone the Node sits in',
    types: null,
    values: () =>
      ZONES.map((zone) =>
        value(zone, `zone ${zone}`, (nodeId) => ({ _tag: 'ZoneChosen', nodeId, zone }) as Message),
      ),
  },
  {
    id: 'standby',
    label: 'A standby copy in another zone',
    types: ['database', 'pooler', 'cache', 'search', 'queue'],
    values: () =>
      onOff(
        'Standby',
        (nodeId, standby) =>
          ({ _tag: 'StandbyChosen', nodeId, standby, standbySync: true }) as Message,
      ),
  },
  {
    id: 'backup',
    label: 'Backups: none, nightly, or point in time',
    types: ['database', 'dsql'],
    values: () =>
      ['none', 'nightly', 'pitr'].map((backup) =>
        value(backup, backup, (nodeId) => ({ _tag: 'BackupChosen', nodeId, backup }) as Message),
      ),
  },
  {
    id: 'fanout',
    label: 'Fan-out: pull or push',
    types: ['queue'],
    values: () =>
      ['pull', 'push'].map((fanout) =>
        value(fanout, fanout, (nodeId) => ({ _tag: 'FanoutChosen', nodeId, fanout }) as Message),
      ),
  },
  {
    id: 'split',
    label: 'Split reads and writes',
    types: ['database', 'dsql'],
    values: () =>
      onOff('Split reads', (nodeId, split) => ({ _tag: 'SplitChosen', nodeId, split }) as Message),
  },
  {
    id: 'gogc',
    label: 'Go garbage collector target',
    types: ['server', 'worker'],
    values: () =>
      GOGC.map((entry) =>
        value(
          String(entry.gogc),
          `GOGC ${entry.gogc}`,
          (nodeId) => ({ _tag: 'GogcChosen', nodeId, gogc: entry.gogc }) as Message,
        ),
      ),
  },
  {
    id: 'collector',
    label: 'Garbage collector: G1, Parallel, or ZGC',
    types: ['server', 'worker'],
    values: () =>
      ['g1', 'parallel', 'zgc'].map((collector) =>
        value(
          collector,
          collector,
          (nodeId) => ({ _tag: 'CollectorChosen', nodeId, collector }) as Message,
        ),
      ),
  },
  {
    id: 'vecIndex',
    label: 'Vector index: exact or HNSW',
    types: ['vec'],
    values: () =>
      ['exact', 'hnsw'].map((indexType) =>
        value(
          indexType,
          indexType,
          (nodeId) => ({ _tag: 'VecIndexChosen', nodeId, indexType }) as Message,
        ),
      ),
  },
  {
    id: 'deploy',
    label: 'Deployment strategy',
    types: ['server', 'worker'],
    values: () =>
      ['recreate', 'rolling', 'blue-green', 'canary'].map((strategy) =>
        value(
          strategy,
          strategy,
          (nodeId) => ({ _tag: 'DeployStrategyChosen', nodeId, strategy }) as Message,
        ),
      ),
  },
  {
    id: 'region',
    label: 'Region the Node runs in',
    types: null,
    values: () =>
      REGIONS.map((region) =>
        value(
          region,
          REGION_INFO[region].name,
          (nodeId) => ({ _tag: 'NodeRegionChosen', nodeId, region }) as Message,
        ),
      ),
  },
  {
    id: 'search',
    label: 'Search engine and its shards',
    types: ['search'],
    values: () =>
      ['elasticsearch', 'opensearch', 'meilisearch'].map((searchVariant) =>
        value(
          searchVariant,
          searchVariant,
          (nodeId) => ({ _tag: 'SearchOptionsChosen', nodeId, searchVariant }) as Message,
        ),
      ),
  },
  {
    id: 'storage',
    label: 'Object storage provider',
    types: ['storage'],
    values: () =>
      ['s3', 'r2'].map((storeVariant) =>
        value(
          storeVariant,
          storeVariant,
          (nodeId) => ({ _tag: 'StoreVariantChosen', nodeId, storeVariant }) as Message,
        ),
      ),
  },
  {
    id: 'quorum',
    label: 'Quorum: replicas read and written',
    types: ['database', 'dsql'],
    values: () =>
      [
        [3, 2, 2],
        [3, 1, 3],
        [3, 3, 3],
      ].map(([n, r, w]) =>
        value(
          `${n}-${r}-${w}`,
          `N ${n}, R ${r}, W ${w}`,
          (nodeId) =>
            ({ _tag: 'QuorumChosen', nodeId, n: n ?? 3, r: r ?? 1, w: w ?? 1 }) as Message,
        ),
      ),
  },
]

export const NODE_COMMANDS: ReadonlyArray<MoveCommand> = [
  {
    id: 'restart',
    label: 'Restart the Node',
    types: null,
    message: (nodeId) => ({ _tag: 'RestartChosen', nodeId }) as Message,
  },
  {
    id: 'replace',
    label: 'Replace the Node with a fresh copy',
    types: null,
    message: (nodeId) => ({ _tag: 'ReplaceBought', nodeId }) as Message,
  },
  {
    id: 'sell',
    label: 'Sell the Node, with half back',
    types: null,
    message: (nodeId) => ({ _tag: 'SellAsked', nodeId }) as Message,
  },
  {
    id: 'drain',
    label: 'Drain the Node before leaving it',
    types: null,
    message: (nodeId) => ({ _tag: 'DrainChosen', nodeId }) as Message,
  },
  {
    id: 'failover',
    label: 'Fail the Node over to its standby',
    types: null,
    message: (nodeId) => ({ _tag: 'FailedOver', nodeId }) as Message,
  },
  {
    id: 'promote',
    label: 'Promote a read replica to primary',
    types: ['replica'],
    message: (nodeId) => ({ _tag: 'PromoteReplica', nodeId }) as Message,
  },
  {
    id: 'throttle',
    label: 'Throttle its inbound connections',
    types: null,
    message: (nodeId) => ({ _tag: 'ConnectsThrottled', nodeId }) as Message,
  },
  {
    id: 'index',
    label: 'Add the missing index',
    types: ['database', 'replica'],
    message: (nodeId) => ({ _tag: 'IndexAdded', nodeId }) as Message,
  },
  {
    id: 'drill',
    label: 'Run a restore drill',
    types: ['database', 'dsql', 'storage'],
    message: (nodeId) => ({ _tag: 'RestoreDrilled', nodeId }) as Message,
  },
  {
    id: 'upgradeAll',
    label: 'Buy one size on every Node of its kind',
    types: null,
    message: (nodeId) => ({ _tag: 'UpgradeAllChosen', nodeId }) as Message,
  },
]

export const BOARD_MOVES: ReadonlyArray<BoardMove> = [
  {
    id: 'open-na',
    label: 'Open North America',
    message: Message.RegionOpened({ region: 'na' }),
  },
  {
    id: 'open-eu',
    label: 'Open Europe',
    message: Message.RegionOpened({ region: 'eu' }),
  },
  {
    id: 'open-apac',
    label: 'Open Asia-Pacific',
    message: Message.RegionOpened({ region: 'apac' }),
  },
  {
    id: 'open-sa',
    label: 'Open South America',
    message: Message.RegionOpened({ region: 'sa' }),
  },
  { id: 'fail-zone', label: 'Fail over the zone', message: Message.ZoneFailedOver({}) },
  {
    id: 'fail-region',
    label: 'Fail over the region',
    message: Message.RegionFailedOver({}),
  },
  {
    id: 'chaos-on',
    label: 'Turn Chaos Monkey on',
    message: Message.ChaosChosen({ chaos: true }),
  },
  {
    id: 'chaos-off',
    label: 'Turn Chaos Monkey off',
    message: Message.ChaosChosen({ chaos: false }),
  },
  { id: 'raise', label: 'Raise the funding round', message: Message.RoundRaised({}) },
  {
    id: 'decline',
    label: 'Decline the funding round',
    message: Message.RoundDeclined({}),
  },
  {
    id: 'acknowledge',
    label: 'Acknowledge the incident',
    message: Message.AlertsAcknowledged({ rules: [] }),
  },
]

/** The options one Node offers: its type, and the Game, decide which. */
export const optionsFor = (game: Game, node: GameNode): ReadonlyArray<MoveOption> =>
  NODE_OPTIONS.filter((option) => option.types === null || option.types.includes(node.type))

export const commandsFor = (node: GameNode): ReadonlyArray<MoveCommand> =>
  NODE_COMMANDS.filter((command) => command.types === null || command.types.includes(node.type))

export const regionName = (region: RegionId): string => REGION_INFO[region].name
