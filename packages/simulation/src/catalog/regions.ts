import { CALENDAR_DAY } from './team.ts'

export const REGIONS = ['na', 'eu', 'apac', 'sa'] as const
export type RegionId = (typeof REGIONS)[number]

export const HOME_REGION: RegionId = 'na'

export type RegionDef = Readonly<{
  name: string
  short: string
  share: number
  offset: number
}>

export const REGION_INFO: Record<RegionId, RegionDef> = {
  na: { name: 'North America', short: 'NA', share: 0.4, offset: 0 },
  eu: { name: 'Europe', short: 'EU', share: 0.3, offset: 360 },
  apac: { name: 'Asia-Pacific', short: 'APAC', share: 0.2, offset: 840 },
  sa: { name: 'South America', short: 'SA', share: 0.1, offset: 120 },
}

const RTT: Readonly<Record<string, number>> = {
  'na-eu': 75,
  'na-apac': 200,
  'na-sa': 120,
  'eu-apac': 160,
  'eu-sa': 190,
  'apac-sa': 300,
}

export const rttOf = (from: RegionId, to: RegionId): number =>
  from === to ? 0 : (RTT[`${from}-${to}`] ?? RTT[`${to}-${from}`] ?? 0)

export const USER_ROUND_TRIPS = 2
export const ANYCAST_MS = 20
export const HTTP3_CUT = 0.2
export const HTTP2_CUT = 0.15
export const EGRESS_CROSS_REGION = 0.02
export const OPEN_REGION_PRICE = 20_000
export const REGIONS_FROM_STAGE = 5
export const ABROAD_SEED = 0.05
export const BORDER_MIXING = 0.1

export const DEVICES = ['desktop', 'mobile', 'tablet'] as const
export type DeviceId = (typeof DEVICES)[number]
export const DEVICE_INFO: Record<
  DeviceId,
  Readonly<{ name: string; share: number; rttMs: number }>
> = {
  desktop: { name: 'Desktop', share: 0.45, rttMs: 0 },
  mobile: { name: 'Mobile', share: 0.45, rttMs: 60 },
  tablet: { name: 'Tablet', share: 0.1, rttMs: 30 },
}
export const NO_DEVICE_LATENCY: Record<DeviceId, number> = {
  desktop: 0,
  mobile: 0,
  tablet: 0,
}

export const MIRROR_TIME_MINUTES = 30
export const STAGE_WAIT_MINUTES = 60
export const SYNC_POLL_MINUTES = 3
export const IAC_SWITCH_MINUTES = CALENDAR_DAY

export const IAC_TOOLS = ['terraform', 'pulumi', 'alchemy'] as const
export type IacToolId = (typeof IAC_TOOLS)[number]

export const SYNC_MODES = ['all', 'staged'] as const
export type SyncModeId = (typeof SYNC_MODES)[number]

export const DATA_PATTERNS = ['replica', 'primary', 'replicate', 'call'] as const
export type DataPatternId = (typeof DATA_PATTERNS)[number]

export const REFRESH_TIME_MINUTES = 0.5

export type IacToolDef = Readonly<{
  name: string
  language: string
  refreshOnPlan: boolean
  refresh: string | null
  repair: boolean
}>

export const IAC_TOOL_INFO: Record<IacToolId, IacToolDef> = {
  terraform: {
    name: 'Terraform',
    language: 'HCL',
    refreshOnPlan: true,
    refresh: null,
    repair: false,
  },
  pulumi: {
    name: 'Pulumi',
    language: 'TypeScript',
    refreshOnPlan: false,
    refresh: 'pulumi refresh',
    repair: false,
  },
  alchemy: {
    name: 'Alchemy',
    language: 'TypeScript',
    refreshOnPlan: false,
    refresh: 'alchemy drift',
    repair: true,
  },
}
