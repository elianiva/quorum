import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { MAX_ATTEMPTS, QUEUE_LENGTHS } from '@quorum/simulation/catalog'
import type { GameNode } from '@quorum/simulation/state'
import { compact } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, picker, section } from './shared.ts'

const queue = (node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(h, t.inspectorQueue.failedTasks, [
      picker(
        h,
        'dlq',
        [
          [false, t.inspectorQueue.retryForever],
          [true, t.inspectorQueue.deadLetterQueue],
        ],
        node.dlq,
        (dlq) => Message.DlqChosen({ nodeId: node.id, dlq }),
      ),
      ...(node.dlq
        ? [
            picker(
              h,
              'attempts',
              MAX_ATTEMPTS.map((attempts) => [attempts, `${attempts}×`] as const),
              node.attempts,
              (attempts) => Message.AttemptsChosen({ nodeId: node.id, attempts }),
            ),
          ]
        : []),
    ]),
    section(h, t.inspectorQueue.maxLength, [
      picker(
        h,
        'max-length',
        QUEUE_LENGTHS.map(
          (maxLength) =>
            [maxLength, maxLength === 0 ? t.inspectorQueue.none : compact(maxLength)] as const,
        ),
        node.maxLength,
        (maxLength) => Message.MaxLengthChosen({ nodeId: node.id, maxLength }),
      ),
    ]),
  ]
}

export const queuePanel: Panel = {
  body: ({ node, h }) => [...queue(node, h)],
}
