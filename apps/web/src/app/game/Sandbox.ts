import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect, Schema } from 'effect'
import {
  Cable,
  Check,
  ChevronDown,
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
  X,
  Zap,
  type IconNode,
} from 'lucide'
import { ERAS, INCIDENT_IDS, LEVER_KINDS, MAX_LEVER_STEP } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import { has } from '@quorum/simulation/lookups'
import { mixOf } from '@quorum/simulation/features'
import { leverRefusal } from '@quorum/simulation/work'
import { activeIncident, IncidentId } from '@quorum/simulation/state'
import { GUIDED, TRACKS, type SandboxId } from '@quorum/simulation/sandbox'
import { clock, money, rate, sharePercent } from '@quorum/ui/game/format'
import { formats } from '@/i18n/format.ts'
import { copy, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import { isPhone } from '@/game/viewport.ts'
import {
  boardSandbox,
  hasCompany,
  parkedCompanyOf,
  type Model,
  type SandboxRun,
} from '@/game/model.ts'
import {
  CHIPS,
  EYEBROW,
  FIGURE,
  FLOAT,
  PANEL,
  WELL,
  toneText,
  type Tone,
} from '@quorum/ui/game/bits'
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

/* The native select `@quorum/ui/primitives/native-select` drew, hand-written
   for Effect UI. */
const NATIVE_SELECT_FIELD_WRAPPER = css({
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: '1.5',
})

const NATIVE_SELECT_LABEL = css({
  paddingInline: '1.5',
  paddingBlock: '1',
  fontSize: 'type.12',
  lineHeight: 'compact',
  color: 'mutedForeground',
})

const NATIVE_SELECT_WRAPPER = css({
  '&:has(select[aria-disabled="true"])': { opacity: 0.5 },
  '&:has(select[data-disabled])': { opacity: 0.5 },
  position: 'relative',
  width: 'fit-content',
  '&:has(select:disabled)': { opacity: 0.5 },
})

const NATIVE_SELECT = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  '&::placeholder': { color: 'mutedForeground' },
  '&::selection': { backgroundColor: 'primary', color: 'primaryForeground' },
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: 'focusWell',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow:
      'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
  },
  height: '8',
  width: '100%',
  minWidth: '0',
  appearance: 'none',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  paddingBlock: '1',
  paddingRight: '8',
  paddingLeft: '2.5',
  fontSize: 'type.14',
  lineHeight: 'fine',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  userSelect: 'none',
  '&[data-size="sm"]': {
    height: '7',
    borderRadius: 'md',
    paddingBlock: '0.5',
  },
  '&[aria-disabled="true"], &[data-disabled]': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
  outlineStyle: 'none',
  '&:disabled': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
})

const NATIVE_SELECT_ICON = css({
  color: 'mutedForeground',
  top: '50%',
  right: '2.5',
  width: '4',
  height: '4',
  translate: '0 -50%',
  pointerEvents: 'none',
  position: 'absolute',
  userSelect: 'none',
})

const NATIVE_SELECT_OPTION = css({
  backgroundColor: 'Canvas',
  color: 'CanvasText',
})

const nativeSelect = (
  h: H<Message>,
  config: Readonly<{
    id: string
    label: string
    size?: 'default' | 'sm'
    value: string
    isDisabled: boolean
    onChange: (value: string) => Message
    className?: string
    labelClass?: string
    wrapperClass?: string
    options: ReadonlyArray<Child>
  }>,
): Content => {
  const size = config.size ?? 'default'
  const select = h.select
    .attr('id', config.id)
    .attr('disabled', config.isDisabled ? '' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .value(config.value)
    .attr('data-slot', 'native-select')
    .attr('data-size', size)
    .class(cx(NATIVE_SELECT, config.className))
  const wired = config.isDisabled
    ? select
    : select.on('change', ({ value }) => config.onChange(value))
  return h.div.class(cx(NATIVE_SELECT_FIELD_WRAPPER, config.wrapperClass)).children(
    h.label
      .attr('for', config.id)
      .class(cx(NATIVE_SELECT_LABEL, config.labelClass))
      .children(config.label),
    h.div
      .class(NATIVE_SELECT_WRAPPER)
      .attr('data-slot', 'native-select-wrapper')
      .attr('data-size', size)
      .children(
        wired.children(...config.options),
        h.span
          .attr('data-slot', 'native-select-icon')
          .class(NATIVE_SELECT_ICON)
          .attr('aria-hidden', 'true')
          .children(
            icon(
              h,
              ChevronDown,
              css({
                width: '4',
                height: '4',
              }),
            ),
          ),
      ),
  )
}

const nativeSelectOption = (
  h: H<Message>,
  config: Readonly<{ value: string; label: string }>,
): Content =>
  h.option
    .attr('value', config.value)
    .attr('data-slot', 'native-select-option')
    .class(NATIVE_SELECT_OPTION)
    .children(config.label)

const nextGuided = (id: SandboxId): SandboxId | null => {
  const order = TRACKS.flatMap((track) => track.sandboxes)
  return order[order.indexOf(id) + 1] ?? null
}

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
          gap: '1.5',
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
            minWidth: '52px',
            flexShrink: '0',
            whiteSpace: 'nowrap',
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
              whiteSpace: 'nowrap',
              _compact: {
                marginLeft: '0',
              },
            }),
            toneText(tone),
          ),
        )
        .children(value),
    )

const figures = (model: Model, ledger: Ledger, h: H<Message>): Content => {
  const t = copy(h)

  const errors = ledger.errorShare * 100
  const percentiles = has(model.board.game, 'percentiles')
  const open = boardSandbox(model.board)
  const objective = open?.id ? GUIDED[open.id].objectives[open.progress.objective] : undefined
  const words = open?.id ? t.catalog.guided[open.id].objectives[open.progress.objective] : undefined
  const apdex = objective?.apdex ?? 0.85
  const watch = objective?.watch
  const watched = watch?.value(ledger) ?? 0
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
        : undefined,
    )
}

const header = (title: string, aside: Child, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
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
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: 'type.13',
            fontWeight: 'semibold',
          }),
        )
        .children(title),
      h.span
        .class(
          css({
            marginLeft: 'auto',
          }),
        )
        .children(aside),
    )
}

const steps = (run: SandboxRun, id: SandboxId, h: H<Message>): Content => {
  const t = copy(h)

  const total = GUIDED[id].objectives.length
  return h.span
    .class(
      css({
        display: 'flex',
        alignItems: 'center',
        gap: '1',
      }),
    )
    .attr('aria-label', t.sandbox.objectiveOf(run.progress.objective + 1, total))
    .children(
      GUIDED[id].objectives.map((_, index) =>
        h.span
          .key(String(index))
          .class(
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
          )
          .children(),
      ),
    )
}

export const objectiveBar = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)
  const run = boardSandbox(model.board)
  if (!run?.id) return undefined
  const objective = GUIDED[run.id].objectives[run.progress.objective]
  if (!objective) return undefined
  const share = Math.min(1, run.progress.held / objective.hold)
  return h.div
    .key(`objective-${run.progress.objective}`)
    .attr('data-exit', 'notice')
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
          h.span
            .class(
              css({
                flex: '1 1 0%',
                lineHeight: 'snug',
              }),
            )
            .children(
              t.catalog.guided[run.id].objectives[run.progress.objective]?.goal ?? objective.goal,
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
            .children(`${clock(run.progress.held)} / ${clock(objective.hold)}`),
        ),
      meter(
        h,
        share,
        share > 0
          ? css({
              backgroundColor: 'ok',
            })
          : css({ layerStyle: 'primaryFill' }),
      ),
    )
}

const tiny = (label: string, message: Message, h: H<Message>, active = false): Content =>
  button(
    h,
    {
      onClick: message,
      variant: active ? 'default' : 'outline',
      size: 'sm',
      key: label,
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
    },
    label,
  )

const leverList = (model: Model, h: H<Message>): Child => {
  const t = copy(h)
  const game = model.board.game
  const kinds = LEVER_KINDS.filter((kind) => (mixOf(game)[kind] ?? 0) > 0)
  if (kinds.length === 0) return undefined
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(t.sandbox.levers),
      h.div
        .class(
          css({
            display: 'flex',
            maxHeight: '44',
            flexDirection: 'column',
            gap: '1',
            overflow: 'auto',
            scrollbarWidth: 'thin',
          }),
        )
        .children(
          kinds.map((kind) => {
            const step = game.levers[kind] ?? 0
            return h.div
              .key(kind)
              .attr(
                'title',
                `${t.levers.step(step, MAX_LEVER_STEP)} · ${t.levers.share(sharePercent(mixOf(game)[kind] ?? 0))}`,
              )
              .class(
                css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.5',
                }),
              )
              .children(
                h.span
                  .class(
                    css({
                      minWidth: '0',
                      flex: '1 1 0%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.catalog.pools[kind].label),
                button(
                  h,
                  {
                    onClick: Message.LeverStepped({ kind, direction: -1 }),
                    isDisabled: step <= 0,
                    variant: 'outline',
                    size: 'icon-xs',
                    attributes: { 'aria-label': t.levers.takeOff },
                  },
                  icon(
                    h,
                    Minus,
                    css({
                      width: '3',
                      height: '3',
                    }),
                  ),
                ),
                h.span
                  .class(
                    cx(
                      FIGURE,
                      css({
                        width: '6',
                        textAlign: 'center',
                        fontSize: 'type.11',
                      }),
                    ),
                  )
                  .children(`${step}/${MAX_LEVER_STEP}`),
                button(
                  h,
                  {
                    onClick: Message.LeverStepped({ kind, direction: 1 }),
                    isDisabled: leverRefusal(game, kind) !== null,
                    variant: 'outline',
                    size: 'icon-xs',
                    attributes: { 'aria-label': t.levers.set },
                  },
                  icon(
                    h,
                    Plus,
                    css({
                      width: '3',
                      height: '3',
                    }),
                  ),
                ),
              )
          }),
        ),
    )
}

const controls = (model: Model, h: H<Message>): Content => {
  const t = copy(h)
  return h.details
    .key('controls')
    .attr('open', isPhone() ? undefined : '')
    .class('fold group')
    .children(
      h.summary
        .class(
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
        )
        .children(
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
        ),
      controlsBody(model, h),
    )
}

const controlsBody = (model: Model, h: H<Message>): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '2.5',
        paddingInline: '2.5',
        paddingTop: '2.5',
        paddingBottom: '1.5',
      }),
    )
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '1.5',
          }),
        )
        .children(
          h.span
            .class(
              cx(
                EYEBROW,
                css({
                  marginRight: 'auto',
                }),
              ),
            )
            .children(t.sandbox.users),
          button(
            h,
            {
              onClick: Message.DemandStepped({ direction: -1 }),
              variant: 'outline',
              size: 'icon-sm',
              attributes: { 'aria-label': t.sandbox.lessDemand },
            },
            icon(
              h,
              Minus,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
          ),
          h.span
            .class(
              cx(
                FIGURE,
                css({
                  width: '14',
                  textAlign: 'center',
                  fontSize: 'type.13',
                }),
              ),
            )
            .children(model.board.game.users.toLocaleString('en-US')),
          button(
            h,
            {
              onClick: Message.DemandStepped({ direction: 1 }),
              variant: 'outline',
              size: 'icon-sm',
              attributes: { 'aria-label': t.sandbox.moreDemand },
            },
            icon(
              h,
              Plus,
              css({
                width: '3.5',
                height: '3.5',
              }),
            ),
          ),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5',
          }),
        )
        .children(
          h.span.class(EYEBROW).children(t.sandbox.mix),
          h.div
            .class(
              css({
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '1.5',
              }),
            )
            .children(
              ERAS.slice(0, 3).map((era, stage) =>
                tiny(
                  t.catalog.eras[stage]?.name ?? era.name,
                  Message.MixChosen({ stage }),
                  h,
                  model.board.game.stage === stage,
                ),
              ),
            ),
        ),
      leverList(model, h),
      nativeSelect(h, {
        id: 'sandbox-incident',
        label: t.sandbox.incident,
        size: 'sm',
        value: activeIncident(model.board.game)?.kind ?? '',
        isDisabled: activeIncident(model.board.game) !== null,
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
          nativeSelectOption(h, { value: '', label: t.sandbox.none }),
          ...INCIDENT_IDS.map((kind) =>
            nativeSelectOption(h, { value: kind, label: t.catalog.incidents[kind].name }),
          ),
        ],
      }),
      h.div
        .class(
          css({
            display: 'flex',
            gap: '1.5',
          }),
        )
        .children(
          button(
            h,
            {
              onClick: Message.StressBoardLoaded({ big: false }),
              variant: 'ghost',
              size: 'sm',
              className: css({
                flex: '1 1 0%',
                color: 'mutedForeground',
              }),
              attributes: { title: t.sandbox.loadACrowdedDesignToTest },
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
          ),
          button(
            h,
            {
              onClick: Message.StressBoardLoaded({ big: true }),
              variant: 'ghost',
              size: 'sm',
              className: css({
                flex: '1 1 0%',
                color: 'mutedForeground',
              }),
              attributes: { title: t.sandbox.loadA61NodeDesignTo },
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
          ),
        ),
      h.div
        .class(
          css({
            display: 'flex',
            gap: '1.5',
          }),
        )
        .children(
          button(
            h,
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
          ),
          parkedCompanyOf(model) && hasCompany(model)
            ? button(
                h,
                {
                  onClick: Message.CompanyCopied(),
                  variant: 'ghost',
                  size: 'sm',
                  className: css({
                    flex: '1 1 0%',
                    color: 'mutedForeground',
                  }),
                  attributes: { title: t.sandbox.copyTheCompanyDesignOntoThis },
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
              )
            : undefined,
        ),
    )
}

export const sandboxHud = (h: H<Message>, model: Model, ledger: Ledger): View.Input<Message> => {
  const t = copy(h)

  const run = boardSandbox(model.board)
  if (!run) return undefined
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
      run.id ? undefined : controls(model, h),
    )
}

export const passedPanel = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const id = boardSandbox(model.board)?.id
  if (!id) return undefined
  const next = nextGuided(id)
  return shell(
    h,
    t,
    t.catalog.guided[id].name,
    [],
    [
      h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3',
            paddingInline: '8',
            paddingTop: '2',
            paddingBottom: '6',
          }),
        )
        .children(
          h.span
            .class(
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
            )
            .children(
              icon(
                h,
                Check,
                css({
                  width: '6',
                  height: '6',
                }),
              ),
            ),
          h.span
            .class(
              css({
                fontSize: 'type.26',
                fontWeight: 'semibold',
                letterSpacing: 'heading',
              }),
            )
            .children(t.sandbox.passed),
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
            t.sandbox.sandboxMenu,
          ),
          next
            ? button(
                h,
                {
                  onClick: Message.GuidedStarted({ id: next }),
                  size: 'lg',
                  className: css({
                    paddingInline: '4',
                  }),
                },
                t.catalog.guided[next].name,
              )
            : button(
                h,
                {
                  onClick: Message.FreeSandboxStarted(),
                  size: 'lg',
                  className: css({
                    paddingInline: '4',
                  }),
                },
                t.sandbox.freeSandbox,
              ),
        ),
    ],
    css({ maxWidth: '440px' }),
  )
}
