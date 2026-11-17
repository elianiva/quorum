import { Context, Data, type Effect } from 'effect'

export type SurveyResponse = Readonly<{
  deviceId: string
  exitKey: string
  exitId: string
  stage: number
  time: number
  peak: number
  payout: number
  legacy: number
  venture: string
  mutators: ReadonlyArray<string>
  issues: string
  likes: string
  locale: string
  at: number
}>

export class SurveyStoreError extends Data.TaggedError('SurveyStoreError')<{
  readonly cause: unknown
}> {}

export class SurveyStore extends Context.Service<
  SurveyStore,
  {
    readonly record: (response: SurveyResponse) => Effect.Effect<void, SurveyStoreError>
  }
>()('quorum/backend/SurveyStore') {}
