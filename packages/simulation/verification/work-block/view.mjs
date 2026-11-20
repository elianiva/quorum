export const title = 'A work item: blocked, held, or finished'

export const state = (v) =>
  v.done ? 'Done' : `${v.block}${v.spent === 1 ? ', paid' : ''}${v.assigned ? ', with a team' : ''}`

export const step = (action, _from, _to) => {
  const name = String(action).split('(')[0]
  if (name === 'Assign') return 'a team takes the item'
  if (name === 'Block') return 'it waits on you'
  if (name === 'Approve') return 'you approve it'
  if (name === 'Hold') return 'you cancel it and it is held'
  if (name === 'Resume') return 'you resume it'
  if (name === 'Work') return 'the team works on it'
  if (name === 'Rush') return 'you rush it'
  if (name === 'Finish') return 'it is finished'
  return null
}

export const group = (v) => (v.done ? 'Done' : v.block)
export const colors = {
  Free: 'blue',
  Blocked: 'orange',
  Approved: 'teal',
  Held: 'purple',
  Done: 'tan',
}
