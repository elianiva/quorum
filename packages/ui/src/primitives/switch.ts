import { css, cx } from '@quorum/styled-system/css'
import { Switch as FoldkitSwitch } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

/**
 * foldkit deltas (inlined at style resolution): foldkit emits aria-disabled/
 * data-disabled instead of native disabled, and only data-checked (never
 * data-unchecked) on the ROOT button — this view hand-emits data-unchecked
 * there when off. Upstream Base UI also puts data-checked/data-unchecked on
 * the THUMB itself (the travel/track variants like
 * group-data-[size=default]/switch:data-checked:* key on the thumb's own
 * attribute), so the thumb span mirrors the state attribute too.
 *
 */

export const switchSizeKeys = ['default', 'sm'] as const
export type SwitchSize = (typeof switchSizeKeys)[number]

/** Upstream switch component; sizes come from the data-size attribute. */
export const switchClass = cx(
  'peer-control',
  'group-switch',
  css({
    flexShrink: '0',
    borderRadius: '9999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionDuration: '150ms',
    transitionTimingFunction: 'var(--ease-out)',
    '&[data-checked]': {
      layerStyle: 'primaryFill',
      boxShadow: 'inset 0 1px 2px oklch(0 0 0 / 0.3)',
    },
    '&[data-unchecked]': {
      backgroundColor: 'well',
      boxShadow: 'well',
    },
    _focusVisible: {
      borderColor: 'ring',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    '&[aria-invalid="true"]': {
      borderColor: 'destructive',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
        boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
    '&[data-size="default"]': { height: '1.25rem', width: '34px' },
    '&[data-size="sm"]': { height: '14px', width: '24px' },
    '&::after': {
      content: '""',
      position: 'absolute',
      insetInline: '-0.75rem',
      insetBlock: '-0.5rem',
    },
    '&[data-disabled]': { cursor: 'not-allowed', opacity: 0.5 },
    '.group-field-label:has(:focus-visible) &': {
      boxShadow: 'none',
      borderColor: 'transparent',
    },
  }),
)

/** Upstream thumb; geometry and travel come from the switch size and state. */
export const switchThumbClass = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  borderRadius: '9999px',
  pointerEvents: 'none',
  display: 'block',
  transitionProperty: 'transform',
  transitionDuration: '150ms',
  transitionTimingFunction: 'var(--ease-out)',
  '.group-switch[data-size="default"] &': {
    width: '1rem',
    height: '1rem',
    '&[data-checked]': { transform: 'translateX(calc(100% - 1px))' },
    '&[data-unchecked]': { transform: 'translateX(1px)' },
  },
  '.group-switch[data-size="sm"] &': {
    width: '0.75rem',
    height: '0.75rem',
    '&[data-checked]': { transform: 'translateX(calc(100% - 2px))' },
    '&[data-unchecked]': { transform: 'translateX(0)' },
  },
})

export const switchLabelClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  '.group-field[data-disabled] &': {
    cursor: 'not-allowed',
    opacity: 0.7,
  },
})

export const switchDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  color: 'mutedForeground',
})

export const switchWrapperClass = cx(
  'group-field',
  css({ display: 'flex', alignItems: 'center', gap: '0.75rem' }),
)

export const switchTextWrapperClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
})

export type SwitchConfig<M> = Readonly<{
  id: string
  isChecked: boolean
  onToggle: (isChecked: boolean) => M
  label: string
  description?: string
  isDisabled?: boolean
  isReadOnly?: boolean
  name?: string
  value?: string
  size?: SwitchSize
  className?: string
  thumbClass?: string
  labelClass?: string
  descriptionClass?: string
  textClass?: string
  wrapperClass?: string
}>

/** Styled switch with label and optional description, built on the
 *  @foldkit/ui Switch helper. */
export const switch_ = <M>(config: SwitchConfig<M>, h: HtmlBuilder<M>): Html =>
  FoldkitSwitch.view<M>(
    {
      id: config.id,
      hasDescription: config.description !== undefined,
      isChecked: config.isChecked,
      onToggle: config.onToggle,
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.isReadOnly === undefined ? {} : { isReadOnly: config.isReadOnly }),
      ...(config.name === undefined ? {} : { name: config.name }),
      ...(config.value === undefined ? {} : { value: config.value }),
      toView: (attributes) =>
        h.div(
          [
            h.Class(cx(switchWrapperClass, config.wrapperClass)),
            ...(config.isDisabled ? [h.DataAttribute('disabled', '')] : []),
          ],
          [
            h.button(
              [
                ...attributes.button,
                h.DataAttribute('slot', 'switch'),
                h.DataAttribute('size', config.size ?? 'default'),
                ...(config.isChecked ? [] : [h.DataAttribute('unchecked', '')]),
                h.Class(cx(switchClass, config.className)),
              ],
              [
                h.span([
                  h.DataAttribute('slot', 'switch-thumb'),
                  h.DataAttribute(config.isChecked ? 'checked' : 'unchecked', ''),
                  h.Class(cx(switchThumbClass, config.thumbClass)),
                ]),
              ],
            ),
            ...(attributes.hiddenInput.length > 0 ? [h.input([...attributes.hiddenInput])] : []),
            h.div(
              [h.Class(cx(switchTextWrapperClass, config.textClass))],
              [
                h.label(
                  [...attributes.label, h.Class(cx(switchLabelClass, config.labelClass))],
                  [config.label],
                ),
                config.description === undefined
                  ? h.empty
                  : h.p(
                      [
                        ...attributes.description,
                        h.Class(cx(switchDescriptionClass, config.descriptionClass)),
                      ],
                      [config.description],
                    ),
              ],
            ),
          ],
        ),
    },
    h,
  )
