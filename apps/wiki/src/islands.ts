import { Schema } from 'effect'
import { COMPONENT_IDS, ERAS, LEVER_KINDS, RESEARCH_TRACKS } from '@quorum/simulation/catalog'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox-summary'
import { DESIGN_IDS } from './patterns/designs/ids.ts'

export const islandAttributes = {
  Note: Schema.Struct({ tone: Schema.optionalKey(Schema.Literals(['tip', 'warn', 'real'])) }),
  Sandbox: Schema.Struct({ id: Schema.Literals(SANDBOX_IDS) }),
  Design: Schema.Struct({ id: Schema.Literals(DESIGN_IDS) }),
  Component: Schema.Struct({ id: Schema.Literals(COMPONENT_IDS) }),
  Options: Schema.Struct({ id: Schema.Literals(COMPONENT_IDS) }),
  Mix: Schema.Struct({
    era: Schema.Literals(ERAS.map((_, index) => String(index)) as ReadonlyArray<string>),
  }),
  Lever: Schema.Struct({ kind: Schema.Literals(LEVER_KINDS) }),
  Quiz: Schema.Struct({
    question: Schema.String,
    options: Schema.String,
    answer: Schema.Literals(['1', '2', '3', '4', '5']),
    explain: Schema.String,
  }),
  Practice: Schema.Struct({ id: Schema.Literals(['place', 'wire', 'rearrange']) }),
  Track: Schema.Struct({ track: Schema.Literals(RESEARCH_TRACKS.map((entry) => entry.key)) }),
}
