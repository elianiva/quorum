import { css } from '@quorum/styled-system/css'
import { copy, type Messages } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  BACKUPS,
  SHARD_COUNTS,
  DB_RETENTIONS,
  RESHARD_DH,
  SHARD_KEYS,
  RESTORE_DRILL_DH,
} from '@quorum/simulation/catalog'
import {
  dataGroupOf,
  databasesOfGroup,
  has,
  leaderOfGroup,
  primaryOf,
  shardingOf,
} from '@quorum/simulation/lookups'
import type { Game, GameNode, ShardKey, DbRetention, DbTopology } from '@quorum/simulation/state'

import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  button,
  caption,
  engine,
  nodeLink,
  picker,
  section,
} from './shared.ts'

const shardKeyNote = (t: Messages, node: GameNode): string => {
  const sharding = shardingOf(node)
  const hot = Math.round(sharding.hot * 100)
  const cross = Math.round(sharding.cross * 100)
  const far =
    sharding.farMs > 0
      ? ` ${t.inspectorDatabase.usersInOtherRegionsWait(t.units.ms(Math.round(sharding.farMs)))}`
      : ''
  return `${t.inspectorDatabase.theBusiestShardTakes(
    hot,
    cross,
    Math.round((sharding.scatter - 1) * 100),
    t.units.ms(sharding.scatterMs),
  )}${far}`
}

const database = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const shards = Math.max(1, Math.floor(node.shards))
  const group = dataGroupOf(game, node)
  const databases = databasesOfGroup(game, group)
  const leader = leaderOfGroup(game, group)
  const replicas = game.nodes.filter(
    (entry) => entry.type === 'replica' && primaryOf(game, entry)?.id === node.id,
  )
  const others = databases.filter((database) => database.id !== node.id)
  return [
    section(h, t.inspectorDatabase.topology, [
      picker(
        h,
        'topology',
        [
          ['single', t.inspectorDatabase.singlePrimary],
          ['sharded', t.inspectorDatabase.sharded],
          ['multi', t.inspectorDatabase.multiLeader],
        ] as ReadonlyArray<readonly [DbTopology, string]>,
        node.topology,
        (chosen) => Message.DbTopologyChosen({ nodeId: node.id, topology: chosen }),
        () => true,
        css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        node.topology === 'sharded'
          ? t.inspectorDatabase.topologySharded
          : node.topology === 'multi'
            ? t.inspectorDatabase.topologyMulti
            : t.inspectorDatabase.topologySingle,
      ),
      ...(leader && leader.id === node.id && node.topology === 'single'
        ? [
            h.div
              .class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                }),
              )
              .children(
                h.span
                  .class(
                    css({
                      fontSize: 'type.12',
                      fontWeight: 'medium',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.inspectorDatabase.leader),
                nodeLink(game, leader, h),
              ),
          ]
        : []),
      ...(others.length > 0
        ? [
            h.div
              .class(
                css({
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '2',
                }),
              )
              .children(
                h.span
                  .class(
                    css({
                      fontSize: 'type.12',
                      fontWeight: 'medium',
                      color: 'mutedForeground',
                    }),
                  )
                  .children(t.inspectorDatabase.dataGroup),
                h.div
                  .class(
                    css({
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                      columnGap: '2',
                      rowGap: '1',
                    }),
                  )
                  .children(...others.map((database) => nodeLink(game, database, h))),
              ),
          ]
        : [caption(h, t.inspectorDatabase.secondDatabaseFollows)]),
    ]),
    section(
      h,
      t.inspectorDatabase.readReplicas,
      replicas.length > 0
        ? replicas.map((replica) => nodeLink(game, replica, h))
        : [caption(h, t.inspectorDatabase.noReadReplicas)],
    ),
    engine(node, h),
    section(h, t.inspectorDatabase.shards, [
      picker(
        h,
        'shards',
        SHARD_COUNTS.map((count) => [count, `${count}`] as const),
        shards,
        (chosen) => Message.ShardsChosen({ nodeId: node.id, shards: chosen as GameNode['shards'] }),
        (count) => count === 1 || has(game, 'sharding'),
        css({ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        shards > 1
          ? t.inspectorDatabase.writesDivideAcross(shards, RESHARD_DH)
          : t.inspectorDatabase.onePrimaryAReadReplicaIs,
      ),
    ]),
    ...(shards > 1
      ? [
          section(h, t.inspectorDatabase.shardKey, [
            picker(
              h,
              'shard-key',
              (Object.keys(SHARD_KEYS) as ReadonlyArray<ShardKey>).map(
                (id) => [id, t.catalog.shardKeys[id].name] as const,
              ),
              node.shardKey,
              (shardKey) => Message.ShardKeyChosen({ nodeId: node.id, shardKey }),
              () => true,
              css({ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }),
            ),
            caption(h, shardKeyNote(t, node)),
          ]),
        ]
      : []),
    section(h, t.inspectorDatabase.reports, [
      picker(
        h,
        'materialized',
        [
          [false, t.inspectorDatabase.scanTheTable],
          [true, t.inspectorDatabase.materializedView],
        ],
        node.materialized,
        (materialized) => Message.MaterializedChosen({ nodeId: node.id, materialized }),
        (materialized) => !materialized || has(game, 'precompute'),
      ),
      caption(
        h,
        node.materialized
          ? t.inspectorDatabase.halfTheScanCPUAndThe
          : t.inspectorDatabase.everyReportScansTheTableItself,
      ),
    ]),
    section(h, t.inspectorDatabase.retention, [
      picker(
        h,
        'retention-policy',
        (Object.keys(DB_RETENTIONS) as ReadonlyArray<DbRetention>).map(
          (id) => [id, t.catalog.dbRetentions[id].name] as const,
        ),
        node.keep,
        (keep) => Message.DbRetentionChosen({ nodeId: node.id, keep }),
        (id) => id === 'keep' || has(game, 'retention'),
        css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
      ),
      caption(
        h,
        node.keep === 'archive'
          ? t.inspectorDatabase.oldRowsMoveToCheapStorage
          : node.keep === 'delete'
            ? t.inspectorDatabase.oldRowsAreGoneTheBill
            : t.inspectorDatabase.everyRowStaysOnTheFast,
      ),
    ]),
  ]
}

const backups = (game: Game, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorDatabase.backups, [
    picker(
      h,
      'backup',
      (Object.keys(BACKUPS) as ReadonlyArray<keyof typeof BACKUPS>).map(
        (id) => [id, t.catalog.backups[id].name] as const,
      ),
      node.backup,
      (backup) => Message.BackupChosen({ nodeId: node.id, backup }),
    ),
    caption(
      h,
      node.backup === 'none'
        ? t.inspectorDatabase.noBackupALostTableIs
        : node.restore === 'failed'
          ? t.inspectorDatabase.aRestoreFailedThisBackupWould
          : t.inspectorDatabase.thisBackupRestoresDrillItAgain,
    ),
    ...(node.backup === 'none'
      ? []
      : [
          button(
            h,
            {
              onClick: Message.RestoreDrilled({ nodeId: node.id }),
              variant: 'outline',
              size: 'sm',
              className: css({
                alignSelf: 'flex-start',
              }),
              isDisabled: game.devHours < RESTORE_DRILL_DH,
            },
            [t.inspectorDatabase.restoreDrillDH(RESTORE_DRILL_DH)],
          ),
        ]),
  ])
}

export const databasePanel: Panel = {
  body: ({ game, node, h }) => [...database(game, node, h)],
  late: ({ game, node, h }) => (has(game, 'pitr') ? [backups(game, node, h)] : []),
}
