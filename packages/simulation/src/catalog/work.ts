import type { BackendKind, RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'
export {
  FEATURE_IDS,
  INTERNAL_TOOL_FEATURES,
  BACKGROUND_FEATURES,
  TASK_IDS,
  TASKS,
  QUARTER_DAYS,
  FIXES,
} from '../generated/work.ts'
import { FEATURE_IDS, TASK_IDS, FIXES } from '../generated/work.ts'
export { FEATURES } from '../generated/work.ts'

export type FeatureId = (typeof FEATURE_IDS)[number]

export type FeatureDef = Readonly<{
  id: FeatureId
  name: string
  era: number
  dh: number
  requires: ReadonlyArray<FeatureId>
  research: ResearchId | null
  market: number
  growth: number
  churn: number
  load: Partial<Record<RequestKind, number>>
  value: Partial<Record<RequestKind, number>>
  payload: Partial<Record<RequestKind, number>>
  queries: Partial<Record<BackendKind, number>>
  unlocks: Readonly<{ kind: RequestKind; share: number; gated: boolean }> | null
  shapes: number
  history: number
  subscription: boolean
  effect: string
  hidden: string | null
}>

export type TaskId = (typeof TASK_IDS)[number]

export type TaskDef = Readonly<{
  id: TaskId
  name: string
  dh: number
  research: ResearchId | null
  effect: string
  internal: boolean
}>

export type FixId = (typeof FIXES)[number]
