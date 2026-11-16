export const title = 'Funding rounds'
export const state = (v) => `Era ${v.stage}, round ${v.round.toLowerCase()}`
export const step = (_a, from, to) =>
  to.last === 'you answer with no offer' ? 'you answer with no offer on the table' : to.last
export const group = (v) => v.round
export const colors = { Waiting: 'blue', Offered: 'yellow', Raised: 'teal', Declined: 'orange' }
