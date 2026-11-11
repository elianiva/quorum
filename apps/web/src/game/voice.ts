import { IntentAnswers } from '@quorum/rpc'
import { Schema } from 'effect'

/* ==========================================================================
   Dictation. One utterance becomes clauses, and each clause becomes one Move.
   The bar shows the utterance grey until a clause lands, then black, so what
   the microphone heard and what the board did are the same line of text.
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
  /** What the microphone has heard and not sent yet. */
  heard: Schema.String,
  /** What the player said before this utterance, kept on the line as it scrolls away. */
  settled: Schema.String,
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
  /** How much of the speech model has downloaded, or null when it is ready. */
  loading: Schema.NullOr(Schema.Finite),
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

/**
 * The line runs on. A finished utterance stays in front of the next one, and the
 * oldest words fall off once the line is longer than anyone reads at a glance.
 */
const KEPT = 180

export const lineWith = (settled: string, next: string): string => {
  const whole = settled === '' ? next : next === '' ? settled : `${settled} ${next}`
  if (whole.length <= KEPT) return whole
  return whole.slice(whole.length - KEPT).replace(/^\S*\s+/, '')
}

export const EMPTY_VOICE: Voice = {
  on: false,
  heard: '',
  settled: '',
  text: '',
  applied: 0,
  clauses: [],
  note: null,
  error: null,
  loading: null,
  just: null,
  held: null,
  choices: [],
}
