import { css, cx } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { PROFILES, REQUEST_KINDS, type Kind } from '@quorum/simulation/catalog'
import { regional, regionUsers } from '@quorum/simulation/regions'
import type { ErrorCause } from '@quorum/simulation/distribution'
import type { Ledger } from '@quorum/simulation/ledger'
import { eraOf, has } from '@quorum/simulation/lookups'
import type { Game } from '@quorum/simulation/state'
import { compact, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { packetColor, packetShapeOf } from '@quorum/ui/game/packets'
import { FIGURE, NESTED } from '@quorum/ui/game/bits'
import { type Content, type Panel, percent, row, section } from './shared.ts'

const packetMark = (kind: Kind, size: number, h: H<Message>): Content => {
  const shape = packetShapeOf(kind)
  return h.span
    .class(
      cx(
        css({
          display: 'inline-block',
          flexShrink: '0',
        }),
        shape === 'circle'
          ? css({
              borderRadius: 'full',
            })
          : '',
        shape === 'square'
          ? css({
              borderRadius: '2xs',
            })
          : '',
        shape === 'triangle'
          ? css({
              clipPath: 'polygon(50% 0,100% 100%,0 100%)',
            })
          : '',
        shape === 'diamond'
          ? css({
              rotate: '45deg',
              borderRadius: '2xs',
            })
          : '',
      ),
    )
    .style({
      background: packetColor(kind),
      width: `${String(size)}px`,
      height: `${String(size)}px`,
    })
    .attr('aria-hidden', 'true')
    .children()
}

const traffic = (game: Game, ledger: Ledger, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const percentiles = has(game, 'percentiles')
  const kinds = REQUEST_KINDS.filter((kind) => ledger.kinds[kind])
  const list: Array<Content> = [
    section(
      h,
      t.inspectorUsers.requests,
      kinds.map((kind) => {
        const entry = ledger.kinds[kind]
        const failing = (entry?.success ?? 1) < 0.95
        const slow = (entry?.p99 ?? 0) > PROFILES[kind].apdex
        const line = h.div
          .key(kind)
          .class(
            css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              fontSize: 'type.12',
            }),
          )
          .children(
            packetMark(kind, 8, h),
            h.span.class(css({ flex: '1 1 0%' })).children(t.catalog.kinds[kind].label),
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    fontSize: 'type.11-5',
                  }),
                  failing
                    ? css({ color: 'danger' })
                    : slow
                      ? css({ color: 'warn' })
                      : css({ color: 'mutedForeground' }),
                ),
              )
              .children(
                t.inspectorUsers.sOk(
                  rate(entry?.rate ?? 0),
                  percent(entry?.success ?? 0),
                  percentiles ? '' : ` · ${formats(t).ms(entry?.mean ?? 0)}`,
                ),
              ),
          )
        if (!percentiles) return line
        return h.div
          .key(kind)
          .class(
            css({
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5',
            }),
          )
          .children(
            line,
            h.span
              .class(
                cx(
                  FIGURE,
                  css({
                    paddingLeft: '4',
                    fontSize: 'type.11-5',
                  }),
                  slow ? css({ color: 'warn' }) : css({ color: 'mutedForeground' }),
                ),
              )
              .children(
                t.inspectorUsers.percentileLine(
                  formats(t).ms(entry?.mean ?? 0),
                  formats(t).ms(entry?.p50 ?? 0),
                  formats(t).ms(entry?.p95 ?? 0),
                  formats(t).ms(entry?.p99 ?? 0),
                ),
              ),
          )
      }),
    ),
  ]
  if (has(game, 'logs')) {
    list.push(
      section(h, t.inspectorUsers.errorsByCause, [
        h.div
          .class(NESTED)
          .children(
            ...(Object.entries(ledger.errors) as ReadonlyArray<[ErrorCause, number]>).map(
              ([cause, value]) =>
                row(
                  h,
                  t.inspectorUsers.causes[cause],
                  t.inspectorUsers.s(rate(value)),
                  value > 0.01 ? 'danger' : 'plain',
                ),
            ),
          ),
      ]),
    )
  }
  return list
}

export const usersPanel: Panel = {
  stats: ({ game, node, ledger, h }) => {
    const t = copy(h)

    const target = eraOf(game).apdexTarget
    return [
      row(
        h,
        t.inspectorUsers.users,
        compact(regional(game) ? regionUsers(game)[node.region] : game.users),
        'plain',
      ),
      row(h, t.inspectorUsers.market, compact(ledger.market), 'plain'),
      row(h, t.inspectorUsers.requests, t.inspectorUsers.s(rate(ledger.demand)), 'plain'),
      row(
        h,
        t.inspectorUsers.apdexNow,
        ledger.apdex.toFixed(3),
        ledger.apdex >= target ? 'ok' : 'danger',
      ),
      row(
        h,
        t.inspectorUsers.apdexLastHour,
        game.apdex.toFixed(3),
        game.apdex >= target ? 'ok' : 'danger',
      ),
      row(h, t.inspectorUsers.velocity, `${ledger.velocity.toFixed(2)}×`, 'plain'),
    ]
  },
  top: ({ game, ledger, h }) => [...traffic(game, ledger, h)],
}
