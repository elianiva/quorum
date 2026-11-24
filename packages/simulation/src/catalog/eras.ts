// Eras and their traffic mixes are written in content/eras.qm and compiled by qmc.
export {
  ERAS,
  TUNED_PRE_SEED_MIX,
  TUNED_SEED_MIX,
  TUNED_SERIES_A_MIX,
  type EraDef,
} from '../generated/eras.ts'

export const RPS_PER_USER = 0.02
export const DIURNAL_AMPLITUDE = 0.45
export const WEEKEND_FACTOR = 1
export const STEP_SECONDS = 0.1
export const CALENDAR_START = 14 * 60
export const CHURN = 0.004
export const FICKLE_SHARE = 0.5
export const STEADY_CHURN = 0.2
export const FUNNEL_GROWTH = 1.1
export const DECLINED_GROWTH = 0.7
export const APDEX_WINDOW = 60
