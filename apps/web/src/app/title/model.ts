import { Founder, emptyFounder } from '@quorum/simulation/founder'
import { Game } from '@quorum/simulation/state'
import { Schema } from 'effect'
import { ConfirmDelete } from '../../game/confirm-delete-machine.ts'
import { DEFAULT_LOGO, LogoId } from '../../game/logos.ts'
import { Prefs } from '../../game/prefs-schema.ts'
import { PwaInstall } from '../../game/pwa-machine.ts'
import { SavesState } from '../../game/saves-machine.ts'
import { CompanyFile } from '../../game/saves.ts'
import { SandboxId } from '../../game/session-machine.ts'
import { today } from './data.ts'

export const FoundStep = Schema.Literals(['company', 'venture', 'mutators'])
export type FoundStep = typeof FoundStep.Type

export const SettingsSection = Schema.Literals(['sound', 'play', 'display', 'privacy', 'save'])
export type SettingsSection = typeof SettingsSection.Type

/* What the title reads off the current Company: the figures the old readout
   showed, taken from the save when it loads. */
export const CurrentCompany = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  logo: LogoId,
  stage: Schema.Finite,
  users: Schema.Finite,
  time: Schema.Finite,
  cash: Schema.Finite,
  apdex: Schema.Finite,
  latency: Schema.Finite,
  seed: Schema.Finite,
})
export type CurrentCompany = typeof CurrentCompany.Type

export const TitleModel = Schema.Struct({
  saves: SavesState,
  founder: Founder,
  prefs: Prefs,
  passed: Schema.Array(SandboxId),
  today: Schema.String,
  current: Schema.NullOr(CurrentCompany),
  draft: Schema.Struct({ name: Schema.String, logo: LogoId }),
  foundStep: FoundStep,
  saveFocus: Schema.NullOr(Schema.String),
  saveConfirm: ConfirmDelete,
  settingsOpen: Schema.Boolean,
  settingsSection: SettingsSection,
  pwa: PwaInstall,
  notice: Schema.NullOr(Schema.String),
})
export type TitleModel = typeof TitleModel.Type

export const initialTitle = (): TitleModel => ({
  saves: { _tag: 'Loading' },
  founder: emptyFounder(),
  prefs: Schema.decodeSync(Prefs)({}),
  passed: [],
  today: today(),
  current: null,
  draft: { name: '', logo: DEFAULT_LOGO },
  foundStep: 'company',
  saveFocus: null,
  saveConfirm: { _tag: 'List' },
  settingsOpen: false,
  settingsSection: 'sound',
  pwa: { _tag: 'Unavailable' },
  notice: null,
})

/* The readout's figures, for a save that was just read. */
export const currentOf = (file: CompanyFile, game: Game, latency: number): CurrentCompany => ({
  id: file.id,
  name: file.name,
  logo: file.logo,
  stage: game.stage,
  users: game.users,
  time: game.time,
  cash: game.cash,
  apdex: game.apdex,
  latency,
  seed: game.seed,
})
