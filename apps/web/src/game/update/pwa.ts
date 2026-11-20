import * as Effect from 'effect/Effect'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { Schema } from 'effect'
import { Command, Subscription } from 'foldkit'
import { WritePrefs } from '../commands.ts'
import { Message } from '../message.ts'
import type { Model } from '../model.ts'
import { trackInstallPrompt } from '../../platform/analytics.ts'
import { promptInstall, watchPwa } from '../../platform/pwa.ts'
import { say, withToast, type MessageCases, type UpdateResult } from './shared.ts'
import { pwaStep } from '../pwa-machine.ts'

const AskInstall = Command.define('AskPwaInstall', {
  args: {},
  messages: [Message.PwaInstallOutcome],
  execute: () =>
    Effect.promise(async () => {
      const outcome = await promptInstall()
      trackInstallPrompt(outcome)
      return Message.PwaInstallOutcome({ outcome })
    }),
})

const seen = (model: Model): UpdateResult => {
  if (model.prefs.pwaPromptSeen) return { model }
  const prefs = { ...model.prefs, pwaPromptSeen: true }
  return { model: { ...model, prefs }, commands: [WritePrefs({ prefs })] }
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
    commands: [AskInstall({})],
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

export const pwaSubscriptions = Subscription.make<Model, Message>()((entry) => ({
  pwa: entry(
    { watching: Schema.Boolean },
    {
      modelToDependencies: () => ({ watching: true }),
      dependenciesToStream: ({ watching }: { watching: boolean }) =>
        watching
          ? Stream.callback<Message>((queue) =>
              Effect.gen(function* () {
                yield* Effect.acquireRelease(
                  Effect.sync(() =>
                    watchPwa((snapshot) => Queue.offerUnsafe(queue, Message.PwaChanged(snapshot))),
                  ),
                  (stop) => Effect.sync(stop),
                )
                return yield* Effect.never
              }),
            )
          : Stream.empty,
    },
  ),
}))
