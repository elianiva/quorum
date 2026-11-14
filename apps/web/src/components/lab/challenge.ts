import { css, cx } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy, type Messages } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Check,
  FastForward,
  Menu,
  Play,
  RotateCcw,
  Hammer,
  Percent,
  Timer,
  TriangleAlert,
  Wallet,
  Waypoints,
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
import { Message } from '@/game/message.ts'
import {
  boardChallenge,
  type ChallengeResultRun,
  type ChallengeRun,
  type Model,
} from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { CHIPS, FIGURE, PANEL, WELL, meter, toneText, type Tone } from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

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
  glyph: Parameters<typeof icon>[1],
  value: string,
  tone: Tone,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Key(name),
      h.Class(
        css({
          display: 'flex',
          height: '2rem',
          alignItems: 'center',
          gap: '0.625rem',
          paddingInline: '0.625rem',
          _compact: {
            flexShrink: '0',
            paddingInline: '0.75rem',
          },
        }),
      ),
    ],
    [
      icon(
        h,
        glyph,
        css({
          width: '0.875rem',
          height: '0.875rem',
          flexShrink: '0',
          color: 'var(--muted-foreground)',
        }),
      ),
      h.span(
        [
          h.Class(
            css({
              width: '72px',
              flexShrink: '0',
              fontSize: 'calc(11.5px*var(--type-scale))',
              color: 'var(--muted-foreground)',
              _compact: {
                display: 'none',
              },
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
                fontSize: 'calc(13.5px*var(--type-scale))',
                lineHeight: '1',
              }),
              toneText(tone),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

/** The live figures: what the Design costs and serves now, and its complexity. */
const figures = (
  model: Model,
  challenge: Challenge,
  ledger: Ledger,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const errors = ledger.errorShare * 100
  const { targets } = challenge
  const margin = ledger.revenue > 0 ? (ledger.revenue - ledger.burn) / ledger.revenue : -1
  const spent =
    challenge.devHours === undefined ? 0 : devHoursOf(challenge.start(), model.board.game)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            '& > :not(:last-child)': {
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'var(--hairline)',
            },
          }),
          WELL,
          CHIPS,
        ),
      ),
    ],
    [
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
        ? h.empty
        : figureRow(
            t.challenge.margin,
            Percent,
            `${Math.round(margin * 100)}%`,
            margin >= targets.margin ? 'ok' : 'danger',
            h,
          ),
      challenge.devHours === undefined
        ? h.empty
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
    ],
  )
}

/** A share as a percent with two significant figures: 1%, 0.5%, 0.001%. */
const percent = (share: number): string => `${Number((share * 100).toPrecision(2))}%`

const kindName = (t: Messages, kind: string): string =>
  t.catalog.kinds[kind as RequestKind].label.toLowerCase()

/** A missed target, as the Simulation words it in English, in the player's language. */
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

/** The code fixes a Design may pay Dev Hours for, while it is built. */
const fixes = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const open = FIXES.filter((fix) => {
    const research = TASKS[fix].research
    return research !== null && has(game, research)
  })
  if (!game.scenario?.tasks || open.length === 0) return h.empty
  const on = serviceOf(game).fixes
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            '& > :not(:last-child)': {
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'var(--hairline)',
            },
          }),
          WELL,
          CHIPS,
        ),
      ),
    ],
    open.map((fix) => {
      const active = on.includes(fix)
      return h.button(
        [
          h.Key(fix),
          h.Type('button'),
          h.AriaPressed(active ? 'true' : 'false'),
          h.OnClick(Message.FixChosen({ fix, on: !active })),
          h.Class(
            cx(
              css({
                display: 'flex',
                height: '2rem',
                alignItems: 'center',
                gap: '0.625rem',
                paddingInline: '0.625rem',
                textAlign: 'left',
                _hover: {
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
                },
                _compact: {
                  paddingInline: '0.75rem',
                },
              }),
              'press',
            ),
          ),
        ],
        [
          icon(
            h,
            active ? Check : Hammer,
            cx(
              css({
                width: '0.875rem',
                height: '0.875rem',
                flexShrink: '0',
              }),
              active
                ? css({
                    color: 'var(--ok)',
                  })
                : css({
                    color: 'var(--muted-foreground)',
                  }),
            ),
          ),
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                }),
              ),
            ],
            [t.catalog.tasks[fix].name],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(12px*var(--type-scale))',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [t.challenge.dH(TASKS[fix].dh)],
          ),
        ],
      )
    }),
  )
}

const actions = (run: ChallengeRun, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          gap: '0.375rem',
          paddingInline: '0.25rem',
          paddingTop: '0.25rem',
        }),
      ),
    ],
    run._tag === 'Building'
      ? [
          button(
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
                  width: '0.875rem',
                  height: '0.875rem',
                }),
              ),
              t.challenge.run,
            ],
            h,
          ),
        ]
      : run._tag === 'Running'
        ? [
            button(
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
                    width: '0.875rem',
                    height: '0.875rem',
                  }),
                ),
                t.challenge.finish,
              ],
              h,
            ),
            button(
              { onClick: Message.ChallengeRebuilt(), variant: 'outline', size: 'sm' },
              [
                icon(
                  h,
                  RotateCcw,
                  css({
                    width: '0.875rem',
                    height: '0.875rem',
                  }),
                ),
                t.challenge.rebuild,
              ],
              h,
            ),
          ]
        : [
            button(
              {
                onClick: Message.PanelOpened({ panel: 'challenge' }),
                size: 'sm',
                className: css({
                  flex: '1 1 0%',
                }),
              },
              t.challenge.result,
              h,
            ),
            button(
              { onClick: Message.ChallengeRebuilt(), variant: 'outline', size: 'sm' },
              [
                icon(
                  h,
                  RotateCcw,
                  css({
                    width: '0.875rem',
                    height: '0.875rem',
                  }),
                ),
                t.challenge.rebuild,
              ],
              h,
            ),
          ],
  )
}

export const challengeHud = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (!run || !challenge) return h.empty
  return h.header(
    [
      h.Class(
        cx(
          css({
            position: 'absolute',
            top: '0.75rem',
            left: '0.75rem',
            zIndex: '20',
            display: 'flex',
            width: '248px',
            flexDirection: 'column',
            gap: '0.25rem',
            padding: '0.375rem',
          }),
          PANEL,
          css({
            _compact: {
              pointerEvents: 'auto',
              position: 'static',
              width: 'auto',
              padding: '0.25rem',
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
              display: 'flex',
              minHeight: '2.25rem',
              alignItems: 'center',
              gap: '0.5rem',
              paddingInline: '0.625rem',
              paddingTop: '0.375rem',
              paddingBottom: '0.5rem',
            }),
          ),
        ],
        [
          button(
            {
              onClick: Message.TitleOpened(),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                marginLeft: '-0.375rem',
                color: 'var(--muted-foreground)',
              }),
              attributes: [h.AriaLabel(t.challenge.challenges), h.Title(t.challenge.challenges)],
            },
            icon(
              h,
              Menu,
              css({
                width: '1rem',
                height: '1rem',
              }),
            ),
            h,
          ),
          h.span(
            [
              h.Class(
                css({
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: 'calc(13px*var(--type-scale))',
                  fontWeight: '600',
                }),
              ),
            ],
            [t.catalog.challenges[challenge.id]?.name ?? challenge.name],
          ),
          model.founder.completed.includes(challenge.id)
            ? h.span(
                [
                  h.Class(
                    css({
                      marginLeft: 'auto',
                    }),
                  ),
                ],
                [
                  icon(
                    h,
                    Check,
                    css({
                      width: '0.875rem',
                      height: '0.875rem',
                      color: 'var(--ok)',
                    }),
                  ),
                ],
              )
            : h.empty,
        ],
      ),
      figures(model, challenge, ledger, h),
      run._tag === 'Building' ? fixes(model, h) : h.empty,
      actions(run, h),
    ],
  )
}

/** The brief and targets in the goal slot; while running, how far the run is. */
export const challengeBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (!run || !challenge) return h.empty
  const running = run._tag !== 'Building'
  const elapsed = run.totals.step * challenge.stepSeconds
  return h.div(
    [
      h.Key(`challenge-${run._tag}`),
      h.Class(
        cx(
          css({
            display: 'flex',
            width: '420px',
            flexDirection: 'column',
            gap: '0.5rem',
            _compact: {
              width: 'auto',
            },
            borderRadius: 'xl',
            layerStyle: 'surface',
            paddingInline: '0.75rem',
            paddingBlock: '0.625rem',
            fontSize: 'calc(12.5px*var(--type-scale))',
            boxShadow: 'card',
          }),
          'enter-down',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  lineHeight: '1.375',
                }),
              ),
            ],
            [t.catalog.challenges[challenge.id]?.brief ?? challenge.brief],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(11px*var(--type-scale))',
                    color: 'var(--muted-foreground)',
                  }),
                ),
              ),
            ],
            [
              running
                ? `${clock(elapsed)} / ${clock(challenge.duration)}`
                : clock(challenge.duration),
            ],
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'calc(11px*var(--type-scale))',
                color: 'var(--muted-foreground)',
              }),
            ),
          ),
        ],
        [targetText(t, challenge)],
      ),
      running
        ? meter(run.totals.step / stepsOf(challenge), css({ layerStyle: 'primaryFill' }), h)
        : h.empty,
    ],
  )
}

const axisRow = (axis: ScoreAxis, run: ChallengeResultRun, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const value = run.result[axis]
  return h.div(
    [
      h.Key(axis),
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
        }),
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
                  fontSize: 'calc(13px*var(--type-scale))',
                  fontWeight: '500',
                }),
              ),
            ],
            [axisNamesOf(t)[axis]],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(13px*var(--type-scale))',
                  }),
                ),
              ),
            ],
            [axisValue(t, axis, value)],
          ),
        ],
      ),
    ],
  )
}

export const challengePanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const run = boardChallenge(model.board)
  const challenge = run ? challengeById(run.id) : undefined
  if (run?._tag !== 'Result' || !challenge) return h.empty
  const result = run.result
  const passed = result.passed
  return shell(
    t.catalog.challenges[challenge.id]?.name ?? challenge.name,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              paddingInline: '1.25rem',
              paddingBottom: '1.25rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  css({
                    fontSize: 'calc(22px*var(--type-scale))',
                    fontWeight: '600',
                    letterSpacing: '-0.03em',
                  }),
                  passed
                    ? css({
                        color: 'var(--ok)',
                      })
                    : css({
                        color: 'var(--danger)',
                      }),
                ),
              ),
            ],
            [passed ? t.challenge.passed : missedText(t, result.missed ?? t.challenge.failed)],
          ),
          ...(['cost', 'tail', 'complexity'] as const).map((axis) => axisRow(axis, run, h)),
        ],
      ),
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
        [
          button(
            {
              onClick: Message.TitleOpened(),
              variant: 'outline',
              size: 'lg',
              className: css({
                paddingInline: '0.875rem',
              }),
            },
            t.challenge.challenges,
            h,
          ),
          button(
            {
              onClick: Message.ChallengeRebuilt(),
              size: 'lg',
              className: css({
                paddingInline: '1rem',
              }),
            },
            t.challenge.rebuild,
            h,
          ),
        ],
      ),
    ],
    css({ maxWidth: '440px' }),
    h,
  )
}
