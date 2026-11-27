import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import type { GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const pooler = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorPooler.poolingMode, [
    picker(
      h,
      'pooler-mode',
      [
        ['session', t.inspectorPooler.session],
        ['transaction', t.inspectorPooler.transaction],
        ['statement', t.inspectorPooler.statement],
      ],
      node.mode,
      (mode) => Message.PoolerModeChosen({ nodeId: node.id, mode }),
      () => true,
      css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
    ),
    caption(
      h,
      node.mode === 'statement'
        ? t.inspectorPooler.oneServerConnectionPerStatementA
        : node.mode === 'session'
          ? t.inspectorPooler.oneServerConnectionPerClientBarely
          : t.inspectorPooler.oneServerConnectionPerActiveTransaction,
    ),
  ])
}

export const poolerPanel: Panel = {
  body: ({ node, h }) => [pooler(node, h)],
}
