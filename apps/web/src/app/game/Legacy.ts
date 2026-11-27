import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { Effect } from 'effect'
import {
  BookCopy,
  Check,
  Clipboard,
  Copy,
  CopyPlus,
  Plus,
  SquareDashed,
  Stamp,
  Trash2,
  Upload,
  X,
} from 'lucide'
import {
  COMPONENTS,
  EXITS,
  VENTURE_IDS,
  VENTURES,
  type VentureId,
} from '@quorum/simulation/catalog'
import { exitOffers } from '@quorum/simulation/exit'
import { keepSlots, playbookSlots } from '@quorum/simulation/founder'
import { legacyMultiplier } from '@quorum/simulation/founding'
import { refundOf } from '@quorum/simulation/lookups'
import { valuationOf } from '@quorum/simulation/valuation'
import { clock, compact, money } from '@quorum/ui/game/format'
import { copy, localized, type Messages } from '@/i18n/messages.ts'
import { Message } from '@/game/message.ts'
import { confirmSellOf, ledgerOf, stampedPlaybook, type Model } from '@/game/model.ts'
import { SurveyMessage } from '@/game/survey.ts'
import { isSending, isSent, isSkipped } from '@/game/survey-machine.ts'
import { EYEBROW, FIGURE, FIGURE_STYLE, FLOAT, NESTED, SCROLL, WELL } from '@quorum/ui/game/bits'
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

/* The button primitive's markup, copied from packages/ui/src/primitives/button.ts. */
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

/* The textarea primitive's markup, copied from packages/ui/src/primitives/textarea.ts. */
const TEXTAREA = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  borderRadius: 'lg',
  borderWidth: '1px',
  paddingInline: '2.5',
  paddingBlock: '2',
  fontSize: 'type.16',
  lineHeight: 'normal',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  display: 'flex',
  minHeight: '16',
  width: '100%',
  outlineStyle: 'none',
  '&::placeholder': { color: 'mutedForeground' },
  '&:focus-visible': {
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
    '&[aria-disabled="true"], &[data-disabled]': {
      backgroundColor: 'color-mix(in oklab, var(--input) 80%, transparent)',
    },
  },
  '&[aria-disabled="true"], &[data-disabled]': {
    cursor: 'not-allowed',
    opacity: 0.5,
    backgroundColor: 'color-mix(in oklab, var(--input) 50%, transparent)',
  },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
  md: { fontSize: 'type.14', lineHeight: 'fine' },
  fieldSizing: 'content',
})

const TEXTAREA_LABEL = css({
  gap: '2',
  fontSize: 'type.14',
  lineHeight: 'none',
  fontWeight: 'medium',
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  '[data-disabled] &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
})

const TEXTAREA_WRAPPER = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
  width: '100%',
})

const textarea = (
  h: H<Message>,
  config: Readonly<{
    id: string
    label: string
    value: string
    onInput: (value: string) => Message
    rows: number
    isDisabled: boolean
  }>,
): Content => {
  const field = h.textarea
    .attr('id', config.id)
    .disabled(config.isDisabled)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .value(config.value)
    .attr('rows', String(config.rows))
    .attr('data-slot', 'textarea')
    .class(TEXTAREA)
  const editable = config.isDisabled
    ? field
    : field.on('input', ({ value }) => config.onInput(value))
  return h.div
    .class(TEXTAREA_WRAPPER)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .children(
      h.label
        .attr('for', config.id)
        .attr('data-slot', 'label')
        .class(TEXTAREA_LABEL)
        .children(config.label),
      editable,
    )
}

const stat = (h: H<Message>, name: string, value: string): Content =>
  h.div
    .key(name)
    .class(
      css({
        display: 'flex',
        flexDirection: 'column',
        gap: '1',
        paddingInline: '4',
        paddingBlock: '3',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(name),
      h.span.class(cx(FIGURE, css({ fontSize: 'type.18' }))).children(value),
    )

const stats = (h: H<Message>, columns: string, children: ReadonlyArray<Child>): Content =>
  h.div
    .class(
      cx(
        css({
          display: 'grid',
          width: '100%',
          '& > :not(:last-child)': {
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            borderColor: 'hairline',
          },
        }),
        WELL,
        columns,
      ),
    )
    .children(...children)

const footer = (h: H<Message>, children: ReadonlyArray<Child>): Content =>
  h.div
    .class(
      css({
        display: 'flex',
        flexWrap: 'wrap',
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
    .children(...children)

export const exitPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const game = model.board.game
  const ledger = ledgerOf(model)
  const value = valuationOf(game, ledger)
  const offers = exitOffers(game, ledger)
  const equity = Math.round(game.equity * 100)
  return shell(
    h,
    t,
    t.legacy.exit,
    [],
    [
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '4',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            SCROLL,
          ),
        )
        .children(
          stats(
            h,
            css({
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
            }),
            [
              stat(h, t.legacy.valuation, money(value.valuation)),
              stat(h, t.legacy.ruleOf40, value.ruleOf40.toFixed(0)),
              stat(h, t.legacy.equity, `${equity}%`),
              stat(h, t.legacy.legacy, legacyMultiplier(game.founding).toFixed(2)),
            ],
          ),
          h.div
            .class(
              cx(
                NESTED,
                css({
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
              ...offers.map((offer) => {
                const defined = EXITS[offer.id]
                const confirming = model.exitConfirm === offer.id
                const streak = offer.multiplier - defined.multiplier
                const notes = [
                  Number.isFinite(defined.cap) ? t.legacy.exitCap(money(defined.cap)) : '',
                  streak > 0 ? t.legacy.exitStreak(streak.toFixed(1)) : '',
                  defined.continues ? t.legacy.exitContinues : t.legacy.exitEnds,
                ].filter((entry) => entry !== '')
                return h.div
                  .key(offer.id)
                  .class(
                    css({
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2',
                      paddingInline: '4',
                      paddingBlock: '3',
                    }),
                  )
                  .children(
                    h.div
                      .class(
                        css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3',
                        }),
                      )
                      .children(
                        h.div
                          .class(
                            css({
                              display: 'flex',
                              minWidth: '0',
                              flex: '1 1 0%',
                              flexDirection: 'column',
                              gap: '0.5',
                            }),
                          )
                          .children(
                            h.span
                              .class(
                                css({
                                  fontSize: 'type.14',
                                  fontWeight: 'semibold',
                                }),
                              )
                              .children(t.catalog.exits[offer.id].name),
                            h.span
                              .class(
                                cx(
                                  FIGURE,
                                  css({
                                    fontSize: 'type.11-5',
                                    color: 'mutedForeground',
                                  }),
                                ),
                              )
                              .children(
                                t.legacy.exitMath(
                                  equity,
                                  money(offer.valuation),
                                  offer.multiplier.toFixed(1),
                                  money(offer.payout),
                                ),
                              ),
                            h.span
                              .class(
                                css({
                                  fontSize: 'type.11',
                                  color: 'mutedForeground',
                                }),
                              )
                              .children(notes.join(' · ')),
                          ),
                        confirming
                          ? h.div
                              .class(
                                css({
                                  display: 'flex',
                                  flexShrink: '0',
                                  gap: '2',
                                }),
                              )
                              .children(
                                button(
                                  h,
                                  {
                                    onClick: Message.ExitCancelled(),
                                    variant: 'ghost',
                                    size: 'lg',
                                  },
                                  t.legacy.cancel,
                                ),
                                button(
                                  h,
                                  { onClick: Message.ExitTaken({ exit: offer.id }), size: 'lg' },
                                  t.legacy.takeLegacy(offer.legacy),
                                ),
                              )
                          : button(
                              h,
                              { onClick: Message.ExitAsked({ exit: offer.id }), size: 'lg' },
                              [t.legacy.takeLegacy(offer.legacy)],
                            ),
                      ),
                    confirming
                      ? h.span
                          .class(
                            css({
                              fontSize: 'type.11-5',
                              color: 'warn',
                            }),
                          )
                          .children(t.legacy.exitConfirmNote(offer.legacy))
                      : undefined,
                  )
              }),
            ),
        ),
    ],
    css({ maxWidth: '620px' }),
  )
}

const snapshotSvg = (
  h: H<Message>,
  snapshot: Model['founder']['history'][number]['snapshot'],
  className: string,
): Content => {
  const xs = snapshot.nodes.map((node) => node.x)
  const ys = snapshot.nodes.map((node) => node.y)
  const left = Math.min(0, ...xs) - 40
  const top = Math.min(0, ...ys) - 40
  const width = Math.max(400, ...xs) - left + 280
  const height = Math.max(300, ...ys) - top + 200
  return h.svg
    .attr('aria-hidden', 'true')
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', `${left} ${top} ${width} ${height}`)
    .class(className)
    .attr('fill', 'none')
    .children(
      ...snapshot.links.map(([from, to], index) => {
        const a = snapshot.nodes[from]
        const b = snapshot.nodes[to]
        return a && b
          ? h.path
              .key(`l${index}`)
              .attr('d', `M${a.x + 108} ${a.y + 40} L${b.x + 108} ${b.y + 40}`)
              .attr('stroke-width', '6')
              .class(
                css({
                  stroke: 'color-mix(in oklab, var(--foreground) 25%, transparent)',
                }),
              )
              .children()
          : undefined
      }),
      ...snapshot.nodes.map((node, index) =>
        h.rect
          .key(`n${index}`)
          .attr('x', String(node.x))
          .attr('y', String(node.y))
          .attr('width', '216')
          .attr('height', '80')
          .attr('rx', '16')
          .attr('fill', `var(--group-${COMPONENTS[node.type].group})`)
          .attr('opacity', '0.75')
          .children(),
      ),
    )
}

const surveySection = (h: H<Message>, model: Model): Child => {
  const t = copy(h)
  const survey = model.survey
  if (isSkipped(survey.phase)) return undefined
  const frame = (body: Child): Content =>
    h.div
      .class(
        css({
          flexShrink: '0',
          borderTopWidth: '1px',
          borderTopStyle: 'solid',
          borderColor: 'hairline',
          paddingInline: '6',
          paddingTop: '4',
          paddingBottom: '3',
        }),
      )
      .children(body)
  if (isSent(survey.phase))
    return frame(
      h.div
        .class(
          cx(
            NESTED,
            css({
              display: 'flex',
              width: '100%',
              alignItems: 'center',
              gap: '2',
              paddingInline: '4',
              paddingBlock: '3',
              fontSize: 'type.12-5',
            }),
          ),
        )
        .children(
          icon(
            h,
            Check,
            css({
              width: '4',
              height: '4',
              color: 'ok',
            }),
          ),
          h.span.children(t.survey.sent),
        ),
    )
  const sending = isSending(survey.phase)
  const empty = survey.issues.trim() === '' && survey.likes.trim() === ''
  return frame(
    h.div
      .class(
        css({
          display: 'flex',
          width: '100%',
          flexDirection: 'column',
          gap: '3',
        }),
      )
      .children(
        h.div
          .class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            }),
          )
          .children(
            h.span.class(EYEBROW).children(t.survey.title),
            h.span
              .class(
                css({
                  fontSize: 'type.11-5',
                  color: 'mutedForeground',
                }),
              )
              .children(t.survey.note),
          ),
        h.div
          .class(
            css({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '2',
              _narrow: { gridTemplateColumns: '1fr' },
            }),
          )
          .children(
            textarea(h, {
              id: 'survey-issues',
              label: t.survey.issues,
              value: survey.issues,
              onInput: (value) =>
                Message.SurveyChanged({ message: SurveyMessage.IssuesChanged({ value }) }),
              rows: 2,
              isDisabled: sending,
            }),
            textarea(h, {
              id: 'survey-likes',
              label: t.survey.likes,
              value: survey.likes,
              onInput: (value) =>
                Message.SurveyChanged({ message: SurveyMessage.LikesChanged({ value }) }),
              rows: 2,
              isDisabled: sending,
            }),
          ),
        survey.phase._tag === 'Failed'
          ? h.span
              .class(
                css({
                  fontSize: 'type.11-5',
                  color: 'warn',
                }),
              )
              .children(t.survey.failed(survey.phase.note))
          : undefined,
        h.div
          .class(
            css({
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '2',
            }),
          )
          .children(
            button(
              h,
              { onClick: Message.SurveySkipped(), variant: 'ghost', size: 'sm' },
              t.survey.skip,
            ),
            button(
              h,
              {
                onClick: Message.SurveySubmitted(),
                size: 'sm',
                isDisabled: sending || empty,
              },
              sending ? t.survey.sending : t.survey.send,
            ),
          ),
      ),
  )
}

const nextVentureField = (h: H<Message>, model: Model): Content => {
  const t = copy(h)
  const current = model.founder.venture
  return h.label
    .class(
      css({
        display: 'flex',
        minWidth: '0',
        alignItems: 'center',
        gap: '2',
        marginRight: 'auto',
      }),
    )
    .children(
      h.span.class(EYEBROW).children(t.legacy.nextVenture),
      h.select
        .value(current)
        .attr('aria-label', t.legacy.nextVenture)
        .on('change', ({ value }) => Message.VentureChosen({ id: value as VentureId }))
        .class(
          css({
            height: '8',
            minWidth: '0',
            maxWidth: '260px',
            borderRadius: 'lg',
            borderWidth: '1px',
            borderStyle: 'solid',
            borderColor: 'border',
            backgroundColor: 'background',
            paddingInline: '2',
            fontSize: 'type.11-5',
            color: 'foreground',
            outlineStyle: 'none',
          }),
        )
        .children(
          ...VENTURE_IDS.map((id) => {
            const venture = localized(VENTURES[id], t.catalog.ventures[id])
            return h.option
              .attr('value', id)
              .selected(id === current)
              .children(`${venture.name} ×${venture.legacy.toFixed(1)}`)
          }),
        ),
    )
}

export const exitScreen = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const exited = model.companyPhase
  if (exited._tag !== 'Exited') return undefined
  const row = exited.row
  const slots = keepSlots(model.founder)
  const kept = model.founder.keep
  const venture = t.catalog.ventures[row.founding.venture].name
  const mutators = row.founding.mutators.map((id) => t.catalog.mutators[id].name)
  return h.main
    .key('exit')
    .class(
      css({
        display: 'grid',
        height: '100%',
        placeItems: 'center',
        overflow: 'auto',
        backgroundColor: 'canvas',
        padding: '6',
        _compact: { padding: '0' },
      }),
    )
    .children(
      h.div
        .attr('role', 'dialog')
        .attr('aria-label', t.catalog.exits[row.exit].name)
        .class(
          cx(
            FLOAT,
            'enter-modal',
            css({
              display: 'flex',
              maxHeight: '100%',
              width: '100%',
              maxWidth: '680px',
              flexDirection: 'column',
              overflow: 'hidden',
              _compact: {
                height: '100%',
                maxHeight: 'none',
                maxWidth: 'none',
                borderRadius: '0',
                boxShadow: 'none',
              },
            }),
          ),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '4',
                paddingInline: '6',
                paddingTop: '4',
                paddingBottom: '2',
              }),
            )
            .children(
              h.span
                .class(
                  css({
                    fontSize: 'type.17',
                    fontWeight: 'semibold',
                    letterSpacing: 'tight',
                  }),
                )
                .children(t.catalog.exits[row.exit].name),
              h.span.class(EYEBROW).children(t.catalog.eras[row.stage]?.name ?? ''),
            ),
          h.div
            .class(
              cx(
                css({
                  display: 'flex',
                  minHeight: '0',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4',
                  paddingInline: '6',
                  paddingTop: '1',
                  paddingBottom: '5',
                }),
                SCROLL,
              ),
            )
            .children(
              snapshotSvg(
                h,
                row.snapshot,
                css({
                  height: '180px',
                  flexShrink: '0',
                  width: '100%',
                  maxWidth: '520px',
                  borderRadius: 'xl',
                  backgroundColor: 'well',
                  boxShadow: 'well',
                  padding: '2',
                }),
              ),
              h.span
                .class(
                  css(FIGURE_STYLE, {
                    fontSize: 'type.30',
                    fontWeight: 'semibold',
                    letterSpacing: 'heading',
                  }),
                )
                .children(t.legacy.legacy2(row.legacy)),
              stats(
                h,
                css({
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  _narrow: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
                }),
                [
                  stat(h, t.legacy.payout2, money(row.payout)),
                  stat(h, t.legacy.peakUsers, compact(row.peak)),
                  stat(h, t.legacy.era, t.catalog.eras[row.stage]?.name ?? ''),
                  stat(h, t.legacy.played, clock(row.time)),
                ],
              ),
              h.div
                .class(
                  cx(
                    NESTED,
                    css({
                      display: 'flex',
                      width: '100%',
                      flexDirection: 'column',
                    }),
                  ),
                )
                .children(
                  h.div
                    .class(
                      css({
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '3',
                        paddingInline: '4',
                        paddingBlock: '2.5',
                        fontSize: 'type.12-5',
                      }),
                    )
                    .children(
                      h.span.class(css({ color: 'mutedForeground' })).children(t.legacy.founding),
                      h.span.class(FIGURE).children(venture),
                    ),
                  mutators.length > 0
                    ? h.div
                        .class(
                          css({
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: '3',
                            paddingInline: '4',
                            paddingBlock: '2.5',
                            fontSize: 'type.12-5',
                          }),
                        )
                        .children(
                          h.span
                            .class(css({ color: 'mutedForeground' }))
                            .children(t.legacy.mutators),
                          h.span.class(FIGURE).children(mutators.join(' · ')),
                        )
                    : undefined,
                  h.div
                    .class(
                      css({
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                        gap: '3',
                        paddingInline: '4',
                        paddingBlock: '2.5',
                        fontSize: 'type.12-5',
                      }),
                    )
                    .children(
                      h.span.class(css({ color: 'mutedForeground' })).children(t.legacy.legacy),
                      h.span.class(FIGURE).children(legacyMultiplier(row.founding).toFixed(2)),
                    ),
                ),
              slots > 0
                ? h.div
                    .class(
                      css({
                        display: 'flex',
                        width: '100%',
                        flexDirection: 'column',
                        gap: '2',
                      }),
                    )
                    .children(
                      h.span.class(EYEBROW).children(t.legacy.keepResearch(kept.length, slots)),
                      h.div
                        .class(
                          css({
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '1.5',
                          }),
                        )
                        .children(
                          ...exited.researched.map((id) =>
                            button(
                              h,
                              {
                                onClick: Message.KeepToggled({ id }),
                                size: 'xs',
                                variant: kept.includes(id) ? 'default' : 'outline',
                                key: id,
                              },
                              t.catalog.research[id].name,
                            ),
                          ),
                        ),
                    )
                : undefined,
            ),
          surveySection(h, model),
          footer(h, [
            nextVentureField(h, model),
            button(
              h,
              { onClick: Message.MenuChosen({ menu: 'legacy' }), variant: 'outline', size: 'lg' },
              t.legacy.legacyShop,
            ),
            button(h, { onClick: Message.TitleOpened(), size: 'lg' }, t.legacy.nextCompany),
          ]),
        ),
    )
}

export const selectionBar = (h: H<Message>, model: Model): Child => {
  const t = copy(h)
  return model.board.selection.length === 0
    ? undefined
    : h.div
        .key('selection')
        .class(
          cx(
            css({
              pointerEvents: 'auto',
              display: 'flex',
              height: '52px',
              alignItems: 'center',
              gap: '2',
              borderRadius: '2xl',
              layerStyle: 'surface',
              paddingBlock: '1.5',
              paddingRight: '1.5',
              paddingLeft: '3.5',
              fontSize: 'type.12-5',
              boxShadow: 'card',
            }),
            'enter-pop',
          ),
        )
        .children(
          h.span.class(FIGURE).children(t.legacy.selected(model.board.selection.length)),
          ...(
            [
              [Message.NodesCopied(), Copy, t.legacy.copyCtrlC],
              [Message.NodesDuplicated(), CopyPlus, t.legacy.duplicateCtrlD],
              [Message.NodesBoxed(), SquareDashed, t.legacy.boxTheNodes],
              [Message.SellAsked(), Trash2, t.legacy.sellDel],
              [Message.PlaybookSaved(), BookCopy, t.legacy.saveAsPlaybook],
              [Message.SelectionCleared(), X, t.legacy.clearSelectionEsc],
            ] as const
          ).map(([onClick, glyph, label]) =>
            button(
              h,
              {
                onClick,
                size: 'icon-sm',
                variant: 'ghost',
                attributes: { 'aria-label': label, title: label },
              },
              icon(
                h,
                glyph,
                css({
                  width: '4',
                  height: '4',
                }),
              ),
            ),
          ),
        )
}

export const sellBar = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const ids = confirmSellOf(model.board)
  if (!ids) return undefined
  const refund = model.board.game.nodes
    .filter((node) => ids.includes(node.id))
    .reduce((total, node) => total + refundOf(model.board.game, node), 0)
  return h.div
    .key('sell')
    .class(
      cx(
        css({
          pointerEvents: 'auto',
          display: 'flex',
          height: '52px',
          alignItems: 'center',
          gap: '2',
          borderRadius: '2xl',
          layerStyle: 'surface',
          paddingBlock: '1.5',
          paddingRight: '1.5',
          paddingLeft: '3.5',
          fontSize: 'type.12-5',
          boxShadow: 'card',
        }),
        'enter-pop',
      ),
    )
    .children(
      h.span.children(
        t.legacy.sell(
          ids.length === 1 ? t.legacy.n1Node : t.legacy.nodes(ids.length),
          refund > 0 ? t.legacy.forText(money(refund)) : '',
        ),
      ),
      button(h, { onClick: Message.SellConfirmed(), size: 'sm', variant: 'destructive' }, [
        icon(
          h,
          Trash2,
          css({
            width: '3.5',
            height: '3.5',
          }),
        ),
        t.legacy.sell2,
      ]),
      button(
        h,
        { onClick: Message.SellDismissed(), size: 'sm', variant: 'ghost' },
        t.legacy.cancel,
      ),
    )
}

export const stampBar = (h: H<Message>, model: Model): Child => {
  const t = copy(h)

  const playbook = stampedPlaybook(model)
  return playbook
    ? h.div
        .key('stamp')
        .class(
          cx(
            css({
              display: 'flex',
              height: '52px',
              alignItems: 'center',
              gap: '2',
              borderRadius: '2xl',
              layerStyle: 'surface',
              paddingInline: '3.5',
              fontSize: 'type.12-5',
              boxShadow: 'card',
            }),
            'enter-pop',
          ),
        )
        .children(
          icon(
            h,
            Stamp,
            css({
              width: '3.5',
              height: '3.5',
              color: 'primaryStrong',
            }),
          ),
          t.legacy.clickToPlaceEsc(playbook.name),
        )
    : undefined
}

export const playbooksPanel = (h: H<Message>, model: Model): Content => {
  const t = copy(h)

  const founder = model.founder
  return shell(
    h,
    t,
    t.legacy.playbooks,
    [
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
        .children(`${founder.playbooks.length}/${playbookSlots(founder)}`),
      button(h, { onClick: Message.PlaybookImportAsked(), variant: 'outline', size: 'sm' }, [
        icon(
          h,
          Upload,
          css({
            width: '3.5',
            height: '3.5',
          }),
        ),
        t.legacy.importText,
      ]),
    ],
    [
      h.div
        .class(
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '2',
              paddingInline: '5',
              paddingTop: '1',
              paddingBottom: '5',
            }),
            SCROLL,
          ),
        )
        .children(
          ...(founder.playbooks.length === 0
            ? [
                h.span
                  .key('empty')
                  .class(
                    css({
                      fontSize: 'type.12-5',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.legacy.shiftClickOrShiftDragNodes),
              ]
            : founder.playbooks.map((playbook, index) =>
                h.div
                  .key(`p${index}`)
                  .class(
                    cx(
                      NESTED,
                      css({
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2',
                        paddingInline: '3',
                        paddingBlock: '2',
                      }),
                    ),
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
                          fontSize: 'type.13',
                          fontWeight: 'medium',
                        }),
                      )
                      .children(playbook.name),
                    h.span
                      .class(
                        cx(
                          FIGURE,
                          css({
                            fontSize: 'type.11-5',
                            color: 'mutedForeground',
                          }),
                        ),
                      )
                      .children(t.legacy.nodes(playbook.nodes.length)),
                    button(h, { onClick: Message.PlaybookChosen({ index }), size: 'sm' }, [
                      icon(
                        h,
                        Plus,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                      t.legacy.place,
                    ]),
                    button(
                      h,
                      {
                        onClick: Message.PlaybookExported({ index }),
                        variant: 'ghost',
                        size: 'icon-sm',
                        attributes: { 'aria-label': t.legacy.copy, title: t.legacy.copyAsText },
                      },
                      icon(
                        h,
                        Clipboard,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                    ),
                    button(
                      h,
                      {
                        onClick: Message.PlaybookDeleted({ index }),
                        variant: 'ghost',
                        size: 'icon-sm',
                        attributes: {
                          'aria-label': t.legacy.deleteText,
                          title: t.legacy.deleteText,
                        },
                      },
                      icon(
                        h,
                        Trash2,
                        css({
                          width: '3.5',
                          height: '3.5',
                        }),
                      ),
                    ),
                  ),
              )),
        ),
    ],
    css({ maxWidth: '560px' }),
  )
}
