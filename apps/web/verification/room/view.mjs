export const title = 'Room: joining, failing, and recovering'

export const state = (v) =>
  v.phase === 'Failed' ? `Failed: ${v.status === 'full' ? 'full' : 'unreachable'}` : v.phase

export const step = (action, from, to) => {
  if (action === 'Connect') return 'you open the Room'
  if (action === 'Welcome') return 'the Room welcomes you'
  if (action === 'Drop') return 'the socket drops'
  if (action === 'Full') return 'the Room is full'
  if (action === 'Left') return 'you leave'
  if (action === 'SocketOpen') return 'the socket opens'
  return `the socket reports ${to.status}`
}

export const group = (v) => (v.phase === 'Online' ? 'in' : v.phase === 'Failed' ? 'failed' : 'out')
export const colors = { in: 'blue', failed: 'orange', out: 'purple' }
