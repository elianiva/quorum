import type { View } from '@effect/ui'
import { Markdown } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { Option } from 'effect'
import { ArrowRight, Info, Lightbulb, TriangleAlert } from 'lucide'
import { researchList } from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { FIGURE } from '@quorum/ui/game/bits'
import { groupBadge } from './badge.ts'
import { Quiz } from './Quiz.ts'
import { DiagramBlock, MathBlock } from './RichCode.ts'
import { Practice } from './Practice.ts'
import { Design } from './Design.ts'
import { icon } from './icon.ts'
import { islandAttributes } from '../islands.ts'
import { langOf, type Lang } from '../i18n/lang.ts'
import { optionControls } from '../reference/options.ts'
import { proseStyle } from '../prose-style.ts'
import type { Anchors } from './content.ts'
import { plain } from './content.ts'
import type { Heading } from './page.ts'
import { slug } from './page.ts'
import { IMAGE_SIZES } from 'virtual:image-sizes'

const NOTE = {
  tip: { glyph: Lightbulb, tone: css({ color: 'ok' }) },
  warn: { glyph: TriangleAlert, tone: css({ color: 'warn' }) },
  real: { glyph: Info, tone: css({ color: 'groupEdge' }) },
} as const

const external = (url: string): boolean => /^https?:/.test(url)

const image = <Msg>(url: string, alt: string, h: H<Msg>): View.Content<Msg> => {
  const size = IMAGE_SIZES[url]
  const img = h.img.attr('src', url).attr('alt', alt).attr('loading', 'lazy')
  return size === undefined
    ? img
    : img.attr('width', String(size.width)).attr('height', String(size.height))
}

const optionsTable = <Msg>(l: Lang, id: string, h: H<Msg>): View.Content<Msg> => {
  const controls = optionControls(l)[id as keyof ReturnType<typeof optionControls>] ?? []
  if (controls.length === 0) return h.span.children()
  const t = l.t.islands.options
  const cell = css({ paddingInline: '3', paddingBlock: '2', verticalAlign: 'top' })
  return h.div
    .class(
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
      ),
    )
    .children(
      h.table
        .class(
          css({
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 'type.14',
            lineHeight: 'snug',
          }),
        )
        .children(
          h.thead.children(
            h.tr.children(
              ...[t.control, t.settings, t.when].map((header) =>
                h.th
                  .key(header)
                  .class(
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
                      whiteSpace: 'nowrap',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(header),
              ),
            ),
          ),
          h.tbody
            .class(
              css({
                '& > * + *': {
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                  borderColor: 'border',
                },
              }),
            )
            .children(
              ...controls.map((control) =>
                h.tr
                  .key(control.name)
                  .children(
                    h.td.class(cx(cell, css({ fontWeight: 'medium' }))).children(control.name),
                    h.td
                      .class(cx(cell, css({ color: 'mutedForeground' })))
                      .children(control.settings),
                    h.td.class(cx(cell, css({ color: 'mutedForeground' }))).children(control.shown),
                  ),
              ),
            ),
        ),
    )
}

const componentCard = <Msg>(l: Lang, id: string, h: H<Msg>): View.Content<Msg> => {
  const def = l.cat.COMPONENTS[id as keyof typeof l.cat.COMPONENTS]
  if (def === undefined) return h.span.children()
  return h.a
    .attr('href', `/components/${id}`)
    .class(
      cx(
        css({
          marginBlock: '6',
          display: 'flex',
          maxWidth: '28rem',
          alignItems: 'center',
          gap: '3.5',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          paddingInline: '4',
          paddingBlock: '3',
          transitionProperty:
            'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'default',
          _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
        }),
        'not-prose',
        'group',
      ),
    )
    .children(
      groupBadge(
        def.group,
        COMPONENT_ICONS[id as keyof typeof COMPONENT_ICONS],
        css({ width: '10', height: '10' }),
        h,
      ),
      h.span.class(css({ minWidth: '0', flex: '1 1 0%' })).children(
        h.span
          .class(css({ display: 'flex', alignItems: 'baseline', gap: '2' }))
          .children(
            h.span
              .class(css({ fontSize: 'type.15', fontWeight: 'semibold', letterSpacing: 'tight' }))
              .children(def.name),
            h.span
              .class(css({ fontSize: 'type.12', color: 'mutedForeground' }))
              .children(def.product),
          ),
        h.span
          .class(
            css({
              marginTop: '0.5',
              display: 'block',
              fontSize: 'type.13',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(def.blurb),
      ),
      icon(
        h,
        ArrowRight,
        css({
          width: '4',
          height: '4',
          flexShrink: '0',
          color: 'mutedForeground',
          transitionProperty: 'transform, translate, scale, rotate',
          transitionDuration: 'fast',
          transitionTimingFunction: 'default',
          '.group:hover &': { translate: '0.125rem' },
        }),
      ),
    )
}

const trackList = <Msg>(l: Lang, track: string, h: H<Msg>): View.Content<Msg> =>
  h.ol
    .class(cx(css({ marginBlock: '5', display: 'flex', flexWrap: 'wrap', gap: '2' }), 'not-prose'))
    .children(
      ...researchList
        .filter((entry) => entry.track === track)
        .map((entry) =>
          h.li.key(entry.id).children(
            h.a
              .attr('href', `/research/${entry.id}`)
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  borderRadius: 'md',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
                  paddingBlock: '1',
                  paddingRight: '3',
                  paddingLeft: '1',
                  fontSize: 'type.13',
                  _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
                }),
              )
              .children(entry.id, l.cat.RESEARCH[entry.id].name),
          ),
        ),
    )

/**
 * Render one Markdown document as the article body. The anchors keep translated
 * headings at the English URL, as the old wiki did.
 */
export const prose = <Msg>(
  h: H<Msg>,
  locale: Lang['locale'],
  document: Markdown.Document,
  anchors?: Anchors,
): View.Content<Msg> => {
  const l = langOf(locale)
  const seen = new Map<string, number>()
  const idOf = (text: string, heading: Extract<Markdown.Block, { _tag: 'Heading' }>): string => {
    const given = anchors?.get(heading)
    if (given !== undefined) return given
    const base = slug(text)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
  const blocks = Markdown.viewBlocks(h, document, {
    islands: Markdown.islandsFor(islandAttributes, {
      Note: (h, { tone }, content) => {
        const note = NOTE[tone ?? 'tip']
        return h.aside
          .class(
            cx(
              css({
                marginBlock: '6',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'border',
                paddingInline: '4',
                paddingBlock: '3',
              }),
              'not-prose',
            ),
          )
          .children(
            h.div
              .class(
                css({
                  marginBottom: '1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                  fontSize: 'type.13',
                  fontWeight: 'medium',
                }),
              )
              .children(
                icon(h, note.glyph, cx(css({ width: '3.5', height: '3.5' }), note.tone)),
                l.t.islands.note[tone ?? 'tip'],
              ),
            h.div
              .class(
                cx(
                  css({ fontSize: 'type.14', '& > * + *': { marginTop: '2' } }),
                  proseStyle,
                  'prose',
                ),
              )
              .children(...content),
          )
      },
      Quiz: (h, quiz, _content, occurrence) =>
        Quiz(h, {
          key: `quiz-${occurrence}`,
          props: { ...quiz, locale: l.locale },
        }),
      Sandbox: (h, { id }) => {
        const def = l.cat.GUIDED[id as keyof typeof l.cat.GUIDED]
        if (def === undefined) return h.span.children()
        return h.a
          .attr('href', `/sandboxes/${id}`)
          .class(
            cx(
              css({
                marginBlock: '6',
                display: 'flex',
                alignItems: 'center',
                gap: '4',
                borderRadius: 'lg',
                borderWidth: '1px',
                borderStyle: 'solid',
                borderColor: 'border',
                paddingInline: '4',
                paddingBlock: '3',
                _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
              }),
              'not-prose',
              'group',
            ),
          )
          .children(
            h.span.class(css({ minWidth: '0', flex: '1 1 0%' })).children(
              h.span
                .class(css({ fontSize: 'type.12', color: 'mutedForeground' }))
                .children(l.t.islands.sandbox),
              h.span
                .class(
                  css({
                    marginTop: '1',
                    display: 'block',
                    fontSize: 'type.16',
                    fontWeight: 'semibold',
                    letterSpacing: 'tight',
                  }),
                )
                .children(def.name),
              h.span
                .class(css({ display: 'block', fontSize: 'type.13', color: 'mutedForeground' }))
                .children(def.objectives[0]?.goal ?? ''),
            ),
            icon(h, ArrowRight, css({ width: '4', height: '4', color: 'mutedForeground' })),
          )
      },
      Design: (h, { id }) => Design(h, id, l.locale),
      Options: (h, { id }) => optionsTable(l, id, h),
      Component: (h, { id }) => componentCard(l, id, h),
      Mix: (h, { era }) => {
        const def = l.cat.ERAS[Number(era)]
        if (def === undefined) return h.span.children()
        const kinds = Object.entries(def.mix) as ReadonlyArray<[keyof typeof l.cat.KINDS, number]>
        const share = (value: number) => `${Math.round(value * 1000) / 10}%`
        return h.figure.class(cx(css({ marginBlock: '5' }), 'not-prose')).children(
          h.div.class(css({ display: 'flex', flexDirection: 'column', gap: '3' })).children(
            h.div
              .class(
                css({
                  display: 'flex',
                  height: '2',
                  gap: '0.25',
                  overflow: 'hidden',
                  borderRadius: 'full',
                }),
              )
              .children(
                ...kinds.map(([kind, value]) =>
                  h.span
                    .key(kind)
                    .attr('title', `${l.cat.KINDS[kind].label} ${share(value)}`)
                    .style({
                      width: share(value),
                      background: `#${l.cat.KINDS[kind].color.toString(16).padStart(6, '0')}`,
                    })
                    .children(),
                ),
              ),
            h.ul
              .class(
                css({
                  display: 'flex',
                  flexWrap: 'wrap',
                  columnGap: '4',
                  rowGap: '1.5',
                  fontSize: 'type.12',
                }),
              )
              .children(
                ...kinds.map(([kind, value]) =>
                  h.li
                    .key(kind)
                    .class(css({ display: 'inline-flex', alignItems: 'center', gap: '1.5' }))
                    .children(
                      h.span
                        .class(css({ width: '2.5', height: '2.5', borderRadius: 'sm' }))
                        .style({
                          background: `#${l.cat.KINDS[kind].color.toString(16).padStart(6, '0')}`,
                        })
                        .children(),
                      l.cat.KINDS[kind].label,
                      h.span
                        .class(cx(FIGURE, css({ color: 'mutedForeground' })))
                        .children(share(value)),
                    ),
                ),
              ),
          ),
          h.figcaption
            .class(css({ fontSize: 'type.12', color: 'mutedForeground' }))
            .children(l.t.islands.mix(def.name)),
        )
      },
      Lever: (h, { kind }) => h.span.children(l.t.islands.lever.title(kind)),
      Practice: (h, { id }) => Practice(h, id as 'place' | 'wire' | 'rearrange', l.locale),
      Track: (h, { track }) => trackList(l, track, h),
    }),
    views: {
      Heading: (h, heading, content) => {
        const text = plain(heading.content)
        const id = idOf(text, heading)
        const anchor = h.a
          .attr('href', `#${id}`)
          .attr('aria-label', l.t.prose.linkToSection)
          .class('anchor')
          .children('#')
        return heading.level === 2
          ? h.h2
              .attr('id', id)
              .class('group')
              .children(...content, anchor)
          : heading.level === 3
            ? h.h3
                .attr('id', id)
                .class('group')
                .children(...content, anchor)
            : h.h4.attr('id', id).children(...content)
      },
      Image: (h, { url, alt }) => image(url, alt, h),
      Paragraph: (h, paragraph, content) => {
        const [only] = paragraph.content
        return paragraph.content.length === 1 && only?._tag === 'Image'
          ? h.figure
              .class('prose-figure')
              .children(
                image(only.url, only.alt, h),
                ...(only.alt ? [h.figcaption.children(only.alt)] : []),
              )
          : h.p.children(...content)
      },
      Link: (h, { url }, content) =>
        h.a
          .attr('href', url)
          .attr('rel', external(url) ? 'noopener' : undefined)
          .attr('target', external(url) ? '_blank' : undefined)
          .children(...content),
      InlineCode: (h, { value }) => h.code.children(value),
      CodeBlock: (h, block) => {
        const language = Option.getOrNull(block.language)
        if (language === 'latex') return MathBlock(h, block.value)
        if (language === 'mermaid') return DiagramBlock(h, block.value)
        return h.pre.children(h.code.children(block.value))
      },
      Table: (h, _table, header, rows) =>
        h.div
          .class(
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
          )
          .children(
            h.table
              .class(
                css({
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 'type.14',
                  lineHeight: 'snug',
                }),
              )
              .children(
                h.thead.children(header),
                h.tbody
                  .class(
                    css({
                      '& > * + *': {
                        borderTopWidth: '1px',
                        borderTopStyle: 'solid',
                        borderColor: 'border',
                      },
                    }),
                  )
                  .children(...rows),
              ),
          ),
      TableCell: (h, _cell, content, alignment, isHeader) =>
        isHeader
          ? h.th
              .class(
                css({
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                  borderColor: 'border',
                  backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
                  paddingInline: '3',
                  paddingBlock: '2',
                  textAlign: alignment === 'Right' ? 'right' : 'left',
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                  color: 'mutedForeground',
                }),
              )
              .children(...content)
          : h.td
              .class(
                css({
                  paddingInline: '3',
                  paddingBlock: '2',
                  verticalAlign: 'top',
                  textAlign: alignment === 'Right' ? 'right' : undefined,
                }),
              )
              .children(...content),
    },
  }) as unknown as ReadonlyArray<View.Input<Msg, unknown>>
  return h.div.class(proseStyle).children(...blocks) as unknown as View.Content<Msg>
}

/** Headings for a document, keeping the English anchor of each translated heading. */
export const headingsOf = (
  document: Markdown.Document,
  anchors?: Anchors,
): ReadonlyArray<Heading> =>
  document.blocks.flatMap((block) => {
    if (block._tag !== 'Heading' || (block.level !== 2 && block.level !== 3)) return []
    return [
      {
        id: anchors?.get(block) ?? slug(plain(block.content)),
        text: plain(block.content),
        level: block.level,
      },
    ]
  })
