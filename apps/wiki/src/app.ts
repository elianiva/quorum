import { Runtime } from 'foldkit'
import { loadProse } from './content.ts'
import { loadLocale } from './i18n/load.ts'
import { Message, Model, init, routeOf, update } from './main.ts'
import { installSolver } from './solver.ts'
import { subscriptions } from './subscriptions.ts'
import { view } from './view.ts'

/* The interactive wiki. The home page loads this on the reader's first interaction (src/entry.ts):
   the rest of the wiki loads it at once. Everything here is deferred with it, including the
   catalog, the page views, and the framework. */

export const start = async (): Promise<void> => {
  const application = Runtime.makeApplication({
    Model,
    init,
    update,
    view,
    subscriptions,
    container: document.getElementById('root'),
    routing: {
      onUrlRequest: (request) => Message.ClickedLink({ request }),
      onUrlChange: (url) => Message.ChangedUrl({ url }),
    },
    devTools: { Message },
  })

  // Every page was rendered at build time; the client adopts it (ADR 0009). A page in another
  // language needs that language's copy and prose first, or the client would draw it differently.
  // A live board installs the Solver when it mounts, so a reading page never waits for it.
  installSolver(async () => {
    const { solverReady } = await import('@quorum/simulation/host/browser')
    await solverReady
  })

  const { locale, path } = routeOf(window.location.pathname)
  await loadLocale(locale)
  await loadProse(locale, path)
  Runtime.hydrate(application)
}
