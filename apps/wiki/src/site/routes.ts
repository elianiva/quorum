import { Route } from '@effect/ui'

export const SiteRoute = Route.union({
  Home: Route.make('/'),
  Page: Route.make('/*'),
})
export type SiteRoute = typeof SiteRoute.Type

export const pathOf = (route: SiteRoute): string => {
  if (route._tag === 'Home') return '/'
  const path = route.params['*']
  return path === '' ? '/' : `/${path.replace(/^\/+/, '')}`
}

export const pageRoute = (path: string): SiteRoute =>
  path === '/' ? SiteRoute.Home() : SiteRoute.Page({ params: { '*': path.replace(/^\/+/, '') } })
