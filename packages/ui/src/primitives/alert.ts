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
    gap: '0.5',
    borderRadius: 'xl',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    paddingInline: '3',
    paddingBlock: '2.5',
    textAlign: 'left',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    '&:has([data-slot="alert-action"])': {
      position: 'relative',
      paddingRight: '18',
    },
    '&:has(> svg)': {
      gridTemplateColumns: 'auto 1fr',
      columnGap: '2',
    },
    '& > svg': {
      gridRow: 'span 2 / span 2',
      translate: '0 0.125rem',
      color: 'currentColor',
    },
    '& > svg:not([data-svg-icon])': { width: '4', height: '4' },
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
    _hover: { color: 'foreground' },
  },
})

export const alertDescriptionClass = css({
  color: 'mutedForeground',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  textWrap: 'balance',
  md: {
    textWrap: 'pretty',
  },
  '& p:not(:last-child)': {
    marginBottom: '4',
  },
  '& a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '3px',
    _hover: {
      color: 'foreground',
    },
  },
})

export const alertActionClass = css({
  position: 'absolute',
  top: '2',
  right: '2',
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
