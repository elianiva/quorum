export const title = 'One Node: restart, drain, shutdown, resize'

const LIFE = {
  Running: 'Serving',
  Warming: 'Warming up',
  Restarting: 'Restarting',
  Stopped: 'Shut down',
}

export const state = (v) => `${LIFE[v.life]}${v.service === 'Draining' ? ', draining' : ''}`

export const step = (_action, from, to) => {
  if (from.life === 'Restarting' && to.life === 'Restarting' && from.left > to.left) return null
  return to.last
}

export const group = (v) => v.life
export const colors = {
  Running: 'teal',
  Warming: 'yellow',
  Restarting: 'orange',
  Stopped: 'purple',
}
