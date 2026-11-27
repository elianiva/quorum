import type { H } from '@effect/ui/html/Html'
import type { View } from '@effect/ui'
import { css, cx } from '@quorum/styled-system/css'

type Child<Msg> = View.Input<Msg>

const focusRing = '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)'
const invalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)'
const darkInvalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)'

export const badgeVariantKeys = [
  'default',
  'secondary',
  'destructive',
  'ok',
  'warn',
  'outline',
  'ghost',
  'link',
] as const

export type BadgeVariant = (typeof badgeVariantKeys)[number]

export const badgeVariants: Record<BadgeVariant, string> = {
  default: css({
    backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
    color: 'primaryStrong',
    boxShadow: 'primaryLineInset',
    _focusVisible: {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    '&[aria-invalid="true"]': {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow:
          'inset 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
  }),
  secondary: css({
    backgroundColor: 'well',
    color: 'mutedForeground',
    boxShadow: 'well',
    _focusVisible: { boxShadow: `var(--elev-well), ${focusRing}` },
    '&[aria-invalid="true"]': { boxShadow: `var(--elev-well), ${invalidRing}` },
    _dark: {
      '&[aria-invalid="true"]': { boxShadow: `var(--elev-well), ${darkInvalidRing}` },
    },
  }),
  destructive: css({
    backgroundColor: 'color-mix(in oklab, var(--destructive) 10%, transparent)',
    color: 'destructive',
    boxShadow: 'invalidLine',
    _focusVisible: {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    '&[aria-invalid="true"]': {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow:
          'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
  }),
  ok: css({
    backgroundColor: 'color-mix(in oklab, var(--ok) 12%, transparent)',
    color: 'ok',
    boxShadow: 'okLine',
    _focusVisible: {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--ok) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    '&[aria-invalid="true"]': {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--ok) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow:
          'inset 0 0 0 1px color-mix(in oklch, var(--ok) 25%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
  }),
  warn: css({
    backgroundColor: 'color-mix(in oklab, var(--warn) 14%, transparent)',
    color: 'warn',
    boxShadow: 'warnLine',
    _focusVisible: {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--warn) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
    '&[aria-invalid="true"]': {
      boxShadow:
        'inset 0 0 0 1px color-mix(in oklch, var(--warn) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
    },
    _dark: {
      '&[aria-invalid="true"]': {
        boxShadow:
          'inset 0 0 0 1px color-mix(in oklch, var(--warn) 28%, transparent), 0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
      },
    },
  }),
  outline: css({
    layerStyle: 'raised',
    color: 'foreground',
    boxShadow: 'raised',
    _focusVisible: { boxShadow: `var(--elev-raised), ${focusRing}` },
    '&[aria-invalid="true"]': { boxShadow: `var(--elev-raised), ${invalidRing}` },
    _dark: {
      '&[aria-invalid="true"]': { boxShadow: `var(--elev-raised), ${darkInvalidRing}` },
    },
  }),
  ghost: css({
    _hover: { backgroundColor: 'muted', color: 'mutedForeground' },
    _dark: {
      _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 50%, transparent)' },
      '&[aria-invalid="true"]': { boxShadow: darkInvalidRing },
    },
    _focusVisible: { boxShadow: focusRing },
    '&[aria-invalid="true"]': { boxShadow: invalidRing },
  }),
  link: css({
    color: 'primary',
    textUnderlineOffset: '4px',
    _hover: { textDecorationLine: 'underline' },
    _focusVisible: { boxShadow: focusRing },
    '&[aria-invalid="true"]': { boxShadow: invalidRing },
    _dark: { '&[aria-invalid="true"]': { boxShadow: darkInvalidRing } },
  }),
}

export const badgeClass = css({
  height: '5',
  gap: '1',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  paddingInline: '1.5',
  paddingBlock: '0.5',
  fontSize: 'type.11',
  fontWeight: 'medium',
  transitionProperty: 'all',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  '&:has([data-icon="inline-end"])': { paddingRight: '1.5' },
  '&:has([data-icon="inline-start"])': { paddingLeft: '1.5' },
  '& > svg': { width: '0.75rem!', height: '0.75rem!', pointerEvents: 'none' },
  display: 'inline-flex',
  width: 'fit-content',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: focusRing,
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow: invalidRing,
  },
  _dark: {
    '&[aria-invalid="true"]': {
      boxShadow: darkInvalidRing,
    },
  },
})

export type BadgeConfig = Readonly<{ className?: string; variant?: BadgeVariant }>

export const badge = <Msg>(
  h: H<Msg>,
  config: BadgeConfig,
  children: ReadonlyArray<Child<Msg>>,
): View.Content<Msg> =>
  h.span
    .class(cx(badgeClass, badgeVariants[config.variant ?? 'default'], config.className))
    .attr('data-slot', 'badge')
    .attr('data-variant', config.variant ?? 'default')
    .children(...children)
