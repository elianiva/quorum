import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const alertVariantKeys = ['default', 'destructive'] as const
export type AlertVariant = (typeof alertVariantKeys)[number]

export const alertVariants: Record<AlertVariant, string> = {
  default: css({
    layerStyle: 'surface',
    boxShadow: 'card',
    color: 'cardForeground',
  }),
  destructive: css({
    color: 'destructive',
    backgroundColor: 'color-mix(in oklab, var(--destructive) 8%, transparent)',
    boxShadow: 'inset 0 0 0 1px color-mix(in oklch, var(--destructive) 25%, transparent)',
    '& > [data-slot="alert-description"]': {
      color: 'color-mix(in oklab, var(--destructive) 90%, transparent)',
    },
    '& > svg': { color: 'currentColor' },
  }),
}

export const alertClass = cx(
  css({
    display: 'grid',
    gap: '0.125rem',
    borderRadius: 'xl',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    paddingInline: '0.75rem',
    paddingBlock: '0.625rem',
    textAlign: 'left',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    '&:has([data-slot="alert-action"])': {
      position: 'relative',
      paddingRight: '4.5rem',
    },
    '&:has(> svg)': {
      gridTemplateColumns: 'auto 1fr',
      columnGap: '0.5rem',
    },
    '& > svg': {
      gridRow: 'span 2 / span 2',
      translate: '0 0.125rem',
      color: 'currentColor',
    },
    '& > svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
    position: 'relative',
    width: '100%',
  }),
  'group-alert',
)

export const alertTitleClass = css({
  fontWeight: '500',
  '.group-alert:has(> svg) &': {
    gridColumnStart: '2',
  },
  '& a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '3px',
    _hover: { color: 'var(--foreground)' },
  },
})

export const alertDescriptionClass = css({
  color: 'var(--muted-foreground)',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  textWrap: 'balance',
  md: {
    textWrap: 'pretty',
  },
  '& p:not(:last-child)': {
    marginBottom: '1rem',
  },
  '& a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '3px',
    _hover: {
      color: 'var(--foreground)',
    },
  },
})

export const alertActionClass = css({
  position: 'absolute',
  top: '0.5rem',
  right: '0.5rem',
})

type StyleConfig = Readonly<{ className?: string; variant?: AlertVariant }>

const alertContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cx(alertClass, alertVariants[config.variant ?? 'default'], config.className)),
      h.Role('alert'),
      h.DataAttribute('slot', 'alert'),
      h.DataAttribute('variant', config.variant ?? 'default'),
    ],
    children,
  )

const alertTitle = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(alertTitleClass, config.className)), h.DataAttribute('slot', 'alert-title')],
    children,
  )

const alertDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cx(alertDescriptionClass, config.className)),
      h.DataAttribute('slot', 'alert-description'),
    ],
    children,
  )

/** Alert action — an absolutely positioned slot in the top-right corner; the
 *  container token reserves room for it via has-data-[slot=alert-action]. */
const alertAction = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(alertActionClass, config.className)), h.DataAttribute('slot', 'alert-action')],
    children,
  )

/**
 * Styled alert — `Alert.title`, `Alert.description` and `Alert.action`
 *  sub-builders.
 */
export const Alert = Object.assign(alertContainer, {
  title: alertTitle,
  description: alertDescription,
  action: alertAction,
})
