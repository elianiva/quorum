import type { Html, HtmlBuilder } from 'foldkit/html'
import { ERAS, type BuildGroup, type ResearchId } from '@quorum/simulation/catalog'
import { FIGURE } from '@quorum/ui/game/bits'
import { localeOf } from '../i18n/builder.ts'
import { langOf, type Lang, type Title } from '../i18n/lang.ts'
import type { Message } from '../main.ts'
import { proseAt } from '../content.ts'
import { headingsOf, prose } from '../prose.ts'
import { slug, type Heading, type Page, type View } from '../page.ts'
import { css, cx } from '@quorum/styled-system/css'

export type { Lang, Title }

export type H = HtmlBuilder<Message>

export const eraName = (l: Lang, era: number): string =>
  l.cat.ERAS[era]?.name ?? l.t.reference.eraN(era)

/** An Era's page path uses its English name in every language, so the slugs are the same. */
export const eraPath = (era: number): string => `/eras/${slug(ERAS[era]?.name ?? `Era ${era}`)}`

export const researchPath = (id: ResearchId): string => `/research/${id}`

export const termPath = (id: string): string => `/glossary/${id}`

export const termName = (l: Lang, id: string): string =>
  l.cat.GLOSSARY.find((entry) => entry.id === id)?.term ?? id

/** A heading whose anchor is the slug of its English text, whatever language its text is in. */
export const titleOf = (english: string, text: string): Title => ({ id: slug(english), text })

export const link = (path: string, text: string, h: H): Html =>
  h.a(
    [
      h.Href(path),
      h.Class(
        css({
          textDecorationLine: 'underline',
          textDecorationColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
          textUnderlineOffset: '3px',
          _hover: {
            textDecorationColor: 'var(--foreground)',
          },
        }),
      ),
    ],
    [text],
  )

export const researchLink = (l: Lang, id: ResearchId, h: H): Html =>
  link(researchPath(id), l.cat.RESEARCH[id].name, h)

/** Links separated by commas, or a dash when there are none. */
export const linkList = (items: ReadonlyArray<Html>, h: H): Html => {
  const separator = langOf(localeOf(h)).t.reference.listSeparator
  return items.length === 0
    ? h.span(
        [
          h.Class(
            css({
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        ['—'],
      )
    : h.span(
        [],
        items.flatMap((item, index) => (index === 0 ? [item] : [separator, item])),
      )
}

export type Fact = Readonly<{ name: string; value: Html | string }>

/** The facts box beside a page: the name with its mark, then one fact per row. */
export const factsBox = (
  l: Lang,
  title: string,
  badge: Html | null,
  _group: BuildGroup | null,
  facts: ReadonlyArray<Fact>,
  h: H,
): Html =>
  h.aside(
    [
      h.AriaLabel(l.t.reference.factsLabel(title)),
      h.Class(
        css({
          borderRadius: 'lg',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--border)',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'var(--border)',
              paddingInline: '1rem',
              paddingBlock: '0.75rem',
            }),
          ),
        ],
        [
          badge ?? h.empty,
          h.span(
            [
              h.Class(
                css({
                  fontSize: '14px',
                  fontWeight: '600',
                }),
              ),
            ],
            [title],
          ),
        ],
      ),
      h.dl(
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
        facts.map((fact) =>
          h.div(
            [
              h.Key(fact.name),
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  paddingInline: '1rem',
                  paddingBlock: '0.5rem',
                }),
              ),
            ],
            [
              h.dt(
                [
                  h.Class(
                    css({
                      flexShrink: '0',
                      fontSize: '13px',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [fact.name],
              ),
              h.dd(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        minWidth: '0',
                        textAlign: 'right',
                        fontSize: '12px',
                        overflowWrap: 'anywhere',
                      }),
                    ),
                  ),
                ],
                [fact.value],
              ),
            ],
          ),
        ),
      ),
    ],
  )

/** A titled section of a catalog page, with an anchor the contents list links to. */
export const section = (title: Title, content: ReadonlyArray<Html>, h: H): Html =>
  h.section(
    [h.Key(title.id)],
    [
      h.h2(
        [h.Id(title.id), h.Class('group')],
        [title.text, h.a([h.Href(`#${title.id}`), h.Class('anchor')], ['#'])],
      ),
      ...content,
    ],
  )

export const headingsFor = (titles: ReadonlyArray<Title | null>): ReadonlyArray<Heading> =>
  titles.flatMap((title) => (title ? [{ id: title.id, text: title.text, level: 2 as const }] : []))

export const paragraph = (text: string, h: H): Html => h.p([], [text])

/** Engineering terms a page teaches, as links into the glossary. */
export const termsSection = (l: Lang, ids: ReadonlyArray<string> | undefined, h: H): Html =>
  ids && ids.length
    ? section(
        l.title('engineeringTerms'),
        [
          h.ul(
            [],
            ids.map((id) => h.li([h.Key(id)], [link(termPath(id), termName(l, id), h)])),
          ),
        ],
        h,
      )
    : h.empty

/** The hand-written prose for a catalog page, if any, and its source file for editing. */
export const authored = (
  l: Lang,
  path: string,
): Readonly<{
  view: View | null
  source: string | null
  text: string
  headings: ReadonlyArray<Heading>
  fallback: boolean
}> => {
  const found = proseAt(l.locale, path)
  if (!found) return { view: null, source: null, text: '', headings: [], fallback: false }
  const anchors = found.anchors ?? undefined
  return {
    view: (model, h) => prose(found.document, model, h, anchors),
    source: found.source,
    text: found.text,
    headings: headingsOf(found.document, anchors),
    fallback: found.fallback,
  }
}

/** A tile on a hub page: mark, title, a line of facts, and the summary. */
export const hubCard = (page: Page, mark: Html, meta: string, h: H): Html =>
  h.a(
    [
      h.Key(page.path),
      h.Href(page.path),
      h.Class(
        cx(
          css({
            display: 'flex',
            gap: '0.75rem',
            backgroundColor: 'var(--background)',
            padding: '1rem',
            transitionProperty:
              'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
            transitionDuration: '150ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
            _hover: {
              backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
            },
          }),
          'group',
        ),
      ),
    ],
    [
      mark,
      h.div(
        [
          h.Class(
            css({
              minWidth: '0',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: '14px',
                      fontWeight: '500',
                    }),
                  ),
                ],
                [page.title],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '12px',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [meta],
              ),
            ],
          ),
          h.p(
            [
              h.Class(
                css({
                  marginTop: '0.125rem',
                  lineClamp: '2',
                  fontSize: '13px',
                  lineHeight: '1.375',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [page.summary],
          ),
        ],
      ),
    ],
  )

export type Cell = Html | string

/** A table in the same nested style as a Markdown table. Columns after the first that hold figures align right. */
export const table = (
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<Readonly<{ key: string; cells: ReadonlyArray<Cell> }>>,
  h: H,
  figures: ReadonlyArray<number> = [],
): Html =>
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
          h.thead(
            [],
            [
              h.tr(
                [],
                headers.map((header, index) =>
                  h.th(
                    [
                      h.Key(header),
                      h.Class(
                        cx(
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
                            whiteSpace: 'nowrap',
                            color: 'var(--muted-foreground)',
                          }),
                          figures.includes(index) &&
                            css({
                              textAlign: 'right',
                            }),
                        ),
                      ),
                    ],
                    [header],
                  ),
                ),
              ),
            ],
          ),
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
            rows.map((row) =>
              h.tr(
                [h.Key(row.key)],
                row.cells.map((cell, index) =>
                  h.td(
                    [
                      h.Class(
                        cx(
                          css({
                            paddingInline: '0.75rem',
                            paddingBlock: '0.5rem',
                            verticalAlign: 'top',
                          }),
                          figures.includes(index) &&
                            cx(
                              FIGURE,
                              css({
                                textAlign: 'right',
                                fontSize: '12px',
                                whiteSpace: 'nowrap',
                              }),
                            ),
                        ),
                      ),
                    ],
                    [cell],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    ],
  )

export const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

/** Tiles in a grid, separated by hairlines. */
export const cardGrid = (cards: ReadonlyArray<Html>, h: H): Html =>
  h.div(
    [
      h.Class(
        cx(
          css({
            marginBlock: '1.5rem',
            display: 'grid',
            gap: '1px',
            overflow: 'hidden',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            backgroundColor: 'var(--border)',
            sm: {
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              '& > :last-child:nth-child(odd)': {
                gridColumn: 'span 2 / span 2',
              },
            },
          }),
          'not-prose',
        ),
      ),
    ],
    cards,
  )

/** A page's defaults, so each generator states only what differs. */
export const page = (
  l: Lang,
  fields: Partial<Page> & Pick<Page, 'path' | 'title' | 'summary' | 'body'>,
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
  aside: null,
  related: [],
  text: '',
  ...fields,
})
