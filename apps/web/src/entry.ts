import { Layer } from 'effect'
import { Runtime } from 'foldkit'
import { solverReady } from '@quorum/simulation/host/browser'
import { setSeatActivity } from '@quorum/ui/board/board'
import {
  init,
  Message,
  Model,
  subscriptions as appSubscriptions,
  update,
  view,
} from './app/main.ts'
import { startMotion } from './game/motion.ts'
import { pwaSubscriptions } from './game/update/pwa.ts'
import { unreadCount } from './components/lab/inbox.ts'
import { syncAppBadge } from './platform/pwa.ts'
import { loadLocale, preloadLocales } from './i18n/messages.ts'
import { supportedLocales, type Locale } from './i18n/index.ts'
import { PREFS_KEY, readStored, sweepLegacyStorage } from './game/storage.ts'
import { activityChange } from './game/presence.ts'
import { syncAgent } from './game/agent-room.ts'
import { observe } from './platform/analytics.ts'
import { ApiRpc } from './platform/rpc.ts'
import {
  reportCrash,
  reportSlow,
  startSentry,
  timedUpdate,
  tracerLayer,
} from './platform/sentry.ts'
import './styles.css'

startSentry()

const application = Runtime.makeApplication({
  Model,
  init,
  update: (model, message) => {
    const result = timedUpdate(message, () => update(model, message))
    const activity = activityChange(model, result.model)
    if (activity !== undefined) setSeatActivity('board', activity)
    syncAgent(result.model)
    observe(result.model)
    syncAppBadge(unreadCount(result.model))
    return result
  },
  view,
  subscriptions: { ...appSubscriptions, ...pwaSubscriptions },
  routing: {
    onUrlRequest: (request) => Message.ClickedLink({ request }),
    onUrlChange: (url) => Message.ChangedUrl({ url }),
  },
  resources: Layer.mergeAll(ApiRpc.layer, tracerLayer),
  container: document.getElementById('root'),
  crash: { report: reportCrash },
  slow: { show: 'Always', onSlow: reportSlow },
  devTools: {
    Message,
    excludeFromHistory: [
      'Ticked',
      'Synced',
      'DashboardChanged',
      'PaletteQueryChanged',
      'PaletteMoved',
    ],
  },
})

const root = document.documentElement
addEventListener('keydown', () => (root.dataset['input'] = 'keyboard'), true)
addEventListener('pointerdown', () => (root.dataset['input'] = 'pointer'), true)

startMotion(document.body)

if (navigator.storage?.persist) void navigator.storage.persist().catch(() => undefined)

const savedLocale = (): Locale => {
  const raw = readStored(PREFS_KEY)
  if (raw === null) return 'en'
  try {
    const value = (JSON.parse(raw) as { locale?: unknown }).locale
    return supportedLocales.some((entry) => entry.value === value) ? (value as Locale) : 'en'
  } catch {
    return 'en'
  }
}

const locale = savedLocale()
if (locale !== 'en') await loadLocale(locale).catch(() => undefined)

sweepLegacyStorage()

await solverReady
Runtime.run(application)

if (typeof window.requestIdleCallback === 'function')
  window.requestIdleCallback(() => preloadLocales(), { timeout: 3000 })
else window.setTimeout(() => preloadLocales(), 2000)
