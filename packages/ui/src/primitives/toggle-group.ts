import { css, cx } from '@quorum/styled-system/css'
import { Function, Schema as S, Match } from 'effect'
import { defineMessageUnion } from 'foldkit/message'
import type { Reflect } from 'foldkit/submodel'
import { defineView } from 'foldkit/submodel'
import { modifyFields } from 'foldkit/struct'
import * as Update from 'foldkit/update'

import { icon } from './icon'
import {
  toggleBase,
  toggleSizes,
  toggleVariants,
  type ToggleSize,
  type ToggleVariant,
} from './toggle'

type IconNode = Parameters<typeof icon>[1]

// ToggleGroup is a set of toggles that share a single (or multiple) selection.
// It owns the selection as a Submodel: embed it with `h.submodel` and listen
// for `ChangedValue` to lift selection changes into your own model. Conform an
// externally-driven selection with `reflect`.
//
// Upstream renders a loose flex row joined only when spacing is 0; foldcn
// keeps the same model via the `spacing` config (default 2, matching
// upstream). Item defaults follow upstream: variant "default", size
// "default".

export const toggleGroupClass = cx(
  css({
    borderRadius: 'lg',
    '&[data-size="sm"]': { borderRadius: 'md' },
    display: 'flex',
    width: 'fit-content',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'calc(var(--spacing) * var(--gap))',
    '&[data-vertical]': { flexDirection: 'column', alignItems: 'stretch' },
  }),
  'group-toggle-group',
)

/** Upstream item string (joined-strip rules apply only at spacing 0). */
export const toggleGroupItemClass = css({
  '&[data-spacing="0"]': {
    borderRadius: '0',
    paddingInline: '2',
    '&:has([data-icon="inline-end"])': { paddingRight: '1.5' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '1.5' },
  },
  '.group-toggle-group[data-horizontal] &': {
    '&[data-spacing="0"]:first-child': {
      borderTopLeftRadius: 'lg',
      borderBottomLeftRadius: 'lg',
    },
    '&[data-spacing="0"]:last-child': {
      borderTopRightRadius: 'lg',
      borderBottomRightRadius: 'lg',
    },
    '&[data-spacing="0"][data-variant="outline"]': { borderLeftWidth: '0' },
    '&[data-spacing="0"][data-variant="outline"]:first-child': { borderLeftWidth: '1px' },
  },
  '.group-toggle-group[data-vertical] &': {
    '&[data-spacing="0"]:first-child': {
      borderTopLeftRadius: 'lg',
      borderTopRightRadius: 'lg',
    },
    '&[data-spacing="0"]:last-child': {
      borderBottomLeftRadius: 'lg',
      borderBottomRightRadius: 'lg',
    },
    '&[data-spacing="0"][data-variant="outline"]': { borderTopWidth: '0' },
    '&[data-spacing="0"][data-variant="outline"]:first-child': { borderTopWidth: '1px' },
  },
  flexShrink: '0',
  _focus: { zIndex: '10' },
  _focusVisible: { zIndex: '10' },
})

export const Type = S.Literals(['single', 'multiple'])
export type ToggleGroupType = typeof Type.Type

export type ToggleGroupOrientation = 'horizontal' | 'vertical'

export type ToggleGroupItem = Readonly<{
  value: string
  label: string
  icon?: IconNode
  ariaLabel?: string
}>

// MODEL

export const Model = S.Struct({
  id: S.String,
  type: Type,
  value: S.Array(S.String),
})
export type Model = typeof Model.Type

// MESSAGES

/** The user clicked one of the toggles. Flips that item's membership in the
 *  selection — replacing it entirely when `type` is `single`. */
export const Message = defineMessageUnion({
  ToggledItem: { value: S.String },
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  ChangedValue: { value: S.Array(S.String) },
})
export type OutMessage = typeof OutMessage.Type

const nextValue = (
  current: ReadonlyArray<string>,
  value: string,
  type: ToggleGroupType,
): ReadonlyArray<string> => {
  const isSelected = current.includes(value)
  if (type === 'single') return isSelected ? [] : [value]
  return isSelected ? current.filter((v) => v !== value) : [...current, value]
}

// INIT / UPDATE

export type InitConfig = Readonly<{
  id: string
  type?: ToggleGroupType
  value?: ReadonlyArray<string>
}>

export const init = (config: InitConfig): Model => ({
  id: config.id,
  type: config.type ?? 'single',
  value: config.value === undefined ? [] : [...config.value],
})

/** Conforms an externally-driven selection onto the model without emitting an
 *  OutMessage (the world is the source of truth). */
export const reflect: Reflect<Model, ReadonlyArray<string>> = Function.dual(
  2,
  (model: Model, value: ReadonlyArray<string>): Model =>
    modifyFields(model, { value: () => [...value] }),
)

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

/** Processes a toggle group message and returns the next model, commands, and
 *  an optional out-message for the parent. */
export const update = (model: Model, message: Message): UpdateReturn => {
  return Match.value(message).pipe(
    Match.tagsExhaustive({
      ToggledItem: (message) => {
        const value = nextValue(model.value, message.value, model.type)
        return {
          model: modifyFields(model, { value: () => [...value] }),
          outMessage: OutMessage.ChangedValue({ value }),
        }
      },
    }),
  )
}

// VIEW

export type ViewInputs = Readonly<{
  items: ReadonlyArray<ToggleGroupItem>
  variant?: ToggleVariant
  size?: ToggleSize
  isDisabled?: boolean
  /** Gap between items in spacing units. `0` joins items into a strip.
   *  Defaults to 2 like upstream. */
  spacing?: number
  orientation?: ToggleGroupOrientation
  ariaLabel?: string
  className?: string
}>

/** Renders the group of toggles sharing the submodel's selection. Embedded
 *  via `h.submodel`. */
export const view = defineView<Model, Message, ViewInputs>((model, viewInputs, h) => {
  const spacing = viewInputs.spacing ?? 2
  const orientation = viewInputs.orientation ?? 'horizontal'
  return h.div(
    [
      ...(viewInputs.ariaLabel === undefined ? [] : [h.AriaLabel(viewInputs.ariaLabel)]),
      h.Role('group'),
      h.Class(cx(toggleGroupClass, viewInputs.className)),
      h.DataAttribute('slot', 'toggle-group'),
      h.DataAttribute('orientation', orientation),
      h.DataAttribute('spacing', String(spacing)),
      h.DataAttribute('variant', viewInputs.variant ?? 'default'),
      h.DataAttribute('size', viewInputs.size ?? 'default'),
      ...(orientation === 'vertical'
        ? [h.DataAttribute('vertical', '')]
        : [h.DataAttribute('horizontal', '')]),
      h.Style({ '--gap': String(spacing) }),
    ],
    viewInputs.items.map((item) =>
      h.button(
        [
          h.Type('button'),
          ...(item.ariaLabel === undefined ? [] : [h.AriaLabel(item.ariaLabel)]),
          ...(viewInputs.isDisabled === true ? [h.Disabled(true)] : []),
          h.OnClick(Message.ToggledItem({ value: item.value })),
          h.DataAttribute('slot', 'toggle-group-item'),
          h.DataAttribute('variant', viewInputs.variant ?? 'default'),
          h.DataAttribute('size', viewInputs.size ?? 'default'),
          h.DataAttribute('spacing', String(spacing)),
          h.DataAttribute('state', model.value.includes(item.value) ? 'on' : 'off'),
          h.AriaPressed(model.value.includes(item.value) ? 'true' : 'false'),
          h.Class(
            cx(
              toggleBase,
              toggleVariants[viewInputs.variant ?? 'default'],
              toggleSizes[viewInputs.size ?? 'default'],
              toggleGroupItemClass,
            ),
          ),
        ],
        [item.icon === undefined ? item.label : h.span([], [icon(h, item.icon), item.label])],
      ),
    ),
  )
})
