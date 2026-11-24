import { describe, expect, test } from 'vitest'
import { stepBudget } from './analytics-budget.ts'

describe('the analytics budget', () => {
  test('a deep session records past the old 80-event stop', () => {
    let counts = { events: 0, sessionEvents: 0 }
    let allowed = 0
    for (let at = 0; at < 300; at += 1) {
      const step = stepBudget(counts, 'board:node_placed')
      if (step.allowed) allowed += 1
      counts = step.next
    }
    expect(allowed).toBe(300)
    expect(counts.events).toBe(300)
  })

  test('past the flat window it keeps every third event, and a rejected try still counts', () => {
    let counts = { events: 300, sessionEvents: 300 }
    const outcomes = []
    for (let at = 0; at < 6; at += 1) {
      const step = stepBudget(counts, 'board:node_placed')
      outcomes.push(step.allowed)
      counts = step.next
    }
    expect(outcomes).toEqual([false, false, true, false, false, true])
    expect(counts.sessionEvents).toBe(306)
  })

  test('a funnel event skips sampling but still counts toward the month', () => {
    const counts = { events: 300, sessionEvents: 301 }
    const step = stepBudget(counts, 'company:era_reached')
    expect(step.allowed).toBe(true)
    expect(step.next).toEqual({ events: 301, sessionEvents: 301 })
  })

  test('the hard session limit stops even an event the sampler would keep', () => {
    const counts = { events: 500, sessionEvents: 1_500 }
    const step = stepBudget(counts, 'board:node_placed')
    expect(step.allowed).toBe(false)
    expect(step.next.sessionEvents).toBe(1_501)
  })

  test('the month cap stops normal and funnel events alike', () => {
    const counts = { events: 3_000, sessionEvents: 12 }
    expect(stepBudget(counts, 'board:node_placed').allowed).toBe(false)
    expect(stepBudget(counts, 'company:founded').allowed).toBe(false)
  })
})
