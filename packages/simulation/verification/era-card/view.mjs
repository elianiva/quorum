export const title = 'The Era card, and the round that opens it'

const eras = ['Garage', 'Pre-seed', 'Seed']
const rounds = {
  Waiting: 'no round yet',
  Offered: 'round on the table',
  Raised: 'round raised',
  Declined: 'round declined',
}

export const state = (v) => {
  if (v.panel === 'era')
    return v.card === v.stage
      ? `Era card: ${eras[v.stage] ?? 'Seed'}`
      : `Era card: the Era you left (${eras[v.card] ?? '?'})`
  if (v.panel === 'offer') return `${eras[v.stage] ?? 'Seed'}, the round offer`
  return `${eras[v.stage] ?? 'Seed'}, ${rounds[v.round] ?? ''}`
}

export const step = (action, _from, to) => {
  const name = String(action).split('(')[0]
  if (name === 'Offer') return 'a milestone offers the round'
  if (name === 'OpenOffer') return 'you open the offer'
  if (name === 'Answer') return to.round === 'Raised' ? 'you raise' : 'you decline'
  if (name === 'Found') return 'a Head start Company begins'
  if (name === 'EarlyOpen') return 'the card opens with the round still on the table'
  if (name === 'Close') return 'you continue'
  return null
}

export const group = (v) => (v.panel === 'era' ? 'Card' : v.panel === 'offer' ? 'Offer' : 'Board')
export const colors = { Board: 'blue', Offer: 'yellow', Card: 'teal' }
