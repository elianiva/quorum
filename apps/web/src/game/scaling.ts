import type { AutoscalerView, ScaleState } from '@quorum/simulation/scaling'
import type { ScaleSignal } from '@quorum/simulation/state'
import type { Messages } from '@/i18n/messages.ts'

export const signalLabelOf = (t: Messages, signal: ScaleSignal): string =>
  signal === 'cpu'
    ? t.inspectorAutoscaler.cpu
    : signal === 'load'
      ? t.inspectorAutoscaler.load
      : signal === 'rps'
        ? t.inspectorAutoscaler.requests
        : t.inspectorAutoscaler.queueDepth

export const hintOf = (t: Messages, signal: ScaleSignal): string =>
  signal === 'cpu'
    ? t.inspectorAutoscaler.hintCpu
    : signal === 'load'
      ? t.inspectorAutoscaler.hintLoad
      : signal === 'rps'
        ? t.inspectorAutoscaler.hintRequests
        : t.inspectorAutoscaler.hintQueue

export const readingOf = (
  t: Messages,
  state: Pick<ScaleState, 'signal' | 'reading' | 'target'>,
): string =>
  t.inspectorAutoscaler.readingTarget(
    signalLabelOf(t, state.signal),
    `${Math.round(state.reading * 100)}%`,
    `${Math.round(state.target * 100)}%`,
  )

export const nextOf = (t: Messages, state: ScaleState): string => {
  if (state.phase === 'booting') return t.inspectorAutoscaler.readyIn(Math.ceil(state.readyIn))
  if (state.phase === 'up') {
    const copies = state.wanted - state.copies
    return state.cooldown > 0
      ? t.inspectorAutoscaler.addCopies(copies, Math.ceil(state.cooldown))
      : t.inspectorAutoscaler.addNow(copies)
  }
  if (state.phase === 'down')
    return state.cooldown > 0
      ? t.inspectorAutoscaler.removeCopies(1, Math.ceil(state.cooldown))
      : t.inspectorAutoscaler.removeNow(1)
  if (state.phase === 'paused') return t.inspectorAutoscaler.paused
  if (state.atLimit === 'max') return t.inspectorAutoscaler.atMax
  if (state.atLimit === 'min') return t.inspectorAutoscaler.atMin
  return t.inspectorAutoscaler.holding
}

export const viewNextOf = (t: Messages, view: AutoscalerView): string => {
  if (view.members.length === 0) return '—'
  if (view.phase === 'paused') return t.inspectorAutoscaler.paused
  if (view.phase === 'booting') return t.inspectorAutoscaler.scalingTo(view.wanted)
  if (view.phase === 'up') {
    const copies = view.wanted - view.copies
    return view.cooldown > 0
      ? t.inspectorAutoscaler.addCopies(copies, Math.ceil(view.cooldown))
      : t.inspectorAutoscaler.addNow(copies)
  }
  if (view.phase === 'down')
    return view.cooldown > 0
      ? t.inspectorAutoscaler.removeCopies(1, Math.ceil(view.cooldown))
      : t.inspectorAutoscaler.removeNow(1)
  if (view.members.some((member) => member.atLimit === 'max')) return t.inspectorAutoscaler.atMax
  return view.members.every((member) => member.atLimit === 'min')
    ? t.inspectorAutoscaler.atMin
    : t.inspectorAutoscaler.holding
}

export const toneOf = (
  state: Pick<ScaleState, 'reading' | 'target'>,
): 'danger' | 'warn' | 'plain' =>
  state.reading >= 1.2 ? 'danger' : state.reading >= state.target ? 'warn' : 'plain'

export const copiesOf = (t: Messages, state: Pick<ScaleState, 'copies' | 'booting'>): string =>
  state.booting > 0
    ? t.inspectorAutoscaler.copiesBooting(state.copies, state.booting)
    : t.inspectorAutoscaler.copiesNow(state.copies)
