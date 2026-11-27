import { css } from '@quorum/styled-system/css'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { BAD_DEPLOY_ERRORS, ROLLOUT_STEPS } from '@quorum/simulation/catalog'
import { badDeployShareOf, blastService, rolloutOf } from '@quorum/simulation/team'
import { liveFeatures } from '@quorum/simulation/features'
import { burnOf } from '@quorum/simulation/lookups'
import type { Game, GameNode } from '@quorum/simulation/state'
import { money } from '@quorum/ui/game/format'
import { Message } from '@/game/message.ts'
import {
  type Content,
  type Panel,
  caption,
  choice,
  percentNumber,
  row,
  section,
  segmented,
  serviceNameIn,
} from './shared.ts'

const flags = (game: Game, node: GameNode, h: H<Message>): ReadonlyArray<Content> => {
  const t = copy(h)

  const service = blastService(game)
  const batch = service.lastDeploy
  const listed = batch.length > 0 ? batch : liveFeatures(game)
  return [
    section(
      h,
      t.inspectorFf.rollout,
      [
        ...(listed.length === 0
          ? [caption(h, t.inspectorFf.shipAFeatureFirstAFlag)]
          : listed.map((feature) =>
              h.div
                .key(feature)
                .class(
                  css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.5',
                    paddingBottom: '1',
                  }),
                )
                .children(
                  caption(h, t.catalog.features[feature].name),
                  segmented(
                    h,
                    css({ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }),
                    ROLLOUT_STEPS.map((share) =>
                      choice(
                        h,
                        `${feature}-${share}`,
                        Math.abs(rolloutOf(game, feature) - share) < 1e-9,
                        true,
                        Message.RolloutChosen({ nodeId: node.id, feature, share }),
                        [
                          h.span
                            .class(
                              css({
                                width: '100%',
                                textAlign: 'center',
                              }),
                            )
                            .children(
                              share <= 0 ? t.inspectorFf.off : `${Math.round(share * 100)}%`,
                            ),
                        ],
                        share <= 0
                          ? t.inspectorFf.offNoUserHasTheFeature
                          : t.inspectorFf.aBadDeployOfItReaches(Math.round(share * 100)),
                      ),
                    ),
                  ),
                ),
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
            t.inspectorFf.aBadDeployFails(
              percentNumber(BAD_DEPLOY_ERRORS),
              serviceNameIn(t, service),
              batch.length,
              percentNumber(badDeployShareOf(game, service)),
            ),
          ),
      ],
      true,
    ),
    section(h, t.inspectorFf.flagsAreAShield, [
      h.p
        .class(
          css({
            fontSize: 'type.12',
            lineHeight: 'snug',
            color: 'mutedForeground',
          }),
        )
        .children(t.inspectorFf.aFeatureAt5OfUsers),
      caption(h, t.inspectorFf.notBuiltTheHoldoutGroupThat),
    ]),
  ]
}

export const ffPanel: Panel = {
  stats: ({ game, node, h }) => {
    const t = copy(h)

    const service = blastService(game)
    const batch = service.lastDeploy
    const rolled = batch.filter((feature) => rolloutOf(game, feature) < 1)
    const blast = badDeployShareOf(game, service)
    return [
      row(h, t.inspectorFf.service, serviceNameIn(t, service), 'plain'),
      row(h, t.inspectorFf.inTheBatch, `${batch.length}`, 'plain'),
      row(h, t.inspectorFf.behindAFlag, `${rolled.length}`, rolled.length > 0 ? 'ok' : 'plain'),
      row(
        h,
        t.inspectorFf.badDeploy,
        t.inspectorFf.upToOfItsTraffic(percentNumber(blast)),
        blast >= 0.4 ? 'warn' : blast <= 0.1 ? 'ok' : 'plain',
      ),
      row(h, t.inspectorFf.burn, t.inspectorFf.s(money(burnOf(game, node))), 'plain'),
    ]
  },
  body: ({ game, node, h }) => [...flags(game, node, h)],
}
