import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

const focusRing = '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)'
const invalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)'
const darkInvalidRing = '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)'

/** Badge variant keys — keep in sync with `badgeVariants`. */
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

export const badgeVariants: Record<BadgeVariant, string> = {
  default: css({
    backgroundColor: 'color-mix(in oklab, var(--primary) 14%, transparent)',
    color: 'primaryStrong',
    boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent)',
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
    boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 25%, transparent)',
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
    boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--ok) 25%, transparent)',
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
    boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--warn) 28%, transparent)',
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

export type BadgeVariant = (typeof badgeVariantKeys)[number]

export const badgeClass = css({
  height: '5',
  gap: '1',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  paddingInline: '1.5',
  paddingBlock: '0.5',
  fontSize: '11px',
  fontWeight: '500',
  transitionProperty: 'all',
  transitionDuration: 'default',
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

type StyleConfig = Readonly<{ className?: string; variant?: BadgeVariant }>

/** Styled badge built as a themed `<span>` (mirrors the shadcn v4 `badge.tsx`
 *  default element). For a link badge, render an `<a>` child and apply
 *  `badgeClass` via `cn` — foldcn has no Radix `Slot`. */
export const badge = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cx(badgeClass, badgeVariants[config.variant ?? 'default'], config.className)),
      h.DataAttribute('slot', 'badge'),
      h.DataAttribute('variant', config.variant ?? 'default'),
    ],
    children,
  )
