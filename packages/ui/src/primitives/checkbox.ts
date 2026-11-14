import { css, cx } from '@quorum/styled-system/css'
import { Checkbox as FoldkitCheckbox } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { icon } from './icon'
import { Check, Minus } from 'lucide'

/**
 * foldkit delta (inlined at style resolution): foldkit emits
 * aria-disabled/data-disabled instead of native disabled, and data-checked /
 * data-indeterminate for state.
 *
 */

/** Upstream checkbox component string. The disabled: variants are inert under
 *  foldkit (never native disabled) — compat twins are inlined at style resolution. */
export const checkboxClass = cx(
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
    _dark: {
      '&[aria-invalid="true"]': {
        borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
        boxShadow:
          'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
    _focusVisible: {
      borderColor: 'ring',
      boxShadow: 'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    display: 'flex',
    width: '4',
    height: '4',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    borderWidth: '1px',
    borderStyle: 'solid',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'default',
    transitionDuration: 'default',
    '.group-field:has(:disabled) &': { opacity: 0.5 },
    '.group-field-label:has(:focus-visible) &': { boxShadow: 'none' },
    '&[aria-disabled="true"]': { cursor: 'not-allowed', opacity: 0.5 },
    '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
    position: 'relative',
    flexShrink: '0',
    outlineStyle: 'none',
    '&::after': {
      position: 'absolute',
      insetInline: '-0.75rem',
      insetBlock: '-0.5rem',
    },
    '&:disabled': { cursor: 'not-allowed', opacity: 0.5 },
  }),
  'peer-control',
)

export const checkboxIndicatorClass = css({
  '& > svg': { width: '3.5', height: '3.5' },
  display: 'grid',
  placeContent: 'center',
  color: 'currentColor',
  transitionProperty: 'none',
})

export type CheckboxConfig<M> = Readonly<{
  id: string
  isChecked: boolean
  onToggle: (isChecked: boolean) => M
  label: string
  description?: string
  isDisabled?: boolean
  isReadOnly?: boolean
  isIndeterminate?: boolean
  name?: string
  value?: string
  className?: string
  labelClass?: string
  descriptionClass?: string
  wrapperClass?: string
}>

/** Styled checkbox with label and optional description, built on the
 *  @foldkit/ui Checkbox helper. */
export const checkbox = <M>(config: CheckboxConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitCheckbox.view<M>(
    {
      id: config.id,
      hasDescription: config.description !== undefined,
      isChecked: config.isChecked,
      onToggle: config.onToggle,
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
      ...(config.isIndeterminate === undefined ? {} : { isIndeterminate: config.isIndeterminate }),
      ...(config.name === undefined ? {} : { name: config.name }),
      ...(config.value === undefined ? {} : { value: config.value }),
      toView: (attributes) =>
        h.div(
          [
            h.Class(
              cx(
                css({
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1',
                }),
                config.wrapperClass,
              ),
            ),
          ],
          [
            h.div(
              [
                h.Class(
                  css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2',
                  }),
                ),
              ],
              [
                h.button(
                  [
                    ...attributes.checkbox,
                    h.DataAttribute('slot', 'checkbox'),
                    h.Class(cx(checkboxClass, config.className)),
                  ],
                  config.isChecked || config.isIndeterminate === true
                    ? [
                        h.span(
                          [
                            h.DataAttribute('slot', 'checkbox-indicator'),
                            h.Class(checkboxIndicatorClass),
                          ],
                          [
                            icon(
                              h,
                              config.isIndeterminate === true ? Minus : Check,
                              css({
                                width: '3.5',
                                height: '3.5',
                              }),
                            ),
                          ],
                        ),
                      ]
                    : [],
                ),
                ...(attributes.hiddenInput.length > 0
                  ? [h.input([...attributes.hiddenInput])]
                  : []),
                h.label(
                  [
                    ...attributes.label,
                    h.Class(
                      cx(
                        css({
                          fontSize: 'calc(0.875rem * var(--type-scale))',
                          fontWeight: '500',
                          lineHeight: '1',
                          '.peer-control[aria-disabled="true"] ~ &': {
                            cursor: 'not-allowed',
                            opacity: 0.7,
                          },
                          '.peer-control[data-disabled] ~ &': { opacity: 0.7 },
                        }),
                        config.labelClass,
                      ),
                    ),
                  ],
                  [config.label],
                ),
              ],
            ),
            config.description === undefined
              ? h.empty
              : h.p(
                  [
                    ...attributes.description,
                    h.Class(
                      cx(
                        css({
                          fontSize: 'calc(0.875rem * var(--type-scale))',
                          lineHeight: 'calc(1.25 / 0.875)',
                          color: 'mutedForeground',
                        }),
                        config.descriptionClass,
                      ),
                    ),
                  ],
                  [config.description],
                ),
          ],
        ),
    },
    h,
  )
