import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import { Search } from 'lucide'
import { EYEBROW } from '@quorum/ui/game/bits'
import { copy, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import {
  activeOf,
  commandsOf,
  matchesOf,
  PALETTE_GROUPS,
  type PaletteCommand,
} from '@/game/palette.ts'
import type { Model } from '@/game/model.ts'
import { icon } from '../ui/icon.ts'
import { partCells } from './Dock.ts'

type Content = View.Content<Message>
type Child = View.Input<Message>

const PaletteFocus = Mount.make('PaletteFocus', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const panel = element as HTMLElement
          const input = panel.querySelector('input')
          input?.focus()
          input?.setSelectionRange(input.value.length, input.value.length)
          const reveal = () =>
            panel
              .querySelector<HTMLElement>('[data-palette-active]')
              ?.scrollIntoView({ block: 'nearest' })
          reveal()
          const observer = new MutationObserver(reveal)
          observer.observe(panel, {
            subtree: true,
            attributes: true,
            attributeFilter: ['data-palette-active'],
          })
          const keep = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            event.preventDefault()
            input?.focus()
          }
          panel.addEventListener('keydown', keep)
          return () => {
            observer.disconnect()
            panel.removeEventListener('keydown', keep)
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

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

const kbd = (h: H<Message>, label: string, className = ''): Content =>
  h.kbd.attr('data-slot', 'kbd').class(cx(KBD, className)).children(label)

const shortcut = (command: PaletteCommand, h: H<Message>): Child =>
  command.keys === undefined
    ? null
    : h.span
        .attr('aria-hidden', 'true')
        .class(
          css({
            display: 'flex',
            flexShrink: '0',
            alignItems: 'center',
            gap: '1',
          }),
        )
        .children(
          ...command.keys.map((key) =>
            kbd(
              h,
              key,
              css({
                flexShrink: '0',
                minWidth: '0',
                paddingInline: '1.5',
              }),
            ),
          ),
        )

const runHint = (h: H<Message>): Content =>
  h.span
    .attr('aria-hidden', 'true')
    .class(
      css({
        display: 'flex',
        flexShrink: '0',
        alignItems: 'center',
      }),
    )
    .children(
      kbd(
        h,
        '↵',
        css({
          flexShrink: '0',
          minWidth: '0',
          paddingInline: '1.5',
          layerStyle: 'primaryFill',
          color: 'onPrimaryFill',
          boxShadow: 'primary',
        }),
      ),
    )

const plainCell = (
  command: PaletteCommand,
  active: boolean,
  h: H<Message>,
): ReadonlyArray<Content> => [
  h.span
    .class(
      cx(
        css({
          display: 'grid',
          width: '7',
          height: '7',
          flexShrink: '0',
          placeItems: 'center',
          borderRadius: 'lg',
        }),
        active
          ? css({
              layerStyle: 'raised',
              color: 'foreground',
              boxShadow: 'raised',
            })
          : css({
              backgroundColor: 'color-mix(in oklab, var(--foreground) 6%, transparent)',
              color: 'mutedForeground',
            }),
      ),
    )
    .children(icon(h, command.glyph, css({ width: '15px', height: '15px' }))),
  h.span
    .class(
      css({
        minWidth: '0',
        flex: '1 1 0%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontSize: 'type.13',
        lineHeight: 'none',
      }),
    )
    .children(command.label),
]

const row = (command: PaletteCommand, active: boolean, h: H<Message>): Content => {
  const t = copy(h)
  const short = command.part?.short === true
  const button = h.button
    .key(command.id)
    .attr('id', `palette-option-${command.id}`)
    .attr('type', 'button')
    .attr('role', 'option')
    .attr('tabindex', '-1')
    .attr('aria-selected', String(active))
    .attr('data-palette-active', active ? '' : undefined)
  const disabled = short
    ? button
        .attr('disabled', '')
        .attr('aria-disabled', 'true')
        .attr('title', t.toasts.costs(command.part?.name ?? '', command.part?.price ?? ''))
    : button
  return disabled
    .on('click', () => Message.PaletteChosen({ id: command.id }))
    .on('mouseenter', () => Message.PaletteHighlighted({ id: command.id }))
    .class(
      cx(
        cx(
          css({
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            textAlign: 'left',
          }),
          'press',
        ),
        command.part === undefined
          ? css({
              height: '10',
              gap: '2.5',
              borderRadius: 'lg',
              paddingInline: '2',
            })
          : css({
              height: '12',
              gap: '3',
              borderRadius: 'xl',
              paddingInline: '2',
            }),
        short
          ? css({ cursor: 'not-allowed', opacity: 0.5 })
          : command.part?.locked !== null && command.part !== undefined
            ? css({ opacity: 0.7 })
            : '',
        active
          ? css({
              backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
              color: 'foreground',
            })
          : css({
              color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
              _hover: { backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)' },
            }),
      ),
    )
    .children(
      ...(command.part === undefined ? plainCell(command, active, h) : partCells(command.part, h)),
      shortcut(command, h),
      active ? runHint(h) : null,
    )
}

const results = (
  h: H<Message>,
  rows: ReadonlyArray<PaletteCommand>,
  active: PaletteCommand | null,
  query: string,
  t: Messages,
): Content => {
  const frame = css({
    maxHeight: 'min(52vh, 420px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: '1.5',
    scrollbarWidth: 'thin',
  })
  if (rows.length === 0)
    return h.div
      .attr('id', 'palette-results')
      .attr('role', 'status')
      .class(frame)
      .children(
        h.p
          .class(
            css({
              paddingInline: '2.5',
              paddingBlock: '10',
              textAlign: 'center',
              fontSize: 'type.12-5',
              color: 'mutedForeground',
            }),
          )
          .children(t.palette.noMatches(query)),
      )
  return h.div
    .attr('id', 'palette-results')
    .attr('role', 'listbox')
    .attr('aria-label', t.palette.title)
    .class(frame)
    .children(
      ...PALETTE_GROUPS.flatMap((group) => {
        const groupRows = rows.filter((command) => command.group === group)
        if (groupRows.length === 0) return []
        return [
          h.div
            .key(`group-${group}`)
            .attr('role', 'group')
            .attr('aria-label', t.palette.groups[group])
            .children(
              h.div
                .attr('aria-hidden', 'true')
                .class(
                  cx(
                    EYEBROW,
                    css({ paddingInline: '2.5', paddingBottom: '1.5' }),
                    group === PALETTE_GROUPS[0]
                      ? css({ paddingTop: '1' })
                      : css({ paddingTop: '3' }),
                  ),
                )
                .children(t.palette.groups[group]),
              ...groupRows.map((command) => row(command, command.id === active?.id, h)),
            ),
        ]
      }),
    )
}

export const commandPalette = (h: H<Message>, model: Model): Child => {
  const t = copy(h)
  if (!model.palette.open) return null
  const rows = matchesOf(commandsOf(t, model), t, model.palette.query)
  const active = activeOf(rows, model.palette.query, model.palette.active)
  return h.div
    .key('palette')
    .attr('data-exit', 'gesture')
    .class(
      cx(
        css({
          position: 'absolute',
          inset: '0',
          zIndex: '40',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingInline: '3',
          paddingTop: '12vh',
          _compact: {
            paddingInline: '2',
            paddingTop: 'max(8px,env(safe-area-inset-top))',
          },
        }),
        'modal-overlay',
      ),
    )
    .children(
      h.div
        .attr('role', 'dialog')
        .attr('aria-modal', 'true')
        .attr('aria-label', t.palette.title)
        .onMount(PaletteFocus({}))
        .class(
          cx(
            css({
              display: 'flex',
              width: 'min(620px,100%)',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRadius: '2xl',
              layerStyle: 'surface',
              boxShadow: 'float',
            }),
            'enter-modal',
          ),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                height: '12',
                flexShrink: '0',
                alignItems: 'center',
                gap: '2.5',
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderColor: 'hairline',
                paddingInline: '3.5',
              }),
            )
            .children(
              icon(
                h,
                Search,
                css({
                  width: '4',
                  height: '4',
                  flexShrink: '0',
                  color: 'mutedForeground',
                }),
              ),
              h.input
                .attr('id', 'palette-search')
                .attr('type', 'text')
                .attr('value', model.palette.query)
                .attr('placeholder', t.palette.search)
                .attr('aria-label', t.palette.search)
                .attr('role', 'combobox')
                .attr('aria-expanded', 'true')
                .attr('aria-controls', 'palette-results')
                .attr(
                  'aria-activedescendant',
                  active === null ? undefined : `palette-option-${active.id}`,
                )
                .attr('autocomplete', 'off')
                .attr('spellcheck', 'false')
                .class(
                  css({
                    height: '100%',
                    minWidth: '0',
                    flex: '1 1 0%',
                    backgroundColor: 'transparent',
                    fontSize: 'type.15',
                    letterSpacing: 'subtle',
                    color: 'foreground',
                    caretColor: 'foreground',
                    outlineStyle: 'none',
                    '&::placeholder': { color: 'mutedForeground' },
                  }),
                )
                .on('input', ({ value }) => Message.PaletteQueryChanged({ query: value }))
                .on(
                  'keydown',
                  (payload) => {
                    if (payload.key === 'Escape') return Message.PaletteClosed()
                    if (payload.key === 'ArrowDown' || payload.key === 'ArrowUp')
                      return Message.PaletteMoved({ delta: payload.key === 'ArrowDown' ? 1 : -1 })
                    if (payload.key === 'Enter')
                      return active === null ? undefined : Message.PaletteChosen({ id: active.id })
                    if ((payload.meta || payload.ctrl) && payload.key.toLowerCase() === 'k')
                      return Message.PaletteClosed()
                    return undefined
                  },
                  { preventDefault: true },
                ),
              kbd(h, t.panels.esc, css({ flexShrink: '0' })),
            ),
          results(h, rows, active, model.palette.query, t),
        ),
    )
}
