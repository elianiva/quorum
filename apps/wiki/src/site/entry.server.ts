import { layerHttp } from '@effect/ui/html/HtmlServerHttp'
import { document } from 'virtual:@effect/ui/document'
import { pageAt } from '../pages.ts'
import { SiteApp } from './App.ts'
import { pathOf, SiteRoute } from './routes.ts'

export default layerHttp(SiteApp, {
  routes: SiteRoute,
  document,
  static: import.meta.env.PROD,
  status: (route) => {
    if (route._tag === 'Home') return 200
    return pageAt(pathOf(route)) === null ? 404 : 200
  },
})

export const prerender = ['/', '/404']
