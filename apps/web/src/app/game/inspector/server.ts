import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { COLLECTORS, GOGC, RUNTIMES } from '@quorum/simulation/catalog'
import { regional } from '@quorum/simulation/regions'
import { has } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
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

const fanout = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorServer.feeds, [
    picker(
      h,
      'fanout',
      [
        ['pull', t.inspectorServer.pull],
        ['push', t.inspectorServer.push],
      ],
      node.fanout,
      (choice) => Message.FanoutChosen({ nodeId: node.id, fanout: choice }),
    ),
  ])
}

const collector = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const language = RUNTIMES[node.runtime].language
  if (language === 'java')
    return [
      section(h, t.inspectorServer.collector, [
        picker(
          h,
          'collector',
          (Object.keys(COLLECTORS) as ReadonlyArray<keyof typeof COLLECTORS>).map(
            (id) => [id, t.catalog.collectors[id].label] as const,
          ),
          node.collector,
          (choice) => Message.CollectorChosen({ nodeId: node.id, collector: choice }),
          (choice) => choice !== 'zgc' || has(game, 'zgc'),
        ),
      ]),
    ]
  if (language === 'go' && has(game, 'gogc-tuning'))
    return [
      section(h, 'GOGC', [
        picker(
          h,
          'gogc',
          GOGC.map((entry) => [entry.gogc, `${entry.gogc}`] as const),
          node.gogc,
          (gogc) => Message.GogcChosen({ nodeId: node.id, gogc }),
        ),
      ]),
    ]
  return []
}

const routing = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const rows: Array<Content> = []
  if (has(game, 'load-shedding'))
    rows.push(
      picker(
        h,
        'shed',
        [
          [false, t.inspectorServer.dropEvenly],
          [true, t.inspectorServer.shedLowValue],
        ],
        node.shed,
        (shed) => Message.ShedChosen({ nodeId: node.id, shed }),
      ),
    )
  if (has(game, 'graceful-degradation'))
    rows.push(
      picker(
        h,
        'degrade',
        [
          [false, t.inspectorServer.keepKinds],
          [true, t.inspectorServer.dropDearest],
        ],
        node.degrade,
        (degrade) => Message.DegradeChosen({ nodeId: node.id, degrade }),
      ),
    )
  if (has(game, 'ryw-routing'))
    rows.push(
      picker(
        h,
        'ryw',
        [
          [false, t.inspectorServer.readsAnywhere],
          [true, t.inspectorServer.readYourWrites],
        ],
        node.ryw,
        (ryw) => Message.RywChosen({ nodeId: node.id, ryw }),
      ),
    )
  return rows.length > 0 ? [section(h, t.inspectorServer.overload, rows)] : []
}

export const serverPanel: Panel = {
  body: ({ model, game, node, ledger, h }) => [
    ...scaledNodeSections(game, ledger, node, h),
    ...stack(model, node, h, pinnedRuntime(model, node)),
    ...serviceOwnership(game, node, h),
    ...collector(game, node, h),
    ...routing(game, node, h),
  ],
  late: ({ game, node, h }) => (regional(game) ? [fanout(node, h)] : []),
}
