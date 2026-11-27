import { Option, Schema } from 'effect'
import { AppRoute } from '../app/routes.ts'
import { MENU_PAGES } from './menu-pages.ts'

export { AppRoute, MENU_PAGES }

export const GameUrl = Schema.Struct({ pathname: Schema.String, search: Schema.String })
export type GameUrl = typeof GameUrl.Type

export const urlToAppRoute = (url: Readonly<{ pathname: string; search?: string }>): AppRoute => {
  const parsed = AppRoute.parse(`${url.pathname}${url.search ?? ''}`)
  return Option.isSome(parsed) && parsed.value._tag !== 'NotFound' ? parsed.value : AppRoute.Title()
}

export const urlOf = (route: AppRoute): string => AppRoute.printPath(route)

export const onBoard = (route: AppRoute): boolean =>
  route._tag === 'Company' ||
  route._tag === 'Sandbox' ||
  route._tag === 'Challenge' ||
  route._tag === 'Room'

export const menuOf = (route: AppRoute): (typeof MENU_PAGES)[number] | 'main' =>
  route._tag === 'Menu' ? route.params.menu : 'main'

export const routeOfMenu = (menu: (typeof MENU_PAGES)[number] | 'main'): AppRoute =>
  menu === 'main' ? AppRoute.Title() : AppRoute.Menu({ params: { menu } })
