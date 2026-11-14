import type { ComponentId } from './catalog.ts'

/* The glossary entries each Component teaches, as data. Kept apart from components/defs.ts so the
   wiki's term links do not load every Component's rules and the Simulation behind them. A test
   keeps this map equal to COMPONENT_GLOSSARY. */

export const COMPONENT_GLOSSARY: Partial<Record<ComponentId, ReadonlyArray<string>>> = {
  queue: ['at-least-once-delivery', 'backpressure', 'dead-letter-queue', 'transactional-outbox'],
  autoscaler: ['autoscaling', 'cold-start', 'diurnal-traffic', 'vertical-and-horizontal-scaling'],
  auth: ['bcrypt'],
  cache: ['cache-hit-rate', 'cache-aside', 'hot-key', 'write-through-cache'],
  cdn: ['cache-hit-rate', 'cdn-content-delivery-network', 'egress'],
  warehouse: ['cdc-change-data-capture', 'oltp-and-olap'],
  cluster: ['cold-start', 'container-orchestration'],
  pooler: ['connection-pooling'],
  wide: [
    'consistent-hashing',
    'eventual-consistency',
    'hedged-request',
    'hot-key',
    'leaderless-replication',
    'quorum',
    'tail-at-scale',
  ],
  dns: ['dns-round-robin', 'health-check', 'vertical-and-horizontal-scaling'],
  replica: [
    'eventual-consistency',
    'read-replica',
    'read-your-writes-consistency',
    'replication-lag',
  ],
  lb: ['health-check', 'load-balancer', 'vertical-and-horizontal-scaling'],
  psp: ['idempotency'],
  search: ['inverted-index'],
  doc: ['hot-key', 'sharding'],
  vec: ['model-inference'],
  log: ['at-least-once-delivery', 'cdc-change-data-capture'],
  gpu: ['model-inference'],
  llm: ['model-inference', 'rate-limiting'],
  storage: ['object-storage'],
  analytics: ['observability'],
  server: ['process-per-request'],
  dsql: ['quorum', 'raft', 'synchronous-replication'],
  waf: ['rate-limiting', 'waf-web-application-firewall'],
}
