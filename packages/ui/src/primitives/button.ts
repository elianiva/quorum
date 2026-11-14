import { css, cva, cx } from '@quorum/styled-system/css'
import { Button as FoldkitButton } from '@foldkit/ui'
import type { Attribute, Html, HtmlBuilder } from 'foldkit/html'
import { X } from 'lucide'
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
  // Grow with the 150% text setting while keeping a fixed line box at 100%.
  fontSize: 'type.14',
  // A unitless factor, so a nested 10.5px Kbd recomputes its own line box.
  lineHeight: 'fine',
  fontWeight: 'medium',
  display: 'inline-flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  outlineStyle: 'none',
  userSelect: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: 0 },
  '& svg:not([data-svg-icon])': { width: '4', height: '4' },
  _focusVisible: { borderColor: 'ring' },
  '[data-text="150"] &': { lineHeight: 'body' },
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
    boxShadow: 'primary',
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
    boxShadow: 'raised',
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
    boxShadow: 'line',
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
  'row',
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
    height: '8',
    gap: '1.5',
    paddingInline: '2.5',
    '&:has([data-icon="inline-end"])': { paddingRight: '2' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '2' },
  },
  xs: {
    height: '6',
    gap: '1',
    borderRadius: 'md',
    paddingInline: '2',
    fontSize: 'type.12',
    lineHeight: 'compact',
    '[data-text="150"] &': { lineHeight: 'body' },
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    '&:has([data-icon="inline-end"])': { paddingRight: '1.5' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '1.5' },
    ...iconSize('3'),
  },
  sm: {
    height: '7',
    gap: '1',
    borderRadius: 'md',
    paddingInline: '2.5',
    fontSize: 'type.12-8',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    '&:has([data-icon="inline-end"])': { paddingRight: '1.5' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '1.5' },
    ...iconSize('3.5'),
  },
  lg: {
    height: '9',
    gap: '1.5',
    paddingInline: '2.5',
    '&:has([data-icon="inline-end"])': { paddingRight: '2' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '2' },
  },
  row: {
    height: '10',
    gap: '2.5',
    paddingInline: '3',
  },
  icon: { width: '8', height: '8' },
  'icon-xs': {
    width: '6',
    height: '6',
    borderRadius: 'md',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
    ...iconSize('3'),
  },
  'icon-sm': {
    width: '7',
    height: '7',
    borderRadius: 'md',
    '[data-slot="button-group"] &': { borderRadius: 'lg' },
  },
  'icon-lg': { width: '9', height: '9' },
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
  row: css(buttonSizeStyles.row),
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
            top: '1.5',
            right: '1.5',
            zIndex: 10,
            display: 'grid',
            width: '7',
            height: '7',
            placeItems: 'center',
            borderRadius: 'lg',
            color: 'color-mix(in oklab, var(--muted-foreground) 80%, transparent)',
            _hover: { backgroundColor: 'well', color: 'foreground' },
            _focusVisible: {
              boxShadow: 'focus',
              outlineStyle: 'none',
            },
          }),
          config.className,
        ),
      ),
    ],
    [
      icon(
        h,
        X,
        css({
          width: '3.5',
          height: '3.5',
        }),
      ),
    ],
  )
