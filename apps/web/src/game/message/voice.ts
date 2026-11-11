import { IntentAnswers } from '@quorum/rpc'
import { Schema } from 'effect'

/** The dictation Messages, as cases for the root union. */
export const voiceCases = {
  /** Starts or stops the microphone. */
  VoiceToggled: {},
  /** What the microphone has heard so far, before it is sent. */
  VoiceHeard: { text: Schema.String },
  /** The player settled an ambiguous question by picking one of the readings offered. */
  VoiceChoiceChosen: { question: Schema.String, id: Schema.String },
  /** One utterance the microphone finished. */
  VoiceUttered: { text: Schema.String },
  /** The model's answers for one clause. The handler resolves them and applies the Move. */
  VoiceAnswered: { clause: Schema.String, answers: IntentAnswers },
  /** The clause could not be decided, or the model was unreachable. */
  VoiceFailed: { clause: Schema.String, reason: Schema.String },
  /** The line has been on screen long enough to read, so it clears itself. */
  VoiceForgotten: { text: Schema.String },
}
