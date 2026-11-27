import { Route } from '@effect/ui'
import { Schema } from 'effect'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox'
import { MENU_PAGES } from '../game/menu-pages.ts'

const MenuPage = Schema.Literals([...MENU_PAGES])
const SandboxPath = Schema.Literals([...SANDBOX_IDS, 'free'])

export const AppRoute = Route.union({
  Title: Route.make('/'),
  Menu: Route.make('/menu/:menu', { params: { menu: MenuPage } }),
  Company: Route.make('/company'),
  Sandbox: Route.make('/sandbox/:sandbox', { params: { sandbox: SandboxPath } }),
  Challenge: Route.make('/challenges/:challenge', { params: { challenge: Schema.String } }),
  Room: Route.make('/room/:room', { params: { room: Schema.String } }),
  NotFound: Route.make('/*'),
})
export type AppRoute = typeof AppRoute.Type
