import { IntentAnswers } from '@quorum/rpc'
import { Schema } from 'effect'

/* ==========================================================================
   Dictation. One utterance becomes clauses, and each clause becomes one Move.
   The bar is the line being said: words arrive in black, and each landed Move
   answers with a tick on the bar.
   ========================================================================== */

/** One clause still to run, and where it ends in the utterance. */
export const VoiceClause = Schema.Struct({
  text: Schema.String,
  end: Schema.Finite,
})
export type VoiceClause = typeof VoiceClause.Type

export const Voice = Schema.Struct({
  /** The player started dictation. */
  on: Schema.Boolean,
  /** What the field holds and the player has not sent yet. */
  heard: Schema.String,
  /** The utterance the pending clauses came from. */
  text: Schema.String,
  /** How much of `text` a Move has landed for: the black part of the bar. */
  applied: Schema.Finite,
  /** Clauses in the order the player said them. The first one is in flight. */
  clauses: Schema.Array(VoiceClause),
  /** The last Move that landed. */
  note: Schema.NullOr(Schema.String),
  /** Why the last clause stopped the chain. */
  error: Schema.NullOr(Schema.String),
  /** The Node the last Move placed, so "that" in the next clause points at it. */
  just: Schema.NullOr(Schema.String),
  /** The answers a clause stopped on, kept so a chip can settle one question. */
  held: Schema.NullOr(Schema.Struct({ answers: IntentAnswers })),
  /** The readings offered for a clause the model was not sure about. */
  choices: Schema.Array(
    Schema.Struct({ label: Schema.String, question: Schema.String, id: Schema.String }),
  ),
})
export type Voice = typeof Voice.Type

export const EMPTY_VOICE: Voice = {
  on: false,
  heard: '',
  text: '',
  applied: 0,
  clauses: [],
  note: null,
  error: null,
  just: null,
  held: null,
  choices: [],
}
