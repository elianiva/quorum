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
import { RTT } from '../generated/regions.ts'

import type { RegionId } from '../generated/ids.ts'

export type { DataPatternId, DeviceId, IacToolId, RegionId, SyncModeId } from '../generated/ids.ts'
export type { IacToolDef, RegionDef } from '../generated/types.ts'

export const rttOf = (from: RegionId, to: RegionId): number =>
  from === to ? 0 : (RTT[`${from}-${to}`] ?? RTT[`${to}-${from}`] ?? 0)
