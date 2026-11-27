import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import { X } from 'lucide'
import type { BurnLines } from '@quorum/simulation/ledger'
import { REQUEST_KINDS } from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import { money } from '@quorum/ui/game/format'
import { copy, speak, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import { ledgerOf, type Model } from '@/game/model.ts'
import { FIGURE, FLOAT, WELL } from '@quorum/ui/game/bits'
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
  label: Label | ReadonlyArray<Label | Child>,
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
              button(
                h,
                {
                  onClick: Message.PanelClosed(),
                  variant: 'ghost',
                  size: 'icon',
                  className: SHELL_CLOSE,
                  attributes: { 'aria-label': t.panels.closeEsc },
                },
                icon(h, X, css({ width: '4', height: '4' })),
              ),
            ),
          ),
          ...body,
        ),
    )

type Line = Readonly<{ key: keyof BurnLines; label: string; note: string }>

const linesOf = (t: Messages): ReadonlyArray<Line> => [
  { key: 'compute', label: t.cost.compute, note: t.cost.notes.compute },
  { key: 'data', label: t.cost.data, note: t.cost.notes.data },
  { key: 'storage', label: t.cost.storage, note: t.cost.notes.storage },
  { key: 'egress', label: t.cost.egress, note: t.cost.notes.egress },
  { key: 'thirdParty', label: t.cost.thirdParties, note: t.cost.notes.thirdParty },
  {
    key: 'requests',
    label: t.cost.requests,
    note: t.cost.notes.requests,
  },
  { key: 'observability', label: t.cost.observability, note: t.cost.notes.observability },
  { key: 'salaries', label: t.cost.salaries, note: t.cost.notes.salaries },
]

const row = (h: H<Message>, line: Line, value: number, total: number): Content => {
  const t = copy(h)
  return h.div
    .class(
      css({
        display: 'grid',
        gridTemplateColumns: '1fr auto 64px',
        alignItems: 'baseline',
        gap: '4',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderColor: 'border',
        paddingBlock: '2',
        '&:last-child': {
          borderBottomWidth: '0px',
        },
      }),
    )
    .children(
      h.div.class(css({ minWidth: '0' })).children(
        h.div
          .class(
            css({
              fontSize: 'type.13-5',
              color: 'foreground',
            }),
          )
          .children(line.label),
        h.div
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(line.note),
      ),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.13-5',
              color: 'foreground',
            }),
          ),
        )
        .children(t.cost.s(money(value))),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              textAlign: 'right',
              fontSize: 'type.12',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(total > 0 ? `${Math.round((value / total) * 100)}%` : '—'),
    )
}

const figureRow = (h: H<Message>, label: string, value: string): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '4',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderColor: 'border',
        paddingBlock: '1.5',
        '&:last-child': {
          borderBottomWidth: '0px',
        },
      }),
    )
    .children(
      h.span
        .class(
          css({
            fontSize: 'type.12-5',
            color: 'foreground',
          }),
        )
        .children(label),
      h.span
        .class(
          cx(
            FIGURE,
            css({
              fontSize: 'type.12-5',
              color: 'mutedForeground',
            }),
          ),
        )
        .children(value),
    )

export const costPanel = (h: H<Message>, model: Model): View.Input<Message> => {
  if (model.panel !== 'cost') return undefined
  const localized = speak(model.prefs.locale, h)
  const t = copy(localized)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const lines = ledger.burnLines
  const total = ledger.burn
  const revenue = ledger.revenue
  const margin = revenue > 0 ? (revenue - total) / revenue : null
  const unitEconomics = has(game, 'unit-economics')
    ? REQUEST_KINDS.filter((kind) => (ledger.costPerKind[kind] ?? 0) > 0)
    : []
  const costAllocation = has(game, 'cost-allocation')
    ? (Object.entries(ledger.costPerService) as ReadonlyArray<[string, number]>).filter(
        ([, cost]) => cost > 0,
      )
    : []
  return shell(
    localized,
    t,
    t.cost.cloudBill,
    [],
    [
      localized.div
        .class(
          css({
            display: 'flex',
            alignItems: 'baseline',
            gap: '6',
            paddingInline: '5',
            paddingBottom: '2',
          }),
        )
        .children(
          localized.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
              }),
            )
            .children(
              localized.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.20',
                      lineHeight: 'none',
                      fontWeight: 'medium',
                    }),
                  ),
                )
                .children(t.cost.s(money(total))),
              localized.span
                .class(
                  css({
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.cost.burn),
            ),
          localized.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
              }),
            )
            .children(
              localized.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.20',
                      lineHeight: 'none',
                      fontWeight: 'medium',
                    }),
                  ),
                )
                .children(t.cost.s(money(revenue))),
              localized.span
                .class(
                  css({
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.cost.revenue),
            ),
          localized.div
            .class(
              css({
                display: 'flex',
                flexDirection: 'column',
              }),
            )
            .children(
              localized.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'type.20',
                      lineHeight: 'none',
                      fontWeight: 'medium',
                    }),
                  ),
                )
                .children(margin === null ? '—' : `${Math.round(margin * 100)}%`),
              localized.span
                .class(
                  css({
                    fontSize: 'type.12',
                    color: 'mutedForeground',
                  }),
                )
                .children(t.cost.margin),
            ),
        ),
      localized.div
        .class(
          cx(
            WELL,
            css({
              marginInline: '5',
              marginBottom: '4',
              paddingInline: '4',
              paddingBlock: '2',
            }),
          ),
        )
        .children(...linesOf(t).map((line) => row(localized, line, lines[line.key], total))),
      ...(unitEconomics.length > 0
        ? [
            localized.div
              .class(
                css({
                  paddingInline: '5',
                  paddingBottom: '1',
                  fontSize: 'type.12',
                  color: 'mutedForeground',
                }),
              )
              .children('Unit economics · cost per served request'),
            localized.div
              .class(
                cx(
                  WELL,
                  css({
                    marginInline: '5',
                    marginBottom: '4',
                    paddingInline: '4',
                    paddingBlock: '2',
                  }),
                ),
              )
              .children(
                ...unitEconomics.map((kind) =>
                  figureRow(
                    localized,
                    t.catalog.kinds[kind].label,
                    `${money(ledger.costPerKind[kind] ?? 0)}/req`,
                  ),
                ),
              ),
          ]
        : []),
      ...(costAllocation.length > 0
        ? [
            localized.div
              .class(
                css({
                  paddingInline: '5',
                  paddingBottom: '1',
                  fontSize: 'type.12',
                  color: 'mutedForeground',
                }),
              )
              .children('Cost allocation · by Service'),
            localized.div
              .class(
                cx(
                  WELL,
                  css({
                    marginInline: '5',
                    marginBottom: '4',
                    paddingInline: '4',
                    paddingBlock: '2',
                  }),
                ),
              )
              .children(
                ...costAllocation.map(([id, cost]) => {
                  const service = game.services.find((entry) => entry.id === id)
                  const team = game.teams.find((entry) => entry.id === service?.owner)
                  return figureRow(
                    localized,
                    `${service?.name ?? id} (${team?.name ?? 'core'})`,
                    t.cost.s(money(cost)),
                  )
                }),
              ),
          ]
        : []),
      localized.p
        .class(
          css({
            paddingInline: '5',
            paddingBottom: '4',
            fontSize: 'type.12-5',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.cost.billExplainer),
    ],
    css({ maxWidth: '560px' }),
  )
}
