import { FIXES } from '@quorum/simulation/catalog'
import { LeverKindId } from '@quorum/simulation/state'
import { SandboxId } from '../model.ts'
import { Schema } from 'effect'

export const sessionCases = {
  SandboxStoreLoaded: { json: Schema.NullOr(Schema.String) },
  ChallengeStarted: { id: Schema.String },
  ChallengeRan: {},
  ChallengeFinished: {},
  ChallengeRebuilt: {},
  FixChosen: { fix: Schema.Literals(FIXES), on: Schema.Boolean },
  GuidedStarted: { id: SandboxId },
  FreeSandboxStarted: {},
  FreeSandboxReset: {},
  StressBoardLoaded: { big: Schema.Boolean },
  CompanyCopied: {},
  DemandStepped: { direction: Schema.Literals([1, -1]) },
  MixChosen: { stage: Schema.Finite },
  LeverStepped: { kind: LeverKindId, direction: Schema.Literals([1, -1]) },
}
