import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import {
  Check,
  FastForward,
  Hammer,
  Menu,
  Percent,
  Play,
  RotateCcw,
  Timer,
  TriangleAlert,
  Wallet,
  Waypoints,
  X,
  type IconNode,
} from 'lucide'
import { FIXES, KINDS, TASKS, type RequestKind } from '@quorum/simulation/catalog'
import {
  challengeById,
  complexityOf,
  devHoursOf,
  stepsOf,
  type Challenge,
  type ScoreAxis,
} from '@quorum/simulation/challenges'
import { has } from '@quorum/simulation/lookups'
import { serviceOf } from '@quorum/simulation/team'
import type { Ledger } from '@quorum/simulation/ledger'
import { clock, money } from '@quorum/ui/game/format'
import { formats } from '@/i18n/format.ts'
import { copy, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import {
  boardChallenge,
  type ChallengeResultRun,
  type ChallengeRun,
  type Model,
} from '@/game/model.ts'
import { CHIPS, FIGURE, FLOAT, PANEL, WELL, toneText, type Tone } from '@quorum/ui/game/bits'
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

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick?: Message
    isDisabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    variant?: ButtonVariant
    size?: ButtonSize
    className?: string
    attributes?: Readonly<Record<string, string | undefined>>
  }>,
  label: Label | ReadonlyArray<Label>,
): Content => {
  const base = h.button
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

const axisNamesOf = (t: Messages): Record<ScoreAxis, string> => ({
  cost: t.challenge.cost,
  tail: t.challenge.tail,
  complexity: t.challenge.complexity,
})

const axisValue = (t: Messages, axis: ScoreAxis, value: number): string =>
  axis === 'cost'
    ? t.units.perSecond(money(value))
    : axis === 'tail'
      ? formats(t).ms(value)
      : String(value)

const figureRow = (
  name: string,
  glyph: IconNode,
  value: string,
  tone: Tone,
  h: H<Message>,
): Content =>
  h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        height: '8',
        alignItems: 'center',
        gap: '2.5',
        paddingInline: '2.5',
        _compact: {
          flexShrink: '0',
          paddingInline: '3',
        },
      }),
    )
    .children(
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
            width: '72px',
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
              marginLeft: 'auto',
              fontSize: 'type.13-5',
              lineHeight: 'none',
            }),
            toneText(tone),
          ),
        )
        .children(value),
    )

const figures = (model: Model, challenge: Challenge, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)

  const errors = ledger.errorShare * 100
  const { targets } = challenge
  const margin = ledger.revenue > 0 ? (ledger.revenue - ledger.burn) / ledger.revenue : -1
  const spent =
    challenge.devHours === undefined ? 0 : devHoursOf(challenge.start(), model.board.game)
  return h.div
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
      figureRow(
        t.challenge.cost,
        Wallet,
        t.challenge.s(money(ledger.burn)),
        targets.cost !== undefined && ledger.burn > targets.cost ? 'danger' : 'plain',
        h,
      ),
      figureRow(
        t.challenge.tail,
        Timer,
        formats(t).ms(ledger.p99),
        targets.tail !== undefined && ledger.p99 > targets.tail ? 'danger' : 'plain',
        h,
      ),
      figureRow(
        t.challenge.complexity,
        Waypoints,
        String(complexityOf(model.board.game)),
        'plain',
        h,
      ),
      targets.margin === undefined
        ? undefined
        : figureRow(
            t.challenge.margin,
            Percent,
            `${Math.round(margin * 100)}%`,
            margin >= targets.margin ? 'ok' : 'danger',
            h,
          ),
      challenge.devHours === undefined
        ? undefined
        : figureRow(
            t.challenge.devHours,
            Hammer,
            `${Math.round(spent)} / ${challenge.devHours}`,
            spent <= challenge.devHours ? 'plain' : 'danger',
            h,
          ),
      figureRow(
        t.challenge.errors,
        TriangleAlert,
        percent(ledger.errorShare),
        errors <= targets.errors * 100 ? 'ok' : 'danger',
        h,
      ),
    )
}

const percent = (share: number): string => `${Number((share * 100).toPrecision(2))}%`

const kindName = (t: Messages, kind: string): string =>
  t.catalog.kinds[kind as RequestKind].label.toLowerCase()

const missedText = (t: Messages, missed: string): string => {
  const fixed: Readonly<Record<string, string>> = {
    'Nothing was served.': t.challenge.missedNothing,
    'Too many errors.': t.challenge.missedErrors,
    'Connections were refused.': t.challenge.missedRefused,
    'The tail is too long.': t.challenge.missedTail,
    'Over budget.': t.challenge.missedCost,
    'The margin is too thin.': t.challenge.missedMargin,
  }
  const kinds = Object.keys(KINDS) as ReadonlyArray<RequestKind>
  const failed = /^Too many (.+) requests failed\.$/.exec(missed)?.[1]
  const failedKind = kinds.find((kind) => KINDS[kind].label.toLowerCase() === failed)
  if (failedKind) return t.challenge.missedKindFailed(kindName(t, failedKind))
  const slow = /^(.+) requests are too slow\.$/.exec(missed)?.[1]
  const slowKind = kinds.find((kind) => KINDS[kind].label === slow)
  if (slowKind) return t.challenge.missedKindSlow(t.catalog.kinds[slowKind].label)
  return fixed[missed] ?? missed
}

const targetText = (t: Messages, challenge: Challenge): string => {
  const { targets } = challenge
  const latency = formats(t).ms
  return [
    t.challenge.errorsAtMost(percent(targets.errors)),
    ...Object.entries(targets.kinds ?? {}).map(([kind, limit]) =>
      t.challenge.kindErrorsAtMost(kindName(t, kind), percent(limit ?? 0)),
    ),
    ...Object.entries(targets.kindTail ?? {}).map(([kind, limit]) =>
      t.challenge.kindP99AtMost(kindName(t, kind), latency(limit ?? 0)),
    ),
    targets.refused !== undefined ? t.challenge.noRefused : '',
    targets.tail !== undefined ? t.challenge.tailAtMost(latency(targets.tail)) : '',
    targets.cost !== undefined
      ? t.challenge.costAtMost(t.units.perSecond(money(targets.cost)))
      : '',
    targets.margin !== undefined ? t.challenge.marginAtLeast(percent(targets.margin)) : '',
    challenge.devHours !== undefined ? t.challenge.devHoursTarget(challenge.devHours) : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

const fixes = (model: Model, h: H<Message>): Child => {
  const t = copy(h)

  const game = model.board.game
  const open = FIXES.filter((fix) => {
    const research = TASKS[fix].research
    return research !== null && has(game, research)
  })
  if (!game.scenario?.tasks || open.length === 0) return undefined
  const on = serviceOf(game).fixes
  return h.div
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
      open.map((fix) => {
        const active = on.includes(fix)
        return h.button
          .key(fix)
          .attr('type', 'button')
          .attr('aria-pressed', active ? 'true' : 'false')
          .on('click', () => Message.FixChosen({ fix, on: !active }))
          .class(
            cx(
              css({
                display: 'flex',
                height: '8',
                alignItems: 'center',
                gap: '2.5',
                paddingInline: '2.5',
                textAlign: 'left',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                },
                _compact: {
                  paddingInline: '3',
                },
              }),
              'press',
            ),
          )
          .children(
            icon(
              h,
              active ? Check : Hammer,
              cx(
                css({
                  width: '3.5',
                  height: '3.5',
                  flexShrink: '0',
                }),
                active
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
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'type.11-5',
                }),
              )
              .children(t.catalog.tasks[fix].name),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                ),
              )
              .children(t.challenge.dH(TASKS[fix].dh)),
          )
      }),
    )
}

const actions = (run: ChallengeRun, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        gap: '1.5',
        paddingInline: '1',
        paddingTop: '1',
      }),
    )
    .children(
      run._tag === 'Building'
        ? [
            button(
              h,
              {
                onClick: Message.ChallengeRan(),
                size: 'sm',
                className: css({
                  flex: '1 1 0%',
                }),
              },
              [
                icon(
                  h,
                  Play,
                  css({
                    width: '3.5',
                    height: '3.5',
                  }),
                ),
                t.challenge.run,
              ],
            ),
          ]
        : run._tag === 'Running'
          ? [
              button(
                h,
                {
                  onClick: Message.ChallengeFinished(),
                  size: 'sm',
                  className: css({
                    flex: '1 1 0%',
                  }),
                },
                [
                  icon(
                    h,
                    FastForward,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                  t.challenge.finish,
                ],
              ),
              button(h, { onClick: Message.ChallengeRebuilt(), variant: 'outline', size: 'sm' }, [
                icon(
                  h,
                  RotateCcw,
                  css({
                    width: '3.5',
                    height: '3.5',
                  }),
                ),
                t.challenge.rebuild,
              ]),
            ]
          : [
              button(
                h,
                {
                  onClick: Message.PanelOpened({ panel: 'challenge' }),
                  size: 'sm',
                  className: css({
                    flex: '1 1 0%',
                  }),
                },
                t.challenge.result,
              ),
              button(h, { onClick: Message.ChallengeRebuilt(), variant: 'outline', size: 'sm' }, [
                icon(
                  h,
                  RotateCcw,
                  css({
                    width: '3.5',
                    height: '3.5',
                  }),
                ),
                t.challenge.rebuild,
              ]),
            ],
    )
}

export const challengeHud = (h: H<Message>, model: Model, ledger: Ledger): View.Input<Message> => {
  const t = copy(h)

  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (!run || !challenge) return undefined
  return h.header
    .class(
      cx(
        css({
          position: 'absolute',
          top: '3',
          left: '3',
          zIndex: '20',
          display: 'flex',
          width: '248px',
          flexDirection: 'column',
          gap: '1',
          padding: '1.5',
        }),
        PANEL,
        css({
          _compact: {
            pointerEvents: 'auto',
            position: 'static',
            width: 'auto',
            padding: '1',
          },
        }),
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            minHeight: '9',
            alignItems: 'center',
            gap: '2',
            paddingInline: '2.5',
            paddingTop: '1.5',
            paddingBottom: '2',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.TitleOpened(),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                marginLeft: '-0.375rem',
                color: 'mutedForeground',
              }),
              attributes: { 'aria-label': t.challenge.challenges, title: t.challenge.challenges },
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.13',
                fontWeight: 'semibold',
              }),
            )
            .children(t.catalog.challenges[challenge.id]?.name ?? challenge.name),
          model.founder.completed.includes(challenge.id)
            ? h.span
                .class(
                  css({
                    marginLeft: 'auto',
                  }),
                )
                .children(
                  icon(
                    h,
                    Check,
                    css({
                      width: '3.5',
                      height: '3.5',
                      color: 'ok',
                    }),
                  ),
                )
            : undefined,
        ),
      figures(model, challenge, ledger, h),
      run._tag === 'Building' ? fixes(model, h) : undefined,
      actions(run, h),
    )
}

export const challengeBar = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)
  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (!run || !challenge) return undefined
  const running = run._tag !== 'Building'
  const elapsed = run.totals.step * challenge.stepSeconds
  return h.div
    .key(`challenge-${run._tag}`)
    .class(
      cx(
        css({
          display: 'flex',
          width: '420px',
          flexDirection: 'column',
          gap: '2',
          _compact: {
            width: 'auto',
          },
          borderRadius: 'xl',
          layerStyle: 'surface',
          paddingInline: '3',
          paddingBlock: '2.5',
          fontSize: 'type.12-5',
          boxShadow: 'card',
        }),
        'enter-down',
      ),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'flex-start',
            gap: '2.5',
          }),
        )
        .children(
          h.span
            .class(
              css({
                flex: '1 1 0%',
                lineHeight: 'snug',
              }),
            )
            .children(t.catalog.challenges[challenge.id]?.brief ?? challenge.brief),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.11',
                  color: 'mutedForeground',
                }),
              ),
            )
            .children(
              running
                ? `${clock(elapsed)} / ${clock(challenge.duration)}`
                : clock(challenge.duration),
            ),
        ),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.11',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(targetText(t, challenge)),
      running
        ? meter(h, run.totals.step / stepsOf(challenge), css({ layerStyle: 'primaryFill' }))
        : undefined,
    )
}

const axisRow = (axis: ScoreAxis, run: ChallengeResultRun, h: H<Message>): Content => {
  const t = copy(h)

  const value = run.result[axis]
  return h.div
    .key(axis)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
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
                fontSize: 'type.13',
                fontWeight: 'medium',
              }),
            )
            .children(axisNamesOf(t)[axis]),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  fontSize: 'type.13',
                }),
              ),
            )
            .children(axisValue(t, axis, value)),
        ),
    )
}

export const challengePanel = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (run?._tag !== 'Result' || !challenge) return undefined
  const result = run.result
  const passed = result.passed
  return shell(
    h,
    t,
    t.catalog.challenges[challenge.id]?.name ?? challenge.name,
    [],
    [
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '4',
            paddingInline: '5',
            paddingBottom: '5',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                css({
                  fontSize: 'type.22',
                  fontWeight: 'semibold',
                  letterSpacing: 'title',
                }),
                passed
                  ? css({
                      color: 'ok',
                    })
                  : css({
                      color: 'danger',
                    }),
              ),
            )
            .children(
              passed ? t.challenge.passed : missedText(t, result.missed ?? t.challenge.failed),
            ),
          ...(['cost', 'tail', 'complexity'] as const).map((axis) => axisRow(axis, run, h)),
        ),
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
        .children(
          button(
            h,
            {
              onClick: Message.TitleOpened(),
              variant: 'outline',
              size: 'lg',
              className: css({
                paddingInline: '3.5',
              }),
            },
            t.challenge.challenges,
          ),
          button(
            h,
            {
              onClick: Message.ChallengeRebuilt(),
              size: 'lg',
              className: css({
                paddingInline: '4',
              }),
            },
            t.challenge.rebuild,
          ),
        ),
    ],
    css({ maxWidth: '440px' }),
  )
}
