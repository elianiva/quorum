import { describe, expect, test } from 'vitest'
import { EMPTY_LINE, finishOf, heardIn, quietAt } from './speech.ts'

const say = (text: string, now = 0) => heardIn(EMPTY_LINE, text, now)

describe('the line the model hears', () => {
  test('shows only the words after what was finalised', () => {
    const first = heardIn(EMPTY_LINE, 'add a database', 100)
    expect(first.heard).toBe('add a database')
    const done = finishOf(first.line)
    expect(done.said).toBe('add a database')
    // The model keeps saying the finished line while it hears the next words.
    const next = heardIn(done.line, 'add a database then connect it', 200)
    expect(next.heard).toBe('then connect it')
  })

  test('starts a new line when the transcript no longer carries the old one', () => {
    const done = finishOf(say('add a database', 100).line)
    const next = heardIn(done.line, 'buy a cache', 200)
    expect(next.heard).toBe('buy a cache')
    expect(finishOf(next.line).said).toBe('buy a cache')
  })

  test('finishes a line that has stopped changing', () => {
    const line = say('add a database', 1_000).line
    expect(quietAt(line, 1_500)).toBe(false)
    expect(quietAt(line, 1_950)).toBe(true)
  })

  test('does not finish an empty line', () => {
    expect(finishOf(EMPTY_LINE).said).toBeNull()
    expect(quietAt(EMPTY_LINE, 10_000)).toBe(false)
    expect(say('', 0).heard).toBeNull()
  })
})
