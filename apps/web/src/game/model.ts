import { MailMessage, Snippet } from './mail-text.ts'
import { TradeoffOption } from '@quorum/ui/game/tradeoff'
import { Listbox, Menu as UiMenu } from '@foldkit/ui'
import * as VolumeSlider from '@quorum/ui/primitives/slider'
import { Locale } from '../i18n/index.ts'
import { Effect, Schema } from 'effect'
import { DragAndDrop } from '@foldkit/ui'
import { DOCK_GROUPS, REQUEST_KINDS, type DockGroup } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import { solveFlow } from '@quorum/simulation/solve'
import { exitOffers } from '@quorum/simulation/exit'
import { Founder } from '@quorum/simulation/founder'
import { Playbook } from '@quorum/simulation/playbook'
import { Boot } from './boot-machine.ts'
import { Reveal } from './machine-state.ts'
export { Change, Delta, Figures, PreviewFigures, Reveal } from './machine-state.ts'
import { CompanyPhase, companyIdOf, isExited, isPlaying } from './company-machine.ts'
import { SurveyPhase } from './survey-machine.ts'
export { CompanyPhase } from './company-machine.ts'
import { TradeoffState } from './tradeoff-machine.ts'
export { TradeoffState } from './tradeoff-machine.ts'
import { ClockMode, away as clockAwayOf, paused as clockPausedOf } from './clock-machine.ts'
import { RoomPhase, inRoom } from './room-machine.ts'
import { Seat, Vote } from '@quorum/simulation/room'
import { ChangeState } from './change-machine.ts'
import { ConfirmDelete } from './confirm-delete-machine.ts'
import { DisclosureFlow } from './disclosure-machine.ts'
import { BoardFlow } from './board-machine.ts'
import { MailPhase } from './mail-machine.ts'
import { SENDER_KINDS } from './copy/senders.ts'
import { SandboxId, SandboxRun, Session } from './session-machine.ts'
import { History } from './history.ts'
import { NodeSample } from './node-metrics.ts'
import { StackPicker } from './stack-picker.ts'
import { AppRoute, MENU_PAGES } from './route.ts'
import { LogoId } from './logos.ts'
import { fileOf, SaveIndex } from './saves.ts'
import {
  ComponentId,
  FeatureId,
  Game,
  GameLink,
  GameNode,
  ResearchId,
  Region,
} from '@quorum/simulation/state'

export const Panel = Schema.Literals([
  'none',
  'room',
  'research',
  'team',
  'exit',
  'exited',
  'playbooks',
  'help',
  'offer',
  'era',
  'end',
  'dev',
  'passed',
  'challenge',
  'menu',
  'settings',
  'inbox',
  'dashboard',
  'churn',
  'mirror',
  'cost',
  'vitals',
])
export type Panel = typeof Panel.Type

export const BuildGroupKey = Schema.Literals(
  DOCK_GROUPS.map((group) => group.key) as [DockGroup, ...Array<DockGroup>],
)

export const Menu = Schema.Literals(['main', ...MENU_PAGES])
export type Menu = typeof Menu.Type

export { SandboxId, SandboxRun } from './session-machine.ts'

export const SandboxStore = Schema.Struct({
  passed: Schema.Array(SandboxId),
  free: Schema.NullOr(Game),
})
export type SandboxStore = typeof SandboxStore.Type

export const Survey = Schema.Struct({
  issues: Schema.String,
  likes: Schema.String,
  phase: SurveyPhase,
})
export type Survey = typeof Survey.Type

export const EMPTY_SURVEY: Survey = {
  issues: '',
  likes: '',
  phase: { _tag: 'Open' },
}

import { ChallengeRun } from './challenge-machine.ts'
export {
  ChallengeRun,
  type ChallengeResultRun,
  type ChallengeRunningRun,
} from './challenge-machine.ts'

export const Tone = Schema.Literals(['plain', 'ok', 'warn', 'danger', 'primary'])
export type Tone = typeof Tone.Type

export const Toast = Schema.Struct({
  id: Schema.Finite,
  message: Schema.String,
  tone: Tone,
  count: Schema.Finite,
})
export type Toast = typeof Toast.Type

export const MailEntry = Schema.Struct({
  time: Schema.Finite,
  text: Schema.String,
  message: Schema.optionalKey(MailMessage),
  closing: Schema.optionalKey(Snippet),
})

export const MailAction = Schema.Struct({ id: Schema.String, label: Schema.String })

const MAIL_FIELDS = {
  id: Schema.Finite,
  key: Schema.String,
  sender: Schema.String,
  subject: Schema.String,
  message: Schema.optionalKey(MailMessage),
  time: Schema.Finite,
  entries: Schema.Array(MailEntry),
  actions: Schema.Array(MailAction),
  read: Schema.Boolean,
  trashed: Schema.Boolean,
  spam: Schema.Boolean,
} as const

export const Mail = Schema.Struct({ ...MAIL_FIELDS, phase: MailPhase })
export type Mail = typeof Mail.Type

export const Folder = Schema.Literals(['action', 'fyi', 'spam', 'trash'])
export type Folder = typeof Folder.Type

export const MailLabel = Schema.Literals(SENDER_KINDS)
export type MailLabel = typeof MailLabel.Type

export { TradeoffOption }

export const TradeoffKind = Schema.Literals(['runtime', 'framework', 'family'])
export type TradeoffKind = typeof TradeoffKind.Type

export const RevealCue = Schema.Struct({ key: Reveal, left: Schema.Finite })
export type RevealCue = typeof RevealCue.Type

export const Motion = Schema.Literals(['system', 'reduce'])
export type Motion = typeof Motion.Type

export const TextSize = Schema.Literals(['normal', 'large'])
export type TextSize = typeof TextSize.Type

export const Theme = Schema.Literals(['light', 'dark'])
export type Theme = typeof Theme.Type

export const Palette = Schema.Struct({
  open: Schema.Boolean,
  query: Schema.String,
  active: Schema.NullOr(Schema.String),
})
export type Palette = typeof Palette.Type

export const EMPTY_PALETTE: Palette = { open: false, query: '', active: null }

export const Prefs = Schema.Struct({
  locale: Locale.pipe(Schema.withDecodingDefaultKey(Effect.succeed('en' as const))),
  seenTradeoffs: Schema.Array(TradeoffKind).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  muted: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  volume: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(100))),
  autoPause: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  blurPause: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  easyMode: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  motion: Motion.pipe(Schema.withDecodingDefaultKey(Effect.succeed('system' as const))),
  text: TextSize.pipe(Schema.withDecodingDefaultKey(Effect.succeed('normal' as const))),
  theme: Theme.pipe(Schema.withDecodingDefaultKey(Effect.succeed('light' as const))),
  agentAccess: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  analytics: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  pwaPromptSeen: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
})
export type Prefs = typeof Prefs.Type

export const Undo = Schema.Struct({
  label: Schema.String,
  nodes: Schema.Array(GameNode),
  links: Schema.Array(GameLink),
  nextId: Schema.Finite,
  cash: Schema.Finite,
  at: Schema.Finite,
})
export type Undo = typeof Undo.Type

export const ANNOTATION_GROUPS = ['design', 'deploys', 'incidents', 'company', 'research'] as const
export const AnnotationGroup = Schema.Literals(ANNOTATION_GROUPS)
export type AnnotationGroup = typeof AnnotationGroup.Type

export const Dashboard = Schema.Struct({
  history: History,
  range: Schema.Finite,
  hover: Schema.NullOr(Schema.Finite),
  postmortem: Schema.NullOr(Schema.Finite),
  groups: Schema.Array(AnnotationGroup),
  compare: Schema.Boolean,
  table: Schema.Boolean,
  kind: Schema.NullOr(Schema.Literals(REQUEST_KINDS)),
  service: Schema.NullOr(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
  region: Schema.NullOr(Region),
})
export type Dashboard = typeof Dashboard.Type

export const MailMute = Schema.Struct({ sender: Schema.String, until: Schema.Finite })
export type MailMute = typeof MailMute.Type

export const Inbox = Schema.Struct({
  mail: Schema.Array(Mail),
  focus: Schema.NullOr(Schema.Finite),
  peek: Schema.NullOr(Schema.Finite),
  bucket: Schema.Finite,
  sample: Schema.String,
  folder: Folder,
  label: Schema.NullOr(MailLabel),
  mutes: Schema.Array(MailMute),
  filter: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
})
export type Inbox = typeof Inbox.Type

export const ServiceDraft = Schema.Struct({
  name: Schema.String,
  owner: Schema.String,
  features: Schema.Array(FeatureId),
})
export type ServiceDraft = typeof ServiceDraft.Type

export const RenameTarget = Schema.Literals(['team', 'service'])
export type RenameTarget = typeof RenameTarget.Type

export const RenameDraft = Schema.Struct({
  target: RenameTarget,
  id: Schema.String,
  draft: Schema.String,
})
export type RenameDraft = typeof RenameDraft.Type

export const Team = Schema.Struct({
  drag: DragAndDrop.Model,
  service: ServiceDraft,
  rename: Schema.NullOr(RenameDraft),
})
export type Team = typeof Team.Type

export const Research = Schema.Struct({
  focus: Schema.NullOr(ResearchId),
  drag: DragAndDrop.Model,
  poolsOpen: Schema.Boolean,
  sheetWidth: Schema.Finite,
})
export type Research = typeof Research.Type

export const Clock = Schema.Struct({
  speed: Schema.Finite,
  mode: ClockMode,
  carry: Schema.Finite,
  savedAt: Schema.Finite,
  unsavedMs: Schema.Finite,
  sampledAt: Schema.Finite,
})
export type Clock = typeof Clock.Type

export const WhatIfRow = Schema.Struct({
  change: Schema.Literals(['larger', 'retries-off']),
  target: Schema.String,
  before: Schema.Finite,
  after: Schema.Finite,
})
export type WhatIfRow = typeof WhatIfRow.Type

export const Board = Schema.Struct({
  game: Game,
  session: Session,
  region: Region,
  selected: Schema.NullOr(Schema.String),
  selection: Schema.Array(Schema.String),
  flow: BoardFlow,
  clipboard: Schema.NullOr(Playbook),
  buildGroup: Schema.NullOr(BuildGroupKey),
  team: Team,
  research: Research,
  insightHelp: Schema.Boolean,
  clock: Clock,
  change: ChangeState,
  tradeoff: TradeoffState,
  disclosure: DisclosureFlow,
  undo: Schema.Array(Undo),
  redo: Schema.Array(Undo),
  whatIfsAt: Schema.Finite,
  screenshot: Schema.Boolean,
  whatIfs: Schema.NullOr(
    Schema.Struct({
      nodeId: Schema.String,
      at: Schema.Finite,
      rows: Schema.Array(WhatIfRow),
    }),
  ),
  nodeHistory: Schema.Record(Schema.String, Schema.Array(NodeSample)),
  nodeSample: Schema.NullOr(Schema.Struct({ nodeId: Schema.String, time: Schema.Finite })),
  inbox: Inbox,
  dashboard: Dashboard,
  alertQuiet: Schema.Array(Schema.Literals(['errors', 'latency', 'saturation', 'queue', 'budget'])),
  researchOffer: Schema.NullOr(Schema.Struct({ id: ResearchId, what: Schema.String })),
  lastGoal: Schema.String,
  lastBottleneck: Schema.String,
})
export type Board = typeof Board.Type

export const boardSandbox = (board: Board): SandboxRun | null =>
  board.session._tag === 'Sandbox' ? board.session.run : null

export const boardChallenge = (board: Board): ChallengeRun | null =>
  board.session._tag === 'Challenge' ? board.session.run : null

export const Room = Schema.Struct({
  phase: RoomPhase,
  seats: Schema.Array(Seat),
  speed: Schema.Finite,
  vote: Schema.NullOr(Vote),
  seq: Schema.Finite,
  name: Schema.String,
  draft: Schema.String,
})
export type Room = typeof Room.Type

export const EMPTY_ROOM: Room = {
  phase: { _tag: 'Idle' },
  seats: [],
  speed: 1,
  vote: null,
  seq: 1,
  name: '',
  draft: '',
}

export const roomLive = (model: Model): boolean => inRoom(model.room.phase)

export const onlineFileOf = (model: Model, code: string) =>
  model.saves.companies.find((file) => file.online?.code === code) ?? null

export const roomCode = (model: Model): string | null =>
  RoomPhase.guards.Idle(model.room.phase) ? null : model.room.phase.code

export const roomOwner = (model: Model): boolean =>
  RoomPhase.guards.Online(model.room.phase) && model.room.phase.owner

export const SettingsSection = Schema.Literals(['sound', 'play', 'display', 'privacy', 'save'])
export type SettingsSection = typeof SettingsSection.Type

export const Pwa = Schema.Struct({
  installable: Schema.Boolean,
  installed: Schema.Boolean,
  updateReady: Schema.Boolean,
  online: Schema.Boolean,
})
export type Pwa = typeof Pwa.Type

export const Model = Schema.Struct({
  route: AppRoute,
  boot: Boot,
  panel: Panel,
  palette: Palette,
  toast: Schema.NullOr(Toast),
  toastSeq: Schema.Finite,
  board: Board,
  room: Room,
  company: Schema.NullOr(Board),
  companyPhase: CompanyPhase,
  saves: SaveIndex,
  savesReady: Schema.Boolean,
  draft: Schema.Struct({ name: Schema.String, logo: LogoId }),
  saveFocus: Schema.NullOr(Schema.String),
  saveConfirm: ConfirmDelete,
  founder: Founder,
  survey: Survey,
  passed: Schema.Array(SandboxId),
  freeBoard: Schema.NullOr(Game),
  today: Schema.String,
  prefs: Prefs,
  pwa: Pwa,
  settingsSection: SettingsSection,
  languagePicker: Listbox.Model,
  volumeSlider: VolumeSlider.Model,
  runtimePicker: StackPicker,
  frameworkPicker: StackPicker,
  moreMenu: UiMenu.Model,
})
export type Model = typeof Model.Type

export const ledgerOf = (model: Model): Ledger => {
  const flow = solveFlow(model.board.game)
  const known = ledgers.get(flow)
  if (known) return known
  const ledger = { ...flow, bottleneck: null }
  ledgers.set(flow, ledger)
  return ledger
}

const ledgers = new WeakMap<Ledger, Ledger>()

export const currentFile = (model: Model) => fileOf(model.saves, companyIdOf(model.companyPhase))

export const playingId = (model: Model): string | null =>
  isPlaying(model.companyPhase) ? model.companyPhase.id : null

export const hasCompany = (model: Model): boolean =>
  playingId(model) !== null && currentFile(model) !== null

export const offCompany = (model: Model): boolean => model.board.session._tag !== 'Company'

export const exitLegacy = (model: Model): number | null => {
  if (offCompany(model) || isExited(model.companyPhase)) return null
  const offers = exitOffers(model.board.game, ledgerOf(model))
  return offers.length === 0 ? null : Math.max(...offers.map((offer) => offer.legacy))
}

export const inMenu = (model: Model): boolean =>
  model.panel === 'menu' || model.panel === 'settings'

export const halted = (model: Model): boolean =>
  !roomLive(model) &&
  (clockPausedOf(model.board.clock.mode) ||
    inMenu(model) ||
    model.palette.open ||
    model.boot._tag === 'Connecting')

export const clockPaused = (model: Model): boolean =>
  !roomLive(model) && clockPausedOf(model.board.clock.mode)

export const clockAway = (model: Model): boolean => clockAwayOf(model.board.clock.mode)

export const stampedPlaybook = (model: Model): Playbook | null => {
  const flow = model.board.flow
  if (flow._tag !== 'Stamping') return null
  return flow.source === 'clipboard'
    ? model.board.clipboard
    : (model.founder.playbooks[flow.source] ?? null)
}

export const placingOf = (model: Model): typeof ComponentId.Type | null =>
  model.board.flow._tag === 'Placing' ? model.board.flow.type : null

export const linkFromOf = (board: Board): string | null =>
  board.flow._tag === 'Linking' ? board.flow.from : null

export const confirmSellOf = (board: Board): ReadonlyArray<string> | null =>
  board.flow._tag === 'ConfirmingSell' ? board.flow.ids : null
