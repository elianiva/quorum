import {
  type Action,
  answered,
  notAllowed,
  ok,
  patch,
  spend,
  withNode,
  locked,
} from '../action-kit.ts'
import type { Backup, Game } from '../state.ts'
import { activeIncident } from '../state.ts'
import { RESTORE_DRILL_DH, RESTORE_FAILURE } from '../catalog.ts'
import { nextRandom } from '../random.ts'
import { has, replacePrice } from '../lookups.ts'

// The simple setters are generated from content/components/database.qm.
export {
  setMaterialized,
  setStorageIops,
  setShards,
  setShardKey,
  setDbRetention,
  setTopology,
} from '../generated/database.rule.ts'

export const setBackup = (game: Game, id: string, backup: Backup): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    const refused = locked(game, 'database.backup', backup)
    if (refused) return refused
    if (node.backup === backup) return ok(game)
    if (backup === 'none') return ok(patch(game, id, { backup, restore: 'ok' }))
    return ok(rollRestore(patch(game, id, { backup }), id))
  })

export const rollRestore = (game: Game, id: string): Game => {
  const [roll, seed] = nextRandom(game.seed)
  const failed = !has(game, 'restore-drills') && roll < RESTORE_FAILURE
  return { ...patch(game, id, { restore: failed ? 'failed' : 'ok' }), seed }
}

export const runRestoreDrill = (game: Game, id: string): Action =>
  withNode(game, id, (node) => {
    if (node.type !== 'database') return notAllowed('Only a Database keeps backups.')
    if (node.backup === 'none') return notAllowed('Take a backup before drilling a restore.')
    if (game.devHours < RESTORE_DRILL_DH)
      return notAllowed(`A restore drill needs ${RESTORE_DRILL_DH} Dev Hours.`)
    return ok({ ...rollRestore(game, id), devHours: game.devHours - RESTORE_DRILL_DH })
  })

export const expandVolume = (game: Game): Action => {
  const incident = activeIncident(game)
  const target = game.nodes.find((node) => node.id === incident?.nodeId)
  if (incident?.kind !== 'disk-full' || !target) return notAllowed('No disk is full.')
  return spend(game, replacePrice(game, target), 'A bigger volume', (paid) =>
    activeIncident(paid) ? { ...paid, incident: answered(paid, { remaining: 0 }) } : paid,
  )
}
