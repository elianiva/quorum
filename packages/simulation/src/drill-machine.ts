import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { DRILL_RECOVERED, DRILL_RPO, DRILL_RTO, DRILL_SECONDS } from './catalog.ts'
import { planState } from './machine.ts'

export const DrillState = Schema.TaggedUnion({
  Idle: {},
  Running: {
    startedAt: Schema.Finite,
    rpo: Schema.Finite,
  },
  Recovered: {
    startedAt: Schema.Finite,
    rto: Schema.Finite,
    rpo: Schema.Finite,
  },
  Failed: {
    startedAt: Schema.Finite,
    rpo: Schema.Finite,
    reason: Schema.Literals(['timeout', 'data-loss']),
  },
})
export type DrillState = typeof DrillState.Type

export const DrillEvent = Schema.TaggedUnion({
  Started: {
    startedAt: Schema.Finite,
    rpo: Schema.Finite,
  },
  Ticked: {
    elapsed: Schema.Finite,
    errorShare: Schema.Finite,
  },
  Reset: {},
})
export type DrillEvent = typeof DrillEvent.Type

const States = Machine.state({ states: DrillState.cases })
const Events = Machine.eventsFromSchemas(DrillEvent)

const started = (event: { startedAt: number; rpo: number }) => ({
  _tag: 'Running' as const,
  startedAt: event.startedAt,
  rpo: event.rpo,
})

export const drillMachine = Machine.make({
  root: States,
  events: Events,
  branches: {
    tick: {
      recovered: { target: 'Recovered' },
      failed: { target: 'Failed' },
    },
  },
}).handle({
  initial: { target: 'Idle' },
  states: {
    Idle: {
      on: {
        Started: {
          target: 'Running',
          data: ({ event }) => started(event),
        },
      },
    },
    Running: {
      on: {
        Ticked: {
          branches: 'tick',
          guard: ({ event }) =>
            (event.errorShare < DRILL_RECOVERED && event.elapsed > 0) ||
            event.elapsed >= DRILL_SECONDS + DRILL_RTO,
          resolve: ({ state, event, select }) => {
            if (event.errorShare < DRILL_RECOVERED && event.elapsed > 0)
              return select.recovered({
                data: {
                  _tag: 'Recovered',
                  startedAt: state.startedAt,
                  rto: event.elapsed,
                  rpo: state.rpo,
                },
              })
            return select.failed({
              data: {
                _tag: 'Failed',
                startedAt: state.startedAt,
                rpo: state.rpo,
                reason: 'timeout',
              },
            })
          },
        },
        Reset: { target: 'Idle', data: () => ({ _tag: 'Idle' }) },
      },
    },
    Recovered: {
      on: {
        Started: {
          target: 'Running',
          data: ({ event }) => started(event),
        },
        Reset: { target: 'Idle', data: () => ({ _tag: 'Idle' }) },
      },
    },
    Failed: {
      on: {
        Started: {
          target: 'Running',
          data: ({ event }) => started(event),
        },
        Reset: { target: 'Idle', data: () => ({ _tag: 'Idle' }) },
      },
    },
  },
})

export const step = (state: DrillState, event: DrillEvent): DrillState =>
  planState(drillMachine, state, event)

export const startDrill = (state: DrillState, startedAt: number, rpo: number): DrillState =>
  step(state, { _tag: 'Started', startedAt, rpo })

export const drillPassed = (state: DrillState): boolean =>
  DrillState.guards.Recovered(state) && state.rto < DRILL_RTO && state.rpo < DRILL_RPO

export const drillDone = (state: DrillState): boolean =>
  DrillState.guards.Recovered(state) || DrillState.guards.Failed(state)

export const drillRto = (state: DrillState): number | null =>
  DrillState.guards.Recovered(state) ? state.rto : null
