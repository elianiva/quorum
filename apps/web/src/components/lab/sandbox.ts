import { css, cx } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import { Schema } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import {
  Cable,
  Check,
  ChevronRight,
  Copy,
  Flag,
  Gauge,
  Menu,
  Minus,
  Plus,
  RotateCcw,
  Smile,
  Timer,
  TriangleAlert,
  Wallet,
  Zap,
} from 'lucide'
import { ERAS, INCIDENT_IDS, LEVER_KINDS, MAX_LEVER_STEP } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import { has } from '@quorum/simulation/lookups'
import { mixOf } from '@quorum/simulation/features'
import { leverRefusal } from '@quorum/simulation/work'
import { IncidentId } from '@quorum/simulation/state'
import { GUIDED, TRACKS, type SandboxId } from '@quorum/simulation/sandbox'
import { clock, money, rate, sharePercent } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { isPhone } from '@/game/viewport.ts'
import { boardSandbox, hasCompany, type Model, type SandboxRun } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { button } from '@quorum/ui/primitives/button'
import { nativeSelect, nativeSelectOption } from '@quorum/ui/primitives/native-select'
import {
  CHIPS,
  EYEBROW,
  FIGURE,
  PANEL,
  WELL,
  meter,
  toneText,
  type Tone,
} from '@quorum/ui/game/bits'
import { shell } from './panels.ts'

/** The guided Sandbox after this one: the next in its track, then the next track. */
export const nextGuided = (id: SandboxId): SandboxId | null => {
  const order = TRACKS.flatMap((track) => track.sandboxes)
  return order[order.indexOf(id) + 1] ?? null
}

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
              minWidth: '52px',
              flexShrink: '0',
              whiteSpace: 'nowrap',
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
      h.span(
        [
          h.Class(
            cx(
              FIGURE,
              css({
                marginLeft: 'auto',
                fontSize: 'type.13-5',
                lineHeight: 'none',
                whiteSpace: 'nowrap',
                _compact: {
                  marginLeft: '0',
                },
              }),
              toneText(tone),
            ),
          ),
        ],
        [value],
      ),
    ],
  )

const figures = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const errors = ledger.errorShare * 100
  const percentiles = has(model.board.game, 'percentiles')
  // A guided objective sets the Apdex and Burn it asks for, and may be measured on another figure.
  const open = boardSandbox(model.board)
  const objective = open?.id ? GUIDED[open.id].objectives[open.progress.objective] : undefined
  const words = open?.id ? t.catalog.guided[open.id].objectives[open.progress.objective] : undefined
  const apdex = objective?.apdex ?? 0.85
  const watch = objective?.watch
  const watched = watch?.value(ledger) ?? 0
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
              borderColor: 'hairline',
            },
          }),
          WELL,
          CHIPS,
        ),
      ),
    ],
    [
      figureRow(t.sandbox.demand, Gauge, t.sandbox.s(rate(ledger.demand)), 'plain', h),
      figureRow(
        t.sandbox.burn,
        Wallet,
        t.sandbox.s(money(ledger.burn)),
        objective?.burn === undefined
          ? 'plain'
          : ledger.burn <= objective.burn + 1e-9
            ? 'ok'
            : 'danger',
        h,
      ),
      figureRow(
        'Apdex',
        Smile,
        ledger.apdex.toFixed(2),
        ledger.apdex >= apdex ? 'ok' : 'danger',
        h,
      ),
      figureRow(
        t.sandbox.errors,
        TriangleAlert,
        `${errors.toFixed(errors >= 10 ? 0 : 1)}%`,
        errors < 1 ? 'ok' : errors < 5 ? 'warn' : 'danger',
        h,
      ),
      figureRow(
        percentiles ? 'p99' : t.sandbox.latency,
        Timer,
        formats(t).ms(percentiles ? ledger.p99 : ledger.latency),
        'plain',
        h,
      ),
      watch
        ? figureRow(
            words?.watch?.label ?? watch.label,
            Flag,
            watch.unit === 'ms' ? formats(t).ms(watched) : `${(watched * 100).toFixed(1)}%`,
            'plain',
            h,
          )
        : h.empty,
    ],
  )
}

const header = (title: string, aside: Html, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          minHeight: '9',
          alignItems: 'center',
          gap: '2',
          paddingInline: '2.5',
          paddingTop: '1.5',
          paddingBottom: '2',
          _compact: {
            paddingBottom: '1',
            paddingRight: 'var(--toolbar-w)',
          },
        }),
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
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 'type.13',
              fontWeight: 'semibold',
            }),
          ),
        ],
        [title],
      ),
      h.span(
        [
          h.Class(
            css({
              marginLeft: 'auto',
            }),
          ),
        ],
        [aside],
      ),
    ],
  )
}

const steps = (run: SandboxRun, id: SandboxId, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const total = GUIDED[id].objectives.length
  return h.span(
    [
      h.Class(
        css({
          display: 'flex',
          alignItems: 'center',
          gap: '1',
        }),
      ),
      h.AriaLabel(t.sandbox.objectiveOf(run.progress.objective + 1, total)),
    ],
    GUIDED[id].objectives.map((_, index) =>
      h.span(
        [
          h.Key(String(index)),
          h.Class(
            cx(
              css({
                height: '1.5',
                width: '3',
                borderRadius: 'full',
              }),
              index < run.progress.objective
                ? css({
                    backgroundColor: 'ok',
                  })
                : index === run.progress.objective
                  ? css({
                      layerStyle: 'primaryFill',
                    })
                  : css({
                      backgroundColor: 'well',
                      boxShadow: 'well',
                    }),
            ),
          ),
        ],
        [],
      ),
    ),
  )
}

/** The current objective, in the goal slot, with how long it has held. */
export const objectiveBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const run = boardSandbox(model.board)
  if (!run?.id) return h.empty
  const objective = GUIDED[run.id].objectives[run.progress.objective]
  if (!objective) return h.empty
  const share = Math.min(1, run.progress.held / objective.hold)
  return h.div(
    [
      h.Key(`objective-${run.progress.objective}`),
      h.DataAttribute('exit', 'notice'),
      h.Class(
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
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'flex-start',
              gap: '2.5',
            }),
          ),
        ],
        [
          icon(
            h,
            Flag,
            css({
              marginTop: '0.5',
              width: '3.5',
              height: '3.5',
              flexShrink: '0',
              color: 'primaryStrong',
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  lineHeight: 'snug',
                }),
              ),
            ],
            [t.catalog.guided[run.id].objectives[run.progress.objective]?.goal ?? objective.goal],
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11',
                    color: 'mutedForeground',
                  }),
                ),
              ),
            ],
            [`${clock(run.progress.held)} / ${clock(objective.hold)}`],
          ),
        ],
      ),
      meter(
        share,
        share > 0
          ? css({
              backgroundColor: 'ok',
            })
          : css({ layerStyle: 'primaryFill' }),
        h,
      ),
    ],
  )
}

const tiny = (label: string, message: Message, h: HtmlBuilder<Message>, active = false): Html =>
  button(
    {
      onClick: message,
      variant: active ? 'default' : 'outline',
      size: 'sm',
      className: css({
        height: 'auto',
        minHeight: '7',
        paddingInline: '2',
        paddingBlock: '1',
        fontSize: 'type.11-5',
        lineHeight: 'tight',
        whiteSpace: 'normal',
        textWrap: 'balance',
      }),
      attributes: [h.Key(label)],
    },
    label,
    h,
  )

/**
 * A free Sandbox sets each Product lever at once, because it has no Team to build one
 * (10 "Product levers"). Only the kinds the Era's mix carries can move, so the list follows
 * the Mix buttons above it.
 */
const leverList = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  const game = model.board.game
  const kinds = LEVER_KINDS.filter((kind) => (mixOf(game)[kind] ?? 0) > 0)
  if (kinds.length === 0) return h.empty
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5',
        }),
      ),
    ],
    [
      h.span([h.Class(EYEBROW)], [t.sandbox.levers]),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              maxHeight: '44',
              flexDirection: 'column',
              gap: '1',
              overflow: 'auto',
              scrollbarWidth: 'thin',
            }),
          ),
        ],
        kinds.map((kind) => {
          const step = game.levers[kind] ?? 0
          return h.div(
            [
              h.Key(kind),
              h.Class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                }),
              ),
              h.Title(
                `${t.levers.step(step, MAX_LEVER_STEP)} · ${t.levers.share(sharePercent(mixOf(game)[kind] ?? 0))}`,
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    css({
                      minWidth: '0',
                      flex: '1 1 0%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [t.catalog.pools[kind].label],
              ),
              button(
                {
                  onClick: Message.LeverStepped({ kind, direction: -1 }),
                  isDisabled: step <= 0,
                  variant: 'outline',
                  size: 'icon-xs',
                  attributes: [h.AriaLabel(t.levers.takeOff)],
                },
                icon(
                  h,
                  Minus,
                  css({
                    width: '3',
                    height: '3',
                  }),
                ),
                h,
              ),
              h.span(
                [
                  h.Class(
                    cx(
                      FIGURE,
                      css({
                        width: '6',
                        textAlign: 'center',
                        fontSize: 'type.11',
                      }),
                    ),
                  ),
                ],
                [`${step}/${MAX_LEVER_STEP}`],
              ),
              button(
                {
                  onClick: Message.LeverStepped({ kind, direction: 1 }),
                  isDisabled: leverRefusal(game, kind) !== null,
                  variant: 'outline',
                  size: 'icon-xs',
                  attributes: [h.AriaLabel(t.levers.set)],
                },
                icon(
                  h,
                  Plus,
                  css({
                    width: '3',
                    height: '3',
                  }),
                ),
                h,
              ),
            ],
          )
        }),
      ),
    ],
  )
}

/**
 * On a phone the controls fold away under their name; on a desktop they stay
 * open, and there is no summary to fold them by. On a phone the fold belongs to
 * the player once they touch it, so the open state is not written on every Step.
 */
const controls = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.details(
    [h.Key('controls'), ...(isPhone() ? [] : [h.Open(true)]), h.Class('fold group')],
    [
      h.summary(
        [
          h.Class(
            css({
              display: 'none',
              height: '9',
              cursor: 'pointer',
              listStyleType: 'none',
              alignItems: 'center',
              gap: '2',
              paddingInline: '2.5',
              fontSize: 'type.12-5',
              fontWeight: 'medium',
              _compact: {
                display: 'flex',
              },
              '&::-webkit-details-marker': {
                display: 'none',
              },
            }),
          ),
        ],
        [
          icon(
            h,
            ChevronRight,
            cx(
              css({
                width: '3.5',
                height: '3.5',
                flexShrink: '0',
                color: 'mutedForeground',
                '.group[open] &': {
                  rotate: '90deg',
                },
              }),
              'fold-chevron',
            ),
          ),
          t.sandbox.controls,
        ],
      ),
      controlsBody(model, h),
    ],
  )
}

const controlsBody = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexDirection: 'column',
          gap: '2.5',
          paddingInline: '2.5',
          paddingTop: '2.5',
          paddingBottom: '1.5',
        }),
      ),
    ],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '1.5',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  EYEBROW,
                  css({
                    marginRight: 'auto',
                  }),
                ),
              ),
            ],
            [t.sandbox.users],
          ),
          button(
            {
              onClick: Message.DemandStepped({ direction: -1 }),
              variant: 'outline',
              size: 'icon-sm',
              attributes: [h.AriaLabel(t.sandbox.lessDemand)],
            },
            icon(
              h,
              Minus,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
            h,
          ),
          h.span(
            [
              h.Class(
                cx(
                  FIGURE,
                  css({
                    width: '14',
                    textAlign: 'center',
                    fontSize: 'type.13',
                  }),
                ),
              ),
            ],
            [model.board.game.users.toLocaleString('en-US')],
          ),
          button(
            {
              onClick: Message.DemandStepped({ direction: 1 }),
              variant: 'outline',
              size: 'icon-sm',
              attributes: [h.AriaLabel(t.sandbox.moreDemand)],
            },
            icon(
              h,
              Plus,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
            h,
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5',
            }),
          ),
        ],
        [
          h.span([h.Class(EYEBROW)], [t.sandbox.mix]),
          h.div(
            [
              h.Class(
                css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: '1.5',
                }),
              ),
            ],
            ERAS.slice(0, 3).map((era, stage) =>
              tiny(
                t.catalog.eras[stage]?.name ?? era.name,
                Message.MixChosen({ stage }),
                h,
                model.board.game.stage === stage,
              ),
            ),
          ),
        ],
      ),
      leverList(model, h),
      nativeSelect(
        {
          id: 'sandbox-incident',
          label: t.sandbox.incident,
          size: 'sm',
          value: model.board.game.incident?.kind ?? '',
          isDisabled: model.board.game.incident !== null,
          onChange: (kind) =>
            Schema.is(IncidentId)(kind) ? Message.IncidentForced({ kind }) : Message.Synced(),
          wrapperClass: css({
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '1.5',
            '& > div': { flex: '1 1 0%' },
          }),
          labelClass: cx(
            EYEBROW,
            css({
              marginRight: 'auto',
              padding: '0',
            }),
          ),
          className: css({
            fontSize: 'type.11-5',
          }),
          options: [
            nativeSelectOption({ value: '', label: t.sandbox.none }, h),
            ...INCIDENT_IDS.map((kind) =>
              nativeSelectOption({ value: kind, label: t.catalog.incidents[kind].name }, h),
            ),
          ],
        },
        h,
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              gap: '1.5',
            }),
          ),
        ],
        [
          button(
            {
              onClick: Message.StressBoardLoaded({ big: false }),
              variant: 'ghost',
              size: 'sm',
              className: css({
                flex: '1 1 0%',
                color: 'mutedForeground',
              }),
              attributes: [h.Title(t.sandbox.loadACrowdedDesignToTest)],
            },
            [
              icon(
                h,
                Cable,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              t.sandbox.stressBoard,
            ],
            h,
          ),
          button(
            {
              onClick: Message.StressBoardLoaded({ big: true }),
              variant: 'ghost',
              size: 'sm',
              className: css({
                flex: '1 1 0%',
                color: 'mutedForeground',
              }),
              attributes: [h.Title(t.sandbox.loadA61NodeDesignTo)],
            },
            [
              icon(
                h,
                Cable,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              t.sandbox.bigBoard,
            ],
            h,
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              gap: '1.5',
            }),
          ),
        ],
        [
          button(
            {
              onClick: Message.FreeSandboxReset(),
              variant: 'ghost',
              size: 'sm',
              className: css({
                flex: '1 1 0%',
                color: 'mutedForeground',
              }),
            },
            [
              icon(
                h,
                RotateCcw,
                css({
                  width: '3.5',
                  height: '3.5',
                }),
              ),
              t.sandbox.reset,
            ],
            h,
          ),
          model.company && hasCompany(model)
            ? button(
                {
                  onClick: Message.CompanyCopied(),
                  variant: 'ghost',
                  size: 'sm',
                  className: css({
                    flex: '1 1 0%',
                    color: 'mutedForeground',
                  }),
                  attributes: [h.Title(t.sandbox.copyTheCompanyDesignOntoThis)],
                },
                [
                  icon(
                    h,
                    Copy,
                    css({
                      width: '3.5',
                      height: '3.5',
                    }),
                  ),
                  t.sandbox.copyCompany,
                ],
                h,
              )
            : h.empty,
        ],
      ),
    ],
  )
}

export const sandboxHud = (model: Model, ledger: Ledger, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const run = boardSandbox(model.board)
  if (!run) return h.empty
  return h.header(
    [
      h.Class(
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
      ),
    ],
    [
      run.id
        ? header(t.catalog.guided[run.id].name, steps(run, run.id, h), h)
        : header(
            t.sandbox.freeSandbox,
            icon(
              h,
              Zap,
              css({
                width: '3.5',
                height: '3.5',
                color: 'mutedForeground',
              }),
            ),
            h,
          ),
      figures(model, ledger, h),
      run.id ? h.empty : controls(model, h),
    ],
  )
}

export const passedPanel = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h)

  const id = boardSandbox(model.board)?.id
  if (!id) return h.empty
  const next = nextGuided(id)
  return shell(
    t.catalog.guided[id].name,
    [],
    [
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3',
              paddingInline: '8',
              paddingTop: '2',
              paddingBottom: '6',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cx(
                  css({
                    display: 'grid',
                    width: '12',
                    height: '12',
                    placeItems: 'center',
                    borderRadius: 'full',
                    backgroundColor: 'ok',
                    color: 'white',
                    boxShadow: 'raised',
                  }),
                  'enter-pop',
                ),
              ),
            ],
            [
              icon(
                h,
                Check,
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
                  fontSize: 'type.26',
                  fontWeight: 'semibold',
                  letterSpacing: 'heading',
                }),
              ),
            ],
            [t.sandbox.passed],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
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
          ),
        ],
        [
          button(
            {
              onClick: Message.TitleOpened(),
              variant: 'outline',
              size: 'lg',
              className: css({
                paddingInline: '3.5',
              }),
            },
            t.sandbox.sandboxMenu,
            h,
          ),
          next
            ? button(
                {
                  onClick: Message.GuidedStarted({ id: next }),
                  size: 'lg',
                  className: css({
                    paddingInline: '4',
                  }),
                },
                t.catalog.guided[next].name,
                h,
              )
            : button(
                {
                  onClick: Message.FreeSandboxStarted(),
                  size: 'lg',
                  className: css({
                    paddingInline: '4',
                  }),
                },
                t.sandbox.freeSandbox,
                h,
              ),
        ],
      ),
    ],
    css({ maxWidth: '440px' }),
    h,
  )
}
