import { Founder, emptyFounder } from '@quorum/simulation/founder'
import { Schema } from 'effect'
import { Prefs } from '../../game/prefs-schema.ts'
import { SavesState } from '../../game/saves-machine.ts'
import { SandboxId } from '../../game/session-machine.ts'
import { today } from './data.ts'

export const TitleModel = Schema.Struct({
  saves: SavesState,
  founder: Founder,
  prefs: Prefs,
  passed: Schema.Array(SandboxId),
  today: Schema.String,
})
export type TitleModel = typeof TitleModel.Type

export const initialTitle = (): TitleModel => ({
  saves: { _tag: 'Loading' },
  founder: emptyFounder(),
  prefs: Schema.decodeSync(Prefs)({}),
  passed: [],
  today: today(),
})
