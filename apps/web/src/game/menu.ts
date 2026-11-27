import { UiSchema } from '@effect/ui'
import { Option, Schema } from 'effect'

export const MenuModel = Schema.Struct({
  id: Schema.String,
  isOpen: Schema.Boolean,
  maybeActiveItemIndex: Schema.Option(Schema.Finite),
  activationTrigger: Schema.Literals(['Pointer', 'Keyboard']),
  searchQuery: Schema.String,
  maybeLastPointerPosition: Schema.Option(
    Schema.Struct({ screenX: Schema.Finite, screenY: Schema.Finite }),
  ),
  maybePointerOrigin: Schema.Option(
    Schema.Struct({ screenX: Schema.Finite, screenY: Schema.Finite, timeStamp: Schema.Finite }),
  ),
})
export type MenuModel = typeof MenuModel.Type

export const Message = UiSchema.TaggedEnum({
  Opened: { maybeActiveItemIndex: Schema.Option(Schema.Finite) },
  Closed: {},
  BlurredItems: {},
  ActivatedItem: {
    index: Schema.Finite,
    activationTrigger: Schema.Literals(['Pointer', 'Keyboard']),
  },
  DeactivatedItem: {},
  SelectedItem: { index: Schema.Finite, item: Schema.String },
  RequestedItemClick: { index: Schema.Finite },
  Searched: { key: Schema.String, maybeTargetIndex: Schema.Option(Schema.Finite) },
  MovedPointerOverItem: { index: Schema.Finite, screenX: Schema.Finite, screenY: Schema.Finite },
  ClickedButton: {},
  ReleasedPointerOnItems: {
    screenX: Schema.Finite,
    screenY: Schema.Finite,
    timeStamp: Schema.Finite,
  },
  SuppressedSpaceScroll: {},
})
export type Message = typeof Message.Type

export const OutMessage = UiSchema.TaggedEnum({
  Selected: { value: Schema.String, index: Schema.Finite },
})
export type OutMessage = typeof OutMessage.Type

export const init = (id: string): MenuModel => ({
  id,
  isOpen: false,
  maybeActiveItemIndex: Option.none(),
  activationTrigger: 'Keyboard',
  searchQuery: '',
  maybeLastPointerPosition: Option.none(),
  maybePointerOrigin: Option.none(),
})

const closed = (model: MenuModel): MenuModel => ({
  ...model,
  isOpen: false,
  maybeActiveItemIndex: Option.none(),
  searchQuery: '',
  maybeLastPointerPosition: Option.none(),
  maybePointerOrigin: Option.none(),
})

const opened = (model: MenuModel, maybeActiveItemIndex: Option.Option<number>): MenuModel => ({
  ...model,
  isOpen: true,
  maybeActiveItemIndex,
  activationTrigger: Option.isSome(maybeActiveItemIndex) ? 'Keyboard' : 'Pointer',
  searchQuery: '',
  maybeLastPointerPosition: Option.none(),
  maybePointerOrigin: Option.none(),
})

export const update = (
  model: MenuModel,
  message: Message,
): Readonly<{ model: MenuModel; outMessage?: OutMessage }> => {
  switch (message._tag) {
    case 'Opened':
      return { model: model.isOpen ? model : opened(model, message.maybeActiveItemIndex) }

    case 'Closed':
    case 'BlurredItems':
      return { model: closed(model) }

    case 'ActivatedItem':
      return {
        model: {
          ...model,
          maybeActiveItemIndex: Option.some(message.index),
          activationTrigger: message.activationTrigger,
        },
      }

    case 'DeactivatedItem':
      return model.activationTrigger === 'Pointer'
        ? { model: { ...model, maybeActiveItemIndex: Option.none() } }
        : { model }

    case 'SelectedItem':
      return {
        model: closed(model),
        outMessage: OutMessage.Selected({ value: message.item, index: message.index }),
      }

    case 'RequestedItemClick':
      return { model }

    case 'Searched':
      return {
        model: {
          ...model,
          searchQuery: model.searchQuery + message.key,
          maybeActiveItemIndex: Option.orElse(
            message.maybeTargetIndex,
            () => model.maybeActiveItemIndex,
          ),
        },
      }

    case 'MovedPointerOverItem': {
      const samePosition = Option.exists(
        model.maybeLastPointerPosition,
        (position) => position.screenX === message.screenX && position.screenY === message.screenY,
      )
      return samePosition
        ? { model }
        : {
            model: {
              ...model,
              maybeActiveItemIndex: Option.some(message.index),
              activationTrigger: 'Pointer',
              maybeLastPointerPosition: Option.some({
                screenX: message.screenX,
                screenY: message.screenY,
              }),
            },
          }
    }

    case 'ClickedButton':
      return { model: model.isOpen ? closed(model) : opened(model, Option.none()) }

    case 'ReleasedPointerOnItems':
    case 'SuppressedSpaceScroll':
      return { model }
  }
}
