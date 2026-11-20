export const title = 'The Study queue'

const list = (q) => {
  if (q === undefined || q === null) return []
  if (Array.isArray(q)) return q
  return Object.keys(q)
    .map(Number)
    .filter((i) => !Number.isNaN(i))
    .sort((a, b) => a - b)
    .map((i) => q[i])
}

export const state = (v) => {
  const ids = list(v.q)
  return ids.length === 0 ? 'No Studies' : `${ids[0]} on top`
}

export const step = (action) => {
  const name = String(action).split('(')[0]
  if (name === 'Add') return 'you queue a Study'
  if (name === 'Cancel') return 'you cancel a Study'
  if (name === 'Drop' || name === 'MoveUp' || name === 'MoveDown') return null
  if (name === 'Tick') return 'the Study on top ticks'
  if (name === 'Finish') return 'the Study on top finishes'
  return null
}

export const group = (v) => (list(v.q).length === 0 ? 'Empty' : 'Working')
export const colors = { Empty: 'blue', Working: 'teal' }
