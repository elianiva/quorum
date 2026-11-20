import { AppRoute } from '../route.ts'
import { record } from '../history.ts'
import {
  currentFile,
  hasCompany,
  ledgerOf,
  onlineFileOf,
  roomCode,
  roomOwner,
  type Model,
  type Room,
} from '../model.ts'
import { RoomPhase, roomStep } from '../room-machine.ts'
import { afterRound } from './session.ts'
import { withFile } from '../saves.ts'
import { savesOf, withSaves } from '../saves-machine.ts'
import { CopyText, WriteCompany, PublishRoom, SendRoom } from '../commands.ts'
import { ROOM_NAME_LENGTH } from '../names.ts'
import { setRoomName } from '../../platform/room-socket.ts'
import { refusalIn } from '../../i18n/refusal.ts'
import { ROOM_MAX_SAMPLES, ServerMessage } from '@quorum/simulation/room'
import type { ClientMessage, Vote } from '@quorum/simulation/room'
import { RoomVote } from '@quorum/simulation/vote-machine'
import type { Sample } from '@quorum/simulation/state'
import type { RoomEnd } from '../room-machine.ts'
import {
  milestones,
  say,
  savePayloadOf,
  withToast,
  type MessageCases,
  type UpdateResult,
} from './shared.ts'

type RoomTag =
  | 'RoomReceived'
  | 'RoomStatusChanged'
  | 'RoomPublishAsked'
  | 'RoomPublished'
  | 'RoomPublishFailed'
  | 'RoomTakeOfflineAsked'
  | 'RoomLeaveAsked'
  | 'RoomVoteAsked'
  | 'RoomBallot'
  | 'RoomSpeedChosen'
  | 'RoomKickAsked'
  | 'RoomSent'
  | 'RoomChecked'
  | 'RoomNameChanged'
  | 'RoomNameSaved'
  | 'RoomLinkCopied'

const noVote: RoomVote = RoomVote.cases.Idle.make({})

const roomVoteOf = (vote: Vote | null): RoomVote =>
  vote === null ? noVote : RoomVote.cases.Open.make({ vote })

const emptyRoom = (model: Model, phase: Room['phase']): Room => ({
  ...model.room,
  phase,
  seats: [],
  speed: 1,
  vote: noVote,
  seq: 1,
})

const panelAfter = (panel: Model['panel'], game: Model['board']['game']): Model['panel'] =>
  panel === 'offer' && game.round._tag !== 'Offered' ? afterRound(game) : panel

const painted = (
  model: Model,
  frame: Readonly<{
    game: Model['board']['game']
    seats: Room['seats']
    speed: number
    vote: Vote | null
    samples: ReadonlyArray<Sample>
    time: number
  }>,
  whole: boolean,
): Model => {
  const history = record(model.board.dashboard.history, frame.samples, frame.time)
  const samples = (whole ? frame.samples : [...model.board.game.history, ...frame.samples]).slice(
    -ROOM_MAX_SAMPLES,
  )
  return {
    ...model,
    panel: panelAfter(model.panel, frame.game),
    board: {
      ...model.board,
      game: { ...frame.game, history: [...samples] },
      clock: { ...model.board.clock, speed: frame.speed, mode: { _tag: 'Running' } },
      whatIfsAt: -1,
      dashboard: { ...model.board.dashboard, history },
    },
    room: {
      ...model.room,
      seats: frame.seats,
      speed: frame.speed,
      vote: roomVoteOf(frame.vote),
    },
  }
}

const send = (model: Model, message: ClientMessage): UpdateResult => ({
  model,
  commands: [SendRoom({ message })],
})

const received = (model: Model, message: ServerMessage): UpdateResult =>
  ServerMessage.match(message, {
    Welcome: (frame) => {
      const first = RoomPhase.guards.Connecting(model.room.phase)
      const shown = painted(
        model,
        {
          game: frame.game,
          seats: frame.seats,
          speed: frame.speed,
          vote: frame.vote,
          samples: frame.samples,
          time: frame.game.time,
        },
        true,
      )
      const next: Model = {
        ...shown,
        panel: first ? 'none' : shown.panel,
        room: {
          ...model.room,
          phase: roomStep(model.room.phase, {
            _tag: 'Joined',
            seat: frame.seat,
            owner: frame.seat === frame.owner,
          }),
          seats: frame.seats,
          speed: frame.speed,
          vote: roomVoteOf(frame.vote),
        },
      }
      return roomOwner(next)
        ? milestones(model, { model: next }, [], ledgerOf(next))
        : { model: next, commands: [] }
    },
    Snapshot: (frame) => {
      const next = painted(
        model,
        {
          game: frame.game,
          seats: frame.seats,
          speed: frame.speed,
          vote: frame.vote,
          samples: frame.samples,
          time: frame.time,
        },
        false,
      )
      return roomOwner(next)
        ? milestones(model, { model: next }, [], ledgerOf(next))
        : { model: next }
    },
    Seats: (frame) => ({
      model: {
        ...model,
        room: {
          ...model.room,
          seats: frame.seats,
          speed: frame.speed,
          vote: roomVoteOf(frame.vote),
        },
      },
    }),
    Joined: (frame) => withToast(model, say(model).room.joined(frame.seat.name), 'plain'),
    Refused: (frame) => withToast(model, refusalIn(say(model), frame.refusal), 'warn'),
    Cursor: () => ({ model }),
    CursorGone: () => ({ model }),
    Final: (frame) => handover(model, frame.game),
    Ended: (frame) => {
      const next = roomStep(model.room.phase, { _tag: 'Ended', reason: frame.reason })
      const route = AppRoute.guards.Room(model.route) ? AppRoute.Title() : model.route
      return withToast(
        { ...model, route, room: { ...model.room, phase: next, seats: [] }, panel: 'none' },
        say(model).room[reasonKeyOf(frame.reason)],
        'plain',
      )
    },
  })

const REASON_KEY: Record<
  RoomEnd,
  'endOffline' | 'endHandover' | 'endExpired' | 'endStale' | 'endRemoved'
> = {
  offline: 'endOffline',
  handover: 'endHandover',
  expired: 'endExpired',
  stale: 'endStale',
  removed: 'endRemoved',
}

const reasonKeyOf = (reason: RoomEnd) => REASON_KEY[reason]

const handover = (model: Model, game: Model['board']['game']): UpdateResult => {
  const code = roomCode(model)
  const file = code === null ? null : onlineFileOf(model, code)
  const board = { ...model.board, game }
  const online =
    file === null
      ? model.saves
      : withSaves(model.saves, withFile(savesOf(model.saves), { ...file, online: null }))
  const next: Model = {
    ...model,
    board,
    saves: online,
    room: { ...model.room, phase: roomStep(model.room.phase, { _tag: 'Left' }) },
    route: AppRoute.Company(),
    panel: 'none',
  }
  const commands =
    file === null
      ? []
      : [
          WriteCompany({
            id: file.id,
            index: withFile(savesOf(next.saves), { ...file, online: null }),
            ...savePayloadOf(next, board),
          }),
        ]
  return { model: next, commands }
}

const published = (model: Model, code: string, token: string): UpdateResult => {
  const file = currentFile(model)
  if (file === null) return withToast(model, say(model).room.notAvailable, 'warn')
  const saves = withSaves(
    model.saves,
    withFile(savesOf(model.saves), {
      ...file,
      online: { code, token, at: Date.now() },
    }),
  )
  const next: Model = {
    ...model,
    saves,
    route: AppRoute.Room({ room: code }),
    panel: 'room',
    room: emptyRoom(model, roomStep(model.room.phase, { _tag: 'Connecting', code })),
  }
  return {
    model: next,
    commands: [
      WriteCompany({ id: file.id, index: savesOf(saves), ...savePayloadOf(next, next.board) }),
    ],
  }
}

export const roomHandlers = (model: Model): MessageCases<UpdateResult, RoomTag> => ({
  RoomReceived: ({ message }) => received(model, message),
  RoomStatusChanged: ({ status }) => {
    if (status === 'open') return { model }
    const phase = model.room.phase
    if (status === 'full') {
      if (!RoomPhase.guards.Connecting(phase) && !RoomPhase.guards.Online(phase)) return { model }
      return {
        model: {
          ...model,
          room: {
            ...model.room,
            phase: roomStep(phase, { _tag: 'Failed', reason: 'full' }),
          },
        },
      }
    }
    if (RoomPhase.guards.Connecting(phase))
      return {
        model: {
          ...model,
          room: {
            ...model.room,
            phase: roomStep(phase, { _tag: 'Failed', reason: 'unreachable' }),
          },
        },
      }
    if (!RoomPhase.guards.Online(phase)) return { model }
    return {
      model: {
        ...model,
        room: { ...model.room, phase: roomStep(phase, { _tag: 'Dropped' }) },
      },
    }
  },
  RoomChecked: ({ code, exists }) => {
    if (exists || roomCode(model) !== code) return { model }
    const next = roomStep(model.room.phase, { _tag: 'Ended', reason: 'removed' })
    return withToast(
      {
        ...model,
        route: AppRoute.Title(),
        room: { ...model.room, phase: next, seats: [] },
        panel: 'none',
      },
      say(model).room.missing,
      'plain',
    )
  },
  RoomNameChanged: ({ name }) => ({
    model: {
      ...model,
      room: { ...model.room, draft: name.slice(0, ROOM_NAME_LENGTH) },
    },
  }),
  RoomNameSaved: () => {
    const name = model.room.draft.trim().slice(0, ROOM_NAME_LENGTH)
    if (name === '') return { model: { ...model, room: { ...model.room, draft: model.room.name } } }
    if (name === model.room.name) return { model }
    setRoomName(name)
    return { model: { ...model, room: { ...model.room, name, draft: name } } }
  },
  RoomLinkCopied: () => {
    const code = roomCode(model)
    if (code === null) return { model }
    return {
      model,
      commands: [
        CopyText({
          text: `${window.location.origin}/room/${code}`,
          done: say(model).room.linkCopied,
          blocked: say(model).toasts.clipboardBlocked,
        }),
      ],
    }
  },
  RoomPublishAsked: () => {
    const file = currentFile(model)
    if (file === null) return withToast(model, say(model).room.notAvailable, 'warn')
    if (file.online !== null)
      return {
        model: {
          ...model,
          route: AppRoute.Room({ room: file.online.code }),
          panel: 'room',
          room: emptyRoom(
            model,
            roomStep(model.room.phase, { _tag: 'Connecting', code: file.online.code }),
          ),
        },
      }
    return {
      model,
      commands: [
        PublishRoom({
          name: file.name,
          game: { ...model.board.game, history: [] },
          samples: model.board.game.history,
          wall: Date.now(),
        }),
      ],
    }
  },
  RoomPublished: ({ code, token }) => published(model, code, token),
  RoomPublishFailed: ({ message }) => withToast(model, message, 'warn'),
  RoomTakeOfflineAsked: () =>
    RoomPhase.guards.Online(model.room.phase) && model.room.phase.owner
      ? send(model, { _tag: 'TakeOffline' })
      : withToast(model, say(model).room.notAvailable, 'warn'),
  RoomLeaveAsked: () => {
    const next: Model = {
      ...model,
      room: { ...model.room, phase: roomStep(model.room.phase, { _tag: 'Left' }) },
      route: hasCompany(model) ? AppRoute.Company() : AppRoute.Title(),
      panel: 'none',
    }
    return withToast(next, say(model).room.left, 'plain')
  },
  RoomVoteAsked: ({ kind }) => send(model, { _tag: 'StartVote', kind }),
  RoomBallot: ({ vote, yes }) => send(model, { _tag: 'Ballot', vote, yes }),
  RoomSpeedChosen: ({ value }) => {
    const speed = value === 0.5 || value === 3 || value === 10 ? value : 1
    return RoomPhase.guards.Online(model.room.phase) && model.room.phase.owner
      ? send(model, { _tag: 'Speed', value: speed })
      : withToast(model, say(model).room.notAvailable, 'warn')
  },
  RoomKickAsked: ({ seat }) => send(model, { _tag: 'Kick', seat }),
  RoomSent: () => ({ model }),
})
