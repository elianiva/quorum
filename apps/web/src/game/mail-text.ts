import { Schema } from 'effect'

export const MailVars = Schema.Record(
  Schema.String,
  Schema.NullOr(Schema.Union([Schema.String, Schema.Finite])),
)
export type MailVars = typeof MailVars.Type

export const LetterRef = Schema.Struct({
  id: Schema.String,
  variant: Schema.Finite,
  vars: MailVars,
})
export type LetterRef = typeof LetterRef.Type

export const Snippet = Schema.Struct({ id: Schema.String, vars: MailVars })
export type Snippet = typeof Snippet.Type

export const MailMessage = Schema.Struct({
  letter: LetterRef,
  before: Schema.Array(Snippet),
  after: Schema.Array(Snippet),
})
export type MailMessage = typeof MailMessage.Type
