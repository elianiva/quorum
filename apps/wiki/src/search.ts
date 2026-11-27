import MiniSearch, { type Options } from 'minisearch'
import type { Section } from './frontmatter.ts'
import { langOf } from './i18n/lang.ts'
import { DEFAULT_LOCALE, withLocale, type Locale } from './i18n/locale.ts'

export const indexUrl = (locale: Locale): string => withLocale(locale, '/search-index.json')

export type Hit = Readonly<{
  path: string
  title: string
  summary: string
  section: Section
  heading: string | null
}>

type Anchor = Readonly<{ id: string; text: string }>

type Document = Readonly<{
  id: string
  path: string
  title: string
  aliases: string
  kind: string
  headings: string
  summary: string
  text: string
  section: Section
  anchors: ReadonlyArray<Anchor>
}>

type Stored = Readonly<
  Pick<Document, 'path' | 'title' | 'aliases' | 'summary' | 'section' | 'anchors'>
>

const ENGLISH_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'how',
  'i',
  'in',
  'is',
  'it',
  'my',
  'did',
  'can',
  'why',
  'when',
  'where',
  'who',
  'which',
  'should',
  'need',
  'many',
  'much',
  'out',
  'up',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'with',
])

const SPANISH_STOPWORDS = new Set([
  'a',
  'al',
  'ante',
  'como',
  'con',
  'cual',
  'cuando',
  'de',
  'del',
  'donde',
  'e',
  'el',
  'ella',
  'en',
  'entre',
  'es',
  'esta',
  'este',
  'hay',
  'la',
  'las',
  'le',
  'les',
  'lo',
  'los',
  'me',
  'mi',
  'mis',
  'muy',
  'no',
  'o',
  'para',
  'por',
  'porque',
  'que',
  'quien',
  'se',
  'ser',
  'si',
  'sin',
  'sobre',
  'son',
  'su',
  'sus',
  'te',
  'tu',
  'tus',
  'u',
  'un',
  'una',
  'uno',
  'unos',
  'unas',
  'y',
  'ya',
])

const STOPWORDS: Readonly<Record<Locale, ReadonlySet<string>>> = {
  en: ENGLISH_STOPWORDS,
  es: SPANISH_STOPWORDS,
  ja: new Set(),
}

const stem = (word: string): string => {
  if (word.length <= 3 || /\d/.test(word)) return word
  let out = word
  if (out.endsWith('ies') && out.length > 4) out = `${out.slice(0, -3)}y`
  else if (out.endsWith('sses')) out = out.slice(0, -2)
  else if (out.endsWith('s') && !out.endsWith('ss') && !out.endsWith('us') && !out.endsWith('is'))
    out = out.slice(0, -1)
  for (const suffix of ['ing', 'ed']) {
    if (out.endsWith(suffix) && /[aeiouy]/.test(out.slice(0, -suffix.length))) {
      out = out.slice(0, -suffix.length)
      if (/([^aeiouylsz])\1$/.test(out)) out = out.slice(0, -1)
      break
    }
  }
  return out.length > 3 && out.endsWith('e') ? out.slice(0, -1) : out
}

const stemEs = (word: string): string => {
  if (word.length <= 3 || /\d/.test(word)) return word
  let out = word
  if (out.endsWith('ciones')) out = `${out.slice(0, -6)}cion`
  else if (out.endsWith('mente') && out.length > 7) out = out.slice(0, -5)
  else if (out.endsWith('ces') && out.length > 4) out = `${out.slice(0, -3)}z`
  else if (/[^aeiou]es$/.test(out) && out.length > 4) out = out.slice(0, -2)
  else if (out.endsWith('s') && !out.endsWith('ss') && !out.endsWith('us') && !out.endsWith('is'))
    out = out.slice(0, -1)
  return out.length > 4 && /[aeo]$/.test(out) ? out.slice(0, -1) : out
}

const stemmers: Readonly<Record<Locale, (word: string) => string>> = {
  en: stem,
  es: stemEs,
  ja: (word) => word,
}

const fold = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const words = (text: string): ReadonlyArray<string> =>
  fold(text)
    .replace(/['\u2019]s\b/g, '')
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

const JAPANESE = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}ー々]+/gu

const pairs = (text: string): ReadonlyArray<string> =>
  [...text.normalize('NFKC').matchAll(JAPANESE)].flatMap(([run = '']) =>
    run.length === 1
      ? [run]
      : Array.from({ length: run.length - 1 }, (_, index) => run.slice(index, index + 2)),
  )

const tokensOf = (text: string, locale: Locale): ReadonlyArray<string> =>
  locale === 'ja' ? [...words(text), ...pairs(text)] : words(text)

const termsOf = (text: string, locale: Locale): ReadonlyArray<string> =>
  tokensOf(text, locale)
    .filter((word) => !STOPWORDS[locale].has(word))
    .map(stemmers[locale])

const optionsFor = (locale: Locale): Options<Document> => ({
  fields: ['title', 'aliases', 'headings', 'summary', 'text', 'kind'],
  storeFields: ['path', 'title', 'aliases', 'summary', 'section', 'anchors'],
  tokenize: (text) => [...tokensOf(text, locale)],
  processTerm: (term) => {
    if (STOPWORDS[locale].has(term)) return null
    return stemmers[locale](term)
  },
  searchOptions: {
    boost: { title: 6, aliases: 5, headings: 3, summary: 2, kind: 2 },
    fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
    prefix: (term) => term.length >= 3,
  },
})

export type Index = MiniSearch<Document>

export type IndexPage = Readonly<{
  path: string
  title: string
  aliases: ReadonlyArray<string>
  summary: string
  section: Section
  headings: ReadonlyArray<{ id: string; text: string; level: 2 | 3 }>
  text: string
}>

const documentOf = (page: IndexPage, locale: Locale): Document => ({
  id: page.path,
  path: page.path,
  title: page.title,
  aliases: [...new Set(page.aliases)].join(' | '),
  kind:
    (langOf(locale).t.search.kinds as Readonly<Partial<Record<Section, string>>>)[page.section] ??
    '',
  headings: page.headings.map((heading) => heading.text).join(' '),
  summary: page.summary,
  text: page.text,
  section: page.section,
  anchors: page.headings.map(({ id, text }) => ({ id, text })),
})

export const buildIndex = (
  pages: ReadonlyArray<IndexPage>,
  locale: Locale = DEFAULT_LOCALE,
): Index => {
  const index = new MiniSearch<Document>(optionsFor(locale))
  index.addAll(pages.map((page) => documentOf(page, locale)))
  return index
}

export const indexJson = (
  pages: ReadonlyArray<IndexPage>,
  locale: Locale = DEFAULT_LOCALE,
): string => JSON.stringify(buildIndex(pages, locale))

export const loadIndex = (json: string, locale: Locale = DEFAULT_LOCALE): Index =>
  MiniSearch.loadJSON<Document>(json, optionsFor(locale))

const headingOf = (
  anchors: ReadonlyArray<Anchor>,
  terms: ReadonlyArray<string>,
  locale: Locale,
): string | null => {
  const shortest = locale === 'ja' ? 2 : 3
  const candidates = terms.filter((term) => term.length >= shortest || /\d/.test(term))
  let best: Readonly<{ id: string; score: number }> | null = null
  for (const anchor of anchors) {
    const heading = termsOf(anchor.text, locale)
    const score = candidates.reduce(
      (total, term) =>
        heading.some((word) => word.startsWith(term)) ? total + term.length : total,
      0,
    )
    if (score > 0 && (best === null || score > best.score)) best = { id: anchor.id, score }
  }
  return best?.id ?? null
}

const hasAll = (title: string, terms: ReadonlyArray<string>, locale: Locale): boolean => {
  const own = termsOf(title, locale)
  return terms.every((term) => own.includes(term))
}

const PRIORS: ReadonlyArray<readonly [string, number]> = [
  ['/components/', 1.2],
  ['/glossary/', 1.05],
  ['/incidents/', 1.05],
  ['/research/', 0.95],
  ['/design/', 0.9],
]

const NAMED_BY_TITLE = 4
const NAMED_BY_ALIAS = 2
const NAMED_IN_TITLE = 1.5

export const search = (
  index: Index,
  query: string,
  locale: Locale = DEFAULT_LOCALE,
  limit = 8,
): ReadonlyArray<Hit> => {
  const terms = termsOf(query, locale)
  if (terms.length === 0) return []
  const wanted = terms.join(' ')
  return index
    .search(query)
    .map((result) => {
      const stored = result as unknown as Stored
      const titleTerms = termsOf(stored.title, locale)
      const named =
        titleTerms.join(' ') === wanted
          ? NAMED_BY_TITLE
          : stored.aliases.split(' | ').some((alias) => termsOf(alias, locale).join(' ') === wanted)
            ? NAMED_BY_ALIAS
            : hasAll(stored.title, terms, locale)
              ? NAMED_IN_TITLE
              : 1
      const prior = PRIORS.find(([prefix]) => stored.path.startsWith(prefix))?.[1] ?? 1
      return { stored, score: result.score * prior * named }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ stored }) => ({
      path: stored.path,
      title: stored.title,
      summary: stored.summary,
      section: stored.section,
      heading: hasAll(stored.title, terms, locale)
        ? null
        : headingOf(stored.anchors, terms, locale),
    }))
}
