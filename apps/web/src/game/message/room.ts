import { Schema } from 'effect'
import { ServerMessage, VoteKind } from '@quorum/simulation/room'

export const roomCases = {
  RoomReceived: { message: ServerMessage },
  RoomStatusChanged: { status: Schema.Literals(['open', 'closed', 'error', 'full']) },
  RoomPublishAsked: {},
  RoomPublished: { code: Schema.String, token: Schema.String },
  RoomPublishFailed: { message: Schema.String },
  RoomTakeOfflineAsked: {},
  RoomLeaveAsked: {},
  RoomVoteAsked: { kind: VoteKind },
  RoomBallot: { vote: Schema.Finite, yes: Schema.Boolean },
  RoomSpeedChosen: { value: Schema.Finite },
  RoomKickAsked: { seat: Schema.String },
  RoomSent: {},
  RoomChecked: { code: Schema.String, exists: Schema.Boolean },
  RoomNameChanged: { name: Schema.String },
  RoomNameSaved: {},
  RoomLinkCopied: {},
}
