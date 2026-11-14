import { css, cx } from '@quorum/styled-system/css'
import { Textarea as FoldkitTextarea } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

export const textareaClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  borderRadius: 'lg',
  borderWidth: '1px',
  paddingInline: '2.5',
  paddingBlock: '2',
  fontSize: 'calc(1rem * var(--type-scale))',
  lineHeight: 'calc(1.5 / 1)',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'default',
  display: 'flex',
  minHeight: '16',
  width: '100%',
  outlineStyle: 'none',
  '&::placeholder': { color: 'mutedForeground' },
  '&:focus-visible': {
    borderColor: 'ring',
    boxShadow: 'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
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
    cursor: 'not-allowed',
    opacity: 0.5,
    backgroundColor: 'color-mix(in oklab, var(--input) 50%, transparent)',
  },
  '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
  md: { fontSize: 'calc(0.875rem * var(--type-scale))', lineHeight: 'calc(1.25 / 0.875)' },
  fieldSizing: 'content',
})

/** Same string as the `label` item's component classes (upstream label.tsx). */
/** Upstream string re-keyed for foldkit: the label precedes the control, so
 *  upstream's native peer-disabled sibling variant can never match; disabled
 *  state flows from the wrapper (group-field + data-disabled, mirroring
 *  switch.ts). */
export const textareaLabelClass = css({
  gap: '2',
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

export const textareaDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'mutedForeground',
})

export const textareaWrapperClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1.5',
  width: '100%',
})

export type TextareaConfig<M> = Readonly<{
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
  rows?: number
  placeholder?: string
  className?: string
  labelClass?: string
  descriptionClass?: string
  wrapperClass?: string
}>

/** Styled textarea with label and optional description, built on the
 *  @foldkit/ui Textarea helper. */
export const textarea = <M>(config: TextareaConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitTextarea.view<M>(
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
      ...(config.rows === undefined ? {} : { rows: config.rows }),
      ...(config.placeholder === undefined ? {} : { placeholder: config.placeholder }),
      toView: (attributes) =>
        h.div(
          [
            h.Class(cx(textareaWrapperClass, config.wrapperClass)),
            ...(config.isDisabled ? [h.DataAttribute('disabled', '')] : []),
          ],
          [
            h.label(
              [
                ...attributes.label,
                h.DataAttribute('slot', 'label'),
                h.Class(cx(textareaLabelClass, config.labelClass)),
              ],
              [config.label],
            ),
            h.textarea([
              ...attributes.textarea,
              h.DataAttribute('slot', 'textarea'),
              h.Class(cx(textareaClass, config.className)),
            ]),
            config.description === undefined
              ? h.empty
              : h.span(
                  [
                    ...attributes.description,
                    h.Class(cx(textareaDescriptionClass, config.descriptionClass)),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  )
