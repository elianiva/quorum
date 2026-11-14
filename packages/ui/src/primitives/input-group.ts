import { css, cx } from '@quorum/styled-system/css'
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html'

import { button, type ButtonConfig } from './button'
import { inputClass } from './input'
import { textareaClass } from './textarea'

type Child = Html | string

// InputGroup draws a shared bordered box and lets you slot text/icon add-ons
// around a connected input. The inner control carries
// data-slot="input-group-control" so the group token's focus/invalid/disabled
// frame states key off it.

export const inputGroupClass = cx(
  css({
    backgroundColor: 'well',
    boxShadow: 'well',
    borderColor: 'transparent',
    '&:has([data-slot="input-group-control"]:focus-visible)': {
      borderColor: 'ring',
      boxShadow: 'focusWell',
    },
    '&:has([data-slot][aria-invalid="true"])': {
      borderColor: 'destructive',
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&:has([data-slot][aria-invalid="true"])': {
        boxShadow:
          'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
    height: '8',
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'default',
    transitionDuration: 'fast',
    '[data-slot="combobox-content"] &': {
      _focusWithin: {
        borderColor: 'inherit',
        boxShadow: 'none',
      },
    },
    '&:has(:disabled)': { opacity: 0.5 },
    '&:has(> [data-align="block-end"])': {
      height: 'auto',
      flexDirection: 'column',
      '& > input': { paddingTop: '3' },
    },
    '&:has(> [data-align="block-start"])': {
      height: 'auto',
      flexDirection: 'column',
      '& > input': { paddingBottom: '3' },
    },
    '&:has(> [data-align="inline-end"])': {
      '& > input': { paddingRight: '1.5' },
    },
    '&:has(> [data-align="inline-start"])': {
      '& > input': { paddingLeft: '1.5' },
    },
    position: 'relative',
    display: 'flex',
    width: '100%',
    minWidth: '0',
    alignItems: 'center',
    outlineStyle: 'none',
    '&:has(> textarea)': { height: 'auto' },
  }),
  'group-input-group',
)

/** Upstream InputGroupAddon base string; alignment via the align tokens. */
export const inputGroupAddonClass = css({
  color: 'mutedForeground',
  height: 'auto',
  gap: '2',
  paddingBlock: '1.5',
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontWeight: 'medium',
  '.group-input-group[data-disabled] &': {
    opacity: 0.5,
  },
  '& > kbd': {
    borderRadius: 'sm',
  },
  '& > svg:not([data-svg-icon])': {
    width: '4',
    height: '4',
  },
  display: 'flex',
  cursor: 'text',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

export const inputGroupAddonAlignClasses = {
  'inline-start': css({
    paddingLeft: '2',
    '&:has(> button)': { marginLeft: '-0.3rem' },
    '&:has(> kbd)': { marginLeft: '-0.15rem' },
    order: '-9999',
  }),
  'inline-end': css({
    paddingRight: '2',
    '&:has(> button)': { marginRight: '-0.3rem' },
    '&:has(> kbd)': { marginRight: '-0.15rem' },
    order: '9999',
  }),
  'block-start': css({
    paddingInline: '2.5',
    paddingTop: '2',
    '.group-input-group:has(> input) &': { paddingTop: '2' },
    '&[data-border="b"]': { paddingBottom: '2' },
    order: '-9999',
    width: '100%',
    justifyContent: 'flex-start',
  }),
  'block-end': css({
    paddingInline: '2.5',
    paddingBottom: '2',
    '.group-input-group:has(> input) &': { paddingBottom: '2' },
    '&[data-border="t"]': { paddingTop: '2' },
    order: '9999',
    width: '100%',
    justifyContent: 'flex-start',
  }),
} as const

export type InputGroupAddonAlign = keyof typeof inputGroupAddonAlignClasses

export const inputGroupButtonSizeKeys = ['xs', 'sm', 'icon-xs', 'icon-sm'] as const
export type InputGroupButtonSize = (typeof inputGroupButtonSizeKeys)[number]

/** Upstream InputGroupButton base string (sizes are tokens). */
export const inputGroupButtonClass = css({
  gap: '2',
  fontSize: 'type.14',
  lineHeight: 'fine',
  display: 'flex',
  alignItems: 'center',
  boxShadow: 'none',
})

/** Upstream InputGroupButton size tokens; keyed like upstream's cva variants. */
export const inputGroupButtonSizeClasses = {
  xs: css({
    height: '6',
    gap: '1',
    borderRadius: 'sm',
    paddingInline: '1.5',
    '& > svg:not([data-svg-icon])': {
      width: '3.5',
      height: '3.5',
    },
  }),
  sm: css({
    gap: '1',
  }),
  'icon-xs': css({
    width: '6',
    height: '6',
    borderRadius: 'sm',
    padding: '0',
    '&:has(> svg)': {
      padding: '0',
    },
  }),
  'icon-sm': css({
    width: '8',
    height: '8',
    padding: '0',
    '&:has(> svg)': {
      padding: '0',
    },
  }),
} as const

export type InputGroupTextareaConfig<M> = Readonly<{
  id: string
  value?: string
  onInput?: (value: string) => M
  isDisabled?: boolean
  isReadOnly?: boolean
  isInvalid?: boolean
  placeholder?: string
  name?: string
  rows?: number
  className?: string
}>

export const inputGroupTextareaClass = css({
  borderRadius: '0',
  borderWidth: '0',
  backgroundColor: 'transparent',
  paddingBlock: '2',
  boxShadow: 'none',
  _focusVisible: { boxShadow: 'none' },
  '&:disabled': { backgroundColor: 'transparent' },
  '&[aria-invalid="true"]': { boxShadow: 'none' },
  _dark: {
    backgroundColor: 'transparent',
    '&:disabled': { backgroundColor: 'transparent' },
  },
  flex: '1 1 0%',
  resize: 'none',
})

export const inputGroupTextClass = css({
  color: 'mutedForeground',
  gap: '2',
  fontSize: 'type.14',
  lineHeight: 'fine',
  '& svg:not([data-svg-icon])': {
    width: '4',
    height: '4',
  },
  display: 'flex',
  alignItems: 'center',
  '& svg': {
    pointerEvents: 'none',
  },
})

export const inputGroupInputClass = css({
  borderRadius: '0',
  borderWidth: '0',
  backgroundColor: 'transparent',
  boxShadow: 'none',
  _focusVisible: { boxShadow: 'none' },
  '&:disabled': { backgroundColor: 'transparent' },
  '&[aria-invalid="true"]': { boxShadow: 'none' },
  _dark: {
    backgroundColor: 'transparent',
    '&:disabled': { backgroundColor: 'transparent' },
  },
  flex: '1 1 0%',
})

/** The connected textarea for use inside `inputGroup`. Emits
 *  data-slot="input-group-control" so the group frame reacts to it. */
export const inputGroupTextarea = <M>(
  config: InputGroupTextareaConfig<M>,
  h: HtmlBuilder<M>,
): Html =>
  h.textarea([
    h.Id(config.id),
    ...(config.onInput === undefined ? [] : [h.OnInput(config.onInput)]),
    ...(config.value === undefined ? [] : [h.Value(config.value)]),
    ...(config.isDisabled === true ? [h.Disabled(true), h.DataAttribute('disabled', '')] : []),
    ...(config.isReadOnly === true ? [h.Attribute('readonly', 'true')] : []),
    ...(config.isInvalid === true ? [h.AriaInvalid(true), h.DataAttribute('invalid', '')] : []),
    ...(config.name === undefined ? [] : [h.Name(config.name)]),
    ...(config.rows === undefined ? [] : [h.Rows(config.rows)]),
    ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
    h.DataAttribute('slot', 'input-group-control'),
    h.Class(cx(textareaClass, inputGroupTextareaClass, config.className)),
  ])

export type InputGroupInputConfig<M> = Readonly<{
  id: string
  ariaLabel?: string
  value?: string
  onInput?: (value: string) => M
  isDisabled?: boolean
  isReadOnly?: boolean
  isInvalid?: boolean
  placeholder?: string
  name?: string
  type?: string
  className?: string
  /** Extra attributes merged onto the input element. */
  attributes?: ReadonlyArray<Attribute<M>>
}>

/** The connected input for use inside `inputGroup`. Emits
 *  data-slot="input-group-control" so the group frame reacts to it. */
export const inputGroupInput = <M>(config: InputGroupInputConfig<M>, h: HtmlBuilder<M>): Html =>
  h.input([
    h.Id(config.id),
    ...(config.ariaLabel === undefined ? [] : [h.AriaLabel(config.ariaLabel)]),
    ...(config.onInput === undefined ? [] : [h.OnInput(config.onInput)]),
    ...(config.value === undefined ? [] : [h.Value(config.value)]),
    ...(config.isDisabled === true ? [h.Disabled(true), h.DataAttribute('disabled', '')] : []),
    ...(config.isReadOnly === true ? [h.Attribute('readonly', 'true')] : []),
    ...(config.isInvalid === true ? [h.AriaInvalid(true), h.DataAttribute('invalid', '')] : []),
    ...(config.name === undefined ? [] : [h.Name(config.name)]),
    ...(config.type === undefined ? [] : [h.Type(config.type)]),
    ...(config.placeholder === undefined ? [] : [h.Placeholder(config.placeholder)]),
    h.DataAttribute('slot', 'input-group-control'),
    h.Class(cx(inputClass, inputGroupInputClass, config.className)),
    ...(config.attributes ?? []),
  ])

export type InputGroupButtonConfig<M> = Omit<ButtonConfig<M>, 'size'> &
  Readonly<{
    size?: InputGroupButtonSize
  }>

/** A `button` styled to sit inside an `inputGroup` — ghost by default,
 *  sized by the group tokens (upstream keeps the underlying Button on its own
 *  default size and layers the group size token over it). */
export const inputGroupButton = <M>(
  config: InputGroupButtonConfig<M>,
  label: Html | string,
  h: HtmlBuilder<M>,
): Html => {
  const size = config.size ?? 'xs'
  const { size: _groupSize, ...buttonConfig } = config
  return button<M>(
    {
      ...buttonConfig,
      variant: config.variant ?? 'ghost',
      className: cx(inputGroupButtonClass, inputGroupButtonSizeClasses[size], config.className),
      attributes: [h.DataAttribute('size', size), ...(config.attributes ?? [])],
    },
    label,
    h,
  )
}

type StyleConfig = Readonly<{ className?: string }>

type AddonConfig = StyleConfig & Readonly<{ align?: InputGroupAddonAlign }>

/** Add-on (text or icon) for either side of the group. Clicking the addon
 *  focuses the contained input (unless the click target is a button), matching
 *  upstream InputGroupAddon's onClick delegation. */
export const inputGroupAddon = <M>(
  config: AddonConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const align = config.align ?? 'inline-start'
  return h.div(
    [
      h.Role('group'),
      h.DataAttribute('slot', 'input-group-addon'),
      h.DataAttribute('align', align),
      h.Class(cx(inputGroupAddonClass, inputGroupAddonAlignClasses[align], config.className)),
      h.Attribute(
        'onclick',
        "if(!event.target.closest('button'))this.parentElement?.querySelector('input')?.focus()",
      ),
    ],
    children,
  )
}

/** Alias kept for backward compatibility — an inline-start text addon.
 *  Upstream renders a `span` with NO data-slot (foldcn previously added
 *  an extra slot; removed to match upstream). */
export const inputGroupText = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => h.span([h.Class(cx(inputGroupTextClass, config.className))], children)

/** Segmented container — pass addons / controls as children. */
export const inputGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Role('group'),
      h.Class(cx(inputGroupClass, config.className)),
      h.DataAttribute('slot', 'input-group'),
    ],
    children,
  )
