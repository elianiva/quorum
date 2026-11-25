import { type Action, notAllowed, ok, withNode } from '../action-kit.ts'
import type { FeatureId, Game } from '../state.ts'
import { ROLLOUT_STEPS } from '../catalog.ts'
import { isLive, step } from '../feature-machine.ts'

export const setRollout = (game: Game, id: string, feature: FeatureId, share: number): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'ff') return notAllowed('Only Feature Flags roll a Feature out.')
    const phase = game.features[feature]
    if (phase === undefined || !isLive(phase))
      return notAllowed('Ship the Feature before it has a rollout.')
    if (!(ROLLOUT_STEPS as ReadonlyArray<number>).includes(share))
      return notAllowed('A rollout is off, 5%, 25%, 50%, or every user.')
    return ok({
      ...game,
      features: { ...game.features, [feature]: step(phase, { _tag: 'RolloutChanged', share }) },
    })
  })
