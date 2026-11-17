import { authoredPages, onProseLoaded } from './content.ts'
import type { Section } from './frontmatter.ts'
import { isLoaded, langOf } from './i18n/lang.ts'
import { DEFAULT_LOCALE, localeOfPath, stripLocale, type Locale } from './i18n/locale.ts'
import { measurementsPage } from './measurements/page.ts'
import type { Page } from './page.ts'
import { referencePages } from './reference/index.ts'

type Built = Readonly<{ pages: ReadonlyArray<Page>; byPath: ReadonlyMap<string, Page> }>

const built = new Map<Locale, Built>()

const buildFor = (locale: Locale): Built => {
  if (locale !== DEFAULT_LOCALE && !isLoaded(locale)) return buildFor(DEFAULT_LOCALE)
  const known = built.get(locale)
  if (known) return known
  const l = langOf(locale)
  const pages = [...authoredPages(locale), measurementsPage(l), ...referencePages(l)]
  const made = { pages, byPath: new Map(pages.map((page) => [page.path, page])) }
  built.set(locale, made)
  return made
}

export const pagesFor = (locale: Locale): ReadonlyArray<Page> => buildFor(locale).pages

export const PAGES: ReadonlyArray<Page> = pagesFor(DEFAULT_LOCALE)

onProseLoaded(() => built.clear())

export const pageIn = (locale: Locale, path: string): Page | null =>
  buildFor(locale).byPath.get(path) ?? null

export const pageAt = (pathname: string): Page | null =>
  pageIn(localeOfPath(pathname), stripLocale(pathname))

export const SECTION_ORDER: ReadonlyArray<Section> = [
  'play',
  'tutorials',
  'guides',
  'explanation',
  'patterns',
  'reference',
  'design',
  'about',
]

const inOrder =
  (locale: Locale) =>
  (a: Page, b: Page): number =>
    a.order - b.order || a.title.localeCompare(b.title, locale)

export const navOf = (locale: Locale, section: Section): ReadonlyArray<Page> =>
  pagesFor(locale)
    .filter((page) => page.section === section && page.parent === null && page.path !== '/')
    .sort(inOrder(locale))

export const childrenOf = (locale: Locale, path: string): ReadonlyArray<Page> =>
  pagesFor(locale)
    .filter((page) => page.parent === path)
    .sort(inOrder(locale))
