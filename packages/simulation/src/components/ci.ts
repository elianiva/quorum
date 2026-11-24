import { Effect, Schema } from 'effect'
import type { ResearchId } from '../catalog/research.ts'

export const ROLLOUT_SHARE = 0.25

export const DEPLOY_STRATEGY_IDS = ['recreate', 'rolling', 'blue-green', 'canary'] as const
export type DeployStrategyId = (typeof DEPLOY_STRATEGY_IDS)[number]

export type DeployStrategyDef = Readonly<{
  id: DeployStrategyId
  name: string
  deployMinutes: number
  blast: number
  burn: number
}>

export const DEPLOY_STRATEGIES: Record<DeployStrategyId, DeployStrategyDef> = {
  recreate: { id: 'recreate', name: 'Recreate', deployMinutes: 2, blast: 1, burn: 1 },
  rolling: { id: 'rolling', name: 'Rolling', deployMinutes: 5, blast: 0.4, burn: 1 },
  'blue-green': { id: 'blue-green', name: 'Blue-green', deployMinutes: 7, blast: 0.1, burn: 2 },
  canary: { id: 'canary', name: 'Canary', deployMinutes: 10, blast: 0.05, burn: 1.5 },
}

export const STRATEGY_RESEARCH: Partial<Record<DeployStrategyId, ResearchId>> = {
  'blue-green': 'blue-green',
  canary: 'canary',
}

export const DeployStrategy = Schema.Literals([
  'recreate',
  'rolling',
  'blue-green',
  'canary',
] as const satisfies ReadonlyArray<DeployStrategyId>)
export type DeployStrategy = typeof DeployStrategy.Type

export const ciFields = {
  strategy: DeployStrategy.pipe(Schema.withDecodingDefaultKey(Effect.succeed('rolling' as const))),
} as const
