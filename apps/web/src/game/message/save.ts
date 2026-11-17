import { IncidentId } from '@quorum/simulation/state'
import { Schema } from 'effect'

export const saveCases = {
  SaveExported: {},
  SaveDownloaded: {},
  SaveImportAsked: {},
  SaveFileAsked: {},
  SaveImported: { text: Schema.NullOr(Schema.String) },
  CompanyFileAsked: {},
  CompanyImported: { text: Schema.NullOr(Schema.String) },

  CheatCash: {},
  CheatInsight: {},
  CheatLegacy: {},
  CheatRound: {},
  IncidentForced: { kind: IncidentId },
  LogExported: {},
  StateCopied: {},
  AgentRoomCopied: {},
  LogCleared: {},
}
