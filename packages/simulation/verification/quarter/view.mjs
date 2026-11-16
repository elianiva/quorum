export const title = 'Quarters: when guidance can be set'
export const state = (v) =>
  `Quarter ${v.index}: ${v.phase === 'Running' ? 'guidance locked' : 'guidance open'}`
export const step = (action) => (action === 'SetGuidance' ? 'you set guidance' : 'the quarter ends')
export const group = (v) => v.phase
export const colors = { AwaitingGuidance: 'yellow', Running: 'teal' }
