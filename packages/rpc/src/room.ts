import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
import { ApiError } from './errors.ts'

export const RoomPublish = Schema.Struct({
  name: Schema.String,
  game: Schema.Unknown,
  samples: Schema.Array(Schema.Unknown),
  wall: Schema.Finite,
})
export type RoomPublish = typeof RoomPublish.Type

export const RoomOpened = Schema.Struct({
  code: Schema.String,
  token: Schema.String,
})
export type RoomOpened = typeof RoomOpened.Type

export const RoomQuery = Schema.Struct({
  code: Schema.String,
})
export type RoomQuery = typeof RoomQuery.Type

export const RoomInfo = Schema.Struct({
  exists: Schema.Boolean,
  seats: Schema.Finite,
})
export type RoomInfo = typeof RoomInfo.Type

export class RoomRpc extends RpcGroup.make(
  Rpc.make('roomPublish', {
    payload: RoomPublish,
    success: RoomOpened,
    error: ApiError,
  }),
  Rpc.make('roomInfo', {
    payload: RoomQuery,
    success: RoomInfo,
    error: ApiError,
  }),
) {}
