import {
  FALLACY_IDS,
  FALLACY_INCIDENTS,
  type FallacyId,
  type IncidentId,
} from '../generated/incidents.ts'

// Incidents, the fallacies they teach, and their cascades are written in content/incidents.qm
// and compiled by qmc.
export {
  CASCADES,
  FALLACY_IDS,
  FALLACY_INCIDENTS,
  INCIDENT_IDS,
  INCIDENTS,
  KIND_SURGE,
  RUNTIME_INCIDENT_FAILURES,
  type FallacyId,
  type IncidentDef,
  type IncidentId,
} from '../generated/incidents.ts'
export { FLASH_SALE_SURGE, LAUNCH_SURGE, PREMIERE_SURGE } from '../generated/constants.ts'

export const fallacyOf = (kind: IncidentId): FallacyId | null =>
  FALLACY_IDS.find((id) => FALLACY_INCIDENTS[id] === kind) ?? null

export const SPOT_WARNING = 10
export const SPOT_DOWN = 20

export const LATENCY_REGRESSION_MS = 150
export const DEADLINE_SURGE = 3
export const HOT_SHARD_CPU = 3
export const JVM_WARMUP_SECONDS = 30
export const MIGRATION_LOCK_SECONDS = 150
export const SUPPLY_CHAIN_SECONDS = 90
export const ACCIDENTAL_DELETE_SECONDS = 120
export const OPERATOR_TYPO_SECONDS = 120
export const LEAP_SECOND_SECONDS = 60

export const STALE_OPCACHE_SECONDS = 90
export const RUNTIME_COMPAT_SECONDS = 90
export const SPLIT_BRAIN_SECONDS = 90
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
