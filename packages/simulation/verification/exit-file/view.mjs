export const title = 'The Exit, and the Company it leaves behind'

const eras = ['Garage', 'Pre-seed', 'Seed', 'Series A', 'Series B']
const offers = { none: 'no offer', 'acqui-hire': 'Acqui-hire', acquisition: 'Acquisition' }

export const state = (v) => {
  if (v.phase === 'closed') return 'Next company'
  if (v.phase === 'exited')
    return v.file ? 'Exited, the Company comes back' : 'Exited, the Company is gone'
  if (v.panel === 'confirm') return `Confirming ${offers[v.asked]}`
  if (v.panel === 'exit') return 'Exit offers'
  return eras[v.stage] ?? 'Series B'
}

export const step = (action, _from, _to) => {
  const name = String(action).split('(')[0]
  if (name === 'Advance') return 'an Era passes'
  if (name === 'OpenExit') return 'you open the Exit'
  if (name === 'Ask') return 'you pick an offer'
  if (name === 'Cancel') return 'you cancel'
  if (name === 'Take') return 'you take the Exit'
  if (name === 'SaveStarts') return 'a save starts'
  if (name === 'SaveLands') return 'a save lands'
  if (name === 'Dismiss') return 'you start the next company'
  if (name === 'Render') return null
  return null
}

export const group = (v) =>
  v.phase === 'open' ? 'Playing' : v.phase === 'exited' ? 'Exited' : 'Closed'
export const colors = { Playing: 'blue', Exited: 'orange', Closed: 'teal' }
