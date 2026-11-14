import { css, cx } from '@quorum/styled-system/css'
import { copy, insightName, localeOf, localized, type Messages } from '@/i18n/messages.ts'
import {
  ResearchMessage,
  SHEET_DEFAULT,
  SHEET_MAX,
  SHEET_MIN,
  STUDY_QUEUE,
  queueIndex,
} from '@/game/research.ts'
import { Option } from 'effect'
import * as Effect from 'effect/Effect'
import * as Queue from 'effect/Queue'
import * as Stream from 'effect/Stream'
import { Mount } from 'foldkit'
import { DragAndDrop } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  X,
  type IconNode,
  Lock,
  TriangleAlert,
  CircleHelp,
} from 'lucide'
import {
  GLOSSARY,
  MAX_STUDIES,
  RESEARCH,
  isLeverKind,
  leverDh,
  leverGrowthTotal,
  LEVER_REFUND,
  MAX_LEVER_STEP,
  researchList,
  type InsightPool,
  type LeverKind,
  type ResearchDef,
  type ResearchId,
  type ResearchTrack,
} from '@quorum/simulation/catalog'
import { BY_RESEARCH } from '@quorum/simulation/term-links'
import { glossaryUrl } from '@/platform/analytics.ts'
import type { Ledger } from '@quorum/simulation/ledger'
import { has, missingPrerequisites, needs, researchReady } from '@quorum/simulation/lookups'
import { mixOf } from '@quorum/simulation/features'
import { leverRefusal, leverRemoveRefusal } from '@quorum/simulation/work'
import type { Game } from '@quorum/simulation/state'
import {
  capOf,
  limitingPool,
  studySeconds,
  studySpeed,
  studyStall,
  progressOf as studyProgressOf,
  type StudyStall,
} from '@quorum/simulation/studies'
import { compact, sharePercent } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { stallNeedIn, stallReasonIn } from '@/i18n/format.ts'
import { refusalIn } from '@/i18n/refusal.ts'
import { unsampledOf } from '@quorum/simulation/solve-insight'
import { ledgerOf, type Model } from '@/game/model.ts'
import { POOL_ICONS, POOL_ORDER, poolColor, recipeOf } from '@quorum/ui/game/pools'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { badge, type BadgeVariant } from '@quorum/ui/primitives/badge'
import { EYEBROW, FIGURE, FLOAT, PANEL, SCROLL, insightChip, meter } from '@quorum/ui/game/bits'
import { LOOKS, TRACK_ICONS, colorOf, researchMark } from '@quorum/ui/game/research-marks'
import {
  eraName,
  nodeSize,
  researchLayout,
  type Layout,
  type Placed,
} from '@quorum/ui/game/research-layouts'

/** Items that list `id` as a prerequisite. */
const followUps = (id: ResearchId): ReadonlyArray<ResearchDef> =>
  researchList.filter((entry) => entry.requires.includes(id))

type State = 'owned' | 'buy' | 'saving' | 'locked'

// A queued item is saving even while locked: it waits behind its queued prerequisites.
const stateOf = (game: Game, entry: ResearchDef): State =>
  has(game, entry.id)
    ? 'owned'
    : game.studies.some((item) => item.id === entry.id)
      ? 'saving'
      : !researchReady(game, entry.id)
        ? 'locked'
        : 'buy'

/** The item the side pane shows: the player's pick, else the most useful next one. */
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
    boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
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

/** The recipe as pool chips, or a check once researched. */
const price = (entry: ResearchDef, state: State, grey: boolean, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return state === 'owned'
    ? h.span(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '1',
              fontSize: 'calc(11px*var(--type-scale))',
              color: 'ok',
            }),
          ),
        ],
        [
          icon(
            h,
            Check,
            css({
              width: '3',
              height: '3',
            }),
          ),
          t.research.researched,
        ],
      )
    : h.span(
        [
          h.Class(
            cx(
              css({
                display: 'flex',
                width: 'fit-content',
                alignItems: 'center',
                gap: '2',
                fontSize: 'calc(11px*var(--type-scale))',
              }),
              grey
                ? css({
                    color: 'mutedForeground',
                  })
                : '',
            ),
          ),
        ],
        [
          state === 'locked'
            ? icon(
                h,
                Lock,
                css({
                  width: '2.5',
                  height: '2.5',
                }),
              )
            : h.empty,
          ...recipeOf(entry.id).map(([pool, cost]) =>
            insightChip(pool, compact(cost), h, grey, 'plain', insightName(t, pool)),
          ),
        ],
      )
}

/** A Study's duration at the current speed, such as "4 min". */
const duration = (t: Messages, game: Game, entry: ResearchDef): string => {
  const seconds = studySeconds(entry.id) / studySpeed(game)
  return seconds < 90 ? t.units.s(Math.round(seconds)) : t.units.min(Math.round(seconds / 60))
}

/** The three lever steps as a meter, so the step reads at a glance. */
const stepMeter = (step: number, h: HtmlBuilder<Message>): Html =>
  h.span(
    [
      h.Class(
        css({
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
        }),
      ),
      h.AriaHidden(true),
      h.Title(`${step} of ${MAX_LEVER_STEP}`),
    ],
    Array.from({ length: MAX_LEVER_STEP }, (_, index) =>
      h.span(
        [
          h.Key(String(index)),
          h.Class(
            cx(
              css({
                height: '1.5',
                width: '3',
                borderRadius: '9999px',
              }),
              index < step
                ? css({
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 70%, transparent)',
                  })
                : css({
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                  }),
            ),
          ),
        ],
        [],
      ),
    ),
  )

/**
 * A pool's Product lever, under its cost row: what the kind takes today, what the
 * next step would take, what that costs, and the two things the player can do
 * (10 "Product levers"). A Challenge and a guided Sandbox pin their mix, so they
 * show no lever.
 */
const leverRow = (
  game: Game,
  ledger: Ledger,
  pool: InsightPool,
  draw: number,
  blocked: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  if (game.fixedMix || !isLeverKind(pool)) return h.empty
  const t = copy(h)
  const kind = pool as LeverKind
  const step = game.levers[kind] ?? 0
  const share = mixOf(game)[kind] ?? 0
  const next = step + 1
  const last = step >= MAX_LEVER_STEP
  const buildRefusal = leverRefusal(game, kind)
  const removeRefusal = leverRemoveRefusal(game, kind)
  // A pool that limits the Study, or one the player can raise or has raised, keeps the row.
  // Any other hint of a ladder the player cannot climb only crowds the recipe.
  if (!blocked && step <= 0 && buildRefusal !== null) return h.empty
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
  return h.div(
    [
      h.Key(`${pool}-lever`),
      h.Class(
        css({
          marginBlock: '1.5',
          borderRadius: 'lg',
          backgroundColor: 'well',
          paddingInline: '2.5',
          paddingBlock: '2',
          boxShadow: 'well',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2',
            }),
          ),
        ],
        [
          h.p(
            [
              h.Class(
                cx(
                  css({
                    minWidth: '0',
                    flex: '1 1 0%',
                    fontSize: 'calc(12.5px*var(--type-scale))',
                    lineHeight: '1.375',
                    fontWeight: '600',
                  }),
                  blocked
                    ? css({
                        color: 'warn',
                      })
                    : css({
                        color: 'foreground',
                      }),
                ),
              ),
            ],
            [title],
          ),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '1.5',
                  whiteSpace: 'nowrap',
                }),
              ),
            ],
            [
              stepMeter(step, h),
              h.span(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(10.5px*var(--type-scale))',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.levers.count(step, MAX_LEVER_STEP)],
              ),
            ],
          ),
        ],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '1.5',
              fontSize: 'calc(12px*var(--type-scale))',
              lineHeight: '1.375',
              color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
            }),
          ),
        ],
        [reason],
      ),
      h.p(
        [
          h.Class(
            cx(
              css({
                marginTop: '1',
                fontSize: 'calc(11px*var(--type-scale))',
                lineHeight: '1.375',
              }),
              buildable || last
                ? css({
                    color: 'mutedForeground',
                  })
                : css({
                    color: 'warn',
                  }),
            ),
          ),
        ],
        [note],
      ),
      h.div(
        [
          h.Class(
            css({
              marginTop: '2',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
            }),
          ),
        ],
        [
          last
            ? h.empty
            : button(
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
                    fontSize: 'calc(12px*var(--type-scale))',
                  }),
                  attributes: [
                    h.Title(
                      buildRefusal === null
                        ? t.levers.buildStep(next, compact(leverDh(next)))
                        : refusalIn(t, buildRefusal),
                    ),
                  ],
                },
                game.sandbox
                  ? t.levers.setStep(next)
                  : t.levers.buildStep(next, compact(leverDh(next))),
                h,
              ),
          step <= 0
            ? h.empty
            : button(
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
                  attributes: [
                    h.AriaLabel(t.levers.takeOff),
                    h.Title(
                      removeRefusal === null
                        ? t.levers.remove(compact(leverDh(step) * LEVER_REFUND))
                        : refusalIn(t, removeRefusal),
                    ),
                  ],
                },
                t.levers.removeStep,
                h,
              ),
        ],
      ),
    ],
  )
}

/** The item's recipe: each pool's cost, what it holds, and what it earns. */
const costRows = (
  game: Game,
  ledger: Ledger,
  entry: ResearchDef,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)

  const running = game.studies[0]?.id === entry.id
  const limit = running ? limitingPool(game) : null
  return h.section(
    [
      h.Key('cost'),
      h.Class(
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
              gap: '3',
            }),
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [t.research.costLabel]),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [duration(t, game, entry)],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
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
          ),
        ],
        recipeOf(entry.id, game.discounts).flatMap(([pool, cost]) => [
          h.div(
            [
              h.Key(pool),
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3',
                  paddingBlock: '1.5',
                  fontSize: 'calc(12px*var(--type-scale))',
                }),
              ),
            ],
            [
              insightChip(pool, compact(cost), h, false, 'plain', insightName(t, pool)),
              h.span(
                [
                  h.Class(
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
                  ),
                ],
                [t.research.held(compact(game.pools[pool]))],
              ),
              h.span(
                [
                  h.Class(
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
                            fontWeight: '600',
                          })
                        : '',
                    ),
                  ),
                ],
                [t.research.s(ledger.insight[pool].toFixed(1))],
              ),
            ],
          ),
          leverRow(
            game,
            ledger,
            pool,
            cost / (studySeconds(entry.id) / studySpeed(game)),
            pool === limit,
            h,
          ),
        ]),
      ),
    ],
  )
}

/** How far the Design is from a stall's requirement, in the units its meter shows. */
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

/** Why a Study waits, how far the Design has got, and what the queue does meanwhile. */
const requirement = (
  t: Messages,
  stall: StudyStall,
  first: string | null,
  consequence: string | null,
  h: HtmlBuilder<Message>,
): Html => {
  const gap = gapOf(t, stall)
  return h.section(
    [
      h.Class(
        css({
          flexShrink: '0',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'hairline',
          backgroundColor: 'warnSoft',
          paddingInline: '5',
          paddingBlock: '4',
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
              gap: '3',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  fontFamily: 'mono',
                  fontSize: 'calc(10.5px*var(--type-scale))',
                  fontWeight: '500',
                  letterSpacing: '0.08em',
                  color: 'warn',
                  textTransform: 'uppercase',
                }),
              ),
            ],
            [t.research.requirement],
          ),
          gap === null
            ? h.empty
            : h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        fontSize: 'calc(11.5px*var(--type-scale))',
                        fontWeight: '600',
                        color: 'warn',
                      }),
                    ),
                  ),
                ],
                [gap.label],
              ),
        ],
      ),
      h.p(
        [
          h.Class(
            css({
              marginTop: '1.5',
              fontSize: 'calc(12.5px*var(--type-scale))',
              lineHeight: '1.375',
              fontWeight: '600',
              color: 'warn',
            }),
          ),
        ],
        [
          first === null
            ? t.research.cannotRun(stallNeedIn(t, stall))
            : t.research.firstCannotRun(first, stallNeedIn(t, stall)),
        ],
      ),
      gap === null
        ? h.empty
        : h.div(
            [
              h.Class(
                css({
                  marginTop: '2.5',
                }),
              ),
            ],
            [meter(gap.share, css({ backgroundColor: 'warn' }), h)],
          ),
      consequence === null
        ? h.empty
        : h.p(
            [
              h.Class(
                css({
                  marginTop: '2',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  lineHeight: '1.375',
                  color: 'warn',
                  opacity: 0.8,
                }),
              ),
            ],
            [consequence],
          ),
    ],
  )
}

/** A section of related research items, each a row that focuses its item. */
const linkSection = (
  label: string,
  entries: ReadonlyArray<ResearchDef>,
  game: Game,
  h: HtmlBuilder<Message>,
): Html =>
  entries.length === 0
    ? h.empty
    : h.section(
        [
          h.Class(
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
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [label]),
          h.div(
            [
              h.Class(
                css({
                  marginInline: '-0.5rem',
                  marginTop: '2',
                  display: 'flex',
                  flexDirection: 'column',
                }),
              ),
            ],
            entries.map((entry) => linkRow(game, entry, h)),
          ),
        ],
      )

/** A card's icon, name and price or status; `grey` draws it uncoloured. */
const face = (
  game: Game,
  entry: ResearchDef,
  state: State,
  grey: boolean,
  large: boolean,
  far: boolean,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const t = copy(h)

  const open = state !== 'owned' && game.openActions.includes(entry.id)
  return [
    researchMark(entry, 'sm', grey, h),
    h.span(
      [
        h.Class(
          css({
            display: 'flex',
            minWidth: '0',
            flex: '1 1 0%',
            flexDirection: 'column',
            gap: '1',
          }),
        ),
      ],
      [
        h.span(
          [
            h.Class(
              cx(
                css({
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1',
                  fontSize: 'calc(12.5px*var(--type-scale))',
                  lineHeight: '1.25',
                  fontWeight: '600',
                }),
                grey
                  ? css({
                      color: 'mutedForeground',
                    })
                  : '',
              ),
            ),
          ],
          [
            // Two lines fit inside the box by design: the box is wide enough for the
            // longest name in every language at 150% (15 "Accessibility"). The clamp
            // stays as the last guard against a name added later. `auto-phrase` breaks
            // Japanese at a phrase boundary rather than mid-term, where it is supported.
            h.span(
              [
                h.Class(
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
                ),
              ],
              [t.catalog.research[entry.id].name],
            ),
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
              : h.empty,
          ],
        ),
        // Beyond the next Era the card is a silhouette: what the item is for, never its price.
        far
          ? h.span(
              [
                h.Class(
                  css({
                    lineClamp: 1,
                    fontSize: 'calc(10.5px*var(--type-scale))',
                    lineHeight: '1.375',
                    color: 'mutedForeground',
                  }),
                ),
              ],
              [t.catalog.research[entry.id].blurb],
            )
          : price(entry, state, grey, h),
      ],
    ),
  ]
}

/** A card node. Saving up: the card is the progress bar, a coloured copy wiping in from the left. */
const card = (
  game: Game,
  entry: ResearchDef,
  state: State,
  large: boolean,
  far: boolean,
  h: HtmlBuilder<Message>,
) => {
  const share = Math.min(1, studyProgressOf(game.studies.find((item) => item.id === entry.id)))
  const color = colorOf(LOOKS[entry.id])
  return state === 'saving'
    ? [
        ...face(game, entry, state, true, large, far, h),
        h.span(
          [
            h.Key('fill'),
            h.AriaHidden(true),
            h.Class(
              css({
                position: 'absolute',
                inset: '0',
                display: 'flex',
                alignItems: 'center',
                gap: '2.5',
                paddingInline: '2.5',
                paddingBlock: '1',
                transitionProperty: 'clip-path',
                transitionDuration: '500ms',
                transitionTimingFunction: 'linear',
              }),
            ),
            h.Style({
              background: `linear-gradient(to right, color-mix(in oklab, ${color} 8%, var(--raised-top)), color-mix(in oklab, ${color} 22%, var(--raised-top)))`,
              'clip-path': `inset(0 ${(1 - share) * 100}% 0 0)`,
            }),
          ],
          face(game, entry, state, false, large, far, h),
        ),
        h.span(
          [
            h.Key('edge'),
            h.AriaHidden(true),
            h.Class(
              css({
                position: 'absolute',
                insetBlock: '0',
                width: '1.5px',
                transitionProperty: 'left',
                transitionDuration: '500ms',
                transitionTimingFunction: 'linear',
              }),
            ),
            h.Style({ left: `${share * 100}%`, background: color, opacity: '0.55' }),
          ],
          [],
        ),
      ]
    : face(game, entry, state, state === 'locked', large, far, h)
}

/** The interface's type scale: the tree's boxes and spacing grow with it (15 "Accessibility"). */
const scaleOf = (model: Model): number => (model.prefs.text === 'large' ? 1.5 : 1)

const node = (model: Model, place: Placed, focused: boolean, h: HtmlBuilder<Message>): Html => {
  const game = model.board.game
  const { entry } = place
  const state = stateOf(game, entry)
  const large = model.prefs.text === 'large'
  const size = nodeSize(scaleOf(model))
  // Beyond the next Era the item is a silhouette: a name and what it is for, no price,
  // and no click. The player can still want it before research makes it a choice.
  const far = entry.era > game.stage + 1 && state === 'locked'
  const style = h.Style({
    left: `${place.x}px`,
    top: `${place.y}px`,
    width: `${size.w}px`,
    height: `${size.h}px`,
  })
  const shape = h.Class(
    cx(
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
        transitionDuration: '150ms',
        transitionTimingFunction: 'out',
      }),
      NODE_CLASS[state],
      focused
        ? css({
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineOffset: '2px',
            outlineColor: 'primaryStrong',
          })
        : css({
            outlineWidth: '2px',
            outlineStyle: 'solid',
            outlineOffset: '2px',
            outlineColor: 'transparent',
          }),
      far
        ? css({
            opacity: 0.45,
          })
        : '',
    ),
  )
  const body = card(game, entry, state, large, far, h)
  return far
    ? h.div(
        [
          h.Key(entry.id),
          h.DataAttribute('research', entry.id),
          h.AriaDisabled(true),
          style,
          shape,
        ],
        body,
      )
    : h.button(
        [
          h.Key(entry.id),
          h.Type('button'),
          h.DataAttribute('research', entry.id),
          h.AriaPressed(focused ? 'true' : 'false'),
          h.OnClick(
            Message.ResearchChanged({ message: ResearchMessage.Focused({ id: entry.id }) }),
          ),
          h.OnDoubleClick(
            Message.ResearchChanged({ message: ResearchMessage.Bought({ id: entry.id }) }),
          ),
          style,
          shape,
        ],
        body,
      )
}

const wires = (model: Model, layout: Layout, focus: ResearchDef, h: HtmlBuilder<Message>): Html =>
  h.svg(
    [
      h.AriaHidden(true),
      h.Xmlns('http://www.w3.org/2000/svg'),
      h.Class(
        css({
          pointerEvents: 'none',
          position: 'absolute',
          inset: '0',
          overflow: 'visible',
        }),
      ),
      h.Width(String(layout.width)),
      h.Height(String(layout.height)),
      h.Fill('none'),
    ],
    layout.wires.map((wire) => {
      const done = wire.from
        ? has(model.board.game, wire.from)
        : wire.to
          ? has(model.board.game, wire.to)
          : false
      const lit = focus.id === wire.to || focus.id === wire.from
      return h.path(
        [
          h.Key(wire.key),
          h.D(wire.d),
          h.StrokeWidth(lit ? '2.25' : wire.root ? '2' : '1.5'),
          h.StrokeLinecap('round'),
          h.StrokeLinejoin('round'),
          h.Class(
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
                transitionDuration: '150ms',
                transitionTimingFunction: 'out',
              }),
            ),
          ),
          ...(done || wire.root ? [] : [h.Attribute('stroke-dasharray', '3 4')]),
        ],
        [],
      )
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
  h: HtmlBuilder<Message>,
) => {
  const { owned, total } = progressOf(game, track)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
          }),
          className,
        ),
      ),
    ],
    [
      h.span(
        [
          h.Class(
            css({
              height: '1',
              flex: '1 1 0%',
              overflow: 'hidden',
              borderRadius: '9999px',
              backgroundColor: 'well',
              boxShadow: 'well',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  display: 'block',
                  height: '100%',
                  borderRadius: '9999px',
                  backgroundColor: 'ok',
                }),
              ),
              h.Style({ width: `${(owned / total) * 100}%` }),
            ],
            [],
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                fontSize: 'calc(10.5px*var(--type-scale))',
                color: 'mutedForeground',
              }),
            ),
          ),
        ],
        [`${owned}/${total}`],
      ),
    ],
  )
}

const eraLabel = (game: Game, era: number, h: HtmlBuilder<Message>) => [
  era > game.stage
    ? icon(
        h,
        Lock,
        css({
          width: '3',
          height: '3',
        }),
      )
    : h.empty,
  copy(h).catalog.eras[era]?.name ?? eraName(era),
  era === game.stage
    ? h.span(
        [
          h.Class(
            css({
              width: '1.5',
              height: '1.5',
              borderRadius: '9999px',
              backgroundColor: 'ok',
            }),
          ),
        ],
        [],
      )
    : h.empty,
]

const backdrop = (model: Model, layout: Layout, h: HtmlBuilder<Message>) => {
  const t = copy(h)

  const game = model.board.game
  // One band per Era, the current one tinted and the ones ahead washed out.
  const bands = layout.bands.map((band) =>
    h.div(
      [
        h.Key(`era-${band.era}`),
        h.Class(
          cx(
            css({
              position: 'absolute',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'hairline',
            }),
            band.era === game.stage
              ? css({
                  backgroundColor:
                    'color-mix(in oklab, var(--ok) 3.5000000000000004%, transparent)',
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
        ),
        h.Style({
          left: `${band.x}px`,
          top: `${band.y}px`,
          width: `${band.w}px`,
          height: `${band.h}px`,
        }),
      ],
      [
        h.span(
          [
            h.Class(
              cx(
                EYEBROW,
                css({
                  position: 'absolute',
                  top: '3',
                  left: '5',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                }),
                band.era === game.stage
                  ? css({
                      color: 'foreground',
                    })
                  : '',
              ),
            ),
          ],
          eraLabel(game, band.era, h),
        ),
      ],
    ),
  )
  const roots = layout.tracks.map((track) =>
    h.div(
      [
        h.Key(`root-${track.track}`),
        h.Class(
          css({
            position: 'absolute',
            display: 'flex',
            width: '180px',
            translate: '-50% -50%',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2',
          }),
        ),
        h.Style({ left: `${track.x}px`, top: `${track.y}px` }),
      ],
      [
        h.span(
          [
            h.Class(
              css({
                display: 'grid',
                width: '14',
                height: '14',
                placeItems: 'center',
                borderRadius: '2xl',
                backgroundColor: 'card',
                boxShadow: 'card',
              }),
            ),
          ],
          [
            icon(
              h,
              TRACK_ICONS[track.track],
              css({
                width: '6',
                height: '6',
              }),
            ),
          ],
        ),
        h.span(
          [
            h.Class(
              css({
                fontSize: 'calc(14px*var(--type-scale))',
                fontWeight: '600',
              }),
            ),
          ],
          [t.catalog.researchTracks[track.track].label],
        ),
        progressBar(game, track.track, 'w-28', h),
      ],
    ),
  )
  return [...bands, ...roots]
}

/**
 * The screen scrolls like a page. It opens with the focused item in view,
 * and scrolls to an item when the player focuses one that is off screen.
 */
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

/** Opens the tree scrolled to the focused item; the Research test resolves it by name. */
export const ResearchScroll = Mount.define('ResearchScroll', {
  messages: [Message.Synced],
  execute: ({ element }) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const host = element as HTMLElement
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
        return { watch, events }
      }),
      ({ watch, events }) =>
        Effect.sync(() => {
          watch.disconnect()
          events.abort()
        }),
    ).pipe(Effect.as(Message.Synced())),
})

const linkRow = (game: Game, entry: ResearchDef, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const far = entry.era > game.stage + 1 && !has(game, entry.id)
  const inner = [
    researchMark(entry, 'sm', stateOf(game, entry) === 'locked', h),
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
      [t.catalog.research[entry.id].name],
    ),
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
    ? h.div(
        [
          h.Key(entry.id),
          h.AriaDisabled(true),
          h.Class(
            css({
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: '2.5',
              paddingInline: '2',
              paddingBlock: '1.5',
            }),
          ),
        ],
        inner,
      )
    : h.button(
        [
          h.Key(entry.id),
          h.Type('button'),
          h.OnClick(
            Message.ResearchChanged({ message: ResearchMessage.Focused({ id: entry.id }) }),
          ),
          h.Class(
            css({
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: '2.5',
              borderRadius: 'lg',
              paddingInline: '2',
              paddingBlock: '1.5',
              textAlign: 'left',
              fontSize: 'calc(12.5px*var(--type-scale))',
              _hover: {
                backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
              },
            }),
          ),
        ],
        inner,
      )
}

/** One (?) link per term behind the item; each opens its page on the wiki. */
const terms = (entry: ResearchDef, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const entries = (BY_RESEARCH[entry.id] ?? []).flatMap((id) =>
    GLOSSARY.filter((term) => term.id === id),
  )
  return entries.length > 0
    ? h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5',
            }),
          ),
        ],
        entries.map((term) =>
          h.a(
            [
              h.Key(term.id),
              h.Href(glossaryUrl(term.id, localeOf(h))),
              h.Target('_blank'),
              h.Rel('noreferrer noopener'),
              h.Title(t.research.glossary(t.catalog.glossary[term.id]?.term ?? term.term)),
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1',
                  borderRadius: 'md',
                  backgroundColor: 'nested',
                  paddingInline: '1.5',
                  paddingBlock: '0.5',
                  fontSize: 'calc(11.5px*var(--type-scale))',
                  color: 'mutedForeground',
                  _hover: {
                    color: 'foreground',
                  },
                }),
              ),
            ],
            [
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
            ],
          ),
        ),
      )
    : h.empty
}

/**
 * How many rows a queue row slides for a drag from `from` to `to`. Rows keep their
 * order in the DOM, so the queue can show where the drop lands without the rows
 * moving under the pointer.
 */
const queueSlide = (index: number, from: number, to: number): number => {
  // The dragged row goes down to the slot the drop leaves it in. The rows between it
  // and that slot step one place back toward where it started, so the slot follows
  // the pointer and the rows never cross it.
  if (index === from) return to - from
  const without = index > from ? index - 1 : index
  return (without < to ? without : without + 1) - index
}

/** A small icon button in the queue. */
const queueButton = (
  label: string,
  glyph: IconNode,
  message: Message,
  enabled: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  button(
    {
      onClick: message,
      isDisabled: !enabled,
      variant: 'ghost',
      size: 'icon-xs',
      className: css({
        color: 'mutedForeground',
      }),
      attributes: [h.AriaLabel(label), h.Title(label)],
    },
    icon(
      h,
      glyph,
      css({
        width: '3.5',
        height: '3.5',
      }),
    ),
    h,
  )

/** The Study queue, in order: the first one runs. Drag a row to reorder it. */
const queuePanel = (model: Model, focus: ResearchId, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const studies = game.studies
  const ledger = ledgerOf(model)
  const drag = model.board.research.drag
  const dragging = DragAndDrop.isDragging(drag)
  const draggedId = DragAndDrop.maybeDraggedItemId(drag)
  // Where the drop leaves the dragged row. The rows stay put in the DOM and slide by
  // whole rows, so the queue shows the gap without moving the target under the pointer.
  const from = Option.match(draggedId, {
    onNone: () => -1,
    onSome: (id) => studies.findIndex((item) => item.id === id),
  })
  const landing =
    from < 0
      ? null
      : Option.match(DragAndDrop.maybeDropTarget(drag), {
          onNone: () => null,
          onSome: ({ containerId, index }) =>
            containerId !== STUDY_QUEUE
              ? null
              : Math.min(studies.length - 1, queueIndex(from, index)),
        })
  const overQueue = landing !== null
  if (studies.length === 0) return h.empty
  return h.section(
    [
      h.Key('queue'),
      ...(dragging ? [h.DataAttribute('research-drag-active', '')] : []),
      h.Class(
        css({
          display: 'flex',
          maxHeight: '30%',
          flexShrink: '0',
          flexDirection: 'column',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'hairline',
        }),
      ),
      // The queue is a listbox, so the window-level shortcuts ignore it; Escape still closes
      // the panel unless a drag is running (the drag component handles that Escape itself).
      h.OnKeyDownPreventDefault((key) =>
        key === 'Escape' && !dragging ? Option.some(Message.PanelClosed()) : Option.none(),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexShrink: '0',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              gap: '3',
              paddingInline: '5',
              paddingTop: '4',
              paddingBottom: '2',
            }),
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [t.research.studyQueue]),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'calc(11px*var(--type-scale))',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [t.research.queueCount(studies.length, MAX_STUDIES)],
          ),
        ],
      ),
      h.div(
        [
          ...DragAndDrop.droppable(STUDY_QUEUE, t.research.studyQueue),
          // Rows ring together while a drop lands, inset from the panel edge.
          h.Class(
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
                  boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--primary)',
                }),
            ),
          ),
        ],
        [
          ...studies.map((item, index) => {
            const entry = localized(RESEARCH[item.id], t.catalog.research[item.id])
            const stall = studyStall(game, ledger, item.id)
            const isDragged = Option.exists(draggedId, (id) => id === item.id)
            const slide = landing === null ? 0 : queueSlide(index, from, landing)
            // The dragged row holds the slot the drop leaves it in: a hint of the icon
            // under the cursor's ghost, or the whole row when the keyboard moves it.
            const slot = isDragged && landing !== null
            const keyboard = drag.dragState._tag === 'KeyboardDragging'
            // Rows share one height, so a row slides by its own height plus the gap
            // between rows; a transition retargets it when the pointer moves on.
            const offset =
              slide === 0 ? [] : [h.Style({ translate: `0 calc(${slide} * (100% + 0.125rem))` })]
            return h.div(
              [
                h.Key(item.id),
                ...offset,
                h.Class(
                  cx(
                    css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1',
                      borderRadius: 'lg',
                      paddingLeft: '1',
                    }),
                    // A pointer drag slides its rows; the keyboard moves one at once.
                    dragging &&
                      !keyboard &&
                      css({
                        transitionProperty: 'translate',
                        transitionDuration: '150ms',
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
                ),
              ],
              [
                // The icon is the drag handle, so the row's buttons keep their own keys.
                h.span(
                  [
                    ...DragAndDrop.draggable(
                      {
                        model: drag,
                        toParentMessage: (message) =>
                          Message.ResearchChanged({
                            message: ResearchMessage.DragChanged({ message }),
                          }),
                        itemId: item.id,
                        containerId: STUDY_QUEUE,
                        index,
                      },
                      h,
                    ),
                    ...DragAndDrop.sortable(item.id),
                    h.AriaLabel(t.research.reorder(entry.name)),
                    h.Title(t.research.dragToReorder),
                    h.Class(
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
                    ),
                  ],
                  [researchMark(entry, 'sm', false, h)],
                ),
                h.button(
                  [
                    h.Type('button'),
                    h.OnClick(
                      Message.ResearchChanged({
                        message: ResearchMessage.Focused({ id: item.id }),
                      }),
                    ),
                    h.Class(
                      css({
                        display: 'flex',
                        minWidth: '0',
                        flex: '1 1 0%',
                        alignItems: 'center',
                        gap: '2',
                        borderRadius: 'md',
                        paddingBlock: '1',
                        textAlign: 'left',
                        fontSize: 'calc(12.5px*var(--type-scale))',
                        _hover: {
                          color: 'foreground',
                        },
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
                            fontWeight: '500',
                          }),
                        ),
                      ],
                      [t.catalog.research[entry.id].name],
                    ),
                    h.span(
                      [
                        ...(stall ? [h.Title(stallReasonIn(t, stall))] : []),
                        h.Class(
                          cx(
                            FIGURE,
                            css({
                              marginLeft: 'auto',
                              display: 'flex',
                              flexShrink: '0',
                              alignItems: 'center',
                              gap: '1',
                              fontSize: 'calc(11.5px*var(--type-scale))',
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
                        stall
                          ? t.research.cannotRunShort
                          : `${Math.floor(Math.min(1, studyProgressOf(item)) * 100)}%`,
                      ],
                    ),
                  ],
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
              ],
            )
          }),
          Option.match(DragAndDrop.ghostStyle(drag), {
            onNone: () => h.empty,
            onSome: (style) =>
              Option.match(draggedId, {
                onNone: () => h.empty,
                onSome: (id) => {
                  const entry = localized(
                    RESEARCH[id as ResearchId],
                    t.catalog.research[id as ResearchId],
                  )
                  return h.div(
                    [
                      h.AriaHidden(true),
                      h.Style(style),
                      h.Class(
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
                            fontSize: 'calc(12.5px*var(--type-scale))',
                            fontWeight: '500',
                          }),
                        ),
                      ),
                    ],
                    [researchMark(entry, 'sm', false, h), t.catalog.research[entry.id].name],
                  )
                },
              }),
          }),
        ],
      ),
    ],
  )
}

/** The tree keeps this much of the panel, so the pane cannot squeeze it to nothing. */
const TREE_MIN = 420

/** The pane's bounds for this window: the fixed range, less whatever the tree needs. */
const sheetBounds = (panel: number): Readonly<{ min: number; max: number }> => ({
  min: SHEET_MIN,
  max: Math.max(SHEET_MIN, Math.min(SHEET_MAX, panel - TREE_MIN)),
})

const clampSheet = (width: number, panel: number): number => {
  const { min, max } = sheetBounds(panel)
  return Math.round(Math.max(min, Math.min(max, width)))
}

/** Drag or step the pane's edge. A drag sends a width per pointer move; update.ts keeps those out of the log. */
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
  // A double click puts the pane back where it started.
  host.addEventListener('dblclick', () => offer(clampSheet(SHEET_DEFAULT, panelWidth())), {
    signal: events.signal,
  })
  host.addEventListener('keydown', key, { signal: events.signal })
  return () => events.abort()
}

export const ResearchResize = Mount.defineStream('ResearchResize', {
  args: {},
  messages: [Message.ResearchChanged, Message.Synced],
  execute: ({ element }) =>
    Stream.callback<ReturnType<typeof Message.ResearchChanged>>((queue) =>
      Effect.gen(function* () {
        const offer = (width: number) =>
          Queue.offerUnsafe(
            queue,
            Message.ResearchChanged({ message: ResearchMessage.SheetResized({ width }) }),
          )
        yield* Effect.acquireRelease(
          Effect.sync(() => attachResize(element as HTMLElement, offer)),
          (dispose) => Effect.sync(dispose),
        )
        return yield* Effect.never
      }),
    ),
})

const detail = (model: Model, entry: ResearchDef, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const queued = game.studies.findIndex((item) => item.id === entry.id)
  const state = stateOf(game, entry)
  const open = state !== 'owned' && game.openActions.includes(entry.id)
  const track = t.catalog.researchTracks[entry.track].label
  // A locked item queues with its missing prerequisites (10 "Studies"), once every one is open.
  const chain = state === 'locked' ? missingPrerequisites(game, entry.id) : []
  const era = Math.max(entry.era, ...chain.map((id) => RESEARCH[id].era))
  const ledger = ledgerOf(model)
  // The first Study that cannot finish: the item's own, or one that queueing it would add.
  const stalled =
    state === 'owned' || era > game.stage
      ? undefined
      : [...chain, entry.id]
          .map((id) => ({ id, stall: studyStall(game, ledger, id) }))
          .find((item) => item.stall !== null)
  const label =
    state === 'owned'
      ? t.research.researched
      : state === 'buy'
        ? stalled?.stall
          ? t.research.queueStudy(duration(t, game, entry))
          : t.research.startStudy(duration(t, game, entry))
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
                  : t.research.studying(Math.floor(studyProgressOf(game.studies[0]) * 100))
  const first = stalled && stalled.id !== entry.id ? t.catalog.research[stalled.id].name : null
  const consequence =
    first === null
      ? queued === 0
        ? t.research.atTheFront
        : queued > 0
          ? t.research.everyStudyBehindItWaits
          : t.research.queueToStart
      : null
  const queueable = era <= game.stage && chain.length > 0
  const follow = followUps(entry.id)
  const status: Readonly<{ label: string; tone: BadgeVariant }> =
    state === 'owned'
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
  return h.aside(
    [
      h.Key('detail'),
      h.DataAttribute('exit', 'gesture'),
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
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
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  height: '1',
                  width: '10',
                  borderRadius: '9999px',
                  backgroundColor: 'color-mix(in oklab, var(--foreground) 15%, transparent)',
                }),
              ),
            ],
            [],
          ),
        ],
      ),
      // The pane's edge: drag it, or step it with the arrow keys. Home and End go to the bounds.
      h.div(
        [
          h.Key('resize'),
          h.Role('separator'),
          h.AriaOrientation('vertical'),
          h.AriaLabel(t.research.resizePane),
          h.Title(t.research.resizePane),
          h.AriaValuemin(SHEET_MIN),
          h.AriaValuemax(SHEET_MAX),
          h.AriaValuenow(Math.round(model.board.research.sheetWidth)),
          h.Tabindex(0),
          h.OnMount(ResearchResize({})),
          h.Class(
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
          ),
        ],
        [
          h.span(
            [
              h.Class(
                css({
                  pointerEvents: 'none',
                  position: 'absolute',
                  insetBlock: '0',
                  left: '0',
                  width: '0.5',
                  backgroundColor: 'transparent',
                  transitionProperty:
                    'color, background-color, border-color, text-decoration-color, fill, stroke',
                  transitionDuration: '150ms',
                  transitionTimingFunction: 'out',
                  '.group:hover &': {
                    backgroundColor: 'color-mix(in oklab, var(--foreground) 20%, transparent)',
                  },
                  '.group[data-resizing] &': {
                    backgroundColor: 'primaryStrong',
                  },
                }),
              ),
            ],
            [],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
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
          ),
        ],
        [
          researchMark(entry, 'lg', state === 'locked', h),
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  flexDirection: 'column',
                  gap: '1',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    css({
                      display: 'flex',
                      minWidth: '0',
                      alignItems: 'center',
                      gap: '2',
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
                          fontSize: 'calc(17px*var(--type-scale))',
                          lineHeight: '1.25',
                          fontWeight: '600',
                          letterSpacing: '-0.025em',
                        }),
                      ),
                    ],
                    [t.catalog.research[entry.id].name],
                  ),
                  badge(
                    {
                      variant: status.tone,
                      className: css({
                        flexShrink: '0',
                      }),
                    },
                    [status.label],
                    h,
                  ),
                ],
              ),
              h.span(
                [h.Class(EYEBROW)],
                [`${track} · ${t.catalog.eras[entry.era]?.name ?? eraName(entry.era)}`],
              ),
            ],
          ),
          button(
            {
              onClick: Message.PanelClosed(),
              variant: 'ghost',
              size: 'icon-sm',
              className: css({
                flexShrink: '0',
                color: 'mutedForeground',
              }),
              attributes: [h.AriaLabel(t.research.closeEsc), h.Title(t.research.closeEsc)],
            },
            icon(
              h,
              X,
              css({
                width: '4',
                height: '4',
              }),
            ),
            h,
          ),
        ],
      ),
      stalled?.stall ? requirement(t, stalled.stall, first, consequence, h) : h.empty,
      queuePanel(model, entry.id, h),
      h.div(
        [
          h.Key(entry.id),
          h.Class(
            cx(
              css({
                minHeight: '0',
                flex: '1 1 0%',
                overflow: 'auto',
                scrollbarWidth: 'thin',
              }),
              'enter-pop',
            ),
          ),
        ],
        [
          h.section(
            [
              h.Class(
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
              ),
            ],
            [
              h.p(
                [
                  h.Class(
                    css({
                      fontSize: 'calc(13px*var(--type-scale))',
                      lineHeight: '1.625',
                      color: 'color-mix(in oklab, var(--foreground) 85%, transparent)',
                    }),
                  ),
                ],
                [t.catalog.research[entry.id].blurb],
              ),
              h.div(
                [
                  h.Class(
                    css({
                      marginTop: '3',
                    }),
                  ),
                ],
                [terms(entry, h)],
              ),
            ],
          ),
          open
            ? h.section(
                [
                  h.Class(
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
                  ),
                ],
                [
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '2',
                          fontSize: 'calc(12px*var(--type-scale))',
                          lineHeight: '1.375',
                          color: 'warn',
                        }),
                      ),
                    ],
                    [
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
                    ],
                  ),
                ],
              )
            : h.empty,
          state === 'owned' ? h.empty : costRows(game, ledger, entry, h),
          linkSection(
            t.research.requires,
            entry.requires.map((id) => RESEARCH[id]),
            game,
            h,
          ),
          linkSection(t.research.leadsTo, follow, game, h),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexShrink: '0',
              gap: '2',
              borderTopWidth: '1px',
              borderTopStyle: 'solid',
              borderColor: 'hairline',
              padding: '3',
            }),
          ),
        ],
        [
          button(
            {
              onClick: Message.ResearchChanged({
                message:
                  queued > 0
                    ? ResearchMessage.StudyPrioritized({ id: entry.id })
                    : ResearchMessage.Bought({ id: entry.id }),
              }),
              isDisabled: !(state === 'buy' || queueable || (state === 'saving' && queued > 0)),
              size: 'lg',
              variant: state === 'buy' || queueable || queued > 0 ? 'default' : 'outline',
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
                : h.empty,
              label,
            ],
            h,
          ),
          queued >= 0
            ? button(
                {
                  onClick: Message.ResearchChanged({
                    message: ResearchMessage.StudyCancelled({ id: entry.id }),
                  }),
                  size: 'lg',
                  variant: 'outline',
                },
                [t.research.cancel],
                h,
              )
            : h.empty,
        ],
      ),
    ],
  )
}

/**
 * Pools in reach: the one the running Study waits on, then the busiest few.
 * The deck answers two questions at a glance, so it stays four chips wide.
 */
const DECK_POOLS = 4

/** One pool in the open deck: its mark, name, figure, and how full it is. */
const poolCell = (
  game: Game,
  ledger: Ledger,
  pool: InsightPool,
  blocked: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const t = copy(h)
  const held = game.pools[pool]
  const cap = capOf(game, ledger, pool)
  const share = cap > 0 ? Math.min(1, held / cap) : 0
  return h.div(
    [
      h.Key(pool),
      h.DataAttribute('deck-pool', pool),
      h.Title(`${insightName(t, pool)} ${t.research.outOf(compact(held), compact(cap))}`),
      h.Class(
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
              boxShadow: 'inset 0 0 0 1px color-mix(in oklch,var(--warn) 38%,transparent)',
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
              width: '3',
              height: '3',
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
              fontSize: 'calc(10.5px*var(--type-scale))',
              color: 'mutedForeground',
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
              css({
                fontSize: 'calc(11px*var(--type-scale))',
              }),
              blocked &&
                css({
                  fontWeight: '600',
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
            css({
              position: 'absolute',
              insetInline: '1.5',
              bottom: '1',
              height: '3px',
              overflow: 'hidden',
              borderRadius: '9999px',
              backgroundColor: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  css({
                    display: 'block',
                    height: '100%',
                    borderRadius: '9999px',
                  }),
                  blocked
                    ? css({
                        backgroundColor: 'danger',
                      })
                    : css({
                        backgroundColor: 'color-mix(in oklab, var(--foreground) 40%, transparent)',
                      }),
                ),
              ),
              h.Style({ width: `${share * 100}%` }),
            ],
            [],
          ),
        ],
      ),
    ],
  )
}

/** The pool the running Study waits on, shown as what it holds of what it needs. */
const pinnedChip = (game: Game, pool: InsightPool, need: number, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const held = game.pools[pool]
  // A pool with enough for the Study is one figure like the rest; a short one says what it lacks.
  const blocked = held < need
  const heldLabel = compact(held)
  const needLabel = compact(need)
  const figure = blocked ? `${heldLabel}/${needLabel}` : heldLabel
  return h.span(
    [
      h.DataAttribute('deck-pin', pool),
      h.Title(`${insightName(t, pool)} ${t.research.outOf(heldLabel, needLabel)}`),
      h.AriaLabel(`${insightName(t, pool)} ${t.research.outOf(heldLabel, needLabel)}`),
      h.Class(
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
            fontSize: 'calc(12.5px*var(--type-scale))',
            whiteSpace: 'nowrap',
          }),
          blocked &&
            css({
              backgroundColor: 'warnSoft',
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
              width: '3',
              height: '3',
              flexShrink: '0',
            }),
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            css({
              fontSize: 'calc(11px*var(--type-scale))',
              color: 'mutedForeground',
            }),
          ),
        ],
        [t.catalog.pools[pool].label],
      ),
      h.span(
        [
          h.Class(
            blocked
              ? css({
                  fontWeight: '600',
                  color: 'danger',
                })
              : '',
          ),
        ],
        [figure],
      ),
    ],
  )
}

/**
 * The pools, off the top of the screen and onto the canvas: a deck in the
 * tree's corner that names the pool the Study waits on, then the busiest few,
 * and opens every pool in place. The list folds away under the row (theme.css),
 * so the card keeps its width and the row never moves while it grows.
 */
const poolDeck = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const open = model.board.research.poolsOpen
  const running = game.studies[0]
  const limit = running ? limitingPool(game) : null
  const need =
    running && limit
      ? (recipeOf(running.id, game.discounts).find(([pool]) => pool === limit)?.[1] ?? 0)
      : 0
  const rest = POOL_ORDER.filter((pool) => pool !== limit && game.pools[pool] >= 1)
    .toSorted((a, b) => ledger.insight[b] - ledger.insight[a])
    .slice(0, limit ? DECK_POOLS : DECK_POOLS + 1)
  return h.div(
    [
      h.Key('deck'),
      // Pinned to the corner, so the top edge moves as the list opens.
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
            cx(
              PANEL,
              css({
                display: 'flex',
                flexDirection: 'column',
                padding: '2',
              }),
            ),
          ),
        ],
        [
          // Always mounted, so the list can fold away instead of popping out of the row.
          h.div(
            [
              h.Key('deck-pools'),
              h.Role('group'),
              h.AriaLabel(t.research.pools),
              h.AriaHidden(!open),
              h.Inert(!open),
              h.DataAttribute('open', open ? 'true' : 'false'),
              h.Class('deck-pools'),
            ],
            [
              h.div(
                [h.Class('deck-pools-clip')],
                [
                  h.div(
                    [
                      h.Class(
                        css({
                          display: 'grid',
                          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                          columnGap: '1.5',
                          rowGap: '0.5',
                          paddingBottom: '2',
                        }),
                      ),
                    ],
                    POOL_ORDER.map((pool) =>
                      poolCell(game, ledger, pool, pool === limit && need > game.pools[pool], h),
                    ),
                  ),
                ],
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
                  columnGap: '3',
                  rowGap: '1',
                }),
              ),
            ],
            [
              limit ? pinnedChip(game, limit, need, h) : h.empty,
              ...rest.map((pool) =>
                insightChip(
                  pool,
                  compact(game.pools[pool]),
                  h,
                  false,
                  'plain',
                  insightName(t, pool),
                ),
              ),
              h.button(
                [
                  h.Type('button'),
                  h.DataAttribute('deck-toggle', ''),
                  h.Title(open ? t.research.hidePools : t.research.showPools),
                  h.AriaExpanded(open),
                  h.OnClick(Message.ResearchChanged({ message: ResearchMessage.PoolsToggled() })),
                  h.Class(
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
                        fontSize: 'calc(11.5px*var(--type-scale))',
                        boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
                        _hover: {
                          backgroundColor: 'well',
                        },
                      }),
                      'press',
                    ),
                  ),
                ],
                [
                  // Both labels share one cell, so the longer one sets the width in either state
                  // and the deck does not resize as the label changes.
                  h.span(
                    [
                      h.Class(
                        css({
                          display: 'grid',
                          justifyItems: 'center',
                        }),
                      ),
                    ],
                    [
                      h.span(
                        [
                          h.Class(
                            css({
                              gridColumnStart: '1',
                              gridRowStart: '1',
                            }),
                          ),
                        ],
                        [open ? t.research.fewerPools : t.research.allPools(POOL_ORDER.length)],
                      ),
                      h.span(
                        [
                          h.AriaHidden(true),
                          h.Class(
                            css({
                              visibility: 'hidden',
                              gridColumnStart: '1',
                              gridRowStart: '1',
                            }),
                          ),
                        ],
                        [t.research.allPools(POOL_ORDER.length)],
                      ),
                    ],
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
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  )
}

export const researchPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const focus = focusOf(model)
  const layout = researchLayout(scaleOf(model))
  const unsampled = unsampledOf(ledgerOf(model))
  return h.div(
    [
      h.Key('research'),
      h.DataAttribute('research-panel', ''),
      h.DataAttribute('exit', 'gesture'),
      h.Style({ '--sheet-w': `${model.board.research.sheetWidth}px` }),
      h.Class(
        cx(
          css({
            position: 'absolute',
            inset: '0',
            zIndex: '30',
            backgroundColor: 'canvas',
          }),
          'enter-backdrop',
        ),
      ),
    ],
    [
      h.div(
        [
          h.Class(
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
          ),
        ],
        [
          // A page heading, not a bar: no fill and no rule, so the tree keeps the height.
          h.div(
            [
              h.Class(
                css({
                  display: 'flex',
                  height: '11',
                  flexShrink: '0',
                  alignItems: 'center',
                  gap: '3',
                  paddingInline: '4',
                }),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      flexShrink: '0',
                      fontSize: 'calc(17px*var(--type-scale))',
                      fontWeight: '600',
                      letterSpacing: '-0.025em',
                    }),
                  ),
                ],
                [t.research.research],
              ),
              // Traffic no tap samples earns nothing and shows nothing: the first thing to fix
              // when research drags (12 "The cost of seeing").
              unsampled.share >= 0.01
                ? h.span(
                    [
                      h.Class(
                        css({
                          marginLeft: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1',
                          fontSize: 'calc(11.5px*var(--type-scale))',
                          color: 'warn',
                        }),
                      ),
                      h.Title(t.hud.unsampledHint),
                    ],
                    [
                      icon(
                        h,
                        TriangleAlert,
                        css({
                          width: '3',
                          height: '3',
                        }),
                      ),
                      t.hud.unsampled(Math.round(unsampled.share * 100)),
                    ],
                  )
                : h.empty,
            ],
          ),
          h.div(
            [
              h.Class(
                css({
                  position: 'relative',
                  minHeight: '0',
                  flex: '1 1 0%',
                }),
              ),
            ],
            [
              h.div(
                [
                  h.Key('scroll'),
                  h.OnMount(ResearchScroll()),
                  h.Class(
                    cx(
                      css({
                        position: 'absolute',
                        inset: '0',
                        cursor: 'grab',
                      }),
                      SCROLL,
                    ),
                  ),
                ],
                [
                  // Room below for the detail sheet on a narrow screen.
                  h.div(
                    [
                      h.Class(
                        css({
                          width: 'fit-content',
                          padding: '4',
                          _compact: {
                            paddingBottom: '68vh',
                          },
                        }),
                      ),
                    ],
                    [
                      h.div(
                        [
                          h.Class(
                            css({
                              position: 'relative',
                            }),
                          ),
                          h.Style({ width: `${layout.width}px`, height: `${layout.height}px` }),
                        ],
                        [
                          ...backdrop(model, layout, h),
                          wires(model, layout, focus, h),
                          ...[...layout.placed.values()].map((place) =>
                            node(model, place, place.entry.id === focus.id, h),
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
              poolDeck(model, h),
            ],
          ),
        ],
      ),
      detail(model, focus, h),
    ],
  )
}
