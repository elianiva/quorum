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
      boxShadow: 'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
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
    height: '2rem',
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'var(--default-transition-timing-function)',
    transitionDuration: 'var(--default-transition-duration)',
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
      '& > input': { paddingTop: '0.75rem' },
    },
    '&:has(> [data-align="block-start"])': {
      height: 'auto',
      flexDirection: 'column',
      '& > input': { paddingBottom: '0.75rem' },
    },
    '&:has(> [data-align="inline-end"])': {
      '& > input': { paddingRight: '0.375rem' },
    },
    '&:has(> [data-align="inline-start"])': {
      '& > input': { paddingLeft: '0.375rem' },
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
  color: 'var(--muted-foreground)',
  height: 'auto',
  gap: '0.5rem',
  paddingBlock: '0.375rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  '.group-input-group[data-disabled] &': {
    opacity: 0.5,
  },
  '& > kbd': {
    borderRadius: 'calc(var(--radius) - 5px)',
  },
  '& > svg:not([data-svg-icon])': {
    width: '1rem',
    height: '1rem',
  },
  display: 'flex',
  cursor: 'text',
  alignItems: 'center',
  justifyContent: 'center',
  userSelect: 'none',
})

export const inputGroupAddonAlignClasses = {
  'inline-start': css({
    paddingLeft: '0.5rem',
    '&:has(> button)': { marginLeft: '-0.3rem' },
    '&:has(> kbd)': { marginLeft: '-0.15rem' },
    order: '-9999',
  }),
  'inline-end': css({
    paddingRight: '0.5rem',
    '&:has(> button)': { marginRight: '-0.3rem' },
    '&:has(> kbd)': { marginRight: '-0.15rem' },
    order: '9999',
  }),
  'block-start': css({
    paddingInline: '0.625rem',
    paddingTop: '0.5rem',
    '.group-input-group:has(> input) &': { paddingTop: '0.5rem' },
    '&[data-border="b"]': { paddingBottom: '0.5rem' },
    order: '-9999',
    width: '100%',
    justifyContent: 'flex-start',
  }),
  'block-end': css({
    paddingInline: '0.625rem',
    paddingBottom: '0.5rem',
    '.group-input-group:has(> input) &': { paddingBottom: '0.5rem' },
    '&[data-border="t"]': { paddingTop: '0.5rem' },
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
  gap: '0.5rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  display: 'flex',
  alignItems: 'center',
  boxShadow: 'none',
})

/** Upstream InputGroupButton size tokens; keyed like upstream's cva variants. */
export const inputGroupButtonSizeClasses = {
  xs: css({
    height: '1.5rem',
    gap: '0.25rem',
    borderRadius: 'calc(var(--radius) - 3px)',
    paddingInline: '0.375rem',
    '& > svg:not([data-svg-icon])': {
      width: '0.875rem',
      height: '0.875rem',
    },
  }),
  sm: css({
    gap: '0.25rem',
  }),
  'icon-xs': css({
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: 'calc(var(--radius) - 3px)',
    padding: '0',
    '&:has(> svg)': {
      padding: '0',
    },
  }),
  'icon-sm': css({
    width: '2rem',
    height: '2rem',
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
  paddingBlock: '0.5rem',
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
  color: 'var(--muted-foreground)',
  gap: '0.5rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  '& svg:not([data-svg-icon])': {
    width: '1rem',
    height: '1rem',
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
