import * as Effect from 'effect/Effect'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { Schema } from 'effect'
import { Command, Subscription } from 'foldkit'
import { WritePrefs } from '../commands.ts'
import { Message } from '../message.ts'
import type { Model } from '../model.ts'
import { trackInstallPrompt } from '../../platform/analytics.ts'
import { promptInstall, requestPwaUpdate, watchPwa } from '../../platform/pwa.ts'
import type { MessageCases, UpdateResult } from './shared.ts'

/* ==========================================================================
   The PWA: the browser's install dialog, a waiting worker, and the network.
   Rooms and feature keys need the network; the Company never does.
   ========================================================================== */

/** Opens the browser's install dialog and reports what the player chose. */
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

/** Asks the waiting worker to activate. Its `controllerchange` reloads the page once. */
const TakeUpdate = Command.define('TakePwaUpdate', {
  args: {},
  messages: [Message.Synced],
  execute: () =>
    Effect.promise(async () => {
      await requestPwaUpdate()
      return Message.Synced()
    }),
})

/** The title's prompt is one time: after it, the Settings row is the way in. */
const seen = (model: Model): UpdateResult => {
  if (model.prefs.pwaPromptSeen) return { model }
  const prefs = { ...model.prefs, pwaPromptSeen: true }
  return { model: { ...model, prefs }, commands: [WritePrefs({ prefs })] }
}

type PwaTag =
  | 'PwaChanged'
  | 'PwaInstallChosen'
  | 'PwaInstallOutcome'
  | 'PwaUpdateChosen'
  | 'PwaPromptDismissed'

export const pwaHandlers = (model: Model): MessageCases<UpdateResult, PwaTag> => ({
  PwaChanged: ({ installable, installed, updateReady, online }) => ({
    model: { ...model, pwa: { installable, installed, updateReady, online } },
  }),

  PwaInstallChosen: () => ({ model, commands: [AskInstall({})] }),

  PwaInstallOutcome: ({ outcome }) =>
    seen({
      ...model,
      pwa:
        outcome === 'accepted' ? { ...model.pwa, installed: true, installable: false } : model.pwa,
    }),

  PwaUpdateChosen: () => ({ model, commands: [TakeUpdate({})] }),

  PwaPromptDismissed: () => seen(model),
})

/** The browser's PWA state while the page is open: install offer, update, and network. */
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
