import { css, cx, keyframes } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { ChartLine, Mail, MessagesSquare, Plug, Wrench, X, type IconNode } from 'lucide'
import {
  DOCK_GROUPS,
  COMPONENTS,
  type DockGroup,
  type ComponentId,
} from '@quorum/simulation/catalog'
import { COMPONENT_ICONS, GROUP_ICONS } from '@quorum/ui/game/icons'
import { Message } from '@/game/message.ts'
import { placingOf, type Model } from '@/game/model.ts'
import { dockGroups, dockItems } from '@/game/reveal.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { Kbd } from '@quorum/ui/primitives/kbd'
import { cn } from '@/lib/utils'
import { FIGURE, GROUP_TEXT, PANEL, groupBadge, tool } from '@quorum/ui/game/bits'
import { partOf } from '@/game/parts.ts'
import { partCells } from './part-row.ts'
import { unreadCount, waitingMail } from './inbox.ts'

/** The highlight's offset under the open tab, by the tab's place in the dock. */
const TAB_OFFSET = [
  css({ translate: '0' }),
  css({ translate: '2.75rem' }),
  css({ translate: '5.5rem' }),
  css({ translate: '8.25rem' }),
  css({ translate: '11rem' }),
  css({ translate: '13.75rem' }),
  css({ translate: '16.5rem' }),
]

const highlightIn = keyframes({
  from: { opacity: '0' },
})

const DOCK_ICONS: Record<DockGroup, IconNode> = {
  edge: GROUP_ICONS.edge,
  compute: GROUP_ICONS.compute,
  data: GROUP_ICONS.data,
  messaging: MessagesSquare,
  platform: Wrench,
  insight: ChartLine,
  managed: Plug,
}

const row = (model: Model, type: ComponentId, index: number, h: HtmlBuilder<Message>): Html => {
  const part = partOf(copy(h), model.board.game, type)
  return h.button(
    [
      h.Key(type),
      h.Type('button'),
      h.OnClick(Message.PlacingChosen({ type })),
      h.Class(
        cn(
          cx(
            css({
              display: 'flex',
              height: '3rem',
              width: '100%',
              flexShrink: '0',
              alignItems: 'center',
              gap: '0.75rem',
              borderRadius: 'xl',
              paddingInline: '0.625rem',
              textAlign: 'left',
              _hover: {
                backgroundColor: 'var(--well)',
              },
            }),
            'press',
          ),
          part.locked === null
            ? ''
            : css({
                opacity: 0.7,
              }),
        ),
      ),
    ],
    [
      ...partCells(part, h),
      h.span(
        [
          h.Class(
            css({
              _compact: {
                display: 'none',
              },
            }),
          ),
        ],
        [Kbd({}, [String(index + 1)], h)],
      ),
    ],
  )
}

/** The part in hand: its mark and name, and a way to put it down. */
const armed = (type: ComponentId, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Key('armed'),
      h.DataAttribute('exit', 'gesture'),
      h.DataAttribute('exit-anchor', 'bottom'),
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            paddingRight: '0.25rem',
            paddingBottom: '0.375rem',
            paddingLeft: '0.5rem',
            fontSize: 'calc(12.5px*var(--type-scale))',
            whiteSpace: 'nowrap',
          }),
          'swap',
        ),
      ),
    ],
    [
      groupBadge(
        COMPONENTS[type].group,
        COMPONENT_ICONS[type],
        css({ width: '1.25rem', height: '1.25rem' }),
        h,
      ),
      h.span(
        [
          h.Class(
            css({
              fontWeight: '500',
            }),
          ),
        ],
        [t.catalog.components[type].name],
      ),
      h.span(
        [
          h.Class(
            css({
              color: 'var(--muted-foreground)',
              _compact: {
                display: 'none',
              },
            }),
          ),
        ],
        [t.dock.clickTheBoard],
      ),
      h.button(
        [
          h.Type('button'),
          h.Title(t.dock.stopPlacingEsc),
          h.AriaLabel(t.dock.stopPlacing),
          h.OnClick(Message.PlacingChosen({ type: null })),
          h.Class(tool(false)),
        ],
        [
          icon(
            h,
            X,
            css({
              width: '1rem',
              height: '1rem',
            }),
          ),
        ],
      ),
    ],
  )
}

/** The open group's parts, keyed by group, so switching groups swaps the list
 *  in place while the dock morphs to its new height. */
const list = (model: Model, group: DockGroup, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Key(`list-${group}`),
      h.DataAttribute('exit', 'gesture'),
      h.DataAttribute('exit-anchor', 'bottom'),
      h.Class(
        cx(
          css({
            display: 'flex',
            width: '420px',
            maxWidth: '100%',
            flexDirection: 'column',
            gap: '0.125rem',
            paddingBottom: '0.25rem',
            _compact: {
              maxHeight: '46dvh',
              width: 'auto',
              overflowY: 'auto',
              scrollbarWidth: 'none',
            },
          }),
          'swap',
        ),
      ),
    ],
    dockItems(model.board.game, group).map((type, index) => row(model, type, index, h)),
  )

/** The Inbox beside the build groups: one badge, one sheet, no separate action bar. */
const inboxTab = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const unread = unreadCount(model)
  const waiting = waitingMail(model)
  const active = model.panel === 'inbox'
  return h.button(
    [
      h.Key('inbox-tab'),
      h.Type('button'),
      h.Title(t.inbox.inboxI),
      h.AriaLabel(unread > 0 ? t.inbox.inboxUnread(unread) : t.inbox.inbox),
      h.AriaPressed(active ? 'true' : 'false'),
      h.OnClick(Message.PanelOpened({ panel: active ? 'none' : 'inbox' })),
      h.Class(
        cn(
          cx(
            css({
              position: 'relative',
              display: 'none',
              width: '2.5rem',
              height: '2.5rem',
              flexShrink: '0',
              placeItems: 'center',
              borderRadius: 'xl',
              _compact: {
                display: 'grid',
              },
            }),
            'press',
          ),
          active
            ? css({
                backgroundColor: 'var(--well)',
                boxShadow: 'well',
              })
            : css({
                _hover: {
                  backgroundColor: 'var(--well)',
                },
              }),
        ),
      ),
    ],
    [
      icon(
        h,
        Mail,
        css({
          width: '1.25rem',
          height: '1.25rem',
          color: 'var(--muted-foreground)',
        }),
      ),
      unread > 0
        ? h.span(
            [
              h.Key(`unread-${unread}`),
              h.Class(
                cn(
                  FIGURE,
                  cx(
                    css({
                      position: 'absolute',
                      top: '-0.125rem',
                      right: '-0.125rem',
                      display: 'grid',
                      height: '1rem',
                      minWidth: '1rem',
                      placeItems: 'center',
                      borderRadius: '9999px',
                      paddingInline: '0.25rem',
                      fontSize: 'calc(9.5px*var(--type-scale))',
                      lineHeight: '1',
                      fontWeight: '500',
                      color: 'white',
                      boxShadow: 'raised',
                    }),
                    'enter-badge',
                  ),
                  waiting
                    ? css({
                        backgroundColor: 'var(--danger)',
                      })
                    : css({
                        layerStyle: 'primaryFill',
                      }),
                ),
              ),
            ],
            [String(unread)],
          )
        : h.empty,
    ],
  )
}

/** One surface. Its top slot holds the open group's parts or the part in hand,
 *  and the dock morphs between them instead of snapping (src/game/motion.ts).
 *  The dock is pinned at its bottom edge, so its content packs to the bottom:
 *  mid-morph, the tabs stay put and the top edge moves. */
export const dock = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const open = model.board.buildGroup
  const placing = placingOf(model)
  const groups = DOCK_GROUPS.filter((group) => dockGroups(model.board.game).includes(group.key))
  // A phone docks the tabs as a pill around their content. The pill only takes the full width when
  // every group is unlocked, or while a group's list is open and its rows need the room.
  const allGroups = groups.length === DOCK_GROUPS.length
  const wide = open !== null || allGroups
  return h.div(
    [
      h.Key('dock'),
      h.DataAttribute('morph', 'gesture'),
      h.Class(
        cx(
          css({
            pointerEvents: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0.375rem',
          }),
          PANEL,
          css({
            _compact: {
              alignItems: 'stretch',
            },
          }),
          wide
            ? css({ _compact: { width: '100%' } })
            : css({ _compact: { width: 'fit-content', alignSelf: 'center' } }),
        ),
      ),
    ],
    [
      open ? list(model, open, h) : placing ? armed(placing, h) : h.empty,
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                maxWidth: '100%',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.25rem',
              }),
              allGroups ? 'compact:justify-start' : 'compact:justify-center',
              css({
                _compact: {
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                },
              }),
            ),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  position: 'relative',
                  display: 'flex',
                  gap: '0.25rem',
                }),
              ),
              h.Role('group'),
              h.AriaLabel(t.dock.build),
            ],
            [
              // One highlight slides between the tabs. It is a fresh element each time the
              // list opens, so it fades in on the tab you clicked instead of sliding from another.
              open
                ? h.span(
                    [
                      h.Key('tab-highlight'),
                      // The offset is a class, not an inline style: a style set after the element
                      // is inserted would transition from the left edge.
                      h.Class(
                        cn(
                          cx(
                            css({
                              pointerEvents: 'none',
                              position: 'absolute',
                              top: '0',
                              left: '0',
                              width: '2.5rem',
                              height: '2.5rem',
                              borderRadius: 'xl',
                              backgroundColor: 'var(--well)',
                              boxShadow: 'well',
                              transitionProperty: 'translate',
                              transitionDuration: '200ms',
                              transitionTimingFunction: 'cubic-bezier(0.32,0.72,0,1)',
                              animationName: highlightIn,
                              animationDuration: '200ms',
                              animationTimingFunction: 'var(--ease-out)',
                              animationFillMode: 'both',
                              '@media (prefers-reduced-motion: reduce)': {
                                transitionProperty: 'none',
                                transitionDuration: '150ms',
                                transitionTimingFunction: 'var(--ease-out)',
                              },
                            }),
                          ),
                          TAB_OFFSET[groups.findIndex((group) => group.key === open)],
                        ),
                      ),
                    ],
                    [],
                  )
                : h.empty,
              ...groups.map((group, index) =>
                h.button(
                  [
                    h.Key(group.key),
                    h.Type('button'),
                    h.Title(`${t.catalog.dockGroups[group.key].label} (${index + 1})`),
                    h.AriaLabel(t.catalog.dockGroups[group.key].label),
                    h.AriaPressed(group.key === open ? 'true' : 'false'),
                    h.OnClick(Message.BuildGroupChosen({ group: group.key })),
                    h.Class(
                      cn(
                        cx(
                          css({
                            position: 'relative',
                            display: 'grid',
                            width: '2.5rem',
                            height: '2.5rem',
                            flexShrink: '0',
                            placeItems: 'center',
                            borderRadius: 'xl',
                          }),
                          'press',
                        ),
                        group.key === open
                          ? ''
                          : css({
                              _hover: {
                                backgroundColor: 'var(--well)',
                              },
                            }),
                      ),
                    ),
                  ],
                  [
                    groupBadge(
                      group.family,
                      DOCK_ICONS[group.key],
                      css({ width: '1.5rem', height: '1.5rem' }),
                      h,
                    ),
                    // The open tab carries its group colour as an underline.
                    h.span(
                      [
                        h.Class(
                          cn(
                            css({
                              position: 'absolute',
                              bottom: '0.25rem',
                              height: '0.125rem',
                              borderRadius: '9999px',
                              backgroundColor: 'currentColor',
                              transitionProperty: 'width',
                              transitionDuration: '200ms',
                              transitionTimingFunction: 'var(--ease-out)',
                            }),
                            group.key === open
                              ? css({
                                  width: '1rem',
                                })
                              : css({
                                  width: '0',
                                }),
                            GROUP_TEXT[group.family],
                          ),
                        ),
                      ],
                      [],
                    ),
                  ],
                ),
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  marginInline: '0.125rem',
                  display: 'none',
                  height: '1.5rem',
                  width: '1px',
                  flexShrink: '0',
                  backgroundColor: 'var(--hairline)',
                  _compact: {
                    display: 'block',
                  },
                }),
              ),
            ],
            [],
          ),
          inboxTab(model, h),
        ],
      ),
    ],
  )
}
