import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { copy, localeOf, type Messages } from '@/i18n/messages.ts'
import { Check, Sparkles, X } from 'lucide'
import {
  AXES,
  FAMILIES,
  FRAMEWORKS,
  RUNTIMES,
  type Axes,
  type Axis,
  type FamilyId,
} from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import { migrationCost, targetOf } from '@quorum/simulation/migration'
import type { GameNode } from '@quorum/simulation/state'
import { deltaText } from './Hud.ts'
import { money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { glossaryUrl } from '@/platform/analytics.ts'
import type { Model, PreviewFigures, TradeoffOption } from '@/game/model.ts'
import type { TradeoffState } from '@/game/tradeoff-machine.ts'
import { icon } from '../ui/icon.ts'
import { buttonClass, type ButtonSize, type ButtonVariant } from '../ui/button-styles.ts'
import { FIGURE, PANEL } from '@quorum/ui/game/bits'

type Content = View.Content<Message>
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

const closeButton = (
  h: H<Message>,
  config: Readonly<{ label: string; onClick: Message; className?: string }>,
): Content =>
  h.button
    .attr('type', 'button')
    .attr('aria-label', config.label)
    .attr('title', config.label)
    .on('click', () => config.onClick)
    .class(
      cx(
        css({
          position: 'absolute',
          top: '1.5',
          right: '1.5',
          zIndex: 10,
          display: 'grid',
          width: '7',
          height: '7',
          placeItems: 'center',
          borderRadius: 'lg',
          color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
          _hover: { backgroundColor: 'well', color: 'foreground' },
          _focusVisible: {
            boxShadow: 'focus',
            outlineStyle: 'none',
          },
        }),
        config.className,
      ),
    )
    .children(icon(h, X, css({ width: '3.5', height: '3.5' })))

const kindTitleOf = (t: Messages): Record<TradeoffOption['kind'], string> => ({
  runtime: t.tradeoff.runtime,
  framework: t.tradeoff.framework,
  family: t.tradeoff.instance,
})

const axisLabelOf = (t: Messages): Record<Axis, string> => ({
  throughput: t.tradeoff.throughput,
  tail: t.tradeoff.tail,
  memory: t.tradeoff.memory,
  velocity: t.tradeoff.velocity,
  resilience: t.tradeoff.resilience,
  operability: t.tradeoff.operability,
})

const termsOf = (t: Messages): Readonly<Record<string, string>> => ({
  'process-per-request': t.tradeoff.processPerRequest,
  'shared-nothing': t.tradeoff.sharedNothing,
  'gil-global-interpreter-lock': 'GIL',
  'cold-start': t.tradeoff.coldStart,
  'event-loop': t.tradeoff.eventLoop,
  'blast-radius': t.tradeoff.blastRadius,
  'vertical-and-horizontal-scaling': t.tradeoff.horizontalScaling,
  'tech-debt': t.tradeoff.techDebt,
  'n1-query': t.tradeoff.n1Query,
})

const nameOf = (t: Messages, option: TradeoffOption): string => {
  switch (option.kind) {
    case 'runtime':
      return t.catalog.runtimes[option.id].name
    case 'framework':
      return t.catalog.frameworks[option.id].name
    case 'family':
      return t.catalog.families[option.id].name
  }
}

const currentOf = (node: GameNode, option: TradeoffOption): TradeoffOption => {
  switch (option.kind) {
    case 'runtime':
      return { kind: 'runtime', id: node.runtime }
    case 'framework':
      return { kind: 'framework', id: node.framework }
    case 'family':
      return { kind: 'family', id: node.family }
  }
}

const familyAxes = (family: FamilyId): Axes => {
  const { ramPerVcpu, price } = FAMILIES[family]
  const throttled = family === 'burstable'
  const arm = family === 'arm'
  return {
    throughput: price <= 0.5 ? 5 : price <= 0.9 ? 4 : price <= 1.05 ? 3 : 2,
    tail: throttled ? 1 : arm ? 3 : ramPerVcpu >= 8 ? 5 : 4,
    memory: ramPerVcpu >= 8 ? 5 : ramPerVcpu >= 4 ? 3 : 2,
    velocity: 3,
    resilience: throttled ? 2 : ramPerVcpu >= 8 ? 4 : ramPerVcpu >= 4 ? 3 : 2,
    operability: throttled ? 2 : arm ? 3 : 4,
  }
}

const familyOf = (family: FamilyId): Readonly<{ axes: Axes; glossary: ReadonlyArray<string> }> => ({
  axes: familyAxes(family),
  glossary: [],
})

const stackOf = (
  option: TradeoffOption,
): Readonly<{ axes: Axes; glossary: ReadonlyArray<string> }> =>
  option.kind === 'runtime'
    ? RUNTIMES[option.id]
    : option.kind === 'framework'
      ? FRAMEWORKS[option.id]
      : familyOf(option.id)

const SIZE = 220
const CENTER = SIZE / 2
const RADIUS = 62

const pointAt = (index: number, value: number): readonly [number, number] => {
  const angle = (Math.PI / 3) * index - Math.PI / 2
  const r = (RADIUS * value) / 5
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)]
}

const polygonOf = (axes: Axes): string =>
  AXES.map((axis, index) =>
    pointAt(index, axes[axis])
      .map((n) => n.toFixed(1))
      .join(','),
  ).join(' ')

const radar = (h: H<Message>, now: Axes, next: Axes): Content => {
  const t = copy(h)
  return h.svg
    .class(
      css({
        marginInline: 'auto',
        display: 'block',
        height: '176px',
        width: '220px',
        overflow: 'visible',
      }),
    )
    .attr('xmlns', 'http://www.w3.org/2000/svg')
    .attr('viewBox', `0 22 ${SIZE} 176`)
    .attr('aria-label', t.tradeoff.sixAxesNowAndWithThis)
    .children(
      ...[1, 2, 3, 4, 5].map((ring) =>
        h.polygon
          .key(`ring-${ring}`)
          .attr(
            'points',
            AXES.map((_, index) =>
              pointAt(index, ring)
                .map((n) => n.toFixed(1))
                .join(','),
            ).join(' '),
          )
          .attr('fill', 'none')
          .class(
            css({
              stroke: 'hairline',
            }),
          )
          .attr('stroke-width', '1')
          .children(),
      ),
      h.polygon
        .key('now')
        .attr('points', polygonOf(now))
        .class(
          css({
            fill: 'color-mix(in oklab, var(--muted-foreground) 10%, transparent)',
            stroke: 'mutedForeground',
          }),
        )
        .attr('stroke-width', '1.25')
        .attr('stroke-dasharray', '3 2')
        .children(),
      h.polygon
        .key('next')
        .attr('points', polygonOf(next))
        .class(
          css({
            fill: 'color-mix(in oklab, var(--group-compute) 20%, transparent)',
            stroke: 'groupCompute',
          }),
        )
        .attr('stroke-width', '1.75')
        .attr('stroke-linejoin', 'round')
        .children(),
      ...AXES.map((axis, index) => {
        const [x, y] = pointAt(index, 6.6)
        const anchor = Math.abs(x - CENTER) < 4 ? 'middle' : x > CENTER ? 'start' : 'end'
        const up = next[axis] > now[axis]
        const down = next[axis] < now[axis]
        return h.svgText
          .key(`label-${axis}`)
          .attr('x', x.toFixed(1))
          .attr('y', (y + 3.5).toFixed(1))
          .attr('text-anchor', anchor)
          .class(
            cx(
              css({
                fontSize: 'type.10-5',
                fontWeight: 'medium',
              }),
              up
                ? css({
                    fill: 'ok',
                  })
                : down
                  ? css({
                      fill: 'danger',
                    })
                  : css({
                      fill: 'mutedForeground',
                    }),
            ),
          )
          .children(axisLabelOf(t)[axis])
      }),
    )
}

const previewLine = (t: Messages, model: Model, preview: PreviewFigures): string =>
  deltaText(
    t,
    {
      id: 0,
      label: '',
      before: preview.before,
      after: preview.after,
      worse: false,
      shownAt: 0,
    },
    has(model.board.game, 'percentiles'),
  )

const costLine = (t: Messages, model: Model, preview: PreviewFigures): string => {
  const [before = 0, after = 0] = preview.burn
  const burn = after - before
  return [
    !model.board.game.sandbox && preview.cash > 0 ? money(preview.cash) : null,
    Math.abs(burn) >= 0.005
      ? t.tradeoff.burnChange(t.units.perSecond(`${burn > 0 ? '+' : '−'}${money(Math.abs(burn))}`))
      : null,
    preview.restart > 0 ? t.tradeoff.restartsCold(t.units.s(Math.ceil(preview.restart))) : null,
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

const worse = (preview: PreviewFigures): boolean =>
  preview.after.revenue < preview.before.revenue * 0.98 ||
  preview.after.errors > preview.before.errors + 0.005

const effect = (h: H<Message>, model: Model, card: TradeoffState): View.Input<Message> =>
  (card._tag === 'Hovering' || card._tag === 'Pinned') && card.preview
    ? h.div
        .class(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5',
          }),
        )
        .children(
          h.div
            .class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '2',
              }),
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
                    worse(card.preview)
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
                      fontSize: 'type.12',
                    }),
                  ),
                )
                .children(previewLine(copy(h), model, card.preview)),
            ),
          costLine(copy(h), model, card.preview)
            ? h.span
                .class(
                  cx(
                    FIGURE,
                    css({
                      paddingLeft: '4',
                      fontSize: 'type.11-5',
                      color: 'mutedForeground',
                    }),
                  ),
                )
                .children(costLine(copy(h), model, card.preview))
            : undefined,
        )
    : card._tag === 'Refused'
      ? h.span
          .class(
            css({
              fontSize: 'type.12',
              color: 'warn',
            }),
          )
          .children(card.reason)
      : undefined

const PLACE = css({
  position: 'absolute',
  top: '76px',
  right: '372px',
  zIndex: '20',
  width: '320px',
  _short: { right: '340px' },
})

const PLACE_PHONE = css({
  _compact: {
    left: '2',
    right: '2',
    top: 'auto',
    bottom: 'max(8px, env(safe-area-inset-bottom))',
    zIndex: '40',
    width: 'auto',
  },
})

const PLACE_SCREEN = css({
  _compact: {
    inset: '0',
    zIndex: '40',
    maxHeight: 'none',
    width: 'auto',
    overflowY: 'auto',
    borderRadius: '0',
    padding: '5',
    boxShadow: 'none',
  },
})

export const tradeoffCard = (h: H<Message>, model: Model): View.Input<Message> => {
  const t = copy(h)

  const card = model.board.tradeoff
  if (card._tag === 'Closed' || card.nodeId !== model.board.selected) return undefined
  const node = model.board.game.nodes.find((entry) => entry.id === card.nodeId)
  if (!node) return undefined
  const current = currentOf(node, card.option)
  const title = `${kindTitleOf(t)[card.option.kind]}: ${nameOf(t, current)} → ${nameOf(t, card.option)}`

  if (card._tag !== 'Pinned' && model.prefs.seenTradeoffs.includes(card.option.kind))
    return h.div
      .key('tradeoff-line')
      .class(
        cx(
          PLACE,
          PLACE_PHONE,
          PANEL,
          cx(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '1',
              paddingInline: '3.5',
              paddingBlock: '2.5',
            }),
            'enter-panel',
          ),
        ),
      )
      .children(
        h.span
          .class(
            css({
              fontSize: 'type.12-5',
              fontWeight: 'semibold',
            }),
          )
          .children(nameOf(t, card.option)),
        effect(h, model, card),
      )

  const stack = stackOf(card.option)
  const now = stackOf(current)
  const migration =
    !model.board.game.sandbox &&
    (node.type === 'server' || node.type === 'worker') &&
    (card.option.kind === 'runtime' || card.option.kind === 'framework')
      ? targetOf(
          node,
          card.option.kind === 'runtime'
            ? { runtime: card.option.id }
            : { framework: card.option.id },
        )
      : null
  return h.div
    .key('tradeoff')
    .class(
      cx(
        PLACE,
        PLACE_SCREEN,
        PANEL,
        cx(
          css({
            display: 'flex',
            flexDirection: 'column',
            gap: '3',
            padding: '4',
          }),
          'enter-panel',
        ),
      ),
    )
    .attr('aria-label', title)
    .children(
      h.div
        .class(
          css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            paddingRight: '7',
          }),
        )
        .children(
          icon(
            h,
            Sparkles,
            css({
              width: '4',
              height: '4',
              flexShrink: '0',
              color: 'groupCompute',
            }),
          ),
          h.span
            .class(
              css({
                minWidth: '0',
                flex: '1 1 0%',
                fontSize: 'type.13-5',
                fontWeight: 'semibold',
              }),
            )
            .children(title),
        ),
      card._tag === 'Pinned'
        ? closeButton(h, { label: t.tradeoff.cancelEscape, onClick: Message.TradeoffClosed() })
        : undefined,
      radar(h, now.axes, stack.axes),
      effect(h, model, card),
      migration && card._tag !== 'Refused'
        ? h.p
            .class(
              css({
                fontSize: 'type.12',
                lineHeight: 'snug',
                color: 'mutedForeground',
              }),
            )
            .children(
              node.type === 'worker'
                ? t.tradeoff.migrationDHAcrossAllWorkers(
                    migrationCost(
                      model.board.game,
                      migration,
                      { runtime: node.runtime, framework: node.framework },
                      'worker',
                    ),
                  )
                : t.tradeoff.migrationDHAcrossAllAppServers(
                    migrationCost(model.board.game, migration),
                  ),
            )
        : undefined,
      stack && stack.glossary.length > 0
        ? h.div
            .class(
              css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1.5',
              }),
            )
            .children(
              stack.glossary.map((anchor) =>
                h.a
                  .key(anchor)
                  .attr('href', glossaryUrl(anchor, localeOf(h)))
                  .attr('target', '_blank')
                  .attr('rel', 'noreferrer noopener')
                  .class(
                    css({
                      borderRadius: 'md',
                      backgroundColor: 'nested',
                      paddingInline: '1.5',
                      paddingBlock: '0.5',
                      fontSize: 'type.11',
                      color: 'mutedForeground',
                      textDecorationLine: 'underline',
                      textDecorationStyle: 'dotted',
                      textUnderlineOffset: '2',
                      _hover: {
                        color: 'foreground',
                      },
                    }),
                  )
                  .children(termsOf(t)[anchor] ?? anchor),
              ),
            )
        : undefined,
      card._tag === 'Pinned'
        ? h.div
            .class(
              css({
                display: 'flex',
                gap: '2',
              }),
            )
            .children(
              button(
                h,
                {
                  onClick: Message.OptionConfirmed(),
                  isDisabled: card.preview === null,
                  size: 'lg',
                  className: css({
                    flex: '1 1 0%',
                  }),
                  attributes: { title: t.tradeoff.confirmEnter },
                },
                [
                  icon(
                    h,
                    Check,
                    css({
                      width: '4',
                      height: '4',
                    }),
                  ),
                  migration ? t.tradeoff.startMigration : t.tradeoff.confirm,
                ],
              ),
              button(
                h,
                {
                  onClick: Message.TradeoffClosed(),
                  variant: 'outline',
                  size: 'lg',
                },
                [t.tradeoff.cancel],
              ),
            )
        : undefined,
    )
}
