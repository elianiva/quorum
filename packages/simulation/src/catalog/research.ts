import type { InsightPool } from './kinds.ts'
import type { FrameworkId } from './runtimes.ts'
import {
  FRAMEWORK_UNLOCKS,
  RESEARCH_INSIGHT,
  RESEARCH_LIST,
  type ResearchDef,
  type ResearchId,
  type ResearchTrack,
} from '../generated/research.ts'

// Research entries are written in content/research.qm and compiled by qmc.
export {
  BREADTH,
  REGION_BREADTH,
  RESEARCH_IDS,
  RESEARCH_TRACKS,
  SHAPE,
  STUDY_SHAPE_KINDS,
  type ResearchDef,
  type ResearchId,
  type ResearchTrack,
  type StudyShape,
  type StudyShapeKind,
} from '../generated/research.ts'

export type ResearchTeamKind = 'product' | 'platform' | 'sre' | 'data' | 'security'
export const TEAM_TRACKS: Record<ResearchTeamKind, ReadonlyArray<ResearchTrack>> = {
  product: ['product', 'runtimes', 'frameworks'],
  platform: ['infrastructure', 'performance', 'cost'],
  sre: ['reliability', 'observability'],
  data: ['data'],
  security: ['security'],
}

export const RESEARCH: Record<ResearchId, ResearchDef> = Object.fromEntries(
  RESEARCH_LIST.map((entry) => [entry.id, entry]),
) as Record<ResearchId, ResearchDef>

export const researchList = RESEARCH_LIST

export const FRAMEWORK_RESEARCH: Record<FrameworkId, ResearchId | null> = {
  none: null,
  ...FRAMEWORK_UNLOCKS,
}

const EVERY_KIND: ReadonlyArray<InsightPool> = [
  'page',
  'read',
  'write',
  'login',
  'search',
  'upload',
  'media',
  'rt',
  'buy',
  'job',
  'report',
  'ai',
  'feed',
  'hook',
  'push',
]
export const ERA_RECIPES: ReadonlyArray<ReadonlyArray<InsightPool>> = [
  ['page', 'read'],
  ['write', 'login'],
  ['search', 'upload'],
  ['search', 'upload'],
  ['media', 'rt', 'buy'],
  ['job', 'report', 'ai'],
  EVERY_KIND,
  EVERY_KIND,
]

export const STUDY_SECONDS = [20, 60, 120, 240, 480, 900, 1_800, 3_600] as const
export const MAX_STUDIES = 8
export const SPIKE_SPEED = 2
export const STUDY_SPEEDUP = 0.25
export const STUDY_SPEED_RESEARCH: ReadonlyArray<ResearchId> = ['trace-search', 'notebooks']

const recipeFor = (entry: ResearchDef): Readonly<Partial<Record<InsightPool, number>>> => {
  const kinds = RESEARCH_INSIGHT[entry.id] ?? ERA_RECIPES[entry.era] ?? EVERY_KIND
  const price = entry.cost
  const cost: Partial<Record<InsightPool, number>> = {}
  const failure = entry.track === 'reliability' && !kinds.includes('failure') ? price / 2 : 0
  if (failure > 0) cost.failure = failure
  for (const kind of kinds) cost[kind] = (cost[kind] ?? 0) + (price - failure) / kinds.length
  return cost
}

export const RECIPE: Record<
  ResearchId,
  Readonly<Partial<Record<InsightPool, number>>>
> = Object.fromEntries(RESEARCH_LIST.map((entry) => [entry.id, recipeFor(entry)])) as Record<
  ResearchId,
  Readonly<Partial<Record<InsightPool, number>>>
>
