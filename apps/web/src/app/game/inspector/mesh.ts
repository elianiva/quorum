import { css } from '@quorum/styled-system/css'
import { copy, nodeTitle } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { MESH_HOP_MS, MESH_OVERHEAD, MESH_INSIGHT } from '@quorum/simulation/catalog'
import { platformTax } from '@quorum/simulation/team'
import { burnOf, meshMembers } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  caption,
  percent,
  percentNumber,
  row,
  section,
} from './shared.ts'

const sidecars = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const members = meshMembers(game, node)
  return [
    section(
      h,
      t.inspectorMesh.sidecars,
      [
        ...(members.length === 0
          ? [caption(h, t.inspectorMesh.linkAppServersOrWorkersInto)]
          : members.map((member) =>
              h.div
                .key(member.id)
                .class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '2',
                    paddingBlock: '0.5',
                  }),
                )
                .children(caption(h, nodeTitle(t, game, member))),
            )),
        h.p
          .class(
            css({
              fontSize: 'type.12',
              lineHeight: 'snug',
              color: 'mutedForeground',
            }),
          )
          .children(
            t.inspectorMesh.eachSidecarRetries(
              percentNumber(MESH_INSIGHT),
              t.units.ms(MESH_HOP_MS),
              percentNumber(MESH_OVERHEAD),
            ),
          ),
        caption(h, t.inspectorMesh.mutualTLSSitsOnEveryMember),
      ],
      true,
    ),
  ]
}

export const meshPanel: Panel = {
  stats: ({ game, node, h }) => {
    const t = copy(h)

    const members = meshMembers(game, node)
    const sidecars = members.length
    return [
      row(h, t.inspectorMesh.sidecars, `${sidecars}`, sidecars === 0 ? 'warn' : 'plain'),
      row(h, t.inspectorMesh.perHop, `+${t.units.ms(MESH_HOP_MS)}`, 'plain'),
      row(h, t.inspectorMesh.memberCPU, `−${percent(MESH_OVERHEAD)}`, 'plain'),
      row(h, t.inspectorMesh.insight, t.inspectorMesh.onItsLinks(percent(MESH_INSIGHT)), 'ok'),
      row(
        h,
        t.inspectorMesh.platform,
        t.inspectorMesh.engineers(platformTax(game).toFixed(1)),
        'plain',
      ),
      row(h, t.inspectorMesh.burn, t.inspectorMesh.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...sidecars(game, node, h)],
}
