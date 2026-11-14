import { css, cx, cx as cn } from '@quorum/styled-system/css'
import { Tabs as FoldkitTabs } from '@foldkit/ui'
import type { Html, HtmlBuilder } from 'foldkit/html'

// Re-export the @foldkit/ui Tabs surface. Create a bundle once per tab value
// type:
//
//   export const DemoTabs = Tabs.create<"Foldkit" | "React">()

export const create = FoldkitTabs.create
export const init = FoldkitTabs.init
export const Model = FoldkitTabs.Model
export type Model = typeof Model.Type
export const Message = FoldkitTabs.Message
export type Message = typeof Message.Type
export const OutMessage = FoldkitTabs.OutMessage
export type OutMessage = typeof OutMessage.Type

export type Bundle<Value extends string = string> = FoldkitTabs.Bundle<Value>
export type InitConfig = FoldkitTabs.InitConfig
export type ViewInputs<Value extends string = string> = FoldkitTabs.ViewInputs<Value>
export type RenderInfo<Value extends string = string> = FoldkitTabs.RenderInfo<Value>

// foldkit delta: foldkit emits data-selected (upstream Base UI emits
// data-active) — the copied trigger string keeps the semantics with the
// data-active prefix per docs/deriving-from-base.md. The group orientation
// hooks use data-horizontal/data-vertical attrs emitted by the styled view.

export type TabsListVariant = 'default' | 'line'

const tabsListBaseClass = cx(
  css({
    borderRadius: 'lg',
    padding: '3px',
    '.group-tabs[data-horizontal] &': { height: '2.25rem' },
    '&[data-variant="line"]': { borderRadius: '0' },
    display: 'inline-flex',
    width: 'fit-content',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'mutedForeground',
    '.group-tabs[data-vertical] &': { height: 'fit-content', flexDirection: 'column' },
  }),
  'group-tabs-list',
)

const tabsListVariantClasses: Record<TabsListVariant, string> = {
  default: css({
    backgroundColor: 'well',
    boxShadow: 'well',
  }),
  line: css({
    gap: '0.25rem',
    backgroundColor: 'transparent',
  }),
}

export const tabsListClass = (variant: TabsListVariant = 'default') =>
  cn(tabsListBaseClass, tabsListVariantClasses[variant])

/** Upstream TabsTrigger string with data-active → data-selected prefix swaps
 *  (foldkit attr name). */
export const tabsTriggerClass = css({
  gap: '0.375rem',
  borderRadius: 'md',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  paddingInline: '0.375rem',
  paddingBlock: '0.125rem',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  fontWeight: '500',
  '& svg:not([data-svg-icon])': { width: '1rem', height: '1rem' },
  '&:has([data-icon="inline-end"])': { paddingRight: '0.25rem' },
  '&:has([data-icon="inline-start"])': { paddingLeft: '0.25rem' },
  position: 'relative',
  display: 'inline-flex',
  height: 'calc(100% - 1px)',
  flex: '1 1 0%',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  color: 'color-mix(in oklab, var(--foreground) 60%, transparent)',
  transitionProperty: 'all',
  transitionDuration: 'var(--default-transition-duration)',
  transitionTimingFunction: 'var(--default-transition-timing-function)',
  _hover: { color: 'foreground' },
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
    outlineWidth: '1px',
    outlineStyle: 'solid',
    outlineColor: 'ring',
  },
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  _dark: {
    color: 'mutedForeground',
    _hover: { color: 'foreground' },
  },
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
  '.group-tabs[data-vertical] &': {
    width: '100%',
    justifyContent: 'flex-start',
    '&::after': {
      insetBlock: '0',
      right: '-0.25rem',
      width: '0.125rem',
    },
  },
  '&[data-selected]': { color: 'foreground' },
  '&::after': {
    position: 'absolute',
    backgroundColor: 'foreground',
    opacity: 0,
    transitionProperty: 'opacity',
    transitionTimingFunction: 'var(--default-transition-timing-function)',
    transitionDuration: 'var(--default-transition-duration)',
  },
  '.group-tabs[data-horizontal] &': {
    '&::after': {
      insetInline: '0',
      bottom: '-5px',
      height: '0.125rem',
    },
  },
  '.group-tabs-list[data-variant=default] &': {
    '&[data-selected]': { layerStyle: 'raised', boxShadow: 'raised' },
  },
  '.group-tabs-list[data-variant=line] &': {
    '&[data-active]': { boxShadow: 'none' },
    backgroundColor: 'transparent',
    '&[data-selected]': { backgroundColor: 'transparent' },
    _dark: {
      '&[data-selected]': {
        borderColor: 'transparent',
        backgroundColor: 'transparent',
      },
    },
    '&[data-selected]::after': { opacity: 1 },
  },
})

export const tabsContentClass = css({
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  flex: '1 1 0%',
  outlineStyle: 'none',
})

// Use inside `styledViewInputs` panel callbacks:
//
//   panel: (tab, render, h) =>
//     Tabs.content({}, [h.p([], [`${tab} content`])], h)

type StyleConfig = Readonly<{ className?: string }>

export const list = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'tabs-list'), h.Class(cn(tabsListClass(), config.className))],
    children,
  )

export const trigger = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<M>,
): Html =>
  h.button(
    [h.DataAttribute('slot', 'tabs-trigger'), h.Class(cn(tabsTriggerClass, config.className))],
    children,
  )

export const content = <M>(
  config: StyleConfig,
  children: ReadonlyArray<Html | string>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'tabs-content'), h.Class(cn(tabsContentClass, config.className))],
    children,
  )

export type StyledViewInputs<M, Value extends string = string> = Readonly<{
  tabs: ReadonlyArray<Value>
  selectedValue: Value
  ariaLabel: string
  /** Renders each tab panel. Receives the tab value and the render-time
   *  attributes (tablist, tabs, activeIndex) so content can react to the
   *  active tab. */
  panel: (tab: Value, render: RenderInfo<Value>, h: HtmlBuilder<M>) => Html
  isTabDisabled?: (value: Value, index: number) => boolean
  orientation?: 'Horizontal' | 'Vertical'
  variant?: TabsListVariant
  listClass?: string
  triggerClass?: string
  contentClass?: string
}>

/** Build styled `Tabs.ViewInputs`. Pass your view's `h` so panel content can
 *  dispatch your app's own messages. */
export const styledViewInputs = <M, Value extends string = string>(
  viewInputs: StyledViewInputs<M, Value>,
  h: HtmlBuilder<M>,
): ViewInputs<Value> => {
  const isVertical = viewInputs.orientation === 'Vertical'
  const variant = viewInputs.variant ?? 'default'
  return {
    tabs: viewInputs.tabs,
    selectedValue: viewInputs.selectedValue,
    ariaLabel: viewInputs.ariaLabel,
    ...(viewInputs.isTabDisabled === undefined ? {} : { isTabDisabled: viewInputs.isTabDisabled }),
    ...(viewInputs.orientation === undefined ? {} : { orientation: viewInputs.orientation }),
    toView: ({ tablist, tabs, activeIndex }) =>
      h.div(
        [
          h.DataAttribute('slot', 'tabs'),
          h.DataAttribute('orientation', isVertical ? 'vertical' : 'horizontal'),
          ...(isVertical ? [h.DataAttribute('vertical', '')] : [h.DataAttribute('horizontal', '')]),
          h.Class(
            cn(
              css({
                gap: '0.5rem',
                display: 'flex',
              }),
              'group-tabs',
              isVertical
                ? css({
                    width: '100%',
                    gap: '0.5rem',
                  })
                : css({
                    flexDirection: 'column',
                  }),
              viewInputs.variant === 'line' ? '' : '',
            ),
          ),
        ],
        [
          h.div(
            [
              ...tablist,
              h.DataAttribute('slot', 'tabs-list'),
              h.Attribute('data-variant', variant),
              h.Class(cn(tabsListClass(variant), viewInputs.listClass)),
            ],
            tabs.map((tab) =>
              h.button(
                [
                  ...tab.tab,
                  h.DataAttribute('slot', 'tabs-trigger'),
                  h.Class(cn(tabsTriggerClass, viewInputs.triggerClass)),
                ],
                [h.span([], [tab.value])],
              ),
            ),
          ),
          ...tabs
            .filter((tab) => tab.index === activeIndex)
            .map((tab) =>
              h.div(
                [
                  ...tab.panel,
                  h.DataAttribute('slot', 'tabs-content'),
                  h.Class(cn(tabsContentClass, viewInputs.contentClass)),
                ],
                [viewInputs.panel(tab.value, { tablist, tabs, activeIndex }, h)],
              ),
            ),
        ],
      ),
  }
}
