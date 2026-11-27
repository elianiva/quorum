import type { View } from '@effect/ui'
import { Mount } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option, Queue, Stream } from 'effect'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Lock,
  Pause,
  TriangleAlert,
  X,
  Zap,
  type IconNode,
} from 'lucide'
import {
  GLOSSARY,
  COMPONENTS,
  LEVER_REFUND,
  MAX_LEVER_STEP,
  MAX_STUDIES,
  RESEARCH,
  isLeverKind,
  leverDh,
  leverGrowthTotal,
  researchList,
  type InsightPool,
  type LeverKind,
  type ResearchDef,
  type ResearchId,
  type ResearchTrack,
} from '@quorum/simulation/catalog'
import { mixOf } from '@quorum/simulation/features'
import { unsampledOf, type Ledger } from '@quorum/simulation/ledger'
import { has, missingPrerequisites, needs, researchReady } from '@quorum/simulation/lookups'
import type { Game, TeamKind } from '@quorum/simulation/state'
import {
  boostOf,
  capOf,
  limitingPool,
  studySeconds,
  studySpeed,
  studyStall,
  progressOf as studyProgressOf,
  type StudyStall,
} from '@quorum/simulation/studies'
import { currentStudy, studyList } from '@quorum/simulation/study-machine'
import { BY_RESEARCH } from '@quorum/simulation/term-links'
import { leverRefusal, leverRemoveRefusal } from '@quorum/simulation/work'
import { glossaryUrl } from '@/platform/analytics.ts'
import { compact, sharePercent } from '@quorum/ui/game/format'
import { POOL_ICONS, POOL_ORDER, poolColor, recipeOf } from '@quorum/ui/game/pools'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import {
  EYEBROW,
  EYEBROW_STYLE,
  FIGURE,
  FLOAT,
  PANEL,
  SCROLL,
  toneText,
  type Tone,
} from '@quorum/ui/game/bits'
import { STACK_LOGOS } from '@quorum/ui/game/icons'
import { LOOKS, TRACK_ICONS, colorOf } from '@quorum/ui/game/research-marks'
import {
  eraName,
  nodeSize,
  researchLayout,
  type Layout,
  type Placed,
} from '@quorum/ui/game/research-layouts'
import { Message } from '../../game/message.ts'
import { ledgerOf, type Model } from '../../game/model.ts'
import {
  ResearchMessage,
  SHEET_DEFAULT_WIDTH_PX,
  SHEET_MAX_WIDTH_PX,
  SHEET_MIN_WIDTH_PX,
  STUDY_QUEUE,
  queueIndex,
  speedFactorOf,
} from '../../game/research.ts'
import { stallNeedIn, stallReasonIn } from '../../i18n/format.ts'
import { copy, insightName, localeOf, localized, type Messages } from '../../i18n/messages.ts'
import { refusalIn } from '../../i18n/refusal.ts'
import { badge, type BadgeVariant } from '../ui/badge.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import { groupBadge } from './inspector/shared.ts'

/* The view content and children these helpers pass around. */
type Content = View.Content<Message>
type Child = View.Input<Message>
type Label = View.Content<Message> | string | false | null | undefined

/* The button `@quorum/ui/primitives/button` drew, hand-written for Effect UI
   the same way Hud.ts writes it. */
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

/* The meter `@quorum/ui/game/bits` drew, hand-written for Effect UI. */
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

/* The Insight cost chip `@quorum/ui/game/bits` drew, hand-written for Effect UI. */
const insightChip = (
  h: H<Message>,
  pool: InsightPool,
  figure: string,
  grey: boolean,
  tone: Tone,
  name: string,
): Content =>
  h.span
    .attr('title', `${name} ${figure}`)
    .attr('aria-label', `${name} ${figure}`)
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.75',
          whiteSpace: 'nowrap',
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
        .style({ color: grey ? 'var(--muted-foreground)' : poolColor(pool) })
        .children(
          icon(
            h,
            POOL_ICONS[pool],
            css({
              width: '3',
              height: '3',
              flexShrink: '0',
            }),
          ),
        ),
      h.span
        .attr('aria-hidden', 'true')
        .class(
          grey
            ? css({
                color: 'mutedForeground',
              })
            : tone === 'plain'
              ? ''
              : toneText(tone),
        )
        .children(figure),
    )

/* The research mark `@quorum/ui/game/research-marks` drew, hand-written for
   Effect UI on the ported group badge. */
const researchMark = (
  entry: ResearchDef,
  size: 'sm' | 'lg',
  muted: boolean,
  h: H<Message>,
): Content => {
  const look = LOOKS[entry.id]
  const mark =
    'component' in look
      ? groupBadge(
          COMPONENTS[look.component].group,
          COMPONENT_ICONS[look.component],
          size === 'lg'
            ? css({
                width: '11',
                height: '11',
              })
            : css({
                width: '7',
                height: '7',
              }),
          h,
          muted,
        )
      : groupBadge(
          look.group,
          'glyph' in look
            ? look.glyph
            : { path: 'logo' in look ? STACK_LOGOS[look.logo].path : look.brand.path },
          size === 'lg'
            ? css({
                width: '11',
                height: '11',
              })
            : css({
                width: '7',
                height: '7',
              }),
          h,
          muted,
          colorOf(look),
        )
  return h.span
    .class(
      cx(
        css({
          display: 'grid',
          flexShrink: '0',
          placeItems: 'center',
        }),
        size === 'lg'
          ? css({
              width: '12',
              height: '12',
            })
          : css({
              width: '8',
              height: '8',
            }),
      ),
    )
    .children(mark)
}

const followUps = (id: ResearchId): ReadonlyArray<ResearchDef> =>
  researchList.filter((entry) => entry.requires.includes(id))

type State = 'owned' | 'buy' | 'saving' | 'locked'

const stateOf = (game: Game, entry: ResearchDef): State =>
  has(game, entry.id)
    ? 'owned'
    : studyList(game.studies).some((item) => item.id === entry.id)
      ? 'saving'
      : !researchReady(game, entry.id)
        ? 'locked'
        : 'buy'

const focusOf = (model: Model): ResearchDef => {
  const game = model.board.game
  if (model.board.research.focus) return RESEARCH[model.board.research.focus]
  const action = game.openActions.find((id) => !has(game, id))
  if (action) return RESEARCH[action]
  const ready = researchList
    .filter((entry) => researchReady(game, entry.id) && !has(game, entry.id))
    .toSorted((a, b) => a.cost - b.cost)
  return ready[0] ?? researchList[0] ?? RESEARCH.stripe
}

const NODE_CLASS: Record<State, string> = {
  owned: css({
    backgroundColor: 'nested',
    boxShadow: 'line',
  }),
  buy: css({ layerStyle: 'raised', boxShadow: 'raised', _hover: { filter: 'brightness(0.985)' } }),
  saving: css({
    layerStyle: 'raised',
    boxShadow: 'raised',
    _hover: { filter: 'brightness(0.985)' },
  }),
  locked: css({
    borderWidth: '1px',
    borderStyle: 'dashed',
    borderColor: 'border',
    backgroundColor: 'canvas',
    _hover: { backgroundColor: 'color-mix(in oklab, var(--foreground) 3%, transparent)' },
  }),
}

const price = (entry: ResearchDef, state: State, grey: boolean, h: H<Message>): Content => {
  const t = copy(h)
  return state === 'owned'
    ? h.span
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '1',
            fontSize: 'type.11',
            color: 'ok',
          }),
        )
        .children(
          icon(
            h,
            Check,
            css({
              width: '3',
              height: '3',
            }),
          ),
          t.research.researched,
        )
    : h.span
        .class(
          cx(
            css({
              display: 'flex',
              width: 'fit-content',
              alignItems: 'center',
              gap: '2',
              fontSize: 'type.11',
            }),
            grey
              ? css({
                  color: 'mutedForeground',
                })
              : '',
          ),
        )
        .children(
          state === 'locked'
            ? icon(
                h,
                Lock,
                css({
                  width: '2.5',
                  height: '2.5',
                }),
              )
            : undefined,
          ...recipeOf(entry.id).map(([pool, cost]) =>
            insightChip(h, pool, compact(cost), grey, 'plain', insightName(t, pool)),
          ),
        )
}

const duration = (t: Messages, game: Game, ledger: Ledger, entry: ResearchDef): string => {
  const seconds = studySeconds(entry.id) / studySpeed(game, ledger, entry.id)
  return seconds < 90 ? t.units.s(Math.round(seconds)) : t.units.min(Math.round(seconds / 60))
}

const pausedEffect = (t: Messages, kind: TeamKind): string | null => {
  switch (kind) {
    case 'sre':
      return t.team.pagerOff
    case 'data':
      return t.team.dataOff
    case 'platform':
      return t.team.platformOff
    case 'security':
      return t.team.securityOff
    default:
      return null
  }
}

const stepMeter = (step: number, h: H<Message>): Content =>
  h.span
    .class(
      css({
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.75',
      }),
    )
    .attr('aria-hidden', 'true')
    .attr('title', `${step} of ${MAX_LEVER_STEP}`)
    .children(
      ...Array.from({ length: MAX_LEVER_STEP }, (_, index) =>
        h.span
          .key(String(index))
          .class(
            cx(
              css({
                height: '1.5',
                width: '3',
                borderRadius: 'full',
              }),
              index < step
                ? css({
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 70%, transparent)',
                  })
                : css({
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                  }),
            ),
          )
          .children(),
      ),
    )

const leverRow = (
  game: Game,
  ledger: Ledger,
  pool: InsightPool,
  draw: number,
  blocked: boolean,
  h: H<Message>,
): Child => {
  if (game.fixedMix || !isLeverKind(pool)) return undefined
  const t = copy(h)
  const kind = pool as LeverKind
  const step = game.levers[kind] ?? 0
  const share = mixOf(game)[kind] ?? 0
  const next = step + 1
  const last = step >= MAX_LEVER_STEP
  const buildRefusal = leverRefusal(game, kind)
  const removeRefusal = leverRemoveRefusal(game, kind)
  if (!blocked && step <= 0 && buildRefusal !== null) return undefined
  const nextShare = last
    ? share
    : (mixOf({ ...game, levers: { ...game.levers, [kind]: next } })[kind] ?? 0)
  const growth = Math.round((1 - leverGrowthTotal(step)) * 100)
  const nextGrowth = Math.round((1 - leverGrowthTotal(next)) * 100)
  const name = t.catalog.pools[kind].label
  const title = blocked
    ? t.levers.titleLow(name)
    : step <= 0
      ? t.levers.titleRaise(name)
      : t.levers.titleFaster(name)
  const reason = blocked
    ? t.levers.low(name, compact(ledger.insight[pool]), compact(draw))
    : step <= 0
      ? t.levers.raise(name)
      : t.levers.faster(name, sharePercent(share))
  const buildable = !last && buildRefusal === null
  const note = last
    ? t.levers.cost(growth)
    : buildRefusal !== null
      ? refusalIn(t, buildRefusal)
      : t.levers.reaches(sharePercent(nextShare), nextGrowth)
  return h.div
    .key(`${pool}-lever`)
    .class(
      css({
        marginBlock: '1.5',
        borderRadius: 'lg',
        backgroundColor: 'well',
        paddingInline: '2.5',
        paddingBlock: '2',
        boxShadow: 'well',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2',
          }),
        )
        .children(
          h.p
            .class(
              cx(
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                  fontSize: 'type.12-5',
                  lineHeight: 'snug',
                  fontWeight: 'semibold',
                }),
                blocked
                  ? css({
                      color: 'warn',
                    })
                  : css({
                      color: 'foreground',
                    }),
              ),
            )
            .children(title),
          h.div
            .class(
              css({
                display: 'flex',
                flexShrink: '0',
                alignItems: 'center',
                gap: '1.5',
                whiteSpace: 'nowrap',
              }),
            )
            .children(
              stepMeter(step, h),
              h.span
                .class(
                  css({
                    fontSize: 'type.10-5',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.levers.count(step, MAX_LEVER_STEP)),
            ),
        ),
      h.p
        .class(
          css({
            marginTop: '1.5',
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
          }),
        )
        .children(reason),
      h.p
        .class(
          cx(
            css({
              marginTop: '1',
              fontSize: 'type.11',
              lineHeight: 'snug',
            }),
            buildable || last
              ? css({
                  color: 'mutedForeground',
                })
              : css({
                  color: 'warn',
                }),
          ),
        )
        .children(note),
      h.div
        .class(
          css({
            marginTop: '2',
            display: 'flex',
            alignItems: 'center',
            gap: '1.5',
          }),
        )
        .children(
          last
            ? undefined
            : button(
                h,
                {
                  onClick: Message.ResearchChanged({
                    message: ResearchMessage.LeverBuilt({ kind }),
                  }),
                  isDisabled: buildRefusal !== null,
                  size: 'sm',
                  variant: 'outline',
                  className: css({
                    minWidth: '0',
                    flex: '1 1 0%',
                    fontSize: 'type.12',
                  }),
                  attributes: {
                    title:
                      buildRefusal === null
                        ? t.levers.buildStep(next, compact(leverDh(next)))
                        : refusalIn(t, buildRefusal),
                  },
                },
                game.sandbox
                  ? t.levers.setStep(next)
                  : t.levers.buildStep(next, compact(leverDh(next))),
              ),
          step <= 0
            ? undefined
            : button(
                h,
                {
                  onClick: Message.ResearchChanged({
                    message: ResearchMessage.LeverRemoved({ kind }),
                  }),
                  isDisabled: removeRefusal !== null,
                  size: 'sm',
                  variant: 'ghost',
                  className: css({
                    flexShrink: '0',
                    color: 'mutedForeground',
                  }),
                  attributes: {
                    'aria-label': t.levers.takeOff,
                    title:
                      removeRefusal === null
                        ? t.levers.remove(compact(leverDh(step) * LEVER_REFUND))
                        : refusalIn(t, removeRefusal),
                  },
                },
                t.levers.removeStep,
              ),
        ),
    )
}

const costRows = (game: Game, ledger: Ledger, entry: ResearchDef, h: H<Message>): Content => {
  const t = copy(h)

  const running = currentStudy(game.studies)?.id === entry.id
  const limit = running ? limitingPool(game) : null
  const stalled = running ? studyStall(game, ledger, entry.id) : null
  const speed = stalled ? 1 : studySpeed(game, ledger, entry.id)
  return h.section
    .key('cost')
    .class(
      css({
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderColor: 'hairline',
        paddingInline: '5',
        paddingBlock: '4',
        '&:last-child': {
          borderBottomWidth: '0px',
        },
      }),
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
          h.span.class(EYEBROW).children(t.research.costLabel),
          h.span
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '0.5',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    fontSize: 'type.11-5',
                    color: 'mutedForeground',
                  }),
                )
                .children(duration(t, game, ledger, entry)),
              speed > 1
                ? h.span
                    .class(
                      css({
                        fontSize: 'type.10-5',
                        color: 'ok',
                      }),
                    )
                    .attr('title', t.research.studySpeedTitle)
                    .children(t.research.speed(speedFactorOf(speed)))
                : undefined,
            ),
        ),
      h.div
        .class(
          cx(
            FIGURE,
            css({
              marginTop: '2',
              display: 'flex',
              flexDirection: 'column',
              '& > :not(:last-child)': {
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderColor: 'hairline',
              },
            }),
          ),
        )
        .children(
          ...recipeOf(entry.id, game.discounts).flatMap(([pool, cost]) => [
            h.div
              .key(pool)
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  paddingBlock: '1.5',
                  fontSize: 'type.12',
                }),
              )
              .children(
                insightChip(h, pool, compact(cost), false, 'plain', insightName(t, pool)),
                h.span
                  .class(
                    cx(
                      css({
                        marginLeft: 'auto',
                      }),
                      game.pools[pool] < cost
                        ? css({
                            color: 'warn',
                          })
                        : css({
                            color: 'mutedForeground',
                          }),
                    ),
                  )
                  .children(t.research.held(compact(game.pools[pool]))),
                h.span
                  .class(
                    cx(
                      css({
                        width: '60px',
                        textAlign: 'right',
                      }),
                      ledger.insight[pool] > 0
                        ? css({
                            color: 'ok',
                          })
                        : css({
                            color: 'warn',
                          }),
                      pool === limit
                        ? css({
                            fontWeight: 'semibold',
                          })
                        : '',
                    ),
                  )
                  .children(t.research.s(ledger.insight[pool].toFixed(1))),
              ),
            leverRow(
              game,
              ledger,
              pool,
              cost / (studySeconds(entry.id) / studySpeed(game, ledger, entry.id)),
              pool === limit,
              h,
            ),
          ]),
        ),
    )
}

const gapOf = (
  t: Messages,
  stall: StudyStall,
): Readonly<{ share: number; label: string }> | null => {
  switch (stall._tag) {
    case 'Shape': {
      if (stall.shape === 'replica')
        return { share: stall.current, label: t.research.gapReplica(stall.current) }
      if (stall.shape === 'connections')
        return {
          share: stall.value > 0 ? stall.current / (stall.value + 1) : 0,
          label: t.research.gapConnections(stall.current, stall.value),
        }
      const share = stall.value > 0 ? stall.current / stall.value : 0
      return {
        share,
        label:
          stall.shape === 'backlog'
            ? t.research.gapSeconds(stall.current, stall.value)
            : t.research.gapShare(stall.current, stall.value),
      }
    }
    case 'Breadth':
      return {
        share: stall.target > 0 ? stall.current / stall.target : 0,
        label:
          stall.unit === 'regions'
            ? t.research.gapRegions(stall.current, stall.target)
            : t.research.gapComponents(stall.current, stall.target),
      }
    case 'Pool':
      return null
  }
}

const requirement = (
  t: Messages,
  stall: StudyStall,
  first: string | null,
  consequence: string | null,
  h: H<Message>,
): Content => {
  const gap = gapOf(t, stall)
  return h.section
    .class(
      css({
        flexShrink: '0',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderColor: 'hairline',
        backgroundColor: 'warnSoft',
        paddingInline: '5',
        paddingBlock: '4',
      }),
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
                fontFamily: 'mono',
                fontSize: 'type.10-5',
                fontWeight: 'medium',
                letterSpacing: 'eyebrow',
                color: 'warn',
                textTransform: 'uppercase',
              }),
            )
            .children(t.research.requirement),
          gap === null
            ? undefined
            : h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.11-5',
                      fontWeight: 'semibold',
                      color: 'warn',
                    }),
                  ),
                )
                .children(gap.label),
        ),
      h.p
        .class(
          css({
            marginTop: '1.5',
            fontSize: 'type.12-5',
            lineHeight: 'snug',
            fontWeight: 'semibold',
            color: 'warn',
          }),
        )
        .children(
          first === null
            ? t.research.cannotRun(stallNeedIn(t, stall))
            : t.research.firstCannotRun(first, stallNeedIn(t, stall)),
        ),
      gap === null
        ? undefined
        : h.div
            .class(
              css({
                marginTop: '2.5',
              }),
            )
            .children(meter(h, gap.share, css({ backgroundColor: 'warn' }))),
      consequence === null
        ? undefined
        : h.p
            .class(
              css({
                marginTop: '2',
                fontSize: 'type.11-5',
                lineHeight: 'snug',
                color: 'warn',
                opacity: 0.8,
              }),
            )
            .children(consequence),
    )
}

const fullNotice = (max: number, t: Messages, h: H<Message>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        alignItems: 'flex-start',
        gap: '2',
        marginInline: '5',
        marginTop: '3',
        borderRadius: 'lg',
        backgroundColor: 'warnSoft',
        paddingInline: '2.5',
        paddingBlock: '2',
        fontSize: 'type.11-5',
        fontWeight: 'medium',
        lineHeight: 'snug',
        color: 'warn',
      }),
    )
    .children(
      icon(
        h,
        TriangleAlert,
        css({
          marginTop: '0.5',
          width: '3.5',
          height: '3.5',
          flexShrink: '0',
        }),
      ),
      h.span.children(t.research.queueFullHelp(max)),
    )

const linkSection = (
  label: string,
  entries: ReadonlyArray<ResearchDef>,
  game: Game,
  h: H<Message>,
): Child =>
  entries.length === 0
    ? undefined
    : h.section
        .class(
          css({
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'hairline',
            paddingInline: '5',
            paddingBlock: '4',
            '&:last-child': {
              borderBottomWidth: '0px',
            },
          }),
        )
        .children(
          h.span.class(EYEBROW).children(label),
          h.div
            .class(
              css({
                marginInline: '-0.5rem',
                marginTop: '2',
                display: 'flex',
                flexDirection: 'column',
              }),
            )
            .children(entries.map((entry) => linkRow(game, entry, h))),
        )

const face = (
  open: boolean,
  entry: ResearchDef,
  state: State,
  grey: boolean,
  large: boolean,
  far: boolean,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)

  return [
    researchMark(entry, 'sm', grey, h),
    h.span
      .class(
        css({
          display: 'flex',
          minWidth: '0',
          flex: '1 1 0%',
          flexDirection: 'column',
          gap: '1',
        }),
      )
      .children(
        h.span
          .class(
            cx(
              css({
                display: 'flex',
                alignItems: 'flex-start',
                gap: '1',
                fontSize: 'type.12-5',
                lineHeight: 'tight',
                fontWeight: 'semibold',
              }),
              grey
                ? css({
                    color: 'mutedForeground',
                  })
                : '',
            ),
          )
          .children(
            h.span
              .class(
                cx(
                  css({
                    wordBreak: 'auto-phrase',
                  }),
                  far
                    ? css({
                        lineClamp: 1,
                      })
                    : css({
                        lineClamp: 2,
                      }),
                ),
              )
              .children(t.catalog.research[entry.id].name),
            open
              ? icon(
                  h,
                  TriangleAlert,
                  css({
                    width: '3',
                    height: '3',
                    flexShrink: '0',
                    color: 'warn',
                  }),
                )
              : undefined,
          ),
        far
          ? h.span
              .class(
                css({
                  lineClamp: 1,
                  fontSize: 'type.10-5',
                  lineHeight: 'snug',
                  color: 'mutedForeground',
                }),
              )
              .children(t.catalog.research[entry.id].blurb)
          : price(entry, state, grey, h),
      ),
  ]
}

const card = (
  open: boolean,
  share: number,
  entry: ResearchDef,
  state: State,
  large: boolean,
  far: boolean,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const color = colorOf(LOOKS[entry.id])
  return state === 'saving'
    ? [
        ...face(open, entry, state, true, large, far, h),
        h.span
          .key('fill')
          .attr('aria-hidden', 'true')
          .class(
            css({
              position: 'absolute',
              inset: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '2.5',
              paddingInline: '2.5',
              paddingBlock: '1',
              transitionProperty: 'clip-path',
              transitionDuration: 'slowest',
              transitionTimingFunction: 'linear',
            }),
          )
          .style({
            background: `linear-gradient(to right, color-mix(in oklab, ${color} 8%, var(--raised-top)), color-mix(in oklab, ${color} 22%, var(--raised-top)))`,
            clipPath: `inset(0 ${(1 - share) * 100}% 0 0)`,
          })
          .children(face(open, entry, state, false, large, far, h)),
        h.span
          .key('edge')
          .attr('aria-hidden', 'true')
          .class(
            css({
              position: 'absolute',
              insetBlock: '0',
              width: '1.5px',
              transitionProperty: 'left',
              transitionDuration: 'slowest',
              transitionTimingFunction: 'linear',
            }),
          )
          .style({ left: `${share * 100}%`, background: color, opacity: '0.55' })
          .children(),
      ]
    : face(open, entry, state, state === 'locked', large, far, h)
}

const scaleOf = (model: Model): number => (model.prefs.text === 'large' ? 1.5 : 1)

type LazyView = Readonly<{ args: ReadonlyArray<unknown>; view: Content }>

/* The keyed lazy memo Dashboard.ts uses for views rebuilt from the same args. */
const keyedLazy = (): (<A extends ReadonlyArray<unknown>>(
  key: string,
  view: (...args: A) => Content,
  args: A,
) => Content) => {
  const kept = new Map<string, LazyView>()
  return (key, view, args) => {
    const last = kept.get(key)
    if (
      last !== undefined &&
      last.args.length === args.length &&
      last.args.every((value, index) => value === args[index])
    )
      return last.view
    const built = view(...args)
    kept.set(key, { args, view: built })
    return built
  }
}

const lazyNode = keyedLazy()

const node = (model: Model, place: Placed, focused: boolean, h: H<Message>): Content => {
  const game = model.board.game
  const { entry } = place
  const state = stateOf(game, entry)
  const large = model.prefs.text === 'large'
  return lazyNode(entry.id, nodeView, [
    entry,
    place.x,
    place.y,
    state,
    large,
    entry.era > game.stage + 1 && state === 'locked',
    focused,
    state !== 'owned' && game.openActions.includes(entry.id),
    state === 'saving'
      ? Math.min(1, studyProgressOf(studyList(game.studies).find((item) => item.id === entry.id)))
      : 0,
    h,
  ])
}

const nodeView = (
  entry: ResearchDef,
  x: number,
  y: number,
  state: State,
  large: boolean,
  far: boolean,
  focused: boolean,
  open: boolean,
  share: number,
  h: H<Message>,
): Content => {
  const size = nodeSize(large ? 1.5 : 1)
  const style = { left: `${x}px`, top: `${y}px`, width: `${size.w}px`, height: `${size.h}px` }
  const shape = cx(
    css({
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      gap: '2.5',
      overflow: 'hidden',
      borderRadius: 'xl',
      paddingInline: '2.5',
      paddingBlock: '1',
      textAlign: 'left',
      transitionProperty: 'filter,box-shadow,outline-color,opacity',
      transitionDuration: 'fast',
      transitionTimingFunction: 'out',
    }),
    NODE_CLASS[state],
    focused
      ? css({
          outlineWidth: '2px',
          outlineStyle: 'solid',
          outlineOffset: '0.5',
          outlineColor: 'primaryStrong',
        })
      : css({
          outlineWidth: '2px',
          outlineStyle: 'solid',
          outlineOffset: '0.5',
          outlineColor: 'transparent',
        }),
    far
      ? css({
          opacity: 0.45,
        })
      : '',
  )
  const body = card(open, share, entry, state, large, far, h)
  return far
    ? h.div
        .key(entry.id)
        .attr('data-research', entry.id)
        .attr('aria-disabled', 'true')
        .style(style)
        .class(shape)
        .children(body)
    : h.button
        .key(entry.id)
        .attr('type', 'button')
        .attr('data-research', entry.id)
        .attr('aria-pressed', focused ? 'true' : 'false')
        .on('click', () =>
          Message.ResearchChanged({ message: ResearchMessage.Focused({ id: entry.id }) }),
        )
        .on('dblclick', () =>
          Message.ResearchChanged({ message: ResearchMessage.Bought({ id: entry.id }) }),
        )
        .style(style)
        .class(shape)
        .children(body)
}

const wires = (model: Model, layout: Layout, focus: ResearchDef, h: H<Message>): Content =>
  h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .class(
      css({
        pointerEvents: 'none',
        position: 'absolute',
        inset: '0',
        overflow: 'visible',
      }),
    )
    .attr('width', String(layout.width))
    .attr('height', String(layout.height))
    .attr('fill', 'none')
    .children(
      ...layout.wires.map((wire) => {
        const done = wire.from
          ? has(model.board.game, wire.from)
          : wire.to
            ? has(model.board.game, wire.to)
            : false
        const lit = focus.id === wire.to || focus.id === wire.from
        return h.path
          .key(wire.key)
          .attr('d', wire.d)
          .attr('stroke-width', lit ? '2.25' : wire.root ? '2' : '1.5')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .class(
            cx(
              lit
                ? css({
                    stroke: 'primaryStrong',
                  })
                : done
                  ? css({
                      stroke: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                    })
                  : wire.root
                    ? css({
                        stroke: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                      })
                    : css({
                        stroke: 'color-mix(in oklab, var(--foreground) 20%, transparent)',
                      }),
              css({
                transitionProperty: 'stroke',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
              }),
            ),
          )
          .attr('stroke-dasharray', done || wire.root ? undefined : '3 4')
          .children()
      }),
    )

const progressOf = (game: Game, track: ResearchTrack) => {
  const entries = researchList.filter((entry) => entry.track === track)
  return { owned: entries.filter((entry) => has(game, entry.id)).length, total: entries.length }
}

const progressBar = (
  game: Game,
  track: ResearchTrack,
  className: string,
  h: H<Message>,
): Content => {
  const { owned, total } = progressOf(game, track)
  return h.div
    .class(
      cx(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
        }),
        className,
      ),
    )
    .children(
      h.span
        .class(
          css({
            height: '1',
            flex: '1 1 0%',
            overflow: 'hidden',
            borderRadius: 'full',
            backgroundColor: 'well',
            boxShadow: 'well',
          }),
        )
        .children(
          h.span
            .class(
              css({
                display: 'block',
                height: '100%',
                borderRadius: 'full',
                backgroundColor: 'ok',
              }),
            )
            .style({ width: `${(owned / total) * 100}%` })
            .children(),
        ),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.10-5',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(`${owned}/${total}`),
    )
}

const eraLabel = (game: Game, era: number, h: H<Message>): ReadonlyArray<Child> => [
  era > game.stage
    ? icon(
        h,
        Lock,
        css({
          width: '3',
          height: '3',
        }),
      )
    : undefined,
  copy(h).catalog.eras[era]?.name ?? eraName(era),
  era === game.stage
    ? h.span
        .class(
          css({
            width: '1.5',
            height: '1.5',
            borderRadius: 'full',
            backgroundColor: 'ok',
          }),
        )
        .children()
    : undefined,
]

const backdrop = (model: Model, layout: Layout, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const game = model.board.game
  const bands = layout.bands.map((band) =>
    h.div
      .key(`era-${band.era}`)
      .class(
        cx(
          css({
            position: 'absolute',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'hairline',
          }),
          band.era === game.stage
            ? css({
                backgroundColor: 'color-mix(in oklab, var(--ok) 3.5000000000000004%, transparent)',
              })
            : band.era > game.stage + 1
              ? css({
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 4%, transparent)',
                })
              : band.era > game.stage
                ? css({
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 2%, transparent)',
                  })
                : '',
        ),
      )
      .style({
        left: `${band.x}px`,
        top: `${band.y}px`,
        width: `${band.w}px`,
        height: `${band.h}px`,
      })
      .children(
        h.span
          .class(
            css(
              EYEBROW_STYLE,
              {
                position: 'absolute',
                top: '3',
                left: '5',
                display: 'flex',
                alignItems: 'center',
                gap: '1.5',
              },
              band.era === game.stage && {
                color: 'foreground',
              },
            ),
          )
          .children(...eraLabel(game, band.era, h)),
      ),
  )
  const roots = layout.tracks.map((track) =>
    h.div
      .key(`root-${track.track}`)
      .class(
        css({
          position: 'absolute',
          display: 'flex',
          width: '180px',
          translate: '-50% -50%',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
        }),
      )
      .style({ left: `${track.x}px`, top: `${track.y}px` })
      .children(
        h.span
          .class(
            css({
              display: 'grid',
              width: '14',
              height: '14',
              placeItems: 'center',
              borderRadius: '2xl',
              backgroundColor: 'card',
              boxShadow: 'card',
            }),
          )
          .children(
            icon(
              h,
              TRACK_ICONS[track.track],
              css({
                width: '6',
                height: '6',
              }),
            ),
          ),
        h.span
          .class(
            css({
              fontSize: 'type.14',
              fontWeight: 'semibold',
            }),
          )
          .children(t.catalog.researchTracks[track.track].label),
        progressBar(game, track.track, css({ width: '28' }), h),
      ),
  )
  return [...bands, ...roots]
}

const scrollTo = (host: HTMLElement, target: Element, behavior: ScrollBehavior) => {
  const box = target.getBoundingClientRect()
  const view = host.getBoundingClientRect()
  if (
    box.left > view.left &&
    box.right < view.right &&
    box.top > view.top + 80 &&
    box.bottom < view.bottom - 80
  )
    return
  target.scrollIntoView({ block: 'center', inline: 'center', behavior })
}

const attachScroll = (host: HTMLElement): (() => void) => {
  const focused = host.querySelector('[aria-pressed="true"]')
  if (focused) scrollTo(host, focused, 'instant')
  const watch = new MutationObserver((changes) => {
    for (const change of changes)
      if ((change.target as Element).getAttribute('aria-pressed') === 'true')
        scrollTo(host, change.target as Element, 'smooth')
  })
  watch.observe(host, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] })
  const events = new AbortController()
  let start: { id: number; x: number; y: number; left: number; top: number } | null = null
  let dragged = false
  host.addEventListener(
    'pointerdown',
    (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      start = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: host.scrollLeft,
        top: host.scrollTop,
      }
      dragged = false
    },
    { signal: events.signal },
  )
  host.addEventListener(
    'pointermove',
    (event) => {
      if (!start || start.id !== event.pointerId) return
      if ((event.buttons & 1) === 0) {
        start = null
        host.classList.remove('cursor-grabbing', 'select-none')
        return
      }
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (!dragged && Math.hypot(dx, dy) < 5) return
      if (!dragged) {
        dragged = true
        host.setPointerCapture(event.pointerId)
        host.classList.add('cursor-grabbing', 'select-none')
      }
      event.preventDefault()
      host.scrollLeft = start.left - dx
      host.scrollTop = start.top - dy
    },
    { signal: events.signal },
  )
  const end = (event: PointerEvent) => {
    if (start?.id !== event.pointerId) return
    start = null
    host.classList.remove('cursor-grabbing', 'select-none')
  }
  host.addEventListener('pointerup', end, { signal: events.signal })
  host.addEventListener('pointercancel', end, { signal: events.signal })
  host.addEventListener(
    'click',
    (event) => {
      if (!dragged || event.detail === 0) return
      event.preventDefault()
      event.stopPropagation()
      dragged = false
    },
    { capture: true, signal: events.signal },
  )
  host.addEventListener('dragstart', (event) => event.preventDefault(), {
    signal: events.signal,
  })
  return () => {
    watch.disconnect()
    events.abort()
  }
}

const ResearchScroll = Mount.make('ResearchScroll', {}, (element: HTMLElement) =>
  Effect.scoped(
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => attachScroll(element)),
        (dispose) => Effect.sync(dispose),
      )
      return Message.Synced()
    }),
  ),
)

const linkRow = (game: Game, entry: ResearchDef, h: H<Message>): Content => {
  const t = copy(h)
  const far = entry.era > game.stage + 1 && !has(game, entry.id)
  const inner = [
    researchMark(entry, 'sm', stateOf(game, entry) === 'locked', h),
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
      .children(t.catalog.research[entry.id].name),
    has(game, entry.id)
      ? icon(
          h,
          Check,
          css({
            width: '3.5',
            height: '3.5',
            color: 'ok',
          }),
        )
      : icon(
          h,
          Lock,
          css({
            width: '3',
            height: '3',
            color: 'mutedForeground',
          }),
        ),
  ]
  return far
    ? h.div
        .key(entry.id)
        .attr('aria-disabled', 'true')
        .class(
          css({
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: '2.5',
            paddingInline: '2',
            paddingBlock: '1.5',
          }),
        )
        .children(inner)
    : h.button
        .key(entry.id)
        .attr('type', 'button')
        .on('click', () =>
          Message.ResearchChanged({ message: ResearchMessage.Focused({ id: entry.id }) }),
        )
        .class(
          css({
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            gap: '2.5',
            borderRadius: 'lg',
            paddingInline: '2',
            paddingBlock: '1.5',
            textAlign: 'left',
            fontSize: 'type.12-5',
            _hover: {
              backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
            },
          }),
        )
        .children(inner)
}

const terms = (entry: ResearchDef, h: H<Message>): Child => {
  const t = copy(h)

  const entries = (BY_RESEARCH[entry.id] ?? []).flatMap((id) =>
    GLOSSARY.filter((term) => term.id === id),
  )
  return entries.length > 0
    ? h.div
        .class(
          css({
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5',
          }),
        )
        .children(
          ...entries.map((term) =>
            h.a
              .key(term.id)
              .attr('href', glossaryUrl(term.id, localeOf(h)))
              .attr('target', '_blank')
              .attr('rel', 'noreferrer noopener')
              .attr('title', t.research.glossary(t.catalog.glossary[term.id]?.term ?? term.term))
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1',
                  borderRadius: 'md',
                  backgroundColor: 'nested',
                  paddingInline: '1.5',
                  paddingBlock: '0.5',
                  fontSize: 'type.11-5',
                  color: 'mutedForeground',
                  _hover: {
                    color: 'foreground',
                  },
                }),
              )
              .children(
                icon(
                  h,
                  CircleHelp,
                  css({
                    width: '3',
                    height: '3',
                    flexShrink: '0',
                  }),
                ),
                t.catalog.glossary[term.id]?.term ?? term.term,
              ),
          ),
        )
    : undefined
}

const queueSlide = (index: number, from: number, to: number): number => {
  if (index === from) return to - from
  const without = index > from ? index - 1 : index
  return (without < to ? without : without + 1) - index
}

const queueButton = (
  label: string,
  glyph: IconNode,
  message: Message,
  enabled: boolean,
  h: H<Message>,
): Content =>
  button(
    h,
    {
      onClick: message,
      isDisabled: !enabled,
      variant: 'ghost',
      size: 'icon-xs',
      className: css({
        color: 'mutedForeground',
      }),
      attributes: { 'aria-label': label, title: label },
    },
    icon(
      h,
      glyph,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
  )

/* The study queue's drag-and-drop state and messages. */
type DragModel = Model['board']['research']['drag']
type DragMessage = Parameters<typeof ResearchMessage.DragChanged>[0]['message']

const dragChanged = (message: DragMessage): Message =>
  Message.ResearchChanged({ message: ResearchMessage.DragChanged({ message }) })

const dragIsActive = (drag: DragModel): boolean =>
  drag.dragState._tag === 'Dragging' || drag.dragState._tag === 'KeyboardDragging'

const dragItemId = (drag: DragModel): Option.Option<string> => {
  const state = drag.dragState
  switch (state._tag) {
    case 'Pending':
    case 'Dragging':
    case 'KeyboardDragging':
      return Option.some(state.itemId)
    default:
      return Option.none()
  }
}

const dragDropTarget = (
  drag: DragModel,
): Option.Option<Readonly<{ containerId: string; index: number }>> => {
  const state = drag.dragState
  switch (state._tag) {
    case 'Dragging':
      return state.maybeDropTarget
    case 'KeyboardDragging':
      return Option.some({ containerId: state.targetContainerId, index: state.targetIndex })
    default:
      return Option.none()
  }
}

const dragGhostStyle = (drag: DragModel): Option.Option<Readonly<Record<string, string>>> => {
  const state = drag.dragState
  return state._tag === 'Dragging'
    ? Option.some({
        position: 'fixed',
        top: '0',
        left: '0',
        transform: `translate3d(${state.current.clientX}px, ${state.current.clientY}px, 0)`,
        'pointer-events': 'none',
        'z-index': '9999',
      })
    : Option.none()
}

const DRAG_BUTTON_LEFT = 0

const dropTargetAt = (
  clientX: number,
  clientY: number,
): Option.Option<Readonly<{ containerId: string; index: number }>> => {
  const container = document
    .elementsFromPoint(clientX, clientY)
    .find((element) => element.hasAttribute('data-droppable-id'))
  if (container === undefined) return Option.none()
  const containerId = container.getAttribute('data-droppable-id')
  if (!containerId) return Option.none()
  const sortable = [...container.querySelectorAll('[data-sortable-id]')]
  const found = sortable.findIndex((item) => {
    const rect = item.getBoundingClientRect()
    return clientY < rect.top + rect.height / 2
  })
  return Option.some({ containerId, index: found === -1 ? sortable.length : found })
}

/* The pointer and keyboard wiring for the sortable study queue. */
const attachDrag = (host: HTMLElement, offer: (message: DragMessage) => void): (() => void) => {
  const events = new AbortController()
  const containerId = host.getAttribute('data-droppable-id') ?? STUDY_QUEUE
  let pointer: number | null = null
  let keyboard = false
  let keyboardIndex = 0
  const handles = () => [...host.querySelectorAll<HTMLElement>('[data-sortable-id]')]
  const handleOf = (target: EventTarget | null): HTMLElement | null => {
    const element = target instanceof Element ? target : null
    const handle = element?.closest<HTMLElement>('[data-sortable-id]') ?? null
    return handle !== null && host.contains(handle) ? handle : null
  }
  const down = (event: PointerEvent) => {
    if (event.button !== DRAG_BUTTON_LEFT) return
    const handle = handleOf(event.target)
    if (handle === null) return
    const itemId = handle.dataset['sortableId']
    if (itemId === undefined) return
    pointer = event.pointerId
    offer({
      _tag: 'PressedDraggable',
      itemId,
      containerId,
      index: handles().indexOf(handle),
      screenX: event.clientX,
      screenY: event.clientY,
    })
  }
  const move = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    offer({
      _tag: 'MovedPointer',
      screenX: event.clientX,
      screenY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      maybeDropTarget: dropTargetAt(event.clientX, event.clientY),
    })
  }
  const up = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    pointer = null
    offer({ _tag: 'ReleasedPointer' })
  }
  const cancel = (event: PointerEvent) => {
    if (pointer === null || pointer !== event.pointerId) return
    pointer = null
    offer({ _tag: 'CancelledDrag' })
  }
  const key = (event: KeyboardEvent) => {
    if (keyboard) {
      if (event.key === 'Escape') {
        keyboard = false
        offer({ _tag: 'CancelledDrag' })
      } else if (event.key === 'Tab') {
        return
      } else if (event.key === ' ' || event.key === 'Enter') {
        keyboard = false
        offer({ _tag: 'ConfirmedKeyboardDrop' })
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        keyboardIndex =
          event.key === 'ArrowDown'
            ? Math.min(handles().length, keyboardIndex + 1)
            : Math.max(0, keyboardIndex - 1)
        offer({
          _tag: 'CompletedResolveKeyboardMove',
          targetContainerId: containerId,
          targetIndex: keyboardIndex,
        })
      }
      event.preventDefault()
      return
    }
    if (pointer !== null) {
      if (event.key !== 'Escape') return
      pointer = null
      offer({ _tag: 'CancelledDrag' })
      return
    }
    if (event.key !== ' ' && event.key !== 'Enter') return
    const handle = handleOf(event.target)
    if (handle === null) return
    const itemId = handle.dataset['sortableId']
    if (itemId === undefined) return
    keyboard = true
    keyboardIndex = handles().indexOf(handle)
    offer({
      _tag: 'ActivatedKeyboardDrag',
      itemId,
      containerId,
      index: keyboardIndex,
    })
    event.preventDefault()
  }
  host.addEventListener('pointerdown', down, { signal: events.signal })
  document.addEventListener('pointermove', move, { signal: events.signal })
  document.addEventListener('pointerup', up, { signal: events.signal })
  document.addEventListener('pointercancel', cancel, { signal: events.signal })
  document.addEventListener('keydown', key, { signal: events.signal })
  return () => events.abort()
}

const ResearchDrag = Mount.makeStream('ResearchDrag', {}, (element: HTMLElement) =>
  Stream.callback<Message>((queue) =>
    Effect.scoped(
      Effect.gen(function* () {
        const offer = (message: DragMessage) => Queue.offerUnsafe(queue, dragChanged(message))
        yield* Effect.acquireRelease(
          Effect.sync(() => attachDrag(element, offer)),
          (dispose) => Effect.sync(dispose),
        )
        return yield* Effect.never
      }),
    ),
  ),
)

const queuePanel = (model: Model, focus: ResearchId, h: H<Message>): Child => {
  const t = copy(h)

  const game = model.board.game
  const studies = studyList(game.studies)
  const ledger = ledgerOf(model)
  const head = studies[0]
  const speed = head && studyStall(game, ledger, head.id) ? 1 : studySpeed(game, ledger)
  const booster = game.researchTeam
    ? game.teams.find((entry) => entry.id === game.researchTeam)
    : undefined
  const boosting = booster && head && boostOf(game, ledger, head.id) > 0 ? booster : null
  const paused = boosting ? pausedEffect(t, boosting.kind) : null
  const drag = model.board.research.drag
  const dragging = dragIsActive(drag)
  const draggedId = dragItemId(drag)
  const from = Option.match(draggedId, {
    onNone: () => -1,
    onSome: (id) => studies.findIndex((item) => item.id === id),
  })
  const landing =
    from < 0
      ? null
      : Option.match(dragDropTarget(drag), {
          onNone: () => null,
          onSome: ({ containerId, index }) =>
            containerId !== STUDY_QUEUE
              ? null
              : Math.min(studies.length - 1, queueIndex(from, index)),
        })
  const overQueue = landing !== null
  if (studies.length === 0) return undefined
  return h.section
    .key('queue')
    .attr('data-research-drag-active', dragging ? '' : undefined)
    .class(
      css({
        display: 'flex',
        maxHeight: '30%',
        flexShrink: '0',
        flexDirection: 'column',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderColor: 'hairline',
      }),
    )
    .on(
      'keydown',
      (key) => (key.key === 'Escape' && !dragging ? Message.PanelClosed() : undefined),
      { preventDefault: true },
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            flexShrink: '0',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '3',
            paddingInline: '5',
            paddingTop: '4',
            paddingBottom: '2',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                EYEBROW,
                css({
                  display: 'flex',
                  flexShrink: '0',
                  alignItems: 'baseline',
                  gap: '2',
                  whiteSpace: 'nowrap',
                }),
              ),
            )
            .children(
              h.span.children(t.research.studyQueue),
              h.span
                .class(
                  css({
                    fontSize: 'type.10-5',
                    color: studies.length >= MAX_STUDIES ? 'danger' : 'mutedForeground',
                  }),
                )
                .children(t.research.queueCount(studies.length, MAX_STUDIES)),
            ),
          h.span
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flexShrink: '1',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '3',
                whiteSpace: 'nowrap',
              }),
            )
            .children(
              h.button
                .attr('type', 'button')
                .attr('title', paused ?? t.research.boostHelp)
                .on('click', () => Message.PanelOpened({ panel: 'team' }))
                .class(
                  cx(
                    css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '1',
                      borderRadius: 'md',
                      paddingInline: '1.5',
                      paddingBlock: '0.5',
                      fontSize: 'type.10-5',
                      whiteSpace: 'nowrap',
                      _hover: {
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                      },
                    }),
                    boosting
                      ? css({
                          color: 'ok',
                        })
                      : css({
                          color: 'mutedForeground',
                        }),
                  ),
                )
                .children(
                  icon(
                    h,
                    Zap,
                    css({
                      width: '3',
                      height: '3',
                      flexShrink: '0',
                    }),
                  ),
                  h.span.children(
                    boosting
                      ? t.research.boostedBy(
                          boosting.id === game.teams[0]?.id ? t.team.coreTeam : boosting.name,
                        )
                      : t.research.assignTeam,
                  ),
                  ...(paused
                    ? [
                        icon(
                          h,
                          Pause,
                          css({
                            width: '3',
                            height: '3',
                            flexShrink: '0',
                            color: 'warn',
                          }),
                        ),
                      ]
                    : []),
                ),
              ...(speed > 1
                ? [
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.11',
                            color: 'ok',
                          }),
                        ),
                      )
                      .attr('title', t.research.studySpeedTitle)
                      .children(t.research.speed(speedFactorOf(speed))),
                  ]
                : []),
            ),
        ),
      h.div
        .attr('data-droppable-id', STUDY_QUEUE)
        .attr('role', 'listbox')
        .attr('aria-label', t.research.studyQueue)
        .onMount(ResearchDrag({}))
        .class(
          cx(
            css({
              display: 'flex',
              minHeight: '0',
              flex: '1 1 0%',
              flexDirection: 'column',
              gap: '0.5',
              overflow: 'auto',
              paddingInline: '3',
              paddingBottom: '3',
              scrollbarWidth: 'thin',
            }),
            overQueue &&
              css({
                boxShadow: 'selectedHalo',
              }),
          ),
        )
        .children(
          ...studies.map((item, index) => {
            const entry = localized(RESEARCH[item.id], t.catalog.research[item.id])
            const stall = studyStall(game, ledger, item.id)
            const isDragged = Option.exists(draggedId, (id) => id === item.id)
            const slide = landing === null ? 0 : queueSlide(index, from, landing)
            const slot = isDragged && landing !== null
            const keyboard = drag.dragState._tag === 'KeyboardDragging'
            return h.div
              .key(item.id)
              .style(slide === 0 ? {} : { translate: `0 calc(${slide} * (100% + 0.125rem))` })
              .class(
                cx(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1',
                    borderRadius: 'lg',
                    paddingLeft: '1',
                  }),
                  dragging &&
                    !keyboard &&
                    css({
                      transitionProperty: 'translate',
                      transitionDuration: 'fast',
                      transitionTimingFunction: 'out',
                    }),
                  slot &&
                    css({
                      pointerEvents: 'none',
                      backgroundColor: 'color-mix(in oklab, var(--primary) 5%, transparent)',
                      boxShadow:
                        'inset 0 0 0 1px color-mix(in oklab, var(--primary) 30%, transparent)',
                    }),
                  !slot &&
                    item.id === focus &&
                    css({
                      backgroundColor: 'nested',
                    }),
                  isDragged &&
                    landing === null &&
                    css({
                      opacity: 0.45,
                    }),
                  slot &&
                    !keyboard &&
                    css({
                      '&>*:not(:first-child)': {
                        visibility: 'hidden',
                      },
                      '&>*:first-child': {
                        opacity: 0.4,
                      },
                    }),
                ),
              )
              .children(
                h.span
                  .attr('data-draggable-id', item.id)
                  .attr('data-sortable-id', item.id)
                  .attr('role', 'option')
                  .attr('aria-roledescription', 'draggable')
                  .attr('tabindex', '0')
                  .attr('aria-label', t.research.reorder(entry.name))
                  .attr('title', t.research.dragToReorder)
                  .style({
                    touchAction: 'none',
                    userSelect: 'none',
                    webkitUserSelect: 'none',
                  })
                  .class(
                    css({
                      display: 'grid',
                      cursor: 'grab',
                      touchAction: 'none',
                      alignSelf: 'stretch',
                      placeItems: 'center',
                      borderRadius: 'md',
                      paddingInline: '0.5',
                      _active: {
                        cursor: 'grabbing',
                      },
                      _focusVisible: {
                        outlineWidth: '2px',
                        outlineStyle: 'solid',
                        outlineColor: 'primary',
                      },
                    }),
                  )
                  .children(researchMark(entry, 'sm', false, h)),
                h.button
                  .attr('type', 'button')
                  .on('click', () =>
                    Message.ResearchChanged({
                      message: ResearchMessage.Focused({ id: item.id }),
                    }),
                  )
                  .class(
                    css({
                      display: 'flex',
                      minWidth: '0',
                      flex: '1 1 0%',
                      alignItems: 'center',
                      gap: '2',
                      borderRadius: 'md',
                      paddingBlock: '1',
                      textAlign: 'left',
                      fontSize: 'type.12-5',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  )
                  .children(
                    h.span
                      .class(
                        css({
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontWeight: 'medium',
                        }),
                      )
                      .children(t.catalog.research[entry.id].name),
                    h.span
                      .attr('title', stall ? stallReasonIn(t, stall) : undefined)
                      .class(
                        cx(
                          FIGURE,
                          css({
                            marginLeft: 'auto',
                            display: 'flex',
                            flexShrink: '0',
                            alignItems: 'center',
                            gap: '1',
                            fontSize: 'type.11-5',
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
                          : undefined,
                        stall
                          ? t.research.cannotRunShort
                          : `${Math.floor(Math.min(1, studyProgressOf(item)) * 100)}%`,
                      ),
                  ),
                queueButton(
                  t.research.moveUp,
                  ArrowUp,
                  Message.ResearchChanged({
                    message: ResearchMessage.StudyMoved({ id: item.id, direction: -1 }),
                  }),
                  index > 0 && !needs(item.id, studies[index - 1]?.id ?? item.id),
                  h,
                ),
                queueButton(
                  t.research.moveDown,
                  ArrowDown,
                  Message.ResearchChanged({
                    message: ResearchMessage.StudyMoved({ id: item.id, direction: 1 }),
                  }),
                  index < studies.length - 1 && !needs(studies[index + 1]?.id ?? item.id, item.id),
                  h,
                ),
                queueButton(
                  t.research.cancel,
                  X,
                  Message.ResearchChanged({
                    message: ResearchMessage.StudyCancelled({ id: item.id }),
                  }),
                  true,
                  h,
                ),
              )
          }),
          Option.match(dragGhostStyle(drag), {
            onNone: () => undefined,
            onSome: (style) =>
              Option.match(draggedId, {
                onNone: () => undefined,
                onSome: (id) => {
                  const entry = localized(
                    RESEARCH[id as ResearchId],
                    t.catalog.research[id as ResearchId],
                  )
                  return h.div
                    .attr('aria-hidden', 'true')
                    .style(style)
                    .class(
                      cx(
                        FLOAT,
                        css({
                          pointerEvents: 'none',
                          zIndex: '50',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2',
                          paddingInline: '3',
                          paddingBlock: '2',
                          fontSize: 'type.12-5',
                          fontWeight: 'medium',
                        }),
                      ),
                    )
                    .children(
                      researchMark(entry, 'sm', false, h),
                      t.catalog.research[entry.id].name,
                    )
                },
              }),
          }),
        ),
    )
}

const TREE_MIN = 420

const sheetBounds = (panel: number): Readonly<{ min: number; max: number }> => ({
  min: SHEET_MIN_WIDTH_PX,
  max: Math.max(SHEET_MIN_WIDTH_PX, Math.min(SHEET_MAX_WIDTH_PX, panel - TREE_MIN)),
})

const clampSheet = (width: number, panel: number): number => {
  const { min, max } = sheetBounds(panel)
  return Math.round(Math.max(min, Math.min(max, width)))
}

const attachResize = (host: HTMLElement, offer: (width: number) => void): (() => void) => {
  const sheet = host.parentElement
  if (!sheet) return () => {}
  const events = new AbortController()
  let start: { id: number; x: number; width: number; panel: number } | null = null
  const panelWidth = () => sheet.parentElement?.clientWidth ?? window.innerWidth
  const down = (event: PointerEvent) => {
    if (event.button !== 0) return
    event.preventDefault()
    host.setPointerCapture(event.pointerId)
    start = {
      id: event.pointerId,
      x: event.clientX,
      width: sheet.offsetWidth,
      panel: panelWidth(),
    }
    host.dataset['resizing'] = ''
  }
  const move = (event: PointerEvent) => {
    if (!start || start.id !== event.pointerId) return
    offer(clampSheet(start.width - (event.clientX - start.x), start.panel))
  }
  const up = (event: PointerEvent) => {
    if (!start || start.id !== event.pointerId) return
    start = null
    delete host.dataset['resizing']
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId)
  }
  const key = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 64 : 16
    const panel = panelWidth()
    const width = sheet.offsetWidth
    switch (event.key) {
      case 'ArrowLeft':
        offer(clampSheet(width + step, panel))
        break
      case 'ArrowRight':
        offer(clampSheet(width - step, panel))
        break
      case 'Home':
        offer(sheetBounds(panel).max)
        break
      case 'End':
        offer(sheetBounds(panel).min)
        break
      default:
        return
    }
    event.preventDefault()
  }
  host.addEventListener('pointerdown', down, { signal: events.signal })
  host.addEventListener('pointermove', move, { signal: events.signal })
  host.addEventListener('pointerup', up, { signal: events.signal })
  host.addEventListener('pointercancel', up, { signal: events.signal })
  host.addEventListener('dblclick', () => offer(clampSheet(SHEET_DEFAULT_WIDTH_PX, panelWidth())), {
    signal: events.signal,
  })
  host.addEventListener('keydown', key, { signal: events.signal })
  return () => events.abort()
}

const ResearchResize = Mount.makeStream('ResearchResize', {}, (element: HTMLElement) =>
  Stream.callback<Message>((queue) =>
    Effect.scoped(
      Effect.gen(function* () {
        const offer = (width: number) =>
          Queue.offerUnsafe(
            queue,
            Message.ResearchChanged({ message: ResearchMessage.SheetResized({ width }) }),
          )
        yield* Effect.acquireRelease(
          Effect.sync(() => attachResize(element, offer)),
          (dispose) => Effect.sync(dispose),
        )
        return yield* Effect.never
      }),
    ),
  ),
)

const detail = (model: Model, entry: ResearchDef, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const studies = studyList(game.studies)
  const queued = studies.findIndex((item) => item.id === entry.id)
  const state = stateOf(game, entry)
  const open = state !== 'owned' && game.openActions.includes(entry.id)
  const track = t.catalog.researchTracks[entry.track].label
  const chain = state === 'locked' ? missingPrerequisites(game, entry.id) : []
  const era = Math.max(entry.era, ...chain.map((id) => RESEARCH[id].era))
  const ledger = ledgerOf(model)
  const stalled =
    state === 'owned' || era > game.stage
      ? undefined
      : [...chain, entry.id]
          .map((id) => ({ id, stall: studyStall(game, ledger, id) }))
          .find((item) => item.stall !== null)
  const queueable = era <= game.stage && chain.length > 0
  const adds = (state === 'buy' || queueable) && queued < 0
  const fresh = [...chain, entry.id].filter((id) => !studies.some((item) => item.id === id)).length
  const full = adds && studies.length + fresh > MAX_STUDIES
  const label =
    state === 'owned'
      ? t.research.researched
      : full
        ? t.research.queueFull
        : state === 'buy'
          ? stalled?.stall
            ? t.research.queueStudy(duration(t, game, ledger, entry))
            : t.research.startStudy(duration(t, game, ledger, entry))
          : era > game.stage
            ? t.research.opensIn(t.catalog.eras[era]?.name ?? eraName(era))
            : chain.length > 2
              ? t.research.studyAfterCount(chain.length)
              : chain.length > 0
                ? t.research.studyAfter(chain.map((id) => t.catalog.research[id].name))
                : queued > 0
                  ? t.research.studyNow
                  : stalled?.stall
                    ? t.research.queued
                    : t.research.studying(
                        Math.floor(studyProgressOf(currentStudy(game.studies)) * 100),
                      )
  const first = stalled && stalled.id !== entry.id ? t.catalog.research[stalled.id].name : null
  const consequence = full
    ? t.research.queueFullHelp(MAX_STUDIES)
    : first === null
      ? queued === 0
        ? t.research.atTheFront
        : queued > 0
          ? t.research.everyStudyBehindItWaits
          : t.research.queueToStart
      : null
  const follow = followUps(entry.id)
  const status: Readonly<{ label: string; tone: BadgeVariant }> | null = full
    ? null
    : state === 'owned'
      ? { label: t.research.researched, tone: 'ok' }
      : stalled?.stall
        ? { label: t.research.cannotRunShort, tone: 'warn' }
        : state === 'saving'
          ? queued === 0
            ? { label: t.research.studyingShort, tone: 'default' }
            : { label: t.research.queued, tone: 'secondary' }
          : state === 'locked' || era > game.stage
            ? { label: t.research.locked, tone: 'outline' }
            : { label: t.research.available, tone: 'secondary' }
  return h.aside
    .key('detail')
    .attr('data-exit', 'gesture')
    .class(
      cx(
        css({
          position: 'absolute',
          insetBlock: '0',
          right: '0',
          zIndex: '20',
          display: 'flex',
          width: 'var(--sheet-w)',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          borderColor: 'hairline',
          backgroundColor: 'card',
          _compact: {
            insetInline: '0',
            top: 'auto',
            bottom: '0',
            maxHeight: '66%',
            width: 'auto',
            borderTopLeftRadius: '2xl',
            borderTopRightRadius: '2xl',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderLeftWidth: '0px',
            paddingBottom: 'env(safe-area-inset-bottom)',
            boxShadow: 'float',
          },
        }),
        'enter-panel',
        'sheet',
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'none',
            flexShrink: '0',
            justifyContent: 'center',
            paddingTop: '2',
            paddingBottom: '0.5',
            _compact: {
              display: 'flex',
            },
          }),
        )
        .children(
          h.span
            .class(
              css({
                height: '1',
                width: '10',
                borderRadius: 'full',
                backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
              }),
            )
            .children(),
        ),
      h.div
        .key('resize')
        .attr('role', 'separator')
        .attr('aria-orientation', 'vertical')
        .attr('aria-label', t.research.resizePane)
        .attr('title', t.research.resizePane)
        .attr('aria-valuemin', String(SHEET_MIN_WIDTH_PX))
        .attr('aria-valuemax', String(SHEET_MAX_WIDTH_PX))
        .attr('aria-valuenow', String(Math.round(model.board.research.sheetWidth)))
        .attr('tabindex', '0')
        .onMount(ResearchResize({}))
        .class(
          cx(
            css({
              position: 'absolute',
              insetBlock: '0',
              left: '0',
              zIndex: '10',
              width: '2',
              cursor: 'col-resize',
              touchAction: 'none',
              _focusVisible: {
                outlineWidth: '2px',
                outlineStyle: 'solid',
                outlineColor: 'primary',
              },
              _compact: {
                display: 'none',
              },
            }),
            'group',
          ),
        )
        .children(
          h.span
            .class(
              css({
                pointerEvents: 'none',
                position: 'absolute',
                insetBlock: '0',
                left: '0',
                width: '0.5',
                backgroundColor: 'transparent',
                transitionProperty:
                  'color, background-color, border-color, text-decoration-color, fill, stroke',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
                '.group:hover &': {
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 20%, transparent)',
                },
                '.group[data-resizing] &': {
                  backgroundColor: 'primaryStrong',
                },
              }),
            )
            .children(),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexShrink: '0',
            alignItems: 'flex-start',
            gap: '3',
            borderBottomWidth: '1px',
            borderBottomStyle: 'solid',
            borderColor: 'hairline',
            paddingInline: '5',
            paddingBlock: '4',
          }),
        )
        .children(
          researchMark(entry, 'lg', state === 'locked', h),
          h.div
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                flexDirection: 'column',
                gap: '1',
              }),
            )
            .children(
              h.div
                .class(
                  css({
                    display: 'flex',
                    minWidth: '0',
                    alignItems: 'center',
                    gap: '2',
                  }),
                )
                .children(
                  h.span
                    .class(
                      css({
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 'type.17',
                        lineHeight: 'tight',
                        fontWeight: 'semibold',
                        letterSpacing: 'tight',
                      }),
                    )
                    .children(t.catalog.research[entry.id].name),
                  ...(status === null
                    ? []
                    : [
                        badge(
                          h,
                          {
                            variant: status.tone,
                            className: css({
                              flexShrink: '0',
                            }),
                          },
                          [status.label],
                        ),
                      ]),
                ),
              h.span
                .class(EYEBROW)
                .children(`${track} · ${t.catalog.eras[entry.era]?.name ?? eraName(entry.era)}`),
            ),
          button(
            h,
            {
              onClick: Message.PanelClosed(),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                flexShrink: '0',
                color: 'mutedForeground',
              }),
              attributes: { 'aria-label': t.research.closeEsc, title: t.research.closeEsc },
            },
            icon(
              h,
              X,
              css({
                width: '4',
                height: '4',
              }),
            ),
          ),
        ),
      stalled?.stall
        ? requirement(t, stalled.stall, first, consequence, h)
        : full
          ? fullNotice(MAX_STUDIES, t, h)
          : undefined,
      queuePanel(model, entry.id, h),
      h.div
        .key(entry.id)
        .class(
          cx(
            css({
              minHeight: '0',
              flex: '1 1 0%',
              overflow: 'auto',
              scrollbarWidth: 'thin',
            }),
            'enter-pop',
          ),
        )
        .children(
          h.section
            .class(
              css({
                borderBottomWidth: '1px',
                borderBottomStyle: 'solid',
                borderColor: 'hairline',
                paddingInline: '5',
                paddingBlock: '4',
                '&:last-child': {
                  borderBottomWidth: '0px',
                },
              }),
            )
            .children(
              h.p
                .class(
                  css({
                    fontSize: 'type.13',
                    lineHeight: 'relaxed',
                    color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                  }),
                )
                .children(t.catalog.research[entry.id].blurb),
              h.div
                .class(
                  css({
                    marginTop: '3',
                  }),
                )
                .children(terms(entry, h)),
            ),
          open
            ? h.section
                .class(
                  css({
                    borderBottomWidth: '1px',
                    borderBottomStyle: 'solid',
                    borderColor: 'hairline',
                    paddingInline: '5',
                    paddingBlock: '4',
                    '&:last-child': {
                      borderBottomWidth: '0px',
                    },
                  }),
                )
                .children(
                  h.div
                    .class(
                      css({
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '2',
                        fontSize: 'type.12',
                        lineHeight: 'snug',
                        color: 'warn',
                      }),
                    )
                    .children(
                      icon(
                        h,
                        TriangleAlert,
                        css({
                          marginTop: '1px',
                          width: '3.5',
                          height: '3.5',
                          flexShrink: '0',
                        }),
                      ),
                      t.research.openActionItemTheIncidentIt,
                    ),
                )
            : undefined,
          state === 'owned' ? undefined : costRows(game, ledger, entry, h),
          linkSection(
            t.research.requires,
            entry.requires.map((id) => RESEARCH[id]),
            game,
            h,
          ),
          linkSection(t.research.leadsTo, follow, game, h),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexShrink: '0',
            gap: '2',
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderColor: 'hairline',
            padding: '3',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.ResearchChanged({
                message:
                  queued > 0
                    ? ResearchMessage.StudyPrioritized({ id: entry.id })
                    : ResearchMessage.Bought({ id: entry.id }),
              }),
              isDisabled:
                full || !(state === 'buy' || queueable || (state === 'saving' && queued > 0)),
              size: 'lg',
              variant: full
                ? 'outline'
                : state === 'buy' || queueable || queued > 0
                  ? 'default'
                  : 'outline',
              className: cx(
                FIGURE,
                css({
                  minWidth: '0',
                  flex: '1 1 0%',
                }),
              ),
            },
            [
              state === 'owned'
                ? icon(
                    h,
                    Check,
                    css({
                      width: '4',
                      height: '4',
                      color: 'ok',
                    }),
                  )
                : undefined,
              label,
            ],
          ),
          queued >= 0
            ? button(
                h,
                {
                  onClick: Message.ResearchChanged({
                    message: ResearchMessage.StudyCancelled({ id: entry.id }),
                  }),
                  size: 'lg',
                  variant: 'outline',
                },
                [t.research.cancel],
              )
            : undefined,
        ),
    )
}

const DECK_POOLS = 4

const poolCell = (
  game: Game,
  ledger: Ledger,
  pool: InsightPool,
  blocked: boolean,
  h: H<Message>,
): Content => {
  const t = copy(h)
  const held = game.pools[pool]
  const cap = capOf(game, ledger, pool)
  const share = cap > 0 ? Math.min(1, held / cap) : 0
  return h.div
    .key(pool)
    .attr('data-deck-pool', pool)
    .attr('title', `${insightName(t, pool)} ${t.research.outOf(compact(held), compact(cap))}`)
    .class(
      cx(
        css({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5',
          borderRadius: 'md',
          paddingInline: '1.5',
          paddingTop: '0.5',
          paddingBottom: '1.5',
        }),
        blocked &&
          css({
            backgroundColor: 'warnSoft',
            boxShadow: 'warnLineStrong',
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
              width: '3',
              height: '3',
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
            fontSize: 'type.10-5',
            color: 'mutedForeground',
          }),
        )
        .children(t.catalog.pools[pool].label),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.11',
            }),
            blocked &&
              css({
                fontWeight: 'semibold',
                color: 'danger',
              }),
          ),
        )
        .children(compact(held)),
      h.span
        .class(
          css({
            position: 'absolute',
            insetInline: '1.5',
            bottom: '1',
            height: '3px',
            overflow: 'hidden',
            borderRadius: 'full',
            backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                css({
                  display: 'block',
                  height: '100%',
                  borderRadius: 'full',
                }),
                blocked
                  ? css({
                      backgroundColor: 'danger',
                    })
                  : css({
                      backgroundColor: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                    }),
              ),
            )
            .style({ width: `${share * 100}%` })
            .children(),
        ),
    )
}

const pinnedChip = (game: Game, pool: InsightPool, need: number, h: H<Message>): Content => {
  const t = copy(h)
  const held = game.pools[pool]
  const blocked = held < need
  const heldLabel = compact(held)
  const needLabel = compact(need)
  const figure = blocked ? `${heldLabel}/${needLabel}` : heldLabel
  return h.span
    .attr('data-deck-pin', pool)
    .attr('title', `${insightName(t, pool)} ${t.research.outOf(heldLabel, needLabel)}`)
    .attr('aria-label', `${insightName(t, pool)} ${t.research.outOf(heldLabel, needLabel)}`)
    .class(
      cx(
        FIGURE,
        css({
          display: 'inline-flex',
          flexShrink: '0',
          alignItems: 'center',
          gap: '1.5',
          borderRadius: 'md',
          paddingBlock: '0.5',
          paddingRight: '1.5',
          paddingLeft: '1',
          fontSize: 'type.12-5',
          whiteSpace: 'nowrap',
        }),
        blocked &&
          css({
            backgroundColor: 'warnSoft',
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
              width: '3',
              height: '3',
              flexShrink: '0',
            }),
          ),
        ),
      h.span
        .class(
          css({
            fontSize: 'type.11',
            color: 'mutedForeground',
          }),
        )
        .children(t.catalog.pools[pool].label),
      h.span
        .class(
          blocked
            ? css({
                fontWeight: 'semibold',
                color: 'danger',
              })
            : '',
        )
        .children(figure),
    )
}

const poolDeck = (model: Model, h: H<Message>): Content => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const open = model.board.research.poolsOpen
  const running = currentStudy(game.studies)
  const limit = running ? limitingPool(game) : null
  const need =
    running && limit
      ? (recipeOf(running.id, game.discounts).find(([pool]) => pool === limit)?.[1] ?? 0)
      : 0
  const rest = POOL_ORDER.filter((pool) => pool !== limit && game.pools[pool] >= 1)
    .toSorted((a, b) => ledger.insight[b] - ledger.insight[a])
    .slice(0, limit ? DECK_POOLS : DECK_POOLS + 1)
  return h.div
    .key('deck')
    .class(
      css({
        pointerEvents: 'auto',
        position: 'absolute',
        bottom: '4',
        left: '4',
        zIndex: '20',
        display: 'flex',
        maxWidth: 'calc(100%-2rem)',
        flexDirection: 'column',
        alignItems: 'flex-start',
        _compact: {
          display: 'none',
        },
      }),
    )
    .children(
      h.div
        .class(
          cx(
            PANEL,
            css({
              display: 'flex',
              flexDirection: 'column',
              padding: '2',
            }),
          ),
        )
        .children(
          h.div
            .key('deck-pools')
            .attr('role', 'group')
            .attr('aria-label', t.research.pools)
            .attr('aria-hidden', open ? 'false' : 'true')
            .attr('inert', open ? undefined : '')
            .attr('data-open', open ? 'true' : 'false')
            .class('deck-pools')
            .children(
              h.div.class('deck-pools-clip').children(
                h.div
                  .class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                      columnGap: '1.5',
                      rowGap: '0.5',
                      paddingBottom: '2',
                    }),
                  )
                  .children(
                    ...POOL_ORDER.map((pool) =>
                      poolCell(game, ledger, pool, pool === limit && need > game.pools[pool], h),
                    ),
                  ),
              ),
            ),
          h.div
            .class(
              css({
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                columnGap: '3',
                rowGap: '1',
              }),
            )
            .children(
              limit ? pinnedChip(game, limit, need, h) : undefined,
              ...rest.map((pool) =>
                insightChip(
                  h,
                  pool,
                  compact(game.pools[pool]),
                  false,
                  'plain',
                  insightName(t, pool),
                ),
              ),
              h.button
                .attr('type', 'button')
                .attr('data-deck-toggle', '')
                .attr('title', open ? t.research.hidePools : t.research.showPools)
                .attr('aria-expanded', open ? 'true' : 'false')
                .on('click', () =>
                  Message.ResearchChanged({ message: ResearchMessage.PoolsToggled() }),
                )
                .class(
                  cx(
                    css({
                      display: 'flex',
                      flexShrink: '0',
                      alignItems: 'center',
                      gap: '1',
                      borderRadius: 'md',
                      backgroundColor: 'nested',
                      paddingInline: '2',
                      paddingBlock: '1',
                      fontSize: 'type.11-5',
                      boxShadow: 'line',
                      _hover: {
                        backgroundColor: 'well',
                      },
                    }),
                    'press',
                  ),
                )
                .children(
                  h.span
                    .class(
                      css({
                        display: 'grid',
                        justifyItems: 'center',
                      }),
                    )
                    .children(
                      h.span
                        .class(
                          css({
                            gridColumnStart: '1',
                            gridRowStart: '1',
                          }),
                        )
                        .children(
                          open ? t.research.fewerPools : t.research.allPools(POOL_ORDER.length),
                        ),
                      h.span
                        .attr('aria-hidden', 'true')
                        .class(
                          css({
                            visibility: 'hidden',
                            gridColumnStart: '1',
                            gridRowStart: '1',
                          }),
                        )
                        .children(t.research.allPools(POOL_ORDER.length)),
                    ),
                  icon(
                    h,
                    open ? ChevronUp : ChevronDown,
                    css({
                      width: '3',
                      height: '3',
                      color: 'mutedForeground',
                    }),
                  ),
                ),
            ),
        ),
    )
}

export const researchPanel = (
  h: H<Message>,
  model: Model,
): View.Content<Message> | View.Input<Message> => {
  if (model.panel !== 'research') return undefined
  const t = copy(h)

  const focus = focusOf(model)
  const layout = researchLayout(scaleOf(model))
  const unsampled = unsampledOf(ledgerOf(model))
  return h.div
    .key('research')
    .attr('data-research-panel', '')
    .attr('data-exit', 'gesture')
    .style({ '--sheet-w': `${model.board.research.sheetWidth}px` })
    .class(
      cx(
        css({
          position: 'absolute',
          inset: '0',
          zIndex: '30',
          backgroundColor: 'canvas',
        }),
        'enter-backdrop',
      ),
    )
    .children(
      h.div
        .class(
          css({
            position: 'absolute',
            insetBlock: '0',
            left: '0',
            right: 'var(--sheet-w)',
            display: 'flex',
            flexDirection: 'column',
            _compact: {
              right: '0',
            },
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                height: '11',
                flexShrink: '0',
                alignItems: 'center',
                gap: '3',
                paddingInline: '4',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    flexShrink: '0',
                    fontSize: 'type.17',
                    fontWeight: 'semibold',
                    letterSpacing: 'tight',
                  }),
                )
                .children(t.research.research),
              unsampled.share >= 0.01
                ? h.span
                    .class(
                      css({
                        marginLeft: 'auto',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1',
                        fontSize: 'type.11-5',
                        color: 'warn',
                      }),
                    )
                    .attr('title', t.hud.unsampledHint)
                    .children(
                      icon(
                        h,
                        TriangleAlert,
                        css({
                          width: '3',
                          height: '3',
                        }),
                      ),
                      t.hud.unsampled(Math.round(unsampled.share * 100)),
                    )
                : undefined,
            ),
          h.div
            .class(
              css({
                position: 'relative',
                minHeight: '0',
                flex: '1 1 0%',
              }),
            )
            .children(
              h.div
                .key('scroll')
                .onMount(ResearchScroll({}))
                .class(
                  cx(
                    css({
                      position: 'absolute',
                      inset: '0',
                      cursor: 'grab',
                    }),
                    SCROLL,
                  ),
                )
                .children(
                  h.div
                    .class(
                      css({
                        width: 'fit-content',
                        padding: '4',
                        _compact: {
                          paddingBottom: '68vh',
                        },
                      }),
                    )
                    .children(
                      h.div
                        .class(
                          css({
                            position: 'relative',
                          }),
                        )
                        .style({
                          width: `${layout.width}px`,
                          height: `${layout.height}px`,
                        })
                        .children(
                          ...backdrop(model, layout, h),
                          wires(model, layout, focus, h),
                          ...[...layout.placed.values()].map((place) =>
                            node(model, place, place.entry.id === focus.id, h),
                          ),
                        ),
                    ),
                ),
              poolDeck(model, h),
            ),
        ),
      detail(model, focus, h),
    )
}
