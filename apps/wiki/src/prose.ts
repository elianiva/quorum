import * as Markdown from '@foldkit/markdown'
import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { localeOf } from './i18n/builder.ts'
import { langOf } from './i18n/lang.ts'
import type { Message, Model } from './main.ts'
import { diagramView } from './components/diagram.ts'
import { mathView } from './components/math.ts'
import { islandViews } from './components/islands.ts'
import { type Heading, slug } from './page.ts'
import { css, cx } from '@quorum/styled-system/css'

type Inline = Markdown.Inline

/** The plain text of inline content, for anchors and search. */
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

type HeadingBlock = Extract<Markdown.Block, { _tag: 'Heading' }>

/** Every heading of a document, in reading order, including those inside lists, quotes and islands. */
const headingBlocks = (blocks: ReadonlyArray<Markdown.Block>): ReadonlyArray<HeadingBlock> =>
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

/** The anchors of a heading, by heading, so each section keeps one anchor in every language. */
export type Anchors = ReadonlyMap<HeadingBlock, string>

/** A heading's anchor within a document: the slug of its text, and a count after a repeat. */
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

/** The anchors of a translated document: the English document's, paired by position, since a
    translation keeps the English headings in the same order and at the same levels. A translation
    whose headings do not line up with the English falls back to slugging its own text. */
export const anchorsFor = (
  document: Markdown.MarkdownDocument,
  english: Markdown.MarkdownDocument,
): Anchors => {
  const own = headingBlocks(document.blocks)
  const source = headingBlocks(english.blocks)
  const aligned =
    own.length === source.length && own.every((heading, at) => heading.level === source[at]?.level)
  return anchorsOfTexts(
    own,
    aligned ? source.map((heading) => plain(heading.content)) : own.map((h) => plain(h.content)),
  )
}

/** The second- and third-level headings of a document, in order. Pass a translation's `anchors`
    to keep the English ids. */
export const headingsOf = (
  document: Markdown.MarkdownDocument,
  anchors?: Anchors,
): ReadonlyArray<Heading> =>
  document.blocks.flatMap((block): ReadonlyArray<Heading> => {
    if (block._tag !== 'Heading' || (block.level !== 2 && block.level !== 3)) return []
    const text = plain(block.content)
    return [{ id: anchors?.get(block) ?? slug(text), text, level: block.level }]
  })

/** The text of a document, for the search index. */
export const textOf = (document: Markdown.MarkdownDocument): string =>
  document.blocks
    .map((block) =>
      block._tag === 'Paragraph' || block._tag === 'Heading' ? plain(block.content) : '',
    )
    .join(' ')

/** Every wiki path a document links to, without hashes, and every Sandbox it places. */
export const linksIn = (
  document: Markdown.MarkdownDocument,
): Readonly<{ paths: ReadonlySet<string>; sandboxes: ReadonlySet<string> }> => {
  const paths = new Set<string>()
  const sandboxes = new Set<string>()
  const inlines = (content: ReadonlyArray<Inline>): void => {
    for (const node of content) {
      if (node._tag === 'Link') {
        if (node.url.startsWith('/')) paths.add(node.url.split('#')[0] ?? node.url)
        inlines(node.content)
      } else if (
        node._tag === 'Emphasis' ||
        node._tag === 'Strong' ||
        node._tag === 'Strikethrough'
      )
        inlines(node.content)
    }
  }
  const blocks = (list: ReadonlyArray<Markdown.Block>): void => {
    for (const block of list) {
      switch (block._tag) {
        case 'Heading':
        case 'Paragraph':
          inlines(block.content)
          break
        case 'List':
          for (const item of block.items) blocks(item.blocks)
          break
        case 'Blockquote':
          blocks(block.blocks)
          break
        case 'Table':
          for (const row of [block.headerRow, ...block.bodyRows])
            for (const cell of row.cells) inlines(cell.content)
          break
        case 'Island':
          if (block.name === 'Sandbox' && block.attributes.id) sandboxes.add(block.attributes.id)
          blocks(block.blocks)
          break
        default:
      }
    }
  }
  blocks(document.blocks)
  return { paths, sandboxes }
}

const external = (url: string): boolean => /^https?:/.test(url)

export const prose = (
  document: Markdown.MarkdownDocument,
  model: Model,
  h: HtmlBuilder<Message>,
  anchors?: Anchors,
): Html => {
  // A page can repeat a heading, such as the changelog's "Added" on every day. Suffix the later
  // copies so ids stay unique and each anchor link reaches its own section.
  const seen = new Map<string, number>()
  const idOf = (text: string, heading: HeadingBlock): string => {
    const given = anchors?.get(heading)
    if (given !== undefined) return given
    const base = slug(text)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
  return h.div(
    [h.Class('prose')],
    Markdown.viewBlocks(document, {
      islands: islandViews(model, h),
      views: {
        Heading: (heading, content) => {
          const id = idOf(plain(heading.content), heading)
          const anchor = h.a(
            [
              h.Href(`#${id}`),
              h.AriaLabel(langOf(localeOf(h)).t.prose.linkToSection),
              h.Class('anchor'),
            ],
            ['#'],
          )
          return heading.level === 2
            ? h.h2([h.Id(id), h.Class('group')], [...content, anchor])
            : heading.level === 3
              ? h.h3([h.Id(id), h.Class('group')], [...content, anchor])
              : h.h4([h.Id(id)], content)
        },
        Image: ({ url, alt }) => h.img([h.Src(url), h.Alt(alt), h.Loading('lazy')]),
        Paragraph: (paragraph, content) => {
          const [only] = paragraph.content
          return paragraph.content.length === 1 && only?._tag === 'Image'
            ? h.figure(
                [h.Class('prose-figure')],
                [
                  h.img([h.Src(only.url), h.Alt(only.alt), h.Loading('lazy')]),
                  ...(only.alt ? [h.figcaption([], [only.alt])] : []),
                ],
              )
            : h.p([], content)
        },
        Link: ({ url }, content) =>
          h.a(
            [h.Href(url), ...(external(url) ? [h.Rel('noopener'), h.Target('_blank')] : [])],
            content,
          ),
        Table: (_table, header, rows) =>
          h.div(
            [
              h.Class(
                cx(
                  css({
                    marginBlock: '1.5rem',
                    overflowX: 'auto',
                    borderRadius: 'lg',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'var(--border)',
                  }),
                  'not-prose',
                ),
              ),
            ],
            [
              h.table(
                [
                  h.Class(
                    css({
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '14px',
                      lineHeight: '1.375',
                    }),
                  ),
                ],
                [
                  h.thead([], [header]),
                  h.tbody(
                    [
                      h.Class(
                        css({
                          '& > * + *': {
                            borderTopWidth: '1px',
                            borderTopStyle: 'solid',
                            borderColor: 'var(--border)',
                          },
                        }),
                      ),
                    ],
                    rows,
                  ),
                ],
              ),
            ],
          ),
        TableCell: (_cell, content, alignment, isHeader) =>
          isHeader
            ? h.th(
                [
                  h.Class(
                    css({
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'var(--border)',
                      backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                      paddingInline: '0.75rem',
                      paddingBlock: '0.5rem',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                  ...(alignment === 'Right' ? [h.Style({ textAlign: 'right' })] : []),
                ],
                content,
              )
            : h.td(
                [
                  h.Class(
                    css({
                      paddingInline: '0.75rem',
                      paddingBlock: '0.5rem',
                      verticalAlign: 'top',
                    }),
                  ),
                  ...(alignment === 'Right' ? [h.Style({ textAlign: 'right' })] : []),
                ],
                content,
              ),
        CodeBlock: (block) =>
          Option.getOrNull(block.maybeLanguage) === 'latex'
            ? mathView(block.value, h)
            : Option.getOrNull(block.maybeLanguage) === 'mermaid'
              ? diagramView(block.value, h)
              : h.pre([], [h.code([], [block.value])]),
      },
    }),
  )
}
