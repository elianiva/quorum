import { css, cx, cx as cn } from '@quorum/styled-system/css'
import { Schema as S } from 'effect'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineView } from 'foldkit/submodel'
import * as Update from 'foldkit/update'

type Child = Html | string

/**
 * Known foldkit gap: upstream swaps image→fallback automatically via the
 * Base UI Avatar primitive; foldkit has no such primitive, so `Avatar.image`
 * always renders `<img>`. `Avatar.picture` (below) closes that gap itself —
 * a tiny submodel that swaps to the fallback on load error — so most
 * consumers never need to touch `Avatar.image`/`Avatar.fallback` directly.
 */

export const avatarSizeKeys = ['default', 'sm', 'lg'] as const
export type AvatarSize = (typeof avatarSizeKeys)[number]

export const avatarClass = cx(
  css({
    width: '2rem',
    height: '2rem',
    borderRadius: '9999px',
    '&::after': {
      borderRadius: '9999px',
      position: 'absolute',
      inset: '0',
      borderWidth: '1px',
      borderStyle: 'solid',
      borderColor: 'var(--border)',
      mixBlendMode: 'darken',
    },
    '&[data-size="lg"]': { width: '2.5rem', height: '2.5rem' },
    '&[data-size="sm"]': { width: '1.5rem', height: '1.5rem' },
    position: 'relative',
    display: 'flex',
    flexShrink: '0',
    userSelect: 'none',
    _dark: {
      '&::after': { mixBlendMode: 'lighten' },
    },
  }),
  'group-avatar',
)

export const avatarImageClass = css({
  borderRadius: '9999px',
  aspectRatio: '1 / 1',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
})

export const avatarFallbackClass = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  color: 'var(--muted-foreground)',
  borderRadius: '9999px',
  display: 'flex',
  width: '100%',
  height: '100%',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  '.group-avatar[data-size=sm] &': {
    fontSize: 'calc(0.75rem * var(--type-scale))',
    lineHeight: 'calc(1 / 0.75)',
  },
})

export const avatarBadgeClass = css({
  backgroundColor: 'primary',
  color: 'primaryForeground',
  boxShadow: '0 0 0 2px var(--background)',
  position: 'absolute',
  right: '0',
  bottom: '0',
  zIndex: '10',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '9999px',
  backgroundBlendMode: 'color',
  userSelect: 'none',
  '.group-avatar[data-size=sm] &': {
    width: '0.5rem',
    height: '0.5rem',
    '& > svg': { display: 'none' },
  },
  '.group-avatar[data-size=default] &': {
    width: '0.625rem',
    height: '0.625rem',
    '& > svg': { width: '0.5rem', height: '0.5rem' },
  },
  '.group-avatar[data-size=lg] &': {
    width: '0.75rem',
    height: '0.75rem',
    '& > svg': { width: '0.5rem', height: '0.5rem' },
  },
})

export const avatarGroupClass = cx(
  css({
    display: 'flex',
    '& > :not(:last-child)': { marginInlineEnd: '-0.5rem' },
    '& > [data-slot="avatar"]': { boxShadow: '0 0 0 2px var(--background)' },
  }),
  'group-avatar-group',
)

export const avatarGroupCountClass = css({
  backgroundColor: 'muted',
  color: 'mutedForeground',
  width: '2rem',
  height: '2rem',
  borderRadius: '9999px',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  '.group-avatar-group:has([data-size=lg]) &': {
    width: '2.5rem',
    height: '2.5rem',
    '& > svg': { width: '1.25rem', height: '1.25rem' },
  },
  '.group-avatar-group:has([data-size=sm]) &': {
    width: '1.5rem',
    height: '1.5rem',
    '& > svg': { width: '0.75rem', height: '0.75rem' },
  },
  '& > svg': { width: '1rem', height: '1rem' },
  position: 'relative',
  display: 'flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 0 0 2px var(--background)',
})

type StyleConfig = Readonly<{ className?: string }>

type AvatarConfig = Readonly<{ size?: AvatarSize; className?: string }>

type AvatarImageConfig = Readonly<{ src: string; alt?: string; className?: string }>

const avatarContainer = <M>(
  config: AvatarConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(avatarClass, config.className)),
      h.DataAttribute('slot', 'avatar'),
      h.DataAttribute('size', config.size ?? 'default'),
    ],
    children,
  )

const avatarImage = <M>(config: AvatarImageConfig, h: HtmlBuilder<M>): Html =>
  h.img([
    h.Src(config.src),
    ...(config.alt === undefined ? [] : [h.Alt(config.alt)]),
    h.Class(cn(avatarImageClass, config.className)),
    h.DataAttribute('slot', 'avatar-image'),
  ])

/** `Avatar.picture`'s submodel — tracks whether the image has errored, so
 *  the fallback swap-in is owned by the component instead of the consumer. */
export const Model = S.Struct({ hasError: S.Boolean })
export type Model = typeof Model.Type

export const init: Model = { hasError: false }

export const Message = defineMessageUnion({
  ImageErrored: {},
})
export type Message = typeof Message.Type

export const update = (_model: Model, _message: Message): Update.Return<Model, Message> => ({
  model: { hasError: true },
})

export type PictureConfig = Readonly<{
  id: string
  src: string
  alt?: string
  fallback: ReadonlyArray<Child>
  className?: string
  fallbackClassName?: string
}>

const pictureView = defineView<Model, Message, PictureConfig>((model, config, h) =>
  model.hasError
    ? avatarFallback(
        config.fallbackClassName === undefined ? {} : { className: config.fallbackClassName },
        config.fallback,
        h,
      )
    : h.img([
        h.Src(config.src),
        ...(config.alt === undefined ? [] : [h.Alt(config.alt)]),
        h.Class(cn(avatarImageClass, config.className)),
        h.DataAttribute('slot', 'avatar-image'),
        h.OnError(Message.ImageErrored()),
      ]),
)

/** Image with an automatic fallback swap on load error — the piece upstream
 *  gets for free from the Base UI Avatar primitive. `model` is this
 *  instance's own `Model` (usually a field on the consumer's own state, one
 *  per avatar); `toParentMessage` maps this module's `Message` into the
 *  consumer's own message type, the same way `h.submodel`'s callers do
 *  elsewhere (see `Dialog`/`HoverCard`). */
const avatarPicture = <M>(
  config: PictureConfig,
  model: Model,
  toParentMessage: (message: Message) => M,
  h: HtmlBuilder<M>,
): Html =>
  h.submodel({
    slotId: config.id,
    model,
    view: pictureView,
    viewInputs: config,
    toParentMessage,
  })

const avatarFallback = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [
      h.Class(cn(avatarFallbackClass, config.className)),
      h.DataAttribute('slot', 'avatar-fallback'),
    ],
    children,
  )

const avatarBadge = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.span(
    [h.Class(cn(avatarBadgeClass, config.className)), h.DataAttribute('slot', 'avatar-badge')],
    children,
  )

const avatarGroup = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.Class(cn(avatarGroupClass, config.className)), h.DataAttribute('slot', 'avatar-group')],
    children,
  )

const avatarGroupCount = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [
      h.Class(cn(avatarGroupCountClass, config.className)),
      h.DataAttribute('slot', 'avatar-group-count'),
    ],
    children,
  )

/** Styled avatar — image + fallback, with optional status badge and grouping.
 *  Mirrors the shadcn v4 `avatar.tsx` (no Radix primitive; the foldcn registry
 *  renders the same `data-slot` surface). */
export const Avatar = Object.assign(avatarContainer, {
  image: avatarImage,
  fallback: avatarFallback,
  badge: avatarBadge,
  group: avatarGroup,
  groupCount: avatarGroupCount,
  picture: avatarPicture,
})
