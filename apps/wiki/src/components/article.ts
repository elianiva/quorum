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
import { css, cx, cx as cn } from '@quorum/styled-system/css'

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
          gap: '0.375rem',
          fontSize: '13px',
          color: 'var(--muted-foreground)',
        }),
      ),
    ],
    [
      quadrantBadge(
        page.section,
        css({
          width: '1rem',
          height: '1rem',
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
                width: '0.875rem',
                height: '0.875rem',
                opacity: 0.6,
              }),
            ),
            h.a(
              [
                h.Href(parent.path),
                h.Class(
                  css({
                    _hover: {
                      color: 'var(--foreground)',
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
              borderColor: 'var(--border)',
              paddingInline: '1rem',
              paddingBlock: '0.75rem',
              fontSize: '14px',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontWeight: '500',
                }),
              ),
            ],
            [l.t.article.spoilerAbout(l.cat.ERAS[page.era ?? 0]?.name ?? '')],
          ),
          h.span(
            [
              h.Class(
                css({
                  color: 'var(--muted-foreground)',
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
              marginTop: '1.5rem',
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
          marginTop: '4rem',
        }),
      ),
    ],
    [
      related.length
        ? h.div(
            [
              h.Class(
                css({
                  marginBottom: '2.5rem',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      marginBottom: '0.75rem',
                      fontSize: '13px',
                      fontWeight: '600',
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
                        borderColor: 'var(--border)',
                      },
                      borderTopWidth: '1px',
                      borderTopStyle: 'solid',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'var(--border)',
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
                                gap: '1rem',
                                paddingBlock: '0.625rem',
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
                                  fontSize: '14px',
                                  fontWeight: '500',
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
                                  fontSize: '13px',
                                  color: 'var(--muted-foreground)',
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
              columnGap: '1.25rem',
              rowGap: '0.75rem',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'var(--border)',
              paddingTop: '1.25rem',
              fontSize: '12px',
              color: 'var(--muted-foreground)',
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
                      gap: '0.375rem',
                      _hover: {
                        color: 'var(--foreground)',
                      },
                    }),
                  ),
                ],
                [
                  icon(
                    h,
                    Pencil,
                    css({
                      width: '0.875rem',
                      height: '0.875rem',
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
                      gap: '0.25rem',
                      _hover: {
                        color: 'var(--foreground)',
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
                      width: '0.875rem',
                      height: '0.875rem',
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
                  gap: '0.375rem',
                  _hover: {
                    color: 'var(--foreground)',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                Coffee,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
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
                        color: 'var(--foreground)',
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
                        color: 'var(--foreground)',
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
              marginBottom: '1.5rem',
              borderRadius: 'md',
              borderWidth: '1px',
              borderStyle: 'dashed',
              borderColor: 'var(--border)',
              paddingInline: '1rem',
              paddingBlock: '0.625rem',
              fontSize: '13px',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [langOf(page.locale).t.article.untranslated],
      )
    : h.empty

export const article = (page: Page, model: Model, h: H): Html => {
  const l = langOf(page.locale)
  return h.article(
    [
      // A wide page spans the frame; every other page fills its column.
      h.Class(
        cn(
          css({
            minWidth: '0',
            paddingBlock: '2rem',
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
              borderColor: 'var(--border)',
              paddingBottom: '2rem',
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
                  gap: '1rem',
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
                        cn(
                          FIGURE,
                          css({
                            fontSize: '12px',
                            color: 'var(--muted-foreground)',
                            _hover: {
                              color: 'var(--foreground)',
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
                  marginTop: '1rem',
                  fontSize: '32px',
                  lineHeight: '1.25',
                  fontWeight: '600',
                  letterSpacing: '-0.025em',
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
                  marginTop: '0.5rem',
                  fontSize: '16px',
                  lineHeight: '1.625',
                  textWrap: 'pretty',
                  color: 'var(--muted-foreground)',
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
              paddingTop: '2rem',
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
  return h.article(
    [
      h.Class(
        css({
          paddingBlock: '4rem',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cn(
              FIGURE,
              css({
                fontSize: '13px',
                color: 'var(--muted-foreground)',
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
              marginTop: '0.5rem',
              fontSize: '32px',
              fontWeight: '600',
              letterSpacing: '-0.025em',
            }),
          ),
        ],
        [t.heading],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '0.5rem',
              fontSize: '15px',
              color: 'var(--muted-foreground)',
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
              marginTop: '1.5rem',
              display: 'inline-block',
              fontSize: '14px',
              fontWeight: '500',
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
