import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { CONCURRENCY } from '@quorum/simulation/catalog'
import type { GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  picker,
  pinnedRuntime,
  section,
  serviceOwnership,
  stack,
} from './shared.ts'
import { scaledNodeSections } from './scaling.ts'

const concurrency = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorWorker.concurrency, [
    picker(
      h,
      'concurrency',
      CONCURRENCY.map((concurrency) => [concurrency, String(concurrency)] as const),
      node.concurrency,
      (concurrency) => Message.ConcurrencyChosen({ nodeId: node.id, concurrency }),
    ),
  ])
}

export const workerPanel: Panel = {
  body: ({ model, game, node, ledger, h }) => [
    ...scaledNodeSections(game, ledger, node, h),
    ...stack(model, node, h, pinnedRuntime(model, node), false),
    ...serviceOwnership(game, node, h),
    concurrency(node, h),
  ],
}
