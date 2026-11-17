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
  networkKbps: Gauge | null
  creditsCoreSeconds: Readonly<{ balance: number; rate: number }> | null
}>

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

export type CostLine = Readonly<{ cause: CostCause; op: 'times' | 'plus'; value: number }>

export type Receipt = Readonly<{ base: number; lines: ReadonlyArray<CostLine>; total: number }>
