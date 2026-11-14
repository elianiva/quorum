import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const emptyClass = css({
  gap: '1rem',
  borderRadius: 'xl',
  borderStyle: 'dashed',
  padding: '1.5rem',
  display: 'flex',
  width: '100%',
  minWidth: '0',
  flex: '1 1 0%',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  textWrap: 'balance',
})

export const emptyHeaderClass = css({
  gap: '0.5rem',
  display: 'flex',
  maxWidth: '24rem',
  flexDirection: 'column',
  alignItems: 'center',
})

export const emptyMediaVariantKeys = ['default', 'icon'] as const
export type EmptyMediaVariant = (typeof emptyMediaVariantKeys)[number]

export const emptyMediaClass = css({
  marginBottom: '0.5rem',
  display: 'flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': {
    pointerEvents: 'none',
    flexShrink: '0',
  },
})

export const emptyMediaVariants: Record<EmptyMediaVariant, string> = {
  default: css({ backgroundColor: 'transparent' }),
  icon: css({
    layerStyle: 'raised',
    boxShadow: 'raised',
    color: 'foreground',
    display: 'flex',
    width: '2.25rem',
    height: '2.25rem',
    flexShrink: '0',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'lg',
    '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
  }),
}

export const emptyTitleClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  letterSpacing: '-0.025em',
  fontFamily: 'heading',
})

export const emptyDescriptionClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1.625',
  color: 'mutedForeground',
  '& > a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '4px',
    _hover: { color: 'primary' },
  },
})

export const emptyContentClass = css({
  gap: '0.625rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  display: 'flex',
  width: '100%',
  maxWidth: '24rem',
  minWidth: '0',
  flexDirection: 'column',
  alignItems: 'center',
  textWrap: 'balance',
})

type StyleConfig = Readonly<{ className?: string }>

type EmptyMediaConfig = Readonly<{ variant?: EmptyMediaVariant; className?: string }>

const emptyContainer = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div([h.Class(cx(emptyClass, config.className)), h.DataAttribute('slot', 'empty')], children)

const emptyHeader = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(emptyHeaderClass, config.className)), h.DataAttribute('slot', 'empty-header')],
    children,
  )

const emptyMedia = <M>(
  config: EmptyMediaConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(
        cx(emptyMediaClass, emptyMediaVariants[config.variant ?? 'default'], config.className),
      ),
      h.DataAttribute('slot', 'empty-icon'),
      h.DataAttribute('variant', config.variant ?? 'default'),
    ],
    children,
  )

const emptyTitle = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(emptyTitleClass, config.className)), h.DataAttribute('slot', 'empty-title')],
    children,
  )

const emptyDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cx(emptyDescriptionClass, config.className)),
      h.DataAttribute('slot', 'empty-description'),
    ],
    children,
  )

const emptyContent = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(emptyContentClass, config.className)), h.DataAttribute('slot', 'empty-content')],
    children,
  )

/** Styled empty state — `Empty.header`, `Empty.media`, `Empty.title`,
 *  `Empty.description`, `Empty.content` sub-builders. Mirrors the shadcn v4
 *  `empty.tsx`. */
export const Empty = Object.assign(emptyContainer, {
  header: emptyHeader,
  media: emptyMedia,
  title: emptyTitle,
  description: emptyDescription,
  content: emptyContent,
})
