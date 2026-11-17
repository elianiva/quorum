import { PreviewFigures, TradeoffOption, WhatIfRow } from '../model.ts'
import { Schema } from 'effect'

export const tradeoffCases = {
  OptionPreviewed: { nodeId: Schema.String, option: TradeoffOption },
  PreviewComputed: { nodeId: Schema.String, option: TradeoffOption, preview: PreviewFigures },
  WhatIfsFound: { nodeId: Schema.String, at: Schema.Finite, rows: Schema.Array(WhatIfRow) },
  OptionLeft: {},
  OptionChosen: { nodeId: Schema.String, option: TradeoffOption },
  OptionConfirmed: {},
  TradeoffClosed: {},
}
