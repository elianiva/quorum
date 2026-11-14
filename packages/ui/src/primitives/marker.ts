import { css, cx, cx as cn } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const markerVariantKeys = ['default', 'separator', 'border'] as const
export type MarkerVariant = (typeof markerVariantKeys)[number]

export const markerVariants: Record<MarkerVariant, string> = {
  default: '',
  separator: css({
    '&::before': {
      height: '1px',
      minWidth: '0',
      flex: '1 1 0%',
      backgroundColor: 'var(--border)',
      marginRight: '0.25rem',
    },
    '&::after': {
      height: '1px',
      minWidth: '0',
      flex: '1 1 0%',
      backgroundColor: 'var(--border)',
      marginLeft: '0.25rem',
    },
  }),
  border: css({
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'border',
    paddingBottom: '0.5rem',
  }),
}

export const markerClass = cx(
  css({
    gap: '0.5rem',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    color: 'mutedForeground',
    '& a': {
      _hover: { color: 'var(--foreground)' },
      textUnderlineOffset: '3px',
      textDecorationLine: 'underline',
    },
    '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
    minHeight: '1rem',
    textAlign: 'left',
    position: 'relative',
    display: 'flex',
    width: '100%',
    alignItems: 'center',
  }),
  'group-marker',
)

export const markerIconClass = css({
  width: '1rem',
  height: '1rem',
  '& svg:not([data-svg-icon])': {
    width: '1rem',
    height: '1rem',
  },
  flexShrink: '0',
})

export const markerContentClass = css({
  '.group-marker[data-variant=separator] &': {
    flex: 'none',
    textAlign: 'center',
  },
  '& > a': {
    _hover: { color: 'var(--foreground)' },
    textDecorationLine: 'underline',
    textUnderlineOffset: '3px',
  },
  minWidth: '0',
  overflowWrap: 'break-word',
})

type StyleConfig = Readonly<{ className?: string; variant?: MarkerVariant }>

const markerContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cn(markerClass, markerVariants[config.variant ?? 'default'], config.className)),
      h.DataAttribute('slot', 'marker'),
      h.DataAttribute('variant', config.variant ?? 'default'),
    ],
    children,
  )

const markerIcon = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(markerIconClass, config.className)),
      h.AriaHidden(true),
      h.DataAttribute('slot', 'marker-icon'),
    ],
    children,
  )

const markerContent = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cn(markerContentClass, config.className)), h.DataAttribute('slot', 'marker-content')],
    children,
  )

/** Styled marker — `Marker.icon` and `Marker.content` sub-builders. Mirrors the
 *  shadcn v4 `marker.tsx`. */
export const Marker = Object.assign(markerContainer, {
  icon: markerIcon,
  content: markerContent,
})
