import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import '@quorum/simulation/host/node'
import { Effect } from 'effect'
import { Router } from '@effect/ui'
import { HtmlServer } from '@effect/ui/html'
import { createServer } from 'vite'

const lastChanged = (root: string): Map<string, string> => {
  const dates = new Map<string, string>()
  let day = ''
  const log = execFileSync('git', ['log', '--format=%x00%cs', '--name-only'], {
    cwd: resolve(root, '../..'),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  for (const line of log.split('\n')) {
    if (line.startsWith('\0')) day = line.slice(1)
    else if (line !== '' && !dates.has(line)) dates.set(line, day)
  }
  return dates
}

const server = await createServer({
  configFile: 'vite.site.config.ts',
  server: { middlewareMode: true },
  appType: 'custom',
})

try {
  await server.ssrLoadModule('@quorum/simulation/host/node')
  const root = server.config.root
  const out = resolve(root, 'dist/site')

  const { loadAllProse } = (await server.ssrLoadModule('/src/site/content.ts')) as {
    loadAllProse: () => Promise<void>
  }
  await loadAllProse()
  const { pagesFor } = (await server.ssrLoadModule('/src/site/pages.ts')) as {
    pagesFor: (locale: 'en' | 'es' | 'ja') => ReadonlyArray<{ path: string }>
  }
  const { SiteApp } = (await server.ssrLoadModule('/src/site/App.ts')) as { SiteApp: unknown }
  const { SiteRoute } = (await server.ssrLoadModule('/src/site/routes.ts')) as {
    SiteRoute: unknown
  }
  const { withLocale, LOCALES } = (await server.ssrLoadModule('/src/i18n/locale.ts')) as {
    withLocale: (locale: 'en' | 'es' | 'ja', path: string) => string
    LOCALES: ReadonlyArray<'en' | 'es' | 'ja'>
  }
  const { document } = (await server.ssrLoadModule('virtual:@effect/ui/document')) as {
    document: (rendered: unknown) => string
  }
  const { searchIndexes } = (await server.ssrLoadModule('/src/site/search-index.ts')) as {
    searchIndexes: () => Promise<Readonly<Record<string, string>>>
  }
  const { markdownFiles } = (await server.ssrLoadModule('/src/site/markdown.ts')) as {
    markdownFiles: () => Promise<Readonly<Record<string, string>>>
  }
  const { ogCards, sitemap, prepareStatic } = (await server.ssrLoadModule(
    '/src/site/static.ts',
  )) as {
    ogCards: () => ReadonlyArray<{ file: string; title: string; summary: string; label: string }>
    sitemap: (lastmod: (source: string) => string | null) => string
    prepareStatic: () => Promise<void>
  }

  const write = async (name: string, content: string | Uint8Array): Promise<void> => {
    const file = resolve(out, name.replace(/^\/+/, ''))
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
  }

  const shell = await readFile(resolve(out, 'index.html'), 'utf8')
  const assets = [
    ...shell.matchAll(
      /<(?:link[^>]+rel="stylesheet"[^>]*>|script[^>]+src="\/assets\/[^"]+"[^>]*><\/script>)/g,
    ),
  ]
    .map((match) => match[0])
    .join('\n    ')
  const patch = (html: string): string =>
    html
      .replace(/<script type="module" src="\/@vite\/client"><\/script>/g, '')
      .replace(/<script type="module" src="\/src\/site\/entry\.client\.ts"><\/script>/g, '')
      .replace('</head>', `    ${assets}\n  </head>`)

  for (const locale of LOCALES) {
    if (locale !== 'en') await server.ssrLoadModule(`/src/locales/${locale}.ts`)
    for (const page of pagesFor(locale)) {
      const path = withLocale(locale, page.path)
      const rendered = await Effect.runPromise(
        HtmlServer.renderToHtml(SiteApp as never, Router.props(SiteRoute as never), {
          static: true,
        }).pipe(Effect.provide(Router.static({ routes: SiteRoute as never, url: path }))) as never,
      )
      const name =
        path === '/' ? 'index.html' : path.endsWith('/') ? `${path}index.html` : `${path}.html`
      await write(name, patch(document(rendered)))
    }
  }

  for (const [name, content] of Object.entries(await searchIndexes())) await write(name, content)
  for (const [name, content] of Object.entries(await markdownFiles())) await write(name, content)

  await prepareStatic()
  const dates = lastChanged(root)
  await write(
    'sitemap.xml',
    sitemap((source) => dates.get(source) ?? null),
  )

  const { Renderer } = await import('takumi-js/node')
  const { ogNode, OG_WIDTH, OG_HEIGHT } = await import('../src/og-card.ts')
  const renderer = new Renderer()
  const font = (name: string, file: string) => ({
    name,
    data: readFileSync(resolve(root, 'public/fonts', file)),
  })
  const fonts = [
    font('Geist', 'geist-latin-v5.woff2'),
    font('Geist Mono', 'geist-mono-latin-v6.woff2'),
  ]
  const cards = ogCards()
  for (const card of cards) {
    const png = await renderer.render(ogNode(card), {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      format: 'png',
      fonts,
    })
    await write(card.file, png)
  }
  console.log(
    `  wrote llms.txt, sitemap.xml, ${cards.length} social cards, search indexes, and ${Object.keys(await markdownFiles()).length - 2} .md pages`,
  )
} finally {
  await server.close()
}
