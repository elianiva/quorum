import { langOf } from '../i18n/lang.ts'
import { LOCALES, LOCALE_TAGS, withLocale, type Locale } from '../i18n/locale.ts'
import { WIKI_ORIGIN } from '../site.ts'
import type { OgCard } from '../og-card.ts'
import { isFallback, loadAllProse } from './content.ts'
import { pagesFor } from './pages.ts'

export const ogFile = (path: string): string => `og${path === '/' ? '/index' : path}.png`

export const ogCards = (): ReadonlyArray<OgCard> => {
  const sections = langOf('en').t.quadrants
  return pagesFor('en').map((page) => ({
    file: ogFile(page.path),
    title: page.path === '/' ? 'Learn system design by playing' : page.title,
    summary: page.summary,
    label: page.path === '/' ? 'Quorum Wiki' : sections[page.section].label,
  }))
}

const urlOf = (locale: Locale, path: string): string => `${WIKI_ORIGIN}${withLocale(locale, path)}`

export const sitemap = (lastmod: (source: string) => string | null): string => {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...LOCALES.flatMap((locale) =>
      pagesFor(locale)
        .filter((page) => !isFallback(locale, page.path))
        .map((page) => {
          const date = page.source ? lastmod(page.source) : null
          const alternates = LOCALES.filter((other) => !isFallback(other, page.path))
            .map(
              (other) =>
                `<xhtml:link rel="alternate" hreflang="${LOCALE_TAGS[other].lang}" href="${urlOf(other, page.path)}"/>`,
            )
            .join('')
          return `<url><loc>${urlOf(locale, page.path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}${alternates}</url>`
        }),
    ),
    '</urlset>',
    '',
  ].join('\n')
}

export const prepareStatic = async (): Promise<void> => {
  await loadAllProse()
}
