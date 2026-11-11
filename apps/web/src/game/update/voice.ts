import { Message } from '../message.ts'
import { Model } from '../model.ts'
import {
  candidates,
  clauses,
  moveRequest,
  resolve,
  spotFor,
  type Move,
  type Resolved,
} from '../moves.ts'
import { EMPTY_VOICE } from '../voice.ts'
import { Actions } from '../board-actions.ts'
import { ResearchMessage } from '../research.ts'
import { ClearDictationField, FocusDictation, ForgetDictation, ResolveClause } from '../commands.ts'
import {
  act,
  say,
  sync,
  type AnyCommand,
  type Dispatch,
  type MessageCases,
  type UpdateResult,
} from './shared.ts'

/* ==========================================================================
   Dictation. One utterance is split into clauses, and one clause becomes one
   Move. Clauses run one after another, so each request sees the Board the Move
   before it made: "then connect that to the app server" points at the Node the
   first clause just bought.
   ========================================================================== */

type VoiceTag =
  | 'VoiceToggled'
  | 'VoiceChoiceChosen'
  | 'VoiceHeard'
  | 'VoiceUttered'
  | 'VoiceAnswered'
  | 'VoiceFailed'
  | 'VoiceForgotten'

/** How long each landed clause stays the newest thing on screen before the chain moves on. */
export const CLAUSE_PAUSE_MS = 450

/** How long a finished line stays on the board, so it can be read before it clears. */
export const LINE_HOLD_MS = 9_000

/** Sends the line away after the hold, unless a newer utterance owns it by then. */
const forgetLater = (model: Model): AnyCommand =>
  ForgetDictation({ text: model.voice.text, delay: LINE_HOLD_MS })

const requestOf = (model: Model, clause: string): string =>
  JSON.stringify(
    moveRequest({
      game: model.board.game,
      region: model.board.region,
      clause,
      just: model.voice.just,
    }),
  )

/** Lands a resolved Move: applies it, inks the clause, and runs the clause after it. */
const settle = (model: Model, resolved: Resolved, route: Dispatch): UpdateResult => {
  const head = model.voice.clauses[0]
  if (head === undefined) return { model }
  const rest = model.voice.clauses.slice(1)
  const applied = apply(model, resolved.move, resolved.label, route)
  // A move the board refused leaves the Game as it was: the clause stays grey, and the chain stops.
  const refused =
    applied.model.board.game === model.board.game &&
    applied.model.panel === model.panel &&
    applied.model.board.selected === model.board.selected
      ? (applied.model.toast?.message ?? 'That move did not happen.')
      : null
  if (refused !== null) {
    const next: Model = {
      ...model,
      voice: { ...model.voice, clauses: [], choices: [], held: null, error: refused },
    }
    return {
      model: next,
      commands: [...(applied.commands ?? []), forgetLater(next)],
    }
  }
  const just =
    resolved.move._tag === 'Place' && applied.model.board.game !== model.board.game
      ? (applied.model.board.game.nodes.at(-1)?.id ?? null)
      : null
  const next: Model = {
    ...applied.model,
    voice: {
      ...applied.model.voice,
      applied: rest.length === 0 ? applied.model.voice.text.length : head.end,
      clauses: rest,
      note: resolved.label,
      error: null,
      choices: [],
      held: null,
      just,
    },
  }
  const focus =
    resolved.move._tag === 'Place'
      ? just
      : resolved.move._tag === 'Connect'
        ? resolved.move.to
        : resolved.move._tag === 'Resize'
          ? resolved.move.nodeId
          : resolved.move._tag === 'Setting'
            ? resolved.move.focus
            : null
  const following = rest[0]
  const commands = [...(applied.commands ?? [])]
  // The camera moves to what the clause changed, so a step is something the eye follows.
  if (focus !== null) commands.push(sync(next, false, focus))
  if (following !== undefined)
    commands.push(
      ResolveClause({
        clause: following.text,
        request: requestOf(next, following.text),
        delay: CLAUSE_PAUSE_MS,
      }),
    )
  // The last clause leaves its sentence on the bar for a moment, then the bar empties.
  else commands.push(forgetLater(next))
  return { model: next, commands }
}

/** One Move as the Messages the board already answers: an action, or a view. */
const apply = (model: Model, move: Move, label: string, route: Dispatch): UpdateResult => {
  const game = model.board.game
  switch (move._tag) {
    case 'Place': {
      const spot = spotFor(game, model.board.region, move.type)
      return act(model, label, Actions.place(game, move.type, spot.x, spot.y, model.board.region), {
        undoable: true,
        patch: (_, after) => ({ selected: after.nodes.at(-1)?.id ?? null }),
        panel: () => 'none',
      })
    }
    case 'Connect':
      return act(model, label, Actions.connect(game, move.from, move.to), { undoable: true })
    case 'Resize':
      return act(model, label, Actions.resize(game, move.nodeId, move.direction), {
        undoable: true,
      })
    case 'Study': {
      // "Get Stripe" means three things at once: open Research, point it at the item, and queue it.
      const shown = route(model, Message.ResearchShown({ id: move.id }))
      const queued = route(
        shown.model,
        Message.ResearchChanged({ message: ResearchMessage.Bought({ id: move.id }) }),
      )
      return {
        model: queued.model,
        commands: [...(shown.commands ?? []), ...(queued.commands ?? [])],
      }
    }
    case 'Research':
      return route(model, Message.ResearchShown({ id: move.id }))
    case 'Node':
      return route(model, Message.RevealNode({ nodeId: move.nodeId }))
    case 'Panel':
      return route(model, Message.PanelOpened({ panel: move.panel }))
    // A setting, a Node command, and a board action already hold their Message.
    case 'Setting':
      return route(model, move.message)
    case 'Nothing':
      return { model }
  }
}

export const voiceHandlers = (
  model: Model,
  route: Dispatch,
): MessageCases<UpdateResult, VoiceTag> => ({
  VoiceToggled: () => ({
    model: {
      ...model,
      // Switching dictation off puts the line away: the bar is only there while it is listening.
      voice: model.voice.on ? { ...EMPTY_VOICE } : { ...model.voice, on: true, error: null },
    },
    // Opening the bar puts the cursor in it, so a dictation app has somewhere to type.
    ...(model.voice.on ? {} : { commands: [FocusDictation({})] }),
  }),

  VoiceHeard: ({ text }) => ({ model: { ...model, voice: { ...model.voice, heard: text } } }),

  VoiceUttered: ({ text }) => {
    const parts = clauses(text)
    const first = parts[0]
    if (first === undefined) return { model }
    const voice = {
      ...model.voice,
      heard: '',
      held: null,
      choices: [],
      text,
      applied: 0,
      clauses: parts.map((part) => ({ text: part.text, end: part.end })),
      note: null,
      error: null,
    }
    const next: Model = { ...model, voice }
    return {
      model: next,
      commands: [
        ClearDictationField({}),
        ResolveClause({ clause: first.text, request: requestOf(next, first.text), delay: 0 }),
      ],
    }
  },

  VoiceAnswered: ({ clause, answers }) => {
    const head = model.voice.clauses[0]
    // A late answer for an utterance the player has already replaced is dropped.
    if (head === undefined || head.text !== clause) return { model }
    const resolved = resolve(model.board.game, answers)
    if (resolved.confident) return settle(model, resolved, route)
    // Not sure which Node or value: offer the readings, and let a chip settle it.
    const offered = candidates(model.board.game, answers)
    if (offered.length > 0)
      return {
        model: {
          ...model,
          voice: {
            ...model.voice,
            held: { answers },
            choices: offered.map((offer) => ({
              label: offer.resolved.label,
              question: offer.question,
              id: offer.id,
            })),
            error: null,
          },
        },
      }
    return {
      model: {
        ...model,
        voice: { ...model.voice, clauses: [], error: say(model).voice.notUnderstood },
      },
    }
  },

  VoiceChoiceChosen: ({ question, id }) => {
    const held = model.voice.held
    if (held === null) return { model }
    const resolved = resolve(model.board.game, held.answers, { question, id })
    return resolved.confident ? settle(model, resolved, route) : { model }
  },

  VoiceForgotten: ({ text }) => {
    // A newer utterance, or a clause still in flight, owns the line now.
    if (model.voice.text !== text || model.voice.clauses.length > 0 || model.voice.heard !== '')
      return { model }
    return {
      model: {
        ...model,
        voice: { ...model.voice, heard: '', text: '', applied: 0, note: null },
      },
    }
  },

  VoiceFailed: ({ clause, reason }) => {
    // A device error has no clause; a clause error stops the chain where it stands.
    if (clause !== '' && model.voice.clauses[0]?.text !== clause) return { model }
    const voice = {
      ...model.voice,
      error: reason,
      ...(clause === '' ? {} : { clauses: [] }),
    }
    // The bar says it, in place: a toast for it would say the same thing twice.
    return { model: { ...model, voice } }
  },
})
