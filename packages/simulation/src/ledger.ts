import type { Limit, Receipt, Resources, WorkUnit } from './capacity.ts'
import type { DeviceId, InsightPool, Kind, RegionId, RequestKind } from './catalog.ts'
import type { ErrorCause, Failures } from './distribution.ts'

export type NodeStatus = 'idle' | 'ok' | 'warn' | 'danger' | 'down'

export type BurnLines = Readonly<{
  compute: number
  data: number
  storage: number
  egress: number
  thirdParty: number
  requests: number
  observability: number
  salaries: number
}>

export type NodeLedger = Readonly<{
  inbound: number
  traffic: Readonly<Partial<Record<Kind, number>>>
  capacity: number
  utilization: number
  limit: Limit
  latency: number
  p99: number
  hopByKind: Readonly<Partial<Record<Kind, number>>>
  waitByKind: Readonly<Partial<Record<Kind, number>>>
  workShare: Readonly<Partial<Record<Kind, number>>>
  workUnit: WorkUnit | null
  cost: number
  receipts: Readonly<Partial<Record<Kind, Receipt>>>
  repeated: number
  origins: Readonly<Partial<Record<RequestKind, number>>>
  dropped: number
  refused: number
  stranded: number
  strandedKinds: ReadonlyArray<Kind>
  connections: Readonly<{ used: number; max: number }> | null
  hitRatio: number | null
  evictions: number | null
  age: number | null
  lagMs: number | null
  disk: boolean
  out: Readonly<Partial<Record<Kind, number>>>
  resources: Resources
  throttled: boolean
  swapping: boolean
  status: NodeStatus
}>

export type LinkLedger = Readonly<{
  from: string
  to: string
  rate: number
  traffic: Readonly<Partial<Record<Kind, number>>>
  kind: Kind
  failing: boolean
  failure: number
}>

export type KindLedger = Readonly<{
  rate: number
  success: number
  apdex: number
  completion: number | null
  mean: number
  p50: number
  p95: number
  p99: number
}>

export type RegionKindLedger = Readonly<{
  rate: number
  success: number
  apdex: number
  near: number
  fail: Failures
  hopMs: number
  p99: number
}>

export type ServiceLedger = Readonly<{
  kinds: ReadonlyArray<RequestKind>
  rate: number
  served: number
  failed: number
  apdex: number
  mean: number
  p99: number
}>

export type Ledger = Readonly<{
  nodes: Readonly<Record<string, NodeLedger>>
  links: ReadonlyArray<LinkLedger>
  kinds: Readonly<Partial<Record<RequestKind, KindLedger>>>
  demand: number
  served: number
  errors: Readonly<Record<ErrorCause, number>>
  errorShare: number
  latency: number
  p50: number
  p95: number
  p99: number
  apdex: number
  regions: Readonly<Partial<Record<RegionId, number>>>
  deviceLatency: Readonly<Record<DeviceId, number>>
  regionKinds: Readonly<
    Partial<Record<RegionId, Readonly<Partial<Record<RequestKind, RegionKindLedger>>>>>
  >
  revenue: number
  subscriptions: number
  insight: Readonly<Record<InsightPool, number>>
  breadth: Readonly<Partial<Record<RequestKind, number>>>
  breadthRegions: Readonly<Partial<Record<RequestKind, number>>>
  burn: number
  fines: number
  salaries: number
  egress: number
  fees: number
  burnLines: BurnLines
  revenueByKind: Readonly<Partial<Record<RequestKind, number>>>
  finesByKind: Readonly<Partial<Record<RequestKind, number>>>
  costPerKind: Readonly<Partial<Record<RequestKind, number>>>
  costPerService: Readonly<Partial<Record<string, number>>>
  services: Readonly<Record<string, ServiceLedger>>
  market: number
  velocity: number
  failing: ReadonlyArray<RequestKind>
  forecastPeak: number
  bottleneck: string | null
  bottleneckByKind: Readonly<Partial<Record<RequestKind, string>>>
}>

export const unsampledOf = (ledger: Ledger): Readonly<{ rate: number; share: number }> => {
  let rate = 0
  let served = 0
  for (const [kind, entry] of Object.entries(ledger.kinds) as Array<[RequestKind, KindLedger]>) {
    served += entry.rate
    if ((ledger.breadth[kind] ?? 0) === 0) rate += entry.rate
  }
  return { rate, share: served > 0 ? rate / served : 0 }
}
