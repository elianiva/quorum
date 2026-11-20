import {
  BACKDOOR_FUSE,
  CVE_DEFS,
  CVE_EVERY,
  PATCH_GRACE,
  SECURITY_TEAM_GRACE,
  patchCost,
  patchWindow,
} from './catalog.ts'
import { startIncident } from './director.ts'
import { StepEvent } from './events.ts'
import type { Ledger } from './ledger.ts'
import { securityStaffed } from './lookups.ts'
import { nextRandom } from './random.ts'
import { activeIncident, type Game, type WorkItem } from './state.ts'
import { enqueue, memberOf, ownerOf, serviceOf } from './team.ts'

export const BREACH_CHURN_SHARE = 0.15

const RECENT_CVES = 4

export const overdueBy = (game: Game, item: WorkItem): number =>
  item.due === undefined ? 0 : Math.max(0, game.time - item.due)

export const advanceCves = (
  game: Game,
  ledger: Ledger,
  seconds: number,
  events: Array<StepEvent>,
): Game => {
  if (game.sandbox || game.stage < 1) return game
  let next = game

  const crossed = Math.floor(next.time / CVE_EVERY) > Math.floor((next.time - seconds) / CVE_EVERY)
  if (crossed) {
    const open = CVE_DEFS.flatMap((def) => {
      const target = def.affects.find((id) => next.nodes.some((node) => node.type === id))
      return target && !next.cves.includes(def.id) ? [{ def, target }] : []
    })
    const [roll] = nextRandom(
      (next.seed + Math.floor(next.time / CVE_EVERY) * 7_919) % 2_147_483_648,
    )
    const chosen = open[Math.floor(roll * open.length)]
    if (chosen) {
      const { def, target } = chosen
      const due = next.time + patchWindow(def.score)
      const service = serviceOf(next)
      next = enqueue(next, 'patch', def.id, patchCost(def.score), false, {
        due,
        target,
        service: service.id,
      })
      const item = next.backlog.at(-1) as WorkItem
      const owner = memberOf(next, ownerOf(next, service).id, item.id)
      if (owner) {
        next = {
          ...next,
          backlog: next.backlog.map((entry) =>
            entry.id === item.id ? { ...entry, owner: owner.id } : entry,
          ),
        }
        events.push(
          StepEvent.PatchProposed({
            item: next.backlog.find((entry) => entry.id === item.id) as WorkItem,
            engineerId: owner.id,
          }),
        )
      }
      next = { ...next, cves: [...next.cves, def.id].slice(-RECENT_CVES) }
      const filed = next.backlog.find((entry) => entry.id === item.id) as WorkItem
      events.push(StepEvent.CveDisclosed({ item: filed }))
    }
  }

  if (next.backdoorAt !== null) {
    const age = next.time - next.backdoorAt
    if (securityStaffed(next) && age >= BACKDOOR_FUSE / 2) next = { ...next, backdoorAt: null }
    else if (age >= BACKDOOR_FUSE && activeIncident(next) === null) {
      const used = startIncident(next, ledger, 'breach', 0)
      if (used) {
        next = {
          ...used.game,
          backdoorAt: null,
          users: Math.floor(used.game.users * (1 - BREACH_CHURN_SHARE)),
        }
        events.push(StepEvent.IncidentStarted({ incident: used.incident }))
      }
    }
  }

  const grace = PATCH_GRACE * (securityStaffed(next) ? SECURITY_TEAM_GRACE : 1)
  const expired = next.backlog.find(
    (item) => item.kind === 'patch' && overdueBy(next, item) >= grace,
  )
  if (expired && activeIncident(next) === null) {
    const started = startIncident(next, ledger, 'breach', 0)
    if (started) {
      next = {
        ...started.game,
        users: Math.floor(started.game.users * (1 - BREACH_CHURN_SHARE)),
        backlog: started.game.backlog.filter((item) => item.id !== expired.id),
      }
      events.push(StepEvent.IncidentStarted({ incident: started.incident }))
      events.push(StepEvent.CveExploited({ cve: expired.ref, target: expired.target ?? '' }))
    }
  }
  return next
}
