import { FoundStep, Menu, SettingsSection } from '../model.ts'
import { Schema } from 'effect'
import { GameUrl } from '../route.ts'

export const shellCases = {
  Continued: {},
  Connected: {},
  TitleOpened: {},
  ClockedIn: {},
  TitleRevealed: {},
  MenuChosen: { menu: Menu },
  SettingsSectionChosen: { section: SettingsSection },
  SettingsSectionOpened: { section: SettingsSection },
  SettingsSectionClosed: {},
  FoundStepChosen: { step: FoundStep },
  ClickedLink: { url: Schema.String, external: Schema.Boolean },
  ChangedUrl: { url: GameUrl },
  Navigated: {},
}
