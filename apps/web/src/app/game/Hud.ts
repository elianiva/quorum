import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option } from 'effect'
import {
  BookCopy,
  BookOpen,
  Camera,
  CameraOff,
  ChartLine,
  Circle,
  CircleCheck,
  CircleHelp,
  DatabaseZap,
  DoorOpen,
  Ellipsis,
  Expand,
  FlaskConical,
  Hammer,
  LayoutGrid,
  Menu,
  Pause,
  Play,
  Redo2,
  Rocket,
  Scan,
  ShieldCheck,
  Smile,
  Timer,
  TriangleAlert,
  Undo2,
  Users,
  UsersRound,
  Wallet,
  X,
  type IconNode,
} from 'lucide'
import {
  DRILL_RPO,
  FAILURE_YIELD,
  OPEN_REGION_PRICE,
  REGIONS,
  REGION_INFO,
  researchList,
  type ComponentId,
  type FeatureId,
  type IncidentId,
  type InsightPool,
  type RegionId,
  type RequestKind,
  type ResearchId,
  type TaskId,
} from '@quorum/simulation/catalog'
import { canRaise } from '@quorum/simulation/actions'
import { overdueBy } from '@quorum/simulation/cve'
import { drillPassed, drillRto } from '@quorum/simulation/drill-machine'
import { awaitingFeatures } from '@quorum/simulation/features'
import { PRE_IPO_STAGE, brokenRestore, checklistOf, residencyMet } from '@quorum/simulation/ipo'
import type { Ledger } from '@quorum/simulation/ledger'
import { eraOf, has, nextEra, researchReady, securityStaffed } from '@quorum/simulation/lookups'
import { driftOf, mirrorOf } from '@quorum/simulation/mirror'
import {
  GUIDANCE_GROWTH_PERCENT,
  GUIDANCE_MARGIN_PERCENT,
  guidanceOpen,
  quarterGrowth,
} from '@quorum/simulation/quarters'
import { openRegions, regional } from '@quorum/simulation/regions'
import { RUNWAY_MONTH, runwayOf } from '@quorum/simulation/runway'
import { budgetOf, budgeted, slaCreditsOf } from '@quorum/simulation/slo'
import { clockOf } from '@quorum/simulation/solve'
import { activeIncident, QuarterState, type WorkItem } from '@quorum/simulation/state'
import {
  limitingPool,
  progressOf as studyProgressOf,
  recipeOf as simRecipe,
  studySpeed,
  studyStall,
} from '@quorum/simulation/studies'
import { currentStudy, studyCount } from '@quorum/simulation/study-machine'
import { devHoursRate } from '@quorum/simulation/team'
import { marginOf, valuationOf } from '@quorum/simulation/valuation'
import { formats, stallReasonIn } from '@/i18n/format.ts'
import { copy, eraWords, localized, type Messages } from '@/i18n/messages.ts'
import {
  clockPaused,
  easyMode,
  exitLegacy,
  offCompany,
  type Board,
  type Delta,
  type Model,
} from '@/game/model.ts'
import { redoAvailable, settleProgress, undoAvailable } from '@/game/feedback.ts'
import { Message } from '@/game/message.ts'
import { type MoreItem } from '@/game/more.ts'
import { speedFactorOf } from '@/game/research.ts'
import { glowing, playbooksShown, shown } from '@/game/reveal.ts'
import { WIKI_URL } from '@/platform/analytics.ts'
import { clock as mmss, compact, money, rate } from '@quorum/ui/game/format'
import { POOL_ICONS, POOL_ORDER, poolColor } from '@quorum/ui/game/pools'
import {
  CHIPS,
  EYEBROW,
  FIGURE,
  FLOAT,
  PANEL,
  SCROLL,
  WELL,
  tool,
  toneText,
  type Tone,
} from '@quorum/ui/game/bits'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

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
  label: Label | ReadonlyArray<Label>,
): Content => {
  const root = config.key === undefined ? h.button : h.button.key(config.key)
  const base = root
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

const meter = (h: H<Message>, share: number, fill: string): Content =>
  h.div
    .class(
      css({
        height: '1.5',
        overflow: 'hidden',
        borderRadius: 'full',
        backgroundColor: 'well',
        boxShadow: 'well',
      }),
    )
    .children(
      h.div
        .class(
          cx(
            css({
              height: '100%',
              width: '100%',
              borderRadius: 'full',
              transitionProperty: 'transform',
              transitionDuration: 'slow',
              transitionTimingFunction: 'linear',
            }),
            fill,
          ),
        )
        .style({
          transform: `translateX(${(Math.max(0, Math.min(1, share)) - 1) * 100}%)`,
        })
        .children(),
    )

const ring = (h: H<Message>, share: number, className: string): Content => {
  const radius = 6
  const length = 2 * Math.PI * radius
  return h.svg
    .attr('aria-hidden', 'true')
    .class(className)
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', '0 0 16 16')
    .attr('fill', 'none')
    .children(
      h.circle
        .attr('cx', '8')
        .attr('cy', '8')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2')
        .attr('opacity', '0.2')
        .children(),
      h.circle
        .attr('cx', '8')
        .attr('cy', '8')
        .attr('r', String(radius))
        .attr('stroke', 'currentColor')
        .attr('stroke-width', '2')
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', `${length}`)
        .attr('stroke-dashoffset', `${length * (1 - Math.max(0, Math.min(1, share)))}`)
        .attr('transform', 'rotate(-90 8 8)')
        .class(
          css({
            transitionProperty: 'stroke-dashoffset',
            transitionDuration: 'normal',
            transitionTimingFunction: 'out',
          }),
        )
        .children(),
    )
}

/* The panel focus trap the Foldkit shell ran, as an Effect UI mount. */
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
              h.button
                .attr('type', 'button')
                .attr('tabindex', '0')
                .class(buttonClass('ghost', 'icon', SHELL_CLOSE))
                .attr('data-slot', 'button')
                .attr('aria-label', t.panels.closeEsc)
                .on('click', () => Message.PanelClosed())
                .children(icon(h, X, css({ width: '4', height: '4' }))),
            ),
          ),
          ...body,
        ),
    )

/* The work item's name, as `components/lab/team.ts` wrote it. */
const workItemName = (t: Messages, item: WorkItem): string => {
  if (item.kind === 'feature') return t.catalog.features[item.ref as FeatureId]?.name ?? item.ref
  if (item.kind === 'task') {
    const name = t.catalog.tasks[item.ref as TaskId]?.name ?? item.ref
    return item.ref === 'runbook' && item.target
      ? t.team.runbookItem(
          name,
          t.catalog.incidents[item.target as IncidentId]?.name ?? item.target,
        )
      : name
  }
  if (item.kind === 'patch') {
    const component = t.catalog.components[item.target as ComponentId]
    return component ? t.team.patchOf(component.name) : t.team.patchDesign
  }
  if (item.kind === 'spike')
    return t.team.spikeOf(t.catalog.research[item.ref as ResearchId]?.name ?? item.ref)
  if (item.kind === 'lever')
    return t.levers.item(t.catalog.pools[item.ref as RequestKind]?.label ?? item.ref)
  if (item.kind === 'split') return t.team.splitAService
  if (item.kind === 'move')
    return item.ref === 'auth'
      ? t.team.moveAuthInHouse
      : item.ref === 'reshard'
        ? t.team.reshardDatabase
        : t.team.changeDatabaseEngine
  return t.team.migrationStep(item.ref.slice(5))
}

/* The drift badge's figure, as `tabDrift` in `components/lab/mirror.ts` read it. */
const tabDrift = (game: Board['game'], region: RegionId): number => {
  const mirror = mirrorOf(game, region)
  if (!mirror) return 0
  const drift = driftOf(game, mirror)
  return drift.behind + drift.hand
}

const CHIP_ORDER: Record<string, string> = {
  Errors: css({ _compact: { order: 2 } }),
  p99: css({ _compact: { order: 3 } }),
  Latency: css({ _compact: { order: 3 } }),
  SLO: css({ _compact: { order: 2 } }),
  SLA: css({ _compact: { order: 2 } }),
}

const stat = (
  h: H<Message>,
  name: string,
  glyph: IconNode,
  value: string,
  note: string,
  tone: Tone,
  title = name,
  className = '',
  onClick?: Message,
): Content => {
  const base = h.div
    .key(name)
    .attr('title', title)
    .class(
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
    )
  const clickable =
    onClick === undefined
      ? base
      : base
          .attr('role', 'button')
          .attr('tabindex', '0')
          .attr('aria-label', title)
          .on('click', () => onClick)
          .on(
            'keydown',
            (payload) => (payload.key === 'Enter' || payload.key === ' ' ? onClick : undefined),
            { preventDefault: true },
          )
  return clickable.children(
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
    h.span
      .class(
        css({
          width: 'var(--hud-label-width,calc(46px*var(--type-scale)))',
          flexShrink: '0',
          fontSize: 'type.11-5',
          color: 'mutedForeground',
          _compact: {
            display: 'none',
          },
        }),
      )
      .children(name),
    h.span
      .class(
        cx(
          FIGURE,
          css({
            fontSize: 'type.13-5',
            lineHeight: 'none',
            whiteSpace: 'nowrap',
          }),
          note || tone === 'plain' ? '' : toneText(tone),
        ),
      )
      .children(value),
    note
      ? h.span
          .attr('title', note)
          .class(
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
          )
          .children(note)
      : null,
  )
}

const insightHelpOf = (t: Messages): ReadonlyArray<readonly [string, string]> => [
  [t.hud.pools, t.hud.insightPaysForResearchEachRequest],
  [t.hud.earn, t.hud.analyticsSamplesTheNodesItLinks(FAILURE_YIELD)],
  [t.hud.spend, t.hud.eachResearchItemCostsInsightFrom],
  [t.hud.keep, t.hud.aPoolHoldsAtMostIts],
]

const insightHelp = (h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .key('insight-help')
    .attr('role', 'dialog')
    .attr('aria-label', t.hud.aboutInsight)
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }),
        )
        .children(
          h.span
            .class(
              css({
                fontSize: 'type.13',
                fontWeight: 'semibold',
              }),
            )
            .children(t.hud.aboutInsight),
          h.button
            .attr('type', 'button')
            .attr('aria-label', t.hud.close)
            .attr('title', t.hud.closeEsc)
            .on('click', () => Message.InsightHelpToggled())
            .class(
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
            )
            .children(
              icon(
                h,
                X,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ),
        ),
      h.dl
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2.5',
          }),
        )
        .children(
          ...insightHelpOf(t).map(([term, text]) =>
            h.div
              .key(term)
              .class(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                }),
              )
              .children(
                h.dt.class(EYEBROW).children(term),
                h.dd
                  .class(
                    css({
                      fontSize: 'type.12',
                      lineHeight: 'snug',
                      color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                    }),
                  )
                  .children(text),
              ),
          ),
        ),
    )
}

const poolRow = (
  h: H<Message>,
  pool: InsightPool,
  held: number,
  perSecond: number,
  inStudy: boolean,
  limiting: boolean,
): Content => {
  const t = copy(h)
  return h.div
    .key(pool)
    .class(
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
    )
    .children(
      h.span
        .class(
          css({
            display: 'inline-flex',
          }),
        )
        .style({ color: poolColor(pool) })
        .children(
          icon(
            h,
            POOL_ICONS[pool],
            css({
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
            }),
          ),
        ),
      h.span
        .class(
          css({
            minWidth: '0',
            flex: '1 1 0%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }),
        )
        .children(t.catalog.pools[pool].label),
      h.span
        .class(
          cx(
            FIGURE,
            limiting &&
              css({
                color: 'danger',
              }),
          ),
        )
        .children(compact(held)),
      h.span
        .class(
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
        )
        .children(t.hud.s(perSecond.toFixed(1))),
    )
}

const insightCard = (h: H<Message>, model: Model, ledger: Ledger): Content => {
  const t = copy(h)

  const game = model.board.game
  const running = currentStudy(game.studies)
  const recipe = running ? simRecipe(game, running.id) : {}
  const limit = running ? limitingPool(game) : null
  const stall = running ? studyStall(game, ledger, running.id) : null
  const queued = studyCount(game.studies) - 1
  const speed = stall ? 1 : studySpeed(game, ledger, running?.id)
  const runningLabel = `${stall ? t.research.cannotRunShort : `${Math.floor(studyProgressOf(running) * 100)}%`}${speed > 1 ? ` · ${t.research.speed(speedFactorOf(speed))}` : ''}${queued > 0 ? ` · +${queued}` : ''}`
  const pools = POOL_ORDER.filter(
    (pool) => game.pools[pool] >= 1 || ledger.insight[pool] > 0 || (recipe[pool] ?? 0) > 0,
  )
  return h.section
    .key('insight')
    .attr('aria-label', t.hud.insight)
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '1',
          }),
        )
        .children(
          h.button
            .attr('type', 'button')
            .attr('title', stall ? t.hud.researchR(stallReasonIn(t, stall)) : t.hud.researchR2)
            .on('click', () =>
              Message.PanelOpened({ panel: model.panel === 'research' ? 'none' : 'research' }),
            )
            .class(
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
            )
            .children(
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
              h.span
                .class(
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
                )
                .children(running ? t.catalog.research[running.id].name : t.hud.idle),
              running
                ? h.span
                    .class(
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
                    )
                    .children(
                      stall
                        ? icon(
                            h,
                            TriangleAlert,
                            css({
                              width: '3',
                              height: '3',
                            }),
                          )
                        : null,
                      runningLabel,
                    )
                : null,
            ),
          h.button
            .attr('type', 'button')
            .attr('title', t.hud.aboutInsight)
            .attr('aria-label', t.hud.aboutInsight)
            .attr('aria-expanded', String(model.board.insightHelp))
            .on('click', () => Message.InsightHelpToggled())
            .class(
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
            )
            .children(
              icon(
                h,
                CircleHelp,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
            ),
        ),
      running
        ? meter(
            h,
            studyProgressOf(running),
            stall
              ? css({
                  backgroundColor: 'warn',
                })
              : css({ backgroundColor: 'ok' }),
          )
        : null,
      pools.length > 0
        ? h.div
            .class(
              cx(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2',
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
            )
            .children(
              ...pools.map((pool) =>
                poolRow(
                  h,
                  pool,
                  game.pools[pool],
                  ledger.insight[pool],
                  (recipe[pool] ?? 0) > 0,
                  pool === limit && ledger.insight[pool] <= 0,
                ),
              ),
            )
        : null,
      model.board.insightHelp ? insightHelp(h) : null,
    )
}

const percent = (share: number): string => `${(Math.floor(share * 10_000) / 100).toFixed(2)}%`

const slo = (h: H<Message>, game: Board['game']): Content => {
  const t = copy(h)

  const budget = budgetOf(game)
  const left = Math.max(0, budget.left)
  return stat(
    h,
    'SLO',
    ShieldCheck,
    percent(budget.availability),
    has(game, 'slo-dashboards')
      ? budget.left > 0
        ? t.hud.left(Math.round(left * 100))
        : t.hud.spent
      : `/ ${Number((budget.slo * 100).toFixed(2))}%`,
    budget.left > 0.5 ? 'ok' : budget.left > 0 ? 'warn' : 'danger',
    t.hud.availabilityThisWeekAgainstTheError(
      percent(budget.slo),
      budget.left > 0 ? t.hud.left(Math.round(left * 100)) : t.hud.spent,
    ),
  )
}

const TOOLBAR_ROOM = css({
  _compact: { minHeight: '9', paddingRight: 'var(--toolbar-w)' },
})

const funding = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  const share = next ? Math.min(1, game.users / era.raiseAt) : 1
  const ready = canRaise(game)
  const clock = clockOf(game.time)
  return h.div
    .class(
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
    )
    .attr('title', next ? t.hud.roundAtUsers(next.name, compact(era.raiseAt)) : era.name)
    .children(
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            }),
            TOOLBAR_ROOM,
          ),
        )
        .children(
          button(
            h,
            {
              onClick: Message.PanelOpened({ panel: 'menu' }),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                marginLeft: '-0.375rem',
                color: 'mutedForeground',
              }),
              attributes: { 'aria-label': t.hud.menuEsc, title: t.hud.menuEsc },
            },
            icon(
              h,
              Menu,
              css({
                width: '4',
                height: '4',
              }),
            ),
          ),
          h.span
            .class(
              css({
                fontSize: 'type.13',
                fontWeight: 'semibold',
                _compact: {
                  flexShrink: '0',
                },
              }),
            )
            .children(era.name),
          h.span
            .class(
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
            )
            .attr('title', t.hud.calendarOneSecondIsOneMinute)
            .children(
              t.hud.d(
                clock.day,
                String(clock.hour).padStart(2, '0'),
                String(clock.minute).padStart(2, '0'),
              ),
            ),
        ),
      meter(
        h,
        share,
        ready
          ? css({
              backgroundColor: 'ok',
            })
          : css({ layerStyle: 'primaryFill' }),
      ),
      ready && next
        ? button(
            h,
            {
              onClick: Message.PanelOpened({ panel: 'offer' }),
              size: 'sm',
              key: 'offer',
              className: cx(
                css({
                  marginTop: '1',
                  width: '100%',
                }),
                'enter-pop',
                'shine',
              ),
              attributes: { 'data-exit': 'gesture' },
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
          )
        : null,
    )
}

const building = (h: H<Message>, model: Model, ledger: Ledger): Content => {
  const t = copy(h)

  const game = model.board.game
  const item = game.backlog[0]
  const rate = devHoursRate(game, ledger) * 60
  const ready = awaitingFeatures(game).length
  const late = item ? overdueBy(game, item) : 0
  const due = item?.due === undefined ? null : item.due - game.time
  return h.button
    .key('building')
    .attr('type', 'button')
    .attr('title', t.hud.teamT)
    .on('click', () => Message.PanelOpened({ panel: model.panel === 'team' ? 'none' : 'team' }))
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            fontSize: 'type.12',
          }),
        )
        .children(
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
          h.span
            .class(
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
            )
            .children(item ? workItemName(t, item) : t.hud.idle),
          due !== null
            ? h.span
                .class(
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
                )
                .children(late > 0 ? t.hud.overdue : t.hud.due(mmss(due)))
            : ready > 0
              ? h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                        color: 'primaryStrong',
                      }),
                    ),
                  )
                  .children(t.hud.toDeploy(ready))
              : h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'type.10-5',
                        color: 'mutedForeground',
                      }),
                    ),
                  )
                  .children(t.hud.dHMin(rate < 10 ? rate.toFixed(1) : Math.round(rate))),
        ),
      item ? meter(h, item.spent / item.cost, css({ backgroundColor: 'ok' })) : null,
    )
}

const phoneFigure = (
  h: H<Message>,
  label: string,
  glyph: IconNode,
  value: string,
  tone: Tone,
  onClick: Message | null,
): Content => {
  const base = h.button
    .attr('type', 'button')
    .attr('aria-label', label)
    .attr('title', label)
    .class(
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
    )
  const pressable = onClick === null ? base.attr('disabled', '') : base.on('click', () => onClick)
  return pressable.children(
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
    h.span
      .class(
        cx(
          FIGURE,
          css({
            fontSize: 'type.13-5',
            lineHeight: 'none',
            whiteSpace: 'nowrap',
          }),
          tone === 'plain' ? '' : toneText(tone),
        ),
      )
      .children(value),
  )
}

const phoneHud = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const game = model.board.game
  const era = localized(eraOf(game), eraWords(t, game))
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  const share = next ? Math.min(1, game.users / era.raiseAt) : 1
  const ready = canRaise(game)
  const target = eraOf(game).apdexTarget
  return h.header
    .key('phone-hud')
    .attr('title', next ? t.hud.roundAtUsers(next.name, compact(era.raiseAt)) : era.name)
    .class(
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
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            height: '11',
            alignItems: 'center',
            gap: '1',
            paddingRight: 'var(--toolbar-w)',
          }),
        )
        .children(
          h.button
            .attr('type', 'button')
            .attr('aria-label', t.hud.menuEsc)
            .attr('title', t.hud.menuEsc)
            .on('click', () => Message.PanelOpened({ panel: 'menu' }))
            .class(
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
            )
            .children(
              icon(
                h,
                Menu,
                css({
                  width: '5',
                  height: '5',
                }),
              ),
            ),
          h.span
            .class(
              css({
                minWidth: '0',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.15',
                fontWeight: 'semibold',
              }),
            )
            .children(era.name),
        ),
      h.div
        .class(
          css({
            paddingInline: '0.5',
          }),
        )
        .children(
          meter(
            h,
            share,
            ready
              ? css({
                  backgroundColor: 'ok',
                })
              : css({ layerStyle: 'primaryFill' }),
          ),
        ),
      h.div
        .class(
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
        )
        .children(
          phoneFigure(
            h,
            t.hud.cash,
            Wallet,
            money(game.cash),
            game.cash < 0 ? 'danger' : 'plain',
            Message.PanelOpened({ panel: 'vitals' }),
          ),
          phoneFigure(
            h,
            t.hud.users,
            Users,
            compact(game.users),
            'plain',
            Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
          ),
          phoneFigure(
            h,
            'Apdex',
            Smile,
            game.apdex.toFixed(2),
            game.apdex >= target ? 'ok' : 'danger',
            Message.PanelOpened({ panel: 'vitals' }),
          ),
        ),
    )
}

const vitalRow = (
  h: H<Message>,
  name: string,
  glyph: IconNode,
  value: string,
  note: string,
  tone: Tone,
  onClick: Message | null,
  title = name,
): Content => {
  const base = h.button
    .attr('type', 'button')
    .attr('title', title)
    .attr('aria-label', title)
    .class(
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
    )
  const pressable = onClick === null ? base.attr('disabled', '') : base.on('click', () => onClick)
  return pressable.children(
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
    h.span
      .class(
        css({
          minWidth: 0,
          flex: '1 1 0%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 'type.13',
        }),
      )
      .children(name),
    h.span
      .class(
        cx(
          FIGURE,
          css({
            flexShrink: '0',
            fontSize: 'type.14',
            lineHeight: 'none',
          }),
          tone === 'plain' ? '' : toneText(tone),
        ),
      )
      .children(value),
    note
      ? h.span
          .attr('title', note)
          .class(
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
          )
          .children(note)
      : null,
  )
}

export const vitalsPanel = (h: H<Message>, model: Model, ledger: Ledger): Content => {
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
    h,
    t,
    t.hud.vitals,
    [],
    [
      h.div
        .class(
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
        )
        .children(
          h.div.class(css({ display: 'flex', flexDirection: 'column', gap: '2' })).children(
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
                      fontSize: 'type.15',
                      fontWeight: 'semibold',
                    }),
                  )
                  .children(era.name),
                next
                  ? h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.11-5',
                            color: 'mutedForeground',
                          }),
                        ),
                      )
                      .children(t.hud.roundAtUsers(next.name, compact(era.raiseAt)))
                  : null,
              ),
            meter(
              h,
              share,
              ready
                ? css({
                    backgroundColor: 'ok',
                  })
                : css({ layerStyle: 'primaryFill' }),
            ),
            ready && next
              ? button(
                  h,
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
                )
              : null,
          ),
          h.div
            .class(
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
            )
            .children(
              vitalRow(
                h,
                t.hud.cash,
                Wallet,
                money(game.cash),
                cashNote,
                short || bridging ? 'danger' : net >= 0 && income > 0 ? 'ok' : 'plain',
                short || bridging ? Message.PanelOpened({ panel: 'dashboard' }) : null,
                t.hud.cashAndNet,
              ),
              vitalRow(
                h,
                t.hud.users,
                Users,
                compact(game.users),
                trend === 0 ? '' : `${trend > 0 ? '▲' : '▼'} ${compact(Math.abs(trend))}`,
                trend >= 0 ? 'ok' : 'danger',
                Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
                t.hud.whyUsersLeave,
              ),
              vitalRow(
                h,
                'Apdex',
                Smile,
                game.apdex.toFixed(2),
                `/ ${target.toFixed(2)}`,
                game.apdex >= target ? 'ok' : 'danger',
                null,
                t.hud.apdexOverTheLastHourUsers(target.toFixed(2)),
              ),
              shown(model, 'errors')
                ? vitalRow(
                    h,
                    t.hud.errors,
                    TriangleAlert,
                    `${errors.toFixed(errors >= 10 ? 0 : 1)}%`,
                    '',
                    errors < 1 ? 'ok' : errors < 5 ? 'warn' : 'danger',
                    null,
                  )
                : null,
              budgeted(game)
                ? vitalRow(
                    h,
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
                  )
                : null,
              credit > 0
                ? vitalRow(
                    h,
                    'SLA',
                    Wallet,
                    `−${t.units.perSecond(money(credit))}`,
                    '',
                    'danger',
                    null,
                    t.hud.slaCredits(t.units.perSecond(money(credit)), percent(budgetOf(game).slo)),
                  )
                : null,
              vitalRow(
                h,
                percentiles ? 'p99' : t.hud.latency,
                Timer,
                formats(t).ms(percentiles ? ledger.p99 : ledger.latency),
                percentiles ? `μ ${formats(t).ms(ledger.latency)}` : '',
                'plain',
                null,
              ),
            ),
          shown(model, 'research') ? insightCard(h, model, ledger) : null,
          game.stage === PRE_IPO_STAGE && !offCompany(model) ? checklist(h, model, ledger) : null,
          QuarterState.guards.Active(game.quarter) && !offCompany(model)
            ? quarterly(h, model, ledger)
            : null,
          shown(model, 'team') ? building(h, model, ledger) : null,
        ),
    ],
    css({ maxWidth: '560px', height: '100%' }),
  )
}

export const phoneOffer = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const game = model.board.game
  const nextWords = t.catalog.eras[game.stage + 1]
  const next = nextEra(game) && nextWords ? localized(nextEra(game)!, nextWords) : undefined
  if (!canRaise(game) || !next) return undefined
  return button(
    h,
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
      h.span
        .class(
          css({
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }),
        )
        .children(game.stage === PRE_IPO_STAGE ? t.hud.iPO : t.hud.offer(next.name)),
    ],
  )
}

export const hud = (h: H<Message>, model: Model, ledger: Ledger): Content => {
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
  const bridging = game.bridge._tag === 'Offered'
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

  const header = h.header
    .attr('data-morph', 'notice')
    .class(
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
    )
    .children(
      funding(h, model),
      h.div
        .class(
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
        )
        .children(
          stat(
            h,
            t.hud.cash,
            Wallet,
            money(game.cash),
            cashNote,
            game.cash < 0 || bridging ? 'danger' : net >= 0 && income > 0 ? 'ok' : 'plain',
            bridging ? t.hud.cashShortBridge : t.hud.cashAndNet,
            short || bridging
              ? css({ cursor: 'pointer', borderRadius: 'lg', _hover: { backgroundColor: 'muted' } })
              : '',
            short || bridging ? Message.PanelOpened({ panel: 'dashboard' }) : undefined,
          ),
          stat(
            h,
            t.hud.users,
            Users,
            compact(game.users),
            trend === 0 ? '' : `${trend > 0 ? '▲' : '▼'} ${compact(Math.abs(trend))}`,
            trend >= 0 ? 'ok' : 'danger',
            t.hud.whyUsersLeave,
            css({ cursor: 'pointer', borderRadius: 'lg', _hover: { backgroundColor: 'muted' } }),
            Message.PanelOpened({ panel: model.panel === 'churn' ? 'none' : 'churn' }),
          ),
          stat(
            h,
            'Apdex',
            Smile,
            game.apdex.toFixed(2),
            `/ ${target.toFixed(2)}`,
            game.apdex >= target ? 'ok' : 'danger',
            t.hud.apdexOverTheLastHourUsers(target.toFixed(2)),
          ),
          shown(model, 'errors')
            ? stat(
                h,
                t.hud.errors,
                TriangleAlert,
                `${errors.toFixed(errors >= 10 ? 0 : 1)}%`,
                '',
                errors < 1 ? 'ok' : errors < 5 ? 'warn' : 'danger',
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
            : null,
          budgeted(game) ? slo(h, game) : null,
          credit > 0
            ? stat(
                h,
                'SLA',
                Wallet,
                `−${t.units.perSecond(money(credit))}`,
                '',
                'danger',
                t.hud.slaCredits(t.units.perSecond(money(credit)), percent(budgetOf(game).slo)),
              )
            : null,
          stat(
            h,
            percentiles ? 'p99' : t.hud.latency,
            Timer,
            formats(t).ms(percentiles ? ledger.p99 : ledger.latency),
            percentiles ? `μ ${formats(t).ms(ledger.latency)}` : '',
            'plain',
          ),
        ),
      game.stage === PRE_IPO_STAGE && !offCompany(model) ? checklist(h, model, ledger) : null,
      QuarterState.guards.Active(game.quarter) && !offCompany(model)
        ? quarterly(h, model, ledger)
        : null,
      shown(model, 'team') ? building(h, model, ledger) : null,
    )
  return h.div
    .class(
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
    )
    .style({
      '--hud-label-width':
        model.prefs.locale === 'fr' || model.prefs.locale === 'ja' || model.prefs.locale === 'es'
          ? 'calc(64px*var(--type-scale))'
          : 'calc(46px*var(--type-scale))',
    })
    .children(
      phoneHud(h, model),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '2',
            _compact: {
              display: 'none',
            },
          }),
        )
        .children(header, shown(model, 'research') ? insightCard(h, model, ledger) : null),
    )
}

const line = (h: H<Message>, name: string, value: string, tone: Tone, mark?: boolean): Content =>
  h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        height: '6',
        alignItems: 'center',
        gap: '2',
        paddingInline: '2.5',
        fontSize: 'type.11-5',
      }),
    )
    .children(
      mark === undefined
        ? null
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
      h.span
        .class(
          css({
            color: 'mutedForeground',
          }),
        )
        .children(name),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              marginLeft: 'auto',
              fontSize: 'type.10-5',
              whiteSpace: 'nowrap',
            }),
            toneText(tone),
          ),
        )
        .children(value),
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
  if (drill._tag === 'Idle') return t.hud.checkNotRun
  if (drill._tag === 'Running') return t.hud.checkRunning
  if (drillPassed(drill)) return t.hud.checkRto(Math.round(drillRto(drill) ?? 0))
  if (brokenRestore(game)) return t.hud.checkRestoreFailed
  if (drill._tag === 'Failed') return t.hud.checkNotRecovered
  return drill.rpo >= DRILL_RPO
    ? t.hud.checkDataLost
    : t.hud.checkRto(Math.round(drillRto(drill) ?? 0))
}

const checklist = (h: H<Message>, model: Model, ledger: Ledger): Content => {
  const t = copy(h)

  const game = model.board.game
  const items = checklistOf(game, ledger)
  const drillReady =
    has(game, 'dr-drills') && activeIncident(game) === null && game.drill._tag !== 'Running'
  return h.div
    .key('ipo')
    .class(
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
    )
    .children(
      ...items.map((item) =>
        line(
          h,
          checklistLabel(t, item.id),
          checklistValue(t, game, item),
          item.met ? 'ok' : 'plain',
          item.met,
        ),
      ),
      has(game, 'dr-drills')
        ? h.div
            .class(
              css({
                paddingInline: '1.5',
                paddingTop: '1',
              }),
            )
            .children(
              button(
                h,
                {
                  onClick: Message.DrillRun(),
                  variant: 'outline',
                  size: 'sm',
                  className: css({
                    width: '100%',
                  }),
                  attributes: { disabled: drillReady ? undefined : '' },
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
              ),
            )
        : null,
    )
}

const levelsOf = (t: Messages) => [t.hud.low, t.hud.mid, t.hud.high] as const

const guidance = (
  h: H<Message>,
  label: string,
  values: ReadonlyArray<number>,
  chosen: number,
  pick: (level: number) => Message,
  open: boolean,
): Content => {
  const t = copy(h)
  return h.div
    .key(label)
    .class(
      css({
        display: 'flex',
        height: '7',
        alignItems: 'center',
        gap: '1',
        paddingInline: '2.5',
        fontSize: 'type.11-5',
      }),
    )
    .children(
      h.span
        .class(
          css({
            marginRight: 'auto',
            color: 'mutedForeground',
          }),
        )
        .children(label),
      ...values.map((value, level) =>
        h.button
          .attr('type', 'button')
          .attr('title', t.hud.levelTitle(levelsOf(t)[level] ?? '', value))
          .attr('disabled', !open && level !== chosen ? '' : undefined)
          .attr('aria-pressed', level === chosen ? 'true' : 'false')
          .on('click', () => pick(level))
          .class(
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
          )
          .children(`${value}%`),
      ),
    )
}

const quarterly = (h: H<Message>, model: Model, ledger: Ledger): View.Input<Message> => {
  const t = copy(h)

  const game = model.board.game
  const quarter = game.quarter
  if (!QuarterState.guards.Active(quarter)) return undefined
  const day = Math.min(7, Math.floor((game.time - quarter.startedAt) / 1_440) + 1)
  const value = valuationOf(game, ledger)
  const open = guidanceOpen(game)
  const growth = quarterGrowth(quarter, ledger)
  return h.div
    .key('quarter')
    .class(
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
    )
    .children(
      line(h, t.hud.quarter(quarter.index), t.hud.dayOf7(day), 'plain'),
      guidance(
        h,
        t.hud.growth,
        GUIDANCE_GROWTH_PERCENT,
        quarter.growth,
        (level) => Message.GuidanceChosen({ growth: level, margin: quarter.margin }),
        open,
      ),
      guidance(
        h,
        t.hud.margin,
        GUIDANCE_MARGIN_PERCENT,
        quarter.margin,
        (level) => Message.GuidanceChosen({ growth: quarter.growth, margin: level }),
        open,
      ),
      line(
        h,
        t.hud.soFar,
        `${growth >= 0 ? '+' : ''}${growth.toFixed(1)}% · ${marginOf(ledger).toFixed(0)}%`,
        growth >= (GUIDANCE_GROWTH_PERCENT[quarter.growth] ?? 0) &&
          marginOf(ledger) >= (GUIDANCE_MARGIN_PERCENT[quarter.margin] ?? 0)
          ? 'ok'
          : 'warn',
      ),
      line(
        h,
        t.hud.valuation,
        `${money(value.valuation)} · ×${value.multiple.toFixed(1)}`,
        'plain',
      ),
      quarter.last
        ? line(
            h,
            t.hud.q(quarter.index - 1),
            quarter.last.beat ? t.hud.beatStreak(quarter.streak) : t.hud.missed,
            quarter.last.beat ? 'ok' : 'danger',
          )
        : null,
    )
}

const toolButton = (
  h: H<Message>,
  label: string,
  glyph: IconNode,
  message: Message,
  active: boolean,
  extra: Child = null,
  cue = false,
): Content =>
  h.button
    .key(label)
    .attr('type', 'button')
    .attr('title', label)
    .attr('aria-label', label)
    .attr('aria-pressed', active ? 'true' : 'false')
    .on('click', () => message)
    .class(
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
    )
    .children(
      icon(
        h,
        glyph,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      extra,
    )

const historyButton = (
  h: H<Message>,
  label: string,
  glyph: IconNode,
  message: Message,
  ready: boolean,
  cue = false,
): Content =>
  h.button
    .key(label)
    .attr('type', 'button')
    .attr('title', label)
    .attr('aria-label', label)
    .attr('disabled', ready ? undefined : '')
    .on('click', () => message)
    .class(
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
    )
    .children(
      icon(
        h,
        glyph,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
    )

const desktopOnly = (h: H<Message>, children: ReadonlyArray<Child>): Content =>
  h.div
    .class(
      css({
        display: 'contents',
        _compact: {
          display: 'none',
        },
      }),
    )
    .children(...children)

const divider = (h: H<Message>): Content =>
  h.div
    .class(
      css({
        marginInline: '0.5',
        height: '6',
        width: '1px',
        backgroundColor: 'hairline',
        _compact: {
          display: 'none',
        },
      }),
    )
    .children()

const exitButton = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const legacy = exitLegacy(model)
  if (legacy === null) return undefined
  return h.button
    .key('exit')
    .attr('type', 'button')
    .attr('title', t.hud.exitUpToLegacy(legacy))
    .attr('aria-label', t.hud.exit)
    .attr('aria-pressed', model.panel === 'exit' ? 'true' : 'false')
    .on('click', () => Message.PanelOpened({ panel: model.panel === 'exit' ? 'none' : 'exit' }))
    .class(
      cx(
        tool(
          model.panel === 'exit',
          css.raw({
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
        ),
        'enter-pop',
      ),
    )
    .children(
      icon(
        h,
        DoorOpen,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      h.span
        .class(
          css({
            _compact: {
              display: 'none',
            },
            '@media (max-width: 1535px)': {
              display: 'none',
            },
          }),
        )
        .children(t.hud.exit),
      legacy > 0
        ? h.span
            .key('badge')
            .class(
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
            )
            .children(String(legacy))
        : null,
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

type MoreMenuMessage = Extract<Message, { _tag: 'MoreMenuChanged' }>['message']

const moreMenuChanged = (message: MoreMenuMessage): Message => Message.MoreMenuChanged({ message })

const wrapIndex = (index: number, count: number): number => ((index % count) + count) % count

/* The menu's items sit under its button, as the Foldkit anchor mount placed them. */
const MENU_GAP = 6
const MENU_PADDING = 8

const MenuAnchor = Mount.make('MenuAnchor', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const place = () => {
            const button = element.parentElement?.querySelector('button')
            if (!(button instanceof HTMLElement)) return
            const rect = button.getBoundingClientRect()
            const width = element.offsetWidth
            const height = element.offsetHeight
            const left = Math.min(
              Math.max(MENU_PADDING, rect.right - width),
              window.innerWidth - width - MENU_PADDING,
            )
            const below = window.innerHeight - rect.bottom - MENU_GAP - MENU_PADDING
            const top =
              below >= height || rect.top - MENU_GAP - MENU_PADDING < height
                ? Math.min(rect.bottom + MENU_GAP, window.innerHeight - height - MENU_PADDING)
                : Math.max(MENU_PADDING, rect.top - MENU_GAP - height)
            element.style.position = 'fixed'
            element.style.margin = '0'
            element.style.left = `${left}px`
            element.style.top = `${top}px`
            element.style.visibility = 'visible'
          }
          place()
          window.addEventListener('scroll', place, true)
          window.addEventListener('resize', place)
          return () => {
            window.removeEventListener('scroll', place, true)
            window.removeEventListener('resize', place)
          }
        }),
        (cleanup) => Effect.sync(cleanup),
      )
      return yield* Effect.never
    }),
  ).pipe(Effect.as(Component.noop)),
)

const MORE_ITEM = css({
  display: 'flex',
  height: '10',
  cursor: 'pointer',
  alignItems: 'center',
  gap: '2.5',
  borderRadius: 'xl',
  paddingInline: '2.5',
  fontSize: 'type.13',
  outlineStyle: 'none',
})

const MORE_ITEM_ACTIVE = css({
  backgroundColor: 'well',
})

const MORE_ITEM_DISABLED = css({
  opacity: 0.35,
})

const MORE_ITEM_FULLSCREEN = css({
  _narrow: {
    display: 'none',
  },
})

const MORE_ITEMS = cx(
  css({ zIndex: '50', minWidth: '48', padding: '1', outlineStyle: 'none' }),
  FLOAT,
)

const MORE_BACKDROP = css({ position: 'fixed', inset: '0', zIndex: '40' })

const MORE_CONTENT = css({
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  gap: '2.5',
})

const moreButton = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const legacy = exitLegacy(model)
  const calling = (legacy ?? 0) > 0 || glowing(model, 'undo')
  const items = moreItems(model)
  const menu = model.moreMenu
  const isLeaving =
    menu.animation.transitionState === 'LeaveStart' ||
    menu.animation.transitionState === 'LeaveAnimating'
  const isVisible = menu.isOpen || isLeaving
  const active = Option.isSome(menu.maybeActiveItemIndex) ? menu.maybeActiveItemIndex.value : -1
  const isDisabled = (index: number): boolean => {
    const item = items[index]
    return (
      item !== undefined &&
      ((item === 'undo' && !undoAvailable(model.board)) ||
        (item === 'redo' && !redoAvailable(model.board)))
    )
  }
  const enabled = (start: number, step: number): number => {
    for (let at = 0; at < items.length; at++) {
      const index = wrapIndex(start + at * step, items.length)
      if (!isDisabled(index)) return index
    }
    return start
  }
  const firstEnabled = enabled(0, 1)
  const lastEnabled = enabled(items.length - 1, -1)
  const opened = (index: number) =>
    moreMenuChanged({ _tag: 'Opened', maybeActiveItemIndex: Option.some(index) })
  const activate = (index: number) =>
    moreMenuChanged({ _tag: 'ActivatedItem', index, activationTrigger: 'Keyboard' })
  const search = (key: string) => {
    const query = `${menu.searchQuery}${key}`.toLowerCase()
    let match: number | null = null
    for (let at = 0; at < items.length; at++) {
      const index = wrapIndex(active + (menu.searchQuery === '' ? 1 : 0) + at, items.length)
      const item = items[index]
      if (item !== undefined && moreOf(t)[item].label.toLowerCase().startsWith(query)) {
        match = index
        break
      }
    }
    return match
  }
  const itemsKeyDown = (key: string): Message | undefined => {
    if (isLeaving) return undefined
    if (key === 'Escape') return moreMenuChanged({ _tag: 'Closed' })
    if (key === 'Enter') {
      return active >= 0
        ? moreMenuChanged({ _tag: 'RequestedItemClick', index: active })
        : undefined
    }
    if (key === ' ') {
      if (menu.searchQuery !== '') {
        const target = search(' ')
        return moreMenuChanged({
          _tag: 'Searched',
          key: ' ',
          maybeTargetIndex: target === null ? Option.none() : Option.some(target),
        })
      }
      return active >= 0
        ? moreMenuChanged({ _tag: 'RequestedItemClick', index: active })
        : undefined
    }
    if (
      key === 'ArrowDown' ||
      key === 'ArrowUp' ||
      key === 'Home' ||
      key === 'End' ||
      key === 'PageUp' ||
      key === 'PageDown'
    ) {
      const index =
        key === 'ArrowDown'
          ? enabled(active + 1, 1)
          : key === 'ArrowUp'
            ? enabled(active - 1, -1)
            : key === 'Home' || key === 'PageUp'
              ? firstEnabled
              : lastEnabled
      return activate(index)
    }
    if (key.length === 1) {
      const target = search(key)
      return moreMenuChanged({
        _tag: 'Searched',
        key,
        maybeTargetIndex: target === null ? Option.none() : Option.some(target),
      })
    }
    return undefined
  }
  const buttonKeyDown = (key: string): Message | undefined => {
    if (isVisible) return itemsKeyDown(key)
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown') return opened(firstEnabled)
    if (key === 'ArrowUp') return opened(lastEnabled)
    return undefined
  }
  const trigger = h.button
    .key('more-menu-button')
    .attr('id', 'more-menu-button')
    .attr('type', 'button')
    .attr('aria-haspopup', 'menu')
    .attr('aria-expanded', String(isVisible))
    .attr('aria-controls', isVisible ? 'more-menu-items' : undefined)
    .attr('aria-label', t.hud.more)
    .on('click', () => moreMenuChanged({ _tag: 'ClickedButton' }))
    .on('keydown', (payload) => buttonKeyDown(payload.key), { preventDefault: true })
    .on(
      'keyup',
      (payload) =>
        payload.key === ' ' ? moreMenuChanged({ _tag: 'SuppressedSpaceScroll' }) : undefined,
      { preventDefault: true },
    )
    .attr('data-open', isVisible ? '' : undefined)
    .style(isVisible ? { position: 'relative', zIndex: '1' } : {})
    .class(tool(menu.isOpen, css.raw({ width: '11', height: '11' })))
    .children(
      h.span
        .class(
          css({
            display: 'contents',
          }),
        )
        .children(
          icon(
            h,
            Ellipsis,
            css({
              width: '18px',
              height: '18px',
            }),
          ),
          calling
            ? h.span
                .class(
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
                )
                .children()
            : null,
        ),
    )
  return h.div
    .class(
      css({
        display: 'none',
        _compact: {
          display: 'block',
        },
      }),
    )
    .attr('data-open', isVisible ? '' : undefined)
    .children(
      trigger,
      ...(isVisible
        ? [
            h.div
              .key('more-menu-backdrop')
              .class(MORE_BACKDROP)
              .on('click', () => moreMenuChanged({ _tag: 'Closed' })),
            h.div
              .key('more-menu-items-container')
              .attr('id', 'more-menu-items')
              .attr('role', 'menu')
              .attr('aria-labelledby', 'more-menu-button')
              .attr('aria-activedescendant', active >= 0 ? `more-menu-item-${active}` : undefined)
              .attr('tabindex', '-1')
              .style({ position: 'absolute', margin: '0', visibility: 'hidden' })
              .onMount(MenuAnchor({}))
              .on('keydown', (payload) => itemsKeyDown(payload.key), { preventDefault: true })
              .on(
                'keyup',
                (payload) =>
                  payload.key === ' '
                    ? moreMenuChanged({ _tag: 'SuppressedSpaceScroll' })
                    : undefined,
                { preventDefault: true },
              )
              .on('mouseup', (payload) =>
                payload.pointerType === 'mouse'
                  ? moreMenuChanged({
                      _tag: 'ReleasedPointerOnItems',
                      screenX: payload.x,
                      screenY: payload.y,
                      timeStamp: 0,
                    })
                  : undefined,
              )
              .on('blur', () => moreMenuChanged({ _tag: 'BlurredItems' }))
              .class(MORE_ITEMS)
              .children(
                ...items.map((item, index) => {
                  const isActive = index === active
                  const isItemDisabled = isDisabled(index)
                  const interactive = !isItemDisabled && !isLeaving
                  const config = moreOf(t)[item]
                  const row = h.div
                    .key(`more-menu-item-${index}`)
                    .attr('id', `more-menu-item-${index}`)
                    .attr('role', 'menuitem')
                    .attr('data-active', isActive ? '' : undefined)
                    .attr('aria-disabled', isItemDisabled ? 'true' : undefined)
                    .attr('data-disabled', isItemDisabled ? '' : undefined)
                    .class(
                      cx(
                        MORE_ITEM,
                        isActive && MORE_ITEM_ACTIVE,
                        isItemDisabled && MORE_ITEM_DISABLED,
                        item === 'fullscreen' && MORE_ITEM_FULLSCREEN,
                      ),
                    )
                  const pressable = interactive
                    ? row
                        .on('click', () => moreMenuChanged({ _tag: 'SelectedItem', index, item }))
                        .on('mouseenter', (payload) =>
                          isActive
                            ? undefined
                            : moreMenuChanged({
                                _tag: 'MovedPointerOverItem',
                                index,
                                screenX: payload.x,
                                screenY: payload.y,
                              }),
                        )
                        .on('mouseleave', () => moreMenuChanged({ _tag: 'DeactivatedItem' }))
                    : row
                  return pressable.children(
                    h.span.class(MORE_CONTENT).children(
                      icon(
                        h,
                        config.glyph,
                        css({
                          width: '18px',
                          height: '18px',
                          color: 'mutedForeground',
                        }),
                      ),
                      h.span
                        .class(
                          css({
                            flex: '1 1 0%',
                          }),
                        )
                        .children(config.label),
                      item === 'exit' && (legacy ?? 0) > 0
                        ? h.span
                            .class(
                              cx(
                                FIGURE,
                                css({
                                  fontSize: 'type.11-5',
                                  color: 'ok',
                                }),
                              ),
                            )
                            .children(t.hud.legacy(legacy))
                        : null,
                    ),
                  )
                }),
              ),
          ]
        : []),
    )
}

export const toolbar = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const game = model.board.game
  const affordable =
    studyCount(game.studies) > 0
      ? 0
      : researchList.filter((entry) => !has(game, entry.id) && researchReady(game, entry.id)).length
  const researchButton = h.button
    .key('research')
    .attr('type', 'button')
    .attr('title', t.hud.researchR2)
    .attr('aria-label', t.hud.research)
    .attr('aria-pressed', model.panel === 'research' ? 'true' : 'false')
    .on('click', () =>
      Message.PanelOpened({ panel: model.panel === 'research' ? 'none' : 'research' }),
    )
    .class(
      cx(
        tool(
          model.panel === 'research',
          css.raw({
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
        'enter-pop',
        glowing(model, 'research') && 'cue-glow',
      ),
    )
    .children(
      icon(
        h,
        FlaskConical,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      h.span
        .class(
          css({
            _compact: {
              display: 'none',
            },
            '@media (max-width: 1535px)': {
              display: 'none',
            },
          }),
        )
        .children(t.hud.research),
      affordable > 0
        ? h.span
            .key('badge')
            .attr('data-exit', 'notice')
            .class(
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
            )
            .children(String(affordable))
        : null,
    )
  const teamButton = h.button
    .key('team')
    .attr('type', 'button')
    .attr('title', t.hud.teamT)
    .attr('aria-label', t.hud.team)
    .attr('aria-pressed', model.panel === 'team' ? 'true' : 'false')
    .on('click', () => Message.PanelOpened({ panel: model.panel === 'team' ? 'none' : 'team' }))
    .class(
      cx(
        tool(
          model.panel === 'team',
          css.raw({
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
        'enter-pop',
        glowing(model, 'team') && 'cue-glow',
      ),
    )
    .children(
      icon(
        h,
        UsersRound,
        css({
          width: '18px',
          height: '18px',
        }),
      ),
      h.span
        .class(
          css({
            _compact: {
              display: 'none',
            },
            '@media (max-width: 1535px)': {
              display: 'none',
            },
          }),
        )
        .children(t.hud.team),
      game.backlog.length === 0
        ? h.span
            .class(
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
            )
            .children()
        : null,
    )
  return h.nav
    .class(
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
    )
    .children(
      desktopOnly(h, [exitButton(h, model)]),
      offCompany(model) || !shown(model, 'research') ? null : researchButton,
      offCompany(model) || !shown(model, 'team') ? null : teamButton,
      desktopOnly(h, [
        !playbooksShown(model)
          ? null
          : toolButton(
              h,
              t.hud.playbooksP,
              BookCopy,
              Message.PanelOpened({ panel: model.panel === 'playbooks' ? 'none' : 'playbooks' }),
              model.panel === 'playbooks',
            ),
        has(game, 'metrics')
          ? toolButton(
              h,
              t.hud.dashboardD,
              ChartLine,
              Message.PanelOpened({ panel: model.panel === 'dashboard' ? 'none' : 'dashboard' }),
              model.panel === 'dashboard',
            )
          : null,
        toolButton(
          h,
          t.hud.howToPlayH,
          CircleHelp,
          Message.PanelOpened({ panel: model.panel === 'help' ? 'none' : 'help' }),
          model.panel === 'help',
        ),
        ...(shown(model, 'undo')
          ? [
              divider(h),
              historyButton(
                h,
                t.hud.undoZ,
                Undo2,
                Message.UndoChosen(),
                undoAvailable(model.board),
                glowing(model, 'undo'),
              ),
              historyButton(
                h,
                t.hud.redoShiftZ,
                Redo2,
                Message.RedoChosen(),
                redoAvailable(model.board),
              ),
            ]
          : []),
      ]),
      shown(model, 'glossary')
        ? h.a
            .key('glossary')
            .attr('href', `${WIKI_URL}/glossary`)
            .attr('target', '_blank')
            .attr('rel', 'noreferrer noopener')
            .attr('title', t.hud.glossary)
            .attr('aria-label', t.hud.glossary)
            .class(
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
            )
            .children(
              icon(
                h,
                BookOpen,
                css({
                  width: '18px',
                  height: '18px',
                }),
              ),
            )
        : null,
      ...(easyMode(model)
        ? [
            divider(h),
            toolButton(
              h,
              clockPaused(model) ? t.hud.resumeSpace : t.hud.pauseSpace,
              clockPaused(model) ? Play : Pause,
              Message.PauseToggled(),
              clockPaused(model),
            ),
            h.button
              .key('speed')
              .attr('type', 'button')
              .attr('title', t.hud.speedS)
              .attr('aria-label', t.hud.speedS)
              .on('click', () => Message.SpeedCycled())
              .class(
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
              )
              .children(`${model.board.clock.speed}×`),
          ]
        : []),
      desktopOnly(h, [
        divider(h),
        toolButton(h, t.hud.tidyByRoleShiftT, LayoutGrid, Message.BoardTidied(), false),
        toolButton(h, t.hud.fitTheBoardShiftF, Scan, Message.BoardFitted(), false),
        toolButton(h, t.hud.fullscreenF, Expand, Message.FullscreenToggled(), false),
        toolButton(h, t.hud.screenshotS, Camera, Message.ScreenshotToggled(), false),
      ]),
      h.div
        .class(
          css({
            display: 'none',
            _compact: {
              display: 'block',
            },
          }),
        )
        .children(toolButton(h, t.hud.fitTheBoardShiftF, Scan, Message.BoardFitted(), false)),
      moreButton(h, model),
    )
}

export const screenshotExit = (h: H<Message>): Content => {
  const t = copy(h)
  return h.button
    .key('screenshot-exit')
    .attr('type', 'button')
    .attr('title', t.hud.exitScreenshot)
    .attr('aria-label', t.hud.exitScreenshot)
    .on('click', () => Message.ScreenshotToggled())
    .class(
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
    )
    .children(
      icon(
        h,
        CameraOff,
        css({
          width: '4',
          height: '4',
        }),
      ),
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

const undoButton = (h: H<Message>, danger: boolean): Content => {
  const t = copy(h)
  return button(
    h,
    {
      onClick: Message.UndoChosen(),
      variant: danger ? 'destructive' : 'outline',
      size: 'icon-sm',
      key: 'undo',
      className: cx(
        css({
          pointerEvents: 'auto',
          marginLeft: '1',
        }),
        'enter-badge',
      ),
      attributes: { 'data-exit': 'notice', title: t.hud.undoZ, 'aria-label': t.hud.undo },
    },
    icon(
      h,
      Undo2,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
  )
}

const signed = (value: number, digits: number): string =>
  `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}`

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

export const changeBar = (h: H<Message>, model: Model, className: string): View.Input<Message> => {
  const t = copy(h)

  const undo = undoAvailable(model.board)
  const change = model.board.change
  if (change._tag === 'Idle') return undefined
  const delta = change._tag === 'Settled' || change._tag === 'Lasting' ? change.delta : null
  const body =
    change._tag === 'Settling'
      ? h.span
          .key('settling')
          .attr('data-exit', 'notice')
          .class(
            cx(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
                whiteSpace: 'nowrap',
              }),
              'swap',
            ),
          )
          .children(
            ring(
              h,
              settleProgress(model.board),
              css({
                width: '3.5',
                height: '3.5',
                flexShrink: '0',
                color: 'mutedForeground',
              }),
            ),
            h.span
              .class(
                css({
                  color: 'mutedForeground',
                }),
              )
              .children(
                change.change.count > 1 ? t.hud.changes(change.change.count) : change.change.label,
              ),
          )
      : h.span
          .key(`delta-${delta?.id}`)
          .attr('data-exit', 'notice')
          .class(
            cx(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
                whiteSpace: 'nowrap',
              }),
              'swap',
            ),
          )
          .children(
            h.span
              .class(
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
              )
              .children(),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11-5',
                  }),
                ),
              )
              .children(delta ? deltaText(t, delta, has(model.board.game, 'percentiles')) : ''),
            change._tag === 'Settled' && change.ticks > 0
              ? h.span
                  .key('stable')
                  .class(
                    cx(
                      css({
                        fontSize: 'type.11-5',
                        fontWeight: 'medium',
                        color: 'ok',
                      }),
                      'enter-badge',
                    ),
                  )
                  .children(t.hud.stable)
              : null,
          )
  return h.div
    .key('change')
    .attr('data-morph', 'notice')
    .attr('data-exit', 'notice')
    .class(cx(pill, className))
    .children(body, undo ? undoButton(h, false) : null)
}

export const regionTabs = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const game = model.board.game
  const open = openRegions(game)
  if (open.length < 2 && !(has(game, 'multi-region') && regional(game))) return undefined
  const tabs = REGIONS.map((region) => {
    const isOpen = open.includes(region)
    const info = localized(REGION_INFO[region], t.catalog.regionInfo[region])
    return h.button
      .key(region)
      .attr('type', 'button')
      .attr(
        'title',
        isOpen
          ? info.name
          : t.hud.open(
              info.name,
              money(game.sandbox ? 0 : OPEN_REGION_PRICE * eraOf(game).costIndex),
            ),
      )
      .attr('aria-pressed', model.board.region === region ? 'true' : 'false')
      .on('click', () =>
        isOpen ? Message.RegionPicked({ region }) : Message.RegionOpened({ region }),
      )
      .class(
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
      )
      .children(
        isOpen ? info.short : `+ ${info.short}`,
        tabDrift(game, region) > 0
          ? h.span
              .key('drift')
              .class(
                css({
                  marginLeft: '1',
                  display: 'inline-block',
                  width: '1.5',
                  height: '1.5',
                  borderRadius: 'full',
                  backgroundColor: 'warn',
                  verticalAlign: 'middle',
                }),
              )
              .children()
          : null,
      )
  })
  return h.nav
    .key('regions')
    .attr('aria-label', t.hud.regions)
    .class(
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
    )
    .children(
      ...tabs,
      ...(has(game, 'infra-as-code')
        ? [
            h.button
              .key('mirror')
              .attr('type', 'button')
              .attr('aria-pressed', model.panel === 'mirror' ? 'true' : 'false')
              .on('click', () =>
                Message.PanelOpened({ panel: model.panel === 'mirror' ? 'none' : 'mirror' }),
              )
              .class(
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
              )
              .children(t.hud.mirror),
          ]
        : []),
    )
}
