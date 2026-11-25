import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { INCIDENT_IDS, REGIONS, ZONES } from './catalog.ts'
import { planState } from './machine.ts'

const IncidentId = Schema.Literals(INCIDENT_IDS)
const Zone = Schema.Literals(ZONES)
const RegionId = Schema.Literals(REGIONS)

export const IncidentPhase = Schema.TaggedUnion({
  Pending: {},
  Responded: { ackAt: Schema.Finite },
  Announced: { signalAt: Schema.Finite },
  Acknowledged: {
    signalAt: Schema.Finite,
    ackAt: Schema.Finite,
  },
})
export type IncidentPhase = typeof IncidentPhase.Type

export const Incident = Schema.Struct({
  kind: IncidentId,
  remaining: Schema.Finite,
  nodeId: Schema.NullOr(Schema.String),
  startedAt: Schema.Finite,
  baseline: Schema.Finite,
  usersAtStart: Schema.Finite,
  impaired: Schema.Finite,
  lostRevenue: Schema.Finite,
  failed: Schema.Finite,
  phase: IncidentPhase,
  severity: Schema.Finite,
  magnitude: Schema.Finite,
  zone: Schema.NullOr(Zone),
  region: Schema.NullOr(RegionId),
  service: Schema.optionalKey(Schema.NullOr(Schema.String)),
  causedBy: Schema.NullOr(IncidentId),
  throttled: Schema.optionalKey(Schema.Boolean),
  rollingBack: Schema.optionalKey(Schema.Boolean),
})
export type Incident = typeof Incident.Type

export const IncidentState = Schema.TaggedUnion({
  Quiet: {},
  Active: { incident: Incident },
})
export type IncidentState = typeof IncidentState.Type

export const IncidentEvent = Schema.TaggedUnion({
  Started: { incident: Incident },
  Signalled: { at: Schema.Finite },
  Acked: { at: Schema.Finite },
  Updated: { incident: Incident },
  Resolved: {},
})
export type IncidentEvent = typeof IncidentEvent.Type

const PhaseStates = Machine.state({ states: IncidentPhase.cases })
const PhaseEvents = Machine.eventsFromSchemas(IncidentEvent)

export const incidentPhaseMachine = Machine.make({ root: PhaseStates, events: PhaseEvents }).handle(
  {
    initial: { target: 'Pending' },
    states: {
      Pending: {
        on: {
          Signalled: {
            target: 'Announced',
            data: ({ event }) => ({ _tag: 'Announced', signalAt: event.at }),
          },
          Acked: {
            target: 'Responded',
            data: ({ event }) => ({ _tag: 'Responded', ackAt: event.at }),
          },
        },
      },
      Responded: {
        on: {
          Signalled: {
            target: 'Acknowledged',
            data: ({ state, event }) => ({
              _tag: 'Acknowledged',
              signalAt: event.at,
              ackAt: state.ackAt,
            }),
          },
        },
      },
      Announced: {
        on: {
          Acked: {
            target: 'Acknowledged',
            data: ({ state, event }) => ({
              _tag: 'Acknowledged',
              signalAt: state.signalAt,
              ackAt: event.at,
            }),
          },
        },
      },
      Acknowledged: {},
    },
  },
)

export const phaseStep = (phase: IncidentPhase, event: IncidentEvent): IncidentPhase =>
  planState(incidentPhaseMachine, phase, event)

export const signalAtOf = (phase: IncidentPhase): number | null =>
  IncidentPhase.match(phase, {
    Pending: () => null,
    Responded: () => null,
    Announced: ({ signalAt }) => signalAt,
    Acknowledged: ({ signalAt }) => signalAt,
  })

export const ackAtOf = (phase: IncidentPhase): number | null =>
  IncidentPhase.match(phase, {
    Pending: () => null,
    Responded: ({ ackAt }) => ackAt,
    Announced: () => null,
    Acknowledged: ({ ackAt }) => ackAt,
  })

export const hasAck = (phase: IncidentPhase): boolean => ackAtOf(phase) !== null

export const isLeftAlone = (phase: IncidentPhase, remaining: number): boolean =>
  !hasAck(phase) && remaining <= 0

const StateStates = Machine.state({ states: IncidentState.cases })
const StateEvents = Machine.eventsFromSchemas(IncidentEvent)

export const incidentMachine = Machine.make({ root: StateStates, events: StateEvents }).handle({
  initial: { target: 'Quiet' },
  states: {
    Quiet: {
      on: {
        Started: {
          target: 'Active',
          data: ({ event }) => ({ _tag: 'Active', incident: event.incident }),
        },
      },
    },
    Active: {
      on: {
        Started: {
          target: 'Active',
          data: ({ event }) => ({ _tag: 'Active', incident: event.incident }),
        },
        Signalled: {
          target: 'Active',
          guard: ({ state }) => signalAtOf(state.incident.phase) === null,
          data: ({ state, event }) => ({
            _tag: 'Active',
            incident: {
              ...state.incident,
              phase: phaseStep(state.incident.phase, { _tag: 'Signalled', at: event.at }),
            },
          }),
        },
        Acked: {
          target: 'Active',
          guard: ({ state }) => ackAtOf(state.incident.phase) === null,
          data: ({ state, event }) => ({
            _tag: 'Active',
            incident: {
              ...state.incident,
              phase: phaseStep(state.incident.phase, { _tag: 'Acked', at: event.at }),
            },
          }),
        },
        Updated: {
          target: 'Active',
          guard: ({ state, event }) => state.incident.startedAt === event.incident.startedAt,
          data: ({ event }) => ({ _tag: 'Active', incident: event.incident }),
        },
        Resolved: { target: 'Quiet', data: () => ({ _tag: 'Quiet' }) },
      },
    },
  },
})

export const step = (state: IncidentState, event: IncidentEvent): IncidentState =>
  planState(incidentMachine, state, event)

export const activeIncidentOf = (state: IncidentState): Incident | null =>
  state._tag === 'Active' ? state.incident : null

export const incidentPhaseOf = (state: IncidentState): IncidentPhase | null =>
  state._tag === 'Active' ? state.incident.phase : null

export const beginIncident = (state: IncidentState, incident: Incident): IncidentState =>
  step(state, { _tag: 'Started', incident })

export const signalIncident = (state: IncidentState, at: number): IncidentState =>
  step(state, { _tag: 'Signalled', at })

export const ackIncident = (state: IncidentState, at: number): IncidentState =>
  step(state, { _tag: 'Acked', at })

export const updateIncident = (state: IncidentState, change: Partial<Incident>): IncidentState => {
  const incident = activeIncidentOf(state)
  return incident === null
    ? state
    : step(state, { _tag: 'Updated', incident: { ...incident, ...change } })
}

export const resolveIncident = (state: IncidentState): IncidentState =>
  step(state, { _tag: 'Resolved' })
