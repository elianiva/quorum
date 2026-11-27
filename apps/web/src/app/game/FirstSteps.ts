import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import { COMPONENTS } from '@quorum/simulation/catalog'
import { money } from '@quorum/ui/game/format'
import { EYEBROW, FIGURE } from '@quorum/ui/game/bits'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { copy } from '@/i18n/messages.ts'
import { firstStepOf, firstStepNodeOf, upgradePriceOf } from '@/game/first-steps.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { buttonClass } from '../ui/button-styles.ts'
import { groupBadge } from './inspector/shared.ts'

type Child = View.Input<Message>

const CARD = css({
  pointerEvents: 'auto',
  display: 'flex',
  width: '380px',
  maxWidth: '100%',
  minWidth: '0',
  overflow: 'hidden',
  flexDirection: 'column',
  borderRadius: 'xl',
  layerStyle: 'surface',
  boxShadow: 'float',
  _compact: { width: 'auto' },
})

const HEAD = css({
  display: 'flex',
  minWidth: '0',
  alignItems: 'flex-start',
  gap: '2.5',
  paddingInline: '3',
  paddingTop: '2.5',
  paddingBottom: '2',
})

const COPY = css({
  display: 'flex',
  minWidth: '0',
  flex: '1 1 0%',
  flexDirection: 'column',
  gap: '0.5',
})

const TITLE = css({
  fontSize: 'type.13',
  fontWeight: 'semibold',
  lineHeight: 'snug',
  textWrap: 'pretty',
})

const BODY = css({
  fontSize: 'type.12',
  lineHeight: 'snug',
  color: 'mutedForeground',
  textWrap: 'pretty',
  '@media (max-width: 860px)': { display: 'none' },
})

const FOOT = css({
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '2',
  borderTopWidth: '1px',
  borderTopStyle: 'dashed',
  borderColor: 'hairline',
  paddingInline: '3',
  paddingBlock: '2',
})

const AMOUNT = css({ fontWeight: 'semibold' })

const button = (
  h: H<Message>,
  config: Readonly<{
    onClick: Message
    isDisabled: boolean
    title?: string | undefined
  }>,
  label: ReadonlyArray<Child>,
): Child => {
  const base = h.button
    .attr('type', 'button')
    .attr('tabindex', '0')
    .attr('aria-disabled', config.isDisabled ? 'true' : undefined)
    .attr('data-disabled', config.isDisabled ? '' : undefined)
    .attr('title', config.title)
    .class(buttonClass(undefined, 'sm'))
    .attr('data-slot', 'button')
  return (config.isDisabled ? base : base.on('click', () => config.onClick)).children(...label)
}

export const firstStepsBar = (h: H<Message>, model: Model): Child => {
  const step = firstStepOf(model)
  if (step === null) return undefined
  const t = copy(h)
  const node = firstStepNodeOf(model)
  if (node === null) return undefined
  const game = model.board.game
  const price = step === 'upgrade' ? upgradePriceOf(model) : null
  const enabled = step === 'collect' ? game.pending >= 0.01 : price !== null && game.cash >= price
  const type = step === 'collect' ? 'payments' : 'server'
  const title = step === 'collect' ? t.panels.collectTheRevenue : t.panels.upgradeTheAppServer
  const body =
    step === 'collect' ? t.panels.collectTheRevenueBody : t.panels.theAppServerIsYourFirstLimit
  const amount = step === 'collect' ? game.pending : (price ?? 0)
  const label: ReadonlyArray<Child> =
    step === 'collect'
      ? [t.panels.collect, ' ', h.span.class(cx(FIGURE, AMOUNT)).children(money(amount))]
      : [t.inspector.larger2(''), h.span.class(cx(FIGURE, AMOUNT)).children(money(amount))]
  const action =
    step === 'collect' ? Message.Collected() : Message.ResizeChosen({ nodeId: node, direction: 1 })
  return h.div
    .key(`first-step-${step}`)
    .attr('data-first-step', step)
    .class(cx(CARD, 'enter-down'))
    .children(
      h.div
        .class(HEAD)
        .children(
          groupBadge(
            COMPONENTS[type].group,
            COMPONENT_ICONS[type],
            css({ width: '7', height: '7', flexShrink: '0' }),
            h,
          ),
          h.div
            .class(COPY)
            .children(
              h.span.class(EYEBROW).children(t.panels.firstSteps),
              h.span.class(TITLE).children(title),
              h.p.attr('role', 'status').class(BODY).children(body),
            ),
        ),
      h.div.class(FOOT).children(
        h.span.class(EYEBROW).children(t.panels.stepOf(step === 'collect' ? 1 : 2, 2)),
        button(
          h,
          {
            onClick: action,
            isDisabled: !enabled,
            title:
              !enabled && step === 'upgrade'
                ? t.toasts.costs(t.catalog.components.server.name, money(price ?? 0))
                : undefined,
          },
          label,
        ),
      ),
    )
}
