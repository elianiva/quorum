import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { DNS_TTLS } from '@quorum/simulation/catalog'
import { has } from '@quorum/simulation/lookups'
import type { GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, picker, section } from './shared.ts'

const dnsTtl = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, 'TTL', [
    picker(
      h,
      'ttl',
      DNS_TTLS.map((ttl) => [ttl, formats(t).duration(ttl)] as const),
      node.ttl,
      (ttl) => Message.TtlChosen({ nodeId: node.id, ttl }),
    ),
  ])
}

export const dnsPanel: Panel = {
  late: ({ game, node, h }) => (has(game, 'health-checks') ? [dnsTtl(node, h)] : []),
}
