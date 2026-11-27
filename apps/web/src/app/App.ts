import { Command, Head, Router, UiSchema } from '@effect/ui'
import { Html } from '@effect/ui/html'
import { Effect, Schema } from 'effect'
import { Locale } from '../i18n/index.ts'
import { AppRoute } from './routes.ts'
import { Boot } from './boot.ts'
import { splash } from './title/Splash.ts'
import { TitlePage } from './title/TitlePage.ts'
import { CompanyPage } from './game/CompanyPage.ts'

export const AppMessage = UiSchema.TaggedEnum({
  ChangedRoute: { route: AppRoute },
  ClockedIn: {},
  TitleRevealed: {},
})
export type AppMessage = typeof AppMessage.Type

/* The splash holds the menu back for one beat after the badge goes in. */
export const RevealTitle = Command.make('RevealTitle', {}, () =>
  Effect.sleep('900 millis').pipe(Effect.as(AppMessage.TitleRevealed())),
)

const AppModel = Schema.Struct({
  route: AppRoute,
  boot: Boot,
  locale: Locale,
})
type AppModel = typeof AppModel.Type

const App = Html.component({
  name: 'App',
  props: Schema.Struct({ route: AppRoute }),
  model: AppModel,
  message: AppMessage,
}).make({
  init: ($) => ({
    route: $.props.route,
    boot: { _tag: 'Shut' },
    locale: 'en',
  }),

  update: {
    ChangedRoute: ($, { route }) => $.evolve({ route }),

    ClockedIn: ($) => {
      if ($.model.boot._tag !== 'Shut') return $.model
      return $.set({ ...$.model, boot: { _tag: 'Clocking' } }).run(RevealTitle.make())
    },

    TitleRevealed: ($) => $.evolve({ boot: { _tag: 'Ready' } }),
  },

  subscriptions: ({ model }) => [
    Router.subscription(AppRoute, model.route, (route) => AppMessage.ChangedRoute({ route })),
  ],

  head: () => [Head.title('Quorum')],

  view: (h, model) => {
    if (model.boot._tag !== 'Ready')
      return splash(h, {
        clocking: model.boot._tag === 'Clocking',
        locale: model.locale,
        onClockIn: AppMessage.ClockedIn,
      })
    if (
      model.route._tag === 'Company' ||
      model.route._tag === 'Sandbox' ||
      model.route._tag === 'Challenge' ||
      model.route._tag === 'Room'
    )
      return CompanyPage(h, {
        key:
          model.route._tag === 'Sandbox'
            ? `sandbox-${model.route.params.sandbox}`
            : model.route._tag === 'Challenge'
              ? `challenge-${model.route.params.challenge}`
              : model.route._tag === 'Room'
                ? `room-${model.route.params.room}`
                : 'company',
        props: { route: model.route },
      })
    const menu = model.route._tag === 'Menu' ? model.route.params.menu : 'main'
    return TitlePage(h, { key: 'title', props: { menu } })
  },
})

export { App }
