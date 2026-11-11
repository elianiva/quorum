import { describe, expect, test } from 'vitest'
import type { IntentAnswers } from '@quorum/rpc'
import { newGame } from '@quorum/simulation/company'
import { AppRoute } from './route.ts'
import { initialModel, update } from './update.ts'
import { Message } from './message.ts'
import { LINE_HOLD_MS } from './update/voice.ts'

const lab = () => ({
  ...initialModel(),
  route: AppRoute.Company(),
  board: { ...initialModel().board, game: newGame() },
})

const certain = (choice: string, other: string, p = 0.9): IntentAnswers[string] => ({
  choice,
  probabilities: { [choice]: p, [other]: 1 - p },
  confidence: p,
})

const listOf = (model: ReturnType<typeof lab>, text: string) => ({
  ...model,
  voice: { ...model.voice, on: true, text, applied: text.length },
})

describe('the dictation line', () => {
  test('clears itself once the line has been read', () => {
    const model = listOf(lab(), 'buy a database')
    const cleared = update(model, Message.VoiceForgotten({ text: 'buy a database' })).model
    expect(cleared.voice.text).toBe('')
    expect(cleared.voice.applied).toBe(0)
  })

  test('stays when a newer utterance owns it', () => {
    const model = listOf(lab(), 'buy a database')
    expect(update(model, Message.VoiceForgotten({ text: 'sell the cache' })).model.voice.text).toBe(
      'buy a database',
    )
    const running = {
      ...model,
      voice: { ...model.voice, clauses: [{ text: 'buy a database', end: 15 }] },
    }
    expect(
      update(running, Message.VoiceForgotten({ text: 'buy a database' })).model.voice.text,
    ).toBe('buy a database')
  })

  test('a finished clause sets the line to clear after the hold', () => {
    const heard = update(lab(), Message.VoiceUttered({ text: 'add a database' })).model
    const answers: IntentAnswers = {
      verb: certain('place', 'nothing'),
      component: certain('database', 'cache'),
    }
    const answered = update(heard, Message.VoiceAnswered({ clause: 'add a database', answers }))
    const forget = (answered.commands ?? []).find((command) => command.name === 'ForgetDictation')
    expect(forget).toBeDefined()
    expect(forget?.args).toMatchObject({ text: 'add a database', delay: LINE_HOLD_MS })
    expect(answered.model.voice.clauses).toEqual([])
  })
})
