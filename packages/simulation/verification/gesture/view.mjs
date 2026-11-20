export const title = 'The board gesture: press, drag, pinch, release'

export const state = (v) => v.gesture

export const step = (action) => {
  const name = String(action).split('(')[0]
  if (name === 'Press') return 'you press the empty board'
  if (name === 'PressNode') return 'you press a card'
  if (name === 'PressFooter') return 'you press a card footer'
  if (name === 'PressPort') return 'you press an out port'
  if (name === 'MoveFar') return 'the pointer moves far enough'
  if (name === 'TickStart') return 'the press time passes'
  if (name === 'TickDone') return 'the hold completes'
  if (name === 'Second') return 'a second finger touches'
  if (name === 'Up') return 'the pointer lifts'
  if (name === 'Cancel') return 'the pointer is cancelled'
  return null
}

export const group = (v) => v.gesture
export const colors = {
  Idle: 'blue',
  PressPending: 'yellow',
  Holding: 'orange',
  Panning: 'teal',
  Dragging: 'purple',
  Linking: 'pink',
  Boxing: 'tan',
  Pinching: 'blue',
}
