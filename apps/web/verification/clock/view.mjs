export const title = 'Clock: overlays and the tick'

const nameOf = {
  Running: 'Running',
  Player: 'Paused by you',
  Blur: 'Paused away',
  Incident: 'Paused by an Incident',
  Overlay: 'Paused by an overlay',
}

export const state = (v) =>
  v.clock === 'Overlay'
    ? `Paused by ${v.overlays.length === 0 ? 'an overlay' : v.overlays.join(' and ')}`
    : nameOf[v.clock]

export const step = (action, from, to) => {
  if (action === 'Pause') return to.clock === 'Player' ? 'you pause' : 'you resume'
  if (action === 'Blur') return 'the window loses focus'
  if (action === 'Focus') return 'the window gets focus'
  if (action === 'Severe') return 'a severe Incident starts'
  if (action === 'Tick') return 'the clock ticks'
  if (action === 'Quiet') return 'a quiet message arrives'
  if (action.startsWith('Open')) return `you open ${action.slice(4, -3)}`
  if (action.startsWith('Close')) return `you close ${action.slice(5, -3)}`
  return action
}

export const group = (v) => (v.clock === 'Running' ? 'running' : 'paused')
export const colors = { running: 'blue', paused: 'orange' }
