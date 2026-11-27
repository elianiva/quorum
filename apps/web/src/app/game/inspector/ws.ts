import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy, localized } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { RT_HOLD_SECONDS, RUNTIMES } from '@quorum/simulation/catalog'
import { distributedErlang, hubConnections } from '@quorum/simulation/rules'
import { burnOf } from '@quorum/simulation/lookups'
import type { GameNode } from '@quorum/simulation/state'
import { compact, money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { type Content, type Panel, caption, picker, row, section } from './shared.ts'
import { runtimePickerView } from './stack-picker.ts'

const hubStack = (model: Model, node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  const game = model.board.game

  const runtime = localized(RUNTIMES[node.runtime], t.catalog.runtimes[node.runtime])
  return section(h, t.inspectorWs.runtime, [
    runtimePickerView(model, node, h, null, false),
    h.p
      .class(
        css({
          fontSize: 'type.12',
          lineHeight: 'snug',
          color: 'mutedForeground',
        }),
      )
      .children(runtime.blurb),
    caption(
      h,
      runtime.connectionKB === null
        ? t.inspectorWs.holdsNoConnectionsPickARuntime(runtime.name)
        : t.inspectorWs.holdsAboutConnections(
            compact(hubConnections(node, distributedErlang(game, node))),
          ),
    ),
  ])
}

const hub = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorWs.clients, [
    picker(
      h,
      'presence',
      [
        [false, t.inspectorWs.noPresence],
        [true, t.inspectorWs.presence],
      ],
      node.presence,
      (presence) => Message.HubOptionsChosen({ nodeId: node.id, presence }),
    ),
    picker(
      h,
      'backoff',
      [
        [false, t.inspectorWs.reconnectAtOnce],
        [true, t.inspectorWs.backoffWithJitter],
      ],
      node.backoff,
      (backoff) => Message.HubOptionsChosen({ nodeId: node.id, backoff }),
    ),
    picker(
      h,
      'clustering',
      [
        [false, t.inspectorWs.oneBox],
        [true, t.inspectorWs.clustered],
      ],
      node.clustering,
      (clustering) => Message.HubOptionsChosen({ nodeId: node.id, clustering }),
    ),
    caption(
      h,
      node.clustering
        ? t.inspectorWs.boxesShareAPubSubBackbone
        : t.inspectorWs.oneBoxTakesEveryConnectionLarger,
    ),
  ])
}

export const wsPanel: Panel = {
  stats: ({ game, node, own, h }) => {
    const t = copy(h)

    const max = hubConnections(node, distributedErlang(game, node))
    const held = own.inbound * RT_HOLD_SECONDS
    return [
      row(
        h,
        t.inspectorWs.connections,
        `${compact(Math.round(held))} / ${compact(Math.round(max))}`,
        max <= 0 || held >= max * 0.9 ? 'danger' : held >= max * 0.7 ? 'warn' : 'plain',
      ),
      row(h, t.inspectorWs.messages, t.inspectorWs.s(rate(own.inbound)), 'plain'),
      row(h, t.inspectorWs.latency, formats(t).ms(own.latency), 'plain'),
      row(
        h,
        t.inspectorWs.dropped,
        t.inspectorWs.s(rate(own.dropped)),
        own.dropped > 0.05 ? 'danger' : 'plain',
      ),
      row(h, t.inspectorWs.burn, t.inspectorWs.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ model, node, h }) => [hubStack(model, node, h), hub(node, h)],
}
