import { css, cx, cx as cn } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

// Card is a pure layout primitive (no @foldkit/ui backing — there is no
// headless Card). `Card` itself is the container; sub-builders are attached
// as properties: Card.header, Card.title, Card.description, Card.action,
// Card.content, Card.footer.

export const cardSizeKeys = ['default', 'sm'] as const
export type CardSize = (typeof cardSizeKeys)[number]

export const cardClass = cx(
  css({
    layerStyle: 'surface',
    boxShadow: 'card',
    color: 'cardForeground',
    gap: 'var(--card-spacing)',
    overflow: 'hidden',
    borderRadius: '2xl',
    paddingBlock: 'var(--card-spacing)',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    '--card-spacing': '1rem',
    '&:has([data-slot="card-footer"])': { paddingBottom: '0' },
    '&:has(> img:first-child)': { paddingTop: '0' },
    '&[data-size="sm"]': { '--card-spacing': '0.75rem' },
    '&[data-size="sm"]:has([data-slot="card-footer"])': { paddingBottom: '0' },
    '& > img:first-child': {
      borderTopLeftRadius: '2xl',
      borderTopRightRadius: '2xl',
    },
    '& > img:last-child': {
      borderBottomLeftRadius: '2xl',
      borderBottomRightRadius: '2xl',
    },
    display: 'flex',
    flexDirection: 'column',
  }),
  'group-card',
)

export const cardHeaderClass = css({
  gap: '0.25rem',
  borderTopLeftRadius: '2xl',
  borderTopRightRadius: '2xl',
  paddingInline: 'var(--card-spacing)',
  '&.border-b': { paddingBottom: 'var(--card-spacing)' },
  containerType: 'inline-size',
  containerName: 'card-header',
  display: 'grid',
  gridAutoRows: 'min-content',
  alignItems: 'flex-start',
  '&:has([data-slot="card-action"])': { gridTemplateColumns: '1fr auto' },
  '&:has([data-slot="card-description"])': { gridTemplateRows: 'auto auto' },
})

export const cardTitleClass = css({
  fontSize: 'calc(1rem * var(--type-scale))',
  lineHeight: '1.375',
  fontWeight: '500',
  '.group-card[data-size=sm] &': {
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
  },
  fontFamily: 'heading',
})

export const cardDescriptionClass = css({
  color: 'var(--muted-foreground)',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
})

export const cardContentClass = css({
  paddingInline: 'var(--card-spacing)',
})

export const cardActionClass = css({
  gridColumnStart: '2',
  gridRow: 'span 2 / span 2',
  gridRowStart: '1',
  alignSelf: 'flex-start',
  justifySelf: 'end',
})

export const cardFooterClass = css({
  backgroundColor: 'var(--surface-nested)',
  borderBottomLeftRadius: '2xl',
  borderBottomRightRadius: '2xl',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'var(--hairline)',
  padding: 'var(--card-spacing)',
  display: 'flex',
  alignItems: 'center',
})

type StyleConfig = Readonly<{ className?: string }>

type CardConfig = Readonly<{ className?: string; size?: CardSize }>

const cardContainer = <M>(
  config: CardConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cn(cardClass, config.className)),
      h.DataAttribute('slot', 'card'),
      h.DataAttribute('size', config.size ?? 'default'),
    ],
    children,
  )

/** Header wrapper — positions title, description and action via CSS grid. */
const cardHeader = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(cardHeaderClass, config.className)), h.DataAttribute('slot', 'card-header')],
    children,
  )

const cardTitle = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(cardTitleClass, config.className)), h.DataAttribute('slot', 'card-title')],
    children,
  )

const cardDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cn(cardDescriptionClass, config.className)),
      h.DataAttribute('slot', 'card-description'),
    ],
    children,
  )

/** Action area pinned to the top-right of the header. */
const cardAction = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(cardActionClass, config.className)), h.DataAttribute('slot', 'card-action')],
    children,
  )

const cardContent = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(cardContentClass, config.className)), h.DataAttribute('slot', 'card-content')],
    children,
  )

const cardFooter = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(cardFooterClass, config.className)), h.DataAttribute('slot', 'card-footer')],
    children,
  )

/** Composable card — `Card` is the container, with sub-builders as
 *  properties: `Card.header`, `Card.title`, `Card.description`,
 *  `Card.action`, `Card.content`, `Card.footer`. */
export const Card = Object.assign(cardContainer, {
  header: cardHeader,
  title: cardTitle,
  description: cardDescription,
  action: cardAction,
  content: cardContent,
  footer: cardFooter,
})
