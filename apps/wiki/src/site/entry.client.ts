import { Router, type Renderer } from '@effect/ui'
import { HtmlHydrate } from '@effect/ui/html'
import { Effect } from 'effect'
import { BrowserRouter } from '@effect/ui/html'
import { startAnalytics } from '../platform/analytics.ts'
import { startTheme } from '../theme.ts'
import 'katex/dist/katex.min.css'
import '../styles.css'
import { SiteApp } from './App.ts'
import { SiteRoute } from './routes.ts'

startTheme()
startAnalytics()

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
