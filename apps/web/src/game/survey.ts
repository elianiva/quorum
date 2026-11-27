import { Schema } from 'effect'
import { UiSchema } from '@effect/ui'
import type { Survey } from './model.ts'
import type { UpdateReturn } from './step.ts'

export const SurveyMessage = UiSchema.TaggedEnum({
  IssuesChanged: { value: Schema.String },
  LikesChanged: { value: Schema.String },
})
export type SurveyMessage = typeof SurveyMessage.Type

export const updateSurvey = (
  survey: Survey,
  message: SurveyMessage,
): UpdateReturn<Survey, SurveyMessage> =>
  SurveyMessage.match(message, {
    IssuesChanged: ({ value }) => ({ model: { ...survey, issues: value } }),
    LikesChanged: ({ value }) => ({ model: { ...survey, likes: value } }),
  })
