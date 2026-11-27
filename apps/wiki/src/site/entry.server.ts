import '@quorum/simulation/host/node'
import { layerHttp } from '@effect/ui/html/HtmlServerHttp'
import { document } from 'virtual:@effect/ui/document'
import { pageAt } from '../site/pages.ts'
import { loadAllProse } from '../site/content.ts'
import '../locales/es.ts'
import '../locales/ja.ts'
import { SiteApp } from './App.ts'
import { pathOf, SiteRoute } from './routes.ts'

await loadAllProse()

const prerender = ['/', '/404']

export default layerHttp(SiteApp, {
  routes: SiteRoute,
  document,
  static: import.meta.env.PROD,
  status: (route) => {
    const path = pathOf(route)
    if (route._tag === 'Home') return 200
    return pageAt(path) === null ? 404 : 200
  },
})

export { prerender }
