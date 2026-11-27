import { css } from '@quorum/styled-system/css'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { SYNC_MS } from '@quorum/simulation/catalog'
import { databasesOf, has, primaryOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'

import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  button,
  caption,
  nodeLink,
  picker,
  replicaEngine,
  section,
} from './shared.ts'

const replica = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)
  const primary = primaryOf(game, node)
  const promotable = databasesOf(game).length === 1
  return [
    section(
      h,
      t.inspectorReplica.primary,
      primary
        ? [
            nodeLink(game, primary, h),
            caption(h, t.inspectorReplica.primaryNote(nodeTitle(t, game, primary))),
          ]
        : [caption(h, t.inspectorReplica.noSinglePrimary)],
    ),
    replicaEngine(game, node, h),
    section(h, t.inspectorReplica.replication, [
      picker(
        h,
        'sync',
        [
          [false, t.inspectorReplica.asynchronous],
          [true, t.inspectorReplica.synchronous],
        ],
        node.sync,
        (sync) => Message.SyncChosen({ nodeId: node.id, sync }),
        (sync) => !sync || has(game, 'sync-replication'),
      ),
      caption(
        h,
        node.sync
          ? t.inspectorReplica.everyWriteWaits(t.units.ms(SYNC_MS))
          : t.inspectorReplica.noWriteCostAndTheReplica,
      ),
      ...(promotable
        ? [
            caption(h, t.inspectorDatabase.promoteNote),
            button(
              h,
              {
                onClick: Message.PromoteReplica({ nodeId: node.id }),
                variant: 'outline',
                size: 'sm',
                className: css({
                  alignSelf: 'flex-start',
                }),
                isDisabled: false,
              },
              [t.inspectorDatabase.promote],
            ),
          ]
        : []),
    ]),
  ]
}

export const replicaPanel: Panel = {
  body: ({ game, node, h }) => [...replica(game, node, h)],
}
