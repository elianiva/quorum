import { Actions } from '../board-actions.ts'
import { Work } from '../board-actions.ts'
import { FEATURES, INCIDENTS, KINDS, POLICIES, RESEARCH, TASKS } from '@quorum/simulation/catalog'
import { Message } from '../message.ts'
import { Option } from 'effect'
import { closed } from '../inbox.ts'
import { ResearchMessage, ResearchOutMessage, updateResearch } from '../research.ts'
import { TeamOutMessage, updateTeam, type TeamMessage } from '../team.ts'
import { foldChild } from '../step.ts'
import { copyIn, insightName } from '../../i18n/messages.ts'
import { isOne } from '../../i18n/plural.ts'
import { ledgerOf, Model } from '../model.ts'
import { recipeOf } from '@quorum/ui/game/pools'
import { sharePercent } from '@quorum/ui/game/format'
import { say, act, percent, type MessageCases, type UpdateResult } from './shared.ts'
import { learnTargetOf, serviceOf } from '@quorum/simulation/team'
import { stallReasonIn } from '../../i18n/format.ts'
import { stepsOf, stepOf } from '@quorum/simulation/migration'
import { studyStall } from '@quorum/simulation/studies'
import { currentStudy, studyList } from '@quorum/simulation/study-machine'

export const teamAction = (model: Model, out: TeamOutMessage): UpdateResult => {
  const game = model.board.game
  return TeamOutMessage.match(out, {
    Hire: ({ language }) =>
      act(model, 'Hired', Work.hire(game, language), {
        note: () => [say(model).toasts.offerAccepted, 'ok'],
      }),
    Layoff: ({ engineerId }) =>
      act(model, 'Laid off', Work.layoff(game, engineerId), {
        note: () => [say(model).toasts.laidOff, 'warn'],
      }),
    Train: ({ engineerId }) =>
      act(model, 'Training', Work.train(game, engineerId, learnTargetOf(game)), {
        note: () => [say(model).toasts.training, 'primary'],
      }),
    Offsite: ({ teamId }) => {
      const result = act(model, 'Took the team offsite', Work.teamOffsite(game, teamId))
      if (result.model.board.game === game) return result
      const inbox = game.engineers
        .filter((engineer) => engineer.team === teamId)
        .reduce(
          (current, engineer) =>
            closed(
              current,
              `event:unhappy:${engineer.id}`,
              game.time,
              'The offsite helped. They are content again.',
            ),
          result.model.board.inbox,
        )
      return { ...result, model: { ...result.model, board: { ...result.model.board, inbox } } }
    },
    CreateTeam: () => act(model, 'New team', Work.createTeam(game)),
    RemoveTeam: ({ teamId }) => act(model, 'Removed a team', Work.removeTeam(game, teamId)),
    Assign: ({ engineerId, teamId }) =>
      act(model, 'Moved an engineer', Work.assign(game, engineerId, teamId)),
    SetPolicy: ({ teamId, policy }) =>
      act(model, `${POLICIES[policy].label} policy`, Work.setTeamPolicy(game, teamId, policy)),
    SetKind: ({ teamId, kind }) =>
      act(
        model,
        kind === 'platform'
          ? 'Platform team'
          : kind === 'sre'
            ? 'SRE team'
            : kind === 'data'
              ? 'Data team'
              : kind === 'security'
                ? 'Security team'
                : 'Product team',
        Work.setTeamKind(game, teamId, kind),
      ),
    SetResearchTeam: ({ teamId }) =>
      act(
        model,
        teamId === null ? 'Stopped research boost' : 'Boosted research',
        Work.setResearchTeam(game, teamId),
      ),
    QueueFeature: ({ id, service }) =>
      act(model, `Queued ${FEATURES[id].name}`, Work.queueFeature(game, id, service ?? undefined)),
    RemoveFeature: ({ id }) =>
      act(model, `Removed ${FEATURES[id].name}`, Work.removeFeature(game, id), {
        note: () => [say(model).toasts.featureGone(say(model).catalog.features[id].name), 'warn'],
      }),
    MoveService: ({ serviceId, teamId }) =>
      act(
        model,
        `Moved a Service to ${game.teams.find((team) => team.id === teamId)?.name ?? 'a team'}`,
        Work.moveService(game, serviceId, teamId),
      ),
    DatastoreService: ({ serviceId, datastore }) =>
      act(
        model,
        datastore === null ? 'Datastore: first Database' : 'Datastore set',
        Work.setDatastore(game, serviceId, datastore),
      ),
    SplitService: ({ name, kinds, service, node }) => {
      const request = {
        kinds,
        name,
        ...(service === null ? {} : { service }),
        ...(node === null ? {} : { node }),
      }
      const moving = new Set(kinds.flatMap((kind) => Work.capabilityFeatures(game, kind))).size
      const labels = kinds.map((kind) => KINDS[kind].label).join(', ')
      return act(model, `Carved out ${labels}`, Work.splitService(game, request), {
        note: () => [
          say(model).toasts.featuresMoved(moving, isOne(model.prefs.locale, moving)),
          'primary',
        ],
        patch: (parent) => ({
          team: {
            ...parent.board.team,
            service: {
              ...parent.board.team.service,
              name: '',
              kinds: [],
              target: '',
            },
          },
        }),
      })
    },
    Rename: ({ target, id, name }) =>
      act(
        model,
        target === 'team' ? `Renamed a team to ${name}` : `Renamed a Service to ${name}`,
        target === 'team' ? Work.renameTeam(game, id, name) : Work.renameService(game, id, name),
      ),
  })
}

const foldTeam = (model: Model, message: TeamMessage): UpdateResult =>
  foldChild({
    update: updateTeam,
    read: (parent: Model) => Option.some(parent.board.team),
    write: (parent, team) => ({ ...parent, board: { ...parent.board, team } }),
    toParentMessage: (child) => Message.TeamChanged({ message: child }),
    foldOutMessage: (out: TeamOutMessage) => (parent: Model) => teamAction(parent, out),
  })(model, message)

const foldResearch = (model: Model, message: ResearchMessage): UpdateResult =>
  foldChild({
    update: updateResearch,
    read: (parent: Model) => Option.some(parent.board.research),
    write: (parent, research) => ({ ...parent, board: { ...parent.board, research } }),
    toParentMessage: (child) => Message.ResearchChanged({ message: child }),
    foldOutMessage: (out: ResearchOutMessage) => (parent: Model) =>
      ResearchOutMessage.match(out, {
        Study: ({ id }) =>
          act(parent, `Study ${RESEARCH[id].name}`, Actions.study(parent.board.game, id), {
            note: (game) => {
              const t = say(parent)
              const name = t.catalog.research[id].name
              const ledger = ledgerOf(parent)
              const added = studyList(game.studies)
                .filter(
                  (item) => !studyList(parent.board.game.studies).some((was) => was.id === item.id),
                )
                .map((item) => item.id)
              if (added.length > 1) {
                const names = added.map((study) => t.catalog.research[study].name)
                const first = added
                  .map((study) => ({ study, stall: studyStall(game, ledger, study) }))
                  .find((item) => item.stall !== null)
                return first?.stall
                  ? [
                      t.toasts.studiesQueuedStalled(
                        names,
                        t.catalog.research[first.study].name,
                        stallReasonIn(t, first.stall),
                      ),
                      'warn',
                    ]
                  : [t.toasts.studiesQueued(names), 'primary']
              }
              const stall = studyStall(game, ledger, id)
              if (stall) return [t.toasts.studyQueuedStalled(name, stallReasonIn(t, stall)), 'warn']
              const short = recipeOf(id, game.discounts)
                .filter(([pool, cost]) => game.pools[pool] < cost)
                .map(([pool]) => insightName(t, pool))
              return short.length > 0
                ? [t.toasts.studyQueuedShort(name, short.join(', ')), 'warn']
                : [t.toasts.studyQueued(name), 'primary']
            },
          }),
        MovedTo: ({ id, index }) =>
          act(parent, 'Reordered research', Actions.moveStudyTo(parent.board.game, id, index)),
        Move: ({ id, direction }) =>
          act(parent, 'Reordered research', Actions.moveStudy(parent.board.game, id, direction)),
        StudyNow: ({ id }) =>
          act(
            parent,
            `Study ${RESEARCH[id].name} now`,
            Actions.study(parent.board.game, id, true),
            {
              note: (game) => {
                const t = say(parent)
                const running = currentStudy(game.studies)?.id
                return [
                  running && running !== id
                    ? t.toasts.studyingNowThen(
                        t.catalog.research[running].name,
                        t.catalog.research[id].name,
                      )
                    : t.toasts.studyingNow(t.catalog.research[id].name),
                  'primary',
                ]
              },
            },
          ),
        Cancel: ({ id }) =>
          act(
            parent,
            `Cancelled ${RESEARCH[id].name}`,
            Actions.cancelStudy(parent.board.game, id),
            {
              note: (game) => {
                const t = say(parent)
                const name = t.catalog.research[id].name
                const gone = studyList(parent.board.game.studies)
                  .filter(
                    (item) =>
                      item.id !== id &&
                      !studyList(game.studies).some((left) => left.id === item.id),
                  )
                  .map((item) => t.catalog.research[item.id].name)
                return [
                  gone.length > 0
                    ? t.toasts.studyCancelledWith(name, gone)
                    : t.toasts.studyCancelled(name),
                  'plain',
                ]
              },
            },
          ),
        LeverUp: ({ kind }) =>
          act(
            parent,
            `Built the ${KINDS[kind].label} lever`,
            Work.queueLever(parent.board.game, kind),
            {
              undoable: true,
              note: () => [
                say(parent).levers.queued(say(parent).catalog.pools[kind].label),
                'primary',
              ],
            },
          ),
        LeverDown: ({ kind }) =>
          act(
            parent,
            `Removed the ${KINDS[kind].label} lever`,
            Work.removeLever(parent.board.game, kind),
            {
              undoable: true,
              note: () => [
                say(parent).levers.removed(say(parent).catalog.pools[kind].label),
                'plain',
              ],
            },
          ),
      }),
  })(model, message)

type TeamTag =
  | 'ResearchChanged'
  | 'TeamChanged'
  | 'TaskQueued'
  | 'AuthMoveQueued'
  | 'RunbookQueued'
  | 'PolicyToggled'
  | 'WorkMoved'
  | 'WorkCancelled'
  | 'WorkResumed'
  | 'WorkApproved'
  | 'WorkDeferred'
  | 'WorkPatched'
  | 'WorkPatchQueued'
  | 'EngineerGivenTimeOff'
  | 'EngineerGivenRaise'
  | 'EngineerResigned'
  | 'WorkPrioritized'
  | 'WorkRushed'
  | 'AutopilotToggled'
  | 'MigrationShifted'
  | 'MigrationCancelled'
  | 'RolledBack'

export const teamHandlers = (model: Model): MessageCases<UpdateResult, TeamTag> => ({
  ResearchChanged: ({ message }) => foldResearch(model, message),

  TeamChanged: ({ message }) => foldTeam(model, message),

  TaskQueued: ({ id }) =>
    act(model, `Queued ${TASKS[id].name}`, Work.queueTask(model.board.game, id)),

  AuthMoveQueued: () =>
    act(model, 'Queued moving auth in-house', Work.queueAuthMove(model.board.game)),

  RunbookQueued: ({ kind }) =>
    act(
      model,
      `Queued a runbook for ${INCIDENTS[kind].name}`,
      Work.queueRunbook(model.board.game, kind),
    ),

  PolicyToggled: ({ policy, on }) =>
    act(
      model,
      (on ? copyIn('en').changes.policySet : copyIn('en').changes.policyCleared)(
        copyIn('en').changes.policies[policy],
      ),
      Actions.setPolicyOn(model.board.game, policy, on),
    ),

  WorkMoved: ({ id, direction }) =>
    act(model, 'Reordered the backlog', Work.moveItem(model.board.game, id, direction)),

  WorkCancelled: ({ id }) => act(model, 'Cancelled work', Work.cancelItem(model.board.game, id)),

  WorkResumed: ({ id }) => act(model, 'Resumed work', Work.resumeItem(model.board.game, id)),

  WorkApproved: ({ id }) =>
    act(model, 'Unblocked the work', Work.approveBlock(model.board.game, id)),

  WorkDeferred: ({ id }) => act(model, 'Put the block off', Work.laterBlock(model.board.game, id)),

  WorkPatched: ({ id }) => act(model, 'Patched now', Work.patchNow(model.board.game, id)),

  WorkPatchQueued: ({ id }) =>
    act(model, 'Queued the patch', Work.queuePatch(model.board.game, id)),

  EngineerGivenTimeOff: ({ engineerId }) =>
    act(model, 'Gave time off', Work.giveTimeOff(model.board.game, engineerId)),

  EngineerGivenRaise: ({ engineerId }) =>
    act(model, 'Raised the salary', Work.raiseSalary(model.board.game, engineerId)),

  EngineerResigned: ({ engineerId }) =>
    act(model, 'Accepted the resignation', Work.acceptResignation(model.board.game, engineerId)),

  WorkPrioritized: ({ id }) =>
    act(model, 'Moved work to the top', Work.prioritizeItem(model.board.game, id)),

  WorkRushed: ({ id }) => {
    const game = model.board.game
    const item = game.backlog.find((entry) => entry.id === id)
    const debt = item ? Work.rushDebtOf(item, game.devHours) : 0
    const risk = item ? Work.rushBugOf(game, item, game.devHours) : 0
    return act(model, 'Rushed work', Work.rushItem(game, id), {
      note: () => [
        risk > 0
          ? say(model).toasts.rushedDebtBug(sharePercent(debt), sharePercent(risk))
          : say(model).toasts.rushedDebt(sharePercent(debt)),
        'warn',
      ],
    })
  },

  AutopilotToggled: () => {
    const game = Work.setAutopilot(model.board.game, !model.board.game.autopilot)
    return { model: { ...model, board: { ...model.board, game } } }
  },

  MigrationShifted: () =>
    act(model, 'Shifted traffic', Work.shiftMigration(model.board.game), {
      note: (game) => {
        const migration = serviceOf(game).migration
        return migration._tag === 'Idle'
          ? [say(model).toasts.migrationDone, 'ok']
          : [
              say(model).toasts.migrationMoved(
                percent(stepsOf(migration)[stepOf(migration) - 1] ?? 0),
              ),
              'ok',
            ]
      },
    }),

  MigrationCancelled: () =>
    act(model, 'Cancelled the migration', Work.cancelMigration(model.board.game), {
      note: () => [say(model).toasts.migrationCancelled, 'plain'],
    }),

  RolledBack: () =>
    act(model, 'Rolled back', Work.rollback(model.board.game), {
      note: () => [say(model).toasts.rolledBack, 'ok'],
    }),
})
