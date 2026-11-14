import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowUpRight, Menu, X } from 'lucide'
import { githubMark } from '@quorum/ui/primitives/github'
import { icon } from '@quorum/ui/primitives/icon'
import { rootBuilder } from '../i18n/builder.ts'
import { langOf, type Lang } from '../i18n/lang.ts'
import { LOCALES, LOCALE_NAMES, LOCALE_TAGS, withLocale } from '../i18n/locale.ts'
import { Message, type Model } from '../main.ts'
import { SECTION_ORDER, navOf, pageIn } from '../pages.ts'
import { QUADRANTS } from './quadrant.ts'
import { GAME_ORIGIN, REPOSITORY } from '../site.ts'
import * as Search from '../submodels/search.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The header bar: the wordmark, the search, the language switcher, and Play. */

type H = HtmlBuilder<Message>

/** The Quorum q, as on the favicon. */
export const mark = (h: H): Html =>
  h.svg(
    [
      h.AriaHidden(true),
      h.ViewBox('0 0 64 64'),
      h.Class(
        css({
          width: '1.75rem',
          height: '1.75rem',
          flexShrink: '0',
        }),
      ),
    ],
    [
      h.rect([h.Width('64'), h.Height('64'), h.Rx('14'), h.Fill('#141517')], []),
      h.g(
        [h.Transform('translate(18.5 9.5) scale(0.24)')],
        [
          h.path(
            [
              h.D('M89 11V150M50 11a39 39 0 1 0 0.01 0'),
              h.Fill('none'),
              h.Stroke('#eaebec'),
              h.StrokeWidth('22'),
            ],
            [],
          ),
          h.circle([h.Cx('89'), h.Cy('180'), h.R('14'), h.Fill('#58cef8')], []),
        ],
      ),
    ],
  )

/** Every language the wiki has, with the current one marked. A link, so the page loads whole in its
    language; the current language is a label, since it already is the page. */
const switcher = (model: Model, l: Lang, h: H): Html =>
  h.nav(
    [
      h.Key('language'),
      h.AriaLabel(l.t.header.language),
      h.Class(
        css({
          display: 'flex',
          height: '2rem',
          flexShrink: '0',
          alignItems: 'center',
          gap: '0.125rem',
          borderRadius: 'md',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'var(--border)',
          padding: '0.125rem',
        }),
      ),
    ],
    LOCALES.map((locale) => {
      const tag = LOCALE_TAGS[locale].lang
      const current = locale === model.locale
      const look = cx(
        css({
          display: 'grid',
          height: '100%',
          minWidth: '1.5rem',
          placeItems: 'center',
          borderRadius: '0.25rem',
          paddingInline: '0.25rem',
          fontSize: '11px',
          fontWeight: '600',
          textTransform: 'uppercase',
        }),
        current
          ? css({
              backgroundColor: 'var(--foreground)',
              color: 'var(--background)',
            })
          : css({
              color: 'var(--muted-foreground)',
              _hover: {
                color: 'var(--foreground)',
              },
            }),
      )
      return current
        ? h.span([h.Key(locale), h.AriaCurrent('page'), h.Class(look)], [tag])
        : h.a(
            [
              h.Key(locale),
              // The builder that points links into the page's language would point this one back.
              rootBuilder(h).Href(withLocale(locale, model.path)),
              h.Attribute('hreflang', tag),
              h.Attribute('lang', tag),
              h.Title(l.t.header.switchTo(LOCALE_NAMES[locale])),
              h.Class(look),
            ],
            [tag],
          )
    }),
  )

export const header = (model: Model, h: H): Html => {
  const l = langOf(model.locale)
  return h.header(
    [
      h.Class(
        css({
          position: 'sticky',
          top: '0',
          zIndex: '40',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'var(--border)',
          backgroundColor: 'var(--background)',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              marginInline: 'auto',
              display: 'flex',
              height: '3.5rem',
              maxWidth: '80rem',
              alignItems: 'center',
              gap: '0.75rem',
              paddingInline: '1rem',
              sm: {
                paddingInline: '1.5rem',
              },
            }),
          ),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaLabel(model.menu ? l.t.header.closeMenu : l.t.header.openMenu),
              h.AriaExpanded(model.menu),
              h.Class(
                css({
                  marginLeft: '-0.25rem',
                  display: 'grid',
                  width: '2.25rem',
                  height: '2.25rem',
                  placeItems: 'center',
                  borderRadius: 'md',
                  color: 'var(--muted-foreground)',
                  _hover: {
                    color: 'var(--foreground)',
                  },
                  lg: {
                    display: 'none',
                  },
                }),
              ),
              h.OnClick(Message.MenuToggled()),
            ],
            [
              icon(
                h,
                model.menu ? X : Menu,
                css({
                  width: '18px',
                  height: '18px',
                }),
              ),
            ],
          ),
          h.a(
            [
              h.Href('/'),
              h.Class(
                css({
                  display: 'flex',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '0.5rem',
                  paddingRight: '0.25rem',
                  sm: {
                    paddingRight: '0.75rem',
                  },
                }),
              ),
            ],
            [
              mark(h),
              h.span(
                [
                  h.Class(
                    css({
                      display: 'none',
                      fontSize: '15px',
                      fontWeight: '600',
                      letterSpacing: '-0.025em',
                      '@media (min-width: 430px)': {
                        display: 'inline',
                      },
                    }),
                  ),
                ],
                ['Quorum'],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      display: 'none',
                      fontSize: '15px',
                      color: 'var(--muted-foreground)',
                      sm: {
                        display: 'inline',
                      },
                    }),
                  ),
                ],
                [l.t.header.wordmarkWiki],
              ),
            ],
          ),
          h.submodel({
            slotId: 'search',
            model: model.search,
            view: Search.view,
            toParentMessage: (message) => Message.SearchChanged({ message }),
          }),
          h.div(
            [
              h.Class(
                css({
                  display: 'none',
                  flex: '1 1 0%',
                  sm: {
                    display: 'block',
                  },
                }),
              ),
            ],
            [],
          ),
          switcher(model, l, h),
          h.a(
            [
              h.Href(REPOSITORY),
              h.Title(l.t.header.github),
              h.AriaLabel(l.t.header.github),
              h.Class(
                css({
                  display: 'none',
                  height: '2rem',
                  width: '2rem',
                  flexShrink: '0',
                  placeItems: 'center',
                  borderRadius: 'md',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'var(--border)',
                  color: 'var(--muted-foreground)',
                  _hover: {
                    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                    color: 'var(--foreground)',
                  },
                  sm: {
                    display: 'grid',
                  },
                }),
              ),
            ],
            [
              githubMark(
                h,
                css({
                  width: '17px',
                  height: '17px',
                }),
              ),
            ],
          ),
          h.a(
            [
              h.Href(GAME_ORIGIN),
              h.Class(
                css({
                  display: 'flex',
                  height: '2rem',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '0.25rem',
                  borderRadius: 'md',
                  backgroundColor: 'var(--foreground)',
                  paddingInline: '0.75rem',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: 'var(--background)',
                  _hover: {
                    opacity: 0.9,
                  },
                }),
              ),
            ],
            [
              l.t.header.play,
              icon(
                h,
                ArrowUpRight,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
                }),
              ),
            ],
          ),
        ],
      ),
      sections(model, l, h),
    ],
  )
}

/** The section bar: each kind of page links to its first page. The sidebar lists only the current one. */
const sections = (model: Model, l: Lang, h: H): Html => {
  const current = model.path === '/' ? null : (pageIn(model.locale, model.path)?.section ?? null)
  return h.nav(
    [h.AriaLabel(l.t.header.sections)],
    [
      h.div(
        [
          h.Class(
            css({
              marginInline: 'auto',
              display: 'flex',
              height: '2.75rem',
              maxWidth: '80rem',
              alignItems: 'stretch',
              gap: '1.5rem',
              overflowX: 'auto',
              paddingInline: '1rem',
              sm: {
                paddingInline: '1.5rem',
              },
              scrollbarWidth: 'none',
              '@media (max-width: 1023px)': {
                maskImage: 'linear-gradient(to right,#000 85%,transparent)',
              },
            }),
          ),
        ],
        SECTION_ORDER.flatMap((section) => {
          const first = navOf(model.locale, section)[0]
          if (!first) return []
          return [
            h.a(
              [
                h.Key(section),
                h.Href(first.path),
                ...(section === current ? [h.AriaCurrent('true')] : []),
                h.Class(
                  cx(
                    css({
                      display: 'flex',
                      flexShrink: '0',
                      alignItems: 'center',
                      gap: '0.5rem',
                      borderBottomWidth: '2px',
                      borderBottomStyle: 'solid',
                      fontSize: '14px',
                      transitionProperty:
                        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                      transitionDuration: '150ms',
                      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                    }),
                    section === current
                      ? css({
                          borderColor: 'var(--foreground)',
                          fontWeight: '500',
                          color: 'var(--foreground)',
                        })
                      : css({
                          borderColor: 'transparent',
                          color: 'var(--muted-foreground)',
                          _hover: {
                            color: 'var(--foreground)',
                          },
                        }),
                  ),
                ),
              ],
              [
                icon(
                  h,
                  QUADRANTS[section].icon,
                  css({
                    width: '1rem',
                    height: '1rem',
                  }),
                ),
                l.t.quadrants[section].label,
              ],
            ),
          ]
        }),
      ),
    ],
  )
}
