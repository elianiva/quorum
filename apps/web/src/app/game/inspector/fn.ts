import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import {
  SERVERLESS_CONCURRENCY,
  SERVERLESS_GB_SECOND,
  SERVERLESS_MEMORY_GB,
  SERVERLESS_REQUEST_PRICE,
} from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import { burnOf, coldStartMs, serverlessBurnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { compact, money, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, row, section } from './shared.ts'

const serverless = (
  game: Game,
  node: GameNode,
  ledger: Ledger,
  h: H<Message>,
): ReadonlyArray<Content> => {
  const t = copy(h)

  const own = ledger.nodes[node.id]
  const slots = own?.resources.slots
  const used = slots ? Math.min(slots.used, slots.total) : 0
  const done = own ? own.inbound - own.dropped : 0
  return [
    section(
      h,
      t.inspectorFn.executions,
      [
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorFn.oneExecutionHoldsTheRequest(compact(SERVERLESS_CONCURRENCY))),
        caption(
          h,
          t.inspectorFn.inFlight(
            compact(Math.round(used)),
            compact(slots?.total ?? SERVERLESS_CONCURRENCY),
          ),
        ),
      ],
      true,
    ),
    section(h, t.inspectorFn.coldStart, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.inspectorFn.aNewEnvironmentBoots(formats(t).ms(coldStartMs(node)))),
      caption(h, t.inspectorFn.changeTheRuntime),
    ]),
    section(h, t.inspectorFn.bill, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(
          t.inspectorFn.noBoxToPayFor(
            money(SERVERLESS_REQUEST_PRICE * 1_000),
            money(SERVERLESS_GB_SECOND),
            SERVERLESS_MEMORY_GB,
          ),
        ),
      caption(
        h,
        t.inspectorFn.thisUse(money(serverlessBurnOf(game, node, done, own?.latency ?? 0))),
      ),
    ]),
  ]
}

export const fnPanel: Panel = {
  stats: ({ game, node, own, h }) => {
    const t = copy(h)

    const slots = own.resources.slots
    const used = slots ? Math.min(slots.used, slots.total) : 0
    return [
      row(h, t.inspectorFn.inbound, t.inspectorFn.s(rate(own.inbound)), 'plain'),
      row(
        h,
        t.inspectorFn.executions,
        slots ? `${used.toFixed(1)} / ${compact(Math.round(slots.total))}` : '—',
        slots && used >= slots.total * 0.9 ? 'danger' : 'plain',
      ),
      row(h, t.inspectorFn.coldStart, formats(t).ms(coldStartMs(node)), 'plain'),
      row(
        h,
        t.inspectorFn.uses,
        t.inspectorFn.s(
          money(serverlessBurnOf(game, node, own.inbound - own.dropped, own.latency)),
        ),
        'plain',
      ),
      row(h, t.inspectorFn.standingBurn, t.inspectorFn.s(money(burnOf(game, node))), 'ok'),
    ]
  },
  body: ({ game, node, ledger, h }) => [...serverless(game, node, ledger, h)],
}
