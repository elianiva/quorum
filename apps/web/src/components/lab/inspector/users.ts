import { css, cx } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { PROFILES, REQUEST_KINDS } from '@quorum/simulation/catalog'
import { regional, regionUsers } from '@quorum/simulation/regions'
import type { ErrorCause } from '@quorum/simulation/distribution'
import type { Ledger } from '@quorum/simulation/ledger'
import { eraOf, has } from '@quorum/simulation/lookups'
import type { Game } from '@quorum/simulation/state'
import { compact, rate } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { packetMark } from '@quorum/ui/game/packets'
import { FIGURE, NESTED, row } from '@quorum/ui/game/bits'
import { type Panel, percent, section } from './shared.ts'

const traffic = (game: Game, ledger: Ledger, h: HtmlBuilder<Message>): ReadonlyArray<Html> => {
  const t = copy(h)

  const percentiles = has(game, 'percentiles')
  const kinds = REQUEST_KINDS.filter((kind) => ledger.kinds[kind])
  const list = [
    section(
      t.inspectorUsers.requests,
      kinds.map((kind) => {
        const entry = ledger.kinds[kind]
        const failing = (entry?.success ?? 1) < 0.95
        const slow = (entry?.p99 ?? 0) > PROFILES[kind].apdex
        const line = h.div(
          [
            h.Key(kind),
            h.Class(
              css({
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: 'calc(12px*var(--type-scale))',
              }),
            ),
          ],
          [
            // The kind's packet shape, so the legend teaches what the belts carry (15).
            packetMark(kind, 8, h),
            h.span(
              [
                h.Class(
                  css({
                    flex: '1 1 0%',
                  }),
                ),
              ],
              [t.catalog.kinds[kind].label],
            ),
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      fontSize: 'calc(11.5px*var(--type-scale))',
                    }),
                    failing
                      ? css({ color: 'var(--danger)' })
                      : slow
                        ? css({ color: 'var(--warn)' })
                        : css({ color: 'var(--muted-foreground)' }),
                  ),
                ),
              ],
              [
                t.inspectorUsers.sOk(
                  rate(entry?.rate ?? 0),
                  percent(entry?.success ?? 0),
                  percentiles ? '' : ` · ${formats(t).ms(entry?.mean ?? 0)}`,
                ),
              ],
            ),
          ],
        )
        if (!percentiles) return line
        return h.div(
          [
            h.Key(kind),
            h.Class(
              css({
                display: 'flex',
                flexDirection: 'column',
                gap: '0.125rem',
              }),
            ),
          ],
          [
            line,
            h.span(
              [
                h.Class(
                  cx(
                    FIGURE,
                    css({
                      paddingLeft: '1rem',
                      fontSize: 'calc(11.5px*var(--type-scale))',
                    }),
                    slow
                      ? css({ color: 'var(--warn)' })
                      : css({ color: 'var(--muted-foreground)' }),
                  ),
                ),
              ],
              [
                t.inspectorUsers.percentileLine(
                  formats(t).ms(entry?.mean ?? 0),
                  formats(t).ms(entry?.p50 ?? 0),
                  formats(t).ms(entry?.p95 ?? 0),
                  formats(t).ms(entry?.p99 ?? 0),
                ),
              ],
            ),
          ],
        )
      }),
      h,
    ),
  ]
  if (has(game, 'logs')) {
    list.push(
      section(
        t.inspectorUsers.errorsByCause,
        [
          h.div(
            [h.Class(NESTED)],
            (Object.entries(ledger.errors) as ReadonlyArray<[ErrorCause, number]>).map(
              ([cause, value]) =>
                row(
                  t.inspectorUsers.causes[cause],
                  t.inspectorUsers.s(rate(value)),
                  value > 0.01 ? 'danger' : 'plain',
                  h,
                ),
            ),
          ),
        ],
        h,
      ),
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
        t.inspectorUsers.users,
        compact(regional(game) ? regionUsers(game)[node.region] : game.users),
        'plain',
        h,
      ),
      row(t.inspectorUsers.market, compact(ledger.market), 'plain', h),
      row(t.inspectorUsers.requests, t.inspectorUsers.s(rate(ledger.demand)), 'plain', h),
      row(
        t.inspectorUsers.apdexNow,
        ledger.apdex.toFixed(3),
        ledger.apdex >= target ? 'ok' : 'danger',
        h,
      ),
      row(
        t.inspectorUsers.apdexLastHour,
        game.apdex.toFixed(3),
        game.apdex >= target ? 'ok' : 'danger',
        h,
      ),
      row(t.inspectorUsers.velocity, `${ledger.velocity.toFixed(2)}×`, 'plain', h),
    ]
  },
  top: ({ game, ledger, h }) => [...traffic(game, ledger, h)],
}
