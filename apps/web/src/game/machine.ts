import { Machine } from '@typeonce/effect-machine'
import { Effect } from 'effect'

const snapshotOf = (state: Readonly<{ _tag: string }>): unknown => ({
  path: '',
  value: undefined,
  state: { path: state._tag, value: state },
})

export const planState = <State extends Readonly<{ _tag: string }>>(
  machine: unknown,
  state: State,
  event: unknown,
): State => {
  const plan = Effect.runSync(
    Machine.plan(machine as never, snapshotOf(state) as never, event as never),
  )
  const transitions = plan.microsteps as ReadonlyArray<{ transitions: ReadonlyArray<unknown> }>
  if (transitions.every((step) => step.transitions.length === 0)) return state
  return (plan.next as unknown as Readonly<{ state: { value: State } }>).state.value
}
