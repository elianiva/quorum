import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { has } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, picker, section, splitting, spreading } from './shared.ts'

const QUORUM = [1, 2, 3, 4, 5] as const

const wide = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  return [
    section(h, t.inspectorShared.quorum, [
      picker(
        h,
        'n',
        QUORUM.map((n) => [n, `N${n}`] as const),
        node.n,
        (n) =>
          Message.QuorumChosen({
            nodeId: node.id,
            n,
            r: Math.min(node.r, n),
            w: Math.min(node.w, n),
          }),
      ),
      picker(
        h,
        'r',
        QUORUM.filter((r) => r <= node.n).map((r) => [r, `R${r}`] as const),
        node.r,
        (r) => Message.QuorumChosen({ nodeId: node.id, n: node.n, r, w: node.w }),
      ),
      picker(
        h,
        'w',
        QUORUM.filter((w) => w <= node.n).map((w) => [w, `W${w}`] as const),
        node.w,
        (w) => Message.QuorumChosen({ nodeId: node.id, n: node.n, r: node.r, w }),
      ),
    ]),
    ...(has(game, 'hybrid-fanout') ? [splitting(node, h)] : []),
    ...spreading(game, node, h),
  ]
}

export const widePanel: Panel = {
  late: ({ game, node, h }) => [...wide(game, node, h)],
}
