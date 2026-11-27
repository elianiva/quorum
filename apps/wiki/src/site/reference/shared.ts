import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { ERAS, type BuildGroup, type ResearchId } from '@quorum/simulation/catalog'
import { css, cx } from '@quorum/styled-system/css'
import { FIGURE } from '@quorum/ui/game/bits'
import { langOf, type Lang, type Title } from '../../i18n/lang.ts'
import { proseAt } from '../content.ts'
import type { Heading, Page, PageKind } from '../page.ts'
import { slug } from '../page.ts'

export type { Lang, Title }

export const eraName = (l: Lang, era: number): string =>
  l.cat.ERAS[era]?.name ?? l.t.reference.eraN(era)

export const eraPath = (era: number): string => `/eras/${slug(ERAS[era]?.name ?? `Era ${era}`)}`

export const researchPath = (id: ResearchId): string => `/research/${id}`

export const termPath = (id: string): string => `/glossary/${id}`

export const termName = (l: Lang, id: string): string =>
  l.cat.GLOSSARY.find((entry) => entry.id === id)?.term ?? id

export const titleOf = (english: string, text: string): Title => ({ id: slug(english), text })

export const link = <Msg>(path: string, text: string, h: H<Msg>): View.Content<Msg> =>
  h.a
    .attr('href', path)
    .class(
      css({
        textDecorationLine: 'underline',
        textDecorationColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
        textUnderlineOffset: '3px',
        _hover: { textDecorationColor: 'foreground' },
      }),
    )
    .children(text)

export const researchLink = <Msg>(l: Lang, id: ResearchId, h: H<Msg>): View.Content<Msg> =>
  link(researchPath(id), l.cat.RESEARCH[id].name, h)

export const linkList = <Msg>(
  l: Lang,
  items: ReadonlyArray<View.Content<Msg>>,
  h: H<Msg>,
): View.Content<Msg> => {
  const separator = l.t.reference.listSeparator
  return items.length === 0
    ? h.span.class(css({ color: 'mutedForeground' })).children('—')
    : h.span.children(...items.flatMap((item, index) => (index === 0 ? [item] : [separator, item])))
}

export type Fact<Msg> = Readonly<{ name: string; value: View.Content<Msg> | string }>

export const factsBox = <Msg>(
  l: Lang,
  title: string,
  badge: View.Content<Msg> | null,
  _group: BuildGroup | null,
  facts: ReadonlyArray<Fact<Msg>>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.aside
    .attr('aria-label', l.t.reference.factsLabel(title))
    .class(
      css({
        borderRadius: 'lg',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'border',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2.5',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'border',
            paddingInline: '4',
            paddingBlock: '3',
          }),
        )
        .children(
          badge ?? h.span.children(),
          h.span.class(css({ fontSize: 'type.14', fontWeight: 'semibold' })).children(title),
        ),
      h.dl
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
          ...facts.map((fact, index) =>
            h.div
              .key(String(index))
              .class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '3',
                  paddingInline: '4',
                  paddingBlock: '2',
                }),
              )
              .children(
                h.dt
                  .class(css({ flexShrink: '0', fontSize: 'type.13', color: 'mutedForeground' }))
                  .children(fact.name),
                h.dd
                  .class(
                    cx(
                      FIGURE,
                      css({
                        minWidth: '0',
                        textAlign: 'right',
                        fontSize: 'type.12',
                        overflowWrap: 'anywhere',
                      }),
                    ),
                  )
                  .children(fact.value),
              ),
          ),
        ),
    )

export const section = <Msg>(
  title: Title,
  content: ReadonlyArray<View.Content<Msg>>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.section.key(title.id).children(
    h.h2
      .attr('id', title.id)
      .class('group')
      .children(title.text, h.a.attr('href', `#${title.id}`).class('anchor').children('#')),
    ...content,
  )

export const headingsFor = (titles: ReadonlyArray<Title | null>): ReadonlyArray<Heading> =>
  titles.flatMap((title) => (title ? [{ id: title.id, text: title.text, level: 2 as const }] : []))

export const paragraph = <Msg>(text: string, h: H<Msg>): View.Content<Msg> => h.p.children(text)

export const termsSection = <Msg>(
  l: Lang,
  ids: ReadonlyArray<string> | undefined,
  h: H<Msg>,
): View.Content<Msg> =>
  ids && ids.length
    ? section(
        l.title('engineeringTerms'),
        [
          h.ul.children(
            ...ids.map((id) => h.li.key(id).children(link(termPath(id), termName(l, id), h))),
          ),
        ],
        h,
      )
    : h.span.children()

export const authored = (locale: Lang['locale'], path: string) => {
  const found = proseAt(locale, path)
  return found === null
    ? { prose: null, source: null, text: '', headings: [], fallback: false }
    : {
        prose: found,
        source: found.source,
        text: found.text,
        headings: found.headings,
        fallback: found.fallback,
      }
}

export const hubCard = <Msg>(
  page: Page,
  mark: View.Content<Msg>,
  meta: string,
  h: H<Msg>,
): View.Content<Msg> =>
  h.a
    .key(page.path)
    .attr('href', page.path)
    .class(
      cx(
        css({
          display: 'flex',
          gap: '3',
          backgroundColor: 'background',
          padding: '4',
          transitionProperty:
            'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'default',
          _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
        }),
        'group',
      ),
    )
    .children(
      mark,
      h.div.class(css({ minWidth: '0' })).children(
        h.div.class(css({ display: 'flex', alignItems: 'baseline', gap: '2' })).children(
          h.span.class(css({ fontSize: 'type.14', fontWeight: 'medium' })).children(page.title),
          h.span
            .class(
              css({
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.12',
                color: 'mutedForeground',
              }),
            )
            .children(meta),
        ),
        h.p
          .class(
            css({
              marginTop: '0.5',
              lineClamp: '2',
              fontSize: 'type.13',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(page.summary),
      ),
    )

export type Cell<Msg> = View.Content<Msg> | string

export const table = <Msg>(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<Readonly<{ key: string; cells: ReadonlyArray<Cell<Msg>> }>>,
  h: H<Msg>,
  figures: ReadonlyArray<number> = [],
): View.Content<Msg> =>
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
              ...headers.map((header, index) =>
                h.th
                  .key(String(index))
                  .class(
                    cx(
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
                      figures.includes(index) && css({ textAlign: 'right' }),
                    ),
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
              ...rows.map((row) =>
                h.tr.key(row.key).children(
                  ...row.cells.map((cell, index) =>
                    h.td
                      .class(
                        cx(
                          css({ paddingInline: '3', paddingBlock: '2', verticalAlign: 'top' }),
                          figures.includes(index) &&
                            cx(
                              FIGURE,
                              css({
                                textAlign: 'right',
                                fontSize: 'type.12',
                                whiteSpace: 'nowrap',
                              }),
                            ),
                        ),
                      )
                      .children(cell),
                  ),
                ),
              ),
            ),
        ),
    )

export const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

export const cardGrid = <Msg>(
  cards: ReadonlyArray<View.Content<Msg>>,
  h: H<Msg>,
): View.Content<Msg> =>
  h.div
    .class(
      cx(
        css({
          marginBlock: '6',
          display: 'grid',
          gap: '0.25',
          overflow: 'hidden',
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          backgroundColor: 'border',
          sm: {
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            '& > :last-child:nth-child(odd)': { gridColumn: 'span 2 / span 2' },
          },
        }),
        'not-prose',
      ),
    )
    .children(...cards)

export const page = (
  l: Lang,
  fields: Partial<Page> & Pick<Page, 'kind' | 'path' | 'title' | 'summary'>,
): Page => ({
  locale: l.locale,
  fallback: false,
  section: 'reference',
  parent: null,
  group: null,
  order: 100,
  era: null,
  aliases: [],
  source: null,
  gdd: null,
  headings: [],
  wide: false,
  body: null,
  aside: null,
  related: [],
  text: '',
  ...fields,
})

export const langOfPage = (page: Page): Lang => langOf(page.locale)

export const kinds = (
  l: Lang,
  list: ReadonlyArray<keyof Lang['cat']['KINDS']>,
  everyKind: string,
): string =>
  list.length === 0
    ? '—'
    : list.map((kind) => l.cat.KINDS[kind].label).join(', ') === ''
      ? everyKind
      : list.map((kind) => l.cat.KINDS[kind].label).join(', ')

export type PageKindName = PageKind
