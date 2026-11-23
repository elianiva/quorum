import type { RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'

export const INCIDENT_IDS = [
  'spike',
  'instance',
  'connections',
  'loop',
  'leak',
  'slow-query',
  'bad-deploy',
  'bot-surge',
  'stuffing',
  'stampede',
  'poison',
  'ddos',
  'certificate',
  'psp-outage',
  'zone',
  'disk-full',
  'repl-lag',
  'latency-regression',
  'gc-storm',
  'retry-storm',
  'deadline-day',
  'double-charge',
  'report-db',
  'gpu-shortage',
  'regex',
  'region',
  'partition',
  'hot-key',
  'bgp',
  'audit',
  'dr-drill',
  'breach',
  'credential-leak',
  'cluster-upgrade',
  'config',
  'spot-reclaim',
  'stale-read',
  'reconnect',
  'runaway-bill',
  'mtu',
  'hot-shard',
  'premiere-spike',
  'launch-day',
  'flash-sale',
  'jvm-warmup',
  'migration-lock',
  'supply-chain',
  'accidental-delete',
  'operator-typo',
  'leap-second',
  'table-bloat',
  'page-leak',
  'stale-opcache',
  'bun-compat',
  'gevent-compat',
  'split-brain',
] as const
export type IncidentId = (typeof INCIDENT_IDS)[number]

export const FALLACY_IDS = [
  'reliable',
  'latency',
  'bandwidth',
  'secure',
  'topology',
  'administrator',
  'transport-cost',
  'homogeneous',
] as const
export type FallacyId = (typeof FALLACY_IDS)[number]

export const FALLACY_INCIDENTS: Readonly<Record<FallacyId, IncidentId>> = {
  reliable: 'partition',
  latency: 'slow-query',
  bandwidth: 'ddos',
  secure: 'breach',
  topology: 'bgp',
  administrator: 'config',
  'transport-cost': 'runaway-bill',
  homogeneous: 'mtu',
}

export const fallacyOf = (kind: IncidentId): FallacyId | null =>
  FALLACY_IDS.find((id) => FALLACY_INCIDENTS[id] === kind) ?? null

export type IncidentDef = Readonly<{
  id: IncidentId
  name: string
  era: number
  severity: 1 | 2 | 3
  escalatesTo: 1 | 2 | null
  duration: number
  cause: string
  prevention: string
  actions: ReadonlyArray<ResearchId>
}>

export const SPOT_WARNING = 10
export const SPOT_DOWN = 20

export const LATENCY_REGRESSION_MS = 150
export const DEADLINE_SURGE = 3
export const HOT_SHARD_CPU = 3
export const PREMIERE_SURGE = 4
export const LAUNCH_SURGE = 6
export const FLASH_SALE_SURGE = 20

export const KIND_SURGE: Partial<Record<IncidentId, readonly [RequestKind, number]>> = {
  'premiere-spike': ['media', PREMIERE_SURGE],
  'launch-day': ['rt', LAUNCH_SURGE],
  'flash-sale': ['buy', FLASH_SALE_SURGE],
}

export const JVM_WARMUP_SECONDS = 30
export const MIGRATION_LOCK_SECONDS = 150
export const SUPPLY_CHAIN_SECONDS = 90
export const ACCIDENTAL_DELETE_SECONDS = 120
export const OPERATOR_TYPO_SECONDS = 120
export const LEAP_SECOND_SECONDS = 60

export const STALE_OPCACHE_SECONDS = 90
export const RUNTIME_COMPAT_SECONDS = 90
export const SPLIT_BRAIN_SECONDS = 90
export const RUNTIME_INCIDENT_FAILURES: Partial<Record<IncidentId, number>> = {
  'stale-opcache': 0.3,
  'bun-compat': 0.2,
  'gevent-compat': 0.15,
  'split-brain': 0.5,
}

export const TABLE_BLOAT_SECONDS = 120
export const PAGE_LEAK_SECONDS = 90
export const BLOAT_CPU = 2
export const PAGE_LEAK_CHURN = 0.05
export const SUPPLY_CHAIN_CHURN = 0.1
export const SWITCH_PROVIDER_PRICE = 5_000
export const DELETE_CHURN = 0.1
export const CLOCK_SKEW_MS = 1_000
export const CLOCK_SKEW_LOSS = 0.1

export const CASCADE_FROM_STAGE = 3

export const CASCADES: Partial<Record<IncidentId, IncidentId>> = {
  'slow-query': 'retry-storm',
  'retry-storm': 'connections',
  spike: 'connections',
  stampede: 'slow-query',
  leak: 'gc-storm',
  'hot-key': 'stampede',
  'migration-lock': 'retry-storm',
  'accidental-delete': 'repl-lag',
  'leap-second': 'partition',
}

export const INCIDENTS: Record<IncidentId, IncidentDef> = {
  spike: {
    id: 'spike',
    name: 'Traffic spike',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 30,
    cause: 'A big news site linked to you. Demand tripled.',
    prevention: 'Spare capacity, a cache, more App Servers.',
    actions: ['caching', 'alerting'],
  },
  instance: {
    id: 'instance',
    name: 'Instance failure',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 60,
    cause: 'The host under a VM died.',
    prevention: 'A second copy behind a Load Balancer, which skips dead hosts.',
    actions: ['load-balancing', 'health-checks'],
  },
  connections: {
    id: 'connections',
    name: 'Connection exhaustion',
    era: 1,
    severity: 2,
    escalatesTo: 1,
    duration: 40,
    cause: 'A deploy doubled every connection pool. Postgres refused the excess.',
    prevention: 'A Connection Pooler, or smaller pools.',
    actions: ['pooling'],
  },
  loop: {
    id: 'loop',
    name: 'Event loop block',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 35,
    cause: 'Password hashing cost went from 10 to 12 rounds: 4× CPU per login.',
    prevention: 'The libuv thread pool, an Auth Provider, or a runtime without one event loop.',
    actions: ['libuv-pool', 'auth-provider'],
  },
  leak: {
    id: 'leak',
    name: 'Memory leak',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 60,
    cause: 'A persistent process leaked memory until the kernel killed it.',
    prevention: 'Restart the service, or run PHP: it frees everything after each request.',
    actions: ['metrics', 'alerting'],
  },
  'slow-query': {
    id: 'slow-query',
    name: 'Slow query',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 300,
    cause: 'A new feature shipped a query with no index. Each read scans the whole table.',
    prevention: 'Query analysis finds the missing index. A Cache keeps most reads off the table.',
    actions: ['query-analysis', 'caching'],
  },
  'bad-deploy': {
    id: 'bad-deploy',
    name: 'Bad deploy',
    era: 1,
    severity: 3,
    escalatesTo: 2,
    duration: 120,
    cause: 'A deploy shipped a bug. Requests to the App Servers fail.',
    prevention: 'A pipeline that can roll back, automated tests, and smaller deploys.',
    actions: ['ci', 'testing-culture'],
  },
  'bot-surge': {
    id: 'bot-surge',
    name: 'Bot surge',
    era: 2,
    severity: 3,
    escalatesTo: 2,
    duration: 90,
    cause: 'Scrapers found the site. Half of all traffic was bots.',
    prevention: 'A WAF in front of the App Servers.',
    actions: ['waf'],
  },
  stuffing: {
    id: 'stuffing',
    name: 'Credential stuffing',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause: 'Bots tried leaked passwords: 20× the logins, each one a bcrypt hash.',
    prevention: 'A WAF blocks most of them. An Auth Provider hashes the rest.',
    actions: ['waf', 'auth-provider'],
  },
  stampede: {
    id: 'stampede',
    name: 'Cache stampede',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: 'The Cache restarted empty. Every miss went to the database at once.',
    prevention: 'Stampede protection coalesces misses. Cache warming refills it before traffic.',
    actions: ['stampede-protection', 'cache-warming'],
  },
  poison: {
    id: 'poison',
    name: 'Poison message',
    era: 2,
    severity: 3,
    escalatesTo: 2,
    duration: 120,
    cause: 'A task that always fails kept coming back. Workers retried it instead of the queue.',
    prevention: 'A dead-letter queue moves a failing task aside.',
    actions: [],
  },
  ddos: {
    id: 'ddos',
    name: 'DDoS',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause: 'An attacker flooded the edge with 50 times normal traffic.',
    prevention: 'A WAF, with Under attack mode when it starts. A CDN takes the cacheable part.',
    actions: ['waf', 'cdn'],
  },
  'cluster-upgrade': {
    id: 'cluster-upgrade',
    name: 'Forced cluster upgrade',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause:
      'The cloud provider upgraded a Kubernetes Cluster off a version it no longer supports. Pods that used removed APIs crash-looped.',
    prevention:
      'Upgrade clusters at least once a quarter, or let a Platform team keep them current.',
    actions: [],
  },
  certificate: {
    id: 'certificate',
    name: 'Certificate expired',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause: 'The TLS certificate expired. Every browser refused the site.',
    prevention: 'Certificate automation renews it before it expires.',
    actions: ['cert-automation'],
  },
  'psp-outage': {
    id: 'psp-outage',
    name: 'Payment provider outage',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause: 'The Payment Provider went down. Every checkout failed.',
    prevention: 'Nothing on your side: it is their outage. Checkouts come back when it ends.',
    actions: [],
  },
  zone: {
    id: 'zone',
    name: 'Zone outage',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 120,
    cause: 'A whole zone failed. Every Node in it went grey.',
    prevention: 'Copies in a second zone with spare capacity, and a Database standby.',
    actions: ['multi-az'],
  },
  'disk-full': {
    id: 'disk-full',
    name: 'Disk full',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause: 'Logs and WAL filled the Database disk. Every write failed.',
    prevention: 'Alerts on disk catch it early. Expand the volume to end it.',
    actions: ['alerting'],
  },
  'repl-lag': {
    id: 'repl-lag',
    name: 'Replication lag',
    era: 3,
    severity: 3,
    escalatesTo: 2,
    duration: 60,
    cause:
      'A burst of writes left the replicas seconds behind. Reads after a write came back stale.',
    prevention: 'Read-your-writes routing sends those reads to the primary.',
    actions: ['ryw-routing'],
  },
  'latency-regression': {
    id: 'latency-regression',
    name: 'Latency regression',
    era: 3,
    severity: 3,
    escalatesTo: 2,
    duration: 60,
    cause: `A deploy put one more synchronous call on every request: each answer is ${LATENCY_REGRESSION_MS} ms slower.`,
    prevention: 'Percentiles and tracing on the request path, and a canary that watches p99.',
    actions: ['percentiles', 'tracing'],
  },
  'gc-storm': {
    id: 'gc-storm',
    name: 'GC pause storm',
    era: 3,
    severity: 3,
    escalatesTo: 2,
    duration: 60,
    cause: 'The heap passed 90%. The collector paused one request in ten.',
    prevention: 'More memory, ZGC, or GOGC tuning. Restart to end it.',
    actions: ['zgc', 'gogc-tuning'],
  },
  'retry-storm': {
    id: 'retry-storm',
    name: 'Retry storm',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 300,
    cause:
      'The Database slowed for 20 s. Callers retried at once, and the retries kept it overloaded.',
    prevention: 'Backoff with jitter, circuit breakers, and load shedding.',
    actions: ['backoff-jitter', 'circuit-breakers', 'load-shedding'],
  },
  'deadline-day': {
    id: 'deadline-day',
    name: 'Deadline day',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: `The contract's deadline landed: every agency sent its work at once, ${DEADLINE_SURGE}× the usual demand.`,
    prevention: 'Reserved capacity, load shedding, and a Queue for the deadline work.',
    actions: ['load-shedding', 'autoscaling'],
  },
  'double-charge': {
    id: 'double-charge',
    name: 'Double charge',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause:
      'The Payment Provider slowed. Charges timed out and were retried, and some charged twice.',
    prevention: 'Idempotency keys. Stop retries on the charge Link to end it.',
    actions: ['idempotency-keys'],
  },
  'report-db': {
    id: 'report-db',
    name: 'Report kills the database',
    era: 4,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: 'A quarter-end report scanned every table on the primary. Every kind slowed.',
    prevention: 'A Data Warehouse takes the scans off the primary.',
    actions: ['data-warehouse'],
  },
  'gpu-shortage': {
    id: 'gpu-shortage',
    name: 'GPU shortage',
    era: 4,
    severity: 3,
    escalatesTo: 2,
    duration: 120,
    cause: 'The provider reclaimed a GPU Node. No H100 capacity this month.',
    prevention: 'The LLM API takes prompts when GPUs run short.',
    actions: ['hosted-models'],
  },
  regex: {
    id: 'regex',
    name: 'Regex backtracking',
    era: 4,
    severity: 1,
    escalatesTo: 1,
    duration: 60,
    cause: 'A new WAF rule backtracked on long inputs. Every WAF ran at 100% CPU.',
    prevention: 'Roll rules out to a canary first. Disable the rule to end it.',
    actions: [],
  },
  region: {
    id: 'region',
    name: 'Region outage',
    era: 5,
    severity: 1,
    escalatesTo: 1,
    duration: 180,
    cause: 'A whole region failed. Its board went grey.',
    prevention: 'A second region, GeoDNS to send users there, and data that lives in both.',
    actions: ['multi-region', 'geo-dns'],
  },
  partition: {
    id: 'partition',
    name: 'Network partition',
    era: 5,
    severity: 1,
    escalatesTo: 1,
    duration: 45,
    cause: 'Regions lost contact. Calls between them timed out, and leader-based writes diverged.',
    prevention: 'A consensus store keeps one leader. Fence the old leader to end it.',
    actions: ['consensus'],
  },
  'hot-key': {
    id: 'hot-key',
    name: 'Hot key',
    era: 5,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: 'A celebrity posted. 30% of reads asked for one key, and its shard saturated.',
    prevention: 'Split hot keys across shards and cache them in the App Servers.',
    actions: ['hybrid-fanout'],
  },
  config: {
    id: 'config',
    name: 'Bad config push',
    era: 5,
    severity: 1,
    escalatesTo: 1,
    duration: 60,
    cause:
      'A config change reached every App Server and Worker at once, and they crashed together. GitOps all at once carried it to every Mirror too.',
    prevention: 'Roll back to end it. GitOps Staged holds a change on one region first.',
    actions: ['gitops'],
  },
  bgp: {
    id: 'bgp',
    name: 'BGP misconfiguration',
    era: 5,
    severity: 1,
    escalatesTo: 1,
    duration: 120,
    cause: 'A routing change withdrew the company from the internet. No region was reachable.',
    prevention: 'Review routing changes. Roll back to end it.',
    actions: [],
  },
  audit: {
    id: 'audit',
    name: 'Audit finding',
    era: 6,
    severity: 3,
    escalatesTo: 2,
    duration: 10,
    cause: 'A SOC 2 auditor found a gap. The DR drill no longer counts.',
    prevention: 'A Security team fixes findings before they reset anything.',
    actions: ['security-team'],
  },
  'dr-drill': {
    id: 'dr-drill',
    name: 'DR drill',
    era: 6,
    severity: 1,
    escalatesTo: 1,
    duration: 60,
    cause: 'A scripted failure of the home region, to measure recovery.',
    prevention: 'Serve every kind from another region within the hour, without losing writes.',
    actions: [],
  },
  breach: {
    id: 'breach',
    name: 'Data breach',
    era: 1,
    severity: 1,
    escalatesTo: 1,
    duration: 120,
    cause: 'A disclosed vulnerability stayed unpatched past its deadline, and someone used it.',
    prevention: 'Patch the ticket before it expires. The Team backlog shows the deadline.',
    actions: [],
  },
  'credential-leak': {
    id: 'credential-leak',
    name: 'Credential leak',
    era: 1,
    severity: 1,
    escalatesTo: 1,
    duration: 90,
    cause: 'A phishing page took the Company credentials, and a stranger used them.',
    prevention:
      'Read the domain, not the logo. Report the Mail as phishing and it loses its button.',
    actions: ['waf'],
  },
  'spot-reclaim': {
    id: 'spot-reclaim',
    name: 'Spot reclaim',
    era: 3,
    severity: 3,
    escalatesTo: 2,
    duration: SPOT_WARNING + SPOT_DOWN,
    cause:
      'The provider needed the capacity back. It reclaimed a Spot Node after a 10-second warning.',
    prevention: 'Mixed fleets, graceful shutdown, and on-demand copies behind a Load Balancer.',
    actions: [],
  },
  'stale-read': {
    id: 'stale-read',
    name: 'Stale reads',
    era: 2,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause:
      'A Cache served values past their TTL: a write-heavy table outran its invalidation, and reads of the same rows came back old.',
    prevention: 'A shorter TTL, a Cache that writes through, or read-your-writes routing.',
    actions: ['caching'],
  },
  reconnect: {
    id: 'reconnect',
    name: 'Reconnect storm',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 20,
    cause: 'A Realtime Hub restarted. Every client reconnected in the same second.',
    prevention: 'Reconnect jitter spreads the wave, and Clustering gives it more than one box.',
    actions: ['websockets'],
  },
  'runaway-bill': {
    id: 'runaway-bill',
    name: 'Runaway bill',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause:
      'An Autoscaler grew to its ceiling without a spike to serve, and Burn rose with no extra revenue.',
    prevention: 'Lower the Autoscaler ceiling, and read the cloud bill line by line.',
    actions: ['autoscaling'],
  },
  mtu: {
    id: 'mtu',
    name: 'MTU mismatch',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 60,
    cause:
      'A partner network uses a smaller packet size. Uploads larger than its MTU time out on the way in.',
    prevention: 'Clamp the packet size, or keep large uploads on one network.',
    actions: [],
  },
  'hot-shard': {
    id: 'hot-shard',
    name: 'Big tenant hot shard',
    era: 4,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: `The biggest tenant's key landed on one shard. Its reads and writes cost ${HOT_SHARD_CPU}× the CPU, and everything else on that shard waits behind it.`,
    prevention: 'Shard the tenant by key, and keep its reads in a Cache in front of the Database.',
    actions: ['sharding', 'caching'],
  },
  'premiere-spike': {
    id: 'premiere-spike',
    name: 'Premiere spike',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: `A premiere dropped: ${PREMIERE_SURGE}× the usual video demand, all in the same minute.`,
    prevention: 'Tiered caching at the CDN, reserved capacity, and load shedding.',
    actions: ['tiered-caching', 'load-shedding'],
  },
  'launch-day': {
    id: 'launch-day',
    name: 'Launch day',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: `The game launched: ${LAUNCH_SURGE}× the usual realtime messages, and every client connects at once.`,
    prevention: 'Realtime Hubs sized for the peak, reconnect jitter, and load shedding.',
    actions: ['websockets', 'load-shedding'],
  },
  'flash-sale': {
    id: 'flash-sale',
    name: 'Flash sale',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: 90,
    cause: `A flash sale: ${FLASH_SALE_SURGE}× the usual checkouts for a few minutes.`,
    prevention: 'A Queue for the checkout work, an Autoscaler, and load shedding.',
    actions: ['autoscaling', 'load-shedding'],
  },
  'jvm-warmup': {
    id: 'jvm-warmup',
    name: 'JVM warmup under load',
    era: 2,
    severity: 3,
    escalatesTo: null,
    duration: JVM_WARMUP_SECONDS,
    cause:
      'An Autoscaler added Java App Servers during a spike, and the new copies ran cold: 30% speed for their first 30 s.',
    prevention:
      'Slow start on the Load Balancer, scheduled scaling, and a GraalVM native image, which starts warm. With slow start a new copy takes traffic gradually, so it never answers cold.',
    actions: ['graal-native', 'autoscaling'],
  },
  'migration-lock': {
    id: 'migration-lock',
    name: 'Schema migration lock',
    era: 3,
    severity: 2,
    escalatesTo: null,
    duration: MIGRATION_LOCK_SECONDS,
    cause:
      'A migration ran ALTER TABLE on the biggest table. It held the lock while it copied it, and every write queued behind it until it timed out.',
    prevention: 'Online schema migrations change a big table without holding the lock.',
    actions: ['online-migrations'],
  },
  'supply-chain': {
    id: 'supply-chain',
    name: 'Supply-chain compromise',
    era: 4,
    severity: 1,
    escalatesTo: null,
    duration: SUPPLY_CHAIN_SECONDS,
    cause:
      'A dependency published a malicious version, and a deploy installed it. The package ran in the App Servers and shipped data out.',
    prevention:
      'Dependency scanning catches a published backdoor before the build installs it; Deno permissions keep a package from reading what it does not need.',
    actions: ['dependency-scanning', 'deno'],
  },
  'accidental-delete': {
    id: 'accidental-delete',
    name: 'Accidental delete',
    era: 4,
    severity: 2,
    escalatesTo: null,
    duration: ACCIDENTAL_DELETE_SECONDS,
    cause: 'An operator deleted data. A table was gone, and every query that needed it failed.',
    prevention:
      'Point-in-time recovery restores the table to the minute before the delete. Restore drills prove the backup restores.',
    actions: ['pitr', 'restore-drills'],
  },
  'operator-typo': {
    id: 'operator-typo',
    name: 'Operator typo',
    era: 5,
    severity: 2,
    escalatesTo: null,
    duration: OPERATOR_TYPO_SECONDS,
    cause:
      'A command meant to remove one Node matched the whole Component, and most of its Nodes went with it.',
    prevention:
      'A plan and a review before a change is applied show what it will remove, so a typo stops at the plan.',
    actions: ['infra-as-code'],
  },
  'table-bloat': {
    id: 'table-bloat',
    name: 'Table bloat',
    era: 3,
    severity: 2,
    escalatesTo: 1,
    duration: TABLE_BLOAT_SECONDS,
    cause:
      'PostgreSQL keeps the old version of every updated row until VACUUM cleans it. Heavy updates outran the cleaning, and the table filled with dead rows: every read and write costs more CPU.',
    prevention:
      'A retention window keeps the tables small, and a MySQL engine has no dead rows to clean.',
    actions: ['retention'],
  },
  'page-leak': {
    id: 'page-leak',
    name: 'Cached page leak',
    era: 3,
    severity: 1,
    escalatesTo: null,
    duration: PAGE_LEAK_SECONDS,
    cause:
      'The CDN cached a logged-in page under a key that left out the cookie, and served one user’s page to another.',
    prevention: 'A cache key that holds the cookie, so a personal page is never shared.',
    actions: [],
  },
  'leap-second': {
    id: 'leap-second',
    name: 'Leap second or clock skew',
    era: 5,
    severity: 1,
    escalatesTo: null,
    duration: LEAP_SECOND_SECONDS,
    cause:
      'A leap second repeated a second of the clock. Timers fired twice, leases expired early, and requests and locks across one region timed out.',
    prevention: 'Leap smearing spreads the second over a day, so no clock ever jumps.',
    actions: ['leap-smearing'],
  },
  'stale-opcache': {
    id: 'stale-opcache',
    name: 'Stale OPcache',
    era: 1,
    severity: 3,
    escalatesTo: null,
    duration: STALE_OPCACHE_SECONDS,
    cause:
      'OPcache runs with validate_timestamps off, and a deploy did not reset it. The PHP servers kept running the old code against the new schema, and a share of requests failed.',
    prevention:
      'A CI/CD Pipeline resets OPcache on every deploy. A restart clears the cache by hand.',
    actions: ['ci'],
  },
  'bun-compat': {
    id: 'bun-compat',
    name: 'Runtime compatibility',
    era: 3,
    severity: 3,
    escalatesTo: null,
    duration: RUNTIME_COMPAT_SECONDS,
    cause:
      'A package that works on Node.js does not work on Bun, which is less mature. A share of requests that touched it failed until the package was swapped.',
    prevention:
      'Automated tests run against the runtime a Service ships on, and catch the package before a deploy does.',
    actions: ['testing-culture'],
  },
  'gevent-compat': {
    id: 'gevent-compat',
    name: 'Library incompatibility',
    era: 2,
    severity: 3,
    escalatesTo: null,
    duration: RUNTIME_COMPAT_SECONDS,
    cause:
      'gevent monkey patches the standard library, and one library did not survive it: its calls blocked the hub, and a share of requests failed.',
    prevention:
      'Automated tests run the Service under gevent before it ships, and show which library breaks.',
    actions: ['testing-culture'],
  },
  'split-brain': {
    id: 'split-brain',
    name: 'Split brain',
    era: 4,
    severity: 2,
    escalatesTo: 1,
    duration: SPLIT_BRAIN_SECONDS,
    cause:
      'A network partition cut a Distributed Erlang cluster in two. Each half kept serving its own clients, and half of the realtime messages never reached the other.',
    prevention:
      'Chaos experiments find the partition before it does. A restart rejoins the cluster.',
    actions: ['chaos-engineering'],
  },
}

export const REPORT_SURGE = 10
export const STORM_SLOWDOWN = 0.3
export const STORM_TRIGGER = 20
export const GC_STORM_HEAP = 0.2
export const GC_STORM = 5
export const LAG_SURGE = 10
export const STALE_SURGE = 10
export const MTU_LOSS = 0.5
export const SLOW_CHARGE_MS = 1_500
export const REGEX_CAPACITY = 0.1

export const BOT_SURGE = 0.8
export const DDOS_MAGNITUDE = 50
export const STUFFING_MAGNITUDE = 19
export const CREDENTIAL_PROTECTION_BLOCK = 0.2

export const SPIKE_MAGNITUDE = [3, 10] as const
export const ESCALATION = 1.5
export const MIN_WEAKNESS = 0.2

export const UNINDEXED_MS_PER_ROW = 0.0001
export const ROWS_PER_USER = 100

export const OPEN_ACTION_WEIGHT = 2

export const ON_CALL_ACK = 5
export const SRE_MTTR = 0.4
export const SLA_CREDIT = 0.1
export const LEAK_RATE = 1 / 40
export const LEAK_KB_PER_REQUEST = 12
export const LEAK_FROM_STAGE = 2

export const ALERT_RULES = {
  errors: { threshold: 0.01, seconds: 30 },
  latency: { threshold: 4, seconds: 30 },
  saturation: { threshold: 0.9, seconds: 60 },
  queue: { threshold: 30, seconds: 60 },
  budget: { threshold: 10, seconds: 30 },
} as const
export const ALERT_THRESHOLDS = {
  errors: [0.005, 0.01, 0.05],
  latency: [2, 4, 8],
  saturation: [0.8, 0.9, 0.95],
  queue: [10, 30, 120],
  budget: [6, 10, 14.4],
} as const
export const ALERT_FATIGUE = 5
export const ANOMALY_DETECTION_HOLD = 0.5

export const CALENDAR_DURATION: Readonly<Record<1 | 2 | 3, number>> = { 1: 60, 2: 20, 3: 5 }

export const SLO_FROM_STAGE = 3
export const SLO_WINDOW_HOURS = 168
export const ERROR_BUDGET_FACTORS = { ahead: 1.1, normal: 1, spent: 0.5 } as const

export const DRILL_SECONDS = 60
export const DRILL_RTO = 60
export const DRILL_RPO = 5
export const DRILL_RECOVERED = 0.01
