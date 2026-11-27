import { UiSchema } from '@effect/ui'
import { Founder } from '@quorum/simulation/founder'
import { Schema } from 'effect'
import { Prefs } from '../../game/prefs-schema.ts'
import { SaveIndex } from '../../game/saves.ts'
import { SandboxId } from '../../game/session-machine.ts'

export const TitleMessage = UiSchema.TaggedEnum({
  SavesLoaded: { index: SaveIndex },
  FounderLoaded: { founder: Founder, today: Schema.String },
  PrefsLoaded: { prefs: Prefs },
  SandboxLoaded: { passed: Schema.Array(SandboxId) },
})
export type TitleMessage = typeof TitleMessage.Type
