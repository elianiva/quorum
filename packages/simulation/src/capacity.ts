/* ==========================================================================
   The capacity figures a Node reports in the Ledger: what limits it, the
   resources it uses, and the Cost receipt of one request of each kind. The
   kernel (`kernel/`) works them out; these are their shapes.
   ========================================================================== */

export type Limit =
  | 'cpu'
  | 'credits'
  | 'memory'
  | 'workers'
  | 'connections'
  | 'network'
  | 'disk'
  | 'throughput'
  | 'none'

export type Gauge = Readonly<{ used: number; total: number }>

export type Resources = Readonly<{
  cpuCores: Gauge | null
  ramGb: Gauge | null
  slots: Gauge | null
  /** KB per second sent, against what the network card moves. */
  networkKbps: Gauge | null
  /** Burstable credits in core-seconds, and their change per second. */
  creditsCoreSeconds: Readonly<{ balance: number; rate: number }> | null
}>

/** What makes one request of a kind cost more or less at a Node (12 "Load diagnosis"). */
export type CostCause =
  | 'runtime'
  | 'collector'
  | 'opcache'
  | 'variant'
  | 'arm'
  | 'recycle'
  | 'warmup'
  | 'framework'
  | 'jit'
  | 'hashing'
  | 'async'
  | 'compression'
  | 'local-db'
  | 'serialization'
  | 'auth'
  | 'sampling'
  | 'neighbours'
  | 'swapping'
  | 'gc'
  | 'slow-query'
  | 'disk'
  | 'eviction'
  | 'hot-shard'
  | 'bloat'
  | 'denormalization'
  | 'indexes'
  | 'features'
  | 'engine'
  | 'multi-leader'
  | 'scatter'
  | 'report'
  | 'retention'
  | 'view'
  | 'busiest-shard'

export type WorkUnit = 'cpu' | 'workers' | 'network' | 'disk'

/** One step of a Cost receipt: the cost so far is multiplied by, or gets added, `value`. */
export type CostLine = Readonly<{ cause: CostCause; op: 'times' | 'plus'; value: number }>

/**
 * The Cost receipt of one request of a kind (12 "Load diagnosis"): the base cost, then each
 * factor in the order the model applies it. `total` is the cost the model uses; the lines explain it.
 */
export type Receipt = Readonly<{ base: number; lines: ReadonlyArray<CostLine>; total: number }>
