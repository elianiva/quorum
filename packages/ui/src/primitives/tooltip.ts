import { css, cx } from '@quorum/styled-system/css'
import { Tooltip as FoldkitTooltip } from '@foldkit/ui'
import type { AnchorConfig } from '@foldkit/ui/tooltip'
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

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

export const DEFAULT_SHOW_DELAY = 0

export const init = (config: InitConfig): Model =>
  FoldkitTooltip.init({ showDelay: DEFAULT_SHOW_DELAY, ...config })

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
  fontSize: 'type.14',
  lineHeight: 'fine',
  fontWeight: 'medium',
  backgroundColor: 'background',
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: 'focus',
  },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow: 'invalid',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow: 'invalid',
    },
    backgroundColor: 'color-mix(in oklab, var(--input) 30%, transparent)',
    borderColor: 'input',
    _hover: { backgroundColor: 'color-mix(in oklab, var(--input) 50%, transparent)' },
  },
  '&:active:not([aria-haspopup])': { translate: '0 1px' },
  '& svg:not([data-svg-icon])': { width: '4', height: '4' },
  display: 'inline-flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  transitionProperty: 'all',
  transitionDuration: 'fast',
  transitionTimingFunction: 'default',
  outlineStyle: 'none',
  userSelect: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  _hover: { backgroundColor: 'muted', color: 'foreground' },
  '&[aria-expanded]': { backgroundColor: 'muted', color: 'foreground' },
  height: '8',
  gap: '1.5',
  paddingInline: '2.5',
  '&:has([data-icon="inline-end"])': { paddingRight: '2' },
  '&:has([data-icon="inline-start"])': { paddingLeft: '2' },
})

export const tooltipContentClass = cx(
  css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '1.5',
    borderRadius: 'lg',
    paddingInline: '2.5',
    paddingBlock: '1.5',
    fontSize: 'type.12',
    lineHeight: 'compact',
    '&:has([data-slot="kbd"])': { paddingRight: '1.5' },
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
    maxWidth: '80',
    transformOrigin: 'var(--transform-origin)',
    backgroundColor: 'foreground',
    color: 'background',
    boxShadow: 'float',
  }),
  'enter-pop',
)

export const tooltipArrowClass = css({
  '&[data-side="bottom"]': {
    left: '50%',
    translate: '-50% 0',
    top: '1',
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
  backgroundColor: 'foreground',
  fill: 'foreground',
  width: '2.5',
  height: '2.5',
  rotate: '45deg',
  borderRadius: '2xs',
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
  anchor?: AnchorConfig
  trigger: Child
  content: Child
  className?: string
  triggerClass?: string
  contentClass?: string
  wrapperClass?: string
  hoverOnly?: boolean
  triggerAttributes?: ReadonlyArray<Attribute<M> | ChildAttribute>
}>

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
          h.Class(cx(tooltipWrapperClass, viewInputs.wrapperClass)),
          h.DataAttribute('slot', 'tooltip'),
        ],
        [
          h.button(
            [
              ...(viewInputs.triggerAttributes ?? []),
              ...trigger,
              ...(viewInputs.hoverOnly === true ? [h.Attribute('tabindex', '-1')] : []),
              h.Class(cx(tooltipTriggerClass, viewInputs.triggerClass)),
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
                    h.Class(cx(tooltipContentClass, viewInputs.contentClass)),
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
