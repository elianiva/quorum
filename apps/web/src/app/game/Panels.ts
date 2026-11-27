import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import {
  ArrowUpRight,
  ChevronDown,
  Command,
  Copy,
  DoorOpen,
  Download,
  House,
  LogOut,
  Play,
  Settings,
  Trash2,
  Users,
  WifiOff,
  X,
  type IconNode,
} from 'lucide'
import { browserFamilyOf, onIos } from '@/platform/pwa.ts'
import { offer } from '@quorum/simulation/actions'
import { PRE_IPO_STAGE } from '@quorum/simulation/ipo'
import {
  COMPONENT_IDS,
  COMPONENTS,
  ERAS,
  INCIDENT_IDS,
  REQUEST_KINDS,
  RESEARCH,
  RESEARCH_IDS,
} from '@quorum/simulation/catalog'
import { dilutionOf, grantOf } from '@quorum/simulation/founding'
import { eraOf, isFinalEra, nextEra } from '@quorum/simulation/lookups'
import { cheatCash, cheatInsight } from '@/game/cheats.ts'
import { clock, compact, money } from '@quorum/ui/game/format'
import { copy, eraWords, localized, type Messages } from '@/i18n/messages.ts'
import { supportedLocales, type Locale } from '@/i18n/index.ts'
import { Message } from '@/game/message.ts'
import {
  currentFile,
  easyMode,
  exitLegacy,
  playingId,
  roomCode,
  roomLive,
  roomOwner,
  type Model,
  type SettingsSection,
} from '@/game/model.ts'
import { seatColour } from '@/game/seat-colour.ts'
import { speedsOf } from '@/game/update/constant.ts'
import { modShortcut } from '@/game/palette.ts'
import { pwaInstallable, pwaInstalled } from '@/game/pwa-machine.ts'
import { ROOM_NAME_LENGTH } from '@/game/names.ts'
import { RoomPhase } from '@/game/room-machine.ts'
import { seatOf } from '@/platform/room-socket.ts'
import { agentRoomId } from '@/game/agent-room.ts'
import { logoOf, type LogoId } from '@/game/logos.ts'
import { PrefsMessage } from '@/game/prefs.ts'
import { settingsSections, type Setting } from '@/game/settings.ts'
import type { Vote } from '@quorum/simulation/room'
import { openVoteOf } from '@quorum/simulation/vote-machine'
import { EYEBROW, FIGURE, FIGURE_STYLE, FLOAT, NESTED, SCROLL, WELL } from '@quorum/ui/game/bits'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const PanelFocus = Mount.make('PanelFocus', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const before =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
          element.focus()
          const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab') return
            const items = [...element.querySelectorAll<HTMLElement>(FOCUSABLE)]
            const first = items[0]
            const last = items[items.length - 1]
            if (first === undefined || last === undefined) return
            if (
              event.shiftKey &&
              (document.activeElement === first || document.activeElement === element)
            ) {
              event.preventDefault()
              last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault()
              first.focus()
            }
          }
          element.addEventListener('keydown', onKeyDown)
          return () => {
            element.removeEventListener('keydown', onKeyDown)
            if (
              element.contains(document.activeElement) ||
              document.activeElement === document.body
            )
              before?.focus()
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    key?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label | Child>,
): Content => {
  const base = h.button
    .key(config.key ?? '')
    .attr('type', config.type ?? 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .class(buttonClass(config.variant, config.size), config.className)
    .attr('data-slot', 'button')
    .attrs(config.attributes ?? {})
  const clickable =
    config.onClick !== undefined && config.isDisabled !== true
      ? base.on('click', () => config.onClick)
      : base
  const inputs: ReadonlyArray<View.Input<Message>> = Array.isArray(label) ? label : [label]
  return clickable.children(...inputs)
}

const OVERLAY = cx(
  'modal-overlay',
  css({
    position: 'absolute',
    inset: '0',
    zIndex: '30',
    display: 'grid',
    placeItems: 'center',
    padding: '6',
    _compact: { padding: '0' },
    _short: {
      '[data-toast="on"] &': { paddingTop: '3rem !important' },
    },
  }),
)

const DIALOG = css({
  display: 'flex',
  maxHeight: '100%',
  width: '100%',
  flexDirection: 'column',
  overflow: 'hidden',
  outlineStyle: 'none',
  _compact: {
    height: '100%',
    maxHeight: 'none',
    maxWidth: 'none',
    borderRadius: '0',
    paddingBottom: 'env(safe-area-inset-bottom)',
    boxShadow: 'none',
  },
})

const SHELL_HEAD = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  paddingInline: '5',
  paddingTop: '4',
  paddingBottom: '3',
  _compact: {
    paddingInline: '4',
    paddingTop: 'max(12px,env(safe-area-inset-top))',
  },
})

const SHELL_TITLE = css({
  fontSize: 'type.17',
  fontWeight: 'semibold',
  letterSpacing: 'tight',
})

const SHELL_TOOLS = css({ display: 'flex', alignItems: 'center', gap: '3' })

const SHELL_CLOSE = css({
  color: 'mutedForeground',
  _compact: {
    width: '11',
    height: '11',
  },
})

/* The panel frame `components/lab/panels.ts` drew, hand-written for Effect UI. */
const shell = (
  h: H<Message>,
  t: Messages,
  title: string,
  right: ReadonlyArray<Child>,
  body: ReadonlyArray<Child>,
  width: string,
): Content =>
  h.div
    .attr('data-exit', 'gesture')
    .class(OVERLAY)
    .children(
      h.div
        .key(title)
        .attr('role', 'dialog')
        .attr('aria-modal', 'true')
        .attr('aria-label', title)
        .attr('tabindex', '-1')
        .onMount(PanelFocus({}))
        .class(cx(DIALOG, width, FLOAT, 'enter-modal'))
        .children(
          h.div.class(SHELL_HEAD).children(
            h.span.class(SHELL_TITLE).children(title),
            h.div.class(SHELL_TOOLS).children(
              ...right,
              button(
                h,
                {
                  onClick: Message.PanelClosed(),
                  variant: 'ghost',
                  size: 'icon',
                  className: SHELL_CLOSE,
                  attributes: { 'aria-label': t.panels.closeEsc },
                },
                icon(h, X, css({ width: '4', height: '4' })),
              ),
            ),
          ),
          ...body,
        ),
    )

const primaryButton = (label: string, message: Message, h: H<Message>): Content =>
  button(
    h,
    {
      onClick: message,
      size: 'lg',
      className: css({
        paddingInline: '4',
      }),
    },
    label,
  )

const secondaryButton = (
  label: string,
  message: Message,
  h: H<Message>,
  glyph?: IconNode,
): Content =>
  button(
    h,
    {
      onClick: message,
      variant: 'outline',
      size: 'lg',
      className: css({
        paddingInline: '3.5',
      }),
    },
    [...(glyph ? [icon(h, glyph, css({ width: '4', height: '4' }))] : []), label],
  )

const agentRoomRow = (model: Model, h: H<Message>): Child => {
  const t = copy(h)
  const company = playingId(model)
  const id = company === null ? null : agentRoomId(company)
  if (id === null) return undefined
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
        paddingInline: '4',
        paddingBlock: '2.5',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(t.panels.agentRoom),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          }),
        )
        .children(
          h.code
            .class(
              css({
                minWidth: '0',
                flex: '1 1 0%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'mono',
                fontSize: 'type.12',
                lineHeight: 'compact',
              }),
            )
            .children(id),
          secondaryButton(t.panels.copyAgentRoom, Message.AgentRoomCopied(), h, Copy),
        ),
    )
}

const footer = (children: ReadonlyArray<Child>, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        justifyContent: 'flex-end',
        gap: '2',
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderColor: 'hairline',
        backgroundColor: 'nested',
        paddingInline: '5',
        paddingBlock: '3',
      }),
    )
    .children(...children)

const stat = (name: string, value: string, h: H<Message>): Content =>
  h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1',
        paddingInline: '4',
        paddingBlock: '3',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(name),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.18',
            }),
          ),
        )
        .children(value),
    )

const stats = (columns: string, children: ReadonlyArray<Child>, h: H<Message>): Content =>
  h.div
    .class(
      cx(
        css({
          display: 'grid',
          width: '100%',
          '& > :not(:last-child)': {
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderColor: 'hairline',
          },
        }),
        WELL,
        columns,
      ),
    )
    .children(...children)

const stepsOf = (t: Messages): ReadonlyArray<readonly [string, string]> => [
  [t.panels.wireIt, t.panels.dragFromANodeSBlue],
  [t.panels.collect, t.panels.revenueWaitsInPaymentsPressCollect],
  [t.panels.learn, t.panels.analyticsSamplesLinkedNodesEachRequest],
  [t.panels.findTheLimit, t.panels.thePulsingOutlineMarksTheBottleneck],
  [t.panels.grow, t.panels.usersGrowWhileApdexBeatsThe],
  [t.panels.raise, t.panels.atTheUserTargetTakeOr],
]

type KeyGroup = readonly [label: string, rows: ReadonlyArray<readonly [string, string]>]

const keyGroupsOf = (t: Messages, easy: boolean): ReadonlyArray<KeyGroup> => [
  [
    t.panels.keysBuild,
    [
      ['1–7', t.panels.buildGroup],
      [t.panels.enter, t.panels.inspectorPlaceConfirm],
    ],
  ],
  [
    t.panels.keysClock,
    [
      ['Z', t.panels.undo],
      [t.panels.shiftZ, t.panels.redo],
      ['C', t.panels.collect],
      ...(easy ? [['S', t.panels.speed] as const, [t.panels.space, t.panels.pause] as const] : []),
      ['M', t.panels.mute],
      ['F', t.panels.fullscreen],
      [t.panels.shiftT, t.panels.tidyByRole],
      [t.panels.shiftF, t.panels.fitTheBoard],
    ],
  ],
  [
    t.panels.keysSelect,
    [
      ['L', t.panels.linkTheSelectedNode],
      [t.panels.arrows, t.panels.selectNearestNode],
      [t.panels.shiftArrows, t.panels.nudgeNodes16Px],
      ['U', t.panels.resizeSelected],
      [t.panels.shiftClick, t.panels.selectForAPlaybook],
      ['Ctrl+A', t.panels.selectAll],
      [t.panels.ctrlCXV, t.panels.copyCutPasteNodes],
      ['Ctrl+D', t.panels.duplicateNodes],
      [t.panels.shiftCtrlAltDrag, t.panels.addToRemoveFromSelection],
      [t.panels.del, t.panels.sellSelected],
    ],
  ],
  [
    t.panels.keysPanels,
    [
      ['R', t.panels.research],
      ['T', t.panels.team],
      ['P', t.panels.playbooks],
      ['D', t.panels.dashboard],
      ['I', t.panels.inbox],
      ['$', t.panels.cost],
      ['`', t.panels.developerPanel],
      [modShortcut('K'), t.palette.title],
      [t.panels.esc, t.panels.backOutThenMenu],
    ],
  ],
]

const keyColumnRule = (index: number): string =>
  index === 0
    ? ''
    : index === 1
      ? css({
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          borderColor: 'hairline',
          _compact: {
            borderLeftWidth: '0',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
          },
        })
      : css({
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          borderColor: 'hairline',
          '@media (max-width: 1000px)': {
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderLeftWidth: '0',
          },
          _compact: { borderLeftWidth: '0' },
        })

/* The kbd primitive's markup, copied from packages/ui/src/primitives/kbd.ts. */
const KBD_CLASS = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'color-mix(in oklab, var(--foreground) 75%, transparent)',
  '[data-slot="tooltip-content"] &': {
    backgroundColor: 'color-mix(in oklab, var(--background) 20%, transparent)',
    backgroundImage: 'none',
    boxShadow: 'none',
    color: 'background',
  },
  _dark: {
    '[data-slot="tooltip-content"] &': {
      backgroundColor: 'color-mix(in oklab, var(--background) 10%, transparent)',
    },
  },
  height: '5',
  width: 'fit-content',
  minWidth: '5',
  gap: '1',
  borderRadius: 'sm',
  paddingInline: '1.5',
  fontFamily: 'mono',
  fontSize: 'type.10-5',
  fontWeight: 'medium',
  '& svg:not([data-svg-icon])': { width: '3', height: '3' },
  pointerEvents: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

const kbd = (h: H<Message>, label: string, className = ''): Content =>
  h.kbd.attr('data-slot', 'kbd').class(cx(KBD_CLASS, className)).children(label)

const keyRow = ([key, action]: readonly [string, string], h: H<Message>): Content =>
  h.div
    .key(action)
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '3',
        paddingBlock: '0.5',
        fontSize: 'type.12',
        lineHeight: 'snug',
      }),
    )
    .children(
      h.span.class(css({ color: 'mutedForeground' })).children(action),
      kbd(h, key, css({ flexShrink: '0' })),
    )

const stepCell = (
  [title, body]: readonly [string, string],
  index: number,
  h: H<Message>,
): Content => {
  const first = index === 0
  return h.li
    .key(title)
    .class(
      cx(
        css({
          display: 'flex',
          flexDirection: 'column',
          paddingInline: '4',
          paddingBlock: '2.5',
        }),
        first
          ? css({
              layerStyle: 'primaryFill',
              color: 'onPrimaryFill',
              _dark: {
                layerStyle: 'raised',
                color: 'foreground',
              },
            })
          : css({
              layerStyle: 'surface',
            }),
      ),
    )
    .children(
      h.span
        .class(
          cx(
            css(FIGURE_STYLE, {
              fontSize: 'type.23',
              lineHeight: 'none',
              fontWeight: 'medium',
              letterSpacing: 'tighter',
            }),
            first
              ? css({
                  color: 'onPrimaryFill',
                  _dark: {
                    color: 'mutedForeground',
                  },
                })
              : css({
                  color: 'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
                }),
          ),
        )
        .children(String(index + 1).padStart(2, '0')),
      h.span
        .class(
          css({
            marginTop: '2',
            fontSize: 'type.15',
            fontWeight: 'semibold',
            letterSpacing: 'body',
          }),
        )
        .children(title),
      h.span
        .class(
          cx(
            css({
              marginTop: '1',
              fontSize: 'type.12',
              lineHeight: 'relaxed',
            }),
            first
              ? css({
                  color: 'color-mix(in oklab, var(--on-primary-fill) 70%, transparent)',
                  _dark: {
                    color: 'mutedForeground',
                  },
                })
              : css({
                  color: 'mutedForeground',
                }),
          ),
        )
        .children(body),
    )
}

export const helpPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const groups = keyGroupsOf(t, easyMode(model))
  const columns = [groups.slice(0, 2), groups.slice(2, 3), groups.slice(3)]
  return shell(
    h,
    t,
    t.panels.howToPlay,
    [],
    [
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              minHeight: '0',
              flexDirection: 'column',
              gap: '3',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '4',
              _compact: {
                gap: '4',
              },
            }),
            SCROLL,
          ),
        )
        .children(
          h.ol
            .class(
              css({
                display: 'grid',
                flexShrink: '0',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.25',
                overflow: 'hidden',
                borderRadius: 'xl',
                backgroundColor: 'hairline',
                boxShadow: 'line',
                '@media (max-width: 1000px)': {
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                },
                _compact: {
                  gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                },
              }),
            )
            .children(...stepsOf(t).map((step, index) => stepCell(step, index, h))),
          h.section
            .class(
              css({
                display: 'flex',
                flexShrink: '0',
                flexDirection: 'column',
                gap: '1.5',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.panels.keys),
              h.div
                .class(
                  css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    overflow: 'hidden',
                    borderRadius: 'xl',
                    backgroundColor: 'nested',
                    boxShadow: 'line',
                    '@media (max-width: 1000px)': {
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    },
                    _compact: {
                      gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                    },
                  }),
                )
                .children(
                  ...columns.map((columnGroups, index) =>
                    h.div
                      .class(
                        cx(
                          css({
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2.5',
                            padding: '2',
                          }),
                          keyColumnRule(index),
                        ),
                      )
                      .children(
                        ...columnGroups.map(([label, rows]) =>
                          h.div
                            .key(label)
                            .class(
                              css({
                                display: 'flex',
                                flexDirection: 'column',
                              }),
                            )
                            .children(
                              h.span.class(EYEBROW).children(label),
                              h.div
                                .class(
                                  css({
                                    marginTop: '0.5',
                                    '& > :not(:last-child)': {
                                      borderBottomWidth: '1px',
                                      borderBottomStyle: 'solid',
                                      borderColor: 'hairline',
                                    },
                                  }),
                                )
                                .children(...rows.map((row) => keyRow(row, h))),
                            ),
                        ),
                      ),
                  ),
                ),
            ),
        ),
      footer([primaryButton(t.panels.startBuilding, Message.PanelClosed(), h)], h),
    ],
    css({ maxWidth: '1040px' }),
  )
}

/* The company mark `@/components/company-mark.ts` drew, hand-written for Effect UI. */
const companyMark = (logo: LogoId, className: string, h: H<Message>): Content => {
  const def = logoOf(logo)
  return h.svg
    .attr('viewBox', '0 0 24 24')
    .class(className)
    .attr('aria-hidden', 'true')
    .style({ color: `oklch(0.8 0.15 ${def.hue})` })
    .children(
      ...def.paths.map((d) =>
        h.path
          .attr('d', d)
          .attr('fill', 'none')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '1.9')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .children(),
      ),
    )
}

const menuItem = (
  label: string,
  glyph: IconNode,
  message: Message,
  h: H<Message>,
  variant: ButtonVariant = 'outline',
  trailing?: Child,
): Content =>
  button(
    h,
    {
      onClick: message,
      variant,
      size: 'row',
      key: label,
      className: cx(
        css({
          width: '100%',
          justifyContent: 'flex-start',
        }),
        trailing === undefined
          ? ''
          : css({
              paddingRight: '2',
            }),
      ),
    },
    [
      icon(
        h,
        glyph,
        css({
          width: '18px',
          height: '18px',
          flexShrink: '0',
        }),
      ),
      h.span
        .class(
          css({
            minWidth: '0',
            flex: '1 1 0%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'left',
          }),
        )
        .children(label),
      ...(trailing === undefined ? [] : [trailing]),
    ],
  )

export const menuPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const file = currentFile(model)
  const rule = h.div
    .class(
      css({
        marginBlock: '1',
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderColor: 'hairline',
      }),
    )
    .children()
  return shell(
    h,
    t,
    t.panels.menu,
    [],
    [
      ...(file
        ? [
            h.div
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  paddingInline: '5',
                  paddingBottom: '4',
                }),
              )
              .children(
                companyMark(
                  file.logo,
                  css({
                    width: '8',
                    height: '8',
                    flexShrink: '0',
                  }),
                  h,
                ),
                h.div
                  .class(
                    css({
                      display: 'flex',
                      minWidth: '0',
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
                          fontSize: 'type.15',
                          fontWeight: 'semibold',
                        }),
                      )
                      .children(file.name),
                    h.span
                      .class(
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 'type.12',
                          lineHeight: 'compact',
                          color: 'mutedForeground',
                        }),
                      )
                      .children(
                        `${t.catalog.ventures[file.venture].name} · ${eraWords(t, model.board.game).name}`,
                      ),
                  ),
              ),
          ]
        : []),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'hairline',
            paddingInline: '5',
            paddingTop: '4',
            paddingBottom: '5',
          }),
        )
        .children(
          menuItem(
            t.panels.resume,
            Play,
            Message.PanelClosed(),
            h,
            'default',
            kbd(h, t.panels.esc, css({ flexShrink: '0' })),
          ),
          rule,
          menuItem(
            t.palette.title,
            Command,
            Message.PaletteOpened(),
            h,
            'outline',
            kbd(h, modShortcut('K'), css({ flexShrink: '0' })),
          ),
          menuItem(t.panels.settings, Settings, Message.PanelOpened({ panel: 'settings' }), h),
          menuItem(
            roomCode(model) === null ? t.room.title : `${t.room.title} · ${roomCode(model)}`,
            Users,
            Message.PanelOpened({ panel: 'room' }),
            h,
          ),
          rule,
          exitLegacy(model) === null
            ? undefined
            : menuItem(t.panels.exitCompany, DoorOpen, Message.PanelOpened({ panel: 'exit' }), h),
          menuItem(t.panels.titleScreen, House, Message.TitleOpened(), h, 'ghost'),
        ),
    ],
    css({ maxWidth: 'calc(340px * var(--type-scale))' }),
  )
}

const VOTE_TITLE = { fund: 'voteFund', decline: 'voteDecline', exit: 'voteExit' } as const

const voteCard = (model: Model, open: Vote, h: H<Message>): Content => {
  const t = copy(h)
  const seat = seatOf()
  const mine = open.yes.includes(seat) ? 'yes' : open.no.includes(seat) ? 'no' : null
  return h.div
    .class(
      cx(
        WELL,
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2.5',
          padding: '3',
        }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '3',
          }),
        )
        .children(
          h.span
            .class(
              css({
                fontSize: 'type.14',
                lineHeight: 'fine',
                fontWeight: 'medium',
              }),
            )
            .children(t.room[VOTE_TITLE[open.kind]]),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.12',
                  lineHeight: 'compact',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(`${open.yes.length} / ${model.room.seats.length}`),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '1.5',
          }),
        )
        .children(
          ...model.room.seats.map((entry) => {
            const colour = seatColour(entry.colour)
            const yes = open.yes.includes(entry.id)
            const no = open.no.includes(entry.id)
            return h.span
              .key(`ballot-${entry.id}`)
              .class(
                css({
                  width: '2',
                  height: '2',
                  borderRadius: 'full',
                }),
              )
              .style({
                background: no ? 'transparent' : colour,
                boxShadow: no ? `inset 0 0 0 1px ${colour}` : 'none',
                opacity: yes || no ? '1' : '0.3',
              })
              .children()
          }),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            gap: '2',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.RoomBallot({ vote: open.id, yes: true }),
              variant: mine === 'yes' ? 'default' : 'outline',
              size: 'lg',
              className: css({
                flex: '1 1 0%',
              }),
            },
            t.room.coins,
          ),
          button(
            h,
            {
              onClick: Message.RoomBallot({ vote: open.id, yes: false }),
              variant: mine === 'no' ? 'secondary' : 'outline',
              size: 'lg',
              className: css({
                flex: '1 1 0%',
              }),
            },
            t.room.no,
          ),
        ),
    )
}

export const roomPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const phase = model.room.phase
  const file = currentFile(model)
  const owner = roomOwner(model)
  const live = RoomPhase.isAnyOf(['Online', 'Reconnecting'])(phase)
  const vote = openVoteOf(model.room.vote)
  const seat = seatOf()
  const unchanged = model.room.draft.trim() === model.room.name

  const section = (label: string, rows: ReadonlyArray<Child>): Content =>
    h.div
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2.5',
          paddingInline: '5',
          paddingTop: '4',
        }),
      )
      .children(h.span.class(EYEBROW).children(label), ...rows)

  const divider = (): Content =>
    h.div
      .class(
        css({
          marginInline: '5',
          marginTop: '2.5',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'hairline',
        }),
      )
      .children()

  const codeBlock = (code: string): Content =>
    h.div
      .class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5',
          paddingInline: '5',
          paddingTop: '3',
        }),
      )
      .children(
        h.span.class(EYEBROW).children(t.room.code),
        h.div
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3',
            }),
          )
          .children(
            h.span
              .class(
                css(FIGURE_STYLE, {
                  fontSize: 'type.20',
                  fontWeight: 'medium',
                  letterSpacing: 'overline',
                }),
              )
              .children(code),
            button(
              h,
              {
                onClick: Message.RoomLinkCopied(),
                variant: 'outline',
                size: 'sm',
                className: css({
                  gap: '1.5',
                }),
                attributes: { 'aria-label': t.room.copyLink },
              },
              [icon(h, Copy, css({ width: '3.5', height: '3.5' })), t.room.copyLink],
            ),
          ),
      )

  const nameBlock = h.div
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        gap: '2',
        paddingInline: '5',
        paddingTop: '3',
      }),
    )
    .children(
      h.label
        .class(
          cx(
            WELL,
            css({
              display: 'flex',
              height: '9',
              minWidth: '0',
              flex: '1 1 0%',
              alignItems: 'center',
              paddingInline: '2.5',
            }),
          ),
        )
        .children(
          h.input
            .attr('type', 'text')
            .value(model.room.draft)
            .attr('maxlength', String(ROOM_NAME_LENGTH))
            .attr('autocomplete', 'off')
            .attr('spellcheck', 'false')
            .attr('aria-label', t.room.yourName)
            .on('input', ({ value }) => Message.RoomNameChanged({ name: value }))
            .on(
              'keydown',
              (payload) => (payload.key === 'Enter' ? Message.RoomNameSaved() : undefined),
              { preventDefault: true },
            )
            .class(
              css({
                width: '100%',
                minWidth: '0',
                backgroundColor: 'transparent',
                fontSize: 'type.14',
                lineHeight: 'fine',
                outlineStyle: 'none',
              }),
            ),
        ),
      button(
        h,
        {
          onClick: Message.RoomNameSaved(),
          variant: unchanged ? 'outline' : 'default',
          size: 'lg',
          isDisabled: unchanged,
        },
        t.room.saveName,
      ),
    )

  const seatChips = h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5',
      }),
    )
    .children(
      ...model.room.seats.map((entry) => {
        const colour = seatColour(entry.colour)
        return h.div
          .key(entry.id)
          .class(
            css({
              display: 'flex',
              minWidth: '0',
              alignItems: 'center',
              gap: '1.5',
              borderRadius: 'full',
              backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
              paddingBlock: '1',
              paddingRight: '1.5',
              paddingLeft: '2',
              fontSize: 'type.12',
              lineHeight: 'compact',
            }),
          )
          .children(
            h.span
              .class(
                css({
                  width: '1.5',
                  height: '1.5',
                  flexShrink: '0',
                  borderRadius: 'full',
                }),
              )
              .style({ background: colour })
              .children(),
            h.span
              .class(
                css({
                  minWidth: '0',
                  maxWidth: '36',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 'medium',
                }),
              )
              .children(entry.name),
            entry.owner
              ? h.span
                  .class(
                    css({
                      flexShrink: '0',
                      fontSize: 'type.10',
                      textTransform: 'uppercase',
                      letterSpacing: 'eyebrow',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.room.owner)
              : undefined,
            entry.id === seat
              ? h.span
                  .class(
                    css({
                      flexShrink: '0',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.room.you)
              : undefined,
            owner && !entry.owner
              ? button(
                  h,
                  {
                    onClick: Message.RoomKickAsked({ seat: entry.id }),
                    variant: 'ghost',
                    size: 'icon-xs',
                    className: css({
                      width: '5',
                      height: '5',
                      color: 'mutedForeground',
                    }),
                    attributes: { 'aria-label': t.room.kick },
                  },
                  icon(h, X, css({ width: '3', height: '3' })),
                )
              : undefined,
          )
      }),
    )

  const voteStart = h.div
    .class(
      css({
        display: 'flex',
        gap: '2',
      }),
    )
    .children(
      button(
        h,
        {
          onClick: Message.RoomVoteAsked({ kind: 'fund' }),
          variant: 'outline',
          size: 'lg',
          className: css({
            minWidth: '0',
            flex: '1 1 0%',
            gap: '1.5',
            paddingInline: '2',
          }),
        },
        [icon(h, ArrowUpRight, css({ width: '4', height: '4' })), t.room.voteFund],
      ),
      button(
        h,
        {
          onClick: Message.RoomVoteAsked({ kind: 'exit' }),
          variant: 'outline',
          size: 'lg',
          className: css({
            minWidth: '0',
            flex: '1 1 0%',
            gap: '1.5',
            paddingInline: '2',
          }),
        },
        [icon(h, DoorOpen, css({ width: '4', height: '4' })), t.room.voteExit],
      ),
    )

  const speedRow = h.div
    .class(
      css({
        display: 'flex',
        gap: '1.5',
      }),
    )
    .children(
      ...[0.5, 1, 3, 10].map((speed) =>
        button(
          h,
          {
            onClick: Message.RoomSpeedChosen({ value: speed }),
            variant: model.room.speed === speed ? 'default' : 'outline',
            size: 'lg',
            className: cx(
              FIGURE,
              css({
                flex: '1 1 0%',
              }),
            ),
          },
          `${speed}×`,
        ),
      ),
    )

  const body: Array<Child> = []

  if (RoomPhase.isAnyOf(['Idle', 'Closed'])(phase)) {
    body.push(
      h.p
        .class(
          css({
            paddingInline: '5',
            paddingTop: '4',
            fontSize: 'type.14',
            lineHeight: 'fine',
            color: 'mutedForeground',
          }),
        )
        .children(t.room.onlineHint),
    )
    if (!model.pwa.online)
      body.push(
        h.p
          .class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2',
              paddingInline: '5',
              paddingTop: '3',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'mutedForeground',
            }),
          )
          .children(
            icon(h, WifiOff, css({ marginTop: '0.5', width: '4', height: '4', flexShrink: '0' })),
            t.pwa.offlineNote,
          ),
      )
    if (file !== null)
      body.push(
        h.div
          .class(
            css({
              paddingInline: '5',
              paddingTop: '4',
            }),
          )
          .children(
            button(
              h,
              {
                onClick: Message.RoomPublishAsked(),
                size: 'lg',
                className: css({
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: '2.5',
                }),
                isDisabled: !model.pwa.online,
              },
              [
                icon(h, Play, css({ width: '4', height: '4' })),
                file.online === null ? t.room.online : `${t.room.code} ${file.online.code}`,
              ],
            ),
            h.p
              .class(
                css({
                  paddingTop: '2',
                  fontSize: 'type.12',
                  lineHeight: 'compact',
                  color: 'mutedForeground',
                }),
              )
              .children(t.room.joinHint),
          ),
      )
    if (RoomPhase.guards.Closed(phase))
      body.push(
        h.p
          .class(
            css({
              paddingInline: '5',
              paddingTop: '3',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'mutedForeground',
            }),
          )
          .children(t.room.ended),
      )
  } else {
    if (RoomPhase.guards.Connecting(phase))
      body.push(
        h.p
          .class(
            css({
              paddingInline: '5',
              paddingTop: '4',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'mutedForeground',
            }),
          )
          .children(t.room.joining),
      )
    if (RoomPhase.guards.Failed(phase))
      body.push(
        h.p
          .class(
            css({
              paddingInline: '5',
              paddingTop: '3',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'mutedForeground',
            }),
          )
          .children(phase.reason === 'full' ? t.room.full : t.room.connectFailed),
      )
    body.push(codeBlock(phase.code))
    body.push(nameBlock)
    if (live) {
      if (RoomPhase.guards.Reconnecting(phase))
        body.push(
          h.p
            .class(
              css({
                paddingInline: '5',
                paddingTop: '3',
                fontSize: 'type.12',
                lineHeight: 'compact',
                color: 'mutedForeground',
              }),
            )
            .children(t.room.connecting),
        )
      body.push(divider())
      body.push(section(`${t.room.seats} · ${model.room.seats.length}`, [seatChips]))
      body.push(divider())
      body.push(section(t.room.vote, vote === null ? [voteStart] : [voteCard(model, vote, h)]))
      if (owner) {
        body.push(divider())
        body.push(section(t.room.speed, [speedRow]))
      }
    }
  }

  const actions: Array<Child> = []
  if (live && owner) {
    actions.push(primaryButton(t.room.takeOffline, Message.RoomTakeOfflineAsked(), h))
    actions.push(secondaryButton(t.room.leave, Message.RoomLeaveAsked(), h, LogOut))
  } else if (live || RoomPhase.guards.Connecting(phase) || RoomPhase.guards.Failed(phase)) {
    actions.push(primaryButton(t.room.leave, Message.RoomLeaveAsked(), h))
  }

  return shell(
    h,
    t,
    t.room.title,
    [],
    [
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              minHeight: '0',
              flexDirection: 'column',
              overflowY: 'auto',
              paddingBottom: '4',
            }),
            SCROLL,
          ),
        )
        .children(...body),
      actions.length === 0 ? undefined : footer(actions, h),
    ],
    css({ maxWidth: 'calc(380px * var(--type-scale))' }),
  )
}

const settingSection = (label: string, rows: ReadonlyArray<Child>, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(label),
      h.div
        .class(
          cx(
            NESTED,
            css({
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }),
          ),
        )
        .children(...rows),
    )

const settingLabelClass = css({
  fontSize: 'type.13',
  fontWeight: 'medium',
  lineHeight: 'snug',
})
const settingRowClass = css({
  width: '100%',
  flexDirection: 'row-reverse',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '4',
  paddingInline: '4',
  paddingBlock: '2.5',
})

/* The switch primitive's markup, copied from packages/ui/src/primitives/switch.ts. */
const SWITCH_CLASS = cx(
  'peer-control',
  'group-switch',
  css({
    flexShrink: '0',
    borderRadius: 'full',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    '&[data-checked]': {
      layerStyle: 'primaryFill',
      boxShadow: 'insetTop',
    },
    '&[data-unchecked]': {
      backgroundColor: 'well',
      boxShadow: 'well',
    },
    _focusVisible: {
      borderColor: 'ring',
      boxShadow: 'focus',
    },
    '&[aria-invalid="true"]': {
      borderColor: 'destructive',
      boxShadow: 'invalid',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
        boxShadow: 'invalid',
      },
    },
    '&[data-size="default"]': { height: '5', width: '34px' },
    '&[data-size="sm"]': { height: '14px', width: '24px' },
    '&::after': {
      content: '""',
      position: 'absolute',
      insetInline: '-0.75rem',
      insetBlock: '-0.5rem',
    },
    '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
    '.group-field-label:has(:focus-visible) &': {
      boxShadow: 'none',
      borderColor: 'transparent',
    },
  }),
)

const SWITCH_THUMB_CLASS = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  borderRadius: 'full',
  pointerEvents: 'none',
  display: 'block',
  transitionProperty: 'transform',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
  '.group-switch[data-size="default"] &': {
    width: '4',
    height: '4',
    '&[data-checked]': { transform: 'translateX(calc(100% - 1px))' },
    '&[data-unchecked]': { transform: 'translateX(1px)' },
  },
  '.group-switch[data-size="sm"] &': {
    width: '3',
    height: '3',
    '&[data-checked]': { transform: 'translateX(calc(100% - 2px))' },
    '&[data-unchecked]': { transform: 'translateX(0)' },
  },
})

const SWITCH_LABEL_CLASS = css({
  fontSize: 'type.14',
  lineHeight: 'none',
  fontWeight: 'medium',
  '.group-field[data-disabled] &': {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
})

const SWITCH_WRAPPER_CLASS = cx(
  'group-field',
  css({ display: 'flex', alignItems: 'center', gap: '3' }),
)

const SWITCH_TEXT_CLASS = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
})

const settingSwitch = (
  config: Readonly<{ id: string; label: string; isChecked: boolean; message: Message }>,
  h: H<Message>,
): Content =>
  h.div.class(cx(SWITCH_WRAPPER_CLASS, settingRowClass)).children(
    h.button
      .attr('type', 'button')
      .attr('role', 'switch')
      .attr('aria-checked', config.isChecked ? 'true' : 'false')
      .attr('aria-labelledby', `${config.id}-label`)
      .attr('tabindex', '0')
      .attr('data-checked', config.isChecked ? '' : undefined)
      .attr('data-slot', 'switch')
      .attr('data-size', 'default')
      .attr('data-unchecked', config.isChecked ? undefined : '')
      .class(SWITCH_CLASS)
      .on('click', () => config.message)
      .on('keyup', (payload) => (payload.key === ' ' ? config.message : undefined), {
        preventDefault: true,
      })
      .children(
        h.span
          .attr('data-slot', 'switch-thumb')
          .attr(config.isChecked ? 'data-checked' : 'data-unchecked', '')
          .class(SWITCH_THUMB_CLASS)
          .children(),
      ),
    h.div.class(cx(SWITCH_TEXT_CLASS, css({ minWidth: '0', flex: '1 1 0%' }))).children(
      h.label
        .attr('id', `${config.id}-label`)
        .class(cx(SWITCH_LABEL_CLASS, settingLabelClass))
        .on('click', () => config.message)
        .children(config.label),
    ),
  )

/* The slider primitive's markup, copied from packages/ui/src/primitives/slider.ts.
   A native range covers the drawn track and reports the position, as the pool
   slider in `inspector/shared.ts` does. */
const SLIDER_ROOT_CLASS = css({
  '&[data-vertical]': {
    minHeight: '40',
    height: '100%',
    width: 'auto',
    flexDirection: 'column',
  },
  position: 'relative',
  display: 'flex',
  width: '100%',
  touchAction: 'none',
  alignItems: 'center',
  userSelect: 'none',
  '&[data-disabled]': { opacity: 0.5 },
})

const SLIDER_TRACK_CLASS = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderRadius: 'full',
  '&[data-horizontal]': { height: '1.5', width: '100%' },
  '&[data-vertical]': { height: '100%', width: '1.5' },
  position: 'relative',
  flexGrow: '1',
  overflow: 'hidden',
  userSelect: 'none',
})

const SLIDER_FILLED_TRACK_CLASS = css({
  layerStyle: 'primaryFill',
  borderRadius: 'full',
  userSelect: 'none',
  '&[data-horizontal]': { height: '100%' },
  '&[data-vertical]': { width: '100%' },
})

const SLIDER_THUMB_CLASS = css({
  position: 'relative',
  width: '4',
  height: '4',
  borderRadius: 'full',
  layerStyle: 'raised',
  boxShadow: 'raised',
  transitionProperty: 'color, box-shadow',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  '&::after': { position: 'absolute', inset: '-0.5rem' },
  _hover: {
    boxShadow: 'selected',
  },
  _focusVisible: {
    boxShadow: 'selected',
    outlineStyle: 'hidden',
  },
  '&:active': {
    boxShadow: 'selectedStrong',
  },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  display: 'block',
  flexShrink: '0',
  userSelect: 'none',
  '&:disabled': { pointerEvents: 'none', opacity: 0.5 },
})

const SLIDER_LABEL_CLASS = css({
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontWeight: 'medium',
})

const SLIDER_VALUE_CLASS = css({
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontVariantNumeric: 'tabular-nums',
  color: 'mutedForeground',
})

const SLIDER_ROW_CLASS = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  width: '100%',
})

const SLIDER_HEADER_CLASS = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
})

const volumeSlider = (model: Model, h: H<Message>): Content => {
  const t = copy(h)
  const value = model.prefs.volume
  const isDisabled = model.prefs.muted
  const id = 'volume'
  const fraction = Math.max(0, Math.min(1, value / 100))
  const label = `${value}%`
  return h.div.class(SLIDER_ROW_CLASS).children(
    h.div.class(SLIDER_HEADER_CLASS).children(
      h.label.attr('id', `${id}-label`).class(SLIDER_LABEL_CLASS).children(t.panels.volume),
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '1.5',
          }),
        )
        .children(h.span.class(SLIDER_VALUE_CLASS).children(label)),
    ),
    h.div
      .attr('data-slider-id', id)
      .attr('data-orientation', 'horizontal')
      .attr('data-horizontal', '')
      .attr('data-disabled', isDisabled ? '' : undefined)
      .attr('data-slot', 'slider')
      .class(SLIDER_ROOT_CLASS)
      .children(
        h.div
          .attr('data-slider-track-id', id)
          .attr('data-orientation', 'horizontal')
          .attr('data-horizontal', '')
          .attr('data-disabled', isDisabled ? '' : undefined)
          .style({ position: 'relative', touchAction: 'none' })
          .attr('data-slot', 'slider-track')
          .class(SLIDER_TRACK_CLASS)
          .children(
            h.div
              .style({
                position: 'absolute',
                left: '0',
                top: '0',
                bottom: '0',
                width: `calc((100% - 0.75rem) * ${fraction} + 0.375rem)`,
                pointerEvents: 'none',
              })
              .attr('data-disabled', isDisabled ? '' : undefined)
              .attr('data-slot', 'slider-range')
              .class(SLIDER_FILLED_TRACK_CLASS)
              .children(),
          ),
        h.div
          .attr('id', `${id}-thumb`)
          .attr('role', 'slider')
          .attr('tabindex', '0')
          .attr('aria-orientation', 'horizontal')
          .attr('aria-valuemin', '0')
          .attr('aria-valuemax', '100')
          .attr('aria-valuenow', String(value))
          .attr('aria-valuetext', label)
          .attr('aria-labelledby', `${id}-label`)
          .attr('aria-disabled', isDisabled ? 'true' : undefined)
          .attr('data-disabled', isDisabled ? '' : undefined)
          .style({
            position: 'absolute',
            left: `calc((100% - 0.75rem) * ${fraction})`,
            touchAction: 'none',
          })
          .attr('data-slot', 'slider-thumb')
          .class(SLIDER_THUMB_CLASS)
          .children(),
        h.input
          .attr('type', 'range')
          .attr('min', '0')
          .attr('max', '100')
          .attr('step', '5')
          .value(String(value))
          .disabled(isDisabled)
          .attr('aria-label', t.panels.volume)
          .style({
            position: 'absolute',
            left: '0',
            right: '0',
            top: '-0.5rem',
            height: 'calc(100% + 1rem)',
            opacity: '0',
            cursor: 'pointer',
          })
          .class(css({ margin: '0' }))
          .on('input', ({ value: next }) =>
            Message.PrefsChanged({
              message: PrefsMessage.VolumeChanged({ volume: Number(next) }),
            }),
          ),
      ),
  )
}

const volumeRow = (model: Model, h: H<Message>): Content =>
  h.div
    .class(
      css({
        paddingInline: '4',
        paddingBlock: '2.5',
      }),
    )
    .children(volumeSlider(model, h))

/* The language picker `@/i18n/picker.ts` drew with a listbox, as a native select
   that sends the same `PrefsMessage.LocaleChosen` the listbox's out message did. */
const languagePicker = (locale: Locale, label: string, h: H<Message>): Content =>
  h.div.attr('data-language-picker', '').children(
    h.div
      .class(
        css({
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
        }),
      )
      .children(
        h.select
          .value(locale)
          .attr('lang', locale)
          .attr('aria-label', label)
          .class(
            css({
              display: 'flex',
              height: '8',
              minWidth: '32',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3',
              borderRadius: 'lg',
              backgroundColor: 'well',
              paddingInline: '2.5',
              paddingRight: '8',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'foreground',
              boxShadow: 'well',
              outlineStyle: 'none',
              appearance: 'none',
              _hover: { backgroundColor: 'muted' },
              _focusVisible: {
                boxShadow:
                  'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
              },
            }),
          )
          .on('change', ({ value }) => {
            const chosen = supportedLocales.find((choice) => choice.value === value)
            return chosen === undefined
              ? undefined
              : Message.PrefsChanged({
                  message: PrefsMessage.LocaleChosen({ locale: chosen.value }),
                })
          })
          .children(
            ...supportedLocales.map((choice) =>
              h.option
                .attr('value', choice.value)
                .attr('lang', choice.value)
                .selected(choice.value === locale)
                .children(choice.label),
            ),
          ),
        icon(
          h,
          ChevronDown,
          css({
            position: 'absolute',
            right: '2.5',
            width: '4',
            height: '4',
            pointerEvents: 'none',
            color: 'mutedForeground',
          }),
        ),
      ),
  )

const languageRow = (model: Model, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4',
        paddingInline: '4',
        paddingBlock: '2.5',
      }),
    )
    .children(
      h.span.class(settingLabelClass).children(t.panels.language),
      languagePicker(model.prefs.locale, t.panels.language, h),
    )
}

const settingAction = (label: string, message: Message, glyph: IconNode, h: H<Message>): Content =>
  button(
    h,
    {
      onClick: message,
      variant: 'ghost',
      size: 'lg',
      className: css({
        height: 'auto',
        width: '100%',
        justifyContent: 'space-between',
        gap: '2.5',
        borderRadius: '0',
        paddingInline: '4',
        paddingBlock: '2.5',
      }),
    },
    [
      h.span.class(settingLabelClass).children(label),
      icon(
        h,
        glyph,
        css({
          width: '4',
          height: '4',
          flexShrink: '0',
          color: 'mutedForeground',
        }),
      ),
    ],
  )

const settingRow = (setting: Setting, model: Model, h: H<Message>): Content => {
  switch (setting.kind) {
    case 'volume':
      return volumeRow(model, h)
    case 'toggle':
      return settingSwitch(
        {
          id: setting.id,
          label: setting.label,
          isChecked: setting.isOn,
          message: setting.message,
        },
        h,
      )
    case 'language':
      return languageRow(model, h)
    case 'action':
      return settingAction(setting.label, setting.message, setting.glyph, h)
  }
}

const pwaSettingsSection = (model: Model, h: H<Message>): Child => {
  const t = copy(h)
  if (pwaInstalled(model.pwa.install)) return undefined
  const family = browserFamilyOf()
  const rows: Array<Child> = []
  if (!pwaInstalled(model.pwa.install)) {
    rows.push(
      pwaInstallable(model.pwa.install)
        ? settingAction(t.pwa.installQuorum, Message.PwaInstallChosen(), Download, h)
        : h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1',
                paddingInline: '4',
                paddingBlock: '3',
              }),
            )
            .children(
              h.span.class(settingLabelClass).children(t.pwa.installQuorum),
              h.p
                .class(
                  css({
                    fontSize: 'type.12',
                    lineHeight: 'snug',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.pwa.installHelp[family]),
            ),
    )
    if (onIos())
      rows.push(
        h.p
          .class(
            css({
              paddingInline: '4',
              paddingBlock: '3',
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.pwa.moveNote),
      )
  }
  return settingSection(t.pwa.app, rows, h)
}

export const settingsPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const sections = settingsSections(model, t)
  const section = (id: SettingsSection): Child => {
    const found = sections.find((entry) => entry.id === id)
    if (found === undefined) return undefined
    const rows = found.rows.flatMap((row) =>
      row.kind === 'toggle' && row.id === 'agent-access' && model.prefs.agentAccess
        ? [settingRow(row, model, h), agentRoomRow(model, h)]
        : [settingRow(row, model, h)],
    )
    return settingSection(found.label, rows, h)
  }

  return shell(
    h,
    t,
    t.panels.settings,
    [],
    [
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              minHeight: '0',
              flexDirection: 'column',
              gap: '4',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            SCROLL,
          ),
        )
        .children(
          section('sound'),
          h.div
            .class(
              css({
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                alignItems: 'flex-start',
                columnGap: '5',
                rowGap: '4',
                _compact: {
                  gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                },
              }),
            )
            .children(
              h.div
                .class(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4',
                    _compact: {
                      display: 'contents',
                    },
                  }),
                )
                .children(section('play'), section('display')),
              h.div
                .class(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4',
                    _compact: {
                      display: 'contents',
                    },
                  }),
                )
                .children(section('privacy'), section('save')),
            ),
          pwaSettingsSection(model, h),
        ),
    ],
    css({ maxWidth: 'calc(760px * var(--type-scale))' }),
  )
}

export const offerPanel = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const deal = offer(model.board.game)
  if (!deal) return undefined
  const ipo = model.board.game.stage === PRE_IPO_STAGE
  const title = ipo
    ? t.panels.iPO
    : t.panels.round(t.catalog.eras[model.board.game.stage + 1]?.name ?? deal.era.name)
  const vote = roomLive(model) ? openVoteOf(model.room.vote) : null
  if (vote !== null && vote.kind !== 'exit')
    return shell(
      h,
      t,
      title,
      [],
      [
        h.div
          .class(
            css({
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
          )
          .children(voteCard(model, vote, h)),
      ],
      css({ maxWidth: 'calc(420px * var(--type-scale))' }),
    )
  return shell(
    h,
    t,
    title,
    [],
    [
      h.div
        .class(
          css({
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: '3',
            paddingInline: '5',
            paddingTop: '1',
            paddingBottom: '5',
            _narrow: {
              gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
            },
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '3',
                borderRadius: 'xl',
                layerStyle: 'raised',
                padding: '4',
                boxShadow: 'raised',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    fontSize: 'type.15',
                    fontWeight: 'semibold',
                  }),
                )
                .children(ipo ? t.panels.goPublic : t.panels.raise),
              h.div
                .class(
                  css({
                    display: 'flex',
                    flex: '1 1 0%',
                    flexDirection: 'column',
                    gap: '0.5',
                    fontSize: 'type.13',
                    color: 'mutedForeground',
                  }),
                )
                .children(
                  h.span.children(t.panels.cash(money(deal.grant))),
                  h.span.children(
                    t.panels.equity(
                      Math.round(model.board.game.equity * 100),
                      Math.round(model.board.game.equity * (1 - deal.dilution) * 100),
                    ),
                  ),
                  h.span.children(ipo ? t.panels.quartersBegin : t.panels.fullGrowth),
                ),
              primaryButton(ipo ? t.panels.goPublic : t.panels.raise, Message.RoundRaised(), h),
            ),
          ipo
            ? undefined
            : h.div
                .class(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '3',
                    borderRadius: 'xl',
                    backgroundColor: 'nested',
                    padding: '4',
                    boxShadow: 'line',
                  }),
                )
                .children(
                  h.span
                    .class(
                      css({
                        fontSize: 'type.15',
                        fontWeight: 'semibold',
                      }),
                    )
                    .children(t.panels.decline),
                  h.div
                    .class(
                      css({
                        display: 'flex',
                        flex: '1 1 0%',
                        flexDirection: 'column',
                        gap: '0.5',
                        fontSize: 'type.13',
                        color: 'mutedForeground',
                      }),
                    )
                    .children(
                      h.span.children(t.panels.noCash),
                      h.span.children(
                        t.panels.equityStays(Math.round(model.board.game.equity * 100)),
                      ),
                      h.span.children(t.panels.growth07),
                    ),
                  secondaryButton(t.panels.decline, Message.RoundDeclined(), h),
                ),
        ),
    ],
    css({ maxWidth: '620px' }),
  )
}

const chip = (label: string, h: H<Message>): Content =>
  h.span
    .key(label)
    .class(
      css({
        borderRadius: 'full',
        backgroundColor: 'well',
        boxShadow: 'well',
        paddingInline: '2.5',
        paddingBlock: '0.5',
        fontSize: 'type.11-5',
        whiteSpace: 'nowrap',
      }),
    )
    .children(label)

const chipRow = (labels: ReadonlyArray<string>, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5',
      }),
    )
    .children(...labels.map((label) => chip(label, h)))

const eraSection = (label: string, body: ReadonlyArray<Child>, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2',
      }),
    )
    .children(h.span.class(EYEBROW).children(label), ...body)

const eraFacts = (rows: ReadonlyArray<readonly [string, string]>, h: H<Message>): Content =>
  h.div
    .class(
      cx(
        NESTED,
        css({
          display: 'flex',
          flexDirection: 'column',
        }),
      ),
    )
    .children(
      ...rows.map(([label, value]) =>
        h.div
          .key(label)
          .class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
              paddingInline: '4',
              paddingBlock: '2.5',
              fontSize: 'type.12-5',
            }),
          )
          .children(
            h.span.class(css({ color: 'mutedForeground' })).children(label),
            h.span.class(FIGURE).children(value),
          ),
      ),
    )

const percentText = (value: number): string => `${Number((value * 100).toFixed(2))}%`

export const eraPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const before = ERAS[game.stage - 1]
  const kinds = REQUEST_KINDS.filter(
    (kind) =>
      era.mix[kind] !== undefined && (before === undefined || before.mix[kind] === undefined),
  ).map((kind) => t.catalog.kinds[kind].label)
  const components = COMPONENT_IDS.filter((id) => {
    const unlock = COMPONENTS[id].unlock
    return unlock !== null && RESEARCH[unlock].era === game.stage
  }).map((id) => t.catalog.components[id].name)
  const research = RESEARCH_IDS.filter((id) => RESEARCH[id].era === game.stage).length
  const raised = game.round._tag === 'Raised'
  const declined = game.round._tag === 'Declined'
  const equity = Math.round(game.equity * 100)
  const dilution = Math.round(dilutionOf(game, era.dilution) * 100)
  const equityBefore =
    dilution >= 100 ? equity : Math.round((game.equity / (1 - dilution / 100)) * 100)
  return shell(
    h,
    t,
    era.name,
    [],
    [
      h.div
        .class(
          cx(
            SCROLL,
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            'stagger',
          ),
        )
        .children(
          h.img
            .attr('src', `/art/era-${Math.min(7, game.stage)}.svg`)
            .attr('alt', '')
            .class(
              css({
                width: '100%',
                maxWidth: '520px',
                alignSelf: 'center',
                _short: {
                  maxHeight: '20dvh',
                  width: 'auto',
                },
              }),
            ),
          h.span.class(EYEBROW).children(t.panels.eraProgress(game.stage, ERAS.length)),
          h.span
            .class(
              css({
                fontSize: 'type.26',
                fontWeight: 'semibold',
                lineHeight: 'tight',
                letterSpacing: 'heading',
              }),
            )
            .children(era.question),
          h.p
            .class(
              css({
                fontSize: 'type.14',
                lineHeight: 'relaxed',
                color: 'mutedForeground',
              }),
            )
            .children(era.arrivals),
          stats(
            css({
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            }),
            [
              stat(
                t.panels.milestone,
                Number.isFinite(era.raiseAt) ? compact(era.raiseAt) : '—',
                h,
              ),
              stat(t.panels.apdexTarget, era.apdexTarget.toFixed(2), h),
              stat(t.panels.slo, percentText(era.slo), h),
              stat(t.panels.prices, `×${era.costIndex}`, h),
            ],
            h,
          ),
          raised || declined || game.stage >= ERAS.length - 1
            ? eraSection(
                t.panels.theRound,
                [
                  h.span
                    .class(
                      css({
                        fontSize: 'type.13',
                        color: 'mutedForeground',
                      }),
                    )
                    .children(
                      game.stage >= ERAS.length - 1
                        ? t.panels.quartersBegin
                        : raised
                          ? `${t.panels.cash(money(grantOf(game, era.grant)))} · ${t.panels.equity(equityBefore, equity)}`
                          : `${t.panels.equityStays(equity)} · ${t.panels.growth07}`,
                    ),
                ],
                h,
              )
            : undefined,
          Number.isFinite(era.raiseAt)
            ? eraSection(
                t.panels.nextRound,
                [
                  eraFacts(
                    [
                      [t.hud.cash, money(grantOf(game, era.grant))],
                      [t.panels.dilution, `${dilution}%`],
                    ],
                    h,
                  ),
                ],
                h,
              )
            : undefined,
          kinds.length > 0
            ? eraSection(t.panels.newRequestKinds, [chipRow(kinds, h)], h)
            : undefined,
          components.length > 0
            ? eraSection(
                t.panels.newComponents,
                [
                  chipRow(components, h),
                  h.span
                    .class(
                      css({
                        fontSize: 'type.11-5',
                        color: 'mutedForeground',
                      }),
                    )
                    .children(t.panels.newResearch(research)),
                ],
                h,
              )
            : undefined,
        ),
      footer([primaryButton(t.panels.continueText, Message.PanelClosed(), h)], h),
    ],
    css({ maxWidth: '620px' }),
  )
}

export const endPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  return shell(
    h,
    t,
    t.panels.iPO,
    [],
    [
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '5',
            paddingInline: '8',
            paddingTop: '4',
            paddingBottom: '8',
            _compact: {
              gap: '3',
              paddingInline: '5',
              paddingBottom: '5',
            },
          }),
        )
        .children(
          h.img
            .attr('src', '/art/hero.svg')
            .attr('alt', '')
            .class(
              css({
                width: '100%',
                maxWidth: '520px',
                _short: {
                  maxHeight: '30dvh',
                  width: 'auto',
                },
              }),
            ),
          h.span
            .class(
              css({
                fontSize: 'type.30',
                fontWeight: 'semibold',
                letterSpacing: 'heading',
              }),
            )
            .children(t.panels.theCompanyIsPublic),
          stats(
            css({
              maxWidth: '640px',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              _narrow: {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                '& > :nth-child(n+3)': {
                  borderTopWidth: '1px',
                  borderTopStyle: 'solid',
                },
              },
            }),
            [
              stat(t.panels.time, clock(model.board.game.time), h),
              stat(t.panels.users2, compact(model.board.game.users), h),
              stat(t.panels.earned, money(model.board.game.earned), h),
              stat(t.panels.equity2, `${Math.round(model.board.game.equity * 100)}%`, h),
            ],
            h,
          ),
          h.div
            .class(
              css({
                display: 'flex',
                gap: '2',
              }),
            )
            .children(primaryButton(t.panels.keepPlaying, Message.PanelClosed(), h)),
        ),
    ],
    css({ maxWidth: '760px' }),
  )
}

export const devPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const game = model.board.game
  return shell(
    h,
    t,
    t.panels.developer,
    [],
    [
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '5',
            paddingInline: '5',
            paddingTop: '1',
            paddingBottom: '5',
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.panels.speed),
              h.div
                .class(
                  css({
                    display: 'flex',
                    gap: '2',
                  }),
                )
                .children(
                  ...speedsOf(model.board.game).map((speed) =>
                    button(
                      h,
                      {
                        onClick: Message.SpeedChosen({ speed }),
                        variant: model.board.clock.speed === speed ? 'default' : 'outline',
                        size: 'lg',
                        key: String(speed),
                        className: cx(
                          FIGURE,
                          css({
                            width: '16',
                          }),
                        ),
                      },
                      `${speed}×`,
                    ),
                  ),
                ),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.panels.skipAhead),
              h.div
                .class(
                  css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '2',
                  }),
                )
                .children(
                  nextEra(model.board.game) && !isFinalEra(model.board.game)
                    ? secondaryButton(
                        t.panels.skipTo(nextEra(model.board.game)?.name ?? ''),
                        Message.CheatRound(),
                        h,
                      )
                    : undefined,
                  secondaryButton(`+${money(cheatCash(model.board.game))}`, Message.CheatCash(), h),
                  secondaryButton(
                    t.panels.insight(cheatInsight(model.board.game).toLocaleString('en-US')),
                    Message.CheatInsight(),
                    h,
                  ),
                  secondaryButton(t.panels.n20Legacy, Message.CheatLegacy(), h),
                ),
            ),
          game.sandbox
            ? undefined
            : h.div
                .class(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2',
                  }),
                )
                .children(
                  h.span.class(EYEBROW).children(t.panels.teamMorale),
                  h.div
                    .class(
                      css({
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '2',
                      }),
                    )
                    .children(
                      secondaryButton(t.panels.layoffMorale, Message.MoraleForced(), h),
                      game.engineers[0]
                        ? secondaryButton(
                            t.panels.unhappyEngineer,
                            Message.EngineerUnhappyForced({
                              engineerId: game.engineers[0].id,
                            }),
                            h,
                          )
                        : undefined,
                    ),
                ),
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.panels.startAnIncident),
              h.div
                .class(
                  css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '2',
                  }),
                )
                .children(
                  ...INCIDENT_IDS.map((kind) =>
                    secondaryButton(
                      t.catalog.incidents[kind].name,
                      Message.IncidentForced({ kind }),
                      h,
                    ),
                  ),
                ),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '2',
              }),
            )
            .children(
              h.span.class(EYEBROW).children(t.panels.log),
              h.div
                .class(
                  css({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '2',
                  }),
                )
                .children(
                  secondaryButton(t.panels.exportLog, Message.LogExported(), h, Download),
                  secondaryButton(t.panels.clearLog, Message.LogCleared(), h, Trash2),
                ),
            ),
        ),
    ],
    css({ maxWidth: '640px' }),
  )
}
