import { css, cx as cn } from '@quorum/styled-system/css'
import { Input as FoldkitInput } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

export const inputClass = css({
  backgroundColor: 'var(--well)',
  boxShadow: 'well',
  borderColor: 'transparent',
  height: '2rem',
  borderRadius: 'lg',
  borderWidth: '1px',
  paddingInline: '0.625rem',
  paddingBlock: '0.25rem',
  fontSize: 'calc(1rem * var(--type-scale))',
  lineHeight: 'calc(1.5 / 1)',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  transitionDuration: 'var(--default-transition-duration)',
  width: '100%',
  minWidth: '0',
  outlineStyle: 'none',
  '&::file-selector-button': {
    height: '1.5rem',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    fontWeight: '500',
    display: 'inline-flex',
    borderWidth: '0',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '&::placeholder': { color: 'var(--muted-foreground)' },
  '&:focus-visible': {
    borderColor: 'var(--ring)',
    boxShadow: 'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'var(--destructive)',
    boxShadow:
      'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
    '&[aria-disabled="true"], &[data-disabled]': {
      backgroundColor: 'color-mix(in oklab, var(--input) 80%, transparent)',
    },
  },
  '&[aria-disabled="true"], &[data-disabled]': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
    backgroundColor: 'color-mix(in oklab, var(--input) 50%, transparent)',
  },
  '&:disabled': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
  md: { fontSize: 'calc(0.875rem * var(--type-scale))', lineHeight: 'calc(1.25 / 0.875)' },
})

/** Same string as the `label` item's component classes (upstream label.tsx). */
/** Upstream string re-keyed for foldkit: the label precedes the control, so
 *  upstream's native peer-disabled sibling variant can never match; disabled
 *  state flows from the wrapper (group-field + data-disabled, mirroring
 *  switch.ts). */
export const inputLabelClass = css({
  gap: '0.5rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  '[data-disabled] &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
    opacity: 0.5,
  },
})

export const inputDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'var(--muted-foreground)',
})

export const inputWrapperClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
  width: '100%',
})

export type InputConfig<M> = Readonly<{
  id: string
  label: string
  description?: string
  onInput?: (value: string) => M
  value?: string
  isDisabled?: boolean
  isReadOnly?: boolean
  isInvalid?: boolean
  isAutofocus?: boolean
  name?: string
  type?: string
  placeholder?: string
  className?: string
  labelClass?: string
  descriptionClass?: string
  wrapperClass?: string
}>

/** Styled text input with label and optional description, built on the
 *  @foldkit/ui Input helper. */
export const input = <M>(config: InputConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitInput.view<M>(
    {
      id: config.id,
      hasDescription: config.description !== undefined,
      ...(config.onInput === undefined ? {} : { onInput: config.onInput }),
      ...(config.value === undefined ? {} : { value: config.value }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
      ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
      ...(config.isAutofocus === undefined ? {} : { isAutofocus: config.isAutofocus }),
      ...(config.name === undefined ? {} : { name: config.name }),
      ...(config.type === undefined ? {} : { type: config.type }),
      ...(config.placeholder === undefined ? {} : { placeholder: config.placeholder }),
      toView: (attributes) =>
        h.div(
          [
            h.Class(cn(inputWrapperClass, config.wrapperClass)),
            ...(config.isDisabled ? [h.DataAttribute('disabled', '')] : []),
          ],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute('slot', 'label'),
                h.Class(cn(inputLabelClass, config.labelClass)),
              ],
              [config.label],
            ),
            h.input([
              ...attributes.input,
              h.DataAttribute('slot', 'input'),
              h.Class(cn(inputClass, config.className)),
            ]),
            config.description === undefined
              ? h.empty
              : h.span(
                  [
                    ...attributes.description,
                    h.Class(cn(inputDescriptionClass, config.descriptionClass)),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  )
