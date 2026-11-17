import { Context, Data, type Effect } from 'effect'
import type { Game, Sample } from '@quorum/simulation/state'

export type PublishRequest = Readonly<{
  name: string
  game: Game
  samples: ReadonlyArray<Sample>
  wall: number
  simVersion: string
}>

export type Published = Readonly<{ code: string; token: string }>

export type PublishInput = PublishRequest & Readonly<{ token: string }>

export type Info = Readonly<{ exists: boolean; seats: number; idle: boolean }>

export type RoomStub = Readonly<{
  info: () => Promise<Info>
  publish: (input: PublishInput) => Promise<void>
  fetch: (request: Request) => Promise<Response>
}>

export class RoomFull extends Data.TaggedError('RoomFull')<{ readonly max: number }> {}

export class RoomError extends Data.TaggedError('RoomError')<{ readonly cause: unknown }> {}

export class RoomDirectory extends Context.Service<
  RoomDirectory,
  {
    readonly publish: (request: PublishRequest) => Effect.Effect<Published, RoomError | RoomFull>
    readonly info: (code: string) => Effect.Effect<Info, RoomError>
  }
>()('quorum/backend/RoomDirectory') {}
