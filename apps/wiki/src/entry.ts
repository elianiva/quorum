import { Runtime } from 'foldkit'
import { kernelReady } from '@quorum/simulation/host/browser'
import { localeOfPath } from './i18n/locale.ts'
import { loadLocale } from './i18n/load.ts'
import { Message, Model, init, update } from './main.ts'
import { subscriptions } from './subscriptions.ts'
import { view } from './view.ts'
import { startAnalytics } from './platform/analytics.ts'
import { startTheme } from './theme.ts'
import './styles.css'

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
// The interactive boards solve while they hydrate, so the solve kernel is installed first too.
void Promise.all([loadLocale(localeOfPath(window.location.pathname)), kernelReady]).then(() => {
  Runtime.hydrate(application)
  startTheme()
  startAnalytics()
})
