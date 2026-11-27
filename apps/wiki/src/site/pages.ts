import { isLoaded, langOf } from '../i18n/lang.ts'
import { DEFAULT_LOCALE, localeOfPath, stripLocale, type Locale } from '../i18n/locale.ts'
import type { Section } from '../frontmatter.ts'
import { authoredPages, contentVersion } from './content.ts'
import type { Page } from './page.ts'
import { measurementsPage } from './measurements.ts'
import { referencePages } from './reference/index.ts'

type Built<Msg> = Readonly<{
  pages: ReadonlyArray<Page<Msg>>
  byPath: ReadonlyMap<string, Page<Msg>>
}>

const cache = new Map<string, Built<never>>()

const build = <Msg>(locale: Locale): Built<Msg> => {
  const key = `${locale}:${contentVersion()}`
  const known = cache.get(key)
  if (known !== undefined) return known as unknown as Built<Msg>
  const resolved = locale !== DEFAULT_LOCALE && !isLoaded(locale) ? DEFAULT_LOCALE : locale
  const l = langOf(resolved)
  const measurements: Page<Msg> = measurementsPage<Msg>(resolved)
  const pages: ReadonlyArray<Page<Msg>> = [
    ...authoredPages<Msg>(resolved),
    measurements,
    ...referencePages<Msg>(l),
  ]
  const made = { pages, byPath: new Map(pages.map((page) => [page.path, page])) }
  cache.set(key, made as unknown as Built<never>)
  return made
}

export const pagesFor = <Msg>(locale: Locale): ReadonlyArray<Page<Msg>> => build<Msg>(locale).pages

export const pageIn = <Msg>(locale: Locale, path: string): Page<Msg> | null =>
  build<Msg>(locale).byPath.get(path) ?? null

export const pageAt = <Msg>(pathname: string): Page<Msg> | null =>
  pageIn<Msg>(localeOfPath(pathname), stripLocale(pathname))

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
  <Msg>(a: Page<Msg>, b: Page<Msg>): number =>
    a.order - b.order || a.title.localeCompare(b.title, locale)

export const navOf = <Msg>(locale: Locale, section: Section): ReadonlyArray<Page<Msg>> =>
  pagesFor<Msg>(locale)
    .filter((page) => page.section === section && page.parent === null && page.path !== '/')
    .sort(inOrder(locale))

export const childrenOf = <Msg>(locale: Locale, path: string): ReadonlyArray<Page<Msg>> =>
  pagesFor<Msg>(locale)
    .filter((page) => page.parent === path)
    .sort(inOrder(locale))
