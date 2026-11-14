import { css, cx } from '@quorum/styled-system/css'
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
      backgroundColor: 'border',
      marginRight: '1',
    },
    '&::after': {
      height: '1px',
      minWidth: '0',
      flex: '1 1 0%',
      backgroundColor: 'border',
      marginLeft: '1',
    },
  }),
  border: css({
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderColor: 'border',
    paddingBottom: '2',
  }),
}

export const markerClass = cx(
  css({
    gap: '2',
    fontSize: 'type.14',
    lineHeight: 'fine',
    color: 'mutedForeground',
    '& a': {
      _hover: { color: 'foreground' },
      textUnderlineOffset: '3px',
      textDecorationLine: 'underline',
    },
    '& svg:not([data-svg-icon])': { width: '4', height: '4' },
    minHeight: '4',
    textAlign: 'left',
    position: 'relative',
    display: 'flex',
    width: '100%',
    alignItems: 'center',
  }),
  'group-marker',
)

export const markerIconClass = css({
  width: '4',
  height: '4',
  '& svg:not([data-svg-icon])': {
    width: '4',
    height: '4',
  },
  flexShrink: '0',
})

export const markerContentClass = css({
  '.group-marker[data-variant=separator] &': {
    flex: 'none',
    textAlign: 'center',
  },
  '& > a': {
    _hover: { color: 'foreground' },
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
      h.Class(cx(markerClass, markerVariants[config.variant ?? 'default'], config.className)),
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
      h.Class(cx(markerIconClass, config.className)),
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
    [h.Class(cx(markerContentClass, config.className)), h.DataAttribute('slot', 'marker-content')],
    children,
  )

/** Styled marker — `Marker.icon` and `Marker.content` sub-builders. Mirrors the
 *  shadcn v4 `marker.tsx`. */
export const Marker = Object.assign(markerContainer, {
  icon: markerIcon,
  content: markerContent,
})
