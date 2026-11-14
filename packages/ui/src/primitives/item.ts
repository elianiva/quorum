import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

export const itemGroupClass = css({
  gap: '4',
  '&:has([data-size="sm"])': { gap: '2.5' },
  '&:has([data-size="xs"])': { gap: '2' },
  display: 'flex',
  width: '100%',
  flexDirection: 'column',
})

export const itemSeparatorClass = css({
  marginBlock: '2',
})

export const itemVariantKeys = ['default', 'outline', 'muted'] as const
export type ItemVariant = (typeof itemVariantKeys)[number]

export const itemVariants: Record<ItemVariant, string> = {
  default: css({ borderColor: 'transparent' }),
  outline: css({
    layerStyle: 'raised',
    boxShadow: 'raised',
    borderColor: 'transparent',
  }),
  muted: css({
    backgroundColor: 'nested',
    boxShadow: 'inset 0 0 0 1px var(--hairline-soft)',
    borderColor: 'transparent',
  }),
}

export const itemSizeKeys = ['default', 'sm', 'xs'] as const
export type ItemSize = (typeof itemSizeKeys)[number]

export const itemSizes: Record<ItemSize, string> = {
  default: css({
    gap: '2.5',
    paddingInline: '3',
    paddingBlock: '2.5',
  }),
  sm: css({
    gap: '2.5',
    paddingInline: '3',
    paddingBlock: '2.5',
  }),
  xs: css({
    gap: '2',
    paddingInline: '2.5',
    paddingBlock: '2',
    '[data-slot="dropdown-menu-content"] &': { padding: '0' },
  }),
}

export const itemClass = cx(
  css({
    '& a': {
      _hover: { backgroundColor: 'muted' },
      transitionProperty:
        'color, background-color, border-color, text-decoration-color, fill, stroke',
      transitionTimingFunction: 'default',
      transitionDuration: 'default',
    },
    borderRadius: 'xl',
    borderWidth: '1px',
    borderStyle: 'solid',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    display: 'flex',
    width: '100%',
    flexWrap: 'wrap',
    alignItems: 'center',
    transitionProperty:
      'color, background-color, border-color, text-decoration-color, fill, stroke',
    transitionTimingFunction: 'default',
    transitionDuration: '100ms',
    outlineStyle: 'none',
    _focusVisible: {
      borderColor: 'ring',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    },
  }),
  'group-item',
)

export const itemMediaVariantKeys = ['default', 'icon', 'image'] as const
export type ItemMediaVariant = (typeof itemMediaVariantKeys)[number]

export const itemMediaVariants: Record<ItemMediaVariant, string> = {
  default: css({ backgroundColor: 'transparent' }),
  icon: css({
    '& svg:not([data-svg-icon])': { width: '4', height: '4' },
  }),
  image: css({
    width: '10',
    height: '10',
    overflow: 'hidden',
    borderRadius: 'sm',
    '.group-item[data-size=sm] &': { width: '8', height: '8' },
    '.group-item[data-size=xs] &': { width: '6', height: '6' },
    '& img': { width: '100%', height: '100%', objectFit: 'cover' },
  }),
}

export const itemMediaClass = css({
  gap: '2',
  '.group-item:has([data-slot="item-description"]) &': {
    translate: '0 0.125rem',
    alignSelf: 'flex-start',
  },
  display: 'flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  '& svg': { pointerEvents: 'none' },
})

export const itemContentClass = css({
  gap: '1',
  '.group-item[data-size=xs] &': {
    gap: '0',
  },
  display: 'flex',
  flex: '1 1 0%',
  flexDirection: 'column',
  '&+[data-slot=item-content]': {
    flex: 'none',
  },
})

export const itemTitleClass = css({
  gap: '2',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1.375',
  fontWeight: '500',
  textUnderlineOffset: '4',
  lineClamp: '1',
  display: 'flex',
  width: 'fit-content',
  alignItems: 'center',
})

export const itemDescriptionClass = css({
  color: 'mutedForeground',
  textAlign: 'left',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1.5',
  '.group-item[data-size=xs] &': {
    fontSize: 'calc(0.75rem * var(--type-scale))',
    lineHeight: 'calc(1 / 0.75)',
  },
  lineClamp: '2',
  fontWeight: '400',
  '&>a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '4',
  },
  '&>a:hover': {
    color: 'primary',
  },
})

export const itemActionsClass = css({
  gap: '2',
  display: 'flex',
  alignItems: 'center',
})
export const itemHeaderClass = css({
  gap: '2',
  display: 'flex',
  flexBasis: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
})
export const itemFooterClass = css({
  gap: '2',
  display: 'flex',
  flexBasis: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
})

type StyleConfig = Readonly<{ className?: string }>

type ItemConfig = Readonly<{
  variant?: ItemVariant
  size?: ItemSize
  className?: string
}>

type ItemMediaConfig = Readonly<{ variant?: ItemMediaVariant; className?: string }>

type ItemSeparatorConfig = Readonly<{
  orientation?: 'horizontal' | 'vertical'
  className?: string
}>

const itemGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Role('list'),
      h.Class(cx(itemGroupClass, config.className)),
      h.DataAttribute('slot', 'item-group'),
    ],
    children,
  )

const itemSeparator = <M>(config: ItemSeparatorConfig, h: HtmlBuilder<M>): Html =>
  h.div(
    [
      h.Class(cx(itemSeparatorClass, config.className)),
      h.Role('separator'),
      h.AriaOrientation(config.orientation ?? 'horizontal'),
      h.DataAttribute('slot', 'item-separator'),
      h.DataAttribute('orientation', config.orientation ?? 'horizontal'),
      h.DataAttribute(config.orientation ?? 'horizontal', ''),
    ],
    [],
  )

const itemContainer = <M>(
  config: ItemConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(
        cx(
          itemClass,
          itemVariants[config.variant ?? 'default'],
          itemSizes[config.size ?? 'default'],
          config.className,
        ),
      ),
      h.DataAttribute('slot', 'item'),
      h.DataAttribute('variant', config.variant ?? 'default'),
      h.DataAttribute('size', config.size ?? 'default'),
    ],
    children,
  )

const itemMedia = <M>(
  config: ItemMediaConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cx(itemMediaClass, itemMediaVariants[config.variant ?? 'default'], config.className)),
      h.DataAttribute('slot', 'item-media'),
      h.DataAttribute('variant', config.variant ?? 'default'),
    ],
    children,
  )

const itemContent = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(itemContentClass, config.className)), h.DataAttribute('slot', 'item-content')],
    children,
  )

const itemTitle = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(itemTitleClass, config.className)), h.DataAttribute('slot', 'item-title')],
    children,
  )

const itemDescription = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.p(
    [
      h.Class(cx(itemDescriptionClass, config.className)),
      h.DataAttribute('slot', 'item-description'),
    ],
    children,
  )

const itemActions = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(itemActionsClass, config.className)), h.DataAttribute('slot', 'item-actions')],
    children,
  )

const itemHeader = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(itemHeaderClass, config.className)), h.DataAttribute('slot', 'item-header')],
    children,
  )

const itemFooter = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cx(itemFooterClass, config.className)), h.DataAttribute('slot', 'item-footer')],
    children,
  )

/** Styled item — a flexible list row with `Item.group`, `Item.separator`,
 *  `Item.media`, `Item.content`, `Item.title`, `Item.description`,
 *  `Item.actions`, `Item.header`, `Item.footer` sub-builders. Mirrors the
 *  shadcn v4 `item.tsx`. */
export const Item = Object.assign(itemContainer, {
  group: itemGroup,
  separator: itemSeparator,
  media: itemMedia,
  content: itemContent,
  title: itemTitle,
  description: itemDescription,
  actions: itemActions,
  header: itemHeader,
  footer: itemFooter,
})
