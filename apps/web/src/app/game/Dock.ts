import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx, keyframes } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import { ChartLine, Lock, Mail, MessagesSquare, Plug, Wrench, X, type IconNode } from 'lucide'
import {
  COMPONENTS,
  DOCK_GROUPS,
  type ComponentId,
  type DockGroup,
} from '@quorum/simulation/catalog'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { GROUP_ICONS } from '@quorum/ui/game/icons'
import { FIGURE, GROUP_TEXT, PANEL, tool } from '@quorum/ui/game/bits'
import { Message } from '@/game/message.ts'
import { unreadCount, waitingMail } from './Inbox.ts'
import { placingOf, type Model } from '@/game/model.ts'
import { partOf, type Part } from '@/game/parts.ts'
import { dockGroups, dockItems } from '@/game/reveal.ts'
import { icon } from '../ui/icon.ts'
import { groupBadge } from './inspector/shared.ts'

type Content = View.Content<Message>
type Child = View.Input<Message>

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

const KBD = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'color-mix(in oklab, var(--foreground) 75%, transparent)',
  height: '5',
  width: 'fit-content',
  minWidth: '5',
  gap: '1',
  borderRadius: 'sm',
  paddingInline: '1.5',
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

const kbd = (h: H<Message>, label: string): Content =>
  h.kbd.attr('data-slot', 'kbd').class(KBD).children(label)

const detail = (part: Part, h: H<Message>): Child => {
  if (part.locked !== null)
    return h.span
      .attr('title', part.locked)
      .class(
        css({
          display: 'flex',
          flexShrink: '0',
          alignItems: 'center',
          gap: '1',
          fontSize: 'type.11',
          color: 'mutedForeground',
        }),
      )
      .children(
        icon(h, Lock, css({ width: '3.5', height: '3.5' })),
        h.span.class(css({ _compact: { display: 'none' } })).children(part.locked),
      )
  if (part.price === null) return null
  return h.span
    .class(
      cx(
        FIGURE,
        css({ flexShrink: '0', fontSize: 'type.12-5' }),
        part.short ? css({ color: 'danger' }) : '',
      ),
    )
    .children(part.price)
}

export const partCells = (part: Part, h: H<Message>): ReadonlyArray<Child> => [
  groupBadge(
    part.group,
    part.icon,
    css({ width: '8', height: '8', flexShrink: '0' }),
    h,
    part.locked !== null,
  ),
  h.span
    .class(
      css({
        display: 'flex',
        minWidth: '0',
        flex: '1 1 0%',
        flexDirection: 'column',
        gap: '0.5',
      }),
    )
    .children(
      h.span
        .class(
          css({
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.13',
            lineHeight: 'none',
            fontWeight: 'medium',
          }),
        )
        .children(part.name),
      h.span
        .class(
          css({
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.11-5',
            lineHeight: 'tight',
            color: 'mutedForeground',
          }),
        )
        .children(part.blurb),
    ),
  detail(part, h),
]

const row = (h: H<Message>, model: Model, type: ComponentId, index: number): Content => {
  const t = copy(h)
  const part = partOf(t, model.board.game, type)
  const button = h.button
    .key(type)
    .attr('type', 'button')
    .attr('aria-label', part.name)
    .on('click', () => Message.PlacingChosen({ type }))
  const disabled = part.short
    ? button
        .attr('disabled', '')
        .attr('aria-disabled', 'true')
        .attr('title', t.toasts.costs(part.name, part.price ?? ''))
    : button
  return disabled
    .class(
      cx(
        cx(
          css({
            display: 'flex',
            height: '12',
            width: '100%',
            flexShrink: '0',
            alignItems: 'center',
            gap: '3',
            borderRadius: 'xl',
            paddingInline: '2.5',
            textAlign: 'left',
            _hover: { backgroundColor: 'well' },
          }),
          'press',
        ),
        part.short
          ? css({
              cursor: 'not-allowed',
              opacity: 0.5,
              _hover: { backgroundColor: 'transparent' },
            })
          : '',
        part.locked === null ? '' : css({ opacity: 0.7 }),
      ),
    )
    .children(
      ...partCells(part, h),
      h.span
        .class(
          css({
            _compact: { display: 'none' },
            ...(part.short ? { display: 'none' } : {}),
          }),
        )
        .children(kbd(h, String(index + 1))),
    )
}

const armed = (h: H<Message>, type: ComponentId): Content => {
  const t = copy(h)
  return h.div
    .key('armed')
    .attr('data-exit', 'gesture')
    .attr('data-exit-anchor', 'bottom')
    .class(
      cx(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          paddingRight: '1',
          paddingBottom: '1.5',
          paddingLeft: '2',
          fontSize: 'type.12-5',
          whiteSpace: 'nowrap',
        }),
        'swap',
      ),
    )
    .children(
      groupBadge(
        COMPONENTS[type].group,
        COMPONENT_ICONS[type],
        css({ width: '5', height: '5' }),
        h,
      ),
      h.span.class(css({ fontWeight: 'medium' })).children(t.catalog.components[type].name),
      h.span
        .class(
          css({
            color: 'mutedForeground',
            _compact: { display: 'none' },
          }),
        )
        .children(t.dock.clickTheBoard),
      h.button
        .attr('type', 'button')
        .attr('title', t.dock.stopPlacingEsc)
        .attr('aria-label', t.dock.stopPlacing)
        .on('click', () => Message.PlacingChosen({ type: null }))
        .class(tool(false))
        .children(icon(h, X, css({ width: '4', height: '4' }))),
    )
}

const list = (h: H<Message>, model: Model, group: DockGroup): Content =>
  h.div
    .key(`list-${group}`)
    .attr('data-exit', 'gesture')
    .attr('data-exit-anchor', 'bottom')
    .class(
      cx(
        css({
          display: 'flex',
          width: '420px',
          maxWidth: '100%',
          flexDirection: 'column',
          gap: '0.5',
          paddingBottom: '1',
          _compact: {
            maxHeight: '46dvh',
            width: 'auto',
            overflowY: 'auto',
            scrollbarWidth: 'none',
          },
        }),
        'swap',
      ),
    )
    .children(
      ...dockItems(model.board.game, group).map((type, index) => row(h, model, type, index)),
    )

const inboxTab = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const unread = unreadCount(model)
  const waiting = waitingMail(model)
  const active = model.panel === 'inbox'
  return h.button
    .key('inbox-tab')
    .attr('type', 'button')
    .attr('title', t.inbox.inboxI)
    .attr('aria-label', unread > 0 ? t.inbox.inboxUnread(unread) : t.inbox.inbox)
    .attr('aria-pressed', active ? 'true' : 'false')
    .on('click', () => Message.PanelOpened({ panel: active ? 'none' : 'inbox' }))
    .class(
      cx(
        cx(
          css({
            position: 'relative',
            display: 'none',
            width: '10',
            height: '10',
            flexShrink: '0',
            placeItems: 'center',
            borderRadius: 'xl',
            _compact: { display: 'grid' },
          }),
          'press',
        ),
        active
          ? css({ backgroundColor: 'well', boxShadow: 'well' })
          : css({ _hover: { backgroundColor: 'well' } }),
      ),
    )
    .children(
      icon(h, Mail, css({ width: '5', height: '5', color: 'mutedForeground' })),
      unread > 0
        ? h.span
            .key(`unread-${unread}`)
            .class(
              cx(
                FIGURE,
                cx(
                  css({
                    position: 'absolute',
                    top: '-0.125rem',
                    right: '-0.125rem',
                    display: 'grid',
                    height: '4',
                    minWidth: '4',
                    placeItems: 'center',
                    borderRadius: 'full',
                    paddingInline: '1',
                    fontSize: 'type.9-5',
                    lineHeight: 'none',
                    fontWeight: 'medium',
                    color: 'white',
                    boxShadow: 'raised',
                  }),
                  'enter-badge',
                ),
                waiting ? css({ backgroundColor: 'danger' }) : css({ layerStyle: 'primaryFill' }),
              ),
            )
            .children(String(unread))
        : null,
    )
}

export const dock = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const open = model.board.buildGroup
  const placing = placingOf(model)
  const groups = DOCK_GROUPS.filter((group) => dockGroups(model.board.game).includes(group.key))
  const allGroups = groups.length === DOCK_GROUPS.length
  const wide = open !== null || allGroups
  return h.div
    .key('dock')
    .attr('data-morph', 'gesture')
    .class(
      cx(
        css({
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '1.5',
        }),
        PANEL,
        css({ _compact: { alignItems: 'stretch' } }),
        wide
          ? css({ _compact: { width: '100%' } })
          : css({ _compact: { width: 'fit-content', alignSelf: 'center' } }),
      ),
    )
    .children(
      open ? list(h, model, open) : placing ? armed(h, placing) : null,
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              maxWidth: '100%',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1',
            }),
            css({ _compact: { justifyContent: allGroups ? 'flex-start' : 'center' } }),
            css({ _compact: { overflowX: 'auto', scrollbarWidth: 'none' } }),
          ),
        )
        .children(
          h.div
            .attr('role', 'group')
            .attr('aria-label', t.dock.build)
            .class(css({ position: 'relative', display: 'flex', gap: '1' }))
            .children(
              open
                ? h.span
                    .key('tab-highlight')
                    .class(
                      cx(
                        css({
                          pointerEvents: 'none',
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          width: '10',
                          height: '10',
                          borderRadius: 'xl',
                          backgroundColor: 'well',
                          boxShadow: 'well',
                          transitionProperty: 'translate',
                          transitionDuration: 'normal',
                          transitionTimingFunction: 'drawer',
                          animationName: highlightIn,
                          animationDuration: 'normal',
                          animationTimingFunction: 'out',
                          animationFillMode: 'both',
                          '@media (prefers-reduced-motion: reduce)': {
                            transitionProperty: 'none',
                            transitionDuration: 'fast',
                            transitionTimingFunction: 'out',
                          },
                        }),
                        TAB_OFFSET[groups.findIndex((group) => group.key === open)],
                      ),
                    )
                    .children()
                : null,
              ...groups.map((group, index) =>
                h.button
                  .key(group.key)
                  .attr('type', 'button')
                  .attr('title', `${t.catalog.dockGroups[group.key].label} (${index + 1})`)
                  .attr('aria-label', t.catalog.dockGroups[group.key].label)
                  .attr('aria-pressed', group.key === open ? 'true' : 'false')
                  .on('click', () => Message.BuildGroupChosen({ group: group.key }))
                  .class(
                    cx(
                      cx(
                        css({
                          position: 'relative',
                          display: 'grid',
                          width: '10',
                          height: '10',
                          flexShrink: '0',
                          placeItems: 'center',
                          borderRadius: 'xl',
                        }),
                        'press',
                      ),
                      group.key === open ? '' : css({ _hover: { backgroundColor: 'well' } }),
                    ),
                  )
                  .children(
                    groupBadge(
                      group.family,
                      DOCK_ICONS[group.key],
                      css({ width: '6', height: '6' }),
                      h,
                    ),
                    h.span
                      .class(
                        cx(
                          css({
                            position: 'absolute',
                            bottom: '1',
                            height: '0.5',
                            borderRadius: 'full',
                            backgroundColor: 'current',
                            transitionProperty: 'width',
                            transitionDuration: 'normal',
                            transitionTimingFunction: 'out',
                          }),
                          group.key === open ? css({ width: '4' }) : css({ width: '0' }),
                          GROUP_TEXT[group.family],
                        ),
                      )
                      .children(),
                  ),
              ),
            ),
          h.span
            .class(
              css({
                marginInline: '0.5',
                display: 'none',
                height: '6',
                width: '1px',
                flexShrink: '0',
                backgroundColor: 'hairline',
                _compact: { display: 'block' },
              }),
            )
            .children(),
          inboxTab(h, model),
        ),
    )
}
