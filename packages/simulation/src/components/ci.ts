import type { DEPLOY_STRATEGY_IDS } from '../generated/ci.ts'

export type DeployStrategyId = (typeof DEPLOY_STRATEGY_IDS)[number]

export type DeployStrategyDef = Readonly<{
  id: DeployStrategyId
  name: string
  deployMinutes: number
  blast: number
  burn: number
}>
