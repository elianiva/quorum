import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option } from 'effect'
import { Mount } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Search } from 'lucide'
import { EYEBROW } from '@quorum/ui/game/bits'
import { icon } from '@quorum/ui/primitives/icon'
import { Kbd } from '@quorum/ui/primitives/kbd'
import { copy, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import {
  activeOf,
  commandsOf,
  matchesOf,
  PALETTE_GROUPS,
  type PaletteCommand,
} from '@/game/palette.ts'
import { partCells } from './part-row.ts'
import type { Model } from '@/game/model.ts'

/**
 * The search field takes the keyboard when the palette opens, and the list
 * follows the highlighted row, so the arrows never move past the fold.
 */
export const PaletteFocus = Mount.define('PaletteFocus', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
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
        // Tab stays in the field: the rows are arrows and Enter, not a tab order.
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
    ).pipe(Effect.as(Message.Synced())),
})

/** The keys the board runs it with, in the app's keycap. */
const shortcut = (command: PaletteCommand, h: HtmlBuilder<Message>): Html =>
  command.keys === undefined
    ? h.empty
    : h.span(
        [
          h.Class(
            css({
              display: 'flex',
              flexShrink: '0',
              alignItems: 'center',
              gap: '1',
            }),
          ),
          h.AriaHidden(true),
        ],
        command.keys.map((key) =>
          Kbd(
            {
              className: css({
                flexShrink: '0',
                minWidth: '0',
                paddingInline: '1.5',
              }),
            },
            [key],
            h,
          ),
        ),
      )

/** What Enter does to the highlighted row: its one action, in the ink fill. */
const runHint = (h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        css({
          display: 'flex',
          flexShrink: '0',
          alignItems: 'center',
        }),
      ),
      h.AriaHidden(true),
    ],
    [
      Kbd(
        {
          className: css({
            flexShrink: '0',
            minWidth: '0',
            paddingInline: '1.5',
            layerStyle: 'primaryFill',
            color: 'onPrimaryFill',
            boxShadow: 'primary',
          }),
        },
        ['↵'],
        h,
      ),
    ],
  )

/** Every other row: the mark in a quiet tile, then its name. */
const plainCell = (
  command: PaletteCommand,
  active: boolean,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.span(
    [
      h.Class(
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
      ),
    ],
    [
      icon(
        h,
        command.glyph,
        css({
          width: '15px',
          height: '15px',
        }),
      ),
    ],
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
          lineHeight: 'none',
        }),
      ),
    ],
    [command.label],
  ),
]

/** One row: the mark, its name, its shortcut, and what Enter does to it. */
const row = (command: PaletteCommand, active: boolean, h: HtmlBuilder<Message>): Html =>
  h.button(
    [
      h.Key(command.id),
      h.Id(`palette-option-${command.id}`),
      h.Type('button'),
      h.Role('option'),
      h.Tabindex(-1),
      h.AriaSelected(active),
      ...(active ? [h.DataAttribute('palette-active', '')] : []),
      h.OnClick(Message.PaletteChosen({ id: command.id })),
      h.OnMouseMove(Message.PaletteHighlighted({ id: command.id })),
      h.Class(
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
          command.part?.locked !== null && command.part !== undefined
            ? css({
                opacity: 0.7,
              })
            : '',
          active
            ? css({
                backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
                color: 'foreground',
              })
            : css({
                color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                },
              }),
        ),
      ),
    ],
    [
      ...(command.part === undefined ? plainCell(command, active, h) : partCells(command.part, h)),
      shortcut(command, h),
      active ? runHint(h) : h.empty,
    ],
  )

/** The rows, grouped by area in the order the palette lists them. */
const results = (
  rows: ReadonlyArray<PaletteCommand>,
  active: PaletteCommand | null,
  query: string,
  t: Messages,
  h: HtmlBuilder<Message>,
): Html => {
  const frame = css({
    maxHeight: 'min(52vh, 420px)',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    padding: '1.5',
    scrollbarWidth: 'thin',
  })
  if (rows.length === 0)
    return h.div(
      [h.Id('palette-results'), h.Role('status'), h.Class(frame)],
      [
        h.p(
          [
            h.Class(
              css({
                paddingInline: '2.5',
                paddingBlock: '10',
                textAlign: 'center',
                fontSize: 'type.12-5',
                color: 'mutedForeground',
              }),
            ),
          ],
          [t.palette.noMatches(query)],
        ),
      ],
    )
  return h.div(
    [h.Id('palette-results'), h.Role('listbox'), h.AriaLabel(t.palette.title), h.Class(frame)],
    PALETTE_GROUPS.flatMap((group) => {
      const groupRows = rows.filter((command) => command.group === group)
      if (groupRows.length === 0) return []
      return [
        h.div(
          [h.Key(`group-${group}`), h.Role('group'), h.AriaLabel(t.palette.groups[group])],
          [
            h.div(
              [
                h.Class(
                  cx(
                    EYEBROW,
                    css({
                      paddingInline: '2.5',
                      paddingBottom: '1.5',
                    }),
                    group === PALETTE_GROUPS[0]
                      ? css({
                          paddingTop: '1',
                        })
                      : css({
                          paddingTop: '3',
                        }),
                  ),
                ),
                h.AriaHidden(true),
              ],
              [t.palette.groups[group]],
            ),
            ...groupRows.map((command) => row(command, command.id === active?.id, h)),
          ],
        ),
      ]
    }),
  )
}

/** The command palette over the board: one search field, and every action grouped by area. */
export const commandPalette = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  if (!model.palette.open) return h.empty
  const rows = matchesOf(commandsOf(t, model), t, model.palette.query)
  const active = activeOf(rows, model.palette.query, model.palette.active)
  return h.div(
    [
      h.Key('palette'),
      h.DataAttribute('exit', 'gesture'),
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Role('dialog'),
          h.AriaModal(true),
          h.AriaLabel(t.palette.title),
          h.OnMount(PaletteFocus()),
          h.Class(
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
          ),
        ],
        [
          h.div(
            [
              h.Class(
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
              ),
            ],
            [
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
              h.input([
                h.Id('palette-search'),
                h.Type('text'),
                h.Value(model.palette.query),
                h.Placeholder(t.palette.search),
                h.AriaLabel(t.palette.search),
                h.Role('combobox'),
                h.AriaExpanded(true),
                h.AriaControls('palette-results'),
                ...(active === null ? [] : [h.AriaActiveDescendant(`palette-option-${active.id}`)]),
                h.Autocomplete('off'),
                h.Spellcheck(false),
                h.Class(
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
                    '&::placeholder': {
                      color: 'mutedForeground',
                    },
                  }),
                ),
                h.OnInput((query: string) => Message.PaletteQueryChanged({ query })),
                h.OnKeyDownPreventDefault((key, modifiers) => {
                  if (key === 'Escape') return Option.some(Message.PaletteClosed())
                  if (key === 'ArrowDown' || key === 'ArrowUp')
                    return Option.some(
                      Message.PaletteMoved({ delta: key === 'ArrowDown' ? 1 : -1 }),
                    )
                  if (key === 'Enter')
                    return active === null
                      ? Option.none()
                      : Option.some(Message.PaletteChosen({ id: active.id }))
                  if ((modifiers.metaKey || modifiers.ctrlKey) && key.toLowerCase() === 'k')
                    return Option.some(Message.PaletteClosed())
                  return Option.none()
                }),
              ]),
              Kbd(
                {
                  className: css({
                    flexShrink: '0',
                  }),
                },
                [t.panels.esc],
                h,
              ),
            ],
          ),
          results(rows, active, model.palette.query, t, h),
        ],
      ),
    ],
  )
}
