import { LoadUrl, PlaySound, PushUrl, RevealTitle } from '../commands.ts'
import { Model } from '../model.ts'
import { bootStep } from '../boot-machine.ts'
import { isExited } from '../company-machine.ts'
import { leaveExited } from './companies.ts'
import { routeOfMenu } from '../route.ts'
import { withOverlay, type MessageCases, type UpdateResult } from './shared.ts'
import { visit, continued, leaveBoard } from './session.ts'

export const clockIn = (model: Model): UpdateResult =>
  model.boot._tag !== 'Shut'
    ? { model }
    : {
        model: { ...model, boot: bootStep(model.boot, { _tag: 'ClockedIn' }) },
        commands: [
          ...(model.prefs.muted
            ? []
            : [PlaySound.make({ sound: 'clockin', pitch: 1, spatial: false })]),
          RevealTitle.make(),
        ],
      }

type ShellTag =
  | 'Continued'
  | 'Connected'
  | 'TitleOpened'
  | 'ClockedIn'
  | 'TitleRevealed'
  | 'MenuChosen'
  | 'SettingsSectionChosen'
  | 'SettingsSectionOpened'
  | 'SettingsSectionClosed'
  | 'FoundStepChosen'
  | 'ClickedLink'
  | 'ChangedUrl'
  | 'Navigated'

export const shellHandlers = (model: Model): MessageCases<UpdateResult, ShellTag> => ({
  Continued: () => continued(model),

  Connected: () => ({
    model: withOverlay(
      { ...model, boot: bootStep(model.boot, { _tag: 'Connected' }) },
      'boot',
      false,
    ),
  }),

  TitleOpened: () => leaveBoard(model),

  ClockedIn: () => clockIn(model),

  TitleRevealed: () => ({
    model: { ...model, boot: bootStep(model.boot, { _tag: 'TitleRevealed' }) },
  }),

  MenuChosen: ({ menu }) =>
    isExited(model.companyPhase)
      ? leaveExited(model, menu)
      : {
          model: withOverlay(
            {
              ...model,
              route: routeOfMenu(menu),
              settingsOpen: false,
              ...(menu === 'found' ? { foundStep: 'company' as const } : {}),
              ...(menu === 'companies' ? {} : { saveFocus: null, saveConfirm: { _tag: 'List' } }),
            },
            'menu',
            false,
          ),
        },

  SettingsSectionChosen: ({ section }) => ({ model: { ...model, settingsSection: section } }),

  SettingsSectionOpened: ({ section }) => ({
    model: { ...model, settingsSection: section, settingsOpen: true },
  }),

  SettingsSectionClosed: () => ({ model: { ...model, settingsOpen: false } }),

  FoundStepChosen: ({ step }) => ({ model: { ...model, foundStep: step } }),

  ClickedLink: ({ url, external }) => ({
    model,
    commands: [external ? LoadUrl.make({ href: url }) : PushUrl.make({ url })],
  }),

  ChangedUrl: ({ url }) => visit(model, url),

  Navigated: () => ({ model }),
})
