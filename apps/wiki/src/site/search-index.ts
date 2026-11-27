import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MarkdownParser, type Markdown } from '@effect/ui/html'
import { Option, Schema } from 'effect'
import { Frontmatter } from '../frontmatter.ts'
import { islandAttributes } from '../islands.ts'
import { loadLocale } from '../i18n/load.ts'
import { LOCALES, withLocale, type Locale } from '../i18n/locale.ts'
import { slug } from './page.ts'
import { indexJson } from '../search.ts'

const WIKI = fileURLToPath(new URL('../..', import.meta.url))

const ROOTS: Readonly<Record<Locale, string>> = {
  en: resolve(WIKI, 'content'),
  es: resolve(WIKI, 'content-es'),
  ja: resolve(WIKI, 'content-ja'),
}

const decodeFrontmatter = Schema.decodeUnknownSync(Frontmatter)

type Inline = Markdown.Inline
type Block = Markdown.Block

const plain = (content: ReadonlyArray<Inline>): string =>
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

const headingsOf = (
  document: Markdown.Document,
): ReadonlyArray<{ id: string; text: string; level: 2 | 3 }> => {
  const seen = new Map<string, number>()
  return headingBlocks(document.blocks).flatMap((heading) => {
    if (heading.level !== 2 && heading.level !== 3) return []
    const text = plain(heading.content)
    const base = slug(text)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return [{ id: count === 1 ? base : `${base}-${count}`, text, level: heading.level }]
  })
}

const textOf = (document: Markdown.Document): string =>
  document.blocks
    .map((block) =>
      block._tag === 'Paragraph' || block._tag === 'Heading' ? plain(block.content) : '',
    )
    .join(' ')

const pathOf = (file: string): string => {
  const path = `/${file}`.replace(/\.md$/, '').replace(/\/index$/, '')
  return path === '' ? '/' : path
}

const filesIn = async (root: string): Promise<ReadonlyArray<string>> =>
  (await readdir(root, { recursive: true })).filter((file) => file.endsWith('.md')).sort()

const parsed = async (
  root: string,
  file: string,
): Promise<Readonly<{ frontmatter: Frontmatter | null; document: Markdown.Document }>> => {
  const source = await readFile(join(root, file), 'utf8')
  const result = MarkdownParser.parseMarkdownWithFrontmatter(source, {
    frontmatter: Frontmatter,
    islands: islandAttributes,
  })
  const raw = Option.getOrNull(result.frontmatter)
  return {
    frontmatter: raw === null ? null : decodeFrontmatter(raw),
    document: result.document,
  }
}

const cache = new Map<Locale, string>()

export const clearSearchIndexes = (): void => {
  cache.clear()
}

const make = async (locale: Locale): Promise<string> => {
  await loadLocale(locale)
  const [{ loadAllProse }, { pagesFor }] = await Promise.all([
    import('./content.ts'),
    import('./pages.ts'),
  ])
  await loadAllProse()
  const english = new Map<string, Awaited<ReturnType<typeof parsed>>>()
  for (const file of await filesIn(ROOTS.en))
    english.set(pathOf(file), await parsed(ROOTS.en, file))
  const localized = new Map<string, Awaited<ReturnType<typeof parsed>>>()
  if (locale !== 'en') {
    for (const file of await filesIn(ROOTS[locale]))
      localized.set(pathOf(file), await parsed(ROOTS[locale], file))
  }
  const pages = pagesFor(locale).map((page) => {
    const base = english.get(page.path)
    const own = localized.get(page.path)
    return {
      ...page,
      headings:
        page.headings.length > 0
          ? page.headings
          : base === undefined
            ? []
            : headingsOf(own?.document ?? base.document),
      text:
        page.text.length > 0
          ? page.text
          : base === undefined
            ? ''
            : textOf(own?.document ?? base.document),
    }
  })
  return indexJson(pages, locale)
}

export const searchIndex = async (locale: Locale): Promise<string> => {
  const known = cache.get(locale)
  if (known !== undefined) return known
  const made = await make(locale)
  cache.set(locale, made)
  return made
}

export const searchIndexes = async (): Promise<Readonly<Record<string, string>>> =>
  Object.fromEntries(
    await Promise.all(
      LOCALES.map(async (locale) => [
        withLocale(locale, '/search-index.json').slice(1),
        await searchIndex(locale),
      ]),
    ),
  )
