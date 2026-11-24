// The kind lists are written in content/kinds.qm and compiled by qmc.
import {
  BACKEND_KINDS,
  REQUEST_KINDS,
  type BackendKind,
  type RequestKind,
} from '../generated/kinds.ts'
export {
  BACKEND_KINDS,
  DATA_KINDS,
  REQUEST_KINDS,
  type BackendKind,
  type RequestKind,
} from '../generated/kinds.ts'
export {
  KINDS,
  INSIGHT_POOLS,
  PROFILES,
  QUERY_CPU,
  STREAM_KB,
  RT_HOLD_SECONDS,
  USER_MBPS,
  USER_UP_MBPS,
  GZIP_RATIO,
  GZIP_CPU,
  LOGIN_DELEGATED_CPU,
  CALLOUT_MS,
  CALLOUT_FAILURE,
  FOLLOWERS,
  HYBRID_WRITES,
  HYBRID_READS,
} from '../generated/kinds.ts'
import { KINDS, INSIGHT_POOLS } from '../generated/kinds.ts'

export type Kind = RequestKind | BackendKind

export const isBackendKind = (kind: Kind): kind is BackendKind =>
  (BACKEND_KINDS as ReadonlyArray<Kind>).includes(kind)

export type KindInfo = Readonly<{
  label: string
  value: number
  color: number
}>

export type InsightPool = (typeof INSIGHT_POOLS)[number]

export const POOLS: Record<InsightPool, Readonly<{ label: string; color: number }>> = {
  ...(Object.fromEntries(
    REQUEST_KINDS.map((kind) => [kind, { label: KINDS[kind].label, color: KINDS[kind].color }]),
  ) as Record<RequestKind, Readonly<{ label: string; color: number }>>),
  failure: { label: 'Failure', color: 0xf04438 },
}

export type RequestProfile = Readonly<{
  cpu: number
  native: boolean
  apdex: number
  calls: Readonly<Partial<Record<Exclude<BackendKind, 'auth' | 'task'>, number>>>
  asyncCalls: Readonly<
    Partial<Record<'q-read' | 'q-write' | 'blob-put' | 'notify' | 'callout', number>>
  >
  orm: boolean
  payloadKB: number
  asyncKB: number
  stream: boolean
  compressible: boolean
  inKB: number
  offload: number
  completion?: number
  scored: boolean
}>
