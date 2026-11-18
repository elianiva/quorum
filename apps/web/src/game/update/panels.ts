import { ApplySettings, FocusDashboard, WritePrefs } from '../commands.ts'
import { EMPTY_RESEARCH, ResearchMessage } from '../research.ts'
import { Message } from '../message.ts'
import { Model, Prefs, clockAway, halted, offCompany, roomLive } from '../model.ts'
import { isExited } from '../company-machine.ts'
import { clockStep } from '../clock-machine.ts'
import { Option, Schema } from 'effect'
import { PrefsMessage, updatePrefs, volumeIn } from '../prefs.ts'
import { updateSurvey } from '../survey.ts'
import { Update } from 'foldkit'
import {
  closePanel,
  saveCommands,
  withToast,
  type Dispatch,
  type MessageCases,
  type UpdateResult,
} from './shared.ts'
import { foldInbox } from './mail.ts'
import { leaveExited } from './companies.ts'
import { has } from '@quorum/simulation/lookups'
import { initTeam } from '../team.ts'
import { languageListbox } from '../../i18n/listbox.ts'
import { updateStackPicker } from '../stack-picker.ts'
import { moreMenu, type MoreItem } from '../more.ts'
import { onBoard } from '../route.ts'
import { openRegions } from '@quorum/simulation/regions'
import { listing, openingFolder } from '../inbox.ts'
import { type RegionId as Region, type ResearchId } from '@quorum/simulation/catalog'
import { updateDashboard } from '../dashboard.ts'
import * as VolumeSlider from '@quorum/ui/primitives/slider'

export const savePrefs = (model: Model): UpdateResult => ({
  model,
  commands: [
    WritePrefs({ prefs: model.prefs }),
    ApplySettings({
      muted: model.prefs.muted,
      volume: model.prefs.volume,
      motion: model.prefs.motion,
      locale: model.prefs.locale,
      agentAccess: model.prefs.agentAccess,
      analytics: model.prefs.analytics,
      text: model.prefs.text,
      theme: model.prefs.theme,
    }),
  ],
})

const plainClock = (model: Model): UpdateResult =>
  model.prefs.easyMode
    ? { model }
    : {
        model: {
          ...model,
          board: {
            ...model.board,
            clock: {
              ...model.board.clock,
              speed: 1,
              mode: clockAway(model)
                ? model.board.clock.mode
                : clockStep(model.board.clock.mode, { _tag: 'Resumed' }),
            },
          },
        },
      }

export const foldPrefs = (model: Model, message: PrefsMessage): UpdateResult =>
  Update.combine(model, [
    Update.foldChild({
      update: updatePrefs,
      read: (parent: Model) => Option.some(parent.prefs),
      write: (parent, prefs) => ({ ...parent, prefs }),
      toParentMessage: (child) => Message.PrefsChanged({ message: child }),
    })(message),
    message._tag === 'EasyModeToggled' ? plainClock : (model: Model) => ({ model }),
    savePrefs,
  ])

export const foldSurvey = Update.foldChild({
  update: updateSurvey,
  read: (model: Model) => Option.some(model.survey),
  write: (model, survey) => ({ ...model, survey }),
  toParentMessage: (message) => Message.SurveyChanged({ message }),
})

export const foldDashboard = Update.foldChild({
  update: updateDashboard,
  read: (model: Model) => Option.some(model.board.dashboard),
  write: (model, dashboard) => ({ ...model, board: { ...model.board, dashboard } }),
  toParentMessage: (message) => Message.DashboardChanged({ message }),
})

const readableFields = (saved: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(Prefs.fields)
      .filter(
        ([key, field]) =>
          key in saved &&
          Option.isSome(Schema.decodeUnknownOption(Schema.Struct({ [key]: field }))(saved)),
      )
      .map(([key]) => [key, saved[key]]),
  )

export const parsePrefs = (json: string) =>
  Option.flatMap(
    Schema.decodeOption(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)))(json),
    (saved) =>
      Option.map(Schema.decodeOption(Prefs)(readableFields(saved)), (prefs) => ({
        ...prefs,
        volume: volumeIn(prefs.volume),
      })),
  )

export const foldVolumeSlider = (route: Dispatch) =>
  Update.foldChild({
    update: VolumeSlider.update,
    read: (model: Model) => Option.some(model.volumeSlider),
    write: (model, volumeSlider) => ({ ...model, volumeSlider }),
    toParentMessage: (message) => Message.VolumeSliderChanged({ message }),
    foldOutMessage:
      ({ value }) =>
      (model) =>
        route(
          model,
          Message.PrefsChanged({ message: PrefsMessage.VolumeChanged({ volume: value }) }),
        ),
  })

export const foldLanguagePicker = (route: Dispatch) =>
  Update.foldChild({
    update: languageListbox.update,
    read: (model: Model) => Option.some(model.languagePicker),
    write: (model, languagePicker) => ({ ...model, languagePicker }),
    toParentMessage: (message) => Message.LanguagePickerChanged({ message }),
    foldOutMessage:
      ({ value }) =>
      (model) =>
        route(
          model,
          Message.PrefsChanged({ message: PrefsMessage.LocaleChosen({ locale: value }) }),
        ),
  })

export const MORE_ACTIONS: Record<MoreItem, Message> = {
  exit: Message.PanelOpened({ panel: 'exit' }),
  playbooks: Message.PanelOpened({ panel: 'playbooks' }),
  dashboard: Message.PanelOpened({ panel: 'dashboard' }),
  help: Message.PanelOpened({ panel: 'help' }),
  undo: Message.UndoChosen(),
  redo: Message.RedoChosen(),
  tidy: Message.BoardTidied(),
  fit: Message.BoardFitted(),
  fullscreen: Message.FullscreenToggled(),
  screenshot: Message.ScreenshotToggled(),
}

export const foldMoreMenu = (route: Dispatch) =>
  Update.foldChild({
    update: moreMenu.update,
    read: (model: Model) => Option.some(model.moreMenu),
    write: (model, moreMenu) => ({ ...model, moreMenu }),
    toParentMessage: (message) => Message.MoreMenuChanged({ message }),
    foldOutMessage:
      ({ value }) =>
      (model) =>
        route(model, MORE_ACTIONS[value]),
  })

type PanelsTag =
  | 'PanelOpened'
  | 'ResearchShown'
  | 'ChurnFixTaken'
  | 'PanelClosed'
  | 'PrefsLoaded'
  | 'PrefsChanged'
  | 'SurveyChanged'
  | 'WindowBlurred'
  | 'WindowFocused'
  | 'InsightHelpToggled'
  | 'InboxChanged'
  | 'DashboardChanged'
  | 'LanguagePickerChanged'
  | 'VolumeSliderChanged'
  | 'RuntimePickerChanged'
  | 'FrameworkPickerChanged'
  | 'MoreMenuChanged'
  | 'ToastRaised'
  | 'AlertsShown'
  | 'ResearchOfferDismissed'
  | 'ToastCleared'
  | 'Synced'

export const panelsHandlers = (
  model: Model,
  route: Dispatch,
): MessageCases<UpdateResult, PanelsTag> => ({
  PanelOpened: ({ panel }) => {
    const opened: Model = {
      ...model,
      panel,
      board: {
        ...model.board,
        team: initTeam(),
        flow: { _tag: 'Idle' },
        research: EMPTY_RESEARCH,
        dashboard: { ...model.board.dashboard, hover: null },
        buildGroup: null,
      },
    }
    const next =
      panel === 'inbox'
        ? {
            ...opened,
            board: {
              ...opened.board,
              inbox: listing(
                {
                  ...opened.board.inbox,
                  folder: openingFolder(opened.board.inbox),
                  label: null,
                },
                opened.board.inbox.focus,
              ),
            },
          }
        : opened
    return {
      model: next,
      commands: panel === 'dashboard' && model.panel !== 'dashboard' ? [FocusDashboard({})] : [],
    }
  },

  ResearchOfferDismissed: () => ({
    model: { ...model, board: { ...model.board, researchOffer: null } },
  }),

  AlertsShown: () => {
    const opened = route(model, Message.PanelOpened({ panel: 'dashboard' }))
    return { model: opened.model, commands: [FocusDashboard({ focus: 'alert-rules' })] }
  },

  ResearchShown: ({ id }) => {
    const opened = route(
      { ...model, board: { ...model.board, researchOffer: null } },
      Message.PanelOpened({ panel: 'research' }),
    )
    const focused = route(
      opened.model,
      Message.ResearchChanged({ message: ResearchMessage.Focused({ id }) }),
    )
    return { ...focused, commands: [...(opened.commands ?? []), ...(focused.commands ?? [])] }
  },

  ChurnFixTaken: ({ fix, target }) => {
    const game = model.board.game
    const board = { ...model, panel: 'none' as const }
    if (fix === 'research') return route(model, Message.ResearchShown({ id: target as ResearchId }))
    if (fix === 'node') {
      const node = game.nodes.find((entry) => entry.id === target)
      if (!node) return { model: board }
      return route(board, Message.RevealNode({ nodeId: node.id }))
    }
    const region = target as Region
    const shown = route(
      board,
      openRegions(game).includes(region)
        ? Message.RegionPicked({ region })
        : Message.RegionOpened({ region }),
    )
    const empty = !game.nodes.some((node) => node.region === region && node.type !== 'users')
    return has(game, 'infra-as-code') && empty && shown.model.board.region === region
      ? { ...shown, model: { ...shown.model, panel: 'mirror' } }
      : shown
  },

  PanelClosed: () => {
    if (isExited(model.companyPhase)) return leaveExited(model, 'found')
    const next = closePanel(model)
    return { model: next }
  },

  PrefsLoaded: ({ json }) =>
    Option.match(json === null ? Option.none() : parsePrefs(json), {
      onNone: () => ({ model }),
      onSome: (prefs) => ({
        model: {
          ...model,
          prefs,
        },
        commands: [
          ApplySettings({
            muted: prefs.muted,
            volume: prefs.volume,
            motion: prefs.motion,
            locale: prefs.locale,
            agentAccess: prefs.agentAccess,
            analytics: prefs.analytics,
            text: prefs.text,
            theme: prefs.theme,
          }),
        ],
      }),
    }),

  PrefsChanged: ({ message }) => foldPrefs(model, message),

  SurveyChanged: ({ message }) => foldSurvey(model, message),

  WindowBlurred: () => {
    const unsaved =
      model.board.game.time !== model.board.clock.savedAt &&
      onBoard(model.route) &&
      !offCompany(model)
    const saved: Model = unsaved
      ? {
          ...model,
          board: {
            ...model.board,
            clock: { ...model.board.clock, savedAt: model.board.game.time, unsavedMs: 0 },
          },
        }
      : model
    const commands = unsaved ? saveCommands(saved, true) : []
    if (!model.prefs.blurPause || halted(model) || roomLive(model) || !onBoard(model.route))
      return { model: saved, commands }
    const next: Model = {
      ...saved,
      board: {
        ...saved.board,
        clock: {
          ...saved.board.clock,
          mode: clockStep(saved.board.clock.mode, { _tag: 'Blurred' }),
        },
      },
    }
    return { model: next, commands }
  },

  WindowFocused: () => {
    if (!clockAway(model)) return { model }
    const next: Model = {
      ...model,
      board: {
        ...model.board,
        clock: {
          ...model.board.clock,
          mode: clockStep(model.board.clock.mode, { _tag: 'Focused' }),
        },
      },
    }
    return { model: next }
  },

  InsightHelpToggled: () => ({
    model: { ...model, board: { ...model.board, insightHelp: !model.board.insightHelp } },
  }),

  InboxChanged: ({ message }) => foldInbox(model, message, route),

  DashboardChanged: ({ message }) => foldDashboard(model, message),

  LanguagePickerChanged: ({ message }) => foldLanguagePicker(route)(model, message),

  VolumeSliderChanged: ({ message }) => foldVolumeSlider(route)(model, message),

  RuntimePickerChanged: ({ message }) => ({
    model: { ...model, runtimePicker: updateStackPicker(model.runtimePicker, message) },
  }),

  FrameworkPickerChanged: ({ message }) => ({
    model: { ...model, frameworkPicker: updateStackPicker(model.frameworkPicker, message) },
  }),

  MoreMenuChanged: ({ message }) => foldMoreMenu(route)(model, message),

  ToastRaised: ({ message: text, tone }) => withToast(model, text, tone),

  ToastCleared: ({ id }) => ({
    model: model.toast?.id === id ? { ...model, toast: null } : model,
  }),

  Synced: () => ({ model }),
})
