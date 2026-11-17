import { Schema } from 'effect'
import { FamilyId, FrameworkId, RuntimeId } from '@quorum/simulation/state'

export const TradeoffOption = Schema.Union([
  Schema.Struct({ kind: Schema.Literal('runtime'), id: RuntimeId }),
  Schema.Struct({ kind: Schema.Literal('framework'), id: FrameworkId }),
  Schema.Struct({ kind: Schema.Literal('family'), id: FamilyId }),
])
export type TradeoffOption = typeof TradeoffOption.Type
