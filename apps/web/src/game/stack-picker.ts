import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

export const StackPicker = Schema.Struct({
  query: Schema.String,
  active: Schema.Finite,
})
export type StackPicker = typeof StackPicker.Type

export const StackPickerMessage = defineMessageUnion({
  Searched: { query: Schema.String },
  Moved: { delta: Schema.Finite, count: Schema.Finite },
})
export type StackPickerMessage = typeof StackPickerMessage.Type

export const initStackPicker = (): StackPicker => ({ query: '', active: -1 })

export const updateStackPicker = (picker: StackPicker, message: StackPickerMessage): StackPicker =>
  StackPickerMessage.match<StackPicker>(message, {
    Searched: ({ query }) => ({ query, active: -1 }),
    Moved: ({ delta, count }) => ({
      ...picker,
      active:
        count === 0
          ? -1
          : picker.active < 0
            ? delta > 0
              ? 0
              : count - 1
            : (picker.active + delta + count) % count,
    }),
  })
