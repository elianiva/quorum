export const title = 'Quarters: when guidance can be set'
export const state = (v) =>
  v.phase === 'NotStarted'
    ? 'Before the IPO'
    : `Quarter ${v.index}: ${v.phase === 'Running' ? 'guidance locked' : 'guidance open'}`
export const step = (action) =>
  action === 'Start'
    ? 'the IPO opens the first quarter'
    : action === 'SetGuidance'
      ? 'you set guidance'
      : 'the quarter ends'
export const group = (v) => v.phase
export const colors = { NotStarted: 'blue', AwaitingGuidance: 'yellow', Running: 'teal' }
