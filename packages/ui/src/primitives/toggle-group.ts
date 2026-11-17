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

export const Model = S.Struct({
  id: S.String,
  type: Type,
  value: S.Array(S.String),
})
export type Model = typeof Model.Type

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

export const reflect: Reflect<Model, ReadonlyArray<string>> = Function.dual(
  2,
  (model: Model, value: ReadonlyArray<string>): Model =>
    modifyFields(model, { value: () => [...value] }),
)

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

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

export type ViewInputs = Readonly<{
  items: ReadonlyArray<ToggleGroupItem>
  variant?: ToggleVariant
  size?: ToggleSize
  isDisabled?: boolean
  spacing?: number
  orientation?: ToggleGroupOrientation
  ariaLabel?: string
  className?: string
}>

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
