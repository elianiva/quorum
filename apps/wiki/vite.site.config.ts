import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { markdown } from '@foldkit/markdown/vite'
import { plugin as effectUi } from '@effect/ui/html/HtmlServerVite'
import pandacss from '@pandacss/vite'
import { defineConfig, type Plugin } from 'vite'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { contentIndex } from './src/content-index.ts'
import { Frontmatter } from './src/frontmatter.ts'
import { islandAttributes } from './src/islands.ts'
import { WIKI_ORIGIN } from './src/site.ts'
import { clearSearchIndexes, searchIndexes } from './src/site/search-index.ts'
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
      if (file.endsWith('.md')) clearSearchIndexes()
    })
    server.middlewares.use((request, response, next) => {
      const locale = SEARCH_LOCALES[(request.url ?? '').split('?')[0] ?? '']
      if (locale === undefined) return next()
      void searchIndexes()
        .then((indexes) => {
          const name = locale === 'en' ? 'search-index.json' : `${locale}/search-index.json`
          response.setHeader('content-type', 'application/json')
          response.setHeader('cache-control', 'no-store')
          response.end(indexes[name] ?? '{}')
        })
        .catch(next)
    })
  },
  buildApp: {
    order: 'post',
    async handler(builder) {
      const config = builder.environments.client?.config
      if (config === undefined) throw new Error('the build has no client environment')
      const outDir = resolve(config.root, config.build.outDir)
      for (const [name, json] of Object.entries(await searchIndexes())) {
        const file = resolve(outDir, name)
        await mkdir(dirname(file), { recursive: true })
        await writeFile(file, json)
      }
    },
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
