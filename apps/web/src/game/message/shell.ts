import { FoundStep, Menu, SettingsSection } from '../model.ts'
import { Url } from 'foldkit/url'
import { UrlRequest } from 'foldkit/navigation'

export const shellCases = {
  Continued: {},
  Connected: {},
  TitleOpened: {},
  ClockedIn: {},
  TitleRevealed: {},
  MenuChosen: { menu: Menu },
  SettingsSectionChosen: { section: SettingsSection },
  FoundStepChosen: { step: FoundStep },
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  Navigated: {},
}
