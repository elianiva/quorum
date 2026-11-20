import { Machine } from '@typeonce/effect-machine'
import { Schema } from 'effect'
import { planState } from './machine.ts'

export const OverlayCause = Schema.Literals(['palette', 'menu', 'boot'])
export type OverlayCause = typeof OverlayCause.Type

export const PauseCause = Schema.Literals(['running', 'player', 'blur', 'incident'])
export type PauseCause = typeof PauseCause.Type

export const ClockMode = Schema.TaggedUnion({
  Running: {},
  PausedByPlayer: {},
  PausedByBlur: {},
  PausedByIncident: {},
  PausedByOverlay: {
    causes: Schema.Array(OverlayCause),
    before: PauseCause,
  },
})
export type ClockMode = typeof ClockMode.Type

const ClockEvent = Schema.TaggedUnion({
  PauseToggled: {},
  Blurred: {},
  Focused: {},
  SevereIncident: {},
  Resumed: {},
  Paused: {},
  OverlayOpened: { cause: OverlayCause },
  OverlayClosed: { cause: OverlayCause },
})
export type ClockEvent = typeof ClockEvent.Type

const States = Machine.state({ states: ClockMode.cases })
const Events = Machine.eventsFromSchemas(ClockEvent)

const beforeOf = (mode: ClockMode): PauseCause =>
  ClockMode.match(mode, {
    Running: (): PauseCause => 'running',
    PausedByPlayer: (): PauseCause => 'player',
    PausedByBlur: (): PauseCause => 'blur',
    PausedByIncident: (): PauseCause => 'incident',
    PausedByOverlay: ({ before }) => before,
  })

const pausedCause = (cause: PauseCause): ClockMode =>
  cause === 'player'
    ? ClockMode.cases.PausedByPlayer.make({})
    : cause === 'blur'
      ? ClockMode.cases.PausedByBlur.make({})
      : cause === 'incident'
        ? ClockMode.cases.PausedByIncident.make({})
        : ClockMode.cases.Running.make({})

type OverlayState = Extract<ClockMode, { _tag: 'PausedByOverlay' }>

const overlay = (
  mode: ClockMode,
  event: Extract<ClockEvent, { _tag: 'OverlayOpened' }>,
): OverlayState => {
  const causes = ClockMode.guards.PausedByOverlay(mode) ? mode.causes : []
  return ClockMode.cases.PausedByOverlay.make({
    causes: causes.includes(event.cause) ? causes : [...causes, event.cause],
    before: beforeOf(mode),
  })
}

const stronger = (left: PauseCause, right: PauseCause): PauseCause => {
  const rank: Record<PauseCause, number> = { running: 0, blur: 1, player: 2, incident: 3 }
  return rank[right] > rank[left] ? right : left
}

export const clockMachine = Machine.make({
  root: States,
  events: Events,
  branches: {
    release: {
      running: { target: 'Running' },
      player: { target: 'PausedByPlayer' },
      blur: { target: 'PausedByBlur' },
      incident: { target: 'PausedByIncident' },
      held: { target: 'PausedByOverlay' },
    },
  },
}).handle({
  initial: { target: 'Running' },
  states: {
    Running: {
      on: {
        PauseToggled: { target: 'PausedByPlayer' },
        Blurred: { target: 'PausedByBlur' },
        SevereIncident: { target: 'PausedByIncident' },
        Paused: { target: 'PausedByPlayer' },
        OverlayOpened: {
          target: 'PausedByOverlay',
          data: ({ event }) =>
            ClockMode.cases.PausedByOverlay.make({ causes: [event.cause], before: 'running' }),
        },
      },
    },
    PausedByPlayer: {
      on: {
        PauseToggled: { target: 'Running' },
        Resumed: { target: 'Running' },
        Paused: { target: 'PausedByPlayer' },
        OverlayOpened: {
          target: 'PausedByOverlay',
          data: ({ event }) =>
            ClockMode.cases.PausedByOverlay.make({ causes: [event.cause], before: 'player' }),
        },
      },
    },
    PausedByBlur: {
      on: {
        PauseToggled: { target: 'Running' },
        Focused: { target: 'Running' },
        Resumed: { target: 'Running' },
        Paused: { target: 'PausedByPlayer' },
        OverlayOpened: {
          target: 'PausedByOverlay',
          data: ({ event }) =>
            ClockMode.cases.PausedByOverlay.make({ causes: [event.cause], before: 'blur' }),
        },
      },
    },
    PausedByIncident: {
      on: {
        PauseToggled: { target: 'Running' },
        Resumed: { target: 'Running' },
        Paused: { target: 'PausedByPlayer' },
        OverlayOpened: {
          target: 'PausedByOverlay',
          data: ({ event }) =>
            ClockMode.cases.PausedByOverlay.make({ causes: [event.cause], before: 'incident' }),
        },
      },
    },
    PausedByOverlay: {
      on: {
        OverlayOpened: {
          target: 'PausedByOverlay',
          data: ({ state, event }) => overlay(state, event),
        },
        OverlayClosed: {
          branches: 'release',
          resolve: ({ state, event, select }) => {
            const causes = state.causes.filter((cause) => cause !== event.cause)
            if (causes.length > 0)
              return select.held({
                data: { _tag: 'PausedByOverlay', causes, before: state.before },
              })
            const next = pausedCause(state.before)
            return next._tag === 'Running'
              ? select.running({ data: { _tag: 'Running' } })
              : next._tag === 'PausedByPlayer'
                ? select.player({ data: { _tag: 'PausedByPlayer' } })
                : next._tag === 'PausedByBlur'
                  ? select.blur({ data: { _tag: 'PausedByBlur' } })
                  : select.incident({ data: { _tag: 'PausedByIncident' } })
          },
        },
        Blurred: {
          target: 'PausedByOverlay',
          data: ({ state }) => ({ ...state, before: stronger(state.before, 'blur') }),
        },
        Focused: {
          target: 'PausedByOverlay',
          data: ({ state }) =>
            state.before === 'blur' ? { ...state, before: 'running' as const } : state,
        },
        SevereIncident: {
          target: 'PausedByOverlay',
          data: ({ state }) => ({ ...state, before: 'incident' as const }),
        },
        Resumed: { target: 'Running' },
      },
    },
  },
})

export const clockStep = (mode: ClockMode, event: ClockEvent): ClockMode =>
  planState(clockMachine, mode, event)

export const paused = (mode: ClockMode): boolean => !ClockMode.guards.Running(mode)

export const away = (mode: ClockMode): boolean =>
  ClockMode.match(mode, {
    Running: () => false,
    PausedByPlayer: () => false,
    PausedByBlur: () => true,
    PausedByIncident: () => false,
    PausedByOverlay: ({ before }) => before === 'blur',
  })

export const overlayCauses = (mode: ClockMode): ReadonlyArray<OverlayCause> =>
  ClockMode.guards.PausedByOverlay(mode) ? mode.causes : []

export const overlayOpen = (mode: ClockMode, cause: OverlayCause): ClockMode =>
  clockStep(mode, { _tag: 'OverlayOpened', cause })

export const overlayClose = (mode: ClockMode, cause: OverlayCause): ClockMode =>
  clockStep(mode, { _tag: 'OverlayClosed', cause })
