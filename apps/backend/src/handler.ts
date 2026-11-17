import * as Sentry from '@sentry/cloudflare'
import { SentryEffectLogger, SentryEffectTracer } from '@sentry/effect'
import { Cause, ErrorReporter, Schema } from 'effect'
import * as HttpRouter from 'effect/http/HttpRouter'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as Tracer from 'effect/Tracer'
import { RpcSerialization, RpcServer } from 'effect/rpc'
import { Api, ApiError, RPC_PATH } from '@quorum/rpc'
import { RoomDirectory } from './contexts/room/directory.ts'
import { RoomHandlers } from './contexts/room/handlers.ts'
import { SurveyHandlers } from './contexts/survey/handlers.ts'
import { SurveyStore } from './contexts/survey/store.ts'
import { SystemHandlers } from './contexts/system/handlers.ts'
import { d1SurveyStore } from './platform/d1-survey-store.ts'
import type { AgentRoomInstance } from './platform/agent-room.ts'
import type { RoomInstance } from './platform/room-object.ts'
import type { SqlRunner } from './platform/sql.ts'

export type Env = Readonly<{
  FEEDBACK: SqlRunner
  ROOMS: DurableObjectNamespace<RoomInstance>
  AGENT_ROOMS: DurableObjectNamespace<AgentRoomInstance>
  SENTRY_DSN?: string
  SENTRY_RELEASE?: string
}>

const declaredAnswer = (cause: Cause.Cause<unknown>): boolean =>
  cause.reasons.every(
    (reason) =>
      Cause.isInterruptReason(reason) ||
      (Cause.isFailReason(reason) && Schema.is(ApiError)(reason.error)),
  )

const SentryErrors = ErrorReporter.layer(
  [
    ErrorReporter.make(({ cause, error }) => {
      if (declaredAnswer(cause)) return
      Sentry.captureException(error)
    }),
  ],
  { mergeWithExisting: true },
)

const SentryLive = Layer.mergeAll(
  SentryErrors,
  Layer.succeed(Tracer.Tracer, SentryEffectTracer),
  Logger.layer([SentryEffectLogger], { mergeWithExisting: true }),
)

export type HandlerInput = Readonly<{
  feedback: SqlRunner
  directory: RoomDirectory['Service']
}>

export const handlerFor = (input: HandlerInput) =>
  HttpRouter.toWebHandler(
    RpcServer.layerHttp({
      group: Api,
      path: RPC_PATH,
      protocol: 'http',
    }).pipe(
      Layer.provide(Layer.mergeAll(SystemHandlers, SurveyHandlers, RoomHandlers)),
      Layer.provide(Layer.succeed(SurveyStore, d1SurveyStore(input.feedback))),
      Layer.provide(Layer.succeed(RoomDirectory, input.directory)),
      Layer.provideMerge(RpcSerialization.layerJson),
      Layer.provide(SentryLive),
    ),
  )
