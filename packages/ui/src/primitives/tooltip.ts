import { css, cx, cx as cn } from '@quorum/styled-system/css'
import { Tooltip as FoldkitTooltip } from '@foldkit/ui'
import type { AnchorConfig } from '@foldkit/ui/tooltip'
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

// Re-export the @foldkit/ui Tooltip submodel surface.

export const Model = FoldkitTooltip.Model
export type Model = typeof Model.Type

export const Message = FoldkitTooltip.Message
export type Message = typeof Message.Type

export const OutMessage = FoldkitTooltip.OutMessage
export type OutMessage = typeof OutMessage.Type

export const update = FoldkitTooltip.update
export const reflectShowDelay = FoldkitTooltip.reflectShowDelay
export const triggerId = FoldkitTooltip.triggerId
export const view = FoldkitTooltip.view

export type RenderInfo = FoldkitTooltip.RenderInfo

export type InitConfig = FoldkitTooltip.InitConfig

/** Hover-to-show delay in milliseconds. Matches the shadcn reference
 *  `TooltipProvider` default (`delay = 0`): tooltips appear immediately on
 *  hover/focus. Pass `showDelay` (e.g. `Duration.millis(400)` or `'400 millis'`)
 *  to wait before revealing. */
export const DEFAULT_SHOW_DELAY = 0

/** Create an initial tooltip model. Defaults the delay to `0` (immediate),
 *  matching the shadcn base tooltip. Any caller-supplied `showDelay` wins. */
export const init = (config: InitConfig): Model =>
  FoldkitTooltip.init({ showDelay: DEFAULT_SHOW_DELAY, ...config })

/** Default anchor matching the shadcn reference `TooltipContent` defaults:
 *  `side="top"`, `sideOffset=4`, `align="center"`, `alignOffset=0`.
 *  `placement` maps side+align (a bare side centers the tooltip), `gap` maps
 *  sideOffset, `offset` maps alignOffset and defaults to 0. */
export const TOOLTIP_ANCHOR: AnchorConfig = {
  placement: 'top',
  gap: 4,
}

export const tooltipTriggerClass = css({
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'border',
  backgroundClip: 'padding-box',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1.4285714285714286',
  fontWeight: '500',
  backgroundColor: 'background',
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
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
    backgroundColor: 'color-mix(in oklab, var(--input) 30%, transparent)',
    borderColor: 'input',
    _hover: { backgroundColor: 'color-mix(in oklab, var(--input) 50%, transparent)' },
  },
  '&:active:not([aria-haspopup])': { translate: '0 1px' },
  '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
  display: 'inline-flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  transitionProperty: 'all',
  transitionDuration: 'var(--default-transition-duration)',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  outlineStyle: 'none',
  userSelect: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  _hover: { backgroundColor: 'muted', color: 'foreground' },
  '&[aria-expanded]': { backgroundColor: 'muted', color: 'foreground' },
  height: '2rem',
  gap: '0.375rem',
  paddingInline: '0.625rem',
  '&:has([data-icon="inline-end"])': { paddingRight: '0.5rem' },
  '&:has([data-icon="inline-start"])': { paddingLeft: '0.5rem' },
})

/**
 * The foldkit anchor writes the resolved side to `data-placement`; this view
 * additionally emits `data-side` so upstream's data-[side=…] variants resolve.
 *
 */
export const tooltipContentClass = cx(
  css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.375rem',
    borderRadius: 'lg',
    paddingInline: '0.625rem',
    paddingBlock: '0.375rem',
    fontSize: 'calc(0.75rem * var(--type-scale))',
    lineHeight: 'calc(1 / 0.75)',
    '&:has([data-slot="kbd"])': { paddingRight: '0.375rem' },
    '& [data-slot="kbd"]': {
      position: 'relative',
      isolation: 'isolate',
      zIndex: '50',
      borderRadius: 'sm',
    },
    maxHeight: 'none!',
    overflow: 'visible!',
    zIndex: '50',
    width: 'fit-content',
    maxWidth: '20rem',
    transformOrigin: 'var(--transform-origin)',
    backgroundColor: 'foreground',
    color: 'background',
    boxShadow: 'float',
  }),
  'enter-pop',
)

// Mirrors the shadcn v4 base tooltip arrow (`cn-tooltip-arrow` +
// `cn-tooltip-arrow-logical` + Arrow props), inlined and mapped to
// `data-placement`. The logical (`inline-start`/`inline-end`) variants are
// omitted: foldkit placements are always physical (LTR), so the physical
// left/right rules already cover them. `absolute` is added because foldcn
// renders its own arrow element where base-ui's Arrow is positioned by the
// library; the panel's inline `position: absolute` (from the anchor mount)
// is its containing block.
/** Upstream arrow string plus `absolute` (foldcn renders its own arrow
 *  element where Base UI positions the Arrow itself). Side variants key on
 *  the emitted data-side attribute. */
export const tooltipArrowClass = css({
  '&[data-side="bottom"]': {
    left: '50%',
    translate: '-50% 0',
    top: '0.25rem',
  },
  '&[data-side="top"]': {
    left: '50%',
    translate: '-50% 0',
    bottom: '-0.625rem',
  },
  '&[data-side="inline-end"]': {
    top: '50% !important',
    left: '-0.25rem',
    translate: '0 -50%',
  },
  '&[data-side="inline-start"]': {
    top: '50% !important',
    right: '-0.25rem',
    translate: '0 -50%',
  },
  position: 'absolute',
  zIndex: '50',
  backgroundColor: 'var(--foreground)',
  fill: 'var(--foreground)',
  width: '0.625rem',
  height: '0.625rem',
  rotate: '45deg',
  borderRadius: '2px',
  translate: '0 calc(-50% - 2px)',
  '&[data-side="left"]': {
    top: '50% !important',
    right: '-0.25rem',
    translate: '0 -50%',
  },
  '&[data-side="right"]': {
    top: '50% !important',
    left: '-0.25rem',
    translate: '0 -50%',
  },
})

export const tooltipWrapperClass = css({
  position: 'relative',
  display: 'inline-block',
})

export type StyledViewInputs<M = never> = Readonly<{
  /** Positioning overrides. Defaults to `TOOLTIP_ANCHOR`
   *  (`placement: 'top'`, `gap: 4`), matching the shadcn reference. */
  anchor?: AnchorConfig
  trigger: Child
  content: Child
  className?: string
  triggerClass?: string
  contentClass?: string
  wrapperClass?: string
  /** When true, the trigger is skipped by keyboard focus and only pointer
   *  hover can reveal the tooltip. */
  hoverOnly?: boolean
  /** Attributes applied to the generated trigger element. */
  triggerAttributes?: ReadonlyArray<Attribute<M> | ChildAttribute>
}>

/** Build styled `Tooltip.ViewInputs`. Pass your view's `h`. */
export const styledViewInputs = <M>(
  viewInputs: StyledViewInputs<M>,
  h: HtmlBuilder<M>,
): FoldkitTooltip.ViewInputs => {
  const anchor = { ...TOOLTIP_ANCHOR, ...viewInputs.anchor }
  const side = (anchor.placement ?? 'top').split('-')[0] || 'top'
  return {
    anchor,
    toView: ({ trigger, panel, isVisible }) =>
      h.div(
        [
          h.Class(cn(tooltipWrapperClass, viewInputs.wrapperClass)),
          h.DataAttribute('slot', 'tooltip'),
        ],
        [
          h.button(
            [
              ...(viewInputs.triggerAttributes ?? []),
              ...trigger,
              ...(viewInputs.hoverOnly === true ? [h.Attribute('tabindex', '-1')] : []),
              h.Class(cn(tooltipTriggerClass, viewInputs.triggerClass)),
              h.DataAttribute('slot', 'tooltip-trigger'),
            ],
            [viewInputs.trigger],
          ),
          ...(isVisible
            ? [
                h.div(
                  [
                    ...panel,
                    h.DataAttribute('slot', 'tooltip-content'),
                    h.DataAttribute('side', side),
                    h.Class(cn(tooltipContentClass, viewInputs.contentClass)),
                  ],
                  [
                    viewInputs.content,
                    h.div([h.DataAttribute('side', side), h.Class(tooltipArrowClass)], []),
                  ],
                ),
              ]
            : []),
        ],
      ),
  }
}
