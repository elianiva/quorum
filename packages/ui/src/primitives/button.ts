import { Button as FoldkitButton } from '@foldkit/ui'
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html'
import { X } from 'lucide'
import { css, cva, cx } from '@quorum/styled-system/css'
import type { SystemStyleObject } from '@quorum/styled-system/types'

import { icon } from './icon.ts'

/** Button variant keys. Sync with `buttonVariants` is compiler-enforced:
 *  `buttonVariants` is `Record<ButtonVariant, string>` (missing key = error)
 *  and annotated object literals reject unknown keys. */
export const buttonVariantKeys = [
  'default',
  'destructive',
  'outline',
  'secondary',
  'ghost',
  'link',
] as const

const focusRing = '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)'
const invalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)'
const darkInvalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)'
const destructiveEdge = 'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 22%, transparent)'

const buttonBaseStyle: SystemStyleObject = {
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  backgroundClip: 'padding-box',
  // The current `.text-sm` grows with the 150% text setting and keeps a fixed
  // line box at 100%. Reproduce both states here instead of relying on the
  // Tailwind class override.
  fontSize: 'calc(0.875rem * var(--type-scale))',
  // Tailwind's `text-sm` line-height is the unitless factor 1.25 / 0.875, so a
  // nested 10.5px Kbd recomputes 15px. A fixed 1.25rem would leak 20px into it.
  lineHeight: '1.4285714285714286',
  fontWeight: '500',
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  outlineStyle: 'none',
  userSelect: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: 0 },
  '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
  _focusVisible: { borderColor: 'ring' },
  '[data-text="150"] &': { lineHeight: '1.45' },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  '&[aria-invalid="true"]': { borderColor: 'destructive' },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
    },
  },
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
}

const buttonVariantStyles: Record<ButtonVariant, SystemStyleObject> = {
  default: {
    layerStyle: 'primaryFill',
    color: 'onPrimaryFill',
    boxShadow: 'var(--elev-primary)',
    _hover: { filter: 'brightness(1.06)' },
    _active: { filter: 'brightness(0.95)' },
    _focusVisible: { boxShadow: `var(--elev-primary), ${focusRing}` },
    '&[aria-invalid="true"]': { boxShadow: `var(--elev-primary), ${invalidRing}` },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow: `var(--elev-primary), ${darkInvalidRing}`,
      },
    },
  },
  destructive: {
    backgroundColor: 'color-mix(in oklab, var(--destructive) 10%, transparent)',
    color: 'destructive',
    boxShadow: destructiveEdge,
    _hover: {
      backgroundColor: 'color-mix(in oklab, var(--destructive) 15%, transparent)',
    },
    _focusVisible: {
      boxShadow: `${destructiveEdge}, 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)`,
    },
    _dark: {
      _focusVisible: {
        boxShadow: `${destructiveEdge}, 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)`,
      },
      '&[aria-invalid="true"]': { boxShadow: `${destructiveEdge}, ${darkInvalidRing}` },
    },
    '&[aria-invalid="true"]': { boxShadow: `${destructiveEdge}, ${invalidRing}` },
  },
  outline: {
    layerStyle: 'raised',
    boxShadow: 'var(--elev-raised)',
    color: 'foreground',
    _hover: { filter: 'brightness(0.985)' },
    _dark: {
      _hover: { filter: 'brightness(1.1)' },
      '&[aria-invalid="true"]': { boxShadow: `var(--elev-raised), ${darkInvalidRing}` },
    },
    _expanded: { filter: 'brightness(0.95)' },
    _focusVisible: { boxShadow: `var(--elev-raised), ${focusRing}` },
    '&[aria-invalid="true"]': { boxShadow: `var(--elev-raised), ${invalidRing}` },
  },
  secondary: {
    backgroundColor: 'secondary',
    color: 'secondaryForeground',
    boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
    _hover: {
      backgroundColor: 'color-mix(in oklab, var(--secondary), var(--foreground) 5%)',
    },
    _expanded: {
      backgroundColor: 'secondary',
      color: 'secondaryForeground',
    },
    _focusVisible: {
      boxShadow: `inset 0 0 0 1px var(--hairline-soft), ${focusRing}`,
    },
    '&[aria-invalid="true"]': {
      boxShadow: `inset 0 0 0 1px var(--hairline-soft), ${invalidRing}`,
    },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow: `inset 0 0 0 1px var(--hairline-soft), ${darkInvalidRing}`,
      },
    },
  },
  ghost: {
    _hover: { backgroundColor: 'muted', color: 'foreground' },
    _dark: {
      _hover: {
        backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)',
      },
      '&[aria-invalid="true"]': { boxShadow: darkInvalidRing },
    },
    _expanded: { backgroundColor: 'muted', color: 'foreground' },
    _focusVisible: { boxShadow: focusRing },
    '&[aria-invalid="true"]': { boxShadow: invalidRing },
  },
  link: {
    color: 'primary',
    textUnderlineOffset: '4px',
    _hover: { textDecoration: 'underline' },
    _focusVisible: { boxShadow: focusRing },
    '&[aria-invalid="true"]': { boxShadow: invalidRing },
    _dark: { '&[aria-invalid="true"]': { boxShadow: darkInvalidRing } },
  },
}

/** Button size keys. Sync with `buttonSizes` is compiler-enforced (see above). */
export const buttonSizeKeys = [
  'default',
  'xs',
  'sm',
  'lg',
  'icon',
  'icon-xs',
  'icon-sm',
  'icon-lg',
] as const

const iconSize = (size: string): SystemStyleObject => ({
  '& svg:not([data-svg-icon])': { width: size, height: size },
})

const buttonSizeStyles: Record<ButtonSize, SystemStyleObject> = {
  default: {
    height: '2rem',
    gap: '0.375rem',
    paddingInline: '0.625rem',
    '&:has([data-icon="inline-end"])': { paddingRight: '0.5rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.5rem' },
  },
  xs: {
    height: '1.5rem',
    gap: '0.25rem',
    borderRadius: 'min(var(--radius-md), 10px)',
    paddingInline: '0.5rem',
    fontSize: 'calc(0.75rem * var(--type-scale))',
    lineHeight: '1.3333333333333333',
    '[data-text="150"] &': { lineHeight: '1.45' },
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    '&:has([data-icon="inline-end"])': { paddingRight: '0.375rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.375rem' },
    ...iconSize('0.75rem'),
  },
  sm: {
    height: '1.75rem',
    gap: '0.25rem',
    borderRadius: 'min(var(--radius-md), 12px)',
    paddingInline: '0.625rem',
    fontSize: '0.8rem',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    '&:has([data-icon="inline-end"])': { paddingRight: '0.375rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.375rem' },
    ...iconSize('0.875rem'),
  },
  lg: {
    height: '2.25rem',
    gap: '0.375rem',
    paddingInline: '0.625rem',
    '&:has([data-icon="inline-end"])': { paddingRight: '0.5rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.5rem' },
  },
  icon: { width: '2rem', height: '2rem' },
  'icon-xs': {
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: 'min(var(--radius-md), 10px)',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    ...iconSize('0.75rem'),
  },
  'icon-sm': {
    width: '1.75rem',
    height: '1.75rem',
    borderRadius: 'min(var(--radius-md), 12px)',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
  },
  'icon-lg': { width: '2.25rem', height: '2.25rem' },
}

export type ButtonVariant = (typeof buttonVariantKeys)[number]
export type ButtonSize = (typeof buttonSizeKeys)[number]

/** The classes every button shares, for an anchor that must look like a button. */
export const buttonBase = cx(css(buttonBaseStyle), 'press')

export const buttonVariants: Record<ButtonVariant, string> = {
  default: css(buttonVariantStyles.default),
  destructive: css(buttonVariantStyles.destructive),
  outline: css(buttonVariantStyles.outline),
  secondary: css(buttonVariantStyles.secondary),
  ghost: css(buttonVariantStyles.ghost),
  link: css(buttonVariantStyles.link),
}

export const buttonSizes: Record<ButtonSize, string> = {
  default: css(buttonSizeStyles.default),
  xs: css(buttonSizeStyles.xs),
  sm: css(buttonSizeStyles.sm),
  lg: css(buttonSizeStyles.lg),
  icon: css(buttonSizeStyles.icon),
  'icon-xs': css(buttonSizeStyles['icon-xs']),
  'icon-sm': css(buttonSizeStyles['icon-sm']),
  'icon-lg': css(buttonSizeStyles['icon-lg']),
}

const buttonRecipe = cva({
  base: buttonBaseStyle,
  variants: {
    variant: buttonVariantStyles,
    size: buttonSizeStyles,
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

/** A button's class list. `className` stays for a custom class or a
 *  call-site `css()` result; Panda extracts styles at the call site. */
export const buttonClass = (
  variant: ButtonVariant = 'default',
  size: ButtonSize = 'default',
  className?: string | undefined,
): string => cx(buttonRecipe({ variant, size }), 'press', className)

export type ButtonConfig<M> = Readonly<{
  onClick?: M
  isDisabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  isAutofocus?: boolean
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  /** Extra attributes merged onto the button element (ids, handlers,
   *  popoover anchors, …). */
  attributes?: ReadonlyArray<Attribute<M>>
}>

export type ButtonLabel = Html | string | ReadonlyArray<Html | string>

/** Styled button built on the @foldkit/ui Button helper. */
export const button = <M>(config: ButtonConfig<M>, label: ButtonLabel, h: HtmlBuilder<M>): Html =>
  FoldkitButton.view<M>(
    {
      ...(config.onClick === undefined ? {} : { onClick: config.onClick }),
      ...(config.isDisabled === undefined ? {} : { isDisabled: config.isDisabled }),
      ...(config.type === undefined ? {} : { type: config.type }),
      ...(config.isAutofocus === undefined ? {} : { isAutofocus: config.isAutofocus }),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(cx(buttonClass(config.variant, config.size), config.className)),
            h.DataAttribute('slot', 'button'),
            ...(config.attributes ?? []),
          ],
          Array.isArray(label) ? label : [label],
        ),
    },
    h,
  )

/** The close control every card pins to its top-right corner, so one place closes anything. */
export const closeButton = <M>(
  config: Readonly<{ label: string; onClick: M; className?: string }>,
  h: HtmlBuilder<M>,
): Html =>
  h.button(
    [
      h.Type('button'),
      h.AriaLabel(config.label),
      h.Title(config.label),
      h.OnClick(config.onClick),
      h.Class(
        cx(
          css({
            position: 'absolute',
            top: '0.375rem',
            right: '0.375rem',
            zIndex: 10,
            display: 'grid',
            width: '1.75rem',
            height: '1.75rem',
            placeItems: 'center',
            borderRadius: 'lg',
            color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
            _hover: { backgroundColor: 'well', color: 'foreground' },
            _focusVisible: {
              boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
              outlineStyle: 'none',
            },
          }),
          config.className,
        ),
      ),
    ],
    [icon(h, X, 'size-3.5')],
  )
