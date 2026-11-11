import { Schema } from 'effect'

/**
 * The wire shape of one decision model call: a state, and typed `choice`
 * questions over options the caller lists. Clef answers every option's
 * probability in one pass, so nothing here is generated text.
 *
 * The game builds these on the client, because the options come from the Game.
 * The transport answers them with Workers AI: a Vite dev route in the local
 * prototype, and an API Worker route when the feature ships.
 */
export const IntentQuestion = Schema.Struct({
  type: Schema.Literal('choice'),
  instructions: Schema.String,
  /** Option id to what the option means. Clef allows 2 to 255. */
  criteria: Schema.Record(Schema.String, Schema.String),
})
export type IntentQuestion = typeof IntentQuestion.Type

export const IntentRequest = Schema.Struct({
  /** The situation to decide on: the Board, and what the player said. */
  state: Schema.String,
  questions: Schema.Record(Schema.String, IntentQuestion),
})
export type IntentRequest = typeof IntentRequest.Type

export const IntentChoice = Schema.Struct({
  choice: Schema.String,
  probabilities: Schema.Record(Schema.String, Schema.Finite),
  confidence: Schema.Finite,
})
export type IntentChoice = typeof IntentChoice.Type

/** One answer per question id. */
export const IntentAnswers = Schema.Record(Schema.String, IntentChoice)
export type IntentAnswers = typeof IntentAnswers.Type

/** Where the browser asks for a decision. Served by the dev server in a local prototype. */
export const INTENT_PATH = '/api/intent'
