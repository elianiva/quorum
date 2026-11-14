import type { Html, HtmlBuilder } from 'foldkit/html'
import { ArrowUpRight, Check, ChevronDown, Globe, Menu, Moon, Sun, X } from 'lucide'
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
          width: '7',
          height: '7',
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

/** The languages the wiki has, as a menu. A phone shows the current code, a desktop the full name. */
const languageSummary = css({
  display: 'flex',
  height: '8',
  width: '8',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1.5',
  cursor: 'pointer',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  color: 'mutedForeground',
  transitionProperty:
    'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  _hover: {
    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
    color: 'foreground',
  },
  sm: {
    width: 'auto',
    paddingInline: '2.5',
  },
})
const languageMenu = css({
  position: 'absolute',
  top: 'calc(100% + 6px)',
  right: '0',
  zIndex: '50',
  minWidth: '12rem',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundColor: 'popover',
  boxShadow: 'float',
  padding: '1',
})
const languageBackdrop = css({
  position: 'fixed',
  inset: '0',
  zIndex: '40',
  cursor: 'default',
})
const languageItem = css({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '3',
  borderRadius: 'md',
  paddingInline: '2',
  paddingBlock: '2',
  color: 'foreground',
  fontSize: 'type.13',
  _hover: { backgroundColor: 'muted' },
})
const languageCode = css({
  fontFamily: 'mono',
  fontSize: 'type.11',
  color: 'mutedForeground',
})

export const languageSwitcher = (model: Model, l: Lang, h: H): Html =>
  h.nav(
    [
      h.Key('language'),
      h.AriaLabel(l.t.header.language),
      h.Class(css({ position: 'relative', flexShrink: '0' })),
    ],
    [
      h.button(
        [
          h.Type('button'),
          h.Title(l.t.header.language),
          h.AriaLabel(l.t.header.language),
          h.AriaHasPopup('menu'),
          h.AriaExpanded(model.languageMenu),
          h.AriaControls('language-menu'),
          h.OnClick(Message.LanguageMenuToggled()),
          h.Class(languageSummary),
        ],
        [
          icon(
            h,
            Globe,
            css({
              display: 'none',
              width: '4',
              height: '4',
              flexShrink: '0',
              sm: { display: 'block' },
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.11',
                  fontWeight: 'semibold',
                  textTransform: 'uppercase',
                  sm: { display: 'none' },
                }),
              ),
            ],
            [LOCALE_TAGS[model.locale].lang],
          ),
          h.span(
            [
              h.Class(
                css({
                  display: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                  sm: { display: 'inline' },
                }),
              ),
            ],
            [LOCALE_NAMES[model.locale]],
          ),
          icon(
            h,
            ChevronDown,
            css({
              display: 'none',
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              sm: { display: 'block' },
            }),
          ),
        ],
      ),
      // A click anywhere else, or Escape, closes the menu.
      model.languageMenu
        ? h.div(
            [
              h.Key('language-dismiss'),
              h.AriaHidden(true),
              h.OnClick(Message.LanguageMenuClosed()),
              h.Class(languageBackdrop),
            ],
            [],
          )
        : h.empty,
      model.languageMenu
        ? h.div(
            [
              h.Id('language-menu'),
              h.Role('menu'),
              h.AriaLabel(l.t.header.language),
              h.Class(languageMenu),
            ],
            LOCALES.map((locale) => {
              const tag = LOCALE_TAGS[locale].lang
              const current = locale === model.locale
              return current
                ? h.span(
                    [
                      h.Key(locale),
                      h.Role('menuitem'),
                      h.AriaCurrent('page'),
                      h.AriaLabel(LOCALE_NAMES[locale]),
                      h.Class(languageItem),
                    ],
                    [
                      h.span([], [LOCALE_NAMES[locale]]),
                      icon(
                        h,
                        Check,
                        css({
                          width: '3.5',
                          height: '3.5',
                          flexShrink: '0',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                  )
                : h.a(
                    [
                      h.Key(locale),
                      // The builder that points links into the page's language would point this one back.
                      rootBuilder(h).Href(withLocale(locale, model.path)),
                      h.Attribute('hreflang', tag),
                      h.Attribute('lang', tag),
                      h.Title(l.t.header.switchTo(LOCALE_NAMES[locale])),
                      h.Role('menuitem'),
                      h.AriaLabel(LOCALE_NAMES[locale]),
                      h.Class(languageItem),
                    ],
                    [h.span([], [LOCALE_NAMES[locale]]), h.span([h.Class(languageCode)], [tag])],
                  )
            }),
          )
        : h.empty,
    ],
  )

/** The theme switch. The icon follows `html.dark`, so it has one source of truth. */
const themeToggle = (l: Lang, h: H): Html =>
  h.button(
    [
      h.Type('button'),
      h.DataAttribute('theme-toggle', ''),
      h.AriaLabel(l.t.header.theme),
      h.Title(l.t.header.theme),
      h.Class(
        css({
          display: 'grid',
          width: '8',
          height: '8',
          flexShrink: '0',
          placeItems: 'center',
          borderRadius: 'md',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
          color: 'mutedForeground',
          _hover: {
            borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
            color: 'foreground',
          },
        }),
      ),
    ],
    [
      icon(
        h,
        Sun,
        css({
          width: '4',
          height: '4',
          _dark: { display: 'none' },
        }),
      ),
      icon(
        h,
        Moon,
        css({
          display: 'none',
          width: '4',
          height: '4',
          _dark: { display: 'block' },
        }),
      ),
    ],
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
          borderColor: 'border',
          backgroundColor: 'background',
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
              height: '14',
              maxWidth: '80rem',
              alignItems: 'center',
              gap: '3',
              paddingInline: '4',
              sm: {
                paddingInline: '6',
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
                  width: '9',
                  height: '9',
                  placeItems: 'center',
                  borderRadius: 'md',
                  color: 'mutedForeground',
                  _hover: {
                    color: 'foreground',
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
                  gap: '2',
                  paddingRight: '1',
                  sm: {
                    paddingRight: '3',
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
                      fontSize: 'type.15',
                      fontWeight: 'semibold',
                      letterSpacing: 'tight',
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
                      fontSize: 'type.15',
                      color: 'mutedForeground',
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
          languageSwitcher(model, l, h),
          themeToggle(l, h),
          h.a(
            [
              h.Href(REPOSITORY),
              h.Title(l.t.header.github),
              h.AriaLabel(l.t.header.github),
              h.Class(
                css({
                  display: 'none',
                  height: '8',
                  width: '8',
                  flexShrink: '0',
                  placeItems: 'center',
                  borderRadius: 'md',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'border',
                  color: 'mutedForeground',
                  _hover: {
                    borderColor: 'color-mix(in oklab, var(--foreground) 30%, transparent)',
                    color: 'foreground',
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
                  height: '8',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '1',
                  borderRadius: 'md',
                  backgroundColor: 'foreground',
                  paddingInline: '3',
                  fontSize: 'type.13',
                  fontWeight: 'medium',
                  color: 'background',
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
                  width: '3.5',
                  height: '3.5',
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
              height: '11',
              maxWidth: '80rem',
              alignItems: 'stretch',
              gap: '6',
              overflowX: 'auto',
              paddingInline: '4',
              // Room after the last tab, so the current one can sit at the start edge on a phone.
              paddingRight: '24',
              sm: {
                paddingInline: '6',
              },
              scrollbarWidth: 'none',
              '@media (max-width: 1023px)': {
                maskImage:
                  'linear-gradient(to right,transparent 0.5rem,#000 1rem,#000 calc(100% - 3rem),transparent)',
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
                      gap: '2',
                      borderBottomWidth: '2px',
                      borderBottomStyle: 'solid',
                      scrollMarginInlineStart: '4',
                      fontSize: 'type.14',
                      transitionProperty:
                        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                      transitionDuration: 'fast',
                      transitionTimingFunction: 'default',
                    }),
                    section === current
                      ? css({
                          borderColor: 'foreground',
                          fontWeight: 'medium',
                          color: 'foreground',
                        })
                      : css({
                          borderColor: 'transparent',
                          color: 'mutedForeground',
                          _hover: {
                            color: 'foreground',
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
                    width: '4',
                    height: '4',
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
