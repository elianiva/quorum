import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowUpRight, ChevronRight, Coffee, Pencil } from 'lucide'
import { FIGURE } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import { langOf } from '../i18n/lang.ts'
import { withLocale } from '../i18n/locale.ts'
import type { Message, Model } from '../main.ts'
import type { Page } from '../page.ts'
import { pageIn } from '../pages.ts'
import { eraPath } from '../reference/shared.ts'
import { KOFI, editUrl } from '../site.ts'
import { hides } from '../submodels/spoilers.ts'
import { pathBar, pathNext } from './path-nav.ts'
import { quadrantBadge } from './quadrant.ts'
import { css, cx } from '@quorum/styled-system/css'

/* One page: its header, its body (and facts beside it), and its footer. */

type H = HtmlBuilder<Message>

const breadcrumbs = (page: Page, h: H): Html => {
  const t = langOf(page.locale).t
  const parent = page.parent ? pageIn(page.locale, page.parent) : null
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1.5',
          fontSize: 'type.13',
          color: 'mutedForeground',
        }),
      ),
    ],
    [
      quadrantBadge(
        page.section,
        css({
          width: '4',
          height: '4',
        }),
        h,
      ),
      h.span([], [t.quadrants[page.section].label]),
      ...(parent
        ? [
            icon(
              h,
              ChevronRight,
              css({
                width: '3.5',
                height: '3.5',
                opacity: 0.6,
              }),
            ),
            h.a(
              [
                h.Href(parent.path),
                h.Class(
                  css({
                    _hover: {
                      color: 'foreground',
                    },
                  }),
                ),
              ],
              [parent.title],
            ),
          ]
        : []),
    ],
  )
}

/** Content from an Era the reader has not reached folds behind a toggle. */
const spoiler = (page: Page, model: Model, body: Html, h: H): Html => {
  if (!hides(model.spoilers, page.era)) return body
  const l = langOf(page.locale)
  return h.details(
    [h.Class('fold')],
    [
      h.summary(
        [
          h.Class(
            css({
              cursor: 'pointer',
              listStyleType: 'none',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'dashed',
              borderColor: 'border',
              paddingInline: '4',
              paddingBlock: '3',
              fontSize: 'type.14',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontWeight: 'medium',
                }),
              ),
            ],
            [l.t.article.spoilerAbout(l.cat.ERAS[page.era ?? 0]?.name ?? '')],
          ),
          h.span(
            [
              h.Class(
                css({
                  color: 'mutedForeground',
                }),
              ),
            ],
            [l.t.article.spoilerHidden],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              marginTop: '6',
            }),
          ),
        ],
        [body],
      ),
    ],
  )
}

const footer = (page: Page, h: H): Html => {
  const l = langOf(page.locale)
  const t = l.t.article
  const related = page.related.flatMap((path) => {
    const target = pageIn(page.locale, path)
    return target ? [target] : []
  })
  return h.footer(
    [
      h.Class(
        css({
          marginTop: '16',
        }),
      ),
    ],
    [
      related.length
        ? h.div(
            [
              h.Class(
                css({
                  marginBottom: '10',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      marginBottom: '3',
                      fontSize: 'type.13',
                      fontWeight: 'semibold',
                    }),
                  ),
                ],
                [t.seeAlso],
              ),
              h.ul(
                [
                  h.Class(
                    css({
                      '& > * + *': {
                        borderTopWidth: '1px',
                        borderTopStyle: 'solid',
                        borderColor: 'border',
                      },
                      borderTopWidth: '1px',
                      borderTopStyle: 'solid',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'border',
                    }),
                  ),
                ],
                related.map((target) =>
                  h.li(
                    [h.Key(target.path)],
                    [
                      h.a(
                        [
                          h.Href(target.path),
                          h.Class(
                            cx(
                              css({
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: '4',
                                paddingBlock: '2.5',
                              }),
                              'group',
                            ),
                          ),
                        ],
                        [
                          h.span(
                            [
                              h.Class(
                                css({
                                  flexShrink: '0',
                                  fontSize: 'type.14',
                                  fontWeight: 'medium',
                                  '.group:hover &': {
                                    textDecorationLine: 'underline',
                                  },
                                }),
                              ),
                            ],
                            [target.title],
                          ),
                          h.span(
                            [
                              h.Class(
                                css({
                                  minWidth: '0',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  fontSize: 'type.13',
                                  color: 'mutedForeground',
                                }),
                              ),
                            ],
                            [target.summary],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          )
        : h.empty,
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              columnGap: '5',
              rowGap: '3',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'border',
              paddingTop: '5',
              fontSize: 'type.12',
              color: 'mutedForeground',
            }),
          ),
        ],
        [
          page.source
            ? h.a(
                [
                  h.Href(editUrl(page.source)),
                  h.Class(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1.5',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  ),
                ],
                [
                  icon(
                    h,
                    Pencil,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                  t.editOnGitHub,
                ],
              )
            : h.empty,
          page.gdd
            ? h.a(
                [
                  h.Href(page.gdd),
                  h.Class(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  ),
                ],
                [
                  t.designNotes,
                  icon(
                    h,
                    ArrowUpRight,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                ],
              )
            : h.empty,
          h.a(
            [
              h.Href(KOFI),
              h.Class(
                css({
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '1.5',
                  _hover: {
                    color: 'foreground',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                Coffee,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              t.support,
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  marginLeft: 'auto',
                }),
              ),
            ],
            [
              t.disclaimerLead,
              h.a(
                [
                  h.Href('/about/disclaimer'),
                  h.Class(
                    css({
                      textDecorationLine: 'underline',
                      textUnderlineOffset: '2px',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  ),
                ],
                [t.disclaimerLink],
              ),
              t.disclaimerMid,
              h.a(
                [
                  h.Href('/about/changelog'),
                  h.Class(
                    css({
                      textDecorationLine: 'underline',
                      textUnderlineOffset: '2px',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  ),
                ],
                [t.changelogLink],
              ),
              l.t.reference.sentenceEnd,
            ],
          ),
        ],
      ),
    ],
  )
}

/** A page of another language that waits for its translation says so, and its text keeps its own language. */
const notice = (page: Page, h: H): Html =>
  page.fallback
    ? h.p(
        [
          h.Role('note'),
          h.Class(
            css({
              marginBottom: '6',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'dashed',
              borderColor: 'border',
              paddingInline: '4',
              paddingBlock: '2.5',
              fontSize: 'type.13',
              color: 'mutedForeground',
            }),
          ),
        ],
        [langOf(page.locale).t.article.untranslated],
      )
    : h.empty

export const article = (page: Page, model: Model, h: H): Html => {
  const l = langOf(page.locale)
  return h.main(
    [
      // A wide page spans the frame; every other page fills its column.
      h.Class(
        cx(
          css({
            minWidth: '0',
            paddingBlock: '8',
          }),
          page.wide &&
            css({
              gridColumn: '1 / -1',
            }),
        ),
      ),
      h.DataAttribute('kind', page.section),
    ],
    [
      h.header(
        [
          h.Class(
            css({
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'border',
              paddingBottom: '8',
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
                  justifyContent: 'space-between',
                  gap: '4',
                }),
              ),
            ],
            [
              breadcrumbs(page, h),
              page.era !== null
                ? h.a(
                    [
                      h.Href(eraPath(page.era)),
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.12',
                            color: 'mutedForeground',
                            _hover: {
                              color: 'foreground',
                            },
                          }),
                        ),
                      ),
                    ],
                    [l.t.article.era(page.era, l.cat.ERAS[page.era]?.name ?? '')],
                  )
                : h.empty,
            ],
          ),
          h.h1(
            [
              h.Class(
                css({
                  marginTop: '4',
                  textStyle: 'pageTitle',
                  textWrap: 'balance',
                }),
              ),
            ],
            [page.title],
          ),
          h.p(
            [
              h.Class(
                css({
                  marginTop: '2',
                  fontSize: 'type.16',
                  lineHeight: 'relaxed',
                  textWrap: 'pretty',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [page.summary],
          ),
          pathBar(page, model, h),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              paddingTop: '8',
            }),
          ),
        ],
        [
          notice(page, h),
          // The text of a page that waits for its translation is English.
          page.fallback
            ? h.div([h.Attribute('lang', 'en')], [spoiler(page, model, page.body(model, h), h)])
            : spoiler(page, model, page.body(model, h), h),
          pathNext(page, h),
          footer(page, h),
        ],
      ),
    ],
  )
}

export const notFound = (model: Model, h: H): Html => {
  const t = langOf(model.locale).t.article.notFound
  return h.main(
    [
      h.Class(
        css({
          paddingBlock: '16',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.13',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        ['404'],
      ),
      h.h1(
        [
          h.Class(
            css({
              marginTop: '2',
              textStyle: 'pageTitle',
            }),
          ),
        ],
        [t.heading],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '2',
              fontSize: 'type.15',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.body(withLocale(model.locale, model.path))],
      ),
      h.a(
        [
          h.Href('/'),
          h.Class(
            css({
              marginTop: '6',
              display: 'inline-block',
              fontSize: 'type.14',
              fontWeight: 'medium',
              textDecorationLine: 'underline',
              textUnderlineOffset: '4px',
            }),
          ),
        ],
        [t.home],
      ),
    ],
  )
}
