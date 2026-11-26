import { Data } from 'effect'
import type { FeatureId, ResearchId } from './catalog.ts'
import type { BlockKind, Incident, Postmortem, WorkItem } from './state.ts'

export type AlertRule = 'errors' | 'latency' | 'saturation' | 'queue' | 'budget'

export type StepEvent = Data.TaggedEnum<{
  IncidentStarted: { readonly incident: Incident }
  IncidentResolved: { readonly postmortem: Postmortem }
  DrawerFull: {}
  OutOfMemory: { readonly nodeId: string }
  CreditsExhausted: { readonly nodeId: string }
  AlertFired: { readonly rule: AlertRule }
  AlertIgnored: { readonly rule: AlertRule }
  Hired: { readonly engineerId: string }
  WorkFinished: { readonly item: WorkItem }
  Deployed: { readonly features: ReadonlyArray<FeatureId>; readonly bad: boolean }
  MigrationShifted: { readonly step: number; readonly scope: 'design' | 'worker' }
  CveDisclosed: { readonly item: WorkItem }
  PatchProposed: { readonly item: WorkItem; readonly engineerId: string }
  Blocked: { readonly item: WorkItem; readonly reason: BlockKind; readonly engineerId: string }
  EngineerUnhappy: { readonly engineerId: string }
  CveExploited: { readonly cve: string; readonly target: string }
  StudyCompleted: { readonly research: ResearchId }
}>

export const StepEvent = Data.taggedEnum<StepEvent>()
