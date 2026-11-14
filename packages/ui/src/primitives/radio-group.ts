import { css, cx } from '@quorum/styled-system/css'
import { RadioGroup as FoldkitRadioGroup } from '@foldkit/ui'
import type { Option } from 'effect/Option'
import type { Html, HtmlBuilder } from 'foldkit/html'

import {
  fieldBaseClass,
  fieldContentClass,
  fieldDescriptionClass,
  fieldLabelClass,
  fieldOrientationClasses,
  fieldTitleClass,
  labelClass,
} from './fieldset'

/**
 * Two rendering paths in `styledViewInputs`:
 *  - `optionLabel` (+ optional `optionDescription`) → upstream anatomy: a
 *    16px circle control carrying the foldkit attributes, an indicator dot
 *    mounted only while selected, and a wired label/description pair. Set
 *    `optionLayout` to compose the documented Field or Choice Card anatomy.
 *  - legacy `option` callback → consumer-owned row content inside a
 *    group-attributed wrapper (kept for backward compatibility).
 *
 */

// Re-export the @foldkit/ui RadioGroup surface. Create a bundle once per
// option type:
//
//   export const PlanRadioGroup = RadioGroup.create<"Startup" | "Business">()

export const create = FoldkitRadioGroup.create
export const init = FoldkitRadioGroup.init
export const Model = FoldkitRadioGroup.Model
export type Model = typeof Model.Type
export const Message = FoldkitRadioGroup.Message
export type Message = typeof Message.Type
export const OutMessage = FoldkitRadioGroup.OutMessage
export type OutMessage = typeof OutMessage.Type

export type Bundle<Value extends string = string> = FoldkitRadioGroup.Bundle<Value>
export type InitConfig = FoldkitRadioGroup.InitConfig
export type ViewInputs<Value extends string = string> = FoldkitRadioGroup.ViewInputs<Value>
export type RenderInfo<Value extends string = string> = FoldkitRadioGroup.RenderInfo<Value>

/** Upstream group component string. Horizontal orientation appends a
 *  responsive row extension (foldcn API exposes orientation; upstream leaves
 *  layout to the consumer). */
export const radioGroupClass = css({
  display: 'grid',
  gap: '2',
  width: '100%',
})

export const radioGroupVerticalClass = css({
  display: 'grid',
  gap: '2',
  width: '100%',
})

export const radioGroupHorizontalClass = css({
  display: 'grid',
  gap: '2',
  width: '100%',
  sm: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})

/** Upstream item component string. The disabled: variants are inert under
 *  foldkit (aria-/data- twins are inlined at style resolution). */
export const radioItemClass = cx(
  css({
    backgroundColor: 'well',
    boxShadow: 'well',
    borderColor: 'transparent',
    '&[data-checked]': {
      layerStyle: 'primaryFill',
      color: 'onPrimaryFill',
      boxShadow: 'primary',
      _focusVisible: {
        boxShadow:
          'var(--elev-primary), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
      },
    },
    '&[aria-invalid="true"]': {
      borderColor: 'destructive',
      boxShadow:
        'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    '&[aria-invalid="true"][aria-checked="true"]': { borderColor: 'primary' },
    _focusVisible: {
      borderColor: 'ring',
      boxShadow: 'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
        boxShadow:
          'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
    display: 'flex',
    width: '4',
    height: '4',
    borderRadius: '9999px',
    '.group-field-label:has(:focus-visible) &': { boxShadow: 'none' },
    '&[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.5 },
    '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
    position: 'relative',
    aspectRatio: '1 / 1',
    flexShrink: '0',
    borderWidth: '1px',
    borderStyle: 'solid',
    outlineStyle: 'none',
    '&::after': {
      position: 'absolute',
      insetInline: '-0.75rem',
      insetBlock: '-0.5rem',
    },
    '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
  }),
  'group-radio-group-item',
  'peer-control',
)

export const radioIndicatorClass = css({
  display: 'flex',
  width: '4',
  height: '4',
  alignItems: 'center',
  justifyContent: 'center',
})

export const radioDotClass = css({
  backgroundColor: 'primaryForeground',
  position: 'absolute',
  top: '50%',
  left: '50%',
  width: '2',
  height: '2',
  translate: '-50% -50%',
  borderRadius: '9999px',
})

/** Label for the upstream-anatomy option row. The circle control (radioItemClass)
 *  carries `peer` and precedes the label, and foldkit emits aria-disabled/
 *  data-disabled on it when disabled — so the peer twins below are live
 *  (upstream's native peer-disabled variant can never match). */
export const radioItemLabelClass = css({
  gap: '2',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  '.group[data-disabled] &': { opacity: 0.5 },
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  '.peer-control[aria-disabled="true"] ~ &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
  '.peer-control[data-disabled] ~ &': {
    pointerEvents: 'none',
    cursor: 'not-allowed',
  },
})

export const radioItemDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'mutedForeground',
})

/** Legacy consumer-drawn row (used when `option` callback is supplied). */
export const radioOptionClass = cx(
  css({
    position: 'relative',
    display: 'flex',
    cursor: 'pointer',
    userSelect: 'none',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 'lg',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    layerStyle: 'raised',
    padding: '3',
    color: 'cardForeground',
    boxShadow: 'raised',
    transitionProperty: 'box-shadow',
    transitionTimingFunction: 'default',
    transitionDuration: 'default',
    '&::after': {
      position: 'absolute',
      insetInline: '-0.75rem',
      insetBlock: '-0.5rem',
    },
    '&[data-checked]': {
      boxShadow: 'var(--elev-raised), 0 0 0 1.5px var(--primary)',
    },
    _focusVisible: {
      outlineStyle: 'none',
      boxShadow: 'var(--elev-raised), 0 0 0 3px color-mix(in oklab, var(--ring) 40%, transparent)',
    },
    '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
    '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
    '&[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.5 },
  }),
  'group-radio-group-item',
  'peer-control',
)

/** Legacy path label: nested inside the option row (which itself is the
 *  `group-radio-group-item` carrying foldkit's data-disabled), so disabled
 *  state flows via the group variant — a `peer-*` form can never match a
 *  descendant of the peer element. */
export const radioOptionLabelClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  '.group-radio-group-item[data-disabled] &': {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
})

export const radioOptionDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'mutedForeground',
})

export type StyledViewInputs<M, Value extends string = string> = Readonly<{
  options: ReadonlyArray<Value>
  selectedValue: Option<Value>
  ariaLabel: string
  /** Legacy path: renders each option row's content yourself. Receives the
   *  option value, its per-option render info (`isSelected`, attribute
   *  bundles) and the full render. Mutually exclusive with `optionLabel`. */
  option?: (
    value: Value,
    info: FoldkitRadioGroup.OptionInfo<Value>,
    render: RenderInfo<Value>,
    h: HtmlBuilder<M>,
  ) => Html
  /** Upstream-anatomy path: plain text label per option, rendered next to a
   *  circle control with the indicator dot. */
  optionLabel?: (value: Value) => string
  optionDescription?: (value: Value) => string
  /** `field` matches upstream's Description, Fieldset, Disabled, Invalid, and
   * RTL examples. `choice-card` places the control at the end of a card row. */
  optionLayout?: 'default' | 'field' | 'choice-card'
  orientation?: 'Horizontal' | 'Vertical'
  isOptionDisabled?: (value: Value, index: number) => boolean
  isInvalid?: boolean
  isDisabled?: boolean
  isReadOnly?: boolean
  name?: string
  groupClass?: string
  optionClass?: string
}>

const defaultOptionRow = <M, Value extends string>(
  info: FoldkitRadioGroup.OptionInfo<Value>,
  labelText: string,
  descriptionText: string | undefined,
  optionClass: string | undefined,
  isInvalid: boolean | undefined,
  optionLayout: 'default' | 'field' | 'choice-card',
  h: HtmlBuilder<M>,
): Html => {
  const isDisabled = info.isDisabled
  const control = h.button(
    [
      ...info.option,
      ...(isDisabled ? [h.Disabled(true), h.Tabindex(-1)] : []),
      ...(isInvalid ? [h.Attribute('aria-invalid', 'true')] : []),
      h.DataAttribute('slot', 'radio-group-item'),
      h.Class(radioItemClass),
    ],
    info.isSelected
      ? [
          h.span(
            [h.DataAttribute('slot', 'radio-group-indicator'), h.Class(radioIndicatorClass)],
            [h.span([h.Class(radioDotClass)])],
          ),
        ]
      : [],
  )

  if (optionLayout === 'choice-card') {
    return h.label(
      [
        h.DataAttribute('slot', 'field-label'),
        h.Class(cx(labelClass, fieldLabelClass, optionClass)),
      ],
      [
        h.div(
          [
            h.Role('group'),
            h.DataAttribute('slot', 'field'),
            h.DataAttribute('orientation', 'horizontal'),
            ...(isDisabled ? [h.DataAttribute('disabled', 'true')] : []),
            ...(isInvalid ? [h.DataAttribute('invalid', 'true')] : []),
            h.Class(cx(fieldBaseClass, fieldOrientationClasses.horizontal)),
          ],
          [
            h.div(
              [h.DataAttribute('slot', 'field-content'), h.Class(fieldContentClass)],
              [
                h.div(
                  [...info.label, h.DataAttribute('slot', 'field-label'), h.Class(fieldTitleClass)],
                  [labelText],
                ),
                ...(descriptionText === undefined
                  ? []
                  : [
                      h.p(
                        [
                          ...info.description,
                          h.DataAttribute('slot', 'field-description'),
                          h.Class(
                            cx(
                              fieldDescriptionClass,
                              css({ '[dir="rtl"] &': { textAlign: 'right' } }),
                            ),
                          ),
                        ],
                        [descriptionText],
                      ),
                    ]),
              ],
            ),
            control,
          ],
        ),
      ],
    )
  }

  const label = h.span(
    [
      ...info.label,
      h.DataAttribute('slot', optionLayout === 'field' ? 'field-label' : 'radio-group-item-label'),
      h.Class(
        optionLayout === 'field'
          ? cx(
              labelClass,
              fieldLabelClass,
              descriptionText === undefined
                ? css({
                    fontWeight: '400',
                  })
                : undefined,
            )
          : radioItemLabelClass,
      ),
    ],
    [labelText],
  )

  if (optionLayout === 'field') {
    return h.label(
      [
        h.DataAttribute('slot', 'field'),
        h.DataAttribute('orientation', 'horizontal'),
        ...(isDisabled ? [h.DataAttribute('disabled', 'true')] : []),
        ...(isInvalid ? [h.DataAttribute('invalid', 'true')] : []),
        h.Class(cx(fieldBaseClass, fieldOrientationClasses.horizontal, optionClass)),
      ],
      [
        control,
        descriptionText === undefined
          ? label
          : h.span(
              [h.DataAttribute('slot', 'field-content'), h.Class(fieldContentClass)],
              [
                label,
                h.span(
                  [
                    ...info.description,
                    h.DataAttribute('slot', 'field-description'),
                    h.Class(
                      cx(fieldDescriptionClass, css({ '[dir="rtl"] &': { textAlign: 'right' } })),
                    ),
                  ],
                  [descriptionText],
                ),
              ],
            ),
      ],
    )
  }

  return h.label(
    [
      h.Class(
        cx(
          descriptionText === undefined
            ? css({
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: '2',
              })
            : css({
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                gap: '2',
                '&>[role=radio]': {
                  marginTop: '0.5',
                },
              }),
          optionClass,
        ),
      ),
    ],
    [
      control,
      descriptionText === undefined
        ? label
        : h.span(
            [
              h.Class(
                css({
                  display: 'flex',
                  minWidth: '0',
                  flex: '1 1 0%',
                  flexDirection: 'column',
                  gap: '0.5',
                  '.peer-control[aria-disabled="true"] ~ &': { opacity: 0.5 },
                }),
              ),
            ],
            [
              label,
              h.span(
                [
                  ...info.description,
                  h.DataAttribute('slot', 'radio-group-item-description'),
                  h.Class(radioItemDescriptionClass),
                ],
                [descriptionText],
              ),
            ],
          ),
    ],
  )
}

/** Build styled `RadioGroup.ViewInputs`. Pass your view's `h`. */
export const styledViewInputs = <M, Value extends string = string>(
  viewInputs: StyledViewInputs<M, Value>,
  h: HtmlBuilder<M>,
): ViewInputs<Value> => {
  const isHorizontal = viewInputs.orientation === 'Horizontal'
  return {
    options: viewInputs.options,
    selectedValue: viewInputs.selectedValue,
    ariaLabel: viewInputs.ariaLabel,
    ...(viewInputs.orientation === undefined ? {} : { orientation: viewInputs.orientation }),
    ...(viewInputs.isOptionDisabled === undefined
      ? {}
      : { isOptionDisabled: viewInputs.isOptionDisabled }),
    hasOptionDescription: (value) =>
      viewInputs.option === undefined && viewInputs.optionDescription?.(value) !== undefined,
    ...(viewInputs.isDisabled === undefined ? {} : { isDisabled: viewInputs.isDisabled }),
    ...(viewInputs.isReadOnly === undefined ? {} : { isReadOnly: viewInputs.isReadOnly }),
    ...(viewInputs.name === undefined ? {} : { name: viewInputs.name }),
    toView: (render) => {
      const { group, options, hiddenInput } = render
      return h.div(
        [
          ...group,
          h.DataAttribute('slot', 'radio-group'),
          h.Class(
            cx(
              isHorizontal ? radioGroupHorizontalClass : radioGroupVerticalClass,
              viewInputs.groupClass,
            ),
          ),
        ],
        [
          ...options.map((option) => {
            if (viewInputs.option !== undefined) {
              // Legacy path: consumer-owned content inside the attributed row.
              return h.div(
                [
                  ...option.option,
                  ...(option.isDisabled ? [h.Tabindex(-1)] : []),
                  ...(viewInputs.isInvalid ? [h.Attribute('aria-invalid', 'true')] : []),
                  h.DataAttribute('slot', 'radio-group-item'),
                  h.Class(cx(radioOptionClass, viewInputs.optionClass)),
                ],
                [viewInputs.option(option.value, option, render, h)],
              )
            }
            return defaultOptionRow(
              option,
              viewInputs.optionLabel?.(option.value) ?? String(option.value),
              viewInputs.optionDescription?.(option.value),
              viewInputs.optionClass,
              viewInputs.isInvalid,
              viewInputs.optionLayout ?? 'default',
              h,
            )
          }),
          ...(hiddenInput.length > 0 ? [h.input([...hiddenInput])] : []),
        ],
      )
    },
  }
}
