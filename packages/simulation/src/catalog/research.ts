import type { InsightPool } from './kinds.ts'
import {
  RESEARCH_INSIGHT,
  RESEARCH_LIST,
  type ResearchDef,
  type ResearchId,
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
export {
  TEAM_TRACKS,
  researchList,
  FRAMEWORK_RESEARCH,
  ERA_RECIPES,
  STUDY_SECONDS,
  MAX_STUDIES,
  SPIKE_SPEED,
  STUDY_SPEEDUP,
  STUDY_SPEED_RESEARCH,
} from '../generated/research.ts'
import { EVERY_KIND, ERA_RECIPES } from '../generated/research.ts'

export type ResearchTeamKind = 'product' | 'platform' | 'sre' | 'data' | 'security'
export const RESEARCH: Record<ResearchId, ResearchDef> = Object.fromEntries(
  RESEARCH_LIST.map((entry) => [entry.id, entry]),
) as Record<ResearchId, ResearchDef>

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
