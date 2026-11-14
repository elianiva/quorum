import type { Html, HtmlBuilder } from 'foldkit/html'
import { ChevronDown, ChevronRight } from 'lucide'
import { FIGURE } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import { SCROLL } from '@quorum/ui/game/bits'
import { langOf, type Lang } from '../i18n/lang.ts'
import { Message, type Model } from '../main.ts'
import type { Page } from '../page.ts'
import { childrenOf, navOf, pageIn } from '../pages.ts'
import * as Spoilers from '../submodels/spoilers.ts'
import { quadrantBadge, quadrantColor } from './quadrant.ts'
import { css, cx } from '@quorum/styled-system/css'

/* The navigation rail: the current section's pages, and the open hub's pages beneath it. */

type H = HtmlBuilder<Message>

/** One row. The current page gets a filled row with its kind's colour as a bar. */
const navLink = (
  page: Page,
  current: string,
  color: string,
  h: H,
  nested = false,
  room = false,
  number: number | null = null,
): Html => {
  const active = page.path === current
  return h.a(
    [
      h.Key(page.path),
      h.Href(page.path),
      ...(active ? [h.AriaCurrent('page')] : []),
      h.Class(
        cx(
          css({
            position: 'relative',
            display: 'block',
            borderRadius: 'md',
            paddingBlock: '1.5',
            fontSize: 'type.14',
            lineHeight: 'snug',
            transitionProperty:
              'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
            transitionDuration: 'fast',
            transitionTimingFunction: 'default',
          }),
          nested
            ? css({
                paddingRight: '2',
                paddingLeft: '3',
              })
            : room
              ? css({
                  paddingRight: '14',
                  paddingLeft: '2.5',
                })
              : css({
                  paddingInline: '2.5',
                }),
          active
            ? css({
                backgroundColor: 'muted',
                fontWeight: 'medium',
                color: 'foreground',
              })
            : css({
                color: 'mutedForeground',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                  color: 'foreground',
                },
              }),
        ),
      ),
    ],
    [
      active
        ? h.span(
            [
              h.AriaHidden(true),
              h.Class(
                css({
                  position: 'absolute',
                  top: '1.5',
                  bottom: '1.5',
                  left: '0',
                  width: '0.5',
                  borderRadius: 'full',
                }),
              ),
              h.Style({ background: color }),
            ],
            [],
          )
        : h.empty,
      number === null
        ? h.span([], [page.title])
        : h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '1.5',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        width: '4',
                        flexShrink: '0',
                        textAlign: 'right',
                        fontSize: 'type.11',
                      }),
                      active
                        ? css({
                            color: 'foreground',
                          })
                        : css({
                            color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)',
                          }),
                    ),
                  ),
                ],
                [String(number)],
              ),
              h.span(
                [
                  h.Class(
                    css({
                      minWidth: '0',
                      flex: '1 1 0%',
                    }),
                  ),
                ],
                [page.title],
              ),
            ],
          ),
    ],
  )
}

/** A group's name in the page's language. A group the copy does not know keeps the name the frontmatter gives. */
const groupLabel = (l: Lang, name: string): string =>
  (l.t.groups as Readonly<Record<string, Readonly<{ name: string }> | undefined>>)[name]?.name ??
  name

/** A group of pages under one heading: a button with the page count and a chevron, and the pages beneath it when open. */
const groupBlock = (
  l: Lang,
  name: string,
  pages: ReadonlyArray<Page>,
  current: string,
  isOpen: boolean,
  color: string,
  h: H,
): Html => {
  const numbered = name === 'Scaling steps'
  const label = groupLabel(l, name)
  return h.div(
    [
      h.Key(`group-${name}`),
      h.Class(
        css({
          marginTop: '2',
        }),
      ),
    ],
    [
      h.button(
        [
          h.Type('button'),
          h.AriaExpanded(isOpen),
          h.AriaLabel(isOpen ? l.t.sidebar.collapse(label) : l.t.sidebar.expand(label)),
          h.DataAttribute('needs-hydration', 'nav-group'),
          h.OnClick(Message.NavToggled({ path: `group:${name}` })),
          h.Class(
            cx(
              css({
                display: 'flex',
                width: '100%',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '2',
                borderRadius: 'md',
                paddingInline: '2.5',
                paddingBlock: '1.5',
                textAlign: 'left',
                transitionProperty:
                  'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                transitionDuration: 'fast',
                transitionTimingFunction: 'default',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                },
              }),
              isOpen
                ? css({
                    color: 'foreground',
                  })
                : css({
                    color: 'mutedForeground',
                  }),
            ),
          ),
        ],
        [
          h.span(
            [
              h.AriaHidden(true),
              h.Class(
                css({
                  width: '1.5',
                  height: '1.5',
                  flexShrink: '0',
                  borderRadius: 'full',
                }),
              ),
              h.Style({ background: color }),
            ],
            [],
          ),
          h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.13',
                  fontWeight: 'semibold',
                }),
              ),
            ],
            [label],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [String(pages.length)],
          ),
          icon(
            h,
            isOpen ? ChevronDown : ChevronRight,
            css({
              width: '3.5',
              height: '3.5',
            }),
          ),
        ],
      ),
      isOpen
        ? h.div(
            [
              h.Class(
                css({
                  marginTop: '0.5',
                  marginBottom: '1',
                  marginLeft: '1.5',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                  borderLeftWidth: '1px',
                  borderLeftStyle: 'solid',
                  borderColor: 'border',
                }),
              ),
            ],
            pages.map((entry) =>
              navLink(entry, current, color, h, false, false, numbered ? entry.order - 100 : null),
            ),
          )
        : h.empty,
    ],
  )
}

/** A hub: its row, how many pages sit under it, and a chevron that turns when it is open. */
const hubLink = (
  l: Lang,
  hub: Page,
  current: string,
  isOpen: boolean,
  color: string,
  h: H,
): Html => {
  const count = childrenOf(l.locale, hub.path).length
  return h.div(
    [
      h.Key(`${hub.path}-row`),
      h.Class(
        css({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
            }),
          ),
        ],
        [navLink(hub, current, color, h, false, count > 0)],
      ),
      count > 0
        ? h.button(
            [
              h.Type('button'),
              h.AriaLabel(isOpen ? l.t.sidebar.collapse(hub.title) : l.t.sidebar.expand(hub.title)),
              h.AriaExpanded(isOpen),
              h.DataAttribute('needs-hydration', 'nav-hub'),
              h.OnClick(Message.NavToggled({ path: hub.path })),
              h.Class(
                cx(
                  css({
                    position: 'absolute',
                    right: '1',
                    display: 'flex',
                    height: '6',
                    cursor: 'pointer',
                    alignItems: 'center',
                    gap: '1',
                    borderRadius: 'xs',
                    paddingInline: '1.5',
                    color: 'mutedForeground',
                    transitionProperty:
                      'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
                    transitionDuration: 'fast',
                    transitionTimingFunction: 'default',
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
                      color: 'foreground',
                    },
                  }),
                  isOpen &&
                    css({
                      color: 'foreground',
                    }),
                ),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.11',
                      }),
                    ),
                  ),
                ],
                [String(count)],
              ),
              icon(
                h,
                isOpen ? ChevronDown : ChevronRight,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ],
          )
        : h.empty,
    ],
  )
}

/** Consecutive pages that share a group, in order; ungrouped pages are their own run. */
const segmentsOf = (
  pages: ReadonlyArray<Page>,
): ReadonlyArray<Readonly<{ group: string | null; pages: ReadonlyArray<Page> }>> =>
  pages.reduce<Array<{ group: string | null; pages: Array<Page> }>>((runs, entry) => {
    const last = runs[runs.length - 1]
    if (last && last.group === entry.group) last.pages.push(entry)
    else runs.push({ group: entry.group, pages: [entry] })
    return runs
  }, [])

export const sidebar = (model: Model, h: H): Html => {
  const l = langOf(model.locale)
  const page = pageIn(model.locale, model.path)
  const open = page?.parent ?? page?.path ?? null
  // Home has no section of its own; it lists the play pages, where a new player starts.
  const section = model.path === '/' ? 'play' : (page?.section ?? 'play')
  const color = quadrantColor(section)
  const isOpen = (path: string): boolean => (path === open) !== model.navToggled.includes(path)
  return h.nav(
    [
      h.AriaLabel(l.t.quadrants[section].label),
      h.Class(
        cx(
          SCROLL,
          // A phone opens the menu over the page; a desktop keeps it as a sticky rail.
          css({
            borderColor: 'border',
            lg: {
              position: 'sticky',
              top: 'var(--header-height)',
              display: 'flex',
              height: 'calc(100dvh - var(--header-height))',
              flexDirection: 'column',
              alignSelf: 'flex-start',
              borderRightWidth: '1px',
              borderRightStyle: 'solid',
              paddingRight: '4',
            },
          }),
          model.menu
            ? css({
                position: 'fixed',
                insetInline: '0',
                top: 'var(--header-height)',
                bottom: '0',
                zIndex: '30',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'background',
                paddingInline: '4',
                lg: {
                  position: 'static',
                  backgroundColor: 'transparent',
                  paddingInline: '0',
                },
              })
            : css({
                display: 'none',
              }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              paddingTop: '4',
              lg: {
                paddingTop: '6',
              },
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  marginBottom: '3',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2',
                  paddingInline: '2.5',
                }),
              ),
            ],
            [
              quadrantBadge(
                section,
                css({
                  width: '5',
                  height: '5',
                }),
                h,
              ),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'type.13',
                      fontWeight: 'semibold',
                      color: 'foreground',
                    }),
                  ),
                ],
                [l.t.quadrants[section].label],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                }),
              ),
            ],
            segmentsOf(navOf(model.locale, section)).flatMap((segment) =>
              segment.group !== null
                ? [
                    groupBlock(
                      l,
                      segment.group,
                      segment.pages,
                      model.path,
                      (segment.pages.some((entry) => entry.path === model.path) ||
                        (page?.group ?? null) === segment.group) !==
                        model.navToggled.includes(`group:${segment.group}`),
                      color,
                      h,
                    ),
                  ]
                : segment.pages.flatMap((hub) => [
                    hubLink(l, hub, model.path, isOpen(hub.path), color, h),
                    ...(isOpen(hub.path) && childrenOf(model.locale, hub.path).length > 0
                      ? [
                          h.div(
                            [
                              h.Key(`${hub.path}-children`),
                              h.Class(
                                css({
                                  marginTop: '0.5',
                                  marginBottom: '1.5',
                                  marginLeft: '3',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5',
                                  borderLeftWidth: '1px',
                                  borderLeftStyle: 'solid',
                                  borderColor: 'border',
                                  paddingLeft: '1',
                                }),
                              ),
                            ],
                            childrenOf(model.locale, hub.path).map((child) =>
                              navLink(child, model.path, color, h, true),
                            ),
                          ),
                        ]
                      : []),
                  ]),
            ),
          ),
        ],
      ),
      // The spoiler filter stays in reach at the foot, however long the list.
      h.div(
        [
          h.Class(
            css({
              position: 'sticky',
              bottom: '0',
              marginTop: 'auto',
              backgroundColor: 'background',
              paddingTop: '4',
              paddingBottom: '4',
              lg: {
                paddingBottom: '6',
              },
            }),
          ),
        ],
        [
          h.submodel({
            slotId: 'spoilers',
            model: model.spoilers,
            view: Spoilers.view,
            viewInputs: { locale: model.locale },
            toParentMessage: (message) => Message.SpoilersChanged({ message }),
          }),
        ],
      ),
    ],
  )
}
