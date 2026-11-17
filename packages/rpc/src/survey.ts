import { Schema } from 'effect'
import { Rpc, RpcGroup } from 'effect/rpc'
import { ApiError } from './errors.ts'

export const SurveyExit = Schema.Struct({
  exit: Schema.String,
  stage: Schema.Finite,
  time: Schema.Finite,
  peak: Schema.Finite,
  payout: Schema.Finite,
  legacy: Schema.Finite,
  venture: Schema.String,
  mutators: Schema.Array(Schema.String),
  perks: Schema.Record(Schema.String, Schema.Finite),
})
export type SurveyExit = typeof SurveyExit.Type

export const SurveySubmission = Schema.Struct({
  deviceId: Schema.String,
  locale: Schema.String,
  exit: SurveyExit,
  issues: Schema.String,
  likes: Schema.String,
})
export type SurveySubmission = typeof SurveySubmission.Type

export const SurveyReceipt = Schema.Struct({
  received: Schema.Boolean,
})
export type SurveyReceipt = typeof SurveyReceipt.Type

export class SurveyRpc extends RpcGroup.make(
  Rpc.make('surveySubmit', {
    payload: SurveySubmission,
    success: SurveyReceipt,
    error: ApiError,
  }),
) {}
