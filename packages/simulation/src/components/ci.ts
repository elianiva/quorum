import { Effect, Schema } from 'effect'
export {
  ROLLOUT_SHARE,
  DEPLOY_STRATEGY_IDS,
  DEPLOY_STRATEGIES,
  STRATEGY_RESEARCH,
} from '../generated/ci.ts'
import { DEPLOY_STRATEGY_IDS } from '../generated/ci.ts'

export type DeployStrategyId = (typeof DEPLOY_STRATEGY_IDS)[number]

export type DeployStrategyDef = Readonly<{
  id: DeployStrategyId
  name: string
  deployMinutes: number
  blast: number
  burn: number
}>

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
