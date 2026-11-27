import { UiSchema } from '@effect/ui'
import { Founder } from '@quorum/simulation/founder'
import { Schema } from 'effect'
import { MENU_PAGES } from '../../game/menu-pages.ts'
import { Prefs } from '../../game/prefs-schema.ts'
import { SaveIndex } from '../../game/saves.ts'
import { SandboxId } from '../../game/session-machine.ts'

export const MenuPage = Schema.Literals([...MENU_PAGES])
export type MenuPage = typeof MenuPage.Type

export const MenuChoice = Schema.Literals(['main', ...MENU_PAGES])
export type MenuChoice = typeof MenuChoice.Type

export const TitleMessage = UiSchema.TaggedEnum({
  SavesLoaded: { index: SaveIndex },
  FounderLoaded: { founder: Founder, today: Schema.String },
  PrefsLoaded: { prefs: Prefs },
  SandboxLoaded: { passed: Schema.Array(SandboxId) },
  MenuChosen: { menu: MenuChoice },
  CompanyStarted: {},
})
export type TitleMessage = typeof TitleMessage.Type
