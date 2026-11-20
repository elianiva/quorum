export const title = 'A Room: live, abandoned, idle, and ended'

export const state = (v) => {
  if (!v.exists) return 'Closed'
  if (v.phase === 'Idle') return 'Idle, empty'
  if (v.phase === 'Ended') return 'Ended'
  const who = v.seats === 0 ? 'empty' : `${v.seats} seat`
  return `${v.phase}, ${who}`
}

export const step = (action, from, to) => {
  const name = String(action).split('(')[0]
  if (name === 'Tick') return null
  if (name === 'Wake') return 'the object restarts with its saved seats'
  if (name === 'Connect') return 'a socket opens'
  if (name === 'Join') return 'someone takes a seat'
  if (name === 'Rejoin') return 'a seated player comes back'
  if (name === 'Leave') return 'a seat leaves'
  if (name === 'Expire') return 'the date passes and the Room is deleted'
  if (name === 'Step') return 'the alarm steps the Game'
  if (name === 'Stop')
    return to.phase === 'Ended' ? 'the alarm finds no socket' : 'the alarm stops the Room'
  if (name === 'StartVote') return 'you start a vote'
  if (name === 'ExitPasses') return 'the exit vote passes'
  if (name === 'Clear') return 'the Room is handed over or taken offline'
  if (name === 'Revive') return 'the Room is revived'
  return from.phase === to.phase ? null : `the Room becomes ${to.phase}`
}

export const group = (v) => (v.exists ? v.phase : 'Closed')
export const colors = {
  Idle: 'yellow',
  Live: 'teal',
  Abandoned: 'orange',
  Ended: 'purple',
  Closed: 'blue',
}
