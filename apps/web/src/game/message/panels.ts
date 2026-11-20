import { DashboardMessage } from '../dashboard.ts'
import { InboxMessage } from '../inbox.ts'
import { Listbox, Menu as UiMenu } from '@foldkit/ui'
import { Message as VolumeSliderMessage } from '@quorum/ui/primitives/slider'
import { Panel, ShopSlot, ShopSort, Tone } from '../model.ts'
import { PrefsMessage } from '../prefs.ts'
import { SurveyMessage } from '../survey.ts'
import { StackPickerMessage } from '../stack-picker.ts'
import { Schema } from 'effect'
import { FamilyId, IopsClass, ResearchId } from '@quorum/simulation/state'

export const panelsCases = {
  PanelOpened: { panel: Panel },
  ShopOpened: { nodeId: Schema.String, slot: ShopSlot },
  ShopSlotChosen: { slot: ShopSlot },
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
  LanguagePickerChanged: { message: Listbox.Message },
  VolumeSliderChanged: { message: VolumeSliderMessage },
  PoolSliderChanged: { message: VolumeSliderMessage },
  RuntimePickerChanged: { message: StackPickerMessage },
  FrameworkPickerChanged: { message: StackPickerMessage },
  MoreMenuChanged: { message: UiMenu.Message },
  ToastRaised: { message: Schema.String, tone: Tone },
  ToastCleared: { id: Schema.Finite },
  Synced: {},
}
