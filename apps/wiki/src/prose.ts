import * as Markdown from '@foldkit/markdown'
import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { IMAGE_SIZES } from 'virtual:image-sizes'
import { localeOf } from './i18n/builder.ts'
import { langOf } from './i18n/lang.ts'
import type { Message, Model } from './main.ts'
import { diagramView } from './components/diagram.ts'
import { mathView } from './components/math.ts'
import { islandViews } from './components/islands.ts'
import { type Heading, slug } from './page.ts'
import { css, cx } from '@quorum/styled-system/css'

type Inline = Markdown.Inline

/** An image with its intrinsic size, so the text below it does not move when it loads. */
const image = (url: string, alt: string, h: HtmlBuilder<Message>): Html => {
  const size = IMAGE_SIZES[url]
  return h.img([
    h.Src(url),
    h.Alt(alt),
    h.Loading('lazy'),
    ...(size === undefined ? [] : [h.Width(String(size.width)), h.Height(String(size.height))]),
  ])
}

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
export { linksIn } from './links.ts'

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
        Image: ({ url, alt }) => image(url, alt, h),
        Paragraph: (paragraph, content) => {
          const [only] = paragraph.content
          return paragraph.content.length === 1 && only?._tag === 'Image'
            ? h.figure(
                [h.Class('prose-figure')],
                [image(only.url, only.alt, h), ...(only.alt ? [h.figcaption([], [only.alt])] : [])],
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
                    marginBlock: '6',
                    overflowX: 'auto',
                    borderRadius: 'lg',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    borderColor: 'border',
                  }),
                  'not-prose',
                  'prose-table',
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
                      fontSize: 'type.14',
                      lineHeight: 'snug',
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
                            borderColor: 'border',
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
                      borderColor: 'border',
                      backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                      paddingInline: '3',
                      paddingBlock: '2',
                      textAlign: 'left',
                      fontSize: 'type.12',
                      fontWeight: 'medium',
                      color: 'mutedForeground',
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
                      paddingInline: '3',
                      paddingBlock: '2',
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
