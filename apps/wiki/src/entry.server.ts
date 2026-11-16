import { Effect } from 'effect'
import { Server } from 'foldkit/experimental'
// The prerender solves every board it draws, so it installs the Solver before any page.
import '@quorum/simulation/host/node'
import { documentOf, isFallback, loadAllProse, loadProse } from './content.ts'
import { langOf } from './i18n/lang.ts'
import {
  LOCALES,
  LOCALE_TAGS,
  localeOfPath,
  stripLocale,
  withLocale,
  type Locale,
} from './i18n/locale.ts'
import { init, normalize } from './main.ts'
import { CATALOG_PATH } from './submodels/catalog.ts'
import { ogFile, type OgCard } from './og-card.ts'
import { markdownPath } from './markdown.ts'
import type { Page } from './page.ts'
import { PAGES, pageAt, pageIn, pagesFor } from './pages.ts'
import { plain } from './prose.ts'
import { indexJson } from './search.ts'
import { GAME_ORIGIN, WIKI_ORIGIN } from './site.ts'
import { THEME_COLORS, themeScript } from './theme.ts'
import { view } from './view.ts'
// The translated bundles register themselves here, since the server renders every language.
import './locales/es.ts'
import './locales/ja.ts'

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** The absolute URL of a page's logical path in a language. */
const urlOf = (locale: Locale, path: string): string => `${WIKI_ORIGIN}${withLocale(locale, path)}`

const AUTHOR = { '@type': 'Person', name: 'elianiva', url: 'https://elianiva.com' }

const website = (locale: Locale) => ({
  '@type': 'WebSite',
  '@id': `${WIKI_ORIGIN}${withLocale(locale, '/')}#website`,
  name: langOf(locale).t.site.name,
  url: `${urlOf(locale, '/')}`,
  inLanguage: LOCALE_TAGS[locale].lang,
  publisher: AUTHOR,
  about: { '@type': 'VideoGame', name: 'Quorum', url: `${GAME_ORIGIN}/` },
})

/** The questions and answers of an English page's "Common questions" section: each third-level
    heading is a question, and the paragraphs under it are the answer. */
const questionsOf = (path: string): ReadonlyArray<{ question: string; answer: string }> => {
  const blocks = documentOf(path)?.blocks ?? []
  const found: Array<{ question: string; answer: Array<string> }> = []
  let inside = false
  for (const block of blocks) {
    if (block._tag === 'Heading' && block.level === 2)
      inside = plain(block.content) === 'Common questions'
    else if (inside && block._tag === 'Heading' && block.level === 3)
      found.push({ question: plain(block.content), answer: [] })
    else if (inside && block._tag === 'Paragraph') found.at(-1)?.answer.push(plain(block.content))
  }
  return found
    .filter((entry) => entry.answer.length > 0)
    .map((entry) => ({ question: entry.question, answer: entry.answer.join(' ') }))
}

/** The sections whose pages teach something, so search engines can call them learning resources. */
const TEACHING: ReadonlySet<string> = new Set(['tutorials', 'guides', 'explanation', 'patterns'])

/* Structured data (schema.org): the site on its home page, and on every other page the article
   and the trail the page shows above its title (src/components/article.ts). */
const structuredData = (page: Page): string => {
  const { locale } = page
  const site = website(locale)
  const parent = page.parent ? pageIn(locale, page.parent) : null
  const graph =
    page.path === '/'
      ? [site]
      : [
          {
            '@type': TEACHING.has(page.section)
              ? ['TechArticle', 'LearningResource']
              : 'TechArticle',
            ...(TEACHING.has(page.section)
              ? {
                  learningResourceType: page.section === 'tutorials' ? 'tutorial' : 'article',
                  teaches: page.title,
                }
              : {}),
            headline: page.title,
            description: page.summary,
            url: urlOf(locale, page.path),
            mainEntityOfPage: urlOf(locale, page.path),
            image: `${WIKI_ORIGIN}/${ogFile(page.path)}`,
            author: AUTHOR,
            publisher: AUTHOR,
            inLanguage: LOCALE_TAGS[locale].lang,
            isPartOf: { '@id': site['@id'] },
            about: site.about,
          },
          ...(locale === 'en' && questionsOf(page.path).length > 0
            ? [
                {
                  '@type': 'FAQPage',
                  mainEntity: questionsOf(page.path).map(({ question, answer }) => ({
                    '@type': 'Question',
                    name: question,
                    acceptedAnswer: { '@type': 'Answer', text: answer },
                  })),
                },
              ]
            : []),
          ...(parent
            ? [
                {
                  '@type': 'BreadcrumbList',
                  itemListElement: [parent, page].map((item, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    name: item.title,
                    item: urlOf(locale, item.path),
                  })),
                },
              ]
            : []),
        ]
  // `<` cannot end the script early.
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
  return `<script type="application/ld+json">${json.replace(/</g, '\\u003c')}</script>`
}

/** The languages a page is translated into, English included. A page that still shows English
    prose under another language's prefix is a duplicate of the English page, so search engines
    get neither its `hreflang` nor a sitemap entry, and the page itself is `noindex`. */
const translatedLocales = (path: string): ReadonlyArray<Locale> =>
  LOCALES.filter((locale) => !isFallback(locale, path))

/** Every language a page is translated into, for search engines: `hreflang` for each, and the
    English page as the default for a reader whose language the wiki does not have. */
const alternates = (path: string): ReadonlyArray<string> => [
  ...translatedLocales(path).map(
    (locale) =>
      `<link rel="alternate" hreflang="${LOCALE_TAGS[locale].lang}" href="${urlOf(locale, path)}">`,
  ),
  `<link rel="alternate" hreflang="x-default" href="${urlOf('en', path)}">`,
]

export const renderDocument: Server.DocumentRenderer = (application, assets) => {
  // A 404 has no canonical URL: it is no page, and its language is the one its view rendered.
  const pathname = application.canonical ? normalize(new URL(application.canonical).pathname) : null
  const page = pathname === null ? null : pageAt(pathname)
  const locale =
    pathname === null
      ? (LOCALES.find((candidate) => LOCALE_TAGS[candidate].lang === application.lang) ?? 'en')
      : localeOfPath(pathname)
  const t = langOf(locale).t.site
  const description = escape(page?.summary ?? t.description)
  const title = escape(application.title)
  // Each page has its own card, in English for every language. A 404 uses the site's card.
  const image = `${WIKI_ORIGIN}/${page ? ogFile(page.path) : 'og.png'}`
  const imageAlt = escape(page ? `${page.title} · ${t.name}` : t.ogImageAlt)
  return Server.renderDocument(application, assets, {
    lang: LOCALE_TAGS[locale].lang,
    head: [
      `<meta name="description" content="${description}">`,
      // A 404 and an untranslated page are not pages to index. Elsewhere, allow a large image
      // preview and unlimited snippets, which Search and Discover otherwise cap.
      page && !isFallback(locale, page.path)
        ? '<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">'
        : '<meta name="robots" content="noindex,follow">',
      `<meta name="theme-color" content="${THEME_COLORS.light}">`,
      `<script>${themeScript}</script>`,
      `<meta property="og:type" content="${page?.path === '/' ? 'website' : 'article'}">`,
      `<meta property="og:site_name" content="${escape(t.name)}">`,
      `<meta property="og:locale" content="${LOCALE_TAGS[locale].og}">`,
      ...LOCALES.filter((other) => other !== locale).map(
        (other) => `<meta property="og:locale:alternate" content="${LOCALE_TAGS[other].og}">`,
      ),
      ...(page ? [`<meta property="og:url" content="${urlOf(locale, page.path)}">`] : []),
      `<meta property="og:title" content="${title}">`,
      `<meta property="og:description" content="${description}">`,
      `<meta property="og:image" content="${image}">`,
      '<meta property="og:image:type" content="image/png">',
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta property="og:image:alt" content="${imageAlt}">`,
      '<meta name="twitter:card" content="summary_large_image">',
      `<meta name="twitter:title" content="${title}">`,
      `<meta name="twitter:description" content="${description}">`,
      `<meta name="twitter:image" content="${image}">`,
      `<meta name="twitter:image:alt" content="${imageAlt}">`,
      ...(page
        ? [
            ...alternates(page.path),
            // The Markdown twin of a page is English: llms.txt and the `.md` files are not translated.
            ...(locale === 'en'
              ? [
                  `<link rel="alternate" type="text/markdown" href="${WIKI_ORIGIN}${markdownPath(page.path)}">`,
                ]
              : []),
            structuredData(page),
          ]
        : []),
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
      `<link rel="apple-touch-icon" href="${GAME_ORIGIN}/apple-touch-icon.png">`,
      '<link rel="preload" href="/fonts/geist-latin-v5.woff2" as="font" type="font/woff2" crossorigin>',
      '<link rel="preload" href="/fonts/geist-mono-latin-v6.woff2" as="font" type="font/woff2" crossorigin>',
    ].join(''),
  })
}

/** The files the build adds beside the pages (vite.config.ts): llms.txt and every page's Markdown. */
export { markdownFiles } from './markdown.ts'

/** One social card for every English page, rendered by the build (vite.config.ts). */
export const ogCards = (): ReadonlyArray<OgCard> => {
  const sections = langOf('en').t.quadrants
  return PAGES.map((page) => ({
    file: ogFile(page.path),
    title: page.path === '/' ? 'Learn system design by playing' : page.title,
    summary: page.summary,
    label: page.path === '/' ? 'Quorum Wiki' : sections[page.section].label,
  }))
}

/** The search index of each language, by the file the build writes it to (vite.config.ts). */
export const searchIndexes = async (): Promise<Readonly<Record<string, string>>> => {
  await loadAllProse()
  return Object.fromEntries(
    LOCALES.map((locale) => [
      withLocale(locale, '/search-index.json').slice(1),
      indexJson(pagesFor(locale), locale),
    ]),
  )
}

/** Every page in every language: English at its path, each translation under its prefix. */
export const prerenderPaths: ReadonlyArray<string> = [
  ...LOCALES.flatMap((locale) => PAGES.map((page) => withLocale(locale, page.path))),
  // The component catalog: one English page, outside `PAGES` so search and the sitemap skip it.
  CATALOG_PATH,
]

/** The sitemap the build writes (vite.config.ts), each page in every language with its
    alternates. `lastmod` gives the date a source file last changed; a page without a source
    file, or a date, has no `<lastmod>`. */
export const sitemap = (lastmod: (source: string) => string | null): string =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...LOCALES.flatMap((locale) =>
      pagesFor(locale)
        .filter((page) => !isFallback(locale, page.path))
        .map((page) => {
          const date = page.source ? lastmod(page.source) : null
          return `<url><loc>${urlOf(locale, page.path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}${translatedLocales(
            page.path,
          )
            .map(
              (other) =>
                `<xhtml:link rel="alternate" hreflang="${LOCALE_TAGS[other].lang}" href="${urlOf(other, page.path)}"/>`,
            )
            .join('')}</url>`
        }),
    ),
    '</urlset>',
    '',
  ].join('\n')

export const renderPage = async (request: Request): Promise<Server.EntryResult> => {
  const path = normalize(new URL(request.url).pathname)
  await loadProse(localeOfPath(path), stripLocale(path))
  return Effect.runPromise(
    Server.renderToString({ routing: {}, init, view }, { url: request.url }).pipe(
      Effect.map((application) =>
        Server.Rendered(application, pageAt(path) || path === CATALOG_PATH ? {} : { status: 404 }),
      ),
    ),
  )
}
