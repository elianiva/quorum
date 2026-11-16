export const title = 'The running Incident'
export const state = (v) => v.phase
export const step = (action, from) => {
  if (action === 'Signalled') return 'the pager fires'
  if (action === 'Acked')
    return from.phase === 'Quiet' ? 'you act before the pager' : 'you or on-call acknowledge'
  if (action === 'Resolved') return 'the Incident ends'
  return null
}
export const group = (v) => v.phase
export const colors = {
  Quiet: 'blue',
  Announced: 'yellow',
  Responded: 'purple',
  Acknowledged: 'teal',
}
