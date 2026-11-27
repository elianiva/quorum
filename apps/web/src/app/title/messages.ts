import { UiSchema } from '@effect/ui'
import { PERK_IDS } from '@quorum/simulation/catalog'
import { Founder } from '@quorum/simulation/founder'
import { Game, MutatorId, VentureId } from '@quorum/simulation/state'
import { Schema } from 'effect'
import { Locale } from '../../i18n/index.ts'
import { LogoId } from '../../game/logos.ts'
import { MENU_PAGES } from '../../game/menu-pages.ts'
import { Prefs } from '../../game/prefs-schema.ts'
import { SaveIndex } from '../../game/saves.ts'
import { SandboxId } from '../../game/session-machine.ts'
import { CurrentCompany, FoundStep, SettingsSection } from './model.ts'

export const MenuPage = Schema.Literals([...MENU_PAGES])
export type MenuPage = typeof MenuPage.Type

export const MenuChoice = Schema.Literals(['main', ...MENU_PAGES])
export type MenuChoice = typeof MenuChoice.Type

const PerkId = Schema.Literals([...PERK_IDS])

export const TitleMessage = UiSchema.TaggedEnum({
  SavesLoaded: { index: SaveIndex },
  FounderLoaded: { founder: Founder, today: Schema.String },
  PrefsLoaded: { prefs: Prefs },
  SandboxLoaded: { passed: Schema.Array(SandboxId) },
  PwaChanged: { installable: Schema.Boolean, installed: Schema.Boolean },
  MenuChosen: { menu: MenuChoice },

  Continued: {},
  CompanyChosen: { id: Schema.String },
  CompanyClosed: {},
  CompanyOpened: { id: Schema.String },
  CompanyLoaded: { id: Schema.String, open: Schema.Boolean, game: Game, index: SaveIndex },
  CompanyUnread: { id: Schema.String, open: Schema.Boolean },
  CompanyDeleteAsked: {},
  CompanyDeleteCancelled: {},
  CompanyDeleteConfirmed: {},
  CompanyDeleted: { id: Schema.String },
  CompanyImported: { index: SaveIndex, current: CurrentCompany },
  ImportFailed: { message: Schema.String },
  CompanyFileAsked: {},

  CompanyNameChanged: { name: Schema.String },
  LogoChosen: { logo: LogoId },
  VentureChosen: { id: VentureId },
  MutatorToggled: { id: MutatorId },
  FoundStepChosen: { step: FoundStep },
  CompanyFounded: {},
  PreseedStarted: {},
  CompanyStarted: { index: SaveIndex, current: CurrentCompany },

  PerkBought: { id: PerkId },

  GuidedStarted: { id: SandboxId },
  FreeSandboxStarted: {},
  ChallengeStarted: { id: Schema.String },

  SettingsSectionChosen: { section: SettingsSection },
  SettingsSectionClosed: {},

  LocaleChosen: { locale: Locale },
  MuteToggled: {},
  VolumeChanged: { volume: Schema.Finite },
  AutoPauseToggled: {},
  BlurPauseToggled: {},
  EasyModeToggled: {},
  AgentAccessToggled: {},
  MotionToggled: {},
  AnalyticsToggled: {},
  TextToggled: {},
  ThemeToggled: {},

  SaveExported: {},
  SaveDownloaded: {},
  SaveImportAsked: {},
  SaveFileAsked: {},
  SaveImported: { index: SaveIndex, current: CurrentCompany },
  StateCopied: {},
  PrivacyOpened: {},

  PwaInstallChosen: {},
  PwaInstallOutcome: { outcome: Schema.Literals(['accepted', 'dismissed', 'unavailable']) },
  PwaPromptDismissed: {},

  Noticed: { message: Schema.String },
  NoticeCleared: { message: Schema.String },
  Synced: {},
})
export type TitleMessage = typeof TitleMessage.Type
