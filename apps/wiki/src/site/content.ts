import { Markdown } from '@effect/ui/html'
import type { Heading, Page } from './page.ts'
import { slug } from './page.ts'
import { CONTENT as CONTENT_EN, LINKS } from 'virtual:content-index'
import { CONTENT as CONTENT_ES } from 'virtual:content-index-es'
import { CONTENT as CONTENT_JA } from 'virtual:content-index-ja'
import type { ContentEntry } from 'virtual:content-index'
import { type Locale } from '../i18n/locale.ts'

export type ProseModule = Readonly<{ default: Markdown.DocumentEncoded }>

const CONTENT: Record<Locale, Readonly<Record<string, ContentEntry>>> = {
  en: CONTENT_EN,
  es: CONTENT_ES,
  ja: CONTENT_JA,
}

const LOADERS: Readonly<Record<Locale, Readonly<Record<string, () => Promise<ProseModule>>>>> = {
  en: import.meta.glob<ProseModule>('../../content/**/*.md'),
  es: import.meta.glob<ProseModule>('../../content-es/**/*.md'),
  ja: import.meta.glob<ProseModule>('../../content-ja/**/*.md'),
}

const PREFIX: Readonly<Record<Locale, string>> = {
  en: '../../content/',
  es: '../../content-es/',
  ja: '../../content-ja/',
}

let version = 0

export const contentVersion = (): number => version

const documents: Record<Locale, Map<string, Markdown.Document>> = {
  en: new Map(),
  es: new Map(),
  ja: new Map(),
}

export const isProseLoaded = (locale: Locale, path: string): boolean =>
  locale === 'en' ? documents.en.has(path) : documents[locale].has(path) || documents.en.has(path)

export const needsProse = (locale: Locale, path: string): boolean =>
  CONTENT[locale][path] !== undefined || CONTENT.en[path] !== undefined

const loadOne = async (locale: Locale, path: string): Promise<void> => {
  if (documents[locale].has(path)) return
  const entry = CONTENT[locale][path]
  if (entry === undefined) return
  const load = LOADERS[locale][`${PREFIX[locale]}${entry.file}`]
  if (load === undefined) {
    const english = LOADERS.en[`${PREFIX.en}${entry.file}`]
    if (english !== undefined) {
      const module = await english()
      documents[locale].set(path, Markdown.decodeDocument(module.default))
      version += 1
    }
    return
  }
  const module = await load()
  documents[locale].set(path, Markdown.decodeDocument(module.default))
  version += 1
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

export const entryOf = (locale: Locale, path: string): ContentEntry | undefined =>
  CONTENT[locale][path]

const translation = (locale: Locale, path: string, structured: boolean): ContentEntry | null => {
  if (locale === 'en') return null
  const entry = entryOf(locale, path)
  return entry !== undefined && (entry.frontmatter !== null) === structured ? entry : null
}

type Inline = Markdown.Inline
type Block = Markdown.Block

export const plain = (content: ReadonlyArray<Inline>): string =>
  content
    .map((node) => {
      switch (node._tag) {
        case 'Text':
        case 'InlineCode':
          return node.value
        case 'Emphasis':
        case 'Strong':
        case 'Strikethrough':
        case 'Link':
          return plain(node.content)
        default:
          return ''
      }
    })
    .join('')

type HeadingBlock = Extract<Block, { _tag: 'Heading' }>

const headingBlocks = (blocks: ReadonlyArray<Block>): ReadonlyArray<HeadingBlock> =>
  blocks.flatMap((block): ReadonlyArray<HeadingBlock> => {
    switch (block._tag) {
      case 'Heading':
        return [block]
      case 'List':
        return block.items.flatMap((item) => headingBlocks(item.blocks))
      case 'Blockquote':
      case 'Island':
        return headingBlocks(block.blocks)
      default:
        return []
    }
  })

export type Anchors = ReadonlyMap<HeadingBlock, string>

const anchorsOfTexts = (
  headings: ReadonlyArray<HeadingBlock>,
  texts: ReadonlyArray<string>,
): Anchors => {
  const seen = new Map<string, number>()
  return new Map(
    headings.map((heading, index) => {
      const base = slug(texts[index] ?? plain(heading.content))
      const count = (seen.get(base) ?? 0) + 1
      seen.set(base, count)
      return [heading, count === 1 ? base : `${base}-${count}`]
    }),
  )
}

export const anchorsFor = (document: Markdown.Document, english: Markdown.Document): Anchors => {
  const own = headingBlocks(document.blocks)
  const source = headingBlocks(english.blocks)
  const aligned =
    own.length === source.length && own.every((heading, at) => heading.level === source[at]?.level)
  return anchorsOfTexts(
    own,
    aligned ? source.map((heading) => plain(heading.content)) : own.map((h) => plain(h.content)),
  )
}

export const headingsOf = (
  document: Markdown.Document,
  anchors?: Anchors,
): ReadonlyArray<Heading> => {
  const seen = new Map<string, number>()
  return headingBlocks(document.blocks).flatMap((heading): ReadonlyArray<Heading> => {
    if (heading.level !== 2 && heading.level !== 3) return []
    const text = plain(heading.content)
    const base = anchors?.get(heading) ?? slug(text)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return [{ id: count === 1 ? base : `${base}-${count}`, text, level: heading.level }]
  })
}

export const textOf = (document: Markdown.Document): string =>
  document.blocks
    .map((block) =>
      block._tag === 'Paragraph' || block._tag === 'Heading' ? plain(block.content) : '',
    )
    .join(' ')

export type Prose = Readonly<{
  document: Markdown.Document
  text: string
  source: string
  anchors: Anchors | null
  headings: ReadonlyArray<Heading>
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
  const anchors = own === null ? null : anchorsFor(own, base)
  return {
    document: chosen,
    text: textOf(chosen),
    source: (ownMeta ?? baseMeta).source,
    anchors,
    headings: headingsOf(chosen, anchors ?? undefined),
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

export const documentOf = (path: string): Markdown.Document | null => documents.en.get(path) ?? null

export const proseEntries = (_locale: Locale): ReadonlyArray<[string, ContentEntry]> =>
  Object.entries(CONTENT.en).filter(([, entry]) => entry.frontmatter !== null)

const headingsOfPage = (
  locale: Locale,
  path: string,
  structured: boolean,
  top: boolean | undefined,
): ReadonlyArray<Heading> => {
  const found = proseAt(locale, path, structured)
  if (found === null) return []
  return top === true ? found.headings.filter((heading) => heading.level === 2) : found.headings
}

/** The pages whose frontmatter describes an article. Their bodies are Markdown. */
export const authoredPages = <Msg>(locale: Locale): ReadonlyArray<Page<Msg>> =>
  Object.entries(CONTENT.en).flatMap(([path, base]): ReadonlyArray<Page<Msg>> => {
    const meta = base.frontmatter
    if (meta === null) return []
    const own = translation(locale, path, true)
    const text = own?.frontmatter ?? meta
    return [
      {
        kind: 'article',
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
        headings: headingsOfPage(locale, path, true, meta.toc === 'top'),
        wide: false,
        body: null,
        aside: null,
        related: [],
        text: proseAt(locale, path, true)?.text ?? '',
        fallback: locale !== 'en' && own === null,
      },
    ]
  })

export const prosePaths: ReadonlyArray<string> = Object.entries(CONTENT.en)
  .filter(([, entry]) => entry.frontmatter === null)
  .map(([path]) => path)

export const localizedEntry = (locale: Locale, path: string): ContentEntry | undefined =>
  locale === 'en' ? undefined : CONTENT[locale][path]

export { CONTENT }
