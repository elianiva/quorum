export const title = 'The Room vote: open, balloted, closed'

export const state = (v) => {
  const vote =
    v.vote === 'Idle'
      ? 'no vote'
      : v.kind === 'exit'
        ? 'exit vote open'
        : 'fund or decline vote open'
  return `${v.phase === 'Live' ? 'Live' : 'Idle'}, ${vote}`
}

export const step = (action, from, to) => {
  const name = String(action).split('(')[0]
  if (name === 'Join') return 'someone joins the Room'
  if (name === 'Leave') return 'the last seat leaves'
  if (name === 'Open')
    return to.kind === 'exit' ? 'you start an exit vote' : 'you start a fund or decline vote'
  if (name === 'Ballot') return 'a ballot does not pass'
  if (name === 'Pass') return 'the vote passes'
  if (name === 'Exit') return 'the exit vote passes'
  if (name === 'FailedAnswer') return 'the raise or decline is refused'
  if (name === 'Lapse') return 'the deadline passes'
  return null
}

export const group = (v) => v.phase
export const colors = { Live: 'teal', Idle: 'blue' }
