import { UiSchema } from '@effect/ui'
import { Option, Schema } from 'effect'

export const DropTarget = Schema.Struct({
  containerId: Schema.String,
  index: Schema.Finite,
})
export type DropTarget = typeof DropTarget.Type

const Position = Schema.Struct({
  screenX: Schema.Finite,
  screenY: Schema.Finite,
  clientX: Schema.Finite,
  clientY: Schema.Finite,
})

export const DragState = Schema.TaggedUnion({
  Idle: {},
  Pending: {
    itemId: Schema.String,
    containerId: Schema.String,
    index: Schema.Finite,
    screenX: Schema.Finite,
    screenY: Schema.Finite,
  },
  Dragging: {
    itemId: Schema.String,
    containerId: Schema.String,
    index: Schema.Finite,
    current: Position,
    maybeDropTarget: Schema.Option(DropTarget),
  },
  KeyboardDragging: {
    itemId: Schema.String,
    containerId: Schema.String,
    index: Schema.Finite,
    targetContainerId: Schema.String,
    targetIndex: Schema.Finite,
  },
})
export type DragState = typeof DragState.Type

export const DragModel = Schema.Struct({ dragState: DragState })
export type DragModel = typeof DragModel.Type

export const Message = UiSchema.TaggedEnum({
  PressedDraggable: {
    itemId: Schema.String,
    containerId: Schema.String,
    index: Schema.Finite,
    screenX: Schema.Finite,
    screenY: Schema.Finite,
  },
  MovedPointer: {
    screenX: Schema.Finite,
    screenY: Schema.Finite,
    clientX: Schema.Finite,
    clientY: Schema.Finite,
    maybeDropTarget: Schema.Option(DropTarget),
  },
  ReleasedPointer: {},
  CancelledDrag: {},
  ActivatedKeyboardDrag: {
    itemId: Schema.String,
    containerId: Schema.String,
    index: Schema.Finite,
  },
  PressedArrowKey: {
    direction: Schema.Literals([
      'Down',
      'Left',
      'Right',
      'Up',
      'NextContainer',
      'PreviousContainer',
    ]),
  },
  CompletedResolveKeyboardMove: {
    targetContainerId: Schema.String,
    targetIndex: Schema.Finite,
  },
  ConfirmedKeyboardDrop: {},
})
export type Message = typeof Message.Type

export const OutMessage = UiSchema.TaggedEnum({
  Reordered: {
    itemId: Schema.String,
    fromContainerId: Schema.String,
    fromIndex: Schema.Finite,
    toContainerId: Schema.String,
    toIndex: Schema.Finite,
  },
})
export type OutMessage = typeof OutMessage.Type

export const init = (): DragModel => ({ dragState: { _tag: 'Idle' } })

const reordered = (
  itemId: string,
  fromContainerId: string,
  fromIndex: number,
  target: DropTarget,
): OutMessage =>
  OutMessage.Reordered({
    itemId,
    fromContainerId,
    fromIndex,
    toContainerId: target.containerId,
    toIndex: target.index,
  })

export const update = (
  model: DragModel,
  message: Message,
): Readonly<{ model: DragModel; outMessage?: OutMessage }> => {
  const state = model.dragState
  switch (message._tag) {
    case 'PressedDraggable':
      return {
        model: {
          dragState: {
            _tag: 'Pending',
            itemId: message.itemId,
            containerId: message.containerId,
            index: message.index,
            screenX: message.screenX,
            screenY: message.screenY,
          },
        },
      }

    case 'MovedPointer': {
      if (state._tag !== 'Pending' && state._tag !== 'Dragging') return { model }
      return {
        model: {
          dragState: {
            _tag: 'Dragging',
            itemId: state.itemId,
            containerId: state.containerId,
            index: state.index,
            current: {
              screenX: message.screenX,
              screenY: message.screenY,
              clientX: message.clientX,
              clientY: message.clientY,
            },
            maybeDropTarget: message.maybeDropTarget,
          },
        },
      }
    }

    case 'ReleasedPointer': {
      if (state._tag !== 'Dragging') return { model: { dragState: { _tag: 'Idle' } } }
      const target = Option.getOrNull(state.maybeDropTarget)
      return {
        model: { dragState: { _tag: 'Idle' } },
        ...(target === null
          ? {}
          : { outMessage: reordered(state.itemId, state.containerId, state.index, target) }),
      }
    }

    case 'CancelledDrag':
      return { model: { dragState: { _tag: 'Idle' } } }

    case 'ActivatedKeyboardDrag':
      return {
        model: {
          dragState: {
            _tag: 'KeyboardDragging',
            itemId: message.itemId,
            containerId: message.containerId,
            index: message.index,
            targetContainerId: message.containerId,
            targetIndex: message.index,
          },
        },
      }

    case 'PressedArrowKey': {
      if (state._tag !== 'KeyboardDragging') return { model }
      const targetIndex =
        message.direction === 'Down'
          ? state.targetIndex + 1
          : message.direction === 'Up'
            ? Math.max(0, state.targetIndex - 1)
            : state.targetIndex
      return { model: { dragState: { ...state, targetIndex } } }
    }

    case 'CompletedResolveKeyboardMove':
      if (state._tag !== 'KeyboardDragging') return { model }
      return {
        model: {
          dragState: {
            ...state,
            targetContainerId: message.targetContainerId,
            targetIndex: message.targetIndex,
          },
        },
      }

    case 'ConfirmedKeyboardDrop':
      if (state._tag !== 'KeyboardDragging') return { model: { dragState: { _tag: 'Idle' } } }
      return {
        model: { dragState: { _tag: 'Idle' } },
        outMessage: reordered(state.itemId, state.containerId, state.index, {
          containerId: state.targetContainerId,
          index: state.targetIndex,
        }),
      }
  }
}
