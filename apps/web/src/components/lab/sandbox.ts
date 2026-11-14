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
import { cn } from '@/lib/utils'
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
          height: '2rem',
          alignItems: 'center',
          gap: '0.625rem',
          paddingInline: '0.625rem',
          _compact: {
            flexShrink: '0',
            gap: '0.375rem',
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
              minWidth: '52px',
              flexShrink: '0',
              whiteSpace: 'nowrap',
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
            cn(
              FIGURE,
              css({
                marginLeft: 'auto',
                fontSize: 'calc(13.5px*var(--type-scale))',
                lineHeight: '1',
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
              borderColor: 'var(--hairline)',
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
          minHeight: '2.25rem',
          alignItems: 'center',
          gap: '0.5rem',
          paddingInline: '0.625rem',
          paddingTop: '0.375rem',
          paddingBottom: '0.5rem',
          _compact: {
            paddingBottom: '0.25rem',
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
            color: 'var(--muted-foreground)',
          }),
          attributes: [h.AriaLabel(t.hud.menuEsc), h.Title(t.hud.menuEsc)],
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
          gap: '0.25rem',
        }),
      ),
      h.AriaLabel(t.sandbox.objectiveOf(run.progress.objective + 1, total)),
    ],
    GUIDED[id].objectives.map((_, index) =>
      h.span(
        [
          h.Key(String(index)),
          h.Class(
            cn(
              css({
                height: '0.375rem',
                width: '0.75rem',
                borderRadius: '9999px',
              }),
              index < run.progress.objective
                ? css({
                    backgroundColor: 'var(--ok)',
                  })
                : index === run.progress.objective
                  ? css({
                      layerStyle: 'primaryFill',
                    })
                  : css({
                      backgroundColor: 'var(--well)',
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
          icon(
            h,
            Flag,
            css({
              marginTop: '0.125rem',
              width: '0.875rem',
              height: '0.875rem',
              flexShrink: '0',
              color: 'var(--primary-strong)',
            }),
          ),
          h.span(
            [
              h.Class(
                css({
                  flex: '1 1 0%',
                  lineHeight: '1.375',
                }),
              ),
            ],
            [t.catalog.guided[run.id].objectives[run.progress.objective]?.goal ?? objective.goal],
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    fontSize: 'calc(11px*var(--type-scale))',
                    color: 'var(--muted-foreground)',
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
              backgroundColor: 'var(--ok)',
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
        minHeight: '1.75rem',
        paddingInline: '0.5rem',
        paddingBlock: '0.25rem',
        fontSize: 'calc(11.5px*var(--type-scale))',
        lineHeight: '1.25',
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
          gap: '0.375rem',
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
              maxHeight: '11rem',
              flexDirection: 'column',
              gap: '0.25rem',
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
                  gap: '0.375rem',
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
                      fontSize: 'calc(11.5px*var(--type-scale))',
                      color: 'var(--muted-foreground)',
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
                    width: '0.75rem',
                    height: '0.75rem',
                  }),
                ),
                h,
              ),
              h.span(
                [
                  h.Class(
                    cn(
                      FIGURE,
                      css({
                        width: '1.5rem',
                        textAlign: 'center',
                        fontSize: 'calc(11px*var(--type-scale))',
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
                    width: '0.75rem',
                    height: '0.75rem',
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
              height: '2.25rem',
              cursor: 'pointer',
              listStyleType: 'none',
              alignItems: 'center',
              gap: '0.5rem',
              paddingInline: '0.625rem',
              fontSize: 'calc(12.5px*var(--type-scale))',
              fontWeight: '500',
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
                width: '0.875rem',
                height: '0.875rem',
                flexShrink: '0',
                color: 'var(--muted-foreground)',
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
          gap: '0.625rem',
          paddingInline: '0.625rem',
          paddingTop: '0.625rem',
          paddingBottom: '0.375rem',
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
              gap: '0.375rem',
            }),
          ),
        ],
        [
          h.span(
            [
              h.Class(
                cn(
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
                width: '0.875rem',
                height: '0.875rem',
              }),
            ),
            h,
          ),
          h.span(
            [
              h.Class(
                cn(
                  FIGURE,
                  css({
                    width: '3.5rem',
                    textAlign: 'center',
                    fontSize: 'calc(13px*var(--type-scale))',
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
                width: '0.875rem',
                height: '0.875rem',
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
              gap: '0.375rem',
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
                  gap: '0.375rem',
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
          wrapperClass: 'flex-row items-center gap-1.5 [&>div]:flex-1',
          labelClass: cn(
            EYEBROW,
            css({
              marginRight: 'auto',
              padding: '0',
            }),
          ),
          className: css({
            fontSize: 'calc(11.5px*var(--type-scale))',
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
              gap: '0.375rem',
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
                color: 'var(--muted-foreground)',
              }),
              attributes: [h.Title(t.sandbox.loadACrowdedDesignToTest)],
            },
            [
              icon(
                h,
                Cable,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
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
                color: 'var(--muted-foreground)',
              }),
              attributes: [h.Title(t.sandbox.loadA61NodeDesignTo)],
            },
            [
              icon(
                h,
                Cable,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
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
              gap: '0.375rem',
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
                color: 'var(--muted-foreground)',
              }),
            },
            [
              icon(
                h,
                RotateCcw,
                css({
                  width: '0.875rem',
                  height: '0.875rem',
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
                    color: 'var(--muted-foreground)',
                  }),
                  attributes: [h.Title(t.sandbox.copyTheCompanyDesignOntoThis)],
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
      run.id
        ? header(t.catalog.guided[run.id].name, steps(run, run.id, h), h)
        : header(
            t.sandbox.freeSandbox,
            icon(
              h,
              Zap,
              css({
                width: '0.875rem',
                height: '0.875rem',
                color: 'var(--muted-foreground)',
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
              gap: '0.75rem',
              paddingInline: '2rem',
              paddingTop: '0.5rem',
              paddingBottom: '1.5rem',
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
                    width: '3rem',
                    height: '3rem',
                    placeItems: 'center',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--ok)',
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
                  width: '1.5rem',
                  height: '1.5rem',
                }),
              ),
            ],
          ),
          h.span(
            [
              h.Class(
                css({
                  fontSize: 'calc(26px*var(--type-scale))',
                  fontWeight: '600',
                  letterSpacing: '-0.035em',
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
            t.sandbox.sandboxMenu,
            h,
          ),
          next
            ? button(
                {
                  onClick: Message.GuidedStarted({ id: next }),
                  size: 'lg',
                  className: css({
                    paddingInline: '1rem',
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
                    paddingInline: '1rem',
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
