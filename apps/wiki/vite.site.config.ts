import { plugin as effectUi } from '@effect/ui/html/HtmlServerVite'
import { markdown } from '@effect/ui/html/MarkdownVite'
import pandacss from '@pandacss/vite'
import { defineConfig, type Plugin } from 'vite'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { contentIndex } from './src/content-index.ts'
import { Frontmatter } from './src/frontmatter.ts'
import { islandAttributes } from './src/islands.ts'
import { WIKI_ORIGIN } from './src/site.ts'
import type { Locale } from './src/i18n/locale.ts'

const SEARCH_LOCALES: Readonly<Record<string, Locale>> = {
  '/search-index.json': 'en',
  '/es/search-index.json': 'es',
  '/ja/search-index.json': 'ja',
}

const searchIndex = (): Plugin => ({
  name: 'wiki:site-search-index',
  configureServer(server) {
    server.watcher.on('change', (file) => {
      if (file.endsWith('.md'))
        void server.ssrLoadModule('/src/site/search-index.ts').then((m) => m.clearSearchIndexes())
    })
    server.middlewares.use((request, response, next) => {
      const locale = SEARCH_LOCALES[(request.url ?? '').split('?')[0] ?? '']
      if (locale === undefined) return next()
      void server
        .ssrLoadModule('/src/site/search-index.ts')
        .then((m) => m.searchIndexes())
        .then((indexes) => {
          const name = locale === 'en' ? 'search-index.json' : `${locale}/search-index.json`
          response.setHeader('content-type', 'application/json')
          response.setHeader('cache-control', 'no-store')
          response.end(indexes[name] ?? '{}')
        })
        .catch(next)
    })
  },
})

export default defineConfig({
  plugins: [
    pandacss({ codegen: false }),
    simVersion(),
    contentIndex(),
    markdown({ frontmatter: Frontmatter, islands: islandAttributes }),
    effectUi({ entry: '/src/site/entry.server.ts', origin: WIKI_ORIGIN }),
    searchIndex(),
  ],
  resolve: { dedupe: ['effect'] },
  build: { outDir: 'dist/site' },
})
