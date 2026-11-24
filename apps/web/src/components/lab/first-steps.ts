import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { COMPONENTS } from '@quorum/simulation/catalog'
import { money } from '@quorum/ui/game/format'
import { EYEBROW, FIGURE, groupBadge } from '@quorum/ui/game/bits'
import { COMPONENT_ICONS } from '@quorum/ui/game/component-icons'
import { button } from '@quorum/ui/primitives/button'
import { copy } from '@/i18n/messages.ts'
import { firstStepOf, firstStepNodeOf, upgradePriceOf } from '@/game/first-steps.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'

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
  _compact: {
    width: 'auto',
  },
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
  '@media (max-width: 860px)': {
    display: 'none',
  },
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

const AMOUNT = css({
  fontWeight: 'semibold',
})

export const firstStepsBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const step = firstStepOf(model)
  if (step === null) return h.empty
  const t = copy(h)
  const node = firstStepNodeOf(model)
  if (node === null) return h.empty
  const game = model.board.game
  const price = step === 'upgrade' ? upgradePriceOf(model) : null
  const enabled = step === 'collect' ? game.pending >= 0.01 : price !== null && game.cash >= price
  const type = step === 'collect' ? 'payments' : 'server'
  const title = step === 'collect' ? t.panels.collectTheRevenue : t.panels.upgradeTheAppServer
  const body =
    step === 'collect' ? t.panels.collectTheRevenueBody : t.panels.theAppServerIsYourFirstLimit
  const amount = step === 'collect' ? game.pending : (price ?? 0)
  const label =
    step === 'collect'
      ? [t.panels.collect, ' ', h.span([h.Class(cx(FIGURE, AMOUNT))], [money(amount)])]
      : [t.inspector.larger2(''), h.span([h.Class(cx(FIGURE, AMOUNT))], [money(amount)])]
  const action =
    step === 'collect' ? Message.Collected() : Message.ResizeChosen({ nodeId: node, direction: 1 })
  return h.div(
    [
      h.Key(`first-step-${step}`),
      h.DataAttribute('first-step', step),
      h.Class(cx(CARD, 'enter-down')),
    ],
    [
      h.div(
        [h.Class(HEAD)],
        [
          groupBadge(
            COMPONENTS[type].group,
            COMPONENT_ICONS[type],
            css({ width: '7', height: '7', flexShrink: '0' }),
            h,
          ),
          h.div(
            [h.Class(COPY)],
            [
              h.span([h.Class(EYEBROW)], [t.panels.firstSteps]),
              h.span([h.Class(TITLE)], [title]),
              h.p([h.Role('status'), h.Class(BODY)], [body]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(FOOT)],
        [
          h.span([h.Class(EYEBROW)], [t.panels.stepOf(step === 'collect' ? 1 : 2, 2)]),
          button(
            {
              onClick: action,
              isDisabled: !enabled,
              size: 'sm',
              attributes:
                !enabled && step === 'upgrade'
                  ? [h.Title(t.toasts.costs(t.catalog.components.server.name, money(price ?? 0)))]
                  : [],
            },
            label,
            h,
          ),
        ],
      ),
    ],
  )
}
