import { EXIT_IDS, PERK_IDS } from '@quorum/simulation/catalog'
import { MutatorId, ResearchId, VentureId } from '@quorum/simulation/state'
import { Schema } from 'effect'

export const exitCases = {
  ExitTaken: { exit: Schema.Literals(EXIT_IDS) },
  KeepToggled: { id: ResearchId },
  PerkBought: { id: Schema.Literals(PERK_IDS) },
  VentureChosen: { id: VentureId },
  MutatorToggled: { id: MutatorId },
  PlaybookSaved: {},
  PlaybookChosen: { index: Schema.Finite },
  PlaybookDeleted: { index: Schema.Finite },
  PlaybookExported: { index: Schema.Finite },
  PlaybookImportAsked: {},
  PlaybookImported: { text: Schema.NullOr(Schema.String) },
  RoundRaised: {},
  RoundDeclined: {},
  BridgeAccepted: {},
  PostmortemFiled: { id: Schema.Finite, take: Schema.Boolean },

  SurveySubmitted: {},
  SurveySkipped: {},
  SurveySent: {},
  SurveyFailed: { message: Schema.String, offline: Schema.Boolean },
}
