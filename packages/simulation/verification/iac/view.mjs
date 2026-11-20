export const title = 'IaC: the tool, its switch, and the Apply'

export const state = (v) =>
  v.chosen ? `${v.tool}, ${v.sync === 'none' ? 'no sync mode' : v.sync}` : 'No tool'

export const step = (action, from, to) => {
  const name = String(action).split('(')[0]
  if (name === 'Pick') return from.chosen ? 'you switch the tool' : 'you pick a tool'
  if (name === 'SetMode')
    return to.sync === 'none' ? 'you clear the sync mode' : 'you set the sync mode'
  if (name === 'Time') return null
  if (name === 'Apply') return 'you apply the plan'
  if (name === 'Land') return 'the Apply lands'
  return null
}

export const group = (v) => (v.chosen ? 'Chosen' : 'NotChosen')
export const colors = { Chosen: 'teal', NotChosen: 'blue' }
