import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { PARANOIA } from '@quorum/simulation/catalog'
import type { GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, picker, section } from './shared.ts'

const waf = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorWaf.paranoia, [
    picker(
      h,
      'paranoia',
      PARANOIA.map((entry) => [entry.level, `${entry.level}`] as const),
      node.paranoia,
      (paranoia) => Message.ParanoiaChosen({ nodeId: node.id, paranoia }),
    ),
    picker(
      h,
      'under-attack',
      [
        [false, t.inspectorWaf.normal],
        [true, t.inspectorWaf.underAttack],
      ],
      node.underAttack,
      (underAttack) => Message.UnderAttackChosen({ nodeId: node.id, underAttack }),
    ),
  ])
}

export const wafPanel: Panel = {
  body: ({ node, h }) => [waf(node, h)],
}
