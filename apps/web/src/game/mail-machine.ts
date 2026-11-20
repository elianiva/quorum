import { Schema } from 'effect'

export const MailPhase = Schema.TaggedUnion({
  Active: {},
  Answered: {
    answer: Schema.String,
    answerId: Schema.String,
  },
  Resolved: { at: Schema.Finite },
})
export type MailPhase = typeof MailPhase.Type
