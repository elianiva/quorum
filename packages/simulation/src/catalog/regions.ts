export {
  REGIONS,
  HOME_REGION,
  REGION_INFO,
  USER_ROUND_TRIPS,
  ANYCAST_MS,
  HTTP3_CUT,
  HTTP2_CUT,
  EGRESS_CROSS_REGION,
  OPEN_REGION_PRICE,
  REGIONS_FROM_STAGE,
  ABROAD_SEED,
  BORDER_MIXING,
  DEVICES,
  DEVICE_INFO,
  NO_DEVICE_LATENCY,
  MIRROR_TIME_MINUTES,
  STAGE_WAIT_MINUTES,
  SYNC_POLL_MINUTES,
  IAC_SWITCH_MINUTES,
  IAC_TOOLS,
  SYNC_MODES,
  DATA_PATTERNS,
  REFRESH_TIME_MINUTES,
  IAC_TOOL_INFO,
} from '../generated/regions.ts'
import {
  REGIONS,
  RTT,
  DEVICES,
  IAC_TOOLS,
  SYNC_MODES,
  DATA_PATTERNS,
} from '../generated/regions.ts'

export type RegionId = (typeof REGIONS)[number]

export type RegionDef = Readonly<{
  name: string
  short: string
  share: number
  offset: number
}>

export const rttOf = (from: RegionId, to: RegionId): number =>
  from === to ? 0 : (RTT[`${from}-${to}`] ?? RTT[`${to}-${from}`] ?? 0)

export type DeviceId = (typeof DEVICES)[number]
export type IacToolId = (typeof IAC_TOOLS)[number]

export type SyncModeId = (typeof SYNC_MODES)[number]

export type DataPatternId = (typeof DATA_PATTERNS)[number]

export type IacToolDef = Readonly<{
  name: string
  language: string
  refreshOnPlan: boolean
  refresh: string | null
  repair: boolean
}>
