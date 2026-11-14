import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option } from 'effect'
import { Mount } from 'foldkit'
import { type Messages, copy, eraWords, localized } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  ArrowUpRight,
  Command,
  Copy,
  DoorOpen,
  Download,
  House,
  KeyRound,
  Lock,
  LogOut,
  Play,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  WifiOff,
  X,
} from 'lucide'
import { browserFamilyOf, onIos } from '@/platform/pwa.ts'
import { offer } from '@quorum/simulation/actions'
import { PRE_IPO_STAGE } from '@quorum/simulation/ipo'
import { INCIDENT_IDS } from '@quorum/simulation/catalog'
import { eraOf, isFinalEra, nextEra } from '@quorum/simulation/lookups'
import { cheatCash, cheatInsight } from '@/game/cheats.ts'
import { clock, compact, money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  currentFile,
  exitLegacy,
  playingId,
  roomCode,
  roomLive,
  type Model,
  type SettingsSection,
  type Tone,
} from '@/game/model.ts'
import { seatColour } from '@/game/seat-colour.ts'
import type { Vote } from '@quorum/simulation/room'
import { companyMark } from '@/components/company-mark.ts'
import { speedsOf } from '@/game/update.ts'
import { modShortcut } from '@/game/palette.ts'
import { roomOwner } from '@/game/model.ts'
import { ROOM_NAME_LENGTH } from '@/game/names.ts'
import { RoomPhase } from '@/game/room-machine.ts'
import { seatOf } from '@/platform/room-socket.ts'
import { agentRoomId } from '@/game/agent-room.ts'
import type { IconNode } from 'lucide'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { Kbd } from '@quorum/ui/primitives/kbd'
import { switch_ } from '@quorum/ui/primitives/switch'
import * as VolumeSlider from '@quorum/ui/primitives/slider'
import { cn } from '@/lib/utils'
import { settingsSections, type Setting } from '@/game/settings.ts'
import { KEY_FIELD_MAX, canPlayOnline, keyNote } from '@/game/access.ts'
import { KeyPhase } from '@/game/key-machine.ts'
import { languagePicker } from '@/i18n/picker.ts'
import { EYEBROW, FIGURE, FLOAT, NESTED, SCROLL, WELL } from '@quorum/ui/game/bits'

const focusable =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Opens with focus inside the panel, keeps Tab in it, and hands focus back on close. A Scene test
 *  resolves it by hand. */
export const PanelFocus = Mount.define('PanelFocus', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const panel = element as HTMLElement
        const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
        panel.focus()
        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key !== 'Tab') return
          const items = [...panel.querySelectorAll<HTMLElement>(focusable)]
          const first = items[0]
          const last = items[items.length - 1]
          if (first === undefined || last === undefined) return
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === panel)
          ) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first.focus()
          }
        }
        panel.addEventListener('keydown', onKeyDown)
        return () => {
          panel.removeEventListener('keydown', onKeyDown)
          // A panel that opens another one leaves focus where the new panel put it.
          if (panel.contains(document.activeElement) || document.activeElement === document.body)
            before?.focus()
        }
      }),
      (cleanup) => Effect.sync(cleanup),
    ).pipe(Effect.as(Message.Synced())),
})

export const shell = (
  title: string,
  right: ReadonlyArray<Html>,
  body: ReadonlyArray<Html>,
  width: string,
  h: HtmlBuilder<Message>,
) => {
  const t = copy(h)
  return h.div(
    [
      h.DataAttribute('exit', 'gesture'),
      h.Class(
        cx(
          'modal-overlay',
          css({
            position: 'absolute',
            inset: '0',
            zIndex: '30',
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
            _compact: { padding: '0' },
            _short: {
              '[data-toast="on"] &': { paddingTop: '3rem !important' },
            },
          }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Key(title),
          h.Role('dialog'),
          h.AriaModal(true),
          h.AriaLabel(title),
          h.Tabindex(-1),
          h.OnMount(PanelFocus()),
          h.Class(
            cx(
              css({
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
              }),
              width,
              FLOAT,
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
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  paddingInline: '1.25rem',
                  paddingTop: '1rem',
                  paddingBottom: '0.75rem',
                  _compact: {
                    paddingInline: '1rem',
                    paddingTop: 'max(12px,env(safe-area-inset-top))',
                  },
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(17px*var(--type-scale))',
                      fontWeight: '600',
                      letterSpacing: '-0.025em',
                    }),
                  ),
                ],
                [title],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                    }),
                  ),
                ],
                [
                  ...right,
                  button(
                    {
                      onClick: Message.PanelClosed(),
                      variant: 'ghost',
                      size: 'icon',
                      className: css({
                        color: 'var(--muted-foreground)',
                        _compact: {
                          width: '2.75rem',
                          height: '2.75rem',
                        },
                      }),
                      attributes: [h.AriaLabel(t.panels.closeEsc)],
                    },
                    icon(
                      h,
                      X,
                      css({
                        width: '1rem',
                        height: '1rem',
                      }),
                    ),
                    h,
                  ),
                ],
              ),
            ],
          ),
          ...body,
        ],
      ),
    ],
  )
}

const primaryButton = (label: string, message: Message, h: HtmlBuilder<Message>) =>
  button(
    {
      onClick: message,
      size: 'lg',
      className: css({
        paddingInline: '1rem',
      }),
    },
    label,
    h,
  )

const secondaryButton = (
  label: string,
  message: Message,
  h: HtmlBuilder<Message>,
  glyph?: Parameters<typeof icon>[1],
) =>
  button(
    {
      onClick: message,
      variant: 'outline',
      size: 'lg',
      className: css({
        paddingInline: '0.875rem',
      }),
    },
    [
      ...(glyph
        ? [
            icon(
              h,
              glyph,
              css({
                width: '1rem',
                height: '1rem',
              }),
            ),
          ]
        : []),
      label,
    ],
    h,
  )

const agentRoomRow = (model: Model, h: HtmlBuilder<Message>) => {
  const t = copy(h)
  const company = playingId(model)
  const id = company === null ? null : agentRoomId(company)
  if (id === null) return h.empty
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          paddingInline: '1rem',
          paddingBlock: '0.625rem',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [t.panels.agentRoom]),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          h.code(
            [
              h.Class(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'mono',
                  fontSize: 'calc(0.75rem * var(--type-scale))',
                  lineHeight: 'calc(1 / 0.75)',
                }),
              ),
            ],
            [id],
          ),
          secondaryButton(t.panels.copyAgentRoom, Message.AgentRoomCopied(), h, Copy),
        ],
      ),
    ],
  )
}

const footer = (children: ReadonlyArray<Html>, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.5rem',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'var(--hairline)',
          backgroundColor: 'var(--surface-nested)',
          paddingInline: '1.25rem',
          paddingBlock: '0.75rem',
        }),
      ),
    ],
    children,
  )

const stat = (name: string, value: string, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          paddingInline: '1rem',
          paddingBlock: '0.75rem',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [name]),
      h.span(
        [
          h.Class(
            cn(
              FIGURE,
              css({
                fontSize: 'calc(18px*var(--type-scale))',
              }),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

const stats = (columns: string, children: ReadonlyArray<Html>, h: HtmlBuilder<Message>) =>
  h.div(
    [
      h.Class(
        cn(
          css({
            display: 'grid',
            width: '100%',
            '& > :not(:last-child)': {
              borderRightWidth: '1px',
              borderRightStyle: 'solid',
              borderColor: 'var(--hairline)',
            },
          }),
          WELL,
          columns,
        ),
      ),
    ],
    children,
  )

const stepsOf = (t: Messages): ReadonlyArray<readonly [string, string]> => [
  [t.panels.wireIt, t.panels.dragFromANodeSBlue],
  [t.panels.collect, t.panels.revenueWaitsInPaymentsPressCollect],
  [t.panels.learn, t.panels.analyticsSamplesLinkedNodesEachRequest],
  [t.panels.findTheLimit, t.panels.thePulsingOutlineMarksTheBottleneck],
  [t.panels.grow, t.panels.usersGrowWhileApdexBeatsThe],
  [t.panels.raise, t.panels.atTheUserTargetTakeOr],
]

type KeyGroup = readonly [label: string, rows: ReadonlyArray<readonly [string, string]>]

const keyGroupsOf = (t: Messages, easyMode: boolean): ReadonlyArray<KeyGroup> => [
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
      ...(easyMode
        ? [['S', t.panels.speed] as const, [t.panels.space, t.panels.pause] as const]
        : []),
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

/** Each keys column keeps its own vertical rule; the layout folds to two, then one. */
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

const keyRow = ([key, action]: readonly [string, string], h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Key(action),
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
          paddingBlock: '0.125rem',
          fontSize: 'calc(12px*var(--type-scale))',
          lineHeight: '1.375',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [action],
      ),
      Kbd(
        {
          className: css({
            flexShrink: '0',
          }),
        },
        [key],
        h,
      ),
    ],
  )

const stepCell = (
  [title, body]: readonly [string, string],
  index: number,
  h: HtmlBuilder<Message>,
): Html => {
  const first = index === 0
  return h.li(
    [
      h.Key(title),
      h.Class(
        cn(
          css({
            display: 'flex',
            flexDirection: 'column',
            paddingInline: '1rem',
            paddingBlock: '0.625rem',
          }),
          first
            ? css({
                layerStyle: 'primaryFill',
                color: 'var(--on-primary-fill)',
                _dark: {
                  layerStyle: 'raised',
                  color: 'var(--foreground)',
                },
              })
            : css({
                layerStyle: 'surface',
              }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            cn(
              FIGURE,
              css({
                fontSize: 'calc(23px*var(--type-scale))',
                lineHeight: '1',
                fontWeight: '500',
                letterSpacing: '-0.05em',
              }),
              first
                ? css({
                    color: 'var(--on-primary-fill)',
                    _dark: {
                      color: 'var(--muted-foreground)',
                    },
                  })
                : css({
                    color: 'color-mix(in oklab, var(--muted-foreground) 55%, transparent)',
                  }),
            ),
          ),
        ],
        [String(index + 1).padStart(2, '0')],
      ),
      h.span(
        [
          h.Class(
            css({
              marginTop: '0.5rem',
              fontSize: 'calc(15px*var(--type-scale))',
              fontWeight: '600',
              letterSpacing: '-0.02em',
            }),
          ),
        ],
        [title],
      ),
      h.span(
        [
          h.Class(
            cn(
              css({
                marginTop: '0.25rem',
                fontSize: 'calc(12px*var(--type-scale))',
                lineHeight: '1.625',
              }),
              first
                ? css({
                    color: 'color-mix(in oklab, var(--on-primary-fill) 70%, transparent)',
                    _dark: {
                      color: 'var(--muted-foreground)',
                    },
                  })
                : css({
                    color: 'var(--muted-foreground)',
                  }),
            ),
          ),
        ],
        [body],
      ),
    ],
  )
}

export const helpPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const groups = keyGroupsOf(t, model.prefs.easyMode)
  const columns = [groups.slice(0, 2), groups.slice(2, 3), groups.slice(3)]
  return shell(
    t.panels.howToPlay,
    [],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                minHeight: '0',
                flexDirection: 'column',
                gap: '0.75rem',
                paddingInline: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '1rem',
                _compact: {
                  gap: '1rem',
                },
              }),
              SCROLL,
            ),
          ),
        ],
        [
          h.ol(
            [
              h.Class(
                css({
                  display: 'grid',
                  flexShrink: '0',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '1px',
                  overflow: 'hidden',
                  borderRadius: 'xl',
                  backgroundColor: 'var(--hairline)',
                  boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                  '@media (max-width: 1000px)': {
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  },
                  _compact: {
                    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                  },
                }),
              ),
            ],
            stepsOf(t).map((step, index) => stepCell(step, index, h)),
          ),
          h.section(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexShrink: '0',
                  flexDirection: 'column',
                  gap: '0.375rem',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.panels.keys]),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      overflow: 'hidden',
                      borderRadius: 'xl',
                      backgroundColor: 'var(--surface-nested)',
                      boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                      '@media (max-width: 1000px)': {
                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      },
                      _compact: {
                        gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                      },
                    }),
                  ),
                ],
                columns.map((columnGroups, index) =>
                  h.div(
                    [
                      h.Class(
                        cn(
                          css({
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.625rem',
                            padding: '0.5rem',
                          }),
                          keyColumnRule(index),
                        ),
                      ),
                    ],
                    columnGroups.map(([label, rows]) =>
                      h.div(
                        [
                          h.Key(label),
                          h.Class(
                            css({
                              display: 'flex',
                              flexDirection: 'column',
                            }),
                          ),
                        ],
                        [
                          h.span([h.Class(EYEBROW)], [label]),
                          h.div(
                            [
                              h.Class(
                                css({
                                  marginTop: '0.125rem',
                                  '& > :not(:last-child)': {
                                    borderBottomWidth: '1px',
                                    borderBottomStyle: 'solid',
                                    borderColor: 'var(--hairline)',
                                  },
                                }),
                              ),
                            ],
                            rows.map((row) => keyRow(row, h)),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
      footer([primaryButton(t.panels.startBuilding, Message.PanelClosed(), h)], h),
    ],
    css({ maxWidth: '1040px' }),
    h,
  )
}

const menuItem = (
  label: string,
  glyph: Parameters<typeof icon>[1],
  message: Message,
  h: HtmlBuilder<Message>,
  variant: 'default' | 'outline' | 'ghost' = 'outline',
  trailing?: Html,
) =>
  button(
    {
      onClick: message,
      variant,
      size: 'lg',
      className: cn(
        css({
          height: '2.5rem',
          width: '100%',
          justifyContent: 'flex-start',
          gap: '0.625rem',
          paddingInline: '0.75rem',
        }),
        trailing === undefined
          ? ''
          : css({
              paddingRight: '0.5rem',
            }),
      ),
      attributes: [h.Key(label)],
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
      h.span(
        [
          h.Class(
            css({
              minWidth: '0',
              flex: '1 1 0%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
            }),
          ),
        ],
        [label],
      ),
      ...(trailing === undefined ? [] : [trailing]),
    ],
    h,
  )

/** The game menu over the board. The clock holds still while it is open. */
export const menuPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const file = currentFile(model)
  const rule = h.div(
    [
      h.Class(
        css({
          marginBlock: '0.25rem',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'var(--hairline)',
        }),
      ),
    ],
    [],
  )
  return shell(
    t.panels.menu,
    [],
    [
      ...(file
        ? [
            h.div(
              [
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    paddingInline: '1.25rem',
                    paddingBottom: '1rem',
                  }),
                ),
              ],
              [
                companyMark(
                  file.logo,
                  css({
                    width: '2rem',
                    height: '2rem',
                    flexShrink: '0',
                  }),
                  h,
                ),
                h.div(
                  [
                    h.Class(
                      css({
                        display: 'flex',
                        minWidth: '0',
                        flexDirection: 'column',
                        gap: '0.125rem',
                      }),
                    ),
                  ],
                  [
                    h.span(
                      [
                        h.Class(
                          css({
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'calc(15px*var(--type-scale))',
                            fontWeight: '600',
                          }),
                        ),
                      ],
                      [file.name],
                    ),
                    h.span(
                      [
                        h.Class(
                          css({
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            fontSize: 'calc(0.75rem * var(--type-scale))',
                            lineHeight: 'calc(1 / 0.75)',
                            color: 'var(--muted-foreground)',
                          }),
                        ),
                      ],
                      [
                        `${t.catalog.ventures[file.venture].name} · ${eraWords(t, model.board.game).name}`,
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ]
        : []),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'var(--hairline)',
              paddingInline: '1.25rem',
              paddingTop: '1rem',
              paddingBottom: '1.25rem',
            }),
          ),
        ],
        [
          menuItem(
            t.panels.resume,
            Play,
            Message.PanelClosed(),
            h,
            'default',
            Kbd(
              {
                className: css({
                  flexShrink: '0',
                }),
              },
              [t.panels.esc],
              h,
            ),
          ),
          rule,
          menuItem(
            t.palette.title,
            Command,
            Message.PaletteOpened(),
            h,
            'outline',
            Kbd(
              {
                className: css({
                  flexShrink: '0',
                }),
              },
              [modShortcut('K')],
              h,
            ),
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
            ? h.empty
            : menuItem(t.panels.exitCompany, DoorOpen, Message.PanelOpened({ panel: 'exit' }), h),
          menuItem(t.panels.titleScreen, House, Message.TitleOpened(), h, 'ghost'),
        ],
      ),
    ],
    css({ maxWidth: 'calc(340px * var(--type-scale))' }),
    h,
  )
}

const VOTE_TITLE = { fund: 'voteFund', decline: 'voteDecline', exit: 'voteExit' } as const

/** One open vote: the count, a dot per Seat, and the two ballots. */
const voteCard = (model: Model, open: Vote, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const seat = seatOf()
  const mine = open.yes.includes(seat) ? 'yes' : open.no.includes(seat) ? 'no' : null
  return h.div(
    [
      h.Class(
        cn(
          WELL,
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            padding: '0.75rem',
          }),
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '0.75rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(0.875rem * var(--type-scale))',
                  lineHeight: 'calc(1.25 / 0.875)',
                  fontWeight: '500',
                }),
              ),
            ],
            [t.room[VOTE_TITLE[open.kind]]],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: 'calc(0.75rem * var(--type-scale))',
                    lineHeight: 'calc(1 / 0.75)',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [`${open.yes.length} / ${model.room.seats.length}`],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
            }),
          ),
        ],
        model.room.seats.map((entry) => {
          const colour = seatColour(entry.colour)
          const yes = open.yes.includes(entry.id)
          const no = open.no.includes(entry.id)
          return h.span(
            [
              h.Key(`ballot-${entry.id}`),
              h.Class(
                css({
                  width: '0.5rem',
                  height: '0.5rem',
                  borderRadius: '9999px',
                }),
              ),
              h.Style({
                // A yes is filled, a no is a ring, and a Seat that has not voted is faint.
                background: no ? 'transparent' : colour,
                boxShadow: no ? `inset 0 0 0 1px ${colour}` : 'none',
                opacity: yes || no ? '1' : '0.3',
              }),
            ],
            [],
          )
        }),
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          button(
            {
              onClick: Message.RoomBallot({ vote: open.id, yes: true }),
              variant: mine === 'yes' ? 'default' : 'outline',
              size: 'lg',
              className: css({
                flex: '1 1 0%',
              }),
            },
            t.room.coins,
            h,
          ),
          button(
            {
              onClick: Message.RoomBallot({ vote: open.id, yes: false }),
              variant: mine === 'no' ? 'secondary' : 'outline',
              size: 'lg',
              className: css({
                flex: '1 1 0%',
              }),
            },
            t.room.no,
            h,
          ),
        ],
      ),
    ],
  )
}
/** The Room: the code, the Seats, the name, the vote, the speed, and the way out. */
export const roomPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const phase = model.room.phase
  const file = currentFile(model)
  const owner = roomOwner(model)
  const live = RoomPhase.isAnyOf(['Online', 'Reconnecting'])(phase)
  const vote = model.room.vote
  const seat = seatOf()
  const unchanged = model.room.draft.trim() === model.room.name

  const section = (label: string, rows: ReadonlyArray<Html>) =>
    h.div(
      [
        h.Class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.625rem',
            paddingInline: '1.25rem',
            paddingTop: '1rem',
          }),
        ),
      ],
      [h.span([h.Class(EYEBROW)], [label]), ...rows],
    )

  const divider = () =>
    h.div(
      [
        h.Class(
          css({
            marginInline: '1.25rem',
            marginTop: '0.625rem',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'var(--hairline)',
          }),
        ),
      ],
      [],
    )

  const codeBlock = (code: string) =>
    h.div(
      [
        h.Class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.375rem',
            paddingInline: '1.25rem',
            paddingTop: '0.75rem',
          }),
        ),
      ],
      [
        h.span([h.Class(EYEBROW)], [t.room.code]),
        h.div(
          [
            h.Class(
              css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }),
            ),
          ],
          [
            h.span(
              [
                h.Class(
                  cn(
                    FIGURE,
                    css({
                      fontSize: 'calc(20px*var(--type-scale))',
                      fontWeight: '500',
                      letterSpacing: '0.16em',
                    }),
                  ),
                ),
              ],
              [code],
            ),
            button(
              {
                onClick: Message.RoomLinkCopied(),
                variant: 'outline',
                size: 'sm',
                className: css({
                  gap: '0.375rem',
                }),
                attributes: [h.AriaLabel(t.room.copyLink)],
              },
              [
                icon(
                  h,
                  Copy,
                  css({
                    width: '0.875rem',
                    height: '0.875rem',
                  }),
                ),
                t.room.copyLink,
              ],
              h,
            ),
          ],
        ),
      ],
    )

  const nameBlock = h.div(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          paddingInline: '1.25rem',
          paddingTop: '0.75rem',
        }),
      ),
    ],
    [
      h.label(
        [
          h.Class(
            cn(
              WELL,
              css({
                display: 'flex',
                height: '2.25rem',
                minWidth: '0',
                flex: '1 1 0%',
                alignItems: 'center',
                paddingInline: '0.625rem',
              }),
            ),
          ),
        ],
        [
          h.input([
            h.Type('text'),
            h.Value(model.room.draft),
            h.Maxlength(ROOM_NAME_LENGTH),
            h.Autocomplete('off'),
            h.Spellcheck(false),
            h.AriaLabel(t.room.yourName),
            h.OnInput((name) => Message.RoomNameChanged({ name })),
            h.OnKeyDownPreventDefault((key) =>
              key === 'Enter' ? Option.some(Message.RoomNameSaved()) : Option.none(),
            ),
            h.Class(
              css({
                width: '100%',
                minWidth: '0',
                backgroundColor: 'transparent',
                fontSize: 'calc(0.875rem * var(--type-scale))',
                lineHeight: 'calc(1.25 / 0.875)',
                outlineStyle: 'none',
              }),
            ),
          ]),
        ],
      ),
      button(
        {
          onClick: Message.RoomNameSaved(),
          variant: unchanged ? 'outline' : 'default',
          size: 'lg',
          isDisabled: unchanged,
        },
        t.room.saveName,
        h,
      ),
    ],
  )

  const seatChips = h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
        }),
      ),
    ],
    model.room.seats.map((entry) => {
      const colour = seatColour(entry.colour)
      return h.div(
        [
          h.Key(entry.id),
          h.Class(
            css({
              display: 'flex',
              minWidth: '0',
              alignItems: 'center',
              gap: '0.375rem',
              borderRadius: '9999px',
              backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
              paddingBlock: '0.25rem',
              paddingRight: '0.375rem',
              paddingLeft: '0.5rem',
              fontSize: 'calc(0.75rem * var(--type-scale))',
              lineHeight: 'calc(1 / 0.75)',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  width: '0.375rem',
                  height: '0.375rem',
                  flexShrink: '0',
                  borderRadius: '9999px',
                }),
              ),
              h.Style({ background: colour }),
            ],
            [],
          ),
          h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  maxWidth: '9rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: '500',
                }),
              ),
            ],
            [entry.name],
          ),
          entry.owner
            ? h.span(
                [
                  h.Class(
                    css({
                      flexShrink: '0',
                      fontSize: 'calc(10px*var(--type-scale))',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [t.room.owner],
              )
            : h.empty,
          entry.id === seat
            ? h.span(
                [
                  h.Class(
                    css({
                      flexShrink: '0',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [t.room.you],
              )
            : h.empty,
          owner && !entry.owner
            ? button(
                {
                  onClick: Message.RoomKickAsked({ seat: entry.id }),
                  variant: 'ghost',
                  size: 'icon-xs',
                  className: css({
                    width: '1.25rem',
                    height: '1.25rem',
                    color: 'var(--muted-foreground)',
                  }),
                  attributes: [h.AriaLabel(t.room.kick)],
                },
                icon(
                  h,
                  X,
                  css({
                    width: '0.75rem',
                    height: '0.75rem',
                  }),
                ),
                h,
              )
            : h.empty,
        ],
      )
    }),
  )

  const voteStart = h.div(
    [
      h.Class(
        css({
          display: 'flex',
          gap: '0.5rem',
        }),
      ),
    ],
    [
      button(
        {
          onClick: Message.RoomVoteAsked({ kind: 'fund' }),
          variant: 'outline',
          size: 'lg',
          className: css({
            minWidth: '0',
            flex: '1 1 0%',
            gap: '0.375rem',
            paddingInline: '0.5rem',
          }),
        },
        [
          icon(
            h,
            ArrowUpRight,
            css({
              width: '1rem',
              height: '1rem',
            }),
          ),
          t.room.voteFund,
        ],
        h,
      ),
      button(
        {
          onClick: Message.RoomVoteAsked({ kind: 'exit' }),
          variant: 'outline',
          size: 'lg',
          className: css({
            minWidth: '0',
            flex: '1 1 0%',
            gap: '0.375rem',
            paddingInline: '0.5rem',
          }),
        },
        [
          icon(
            h,
            DoorOpen,
            css({
              width: '1rem',
              height: '1rem',
            }),
          ),
          t.room.voteExit,
        ],
        h,
      ),
    ],
  )

  const speedRow = h.div(
    [
      h.Class(
        css({
          display: 'flex',
          gap: '0.375rem',
        }),
      ),
    ],
    [0.5, 1, 3, 10].map((speed) =>
      button(
        {
          onClick: Message.RoomSpeedChosen({ value: speed }),
          variant: model.room.speed === speed ? 'default' : 'outline',
          size: 'lg',
          className: cn(
            FIGURE,
            css({
              flex: '1 1 0%',
            }),
          ),
        },
        `${speed}×`,
        h,
      ),
    ),
  )

  const body: Array<Html> = []

  if (RoomPhase.isAnyOf(['Idle', 'Closed'])(phase)) {
    // A key that was turned off stops a Room here as well as at the API Worker.
    const allowed = canPlayOnline(model)
    body.push(
      h.p(
        [
          h.Class(
            css({
              paddingInline: '1.25rem',
              paddingTop: '1rem',
              fontSize: 'calc(0.875rem * var(--type-scale))',
              lineHeight: 'calc(1.25 / 0.875)',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [t.room.onlineHint],
      ),
    )
    if (!model.pwa.online)
      body.push(
        h.p(
          [
            h.Class(
              css({
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.5rem',
                paddingInline: '1.25rem',
                paddingTop: '0.75rem',
                fontSize: 'calc(0.875rem * var(--type-scale))',
                lineHeight: 'calc(1.25 / 0.875)',
                color: 'var(--muted-foreground)',
              }),
            ),
          ],
          [
            icon(
              h,
              WifiOff,
              css({ marginTop: '0.125rem', width: '1rem', height: '1rem', flexShrink: '0' }),
            ),
            t.pwa.offlineNote,
          ],
        ),
      )
    if (file !== null && !allowed)
      body.push(
        h.div(
          [
            h.Class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                paddingInline: '1.25rem',
                paddingTop: '1rem',
              }),
            ),
          ],
          [
            h.p(
              [
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    fontSize: 'calc(0.875rem * var(--type-scale))',
                    lineHeight: 'calc(1.25 / 0.875)',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ],
              [
                icon(
                  h,
                  Lock,
                  css({ marginTop: '0.125rem', width: '1rem', height: '1rem', flexShrink: '0' }),
                ),
                t.room.needsKey,
              ],
            ),
            button(
              {
                onClick: Message.FeatureKeyAsked(),
                variant: 'outline',
                size: 'lg',
                className: css({
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: '0.625rem',
                }),
              },
              [
                icon(
                  h,
                  KeyRound,
                  css({
                    width: '1rem',
                    height: '1rem',
                  }),
                ),
                t.panels.featureKey,
              ],
              h,
            ),
          ],
        ),
      )
    if (file !== null && allowed)
      body.push(
        h.div(
          [
            h.Class(
              css({
                paddingInline: '1.25rem',
                paddingTop: '1rem',
              }),
            ),
          ],
          [
            button(
              {
                onClick: Message.RoomPublishAsked(),
                size: 'lg',
                className: css({
                  width: '100%',
                  justifyContent: 'flex-start',
                  gap: '0.625rem',
                }),
                isDisabled: !model.pwa.online,
              },
              [
                icon(
                  h,
                  Play,
                  css({
                    width: '1rem',
                    height: '1rem',
                  }),
                ),
                file.online === null ? t.room.online : `${t.room.code} ${file.online.code}`,
              ],
              h,
            ),
            h.p(
              [
                h.Class(
                  css({
                    paddingTop: '0.5rem',
                    fontSize: 'calc(0.75rem * var(--type-scale))',
                    lineHeight: 'calc(1 / 0.75)',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ],
              [t.room.joinHint],
            ),
          ],
        ),
      )
    if (RoomPhase.guards.Closed(phase))
      body.push(
        h.p(
          [
            h.Class(
              css({
                paddingInline: '1.25rem',
                paddingTop: '0.75rem',
                fontSize: 'calc(0.875rem * var(--type-scale))',
                lineHeight: 'calc(1.25 / 0.875)',
                color: 'var(--muted-foreground)',
              }),
            ),
          ],
          [t.room.ended],
        ),
      )
  } else {
    if (RoomPhase.guards.Connecting(phase))
      body.push(
        h.p(
          [
            h.Class(
              css({
                paddingInline: '1.25rem',
                paddingTop: '1rem',
                fontSize: 'calc(0.875rem * var(--type-scale))',
                lineHeight: 'calc(1.25 / 0.875)',
                color: 'var(--muted-foreground)',
              }),
            ),
          ],
          [t.room.joining],
        ),
      )
    body.push(codeBlock(phase.code))
    body.push(nameBlock)
    if (live) {
      if (RoomPhase.guards.Reconnecting(phase))
        body.push(
          h.p(
            [
              h.Class(
                css({
                  paddingInline: '1.25rem',
                  paddingTop: '0.75rem',
                  fontSize: 'calc(0.75rem * var(--type-scale))',
                  lineHeight: 'calc(1 / 0.75)',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [t.room.connecting],
          ),
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

  const actions: Array<Html> = []
  if (live && owner) {
    actions.push(primaryButton(t.room.takeOffline, Message.RoomTakeOfflineAsked(), h))
    actions.push(secondaryButton(t.room.leave, Message.RoomLeaveAsked(), h, LogOut))
  } else if (live || RoomPhase.guards.Connecting(phase)) {
    actions.push(primaryButton(t.room.leave, Message.RoomLeaveAsked(), h))
  }

  return shell(
    t.room.title,
    [],
    [
      // A Room with four Seats and a vote runs past a short window, so the rows
      // scroll and the actions stay in reach.
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                minHeight: '0',
                flexDirection: 'column',
                overflowY: 'auto',
                paddingBottom: '1rem',
              }),
              SCROLL,
            ),
          ),
        ],
        body,
      ),
      actions.length === 0 ? h.empty : footer(actions, h),
    ],
    css({ maxWidth: 'calc(380px * var(--type-scale))' }),
    h,
  )
}

/** One labeled group of settings: the label, then a card whose rows divide. */
const settingSection = (label: string, rows: ReadonlyArray<Html>, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [label]),
      h.div(
        [
          h.Class(
            cn(
              NESTED,
              css({
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }),
            ),
          ),
        ],
        rows,
      ),
    ],
  )

/** A setting's name on the left, its control on the right. */
const settingLabelClass = css({
  fontSize: 'calc(13px * var(--type-scale))',
  fontWeight: '500',
  lineHeight: '1.375',
})
const settingRowClass = css({
  width: '100%',
  flexDirection: 'row-reverse',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1rem',
  paddingInline: '1rem',
  paddingBlock: '0.625rem',
})

const settingSwitch = (
  config: Readonly<{ id: string; label: string; isChecked: boolean; onToggle: () => Message }>,
  h: HtmlBuilder<Message>,
): Html =>
  switch_(
    {
      ...config,
      wrapperClass: settingRowClass,
      textClass: css({ minWidth: '0', flex: '1 1 0%' }),
      labelClass: settingLabelClass,
    },
    h,
  )

/** The sound level. The slider rests while muted, and the row below it turns sound back on. */
const volumeRow = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          paddingInline: '1rem',
          paddingBlock: '0.625rem',
        }),
      ),
    ],
    [
      h.submodel({
        slotId: 'volume',
        model: model.volumeSlider,
        view: VolumeSlider.view,
        toParentMessage: (message) => Message.VolumeSliderChanged({ message }),
        viewInputs: VolumeSlider.styledViewInputs(
          {
            value: model.prefs.volume,
            label: t.panels.volume,
            formatValue: (value) => `${value}%`,
            isDisabled: model.prefs.muted,
            rowClass: css({ gap: '0.5rem' }),
          },
          h,
        ),
      }),
    ],
  )
}

const languageRow = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          paddingInline: '1rem',
          paddingBlock: '0.625rem',
        }),
      ),
    ],
    [
      h.span([h.Class(settingLabelClass)], [t.panels.language]),
      languagePicker(model.prefs.locale, model.languagePicker, h),
    ],
  )
}

/** A row that leaves the panel: a link out, or an action that runs at once. */
const settingAction = (
  label: string,
  message: Message,
  glyph: IconNode,
  h: HtmlBuilder<Message>,
): Html =>
  button(
    {
      onClick: message,
      variant: 'ghost',
      size: 'lg',
      className: css({
        height: 'auto',
        width: '100%',
        justifyContent: 'space-between',
        gap: '0.625rem',
        borderRadius: '0',
        paddingInline: '1rem',
        paddingBlock: '0.625rem',
      }),
    },
    [
      h.span([h.Class(settingLabelClass)], [label]),
      icon(
        h,
        glyph,
        css({
          width: '1rem',
          height: '1rem',
          flexShrink: '0',
          color: 'var(--muted-foreground)',
        }),
      ),
    ],
    h,
  )

/** A status line reads its tone from what it says: a refusal warns, an active key confirms. */
const toneClass = (tone: Tone): string =>
  tone === 'ok'
    ? css({ color: 'var(--ok)' })
    : tone === 'warn'
      ? css({ color: 'var(--warn)' })
      : tone === 'danger'
        ? css({ color: 'var(--danger)' })
        : css({ color: 'var(--muted-foreground)' })

/**
 * The feature key: the field, the check, and what the key unlocks. The player keeps
 * the key, so removing it here only clears this browser.
 */
const featureKeyRow = (label: string, model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const note = model.pwa.online
    ? keyNote(model, t)
    : { text: t.pwa.offlineNote, tone: 'warn' as Tone }
  const checking = KeyPhase.guards.Checking(model.keyPhase)
  const canSubmit = model.pwa.online && !checking && model.keyDraft.trim() !== ''
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          paddingInline: '1rem',
          paddingBlock: '0.75rem',
        }),
      ),
    ],
    [
      h.label([h.For('feature-key'), h.Class(settingLabelClass)], [label]),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          h.label(
            [
              h.Class(
                cn(
                  WELL,
                  css({
                    display: 'flex',
                    height: '2.25rem',
                    minWidth: '0',
                    flex: '1 1 0%',
                    alignItems: 'center',
                    paddingInline: '0.625rem',
                  }),
                ),
              ),
            ],
            [
              h.input([
                h.Id('feature-key'),
                h.Type('text'),
                h.Value(model.keyDraft),
                h.Maxlength(KEY_FIELD_MAX),
                h.Placeholder('XXXX-XXXX-XXXX-XXXX'),
                h.Autocomplete('off'),
                h.Autocapitalize('characters'),
                h.Spellcheck(false),
                h.AriaLabel(label),
                h.OnInput((value) => Message.KeyTyped({ value })),
                h.OnKeyDownPreventDefault((key) =>
                  key === 'Enter' && canSubmit
                    ? Option.some(Message.KeySubmitted())
                    : Option.none(),
                ),
                h.Class(
                  css({
                    width: '100%',
                    minWidth: '0',
                    backgroundColor: 'transparent',
                    fontFamily: 'mono',
                    fontSize: 'calc(0.875rem * var(--type-scale))',
                    lineHeight: 'calc(1.25 / 0.875)',
                    textTransform: 'uppercase',
                    outlineStyle: 'none',
                    '&::placeholder': {
                      color: 'color-mix(in oklab, var(--muted-foreground) 60%, transparent)',
                      textTransform: 'none',
                    },
                  }),
                ),
              ]),
            ],
          ),
          button(
            {
              onClick: Message.KeySubmitted(),
              size: 'lg',
              isDisabled: !canSubmit,
              className: css({
                flexShrink: '0',
              }),
            },
            checking ? t.panels.featureKeyChecking : t.panels.activateFeatureKey,
            h,
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
            }),
          ),
        ],
        [
          h.p(
            [
              h.Class(
                cx(
                  css({
                    fontSize: 'calc(0.75rem * var(--type-scale))',
                    lineHeight: '1.375',
                  }),
                  toneClass(note.tone),
                ),
              ),
            ],
            [note.text],
          ),
          model.access.key === null
            ? h.empty
            : button(
                {
                  onClick: Message.KeyCleared(),
                  variant: 'ghost',
                  size: 'xs',
                  className: css({
                    color: 'var(--muted-foreground)',
                  }),
                },
                t.panels.removeFeatureKey,
                h,
              ),
        ],
      ),
    ],
  )
}

/** One setting with the control this panel has for it: a switch, a slider, a picker, or a button. */
const settingRow = (setting: Setting, model: Model, h: HtmlBuilder<Message>): Html => {
  switch (setting.kind) {
    case 'volume':
      return volumeRow(model, h)
    case 'key':
      return featureKeyRow(setting.label, model, h)
    case 'toggle':
      return settingSwitch(
        {
          id: setting.id,
          label: setting.label,
          isChecked: setting.isOn,
          onToggle: () => setting.message,
        },
        h,
      )
    case 'language':
      return languageRow(model, h)
    case 'action':
      return settingAction(setting.label, setting.message, setting.glyph, h)
  }
}

/**
 * Install and update for the whole app. A browser without an install dialog
 * gets its own instructions, and iPhone and iPad get the storage note: the
 * installed app does not see this browser's Company files.
 */
const pwaSettingsSection = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  if (model.pwa.installed && !model.pwa.updateReady) return h.empty
  const family = browserFamilyOf()
  const rows: Array<Html> = []
  if (!model.pwa.installed) {
    rows.push(
      model.pwa.installable
        ? settingAction(t.pwa.installQuorum, Message.PwaInstallChosen(), Download, h)
        : h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  paddingInline: '1rem',
                  paddingBlock: '0.75rem',
                }),
              ),
            ],
            [
              h.span([h.Class(settingLabelClass)], [t.pwa.installQuorum]),
              h.p(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(0.75rem * var(--type-scale))',
                      lineHeight: '1.375',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [t.pwa.installHelp[family]],
              ),
            ],
          ),
    )
    if (onIos())
      rows.push(
        h.p(
          [
            h.Class(
              css({
                paddingInline: '1rem',
                paddingBlock: '0.75rem',
                fontSize: 'calc(0.75rem * var(--type-scale))',
                lineHeight: '1.375',
                color: 'var(--muted-foreground)',
              }),
            ),
          ],
          [t.pwa.moveNote],
        ),
      )
  }
  if (model.pwa.updateReady)
    rows.push(
      settingAction(t.pwa.updateReady, Message.PwaUpdateChosen(), RefreshCw, h),
      h.p(
        [
          h.Class(
            css({
              paddingInline: '1rem',
              paddingBottom: '0.75rem',
              fontSize: 'calc(0.75rem * var(--type-scale))',
              lineHeight: '1.375',
              color: 'var(--muted-foreground)',
            }),
          ),
        ],
        [t.pwa.updateReadyDetail],
      ),
    )
  return settingSection(t.pwa.app, rows, h)
}

export const settingsPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const sections = settingsSections(model, t)
  const section = (id: SettingsSection): Html => {
    const found = sections.find((entry) => entry.id === id)!
    // The Agent room id belongs beside the switch that opens the relay, and only on the board.
    const rows = found.rows.flatMap((row) =>
      row.kind === 'toggle' && row.id === 'agent-access' && model.prefs.agentAccess
        ? [settingRow(row, model, h), agentRoomRow(model, h)]
        : [settingRow(row, model, h)],
    )
    return settingSection(found.label, rows, h)
  }

  return shell(
    t.panels.settings,
    [],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                minHeight: '0',
                flexDirection: 'column',
                gap: '1rem',
                paddingInline: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '1.25rem',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          // The slider takes the full width; the sections below split into two balanced columns.
          // A phone folds both columns back into one.
          section('sound'),
          h.div(
            [
              h.Class(
                css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  alignItems: 'flex-start',
                  columnGap: '1.25rem',
                  rowGap: '1rem',
                  _compact: {
                    gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
                  },
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      _compact: {
                        display: 'contents',
                      },
                    }),
                  ),
                ],
                [section('play'), section('display')],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem',
                      _compact: {
                        display: 'contents',
                      },
                    }),
                  ),
                ],
                [section('access'), section('privacy'), section('save')],
              ),
            ],
          ),
          pwaSettingsSection(model, h),
        ],
      ),
    ],
    css({ maxWidth: 'calc(760px * var(--type-scale))' }),
    h,
  )
}

export const offerPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const deal = offer(model.board.game)
  if (!deal) return h.empty
  const ipo = model.board.game.stage === PRE_IPO_STAGE
  const title = ipo
    ? t.panels.iPO
    : t.panels.round(t.catalog.eras[model.board.game.stage + 1]?.name ?? deal.era.name)
  // A Room decides the round by vote, so the offer shows that vote while it is open.
  const vote =
    roomLive(model) && model.room.vote !== null && model.room.vote.kind !== 'exit'
      ? model.room.vote
      : null
  if (vote !== null)
    return shell(
      title,
      [],
      [
        h.div(
          [
            h.Class(
              css({
                paddingInline: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '1.25rem',
              }),
            ),
          ],
          [voteCard(model, vote, h)],
        ),
      ],
      css({ maxWidth: 'calc(420px * var(--type-scale))' }),
      h,
    )
  return shell(
    title,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.75rem',
              paddingInline: '1.25rem',
              paddingTop: '0.25rem',
              paddingBottom: '1.25rem',
              _narrow: {
                gridTemplateColumns: 'repeat(1, minmax(0, 1fr))',
              },
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  borderRadius: 'xl',
                  layerStyle: 'raised',
                  padding: '1rem',
                  boxShadow: 'raised',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(15px*var(--type-scale))',
                      fontWeight: '600',
                    }),
                  ),
                ],
                [ipo ? t.panels.goPublic : t.panels.raise],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flex: '1 1 0%',
                      flexDirection: 'column',
                      gap: '0.125rem',
                      fontSize: 'calc(13px*var(--type-scale))',
                      color: 'var(--muted-foreground)',
                    }),
                  ),
                ],
                [
                  h.span([], [t.panels.cash(money(deal.grant))]),
                  h.span(
                    [],
                    [
                      t.panels.equity(
                        Math.round(model.board.game.equity * 100),
                        Math.round(model.board.game.equity * (1 - deal.dilution) * 100),
                      ),
                    ],
                  ),
                  h.span([], [ipo ? t.panels.quartersBegin : t.panels.fullGrowth]),
                ],
              ),
              primaryButton(ipo ? t.panels.goPublic : t.panels.raise, Message.RoundRaised(), h),
            ],
          ),
          ipo
            ? h.empty
            : h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      borderRadius: 'xl',
                      backgroundColor: 'var(--surface-nested)',
                      padding: '1rem',
                      boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontSize: 'calc(15px*var(--type-scale))',
                          fontWeight: '600',
                        }),
                      ),
                    ],
                    [t.panels.decline],
                  ),
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          flex: '1 1 0%',
                          flexDirection: 'column',
                          gap: '0.125rem',
                          fontSize: 'calc(13px*var(--type-scale))',
                          color: 'var(--muted-foreground)',
                        }),
                      ),
                    ],
                    [
                      h.span([], [t.panels.noCash]),
                      h.span([], [t.panels.equityStays(Math.round(model.board.game.equity * 100))]),
                      h.span([], [t.panels.growth07]),
                    ],
                  ),
                  secondaryButton(t.panels.decline, Message.RoundDeclined(), h),
                ],
              ),
        ],
      ),
    ],
    css({ maxWidth: '620px' }),
    h,
  )
}

export const eraPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const era = localized(eraOf(model.board.game), eraWords(t, model.board.game))
  return shell(
    era.name,
    [],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                paddingInline: '1.25rem',
                paddingTop: '0.25rem',
                paddingBottom: '1.25rem',
              }),
              'stagger',
            ),
          ),
        ],
        [
          h.img([
            h.Src(`/art/era-${Math.min(7, model.board.game.stage)}.svg`),
            h.Alt(''),
            h.Class(
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
          ]),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(26px*var(--type-scale))',
                  fontWeight: '600',
                  lineHeight: '1.25',
                  letterSpacing: '-0.035em',
                }),
              ),
            ],
            [era.question],
          ),
          h.p(
            [
              h.Class(
                css({
                  fontSize: 'calc(14px*var(--type-scale))',
                  lineHeight: '1.625',
                  color: 'var(--muted-foreground)',
                }),
              ),
            ],
            [era.arrivals],
          ),
          stats(
            css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
            [
              stat(
                t.panels.nextRound,
                Number.isFinite(era.raiseAt) ? t.panels.users(compact(era.raiseAt)) : '—',
                h,
              ),
              stat(t.panels.apdexTarget, era.apdexTarget.toFixed(2), h),
              stat(t.panels.prices, `×${era.costIndex}`, h),
            ],
            h,
          ),
        ],
      ),
      footer([primaryButton(t.panels.continueText, Message.PanelClosed(), h)], h),
    ],
    css({ maxWidth: '620px' }),
    h,
  )
}

export const endPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return shell(
    t.panels.iPO,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1.25rem',
              paddingInline: '2rem',
              paddingTop: '1rem',
              paddingBottom: '2rem',
              _compact: {
                gap: '0.75rem',
                paddingInline: '1.25rem',
                paddingBottom: '1.25rem',
              },
            }),
          ),
        ],
        [
          h.img([
            h.Src('/art/hero.svg'),
            h.Alt(''),
            h.Class(
              css({
                width: '100%',
                maxWidth: '520px',
                _short: {
                  maxHeight: '30dvh',
                  width: 'auto',
                },
              }),
            ),
          ]),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(30px*var(--type-scale))',
                  fontWeight: '600',
                  letterSpacing: '-0.035em',
                }),
              ),
            ],
            [t.panels.theCompanyIsPublic],
          ),
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
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  gap: '0.5rem',
                }),
              ),
            ],
            [primaryButton(t.panels.keepPlaying, Message.PanelClosed(), h)],
          ),
        ],
      ),
    ],
    css({ maxWidth: '760px' }),
    h,
  )
}

export const devPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return shell(
    t.panels.developer,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              paddingInline: '1.25rem',
              paddingTop: '0.25rem',
              paddingBottom: '1.25rem',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.panels.speed]),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                speedsOf(model.board.game).map((speed) =>
                  button(
                    {
                      onClick: Message.SpeedChosen({ speed }),
                      variant: model.board.clock.speed === speed ? 'default' : 'outline',
                      size: 'lg',
                      className: cn(
                        FIGURE,
                        css({
                          width: '4rem',
                        }),
                      ),
                      attributes: [h.Key(String(speed))],
                    },
                    `${speed}×`,
                    h,
                  ),
                ),
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.panels.skipAhead]),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                [
                  nextEra(model.board.game) && !isFinalEra(model.board.game)
                    ? secondaryButton(
                        t.panels.skipTo(nextEra(model.board.game)?.name ?? ''),
                        Message.CheatRound(),
                        h,
                      )
                    : h.empty,
                  secondaryButton(`+${money(cheatCash(model.board.game))}`, Message.CheatCash(), h),
                  secondaryButton(
                    t.panels.insight(cheatInsight(model.board.game).toLocaleString('en-US')),
                    Message.CheatInsight(),
                    h,
                  ),
                  secondaryButton(t.panels.n20Legacy, Message.CheatLegacy(), h),
                ],
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.panels.startAnIncident]),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                INCIDENT_IDS.map((kind) =>
                  secondaryButton(
                    t.catalog.incidents[kind].name,
                    Message.IncidentForced({ kind }),
                    h,
                  ),
                ),
              ),
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                }),
              ),
            ],
            [
              h.span([h.Class(EYEBROW)], [t.panels.log]),
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }),
                  ),
                ],
                [
                  secondaryButton(t.panels.exportLog, Message.LogExported(), h, Download),
                  secondaryButton(t.panels.clearLog, Message.LogCleared(), h, Trash2),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
    css({ maxWidth: '640px' }),
    h,
  )
}
