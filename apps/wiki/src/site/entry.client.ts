import { Router, type Renderer } from '@effect/ui'
import { HtmlHydrate } from '@effect/ui/html'
import { Effect } from 'effect'
import { BrowserRouter } from '@effect/ui/html'
import { localeOfPath, stripLocale } from '../i18n/locale.ts'
import { startAnalytics } from '../platform/analytics.ts'
import { startTheme } from '../theme.ts'
import 'katex/dist/katex.min.css'
import '../styles.css'
import '../locales/es.ts'
import '../locales/ja.ts'
import { SiteApp } from './App.ts'
import { loadProse } from './content.ts'
import { SiteRoute } from './routes.ts'
import { installSolver, solverReadyForBoard } from '../solver.ts'

startTheme()
startAnalytics()

installSolver(async () => {
  const { solverReady } = await import('@quorum/simulation/host/browser')
  await solverReady
})

if (document.querySelector('[data-lazy-island]') !== null) await solverReadyForBoard()
await loadProse(localeOfPath(location.pathname), stripLocale(location.pathname))

const state = JSON.parse(document.getElementById('state')?.textContent ?? '{}') as Renderer.State

const hydrate = Effect.gen(function* () {
  const root = yield* HtmlHydrate.hydrateEffect(
    SiteApp,
    Router.props(SiteRoute),
    document.getElementById('app')!,
    state,
  )
  yield* root.adopted
  return yield* Effect.never
}).pipe(Effect.scoped, Effect.provide(BrowserRouter.layer({ routes: SiteRoute })))

Effect.runFork(hydrate)
