import { expect, test } from 'vitest'
import { GUIDED } from './sandbox.ts'
import { GUIDED_SUMMARY, SANDBOX_IDS } from './sandbox-summary.ts'

/* The summary is what the wiki and the catalog copy read; the simulation adds the board and the
   conditions. Keep the two from drifting. */
test('the guided summary matches every sandbox the simulation runs', () => {
  for (const id of SANDBOX_IDS) {
    const guided = GUIDED[id]
    const summary = GUIDED_SUMMARY[id]
    expect(summary.name, id).toBe(guided.name)
    expect(summary.stage, id).toBe(guided.stage)
    expect(
      summary.objectives.map((objective) => ({
        goal: objective.goal,
        users: objective.users,
        incident:
          objective.incident === undefined
            ? null
            : { kind: objective.incident.kind, only: objective.incident.only },
      })),
      id,
    ).toEqual(
      guided.objectives.map((objective) => ({
        goal: objective.goal,
        users: objective.users,
        incident:
          objective.incident === undefined
            ? null
            : { kind: objective.incident.kind, only: objective.incident.only },
      })),
    )
  }
})
