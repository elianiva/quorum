import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { SECOND_PROVIDER_FEE } from '@quorum/simulation/generated/psp'
import type { GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const paymentProvider = (node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(h, t.inspectorPayments.provider, [
      picker(
        h,
        'provider',
        [
          ['first', t.inspectorPayments.firstProvider],
          ['second', t.inspectorPayments.secondProvider],
        ] as const,
        node.provider,
        (provider) => Message.ProviderChosen({ nodeId: node.id, provider }),
      ),
      caption(
        h,
        node.provider === 'second'
          ? t.inspectorPayments.aSecondProviderCharges(Math.round((SECOND_PROVIDER_FEE - 1) * 100))
          : t.inspectorPayments.oneProviderTakesEveryCheckout,
      ),
    ]),
  ]
}

export const pspPanel: Panel = {
  body: ({ node, h }) => [...paymentProvider(node, h)],
}
