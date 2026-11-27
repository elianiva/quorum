import { Router } from '@effect/ui'
import { BrowserHost, BrowserRouter } from '@effect/ui/html'
import { Effect, Layer } from 'effect'
import { App } from './app/App.ts'
import { AppRoute } from './app/routes.ts'
import { startMotion } from './game/motion.ts'
import './styles.css'

const root = document.documentElement
addEventListener('keydown', () => (root.dataset['input'] = 'keyboard'), true)
addEventListener('pointerdown', () => (root.dataset['input'] = 'pointer'), true)

const container = document.getElementById('root')!
container.replaceChildren()

const Main = BrowserHost.mount(App, Router.props(AppRoute), container).pipe(
  Layer.provide(BrowserRouter.layer({ routes: AppRoute })),
)

Layer.launch(Main).pipe(Effect.runFork)

startMotion(document.body)
