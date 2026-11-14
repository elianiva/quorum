import { css, cx } from '@quorum/styled-system/css'
import { Select as FoldkitSelect } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { icon } from './icon'
import { ChevronDown } from 'lucide'

/** Stateless styled native `<select>` — use when every option is always
 *  visible and plain. For a searchable/filterable dropdown submodel, use
 *  `select` (Listbox-backed) instead. */

export const nativeSelectSizeKeys = ['default', 'sm'] as const
export type NativeSelectSize = (typeof nativeSelectSizeKeys)[number]

export const nativeSelectClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  '&::placeholder': { color: 'mutedForeground' },
  '&::selection': { backgroundColor: 'primary', color: 'primaryForeground' },
  _focusVisible: {
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
  },
  height: '2rem',
  width: '100%',
  minWidth: '0',
  appearance: 'none',
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  paddingBlock: '0.25rem',
  paddingRight: '2rem',
  paddingLeft: '0.625rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  transitionDuration: 'var(--default-transition-duration)',
  userSelect: 'none',
  '&[data-size="sm"]': {
    height: '1.75rem',
    borderRadius: 'min(var(--radius-md), 10px)',
    paddingBlock: '0.125rem',
  },
  '&[aria-disabled="true"], &[data-disabled]': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
  outlineStyle: 'none',
  '&:disabled': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
})

export const nativeSelectWrapperClass = css({
  '&:has(select[aria-disabled="true"])': { opacity: 0.5 },
  '&:has(select[data-disabled])': { opacity: 0.5 },
  position: 'relative',
  width: 'fit-content',
  '&:has(select:disabled)': { opacity: 0.5 },
})

export const nativeSelectIconClass = css({
  color: 'var(--muted-foreground)',
  top: '50%',
  right: '0.625rem',
  width: '1rem',
  height: '1rem',
  translate: '0 -50%',
  pointerEvents: 'none',
  position: 'absolute',
  userSelect: 'none',
})

export const nativeSelectOptionClass = css({
  backgroundColor: 'Canvas',
  color: 'CanvasText',
})

export const nativeSelectOptGroupClass = css({
  backgroundColor: 'Canvas',
  color: 'CanvasText',
})

export const nativeSelectLabelClass = css({
  paddingInline: '0.375rem',
  paddingBlock: '0.25rem',
  fontSize: 'calc(0.75rem * var(--type-scale))',
  lineHeight: 'calc(1 / 0.75)',
  color: 'var(--muted-foreground)',
})
export const nativeSelectDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'var(--muted-foreground)',
})
export const nativeSelectFieldWrapperClass = css({
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
  gap: '0.375rem',
})

export type NativeSelectConfig<M> = Readonly<{
  id: string
  label: string
  description?: string
  onChange?: (value: string) => M
  value?: string
  size?: NativeSelectSize
  isDisabled?: boolean
  isInvalid?: boolean
  isAutofocus?: boolean
  name?: string
  /** `<option>` elements — pass prebuilt markup, e.g.
   *  `cities.map((city) => h.option([], [city]))`. */
  options: ReadonlyArray<Html | string>
  className?: string
  labelClass?: string
  descriptionClass?: string
  wrapperClass?: string
}>

/** Styled native select with label, chevron and optional description, built
 *  on the @foldkit/ui Select helper. Mirrors the shadcn v4 `native-select.tsx`:
 *  an `appearance-none` select whose chevron overlays the control at its right
 *  edge. Pass `<option>` markup via `options`.
 *
 *  ```ts
 *  import { nativeSelect } from './native-select'
 *
 *  nativeSelect(
 *    {
 *      id: 'fruit',
 *      label: 'Fruit',
 *      onChange: (value) => Message.PickedFruit({ value }),
 *      options: fruits.map((fruit) => h.option([h.Value(fruit)], [fruit])),
 *    },
 *    h,
 *  )
 *  ``` */
export const nativeSelect = <M>(config: NativeSelectConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitSelect.view<M>(
    {
      id: config.id,
      hasDescription: config.description !== undefined,
      ...(config.onChange === undefined ? {} : { onChange: config.onChange }),
      ...(config.value === undefined ? {} : { value: config.value }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.isInvalid === undefined ? {} : { isInvalid: config.isInvalid }),
      ...(config.isAutofocus === undefined ? {} : { isAutofocus: config.isAutofocus }),
      ...(config.name === undefined ? {} : { name: config.name }),
      toView: (attributes) =>
        h.div(
          [h.Class(cx(nativeSelectFieldWrapperClass, config.wrapperClass))],
          [
            h.label(
              [...attributes.label, h.Class(cx(nativeSelectLabelClass, config.labelClass))],
              [config.label],
            ),
            h.div(
              [
                h.Class(cx(nativeSelectWrapperClass)),
                h.DataAttribute('slot', 'native-select-wrapper'),
                h.DataAttribute('size', config.size ?? 'default'),
              ],
              [
                h.select(
                  [
                    ...attributes.select,
                    h.DataAttribute('slot', 'native-select'),
                    h.DataAttribute('size', config.size ?? 'default'),
                    h.Class(cx(nativeSelectClass, config.className)),
                  ],
                  config.options,
                ),
                h.span(
                  [
                    h.DataAttribute('slot', 'native-select-icon'),
                    h.Class(nativeSelectIconClass),
                    h.AriaHidden(true),
                  ],
                  [nativeSelectChevron(h)],
                ),
              ],
            ),
            config.description === undefined
              ? h.empty
              : h.span(
                  [
                    ...attributes.description,
                    h.Class(cx(nativeSelectDescriptionClass, config.descriptionClass)),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  )

export const nativeSelectChevron = <M>(h: HtmlBuilder<M>): Html =>
  icon(
    h,
    ChevronDown,
    css({
      width: '1rem',
      height: '1rem',
    }),
  )

/** Helper to render an `<option>` with correct data-slot and Canvas colors. */
export const nativeSelectOption = <M>(
  config: Readonly<{ value: string; label: string; isDisabled?: boolean; className?: string }>,
  h: HtmlBuilder<M>,
): Html =>
  h.option(
    [
      h.Value(config.value),
      h.DataAttribute('slot', 'native-select-option'),
      h.Class(cx(nativeSelectOptionClass, config.className)),
      ...(config.isDisabled === true ? [h.Disabled(true)] : []),
    ],
    [config.label],
  )

/** Helper to render an `<optgroup>` with correct data-slot and Canvas colors. */
export const nativeSelectOptGroup = <M>(
  config: Readonly<{ label: string; className?: string }>,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<M>,
): Html =>
  h.optgroup(
    [
      h.DataAttribute('slot', 'native-select-optgroup'),
      h.Class(cx(nativeSelectOptGroupClass, config.className)),
      h.Attribute('label', config.label),
    ],
    [...children],
  )
