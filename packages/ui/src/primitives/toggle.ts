import { css, cx } from '@quorum/styled-system/css'
import { Function, Schema as S, Match } from 'effect'
import type { Html } from 'foldkit/html'
import * as Update from 'foldkit/update'
import { defineMessageUnion } from 'foldkit/message'
import type { Reflect } from 'foldkit/submodel'
import { defineView } from 'foldkit/submodel'
import { modifyFields } from 'foldkit/struct'

// Toggle is a two-state button (pressed / not) marked with `aria-pressed` and
// `data-state`. It owns its pressed state as a Submodel: embed it with
// `h.submodel` and listen for `ChangedPressed` if your app needs to react.
// Conform an externally-driven pressed state (URL, storage) with `reflect`.

export const toggleVariantKeys = ['default', 'outline'] as const
export type ToggleVariant = (typeof toggleVariantKeys)[number]

export const toggleVariants: Record<ToggleVariant, string> = {
  default: css({ backgroundColor: 'transparent' }),
  outline: css({
    backgroundColor: 'well',
    boxShadow: 'well',
  }),
}

export const toggleSizeKeys = ['default', 'sm', 'lg'] as const
export type ToggleSize = (typeof toggleSizeKeys)[number]

export const toggleSizes: Record<ToggleSize, string> = {
  default: css({
    height: '2rem',
    minWidth: '2rem',
    paddingInline: '0.625rem',
    '&:has([data-icon="inline-end"])': { paddingRight: '0.5rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.5rem' },
  }),
  sm: css({
    height: '1.75rem',
    minWidth: '1.75rem',
    borderRadius: 'min(var(--radius-md), 12px)',
    paddingInline: '0.625rem',
    fontSize: 'calc(0.8rem * var(--type-scale))',
    '&:has([data-icon="inline-end"])': { paddingRight: '0.375rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.375rem' },
    '& svg:not([data-svg-icon])': { width: '0.875rem', height: '0.875rem' },
  }),
  lg: css({
    height: '2.25rem',
    minWidth: '2.25rem',
    paddingInline: '0.625rem',
    '&:has([data-icon="inline-end"])': { paddingRight: '0.5rem' },
    '&:has([data-icon="inline-start"])': { paddingLeft: '0.5rem' },
  }),
}

/** Upstream cva base string. The disabled: variants are inert under foldkit
 *  (this view emits native disabled; twins kept for parity). */
export const toggleBase = css({
  _hover: {
    color: 'foreground',
    backgroundColor: 'color-mix(in oklab, var(--foreground) 5%, transparent)',
  },
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
  },
  '&[data-state=on]': {
    layerStyle: 'raised',
    boxShadow: 'raised',
    color: 'foreground',
    _hover: { layerStyle: 'raised' },
  },
  color: 'mutedForeground',
  gap: '0.25rem',
  borderRadius: 'lg',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  transitionProperty: 'all',
  transitionDuration: 'var(--default-transition-duration)',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  outlineStyle: 'none',
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
})

// MODEL

export const Model = S.Struct({
  id: S.String,
  isPressed: S.Boolean,
})
export type Model = typeof Model.Type

// MESSAGES

/** The user clicked the toggle. Flips the pressed state. */
export const Message = defineMessageUnion({
  Toggled: {},
})
export type Message = typeof Message.Type

export const OutMessage = defineMessageUnion({
  ChangedPressed: { isPressed: S.Boolean },
})
export type OutMessage = typeof OutMessage.Type

// INIT / UPDATE

export type InitConfig = Readonly<{
  id: string
  isPressed?: boolean
}>

export const init = (config: InitConfig): Model => ({
  id: config.id,
  isPressed: config.isPressed ?? false,
})

/** Conforms an externally-driven pressed state onto the model without
 *  emitting an OutMessage (the world is the source of truth). */
export const reflect: Reflect<Model, boolean> = Function.dual(
  2,
  (model: Model, isPressed: boolean): Model => modifyFields(model, { isPressed: () => isPressed }),
)

type UpdateReturn = Update.ReturnWithOutMessage<Model, Message, OutMessage>

/** Processes a toggle message and returns the next model, commands, and an
 *  optional out-message for the parent. */
export const update = (model: Model, message: Message): UpdateReturn => {
  return Match.value(message).pipe(
    Match.tagsExhaustive({
      Toggled: () => {
        const isPressed = !model.isPressed
        return {
          model: modifyFields(model, { isPressed: () => isPressed }),
          outMessage: OutMessage.ChangedPressed({ isPressed }),
        }
      },
    }),
  )
}

// VIEW

export type ViewInputs = Readonly<{
  label: Html | string
  variant?: ToggleVariant
  size?: ToggleSize
  /** Marks the toggle unavailable with a native disabled attribute. */
  isDisabled?: boolean
  ariaLabel?: string
  className?: string
}>

/** Renders the two-state toggle button. Embedded via `h.submodel`. */
export const view = defineView<Model, Message, ViewInputs>((model, viewInputs, h) =>
  h.button(
    [
      h.Type('button'),
      ...(viewInputs.ariaLabel === undefined ? [] : [h.AriaLabel(viewInputs.ariaLabel)]),
      ...(viewInputs.isDisabled === true ? [h.Disabled(true)] : []),
      h.OnClick(Message.Toggled()),
      h.DataAttribute('slot', 'toggle'),
      h.DataAttribute('state', model.isPressed ? 'on' : 'off'),
      h.AriaPressed(model.isPressed ? 'true' : 'false'),
      h.Class(
        cx(
          toggleBase,
          toggleVariants[viewInputs.variant ?? 'default'],
          toggleSizes[viewInputs.size ?? 'default'],
          viewInputs.className,
        ),
      ),
    ],
    [viewInputs.label],
  ),
)
