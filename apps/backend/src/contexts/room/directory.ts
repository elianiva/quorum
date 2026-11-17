import { Context, Data, type Effect } from 'effect'
import type { Game, Sample } from '@quorum/simulation/state'

/** What a browser uploads when a Company goes online. */
export type PublishRequest = Readonly<{
  name: string
  game: Game
  samples: ReadonlyArray<Sample>
  wall: number
  simVersion: string
}>

export type Published = Readonly<{ code: string; token: string }>

export type PublishInput = PublishRequest & Readonly<{ token: string }>

/** `idle` is true once the last Seat left: the Company waits in storage and holds no slot. */
export type Info = Readonly<{ exists: boolean; seats: number; idle: boolean }>

/** The Durable Object methods the directory calls, as the native stub exposes them. */
export type RoomStub = Readonly<{
  info: () => Promise<Info>
  publish: (input: PublishInput) => Promise<void>
  fetch: (request: Request) => Promise<Response>
}>

/** Every one of the deployment's Rooms is in use, so no new Company can go online. */
export class RoomFull extends Data.TaggedError('RoomFull')<{ readonly max: number }> {}

export class RoomError extends Data.TaggedError('RoomError')<{ readonly cause: unknown }> {}

/** The Rooms a deployment runs. The platform adapter owns the Durable Object namespace. */
export class RoomDirectory extends Context.Service<
  RoomDirectory,
  {
    readonly publish: (request: PublishRequest) => Effect.Effect<Published, RoomError | RoomFull>
    readonly info: (code: string) => Effect.Effect<Info, RoomError>
  }
>()('quorum/backend/RoomDirectory') {}
