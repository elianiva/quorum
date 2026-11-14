import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

import { button, type ButtonConfig, type ButtonSize, type ButtonVariant } from './button'
import { separatorClass } from './separator'

type Child = Html | string

// ButtonGroup connects a run of controls into a single segmented control.
// Children keep their own outlines; the group's corner-cutting rules join
// them (upstream model).

export const buttonGroupClass = css({
  '&:has(> [data-slot="button-group"])': {
    gap: '0.5rem',
  },
  '&:has(select[aria-hidden="true"]:last-child)': {
    '& > [data-slot="select-trigger"]:last-of-type': {
      borderTopRightRadius: 'lg',
      borderBottomRightRadius: 'lg',
    },
  },
  display: 'flex',
  width: 'fit-content',
  alignItems: 'stretch',
  '& > *': {
    _focusVisible: {
      position: 'relative',
      zIndex: '10',
    },
  },
  '& > [data-slot="select-trigger"]:not([data-width])': {
    width: 'fit-content',
  },
  '& > input': {
    flex: '1 1 0%',
  },
})

export const buttonGroupOrientationClasses = {
  horizontal: css({
    '& > [data-slot]:not(:has(~ [data-slot]))': {
      borderTopRightRadius: 'lg!',
      borderBottomRightRadius: 'lg!',
    },
    '& > [data-slot]': {
      borderTopRightRadius: '0',
      borderBottomRightRadius: '0',
    },
    '& > [data-slot] ~ [data-slot]': {
      borderTopLeftRadius: '0',
      borderBottomLeftRadius: '0',
      borderLeftWidth: '0',
    },
  }),
  vertical: css({
    flexDirection: 'column',
    '& > [data-slot]:not(:has(~ [data-slot]))': {
      borderBottomLeftRadius: 'lg!',
      borderBottomRightRadius: 'lg!',
    },
    '& > [data-slot]': {
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
    },
    '& > [data-slot] ~ [data-slot]': {
      borderTopLeftRadius: '0',
      borderTopRightRadius: '0',
      borderTopWidth: '0',
    },
  }),
} as const

export type ButtonGroupOrientation = keyof typeof buttonGroupOrientationClasses

export const buttonGroupTextClass = css({
  backgroundColor: 'var(--well)',
  boxShadow: 'well',
  gap: '0.5rem',
  borderRadius: 'lg',
  paddingInline: '0.625rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  '& svg:not([data-svg-icon])': {
    width: '1rem',
    height: '1rem',
  },
  display: 'flex',
  alignItems: 'center',
  '& svg': {
    pointerEvents: 'none',
  },
})

export const buttonGroupSeparatorClass = css({
  backgroundColor: 'hairline',
  position: 'relative',
  alignSelf: 'stretch',
  '&[data-horizontal]': { marginInline: '1px', width: 'auto' },
  '&[data-vertical]': { marginBlock: '1px', height: 'auto' },
})

type StyleConfig = Readonly<{ className?: string; orientation?: ButtonGroupOrientation }>

/** Segmented container — pass buttons/selects/inputs as children. */
export const buttonGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html => {
  const orientation = config.orientation ?? 'horizontal'
  return h.div(
    [
      h.Role('group'),
      h.Class(cx(buttonGroupClass, buttonGroupOrientationClasses[orientation], config.className)),
      h.DataAttribute('slot', 'button-group'),
      h.DataAttribute('orientation', orientation),
    ],
    children,
  )
}

export const buttonGroupText = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.DataAttribute('slot', 'button-group-text'),
      h.Class(cx(buttonGroupTextClass, config.className)),
    ],
    children,
  )

// Upstream renders the shared <Separator> part; foldcn composes the same
// attribute set and class merge (separator base wins conflicts first) by hand.

/** Divider between grouped controls — a vertical `Separator` by default,
 *  matching upstream `ButtonGroupSeparator`. Upstream emits only
 *  `data-orientation` + `data-slot`; the `data-horizontal` / `data-vertical`
 *  selectors in the token are matched via the Separator's own
 *  `data-horizontal` / `data-vertical` attributes (see separator.ts). */
export const buttonGroupSeparator = <M>(config: StyleConfig, h: HtmlBuilder<M>): Html => {
  const orientation = config.orientation ?? 'vertical'
  return h.div(
    [
      h.Role('separator'),
      h.AriaOrientation(orientation),
      h.DataAttribute('slot', 'button-group-separator'),
      h.DataAttribute('orientation', orientation),
      h.DataAttribute(orientation, ''),
      h.Class(cx(separatorClass, buttonGroupSeparatorClass, config.className)),
    ],
    [],
  )
}

/** A `button` styled to sit inside a `buttonGroup`. */
export const buttonGroupItem = <M>(
  config: ButtonConfig<M>,
  label: Html | string,
  h: HtmlBuilder<M>,
): Html =>
  button<M>(
    {
      ...config,
      size: config.size ?? ('default' satisfies ButtonSize),
      variant: config.variant ?? ('outline' satisfies ButtonVariant),
      className: cx(config.className),
    },
    label,
    h,
  )
