import { Runtime } from 'foldkit'
import { loadProse } from './content.ts'
import { loadLocale } from './i18n/load.ts'
import { Message, Model, init, routeOf, update } from './main.ts'
import { startPrefetch } from './prefetch.ts'
import { installSolver } from './solver.ts'
import { subscriptions } from './subscriptions.ts'
import { view } from './view.ts'

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

  installSolver(async () => {
    const { solverReady } = await import('@quorum/simulation/host/browser')
    await solverReady
  })

  const { locale, path } = routeOf(window.location.pathname)
  await loadLocale(locale)
  await loadProse(locale, path)
  Runtime.hydrate(application)
  startPrefetch()
}
