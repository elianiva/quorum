import * as Markdown from '@foldkit/markdown'
import { CONTENT as CONTENT_EN, LINKS, type ContentEntry } from 'virtual:content-index'
import { type Locale } from './i18n/locale.ts'
import { loadPageAssets } from './page-assets.ts'
import { anchorsFor, headingsOf, prose, textOf, type Anchors } from './prose.ts'
import type { Page } from './page.ts'

export type ProseModule = Readonly<{ default: unknown }>

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

export const loadProse = async (locale: Locale, path: string): Promise<void> => {
  if (locale !== 'en') await loadOne('en', path)
  await loadOne(locale, path)
}

export const loadAllProse = async (): Promise<void> => {
  for (const locale of Object.keys(CONTENT) as ReadonlyArray<Locale>)
    await Promise.all(Object.keys(CONTENT[locale]).map((path) => loadOne(locale, path)))
}

export const isFallback = (locale: Locale, path: string): boolean =>
  locale !== 'en' && CONTENT.en[path] !== undefined && CONTENT[locale][path] === undefined

export const needsProse = (locale: Locale, path: string): boolean =>
  CONTENT[locale][path] !== undefined || CONTENT.en[path] !== undefined

export const isProseLoaded = (locale: Locale, path: string): boolean =>
  locale === 'en' ? documents.en.has(path) : documents[locale].has(path) || documents.en.has(path)

const entryOf = (locale: Locale, path: string): ContentEntry | undefined => CONTENT[locale][path]

const translation = (locale: Locale, path: string, structured: boolean): ContentEntry | null => {
  if (locale === 'en') return null
  const entry = entryOf(locale, path)
  return entry !== undefined && (entry.frontmatter !== null) === structured ? entry : null
}

export type Prose = Readonly<{
  document: Markdown.MarkdownDocument
  text: string
  source: string
  anchors: Anchors | null
  fallback: boolean
}>

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

export const linksFrom = (
  path: string,
): Readonly<{ paths: ReadonlySet<string>; sandboxes: ReadonlySet<string> }> => {
  const found = LINKS[path]
  return {
    paths: new Set(found?.paths ?? []),
    sandboxes: new Set(found?.sandboxes ?? []),
  }
}

export const documentOf = (path: string): Markdown.MarkdownDocument | null =>
  documents.en.get(path) ?? null

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
        seoTitle: own === null ? meta.seoTitle : own.frontmatter?.seoTitle,
        summary: text.summary,
        section: meta.section,
        parent: null,
        group: meta.group ?? null,
        order: Number(meta.order ?? 100),
        era: meta.era === undefined ? null : Number(meta.era),
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
