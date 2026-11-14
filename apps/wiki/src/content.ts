import * as Markdown from '@foldkit/markdown'
import { CONTENT as CONTENT_EN, LINKS, type ContentEntry } from 'virtual:content-index'
import { type Locale } from './i18n/locale.ts'
import { loadPageAssets } from './page-assets.ts'
import { anchorsFor, headingsOf, prose, textOf, type Anchors } from './prose.ts'
import type { Page } from './page.ts'

/* Prose lives in `content/` (English) and in a directory per other language with the same relative
   paths: `content-es/` and `content-ja/`. English is the source of structure: a translated file
   replaces an English page's title, summary, aliases and body, while its section, group, order, era,
   gdd and toc always come from the English file. A page with no translation shows its English text.

   The build's content index (src/content-index.ts) knows every file's frontmatter and links. A
   page's prose itself is a chunk of its own: `loadProse` brings in the page the reader is on, and
   `loadAllProse` brings in the whole corpus for the build's Markdown, search index, and tests. */

export type ProseModule = Readonly<{ default: unknown }>

/** Each language's index arrives with its bundle (src/locales/<language>.ts). */
const CONTENT: Record<Locale, Readonly<Record<string, ContentEntry>>> = {
  en: CONTENT_EN,
  es: {},
  ja: {},
}

export const registerContent = (
  locale: Locale,
  content: Readonly<Record<string, ContentEntry>>,
): void => {
  CONTENT[locale] = content
}

/** One loader per file, relative to this directory. The keys match `ContentEntry.file`. */
const LOADERS: Readonly<Record<Locale, Readonly<Record<string, () => Promise<ProseModule>>>>> = {
  en: import.meta.glob<ProseModule>('../content/**/*.md'),
  es: import.meta.glob<ProseModule>('../../content-es/**/*.md'),
  ja: import.meta.glob<ProseModule>('../../content-ja/**/*.md'),
}

const PREFIX: Readonly<Record<Locale, string>> = {
  en: '../content/',
  es: '../../content-es/',
  ja: '../../content-ja/',
}

const documents: Record<Locale, Map<string, Markdown.MarkdownDocument>> = {
  en: new Map(),
  es: new Map(),
  ja: new Map(),
}

/** Called after a page's prose arrives, so cached page objects can rebuild their text and headings. */
const listeners = new Set<() => void>()

export const onProseLoaded = (listener: () => void): void => {
  listeners.add(listener)
}

const loadOne = async (locale: Locale, path: string): Promise<void> => {
  if (documents[locale].has(path)) return
  const entry = CONTENT[locale][path]
  if (entry === undefined) return
  const load = LOADERS[locale][`${PREFIX[locale]}${entry.file}`]
  if (load === undefined) return
  const document = Markdown.decodeDocument((await load()).default)
  documents[locale].set(path, document)
  await loadPageAssets(document)
  for (const listener of listeners) listener()
}

/** Loads the prose a page needs: its own language's file, and the English one for the anchors a
    translation keeps and the English fallback. Loading a page twice is free. */
export const loadProse = async (locale: Locale, path: string): Promise<void> => {
  if (locale !== 'en') await loadOne('en', path)
  await loadOne(locale, path)
}

/** Loads every file in every language: the build's Markdown twins and search indexes need it. */
export const loadAllProse = async (): Promise<void> => {
  for (const locale of Object.keys(CONTENT) as ReadonlyArray<Locale>)
    await Promise.all(Object.keys(CONTENT[locale]).map((path) => loadOne(locale, path)))
}

/** Whether a page has prose to load, or is generated from the catalog alone. */
export const needsProse = (locale: Locale, path: string): boolean =>
  CONTENT[locale][path] !== undefined || CONTENT.en[path] !== undefined

/** Whether the page the reader is on has its prose (and, in another language, its English base). */
export const isProseLoaded = (locale: Locale, path: string): boolean =>
  locale === 'en' ? documents.en.has(path) : documents[locale].has(path) || documents.en.has(path)

const entryOf = (locale: Locale, path: string): ContentEntry | undefined => CONTENT[locale][path]

/** The translation of an English entry, if its file exists. */
const translation = (locale: Locale, path: string, structured: boolean): ContentEntry | null => {
  if (locale === 'en') return null
  const entry = entryOf(locale, path)
  return entry !== undefined && (entry.frontmatter !== null) === structured ? entry : null
}

export type Prose = Readonly<{
  document: Markdown.MarkdownDocument
  text: string
  source: string
  /** Anchors that keep a translation's headings at the English ids; null for English. */
  anchors: Anchors | null
  /** The text is English because no translation exists. */
  fallback: boolean
}>

/** Prose by its path. Authored pages pass `structured: true`, catalog prose `false`. */
export const proseAt = (locale: Locale, path: string, structured = false): Prose | null => {
  const baseMeta = entryOf('en', path)
  if (baseMeta === undefined || (baseMeta.frontmatter !== null) !== structured) return null
  const base = documents.en.get(path)
  if (base === undefined) return null
  const ownMeta = translation(locale, path, structured)
  const own = ownMeta === null ? null : (documents[locale].get(path) ?? null)
  const chosen = own ?? base
  return {
    document: chosen,
    text: textOf(chosen),
    source: (ownMeta ?? baseMeta).source,
    anchors: own === null ? null : anchorsFor(own, base),
    fallback: locale !== 'en' && own === null,
  }
}

/** The wiki paths and Sandboxes that a page's prose links to or places. The English text is the
    source of every relationship, so a translation never changes which pages are related. */
export const linksFrom = (
  path: string,
): Readonly<{ paths: ReadonlySet<string>; sandboxes: ReadonlySet<string> }> => {
  const found = LINKS[path]
  return {
    paths: new Set(found?.paths ?? []),
    sandboxes: new Set(found?.sandboxes ?? []),
  }
}

/** The English source document of an authored page, once the corpus is loaded. */
export const documentOf = (path: string): Markdown.MarkdownDocument | null =>
  documents.en.get(path) ?? null

/** Every prose file that belongs to a catalog page, for the coverage tests. */
export const prosePaths: ReadonlyArray<string> = Object.entries(CONTENT.en)
  .filter(([, entry]) => entry.frontmatter === null)
  .map(([path]) => path)

const headingsOfPage = (
  locale: Locale,
  path: string,
  structured: boolean,
  top: boolean | undefined,
): ReadonlyArray<Page['headings'][number]> => {
  const found = proseAt(locale, path, structured)
  if (found === null) return []
  const headings = headingsOf(found.document, found.anchors ?? undefined)
  return top === true ? headings.filter((heading) => heading.level === 2) : headings
}

/** The authored pages in a language: translated text where it exists, English where it does not. */
export const authoredPages = (locale: Locale): ReadonlyArray<Page> =>
  Object.entries(CONTENT.en).flatMap(([path, base]): ReadonlyArray<Page> => {
    const meta = base.frontmatter
    if (meta === null) return []
    const own = translation(locale, path, true)
    const text = own?.frontmatter ?? meta
    return [
      {
        locale,
        path,
        title: text.title,
        summary: text.summary,
        section: meta.section,
        parent: null,
        group: meta.group ?? null,
        order: Number(meta.order ?? 100),
        era: meta.era === undefined ? null : Number(meta.era),
        // A translated page keeps its English aliases too, so a reader who knows the English term finds it.
        aliases: [
          ...new Set(
            [text.aliases, meta.aliases]
              .flatMap((aliases) => (aliases ?? '').split(','))
              .map((alias) => alias.trim())
              .filter(Boolean),
          ),
        ],
        source: (own ?? base).source,
        gdd: meta.gdd ?? null,
        get headings() {
          return headingsOfPage(locale, path, true, meta.toc === 'top')
        },
        wide: false,
        aside: null,
        body: (model, h) => {
          const found = proseAt(locale, path, true)
          return found === null
            ? h.empty
            : prose(found.document, model, h, found.anchors ?? undefined)
        },
        related: [],
        get text() {
          return proseAt(locale, path, true)?.text ?? ''
        },
        fallback: locale !== 'en' && own === null,
      },
    ]
  })
