import { css, cx } from '@quorum/styled-system/css'
import { formats, stallReasonIn } from '@/i18n/format.ts'
import { type Messages, copy, eraWords, localized } from '@/i18n/messages.ts'
import { Option } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Circle,
  CircleCheck,
  BookCopy,
  BookOpen,
  Camera,
  CameraOff,
  ChartLine,
  CircleHelp,
  DatabaseZap,
  DoorOpen,
  Ellipsis,
  Expand,
  FlaskConical,
  Hammer,
  type IconNode,
  Menu,
  Pause,
  Play,
  Rocket,
  LayoutGrid,
  Scan,
  ShieldCheck,
  Smile,
  Timer,
  TriangleAlert,
  Redo2,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  X,
} from 'lucide'
import {
  OPEN_REGION_PRICE,
  FAILURE_YIELD,
  REGIONS,
  REGION_INFO,
  researchList,
  type InsightPool,
} from '@quorum/simulation/catalog'
import { openRegions, regional } from '@quorum/simulation/regions'
import { RUNWAY_MONTH, runwayOf } from '@quorum/simulation/runway'
import { tabDrift } from './mirror.ts'
import { canRaise } from '@quorum/simulation/actions'
import type { Ledger } from '@quorum/simulation/ledger'
import { eraOf, has, nextEra, researchReady, securityStaffed } from '@quorum/simulation/lookups'
import {
  limitingPool,
  progressOf as studyProgressOf,
  recipeOf as simRecipe,
  studyStall,
} from '@quorum/simulation/studies'
import { DRILL_RPO } from '@quorum/simulation/catalog'
import { PRE_IPO_STAGE, brokenRestore, checklistOf, residencyMet } from '@quorum/simulation/ipo'
import {
  GUIDANCE_GROWTH,
  GUIDANCE_MARGIN,
  guidanceOpen,
  quarterGrowth,
} from '@quorum/simulation/quarters'
import { budgetOf, budgeted, slaCreditsOf } from '@quorum/simulation/slo'
import { marginOf, valuationOf } from '@quorum/simulation/valuation'
import { clockOf } from '@quorum/simulation/solve'
import { devHoursRate } from '@quorum/simulation/team'
import { awaitingFeatures } from '@quorum/simulation/features'
import { overdueBy } from '@quorum/simulation/cve'
import { workItemName } from './team.ts'
import { redoAvailable, settleProgress, undoAvailable } from '@/game/feedback.ts'
import { clock as mmss, compact, money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  clockPaused,
  exitLegacy,
  offCompany,
  type Board,
  type Delta,
  type Model,
} from '@/game/model.ts'
import { drillPassed, drillRto } from '@quorum/simulation/drill-machine'
import { POOL_ICONS, POOL_ORDER, poolColor } from '@quorum/ui/game/pools'
import { moreMenu, type MoreItem } from '@/game/more.ts'
import { WIKI_URL } from '@/platform/analytics.ts'
import { glowing, playbooksShown, shown } from '@/game/reveal.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import {
  CHIPS,
  EYEBROW,
  FLOAT,
  FIGURE,
  PANEL,
  SCROLL,
  WELL,
  type Tone,
  meter,
  ring,
  tool,
  toneText,
} from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

/** A phone shows Apdex before Errors and Latency, which scroll off the edge. */
const CHIP_ORDER: Record<string, string> = {
  Errors: css({ _compact: { order: 2 } }),
  p99: css({ _compact: { order: 3 } }),
  Latency: css({ _compact: { order: 3 } }),
  SLO: css({ _compact: { order: 2 } }),
  SLA: css({ _compact: { order: 2 } }),
}

/** One stat: a glyph and its name, then the value and a short note. */
const stat = (
  name: string,
  glyph: IconNode,
  value: string,
  note: string,
  tone: Tone,
  h: HtmlBuilder<Message>,
  title = name,
  className = '',
  onClick?: Message,
): Html =>
  h.div(
    [
      h.Key(name),
      h.Title(title),
      ...(onClick
        ? [
            h.OnClick(onClick),
            h.OnKeyDownPreventDefault((key) =>
              key === 'Enter' || key === ' ' ? Option.some(onClick) : Option.none(),
            ),
            h.Role('button'),
            h.Tabindex(0),
            h.AriaLabel(title),
          ]
        : []),
      h.Class(
        cx(
          css({
            display: 'flex',
            height: '8',
            alignItems: 'center',
            gap: '2.5',
            paddingInline: '2.5',
            _compact: {
              flexShrink: '0',
              gap: '1.5',
              paddingInline: '3',
            },
          }),
          CHIP_ORDER[name],
          className,
        ),
      ),
    ],
    [
      icon(
        h,
        glyph,
        css({
          width: '3.5',
          height: '3.5',
          flexShrink: '0',
          color: 'mutedForeground',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              width: 'var(--hud-label-width,calc(46px*var(--type-scale)))',
              flexShrink: '0',
              fontSize: 'type.11-5',
              color: 'mutedForeground',
              _compact: {
                display: 'none',
              },
            }),
          ),
        ],
        [name],
      ),
      // With no note, the tone colours the value itself.
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.13-5',
                lineHeight: 'none',
                whiteSpace: 'nowrap',
              }),
              note || tone === 'plain' ? '' : toneText(tone),
            ),
          ),
        ],
        [value],
      ),
      note
        ? h.span(
            [
              h.Title(note),
              h.Class(
                cx(
                  FIGURE,
                  css({
                    marginLeft: 'auto',
                    minWidth: '0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: 'type.10',
                    lineHeight: 'none',
                    _compact: {
                      marginLeft: '0.5',
                    },
                  }),
                  tone === 'plain'
                    ? css({
                        color: 'mutedForeground',
                      })
                    : toneText(tone),
                ),
              ),
            ],
            [note],
          )
        : h.empty,
    ],
  )

/** What Insight is, how it is earned and spent, and how much a pool keeps. */
const insightHelpOf = (t: Messages): ReadonlyArray<readonly [string, string]> => [
  [t.hud.pools, t.hud.insightPaysForResearchEachRequest],
  [t.hud.earn, t.hud.analyticsSamplesTheNodesItLinks(FAILURE_YIELD)],
  [t.hud.spend, t.hud.eachResearchItemCostsInsightFrom],
  [t.hud.keep, t.hud.aPoolHoldsAtMostIts],
]

/** What Insight is, in a dialog to the right of the card; below it on a phone. */
const insightHelp = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Key('insight-help'),
      h.Role('dialog'),
      h.AriaLabel(t.hud.aboutInsight),
      h.Class(
        cx(
          cx(
            css({
              position: 'absolute',
              top: '0',
              left: 'calc(100%+8px)',
              zIndex: '30',
              display: 'flex',
              width: '288px',
              flexDirection: 'column',
              gap: '2.5',
              padding: '3.5',
              _compact: {
                top: 'calc(100%+6px)',
                left: '0',
                width: '100%',
              },
            }),
            'enter-pop',
          ),
          FLOAT,
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
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.13',
                  fontWeight: 'semibold',
                }),
              ),
            ],
            [t.hud.aboutInsight],
          ),
          h.button(
            [
              h.Type('button'),
              h.AriaLabel(t.hud.close),
              h.Title(t.hud.closeEsc),
              h.OnClick(Message.InsightHelpToggled()),
              h.Class(
                css({
                  display: 'grid',
                  width: '6',
                  height: '6',
                  placeItems: 'center',
                  borderRadius: 'md',
                  color: 'mutedForeground',
                  _hover: {
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                    color: 'foreground',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                X,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ],
          ),
        ],
      ),
      h.dl(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2.5',
            }),
          ),
        ],
        insightHelpOf(t).map(([term, text]) =>
          h.div(
            [
              h.Key(term),
              h.Class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                }),
              ),
            ],
            [
              h.dt([h.Class(EYEBROW)], [term]),
              h.dd(
                [
                  h.Class(
                    css({
                      fontSize: 'type.12',
                      lineHeight: 'snug',
                      color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                    }),
                  ),
                ],
                [text],
              ),
            ],
          ),
        ),
      ),
    ],
  )
}

/** One pool: its icon and name, then what it holds and what it earns. */
const poolRow = (
  pool: InsightPool,
  held: number,
  perSecond: number,
  inStudy: boolean,
  limiting: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Key(pool),
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontSize: 'type.12',
            lineHeight: 'none',
          }),
          inStudy &&
            css({
              fontWeight: 'semibold',
            }),
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              display: 'inline-flex',
            }),
          ),
          h.Style({ color: poolColor(pool) }),
        ],
        [
          icon(
            h,
            POOL_ICONS[pool],
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
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
            }),
          ),
        ],
        [t.catalog.pools[pool].label],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              limiting &&
                css({
                  color: 'danger',
                }),
            ),
          ),
        ],
        [compact(held)],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                width: '52px',
                textAlign: 'right',
                fontSize: 'type.10-5',
                fontWeight: 'normal',
              }),
              perSecond > 0
                ? css({
                    color: 'ok',
                  })
                : limiting
                  ? css({
                      color: 'danger',
                    })
                  : css({
                      color: 'mutedForeground',
                    }),
            ),
          ),
        ],
        [t.hud.s(perSecond.toFixed(1))],
      ),
    ],
  )
}

/**
 * Insight, in its own card: the running Study and its progress, then a row for
 * every pool the Design holds or earns. The (?) opens what the pools are and
 * how they fill, in the card.
 */
const insightCard = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const running = game.studies[0]
  const recipe = running ? simRecipe(game, running.id) : {}
  const limit = running ? limitingPool(game) : null
  const stall = running ? studyStall(game, ledger, running.id) : null
  const queued = game.studies.length - 1
  const runningLabel = `${stall ? t.research.cannotRunShort : `${Math.floor(studyProgressOf(running) * 100)}%`}${queued > 0 ? ` · +${queued}` : ''}`
  const pools = POOL_ORDER.filter(
    (pool) => game.pools[pool] >= 1 || ledger.insight[pool] > 0 || (recipe[pool] ?? 0) > 0,
  )
  return h.section(
    [
      h.Key('insight'),
      h.AriaLabel(t.hud.insight),
      h.Class(
        cx(
          cx(
            css({
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              padding: '2.5',
              _compact: {
                pointerEvents: 'auto',
                padding: '2',
              },
            }),
            'enter-pop',
          ),
          PANEL,
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
              gap: '1',
            }),
          ),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.Title(stall ? t.hud.researchR(stallReasonIn(t, stall)) : t.hud.researchR2),
              h.OnClick(
                Message.PanelOpened({ panel: model.panel === 'research' ? 'none' : 'research' }),
              ),
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  alignItems: 'center',
                  gap: '2',
                  borderRadius: 'md',
                  paddingInline: '1',
                  paddingBlock: '0.5',
                  textAlign: 'left',
                  fontSize: 'type.12',
                  _hover: {
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                FlaskConical,
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                  color: 'mutedForeground',
                }),
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      css({
                        minWidth: '0',
                        flex: '1 1 0%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }),
                      running
                        ? css({
                            fontWeight: 'medium',
                          })
                        : css({
                            color: 'mutedForeground',
                          }),
                    ),
                  ),
                ],
                [running ? t.catalog.research[running.id].name : t.hud.idle],
              ),
              running
                ? h.span(
                    [
                      h.Class(
                        cx(
                          FIGURE,
                          css({
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1',
                            fontSize: 'type.10-5',
                          }),
                          stall
                            ? css({
                                color: 'warn',
                              })
                            : css({
                                color: 'mutedForeground',
                              }),
                        ),
                      ),
                    ],
                    [
                      stall
                        ? icon(
                            h,
                            TriangleAlert,
                            css({
                              width: '3',
                              height: '3',
                            }),
                          )
                        : h.empty,
                      runningLabel,
                    ],
                  )
                : h.empty,
            ],
          ),
          h.button(
            [
              h.Type('button'),
              h.Title(t.hud.aboutInsight),
              h.AriaLabel(t.hud.aboutInsight),
              h.AriaExpanded(model.board.insightHelp),
              h.OnClick(Message.InsightHelpToggled()),
              h.Class(
                cx(
                  css({
                    display: 'grid',
                    width: '6',
                    height: '6',
                    flexShrink: '0',
                    placeItems: 'center',
                    borderRadius: 'md',
                    _hover: {
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                    },
                  }),
                  model.board.insightHelp
                    ? css({
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                        color: 'foreground',
                      })
                    : css({
                        color: 'mutedForeground',
                      }),
                ),
              ),
            ],
            [
              icon(
                h,
                CircleHelp,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ],
          ),
        ],
      ),
      running
        ? meter(
            studyProgressOf(running),
            stall
              ? css({
                  backgroundColor: 'warn',
                })
              : css({ backgroundColor: 'ok' }),
            h,
          )
        : h.empty,
      pools.length > 0
        ? h.div(
            [
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2',
                    borderRadius: 'lg',
                    paddingInline: '2.5',
                    paddingBlock: '2',
                  }),
                  WELL,
                  css({
                    _compact: {
                      maxHeight: '28',
                      overflowY: 'auto',
                    },
                  }),
                ),
              ),
            ],
            pools.map((pool) =>
              poolRow(
                pool,
                game.pools[pool],
                ledger.insight[pool],
                (recipe[pool] ?? 0) > 0,
                pool === limit && ledger.insight[pool] <= 0,
                h,
              ),
            ),
          )
        : h.empty,
      model.board.insightHelp ? insightHelp(h) : h.empty,
    ],
  )
}

const percent = (share: number): string => `${(Math.floor(share * 10_000) / 100).toFixed(2)}%`

/** Availability over the week against the Era's SLO; the error budget left with SLO dashboards. */
const slo = (game: Board['game'], h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const budget = budgetOf(game)
  const left = Math.max(0, budget.left)
  return stat(
    'SLO',
    ShieldCheck,
    percent(budget.availability),
    has(game, 'slo-dashboards')
      ? budget.left > 0
        ? t.hud.left(Math.round(left * 100))
        : t.hud.spent
      : `/ ${Number((budget.slo * 100).toFixed(2))}%`,
    budget.left > 0.5 ? 'ok' : budget.left > 0 ? 'warn' : 'danger',
    h,
    t.hud.availabilityThisWeekAgainstTheError(
      percent(budget.slo),
      budget.left > 0 ? t.hud.left(Math.round(left * 100)) : t.hud.spent,
    ),
  )
}

/** What the toolbar takes from the top row of a phone: the funding row leaves it free. */
const TOOLBAR_ROOM = css({
  _compact: { minHeight: '9', paddingRight: 'var(--toolbar-w)' },
})

const funding = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  const share = next ? Math.min(1, game.users / era.raiseAt) : 1
  const ready = canRaise(game)
  const clock = clockOf(game.time)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5',
          paddingInline: '2.5',
          paddingTop: '1.5',
          paddingBottom: '2',
          _compact: {
            paddingBottom: '1',
          },
        }),
      ),
      h.Title(next ? t.hud.roundAtUsers(next.name, compact(era.raiseAt)) : era.name),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              }),
              TOOLBAR_ROOM,
            ),
          ),
        ],
        [
          button(
            {
              onClick: Message.PanelOpened({ panel: 'menu' }),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                marginLeft: '-0.375rem',
                color: 'mutedForeground',
              }),
              attributes: [h.AriaLabel(t.hud.menuEsc), h.Title(t.hud.menuEsc)],
            },
            icon(
              h,
              Menu,
              css({
                width: '4',
                height: '4',
              }),
            ),
            h,
          ),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'type.13',
                  fontWeight: 'semibold',
                  _compact: {
                    flexShrink: '0',
                  },
                }),
              ),
            ],
            [era.name],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    marginLeft: 'auto',
                    fontSize: 'type.10-5',
                    color: 'mutedForeground',
                    _compact: {
                      display: 'none',
                    },
                  }),
                ),
              ),
              h.Title(t.hud.calendarOneSecondIsOneMinute),
            ],
            [
              t.hud.d(
                clock.day,
                String(clock.hour).padStart(2, '0'),
                String(clock.minute).padStart(2, '0'),
              ),
            ],
          ),
        ],
      ),
      meter(
        share,
        ready
          ? css({
              backgroundColor: 'ok',
            })
          : css({ layerStyle: 'primaryFill' }),
        h,
      ),
      ready && next
        ? button(
            {
              onClick: Message.PanelOpened({ panel: 'offer' }),
              size: 'sm',
              className: cx(
                css({
                  marginTop: '1',
                  width: '100%',
                }),
                'enter-pop',
                'shine',
              ),
              attributes: [h.Key('offer'), h.DataAttribute('exit', 'gesture')],
            },
            [
              icon(
                h,
                Rocket,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              game.stage === PRE_IPO_STAGE ? t.hud.iPO : t.hud.offer(next.name),
            ],
            h,
          )
        : h.empty,
    ],
  )
}

/** What the Team builds now: the top of the backlog, and how fast. Opens the Team panel. */
const building = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const item = game.backlog[0]
  const rate = devHoursRate(game, ledger) * 60
  const ready = awaitingFeatures(game).length
  // A patch ticket has a deadline: its clock replaces the pace, and turns red when it is overdue.
  const late = item ? overdueBy(game, item) : 0
  const due = item?.due === undefined ? null : item.due - game.time
  return h.button(
    [
      h.Key('building'),
      h.Type('button'),
      h.Title(t.hud.teamT),
      h.OnClick(Message.PanelOpened({ panel: model.panel === 'team' ? 'none' : 'team' })),
      h.Class(
        cx(
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5',
              borderRadius: 'xl',
              paddingInline: '2.5',
              paddingBlock: '2',
              textAlign: 'left',
              _hover: {
                backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
              },
              _compact: {
                display: 'none',
              },
            }),
            'enter-pop',
          ),
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
              gap: '2',
              fontSize: 'type.12',
            }),
          ),
        ],
        [
          icon(
            h,
            Hammer,
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              color: 'mutedForeground',
            }),
          ),
          h.span(
            [
              h.Class(
                cx(
                  css({
                    minWidth: '0',
                    flex: '1 1 0%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }),
                  item
                    ? css({
                        fontWeight: 'medium',
                      })
                    : css({
                        color: 'mutedForeground',
                      }),
                  late > 0 &&
                    css({
                      color: 'danger',
                    }),
                ),
              ),
            ],
            [item ? workItemName(t, item) : t.hud.idle],
          ),
          due !== null
            ? h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                      }),
                      late > 0
                        ? css({
                            fontWeight: 'medium',
                            color: 'danger',
                          })
                        : css({
                            color: 'mutedForeground',
                          }),
                    ),
                  ),
                ],
                [late > 0 ? t.hud.overdue : t.hud.due(mmss(due))],
              )
            : ready > 0
              ? h.span(
                  [
                    h.Class(
                      cx(
                        FIGURE,
                        css({
                          fontSize: 'type.10-5',
                          color: 'primaryStrong',
                        }),
                      ),
                    ),
                  ],
                  [t.hud.toDeploy(ready)],
                )
              : h.span(
                  [
                    h.Class(
                      cx(
                        FIGURE,
                        css({
                          fontSize: 'type.10-5',
                          color: 'mutedForeground',
                        }),
                      ),
                    ),
                  ],
                  [t.hud.dHMin(rate < 10 ? rate.toFixed(1) : Math.round(rate))],
                ),
        ],
      ),
      item ? meter(item.spent / item.cost, css({ backgroundColor: 'ok' }), h) : h.empty,
    ],
  )
}

/** One figure in the phone's status row: an icon and its value, tappable when it has more to show. */
const phoneFigure = (
  label: string,
  glyph: IconNode,
  value: string,
  tone: Tone,
  onClick: Message | null,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.AriaLabel(label),
      h.Title(label),
      ...(onClick ? [h.OnClick(onClick)] : [h.Disabled(true)]),
      h.Class(
        css({
          display: 'flex',
          height: '11',
          minWidth: '0',
          flex: '1 1 0%',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.5',
          paddingInline: '1',
          _disabled: {
            opacity: 1,
          },
        }),
      ),
    ],
    [
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
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'type.13-5',
                lineHeight: 'none',
                whiteSpace: 'nowrap',
              }),
              tone === 'plain' ? '' : toneText(tone),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

/**
 * The phone's status card: the Era and its Milestone, then the three figures that decide the next
 * move. Everything else the desktop HUD shows waits in Vitals, one tap away.
 */
const phoneHud = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  const share = next ? Math.min(1, game.users / era.raiseAt) : 1
  const ready = canRaise(game)
  const target = eraOf(game).apdexTarget
  return h.header(
    [
      h.Key('phone-hud'),
      h.Title(next ? t.hud.roundAtUsers(next.name, compact(era.raiseAt)) : era.name),
      h.Class(
        css({
          pointerEvents: 'auto',
          display: 'none',
          flexDirection: 'column',
          gap: '1.5',
          borderRadius: '2xl',
          layerStyle: 'surface',
          padding: '1.5',
          boxShadow: 'card',
          _compact: {
            display: 'flex',
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
              height: '11',
              alignItems: 'center',
              gap: '1',
              paddingRight: 'var(--toolbar-w)',
            }),
          ),
        ],
        [
          h.button(
            [
              h.Type('button'),
              h.AriaLabel(t.hud.menuEsc),
              h.Title(t.hud.menuEsc),
              h.OnClick(Message.PanelOpened({ panel: 'menu' })),
              h.Class(
                css({
                  display: 'grid',
                  width: '11',
                  height: '11',
                  flexShrink: '0',
                  placeItems: 'center',
                  borderRadius: 'xl',
                  color: 'mutedForeground',
                  _hover: {
                    backgroundColor: 'well',
                    color: 'foreground',
                  },
                }),
              ),
            ],
            [
              icon(
                h,
                Menu,
                css({
                  width: '5',
                  height: '5',
                }),
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  minWidth: '0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.15',
                  fontWeight: 'semibold',
                }),
              ),
            ],
            [era.name],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              paddingInline: '0.5',
            }),
          ),
        ],
        [
          meter(
            share,
            ready
              ? css({
                  backgroundColor: 'ok',
                })
              : css({ layerStyle: 'primaryFill' }),
            h,
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                '& > :not(:last-child)': {
                  borderRightWidth: '1px',
                  borderRightStyle: 'solid',
                  borderColor: 'hairline',
                },
              }),
              WELL,
            ),
          ),
        ],
        [
          phoneFigure(
            t.hud.cash,
            Wallet,
            money(game.cash),
            game.cash < 0 ? 'danger' : 'plain',
            Message.PanelOpened({ panel: 'vitals' }),
            h,
          ),
          phoneFigure(
            t.hud.users,
            Users,
            compact(game.users),
            'plain',
            Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
            h,
          ),
          phoneFigure(
            'Apdex',
            Smile,
            game.apdex.toFixed(2),
            game.apdex >= target ? 'ok' : 'danger',
            Message.PanelOpened({ panel: 'vitals' }),
            h,
          ),
        ],
      ),
    ],
  )
}

/** One line of Vitals: a name, its figure and a note, with the whole row as the tap target. */
const vitalRow = (
  name: string,
  glyph: IconNode,
  value: string,
  note: string,
  tone: Tone,
  onClick: Message | null,
  h: HtmlBuilder<Message>,
  title = name,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.Title(title),
      h.AriaLabel(title),
      ...(onClick ? [h.OnClick(onClick)] : [h.Disabled(true)]),
      h.Class(
        css({
          display: 'flex',
          minHeight: '12',
          width: '100%',
          alignItems: 'center',
          gap: '3',
          paddingInline: '3.5',
          textAlign: 'left',
          _disabled: { opacity: 1 },
          _enabled: { _hover: { backgroundColor: 'well' } },
        }),
      ),
    ],
    [
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
      h.span(
        [
          h.Class(
            css({
              minWidth: 0,
              flex: '1 1 0%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.13',
            }),
          ),
        ],
        [name],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                flexShrink: '0',
                fontSize: 'type.14',
                lineHeight: 'none',
              }),
              tone === 'plain' ? '' : toneText(tone),
            ),
          ),
        ],
        [value],
      ),
      note
        ? h.span(
            [
              h.Title(note),
              h.Class(
                cx(
                  FIGURE,
                  css({
                    flexShrink: '0',
                    fontSize: 'type.11',
                    lineHeight: 'none',
                  }),
                  tone === 'plain'
                    ? css({
                        color: 'mutedForeground',
                      })
                    : toneText(tone),
                ),
              ),
            ],
            [note],
          )
        : h.empty,
    ],
  )

/**
 * Everything the desktop HUD keeps in view, on one scrolling phone page: the Era, every figure,
 * the Insight pools, and the Pre-IPO or quarter work. The board stays the first screen.
 */
export const vitalsPanel = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  const share = next ? Math.min(1, game.users / era.raiseAt) : 1
  const ready = canRaise(game)
  const target = eraOf(game).apdexTarget
  const income = has(game, 'stripe') ? ledger.revenue : 0
  const net = income - ledger.burn
  const then = game.history.at(-30)
  const trend = then ? game.users - then.users : 0
  const errors = ledger.errorShare * 100
  const percentiles = has(game, 'percentiles')
  const runway = runwayOf(game, ledger)
  const short = game.cash <= 0
  const bridging = game.bridge._tag === 'Offered'
  const credit = slaCreditsOf(game, ledger)
  const cashNote = bridging
    ? t.hud.bridgeOffered
    : short
      ? t.hud.outOfCash
      : `${t.units.perSecond(`${net >= 0 ? '+' : ''}${money(net)}`)}${runway === null ? '' : ` · ${t.hud.runwayMonths((runway / RUNWAY_MONTH).toFixed(1))}`}`
  return shell(
    t.hud.vitals,
    [],
    [
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '5',
                paddingInline: '4',
                paddingTop: '1',
                paddingBottom: '6',
              }),
              SCROLL,
            ),
          ),
        ],
        [
          h.div(
            [h.Class(css({ display: 'flex', flexDirection: 'column', gap: '2' }))],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                      gap: '3',
                    }),
                  ),
                ],
                [
                  h.span(
                    [
                      h.Class(
                        css({
                          fontSize: 'type.15',
                          fontWeight: 'semibold',
                        }),
                      ),
                    ],
                    [era.name],
                  ),
                  next
                    ? h.span(
                        [
                          h.Class(
                            cx(
                              FIGURE,
                              css({
                                fontSize: 'type.11-5',
                                color: 'mutedForeground',
                              }),
                            ),
                          ),
                        ],
                        [t.hud.roundAtUsers(next.name, compact(era.raiseAt))],
                      )
                    : h.empty,
                ],
              ),
              meter(
                share,
                ready
                  ? css({
                      backgroundColor: 'ok',
                    })
                  : css({ layerStyle: 'primaryFill' }),
                h,
              ),
              ready && next
                ? button(
                    {
                      onClick: Message.PanelOpened({ panel: 'offer' }),
                      size: 'lg',
                      className: css({
                        marginTop: '1',
                        width: '100%',
                      }),
                    },
                    [
                      icon(
                        h,
                        Rocket,
                        css({
                          width: '4',
                          height: '4',
                        }),
                      ),
                      t.hud.offer(next.name),
                    ],
                    h,
                  )
                : h.empty,
            ],
          ),
          h.div(
            [
              h.Class(
                cx(
                  WELL,
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    '& > :not(:last-child)': {
                      borderTopWidth: '0px',
                      borderTopStyle: 'solid',
                      borderBottomWidth: '1px',
                      borderBottomStyle: 'solid',
                      borderColor: 'hairline',
                    },
                  }),
                ),
              ),
            ],
            [
              vitalRow(
                t.hud.cash,
                Wallet,
                money(game.cash),
                cashNote,
                short || bridging ? 'danger' : net >= 0 && income > 0 ? 'ok' : 'plain',
                short || bridging ? Message.PanelOpened({ panel: 'dashboard' }) : null,
                h,
                t.hud.cashAndNet,
              ),
              vitalRow(
                t.hud.users,
                Users,
                compact(game.users),
                trend === 0 ? '' : `${trend > 0 ? '▲' : '▼'} ${compact(Math.abs(trend))}`,
                trend >= 0 ? 'ok' : 'danger',
                Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
                h,
                t.hud.whyUsersLeave,
              ),
              vitalRow(
                'Apdex',
                Smile,
                game.apdex.toFixed(2),
                `/ ${target.toFixed(2)}`,
                game.apdex >= target ? 'ok' : 'danger',
                null,
                h,
                t.hud.apdexOverTheLastHourUsers(target.toFixed(2)),
              ),
              shown(model, 'errors')
                ? vitalRow(
                    t.hud.errors,
                    TriangleAlert,
                    `${errors.toFixed(errors >= 10 ? 0 : 1)}%`,
                    '',
                    errors < 1 ? 'ok' : errors < 5 ? 'warn' : 'danger',
                    null,
                    h,
                  )
                : h.empty,
              budgeted(game)
                ? vitalRow(
                    'SLO',
                    ShieldCheck,
                    percent(budgetOf(game).availability),
                    has(game, 'slo-dashboards')
                      ? budgetOf(game).left > 0
                        ? t.hud.left(Math.round(Math.max(0, budgetOf(game).left) * 100))
                        : t.hud.spent
                      : `/ ${Number((budgetOf(game).slo * 100).toFixed(2))}%`,
                    budgetOf(game).left > 0.5 ? 'ok' : budgetOf(game).left > 0 ? 'warn' : 'danger',
                    null,
                    h,
                  )
                : h.empty,
              credit > 0
                ? vitalRow(
                    'SLA',
                    Wallet,
                    `−${t.units.perSecond(money(credit))}`,
                    '',
                    'danger',
                    null,
                    h,
                    t.hud.slaCredits(t.units.perSecond(money(credit)), percent(budgetOf(game).slo)),
                  )
                : h.empty,
              vitalRow(
                percentiles ? 'p99' : t.hud.latency,
                Timer,
                formats(t).ms(percentiles ? ledger.p99 : ledger.latency),
                percentiles ? `μ ${formats(t).ms(ledger.latency)}` : '',
                'plain',
                null,
                h,
              ),
            ],
          ),
          shown(model, 'research') ? insightCard(model, ledger, h) : h.empty,
          game.stage === PRE_IPO_STAGE && !offCompany(model)
            ? checklist(model, ledger, h)
            : h.empty,
          game.quarter && !offCompany(model) ? quarterly(model, ledger, h) : h.empty,
          shown(model, 'team') ? building(model, ledger, h) : h.empty,
        ],
      ),
    ],
    css({ maxWidth: '560px', height: '100%' }),
    h,
  )
}

/** The raise offer, as the phone action bar's primary button, when one is on the table. */
export const phoneOffer = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  if (!canRaise(game) || !next) return h.empty
  return button(
    {
      onClick: Message.PanelOpened({ panel: 'offer' }),
      size: 'lg',
      className: css({
        height: '3rem !important',
        minWidth: '0',
        width: '100%',
        paddingInline: '3',
        _compact: {
          fontSize: 'type.13',
        },
      }),
    },
    [
      icon(
        h,
        Rocket,
        css({
          width: '4',
          height: '4',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }),
          ),
        ],
        [game.stage === PRE_IPO_STAGE ? t.hud.iPO : t.hud.offer(next.name)],
      ),
    ],
    h,
  )
}

export const hud = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const income = has(game, 'stripe') ? ledger.revenue : 0
  const net = income - ledger.burn
  const then = game.history.at(-30)
  const trend = then ? game.users - then.users : 0
  const target = eraOf(game).apdexTarget
  const errors = ledger.errorShare * 100
  const percentiles = has(game, 'percentiles')
  const runway = runwayOf(game, ledger)
  const short = game.cash <= 0
  // The Bridge state is a union, so only an open offer is short of Cash and worth naming here.
  const bridging = game.bridge._tag === 'Offered'
  // The SLA pays its credits on top of Burn: its own HUD row names them beside the runway (11).
  const credit = slaCreditsOf(game, ledger)
  const cashNote = bridging
    ? t.hud.bridgeOffered
    : short
      ? t.hud.outOfCash
      : `${t.units.perSecond(`${net >= 0 ? '+' : ''}${money(net)}`)}${runway === null ? '' : ` · ${t.hud.runwayMonths((runway / RUNWAY_MONTH).toFixed(1))}`}`
  const errorTitle = has(game, 'logs')
    ? Object.entries(ledger.errors)
        .filter(([, value]) => value > 0.005)
        .map(([cause, value]) =>
          t.hud.s2(t.churn.causes[cause as keyof typeof t.churn.causes], rate(value)),
        )
        .join(' · ') || t.hud.noErrors
    : t.hud.researchStructuredLogsToSeeCauses

  const header = h.header(
    [
      h.DataAttribute('morph', 'notice'),
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
            padding: '1.5',
          }),
          PANEL,
          css({
            _compact: {
              pointerEvents: 'auto',
              padding: '1',
            },
          }),
        ),
      ),
    ],
    [
      funding(model, h),
      h.div(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                flexDirection: 'column',
                '& > :not(:last-child)': {
                  borderBottomWidth: '1px',
                  borderBottomStyle: 'solid',
                  borderColor: 'hairline',
                },
              }),
              WELL,
              CHIPS,
            ),
          ),
        ],
        [
          stat(
            t.hud.cash,
            Wallet,
            money(game.cash),
            cashNote,
            game.cash < 0 || bridging ? 'danger' : net >= 0 && income > 0 ? 'ok' : 'plain',
            h,
            bridging ? t.hud.cashShortBridge : t.hud.cashAndNet,
            short || bridging
              ? css({ cursor: 'pointer', borderRadius: 'lg', _hover: { backgroundColor: 'muted' } })
              : '',
            short || bridging ? Message.PanelOpened({ panel: 'dashboard' }) : undefined,
          ),
          stat(
            t.hud.users,
            Users,
            compact(game.users),
            trend === 0 ? '' : `${trend > 0 ? '▲' : '▼'} ${compact(Math.abs(trend))}`,
            trend >= 0 ? 'ok' : 'danger',
            h,
            t.hud.whyUsersLeave,
            css({ cursor: 'pointer', borderRadius: 'lg', _hover: { backgroundColor: 'muted' } }),
            Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
          ),
          stat(
            'Apdex',
            Smile,
            game.apdex.toFixed(2),
            `/ ${target.toFixed(2)}`,
            game.apdex >= target ? 'ok' : 'danger',
            h,
            t.hud.apdexOverTheLastHourUsers(target.toFixed(2)),
          ),
          shown(model, 'errors')
            ? stat(
                t.hud.errors,
                TriangleAlert,
                `${errors.toFixed(errors >= 10 ? 0 : 1)}%`,
                '',
                errors < 1 ? 'ok' : errors < 5 ? 'warn' : 'danger',
                h,
                t.hud.errors2(errorTitle),
                cx(
                  cx(
                    css({
                      borderRadius: 'lg',
                    }),
                    'enter-pop',
                  ),
                  glowing(model, 'errors') && 'cue-glow',
                ),
              )
            : h.empty,
          budgeted(game) ? slo(game, h) : h.empty,
          // The SLA pays 10% of subscriptions back while the week misses: its own row names
          // the money, so the player sees why Cash falls faster than the Burn beside it (11).
          credit > 0
            ? stat(
                'SLA',
                Wallet,
                `−${t.units.perSecond(money(credit))}`,
                '',
                'danger',
                h,
                t.hud.slaCredits(t.units.perSecond(money(credit)), percent(budgetOf(game).slo)),
              )
            : h.empty,
          stat(
            percentiles ? 'p99' : t.hud.latency,
            Timer,
            formats(t).ms(percentiles ? ledger.p99 : ledger.latency),
            percentiles ? `μ ${formats(t).ms(ledger.latency)}` : '',
            'plain',
            h,
          ),
        ],
      ),
      game.stage === PRE_IPO_STAGE && !offCompany(model) ? checklist(model, ledger, h) : h.empty,
      game.quarter && !offCompany(model) ? quarterly(model, ledger, h) : h.empty,
      shown(model, 'team') ? building(model, ledger, h) : h.empty,
    ],
  )
  // On a phone the wrapper dissolves, so both cards stack with the rest of the top.
  return h.div(
    [
      h.Class(
        css({
          position: 'absolute',
          top: '3',
          left: '3',
          zIndex: '20',
          display: 'flex',
          width: 'calc(276px*var(--type-scale))',
          flexDirection: 'column',
          gap: '2',
          _compact: {
            display: 'contents',
          },
        }),
      ),
      h.Style({
        // French, Spanish and Japanese labels need more columns than English does.
        '--hud-label-width':
          model.prefs.locale === 'fr' || model.prefs.locale === 'ja' || model.prefs.locale === 'es'
            ? 'calc(64px*var(--type-scale))'
            : 'calc(46px*var(--type-scale))',
      }),
    ],
    [
      phoneHud(model, h),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              _compact: {
                display: 'none',
              },
            }),
          ),
        ],
        [header, shown(model, 'research') ? insightCard(model, ledger, h) : h.empty],
      ),
    ],
  )
}

/** One line of the IPO checklist or the quarter: a mark, a name and its figure. */
const line = (name: string, value: string, tone: Tone, h: HtmlBuilder<Message>, mark?: boolean) =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          height: '6',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          fontSize: 'type.11-5',
        }),
      ),
    ],
    [
      mark === undefined
        ? h.empty
        : icon(
            h,
            mark ? CircleCheck : Circle,
            cx(
              css({
                width: '3.5',
                height: '3.5',
                flexShrink: '0',
              }),
              mark
                ? css({
                    color: 'ok',
                  })
                : css({
                    color: 'mutedForeground',
                  }),
            ),
          ),
      h.span(
        [
          h.Class(
            css({
              color: 'mutedForeground',
            }),
          ),
        ],
        [name],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                marginLeft: 'auto',
                fontSize: 'type.10-5',
                whiteSpace: 'nowrap',
              }),
              toneText(tone),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

type ChecklistItem = ReturnType<typeof checklistOf>[number]

const checklistLabel = (t: Messages, id: ChecklistItem['id']): string =>
  id === 'users'
    ? t.hud.checkUsers
    : id === 'reliability'
      ? t.hud.checkReliability
      : id === 'soc2'
        ? t.hud.checkSoc2
        : id === 'drill'
          ? t.hud.checkDrill
          : id === 'residency'
            ? t.hud.checkResidency
            : t.hud.checkRule40

/** What an item's figure says: the Simulation's English words told again from the same state. */
const checklistValue = (t: Messages, game: Board['game'], item: ChecklistItem): string => {
  const drill = game.drill
  if (item.id === 'soc2')
    return has(game, 'soc2')
      ? securityStaffed(game)
        ? t.hud.checkDone
        : t.hud.checkSecurityTeam
      : t.hud.checkSoc2
  if (item.id === 'residency') return residencyMet(game) ? t.hud.checkEu : t.hud.checkNotYet
  if (item.id !== 'drill') return item.value
  if (!drill) return t.hud.checkNotRun
  if (drill._tag === 'Running') return t.hud.checkRunning
  if (drillPassed(drill)) return t.hud.checkRto(Math.round(drillRto(drill) ?? 0))
  if (brokenRestore(game)) return t.hud.checkRestoreFailed
  if (drill._tag === 'Failed') return t.hud.checkNotRecovered
  return drill.rpo >= DRILL_RPO
    ? t.hud.checkDataLost
    : t.hud.checkRto(Math.round(drillRto(drill) ?? 0))
}

/** The IPO checklist (10 "Era 6"): every item at once opens the IPO. */
const checklist = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const items = checklistOf(game, ledger)
  const drillReady = has(game, 'dr-drills') && !game.incident && !(game.drill?._tag === 'Running')
  return h.div(
    [
      h.Key('ipo'),
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            paddingBlock: '1',
          }),
          WELL,
          css({
            _compact: {
              display: 'none',
            },
          }),
        ),
      ),
    ],
    [
      ...items.map((item) =>
        line(
          checklistLabel(t, item.id),
          checklistValue(t, game, item),
          item.met ? 'ok' : 'plain',
          h,
          item.met,
        ),
      ),
      has(game, 'dr-drills')
        ? h.div(
            [
              h.Class(
                css({
                  paddingInline: '1.5',
                  paddingTop: '1',
                }),
              ),
            ],
            [
              button(
                {
                  onClick: Message.DrillRun(),
                  variant: 'outline',
                  size: 'sm',
                  className: css({
                    width: '100%',
                  }),
                  attributes: [h.Disabled(!drillReady)],
                },
                [
                  icon(
                    h,
                    DatabaseZap,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                  t.hud.runDRDrill,
                ],
                h,
              ),
            ],
          )
        : h.empty,
    ],
  )
}

const levelsOf = (t: Messages) => [t.hud.low, t.hud.mid, t.hud.high] as const

/** A guidance picker: three levels, open on a quarter's first day. */
const guidance = (
  label: string,
  values: ReadonlyArray<number>,
  chosen: number,
  pick: (level: number) => Message,
  open: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Key(label),
      h.Class(
        css({
          display: 'flex',
          height: '7',
          alignItems: 'center',
          gap: '1',
          paddingInline: '2.5',
          fontSize: 'type.11-5',
        }),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              marginRight: 'auto',
              color: 'mutedForeground',
            }),
          ),
        ],
        [label],
      ),
      ...values.map((value, level) =>
        h.button(
          [
            h.Type('button'),
            h.Title(t.hud.levelTitle(levelsOf(t)[level] ?? '', value)),
            h.Disabled(!open && level !== chosen),
            h.AriaPressed(level === chosen ? 'true' : 'false'),
            h.OnClick(pick(level)),
            h.Class(
              cx(
                FIGURE,
                css({
                  height: '6',
                  minWidth: '9',
                  borderRadius: 'md',
                  paddingInline: '1.5',
                  fontSize: 'type.10-5',
                  _disabled: {
                    opacity: 0.35,
                  },
                }),
                level === chosen
                  ? css({
                      backgroundColor: 'foreground',
                      color: 'background',
                    })
                  : css({
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      },
                    }),
              ),
            ),
          ],
          [`${value}%`],
        ),
      ),
    ],
  )
}

/** The Public quarter (10 "Era 7"): days left, guidance, and the market's verdict. */
const quarterly = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const quarter = game.quarter
  if (!quarter) return h.empty
  const day = Math.min(7, Math.floor((game.time - quarter.startedAt) / 1_440) + 1)
  const value = valuationOf(game, ledger)
  const open = guidanceOpen(game)
  const growth = quarterGrowth(quarter, ledger)
  return h.div(
    [
      h.Key('quarter'),
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            paddingBlock: '1',
          }),
          WELL,
          css({
            _compact: {
              display: 'none',
            },
          }),
        ),
      ),
    ],
    [
      line(t.hud.quarter(quarter.index), t.hud.dayOf7(day), 'plain', h),
      guidance(
        t.hud.growth,
        GUIDANCE_GROWTH,
        quarter.growth,
        (level) => Message.GuidanceChosen({ growth: level, margin: quarter.margin }),
        open,
        h,
      ),
      guidance(
        t.hud.margin,
        GUIDANCE_MARGIN,
        quarter.margin,
        (level) => Message.GuidanceChosen({ growth: quarter.growth, margin: level }),
        open,
        h,
      ),
      line(
        t.hud.soFar,
        `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% · ${marginOf(ledger).toFixed(0)}%`,
        growth >= (GUIDANCE_GROWTH[quarter.growth] ?? 0) &&
          marginOf(ledger) >= (GUIDANCE_MARGIN[quarter.margin] ?? 0)
          ? 'ok'
          : 'warn',
        h,
      ),
      line(
        t.hud.valuation,
        `${money(value.valuation)} · ×${value.multiple.toFixed(1)}`,
        'plain',
        h,
      ),
      quarter.last
        ? line(
            t.hud.q(quarter.index - 1),
            quarter.last.beat ? t.hud.beatStreak(quarter.streak) : t.hud.missed,
            quarter.last.beat ? 'ok' : 'danger',
            h,
          )
        : h.empty,
    ],
  )
}

const toolButton = (
  label: string,
  glyph: IconNode,
  message: Message,
  active: boolean,
  h: HtmlBuilder<Message>,
  extra: Html = h.empty,
  cue = false,
): Html =>
  h.button(
    [
      h.Key(label),
      h.Type('button'),
      h.Title(label),
      h.AriaLabel(label),
      h.AriaPressed(active ? 'true' : 'false'),
      h.OnClick(message),
      h.Class(
        cx(
          tool(active),
          cx(
            css({
              _compact: {
                width: '9',
                height: '9',
              },
            }),
            'enter-pop',
          ),
          cue && 'cue-glow',
        ),
      ),
    ],
    [
      icon(
        h,
        glyph,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      extra,
    ],
  )

/** Undo or redo: dimmed when its stack is empty. */
const historyButton = (
  label: string,
  glyph: IconNode,
  message: Message,
  ready: boolean,
  h: HtmlBuilder<Message>,
  cue = false,
): Html =>
  h.button(
    [
      h.Key(label),
      h.Type('button'),
      h.Title(label),
      h.AriaLabel(label),
      h.Disabled(!ready),
      h.OnClick(message),
      h.Class(
        cx(
          tool(false),
          cx(
            css({
              _compact: {
                width: '9',
                height: '9',
              },
              _disabled: {
                opacity: 0.35,
                pointerEvents: 'none',
              },
            }),
            'enter-pop',
          ),
          cue && 'cue-glow',
        ),
      ),
    ],
    [
      icon(
        h,
        glyph,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
    ],
  )

/** Controls a phone reaches through More instead. */
const desktopOnly = (children: ReadonlyArray<Html>, h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'contents',
          _compact: {
            display: 'none',
          },
        }),
      ),
    ],
    children,
  )

const divider = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        css({
          marginInline: '0.5',
          height: '6',
          width: '1px',
          backgroundColor: 'hairline',
          _compact: {
            display: 'none',
          },
        }),
      ),
    ],
    [],
  )

/** The Exit button, shown while an Exit is on the table; its badge is the best Legacy. */
const exitButton = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const legacy = exitLegacy(model)
  if (legacy === null) return h.empty
  return h.button(
    [
      h.Key('exit'),
      h.Type('button'),
      h.Title(t.hud.exitUpToLegacy(legacy)),
      h.AriaLabel(t.hud.exit),
      h.AriaPressed(model.panel === 'exit' ? 'true' : 'false'),
      h.OnClick(Message.PanelOpened({ panel: model.panel === 'exit' ? 'none' : 'exit' })),
      h.Class(
        cx(
          tool(model.panel === 'exit'),
          cx(
            css({
              display: 'flex',
              width: 'auto',
              gap: '2',
              paddingInline: '3',
              fontSize: 'type.13',
              fontWeight: 'medium',
              _compact: {
                width: '9',
                height: '9',
                paddingInline: '0',
              },
              '@media (max-width: 1535px)': {
                width: '9',
                paddingInline: '0',
                justifyContent: 'center',
              },
            }),
            'enter-pop',
          ),
        ),
      ),
    ],
    [
      icon(
        h,
        DoorOpen,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              _compact: {
                display: 'none',
              },
              '@media (max-width: 1535px)': {
                display: 'none',
              },
            }),
          ),
        ],
        [t.hud.exit],
      ),
      legacy > 0
        ? h.span(
            [
              h.Key('badge'),
              h.Class(
                cx(
                  FIGURE,
                  cx(
                    css({
                      position: 'absolute',
                      top: '-0.25rem',
                      right: '-0.25rem',
                      display: 'grid',
                      height: '4',
                      minWidth: '4',
                      placeItems: 'center',
                      borderRadius: 'full',
                      backgroundColor: 'ok',
                      paddingInline: '1',
                      fontSize: 'type.9-5',
                      lineHeight: 'none',
                      fontWeight: 'semibold',
                      color: 'white',
                      boxShadow: 'raised',
                    }),
                    'enter-badge',
                  ),
                ),
              ),
            ],
            [String(legacy)],
          )
        : h.empty,
    ],
  )
}

const moreOf = (t: Messages): Record<MoreItem, Readonly<{ label: string; glyph: IconNode }>> => ({
  exit: { label: t.hud.exit, glyph: DoorOpen },
  playbooks: { label: t.hud.playbooks, glyph: BookCopy },
  dashboard: { label: t.hud.dashboard, glyph: ChartLine },
  help: { label: t.hud.howToPlay, glyph: CircleHelp },
  undo: { label: t.hud.undo, glyph: Undo2 },
  redo: { label: t.hud.redo, glyph: Redo2 },
  tidy: { label: t.hud.tidyByRole, glyph: LayoutGrid },
  fit: { label: t.hud.fitTheBoard, glyph: Scan },
  fullscreen: { label: t.hud.fullscreen, glyph: Expand },
  screenshot: { label: t.hud.screenshot, glyph: Camera },
})

const moreItems = (model: Model): ReadonlyArray<MoreItem> => [
  ...(exitLegacy(model) === null ? [] : (['exit'] as const)),
  ...(playbooksShown(model) ? (['playbooks'] as const) : []),
  ...(has(model.board.game, 'metrics') ? (['dashboard'] as const) : []),
  'help',
  ...(shown(model, 'undo') ? (['undo', 'redo'] as const) : []),
  'tidy',
  'fit',
  'fullscreen',
  'screenshot',
]

const moreButton = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const legacy = exitLegacy(model)
  // A dot when something inside asks for attention: Legacy on offer, or a cue on a hidden control.
  const calling = (legacy ?? 0) > 0 || glowing(model, 'undo')
  return h.submodel({
    slotId: 'more-menu',
    model: model.moreMenu,
    view: moreMenu.view,
    toParentMessage: (message) => Message.MoreMenuChanged({ message }),
    viewInputs: {
      items: moreItems(model),
      className: css({
        display: 'none',
        _compact: {
          display: 'block',
        },
      }),
      ariaLabel: t.hud.more,
      buttonClassName: cx(
        tool(model.moreMenu.isOpen),
        css({
          position: 'relative',
          width: '11',
          height: '11',
        }),
      ),
      buttonContent: h.span(
        [
          h.Class(
            css({
              display: 'contents',
            }),
          ),
        ],
        [
          icon(
            h,
            Ellipsis,
            css({
              width: '18px',
              height: '18px',
            }),
          ),
          calling
            ? h.span(
                [
                  h.Class(
                    cx(
                      css({
                        position: 'absolute',
                        top: '-0.125rem',
                        right: '-0.125rem',
                        width: '2.5',
                        height: '2.5',
                        borderRadius: 'full',
                        backgroundColor: 'ok',
                        boxShadow: 'raised',
                      }),
                      'enter-badge',
                    ),
                  ),
                ],
                [],
              )
            : h.empty,
        ],
      ),
      anchor: { placement: 'bottom-end', gap: 6, padding: 8 },
      backdropClassName: css({ position: 'fixed', inset: '0', zIndex: '40' }),
      itemsClassName: cx(
        css({ zIndex: '50', minWidth: '48', padding: '1', outlineStyle: 'none' }),
        FLOAT,
      ),
      isItemDisabled: (item) =>
        (item === 'undo' && !undoAvailable(model.board)) ||
        (item === 'redo' && !redoAvailable(model.board)),
      itemToConfig: (item, { isActive, isDisabled }) => ({
        className: cx(
          css({
            display: 'flex',
            height: '10',
            cursor: 'pointer',
            alignItems: 'center',
            gap: '2.5',
            borderRadius: 'xl',
            paddingInline: '2.5',
            fontSize: 'type.13',
            outlineStyle: 'none',
          }),
          isActive &&
            css({
              backgroundColor: 'well',
            }),
          isDisabled &&
            css({
              opacity: 0.35,
            }),
          item === 'fullscreen' &&
            css({
              _narrow: {
                display: 'none',
              },
            }),
        ),
        content: h.span(
          [
            h.Class(
              css({
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: '2.5',
              }),
            ),
          ],
          [
            icon(
              h,
              moreOf(t)[item].glyph,
              css({
                width: '18px',
                height: '18px',
                color: 'mutedForeground',
              }),
            ),
            h.span(
              [
                h.Class(
                  css({
                    flex: '1 1 0%',
                  }),
                ),
              ],
              [moreOf(t)[item].label],
            ),
            item === 'exit' && (legacy ?? 0) > 0
              ? h.span(
                  [
                    h.Class(
                      cx(
                        FIGURE,
                        css({
                          fontSize: 'type.11-5',
                          color: 'ok',
                        }),
                      ),
                    ),
                  ],
                  [t.hud.legacy(legacy)],
                )
              : h.empty,
          ],
        ),
      }),
    },
  })
}

export const toolbar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const affordable =
    game.studies.length > 0
      ? 0
      : researchList.filter((entry) => !has(game, entry.id) && researchReady(game, entry.id)).length
  return h.nav(
    [
      h.Class(
        cx(
          css({
            pointerEvents: 'auto',
            position: 'relative',
            zIndex: '20',
            display: 'flex',
            flexShrink: '0',
            alignItems: 'center',
            gap: '1',
            padding: '1.5',
            _compact: {
              position: 'absolute',
              top: 'calc(max(8px, env(safe-area-inset-top)) + 10px)',
              right: 'calc(max(8px, env(safe-area-inset-right)) + 10px)',
              gap: '3',
              backgroundImage: 'none',
              padding: '0',
              boxShadow: 'none',
            },
          }),
          PANEL,
        ),
      ),
    ],
    [
      desktopOnly([exitButton(model, h)], h),
      offCompany(model) || !shown(model, 'research')
        ? h.empty
        : h.button(
            [
              h.Key('research'),
              h.Type('button'),
              h.Title(t.hud.researchR2),
              h.AriaLabel(t.hud.research),
              h.AriaPressed(model.panel === 'research' ? 'true' : 'false'),
              h.OnClick(
                Message.PanelOpened({ panel: model.panel === 'research' ? 'none' : 'research' }),
              ),
              h.Class(
                cx(
                  tool(model.panel === 'research'),
                  'enter-pop',
                  glowing(model, 'research') && 'cue-glow',
                  css({
                    display: 'flex',
                    width: 'auto',
                    gap: '2',
                    paddingInline: '3',
                    fontSize: 'type.13',
                    fontWeight: 'medium',
                    _compact: {
                      width: '11',
                      height: '11',
                      paddingInline: '0',
                    },
                    '@media (max-width: 1535px)': {
                      width: '9',
                      paddingInline: '0',
                      justifyContent: 'center',
                    },
                  }),
                ),
              ),
            ],
            [
              icon(
                h,
                FlaskConical,
                css({
                  width: '18px',
                  height: '18px',
                }),
              ),
              h.span(
                [
                  h.Class(
                    css({
                      _compact: {
                        display: 'none',
                      },
                      '@media (max-width: 1535px)': {
                        display: 'none',
                      },
                    }),
                  ),
                ],
                [t.hud.research],
              ),
              affordable > 0
                ? h.span(
                    [
                      h.Key('badge'),
                      h.DataAttribute('exit', 'notice'),
                      h.Class(
                        cx(
                          FIGURE,
                          cx(
                            css({
                              position: 'absolute',
                              top: '-0.25rem',
                              right: '-0.25rem',
                              display: 'grid',
                              height: '4',
                              minWidth: '4',
                              placeItems: 'center',
                              borderRadius: 'full',
                              backgroundColor: 'ok',
                              paddingInline: '1',
                              fontSize: 'type.9-5',
                              lineHeight: 'none',
                              fontWeight: 'semibold',
                              color: 'white',
                              boxShadow: 'raised',
                            }),
                            'enter-badge',
                          ),
                        ),
                      ),
                    ],
                    [String(affordable)],
                  )
                : h.empty,
            ],
          ),
      offCompany(model) || !shown(model, 'team')
        ? h.empty
        : h.button(
            [
              h.Key('team'),
              h.Type('button'),
              h.Title(t.hud.teamT),
              h.AriaLabel(t.hud.team),
              h.AriaPressed(model.panel === 'team' ? 'true' : 'false'),
              h.OnClick(Message.PanelOpened({ panel: model.panel === 'team' ? 'none' : 'team' })),
              h.Class(
                cx(
                  tool(model.panel === 'team'),
                  'enter-pop',
                  glowing(model, 'team') && 'cue-glow',
                  css({
                    display: 'flex',
                    width: 'auto',
                    gap: '2',
                    paddingInline: '3',
                    fontSize: 'type.13',
                    fontWeight: 'medium',
                    _compact: {
                      width: '11',
                      height: '11',
                      paddingInline: '0',
                    },
                    '@media (max-width: 1535px)': {
                      width: '9',
                      paddingInline: '0',
                      justifyContent: 'center',
                    },
                  }),
                ),
              ),
            ],
            [
              icon(
                h,
                UsersRound,
                css({
                  width: '18px',
                  height: '18px',
                }),
              ),
              h.span(
                [
                  h.Class(
                    css({
                      _compact: {
                        display: 'none',
                      },
                      '@media (max-width: 1535px)': {
                        display: 'none',
                      },
                    }),
                  ),
                ],
                [t.hud.team],
              ),
              game.backlog.length === 0
                ? h.span(
                    [
                      h.Class(
                        cx(
                          css({
                            position: 'absolute',
                            top: '-0.125rem',
                            right: '-0.125rem',
                            width: '2.5',
                            height: '2.5',
                            borderRadius: 'full',
                            backgroundColor: 'warn',
                            boxShadow: 'raised',
                          }),
                          'enter-badge',
                        ),
                      ),
                    ],
                    [],
                  )
                : h.empty,
            ],
          ),
      desktopOnly(
        [
          !playbooksShown(model)
            ? h.empty
            : toolButton(
                t.hud.playbooksP,
                BookCopy,
                Message.PanelOpened({ panel: model.panel === 'playbooks' ? 'none' : 'playbooks' }),
                model.panel === 'playbooks',
                h,
              ),
          has(model.board.game, 'metrics')
            ? toolButton(
                t.hud.dashboardD,
                ChartLine,
                Message.PanelOpened({ panel: model.panel === 'dashboard' ? 'none' : 'dashboard' }),
                model.panel === 'dashboard',
                h,
              )
            : h.empty,
          toolButton(
            t.hud.howToPlayH,
            CircleHelp,
            Message.PanelOpened({ panel: model.panel === 'help' ? 'none' : 'help' }),
            model.panel === 'help',
            h,
          ),
          ...(shown(model, 'undo')
            ? [
                divider(h),
                historyButton(
                  t.hud.undoZ,
                  Undo2,
                  Message.UndoChosen(),
                  undoAvailable(model.board),
                  h,
                  glowing(model, 'undo'),
                ),
                historyButton(
                  t.hud.redoShiftZ,
                  Redo2,
                  Message.RedoChosen(),
                  redoAvailable(model.board),
                  h,
                ),
              ]
            : []),
        ],
        h,
      ),
      shown(model, 'glossary')
        ? h.a(
            [
              h.Key('glossary'),
              h.Href(`${WIKI_URL}/glossary`),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.Title(t.hud.glossary),
              h.AriaLabel(t.hud.glossary),
              h.Class(
                cx(
                  tool(false),
                  cx(
                    css({
                      _compact: {
                        width: '9',
                        height: '9',
                      },
                    }),
                    'enter-pop',
                  ),
                  glowing(model, 'glossary') && 'cue-glow',
                ),
              ),
            ],
            [
              icon(
                h,
                BookOpen,
                css({
                  width: '18px',
                  height: '18px',
                }),
              ),
            ],
          )
        : h.empty,
      ...(model.prefs.easyMode
        ? [
            divider(h),
            toolButton(
              clockPaused(model) ? t.hud.resumeSpace : t.hud.pauseSpace,
              clockPaused(model) ? Play : Pause,
              Message.PauseToggled(),
              clockPaused(model),
              h,
            ),
            h.button(
              [
                h.Key('speed'),
                h.Type('button'),
                h.Title(t.hud.speedS),
                h.AriaLabel(t.hud.speedS),
                h.OnClick(Message.SpeedCycled()),
                h.Class(
                  cx(
                    tool(model.board.clock.speed > 1),
                    FIGURE,
                    css({
                      fontSize: 'type.12-5',
                      fontWeight: 'medium',
                      _compact: {
                        width: '9',
                        height: '9',
                      },
                    }),
                  ),
                ),
              ],
              [`${model.board.clock.speed}×`],
            ),
          ]
        : []),
      desktopOnly(
        [
          divider(h),
          toolButton(t.hud.tidyByRoleShiftT, LayoutGrid, Message.BoardTidied(), false, h),
          toolButton(t.hud.fitTheBoardShiftF, Scan, Message.BoardFitted(), false, h),
          toolButton(t.hud.fullscreenF, Expand, Message.FullscreenToggled(), false, h),
          toolButton(t.hud.screenshotS, Camera, Message.ScreenshotToggled(), false, h),
        ],
        h,
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'none',
              _compact: {
                display: 'block',
              },
            }),
          ),
        ],
        [toolButton(t.hud.fitTheBoardShiftF, Scan, Message.BoardFitted(), false, h)],
      ),
      moreButton(model, h),
    ],
  )
}

/** A quiet way out of screenshot mode: it sits in the corner and steps aside on hover. */
export const screenshotExit = (h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.button(
    [
      h.Key('screenshot-exit'),
      h.Type('button'),
      h.Title(t.hud.exitScreenshot),
      h.AriaLabel(t.hud.exitScreenshot),
      h.OnClick(Message.ScreenshotToggled()),
      h.Class(
        css({
          pointerEvents: 'auto',
          position: 'absolute',
          top: '3',
          right: '3',
          zIndex: '40',
          display: 'grid',
          width: '8',
          height: '8',
          placeItems: 'center',
          borderRadius: 'full',
          backgroundColor: 'color-mix(in oklab, var(--card) 40%, transparent)',
          color: 'mutedForeground',
          opacity: 0.3,
          boxShadow: 'card',
          backdropFilter: 'blur(8px)',
          transitionProperty: 'opacity',
          transitionDuration: 'fast',
          transitionTimingFunction: 'out',
          _hover: {
            opacity: 1,
          },
          _focusVisible: {
            opacity: 1,
          },
        }),
      ),
    ],
    [
      icon(
        h,
        CameraOff,
        css({
          width: '4',
          height: '4',
        }),
      ),
    ],
  )
}

const pill = css({
  display: 'flex',
  maxWidth: '480px',
  alignItems: 'center',
  gap: '2.5',
  borderRadius: 'xl',
  layerStyle: 'surface',
  paddingInline: '3',
  paddingBlock: '2',
  fontSize: 'type.12-5',
  boxShadow: 'card',
  _compact: { maxWidth: 'none' },
})

/** Settling while the Design settles, then what the change did, with Undo. */
const undoButton = (danger: boolean, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return button(
    {
      onClick: Message.UndoChosen(),
      variant: danger ? 'destructive' : 'outline',
      size: 'icon-sm',
      className: cx(
        css({
          pointerEvents: 'auto',
          marginLeft: '1',
        }),
        'enter-badge',
      ),
      attributes: [
        h.Key('undo'),
        h.DataAttribute('exit', 'notice'),
        h.Title(t.hud.undoZ),
        h.AriaLabel(t.hud.undo),
      ],
    },
    icon(
      h,
      Undo2,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
    h,
  )
}

const signed = (value: number, digits: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`

/** What a change did, in words: "+$1.40/s (+18%) · p99 −120 ms · errors −2.1%". */
export const deltaText = (t: Messages, delta: Delta, percentiles: boolean): string => {
  const revenue = delta.after.revenue - delta.before.revenue
  const share = delta.before.revenue > 0 ? (revenue / delta.before.revenue) * 100 : 0
  const latency = percentiles
    ? t.hud.deltaP99(t.units.ms(signed(delta.after.p99 - delta.before.p99, 0)))
    : t.hud.deltaLatency(t.units.ms(signed(delta.after.latency - delta.before.latency, 0)))
  const errors = (delta.after.errors - delta.before.errors) * 100
  return [
    `${t.units.perSecond(`${revenue >= 0 ? '+' : '−'}$${Math.abs(revenue).toFixed(2)}`)} (${signed(share, 0)}%)`,
    latency,
    Math.abs(errors) >= 0.05 ? t.hud.deltaErrors(`${signed(errors, 1)}%`) : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

/** One pill from the first change to the delta: Settling morphs into the result,
 *  and the pill leaves when the delta expires. */
export const changeBar = (model: Model, h: HtmlBuilder<Message>, className: string): Html => {
  const t = copy(h)

  const undo = undoAvailable(model.board)
  const change = model.board.change
  if (change._tag === 'Idle') return h.empty
  const delta = change._tag === 'Settled' || change._tag === 'Lasting' ? change.delta : null
  const body =
    change._tag === 'Settling'
      ? h.span(
          [
            h.Key('settling'),
            h.DataAttribute('exit', 'notice'),
            h.Class(
              cx(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5',
                  whiteSpace: 'nowrap',
                }),
                'swap',
              ),
            ),
          ],
          [
            ring(
              settleProgress(model.board),
              css({
                width: '3.5',
                height: '3.5',
                flexShrink: '0',
                color: 'mutedForeground',
              }),
              h,
            ),
            h.span(
              [
                h.Class(
                  css({
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [change.change.count > 1 ? t.hud.changes(change.change.count) : change.change.label],
            ),
          ],
        )
      : h.span(
          [
            h.Key(`delta-${delta?.id}`),
            h.DataAttribute('exit', 'notice'),
            h.Class(
              cx(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2.5',
                  whiteSpace: 'nowrap',
                }),
                'swap',
              ),
            ),
          ],
          [
            h.span(
              [
                h.Class(
                  cx(
                    css({
                      width: '2',
                      height: '2',
                      flexShrink: '0',
                      borderRadius: 'full',
                    }),
                    delta?.worse
                      ? css({ backgroundColor: 'danger' })
                      : css({ backgroundColor: 'ok' }),
                  ),
                ),
              ],
              [],
            ),
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.11-5',
                    }),
                  ),
                ),
              ],
              [delta ? deltaText(t, delta, has(model.board.game, 'percentiles')) : ''],
            ),
            change._tag === 'Settled' && change.ticks > 0
              ? h.span(
                  [
                    h.Key('stable'),
                    h.Class(
                      cx(
                        css({
                          fontSize: 'type.11-5',
                          fontWeight: 'medium',
                          color: 'ok',
                        }),
                        'enter-badge',
                      ),
                    ),
                  ],
                  [t.hud.stable],
                )
              : h.empty,
          ],
        )
  return h.div(
    [
      h.Key('change'),
      h.DataAttribute('morph', 'notice'),
      h.DataAttribute('exit', 'notice'),
      h.Class(cx(pill, className)),
    ],
    [body, undo ? undoButton(false, h) : h.empty],
  )
}

/**
 * One tab per region from Series C (05 "Zones and regions"). Open regions are
 * tabs; with Multiple regions, each closed one offers to open, at its price.
 */
export const regionTabs = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const open = openRegions(game)
  if (open.length < 2 && !(has(game, 'multi-region') && regional(game))) return h.empty
  return h.nav(
    [
      h.Key('regions'),
      h.AriaLabel(t.hud.regions),
      h.Class(
        css({
          pointerEvents: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5',
          borderRadius: 'xl',
          layerStyle: 'surface',
          padding: '1',
          boxShadow: 'card',
        }),
      ),
    ],
    REGIONS.map((region) => {
      const isOpen = open.includes(region)
      const info = localized(REGION_INFO[region], t.catalog.regionInfo[region])
      return h.button(
        [
          h.Key(region),
          h.Type('button'),
          h.Title(
            isOpen
              ? info.name
              : t.hud.open(
                  info.name,
                  money(game.sandbox ? 0 : OPEN_REGION_PRICE * eraOf(game).costIndex),
                ),
          ),
          h.AriaPressed(model.board.region === region ? 'true' : 'false'),
          h.OnClick(isOpen ? Message.RegionPicked({ region }) : Message.RegionOpened({ region })),
          h.Class(
            cx(
              FIGURE,
              css({
                height: '7',
                borderRadius: 'lg',
                paddingInline: '2.5',
                fontSize: 'type.11-5',
                fontWeight: 'medium',
              }),
              model.board.region === region
                ? css({
                    backgroundColor: 'foreground',
                    color: 'background',
                  })
                : isOpen
                  ? css({
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      },
                    })
                  : css({
                      color: 'mutedForeground',
                      opacity: 0.6,
                      _hover: {
                        opacity: 1,
                      },
                    }),
            ),
          ),
        ],
        [
          isOpen ? info.short : `+ ${info.short}`,
          tabDrift(game, region) > 0
            ? h.span(
                [
                  h.Key('drift'),
                  h.Class(
                    css({
                      marginLeft: '1',
                      display: 'inline-block',
                      width: '1.5',
                      height: '1.5',
                      borderRadius: 'full',
                      backgroundColor: 'warn',
                      verticalAlign: 'middle',
                    }),
                  ),
                ],
                [],
              )
            : h.empty,
        ],
      )
    }).concat(
      has(game, 'infra-as-code')
        ? [
            h.button(
              [
                h.Key('mirror'),
                h.Type('button'),
                h.AriaPressed(model.panel === 'mirror' ? 'true' : 'false'),
                h.OnClick(
                  Message.PanelOpened({ panel: model.panel === 'mirror' ? 'none' : 'mirror' }),
                ),
                h.Class(
                  cx(
                    css({
                      marginLeft: '0.5',
                      height: '7',
                      borderRadius: 'lg',
                      paddingInline: '2.5',
                      fontSize: 'type.11-5',
                      fontWeight: 'medium',
                      boxShadow: 'dividerStart',
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      },
                    }),
                    model.panel === 'mirror' &&
                      css({
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      }),
                  ),
                ),
              ],
              [t.hud.mirror],
            ),
          ]
        : [],
    ),
  )
}
