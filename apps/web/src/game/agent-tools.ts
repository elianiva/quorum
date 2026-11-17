import type { AgentMail, AgentSnapshot } from '@quorum/agent/snapshot'
import { refusal as refusalOf, stateJson as snapshotJson } from '@quorum/agent/view'
import { boardChallenge, boardSandbox, clockPaused, type Model } from './model.ts'

const agentMail = (mail: Model['board']['inbox']['mail'][number]): AgentMail => ({
  id: mail.id,
  sender: mail.sender,
  subject: mail.subject,
  time: mail.time,
  read: mail.read,
  trashed: mail.trashed,
  spam: mail.spam,
  phase:
    mail.phase._tag === 'Answered'
      ? { _tag: 'Answered', answer: mail.phase.answer }
      : { _tag: mail.phase._tag },
  actions: mail.actions.map((action) => action.label),
  entries: mail.entries,
})

export const snapshotOfModel = (model: Model): AgentSnapshot => {
  const challenge = boardChallenge(model.board) !== null
  const sandbox = boardSandbox(model.board) !== null
  return {
    game: challenge ? null : model.board.game,
    mode: challenge ? 'challenge' : sandbox ? 'sandbox' : 'company',
    screen: {
      route: model.route._tag,
      panel: model.panel,
      region: model.board.region,
      selectedNode: model.board.selected,
    },
    paused: clockPaused(model),
    speed: model.board.clock.speed,
    bottleneck: null,
    whatIfs: model.board.whatIfs,
    samples: challenge ? [] : model.board.game.history,
    nodeSamples: challenge ? {} : model.board.nodeHistory,
    inbox: challenge ? [] : model.board.inbox.mail.map(agentMail),
    updatedAt: Date.now(),
  }
}

export const refusal = (model: Model): string | null => refusalOf(snapshotOfModel(model))

export const stateJson = (model: Model): string => snapshotJson(snapshotOfModel(model))
