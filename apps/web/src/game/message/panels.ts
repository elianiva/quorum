import { DashboardMessage } from '../dashboard.ts'
import { InboxMessage } from '../inbox.ts'
import { Panel, ShopMode, ShopSlot, ShopSort, Tone } from '../model.ts'
import { PrefsMessage } from '../prefs.ts'
import { SurveyMessage } from '../survey.ts'
import { StackPickerMessage } from '../stack-picker.ts'
import { Schema } from 'effect'
import * as Menu from '../menu.ts'
import { FamilyId, IopsClass, ResearchId } from '@quorum/simulation/state'

export const panelsCases = {
  PanelOpened: { panel: Panel },
  ShopOpened: { nodeId: Schema.String, slot: ShopSlot, mode: Schema.optional(ShopMode) },
  ShopSlotChosen: { slot: ShopSlot },
  ShopFamilyChosen: { family: FamilyId },
  ShopModeChosen: { mode: ShopMode },
  SelectInstance: { nodeId: Schema.String, family: FamilyId, size: Schema.Finite },
  ShopQueryChanged: { query: Schema.String },
  ShopSortChosen: { sort: ShopSort },
  InstallCpu: { nodeId: Schema.String, size: Schema.Finite },
  InstallRam: { nodeId: Schema.String, family: FamilyId },
  InstallDisk: { nodeId: Schema.String, iops: IopsClass },
  AlertsShown: {},
  ResearchOfferDismissed: {},
  ResearchShown: { id: ResearchId },
  ChurnFixTaken: {
    fix: Schema.Literals(['region', 'research', 'node']),
    target: Schema.String,
  },
  PanelClosed: {},

  PrefsLoaded: { json: Schema.NullOr(Schema.String) },
  PrefsChanged: { message: PrefsMessage },
  SurveyChanged: { message: SurveyMessage },
  WindowBlurred: {},
  WindowFocused: {},
  InsightHelpToggled: {},
  InboxChanged: { message: InboxMessage },

  DashboardChanged: { message: DashboardMessage },
  RuntimePickerChanged: { message: StackPickerMessage },
  FrameworkPickerChanged: { message: StackPickerMessage },
  MoreMenuChanged: { message: Menu.Message },
  ToastRaised: { message: Schema.String, tone: Tone },
  ToastCleared: { id: Schema.Finite },
  Synced: {},
}
