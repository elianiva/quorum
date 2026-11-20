import { expect, test } from 'vitest'
import {
  GestureState,
  HOLD_S,
  gestureStep,
  holdOf,
  pressedNode,
  type GestureEvent,
} from './gesture-machine.ts'

const idle = GestureState.cases.Idle.make({})

const press = (since: number | null = 1_000): GestureEvent => ({
  _tag: 'FooterPressed',
  pointerId: 1,
  id: 'server',
  dx: 12,
  dy: 8,
  x: 100,
  y: 100,
  since,
})

const empty = (box = false): GestureEvent => ({
  _tag: 'EmptyPressed',
  pointerId: 1,
  x: 100,
  y: 100,
  at: { x: 100, y: 100 },
  cut: null,
  box,
})

const node = (id = 'server'): GestureEvent => ({
  _tag: 'NodePressed',
  pointerId: 1,
  id,
  dx: 12,
  dy: 8,
  x: 100,
  y: 100,
  at: { x: 100, y: 100 },
  frame: false,
})

const move = (x: number, y: number, over: string | null = null): GestureEvent => ({
  _tag: 'PointerMoved',
  pointerId: 1,
  x,
  y,
  at: { x, y },
  over,
})

test('a press on the board pans and a press on a node drags it', () => {
  expect(gestureStep(idle, empty())).toMatchObject({
    _tag: 'Panning',
    pointerId: 1,
    x: 100,
    y: 100,
    moved: false,
  })
  expect(gestureStep(idle, node())).toMatchObject({
    _tag: 'Dragging',
    id: 'server',
    dx: 12,
    dy: 8,
    moved: false,
    footer: false,
  })
})

test('the 4 px threshold separates a press from a pan and a drag', () => {
  const pan = gestureStep(idle, empty())
  expect(gestureStep(pan, move(103, 100))).toBe(pan)
  expect(gestureStep(pan, move(104, 100))).toMatchObject({ _tag: 'Panning', moved: true, x: 104 })

  const drag = gestureStep(idle, node())
  expect(gestureStep(drag, move(100, 103))).toBe(drag)
  const dragged = gestureStep(drag, move(100, 104))
  expect(dragged).toMatchObject({ _tag: 'Dragging', moved: true, at: { x: 100, y: 104 } })
  expect(drag).toMatchObject({ _tag: 'Dragging', moved: false, at: { x: 100, y: 100 } })
})

test('a footer press holds, reports progress, and completes to idle', () => {
  const pending = gestureStep(idle, press(1_000))
  expect(pending).toMatchObject({ _tag: 'PressPending', since: 1_000 })
  expect(holdOf(pending)).toEqual({ id: 'server', since: 1_000 })
  expect(pressedNode(pending)).toBe('server')

  expect(gestureStep(pending, { _tag: 'HoldTicked', now: 1_000 })).toBe(pending)
  const holding = gestureStep(pending, { _tag: 'HoldTicked', now: 1_000 + HOLD_S * 500 })
  expect(holding).toMatchObject({ _tag: 'Holding', progress: 0.5 })
  expect(pressedNode(holding)).toBe('server')

  expect(gestureStep(holding, { _tag: 'HoldTicked', now: 1_000 + HOLD_S * 1_000 })).toEqual({
    _tag: 'Idle',
  })
})

test('a footer that cannot hold never leaves the press', () => {
  const pending = gestureStep(idle, press(null))
  expect(pending).toMatchObject({ _tag: 'PressPending', since: null })
  expect(holdOf(pending)).toBeNull()
  expect(gestureStep(pending, { _tag: 'HoldTicked', now: 5_000 })).toBe(pending)
})

test('moving past the threshold turns either press into a drag', () => {
  const pending = gestureStep(idle, press(1_000))
  expect(gestureStep(pending, move(104, 100))).toMatchObject({
    _tag: 'Dragging',
    id: 'server',
    moved: true,
    footer: true,
  })

  const holding = gestureStep(pending, { _tag: 'HoldTicked', now: 1_300 })
  expect(gestureStep(holding, move(96, 100))).toMatchObject({
    _tag: 'Dragging',
    id: 'server',
    moved: true,
    footer: true,
  })
})

test('a link pull snaps to a node but never to its source', () => {
  const linking = gestureStep(idle, {
    _tag: 'PortPressed',
    pointerId: 1,
    from: 'server',
    at: { x: 100, y: 100 },
  })
  expect(linking).toMatchObject({ _tag: 'Linking', from: 'server', snapTo: null })

  expect(gestureStep(linking, move(200, 100, 'database'))).toMatchObject({
    _tag: 'Linking',
    at: { x: 200, y: 100 },
    snapTo: 'database',
  })
  expect(gestureStep(linking, move(200, 100, 'server'))).toMatchObject({ snapTo: null })
  expect(gestureStep(linking, move(200, 100))).toMatchObject({ snapTo: null })
})

test('shift opens a selection box and follows the pointer', () => {
  const boxing = gestureStep(idle, empty(true))
  expect(boxing).toMatchObject({ _tag: 'Boxing', from: { x: 100, y: 100 } })
  expect(gestureStep(boxing, move(160, 140, 'database'))).toMatchObject({
    _tag: 'Boxing',
    at: { x: 160, y: 140 },
    snapTo: 'database',
  })
})

test('a second touch pinches, updates, and lifts back to idle', () => {
  const panning = gestureStep(idle, empty())
  const pinching = gestureStep(panning, {
    _tag: 'SecondTouch',
    touches: [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 103, y: 104 },
    ],
  })
  expect(pinching).toMatchObject({ _tag: 'Pinching', distance: 5 })

  expect(
    gestureStep(pinching, {
      _tag: 'PointerMoved',
      pointerId: 2,
      x: 106,
      y: 108,
      at: { x: 106, y: 108 },
      over: null,
    }),
  ).toMatchObject({
    _tag: 'Pinching',
    distance: 10,
    touches: [
      { id: 1, x: 100, y: 100 },
      { id: 2, x: 106, y: 108 },
    ],
  })

  const one = gestureStep(pinching, { _tag: 'TouchEnded', pointerId: 1 })
  expect(one).toMatchObject({ _tag: 'Pinching', touches: [{ id: 2, x: 103, y: 104 }] })
  expect(gestureStep(one, { _tag: 'TouchEnded', pointerId: 2 })).toEqual({ _tag: 'Idle' })
})

test('an event the table has no transition for changes nothing', () => {
  const panning = gestureStep(idle, empty())
  const dragging = gestureStep(idle, node())
  const pinching = gestureStep(panning, {
    _tag: 'SecondTouch',
    touches: [
      { id: 1, x: 0, y: 0 },
      { id: 2, x: 3, y: 4 },
    ],
  })

  expect(gestureStep(idle, { _tag: 'PointerReleased', at: { x: 0, y: 0 }, over: null })).toBe(idle)
  expect(gestureStep(idle, { _tag: 'HoldTicked', now: 1 })).toBe(idle)
  expect(gestureStep(idle, { _tag: 'TouchEnded', pointerId: 1 })).toBe(idle)
  expect(gestureStep(panning, empty())).toBe(panning)
  expect(gestureStep(dragging, { _tag: 'HoldTicked', now: 1 })).toBe(dragging)
  expect(
    gestureStep(pinching, {
      _tag: 'SecondTouch',
      touches: [
        { id: 1, x: 0, y: 0 },
        { id: 2, x: 3, y: 4 },
      ],
    }),
  ).toBe(pinching)
})

test('every phase ends at idle except a pinch, which waits for the last touch', () => {
  const pressed = gestureStep(idle, press(1_000))
  const holding = gestureStep(pressed, { _tag: 'HoldTicked', now: 1_300 })
  const panning = gestureStep(idle, empty())
  const dragging = gestureStep(idle, node())
  const linking = gestureStep(idle, {
    _tag: 'PortPressed',
    pointerId: 1,
    from: 'server',
    at: { x: 0, y: 0 },
  })
  const boxing = gestureStep(idle, empty(true))

  for (const phase of [pressed, holding, panning, dragging, linking, boxing])
    expect(gestureStep(phase, { _tag: 'PointerCancelled' })).toEqual({ _tag: 'Idle' })
})
