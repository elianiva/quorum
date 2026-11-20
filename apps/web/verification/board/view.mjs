export const title = 'Board: a failed surface stops the tick'

export const state = (v) =>
  !v.onBoard
    ? 'Off the board'
    : v.surface === 'Ready'
      ? v.clock === 'Running'
        ? 'Ready, clock running'
        : 'Ready, clock paused'
      : v.surface === 'Starting'
        ? 'Starting'
        : 'Unavailable'

export const step = (action, _from, _to) => {
  if (action === 'Open') return 'you open the board'
  if (action === 'Ready') return 'the board starts'
  if (action === 'Unavailable') return 'the board cannot start'
  if (action === 'Leave') return 'you leave the board'
  if (action === 'Pause') return 'the clock pauses or resumes'
  if (action === 'Tick') return 'the tick runs'
  return 'a quiet message arrives'
}

export const group = (v) => (!v.onBoard ? 'out' : v.surface)
export const colors = { out: 'purple', Ready: 'blue', Starting: 'yellow', Unavailable: 'orange' }
