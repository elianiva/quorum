import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { CERT_RENEW } from '@quorum/simulation/catalog'
import { burnOf, certDaysLeft, certDaysOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, row, section } from './shared.ts'

const secrets = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const left = certDaysLeft(game)
  const life = certDaysOf(game)
  return [
    section(
      h,
      t.inspectorPki.certificate,
      [
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(
            t.inspectorPki.aCertificateLastsCalendarDaysAnd(life, Math.round(life * CERT_RENEW)),
          ),
        caption(
          h,
          left === null
            ? t.inspectorPki.theFirstStepWithAManager
            : left <= 0
              ? t.inspectorPki.expiredEveryBrowserRefusesTheSite
              : t.inspectorPki.daysLeft(Math.max(0, Math.round(left))),
        ),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(t.inspectorPki.sellItOrLeaveItDown),
      ],
      true,
    ),
    section(h, t.inspectorPki.secrets, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.inspectorPki.theKeysLiveHereNotIn),
    ]),
  ]
}

export const pkiPanel: Panel = {
  stats: ({ game, node, h }) => {
    const t = copy(h)

    const left = certDaysLeft(game)
    const life = certDaysOf(game)
    return [
      row(h, t.inspectorPki.lifetime, t.inspectorPki.d(life), 'plain'),
      row(
        h,
        t.inspectorPki.expires,
        left === null
          ? t.inspectorPki.notIssuedYet
          : left <= 0
            ? t.inspectorPki.expired
            : t.inspectorPki.inD(Math.max(0, Math.round(left))),
        left === null ? 'warn' : left <= 1 ? 'danger' : left < 14 ? 'warn' : 'ok',
      ),
      row(h, t.inspectorPki.renewsAt, t.inspectorPki.d(Math.round(life * CERT_RENEW)), 'plain'),
      row(h, t.inspectorPki.burn, t.inspectorPki.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...secrets(game, node, h)],
}
