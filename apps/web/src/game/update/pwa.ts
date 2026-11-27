import * as Effect from 'effect/Effect'
import { Command } from '@effect/ui'
import { WritePrefs } from '../commands.ts'
import { Message } from '../message.ts'
import type { Model } from '../model.ts'
import { trackInstallPrompt } from '../../platform/analytics.ts'
import { promptInstall } from '../../platform/pwa.ts'
import { say, withToast, type MessageCases, type UpdateResult } from './shared.ts'
import { pwaStep } from '../pwa-machine.ts'

const AskInstall = Command.make('AskPwaInstall', { args: {} }, () =>
  Effect.promise(async () => {
    const outcome = await promptInstall()
    trackInstallPrompt(outcome)
    return Message.PwaInstallOutcome({ outcome })
  }),
)

const seen = (model: Model): UpdateResult => {
  if (model.prefs.pwaPromptSeen) return { model }
  const prefs = { ...model.prefs, pwaPromptSeen: true }
  return { model: { ...model, prefs }, commands: [WritePrefs.make({ prefs })] }
}

type PwaTag = 'PwaChanged' | 'PwaInstallChosen' | 'PwaInstallOutcome' | 'PwaPromptDismissed'

export const pwaHandlers = (model: Model): MessageCases<UpdateResult, PwaTag> => ({
  PwaChanged: ({ installable, installed, online, updated }) => {
    const next = {
      ...model,
      pwa: {
        install: pwaStep(model.pwa.install, { _tag: 'Snapshot', installable, installed }),
        online,
        updated,
      },
    }
    return updated && !model.pwa.updated
      ? withToast(next, say(model).pwa.updated, 'plain')
      : { model: next }
  },

  PwaInstallChosen: () => ({
    model: {
      ...model,
      pwa: { ...model.pwa, install: pwaStep(model.pwa.install, { _tag: 'Prompted' }) },
    },
    commands: [AskInstall.make()],
  }),

  PwaInstallOutcome: ({ outcome }) =>
    seen({
      ...model,
      pwa: {
        ...model.pwa,
        install: pwaStep(model.pwa.install, {
          _tag:
            outcome === 'accepted'
              ? 'Accepted'
              : outcome === 'dismissed'
                ? 'Dismissed'
                : 'Unavailable',
        }),
      },
    }),

  PwaPromptDismissed: () => seen(model),
})
