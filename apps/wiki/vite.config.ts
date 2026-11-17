import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { markdown } from '@foldkit/markdown/vite'
import { foldkit } from '@foldkit/vite-plugin'
import pandacss from '@pandacss/vite'
import { defineConfig, type Plugin } from 'vite'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { contentIndex } from './src/content-index.ts'
import { Frontmatter } from './src/frontmatter.ts'
import { islandAttributes } from './src/islands.ts'
import type { Locale } from './src/i18n/locale.ts'
import type { OgCard } from './src/og-card.ts'
import type { Page } from './src/page.ts'
import { WIKI_ORIGIN } from './src/site.ts'

const lastChanged = (): Map<string, string> => {
  const dates = new Map<string, string>()
  let day = ''
  const log = execFileSync('git', ['log', '--format=%x00%cs', '--name-only'], {
    cwd: resolve(import.meta.dirname, '../..'),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  for (const line of log.split('\n')) {
    if (line.startsWith('\0')) day = line.slice(1)
    else if (line !== '' && !dates.has(line)) dates.set(line, day)
  }
  return dates
}

const staticFiles = (): Plugin => ({
  name: 'wiki:static-files',
  apply: 'build',
  buildApp: {
    order: 'post',
    async handler(builder) {
      const output = (name: string) => {
        const config = builder.environments[name]?.config
        if (!config) throw new Error(`the build has no "${name}" environment`)
        return resolve(config.root, config.build.outDir)
      }
      const client = output('client')
      const server = output('ssr')
      const manifest = JSON.parse(await readFile(resolve(server, 'foldkit.build.json'), 'utf8'))
      const entry = await import(pathToFileURL(resolve(server, manifest.serverEntry)).href)
      const files: Record<string, string> = await entry.markdownFiles()
      for (const [name, text] of Object.entries(files)) {
        await mkdir(dirname(resolve(client, name)), { recursive: true })
        await writeFile(resolve(client, name), text)
      }
      const indexes: Record<string, string> = await entry.searchIndexes()
      for (const [name, json] of Object.entries(indexes)) {
        await mkdir(dirname(resolve(client, name)), { recursive: true })
        await writeFile(resolve(client, name), json)
      }
      const { Renderer } = await import('takumi-js/node')
      const { ogNode, OG_WIDTH, OG_HEIGHT } = await import('./src/og-card.ts')
      const renderer = new Renderer()
      const font = (name: string, file: string) => ({
        name,
        data: readFileSync(resolve(import.meta.dirname, 'public/fonts', file)),
      })
      const fonts = [
        font('Geist', 'geist-latin-v5.woff2'),
        font('Geist Mono', 'geist-mono-latin-v6.woff2'),
      ]
      const cards: ReadonlyArray<OgCard> = entry.ogCards()
      for (const card of cards) {
        const png = await renderer.render(ogNode(card), {
          width: OG_WIDTH,
          height: OG_HEIGHT,
          format: 'png',
          fonts,
        })
        await mkdir(dirname(resolve(client, card.file)), { recursive: true })
        await writeFile(resolve(client, card.file), png)
      }
      const dates = lastChanged()
      await writeFile(
        resolve(client, 'sitemap.xml'),
        entry.sitemap((source: string) => dates.get(source) ?? null),
      )
      builder.config.logger.info(
        `  wrote llms.txt, sitemap.xml, ${cards.length} social cards, ${Object.keys(indexes).length} search indexes, and ${Object.keys(files).length - 2} .md pages`,
      )
    },
  },
})

const INDEX_LOCALES: Readonly<Record<string, Locale>> = {
  '/search-index.json': 'en',
  '/es/search-index.json': 'es',
  '/ja/search-index.json': 'ja',
}

const searchIndexDev = (): Plugin => ({
  name: 'wiki:search-index-dev',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const locale = INDEX_LOCALES[(request.url ?? '').split('?')[0] ?? '']
      if (locale === undefined) return next()
      void (async () => {
        if (locale !== 'en') await server.ssrLoadModule(`/src/locales/${locale}.ts`)
        const { pagesFor } = (await server.ssrLoadModule('/src/pages.ts')) as {
          pagesFor: (locale: Locale) => ReadonlyArray<Page>
        }
        const { indexJson } = (await server.ssrLoadModule('/src/search.ts')) as {
          indexJson: (pages: ReadonlyArray<Page>, locale: Locale) => string
        }
        response.setHeader('content-type', 'application/json')
        response.setHeader('cache-control', 'no-store')
        response.end(indexJson(pagesFor(locale), locale))
      })().catch(next)
    })
  },
})

export default defineConfig(({ command }) => ({
  plugins: [
    pandacss({ codegen: false }),
    simVersion(),
    contentIndex(),
    foldkit({
      ...(command === 'serve' ? { buildId: 'development' } : {}),
      ssr: {
        serverEntry: '/src/entry.server.ts',
        clientEntry: '/src/entry.ts',
        build: { prerender: { origin: WIKI_ORIGIN } },
      },
    }),
    markdown({ frontmatter: Frontmatter, islands: islandAttributes }),
    staticFiles(),
    searchIndexDev(),
  ],
  resolve: { dedupe: ['effect', 'foldkit'] },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/foldkit/dist/brand/')) return 'brand'
          if (id.includes('/node_modules/.pnpm/effect@')) return 'framework'
          if (id.includes('/node_modules/.pnpm/@effect+')) return 'framework'
          if (id.includes('/node_modules/.pnpm/foldkit@')) return 'framework'
          if (id.includes('/node_modules/.pnpm/@foldkit+')) return 'framework'
          if (!id.includes('/packages/simulation/src/')) return
          if (id.includes('/packages/simulation/src/catalog/') || id.endsWith('/catalog.ts'))
            return 'catalog'
          if (id.endsWith('/sandbox-summary.ts')) return 'catalog'
          if (id.endsWith('/term-links.ts')) return 'catalog'
          if (id.endsWith('/glossary-links.ts')) return 'catalog'
          return 'simulation'
        },
      },
    },
  },
}))
