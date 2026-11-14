import { css, cx } from '@quorum/styled-system/css'
import { Dialog as FoldkitDialog } from '@foldkit/ui'
import type { Attribute, ChildAttribute, Html, HtmlBuilder } from 'foldkit/html'

type Child = Html | string

// Re-export the @foldkit/ui Dialog submodel surface so a foldcn Dialog is a
// drop-in for wiring `h.submodel`.

export const Model = FoldkitDialog.Model
export type Model = typeof Model.Type

export const Message = FoldkitDialog.Message
export type Message = typeof Message.Type

export const OutMessage = FoldkitDialog.OutMessage
export type OutMessage = typeof OutMessage.Type

export const init = (config: InitConfig): Model =>
  FoldkitDialog.init({ isAnimated: true, ...config })
/** Starts open; fold the result into the parent with Update.foldChildInit. */
export const boot = (config: InitConfig) => FoldkitDialog.boot({ isAnimated: true, ...config })
export const update = FoldkitDialog.update
export const open = FoldkitDialog.open
export const close = FoldkitDialog.close
export const titleId = FoldkitDialog.titleId
export const descriptionId = FoldkitDialog.descriptionId
export const view = FoldkitDialog.view

export type InitConfig = FoldkitDialog.InitConfig
export type RenderInfo = FoldkitDialog.RenderInfo

/** foldkit delta: the host <dialog> element's own chrome (upstream Root renders
 *  nothing). Backdrop/panel are fixed-position; this only neutralizes the
 *  native dialog box. */
export const dialogClass = css({
  backgroundColor: 'transparent',
  padding: '0',
  _open: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// The @foldkit/ui Dialog defers Animation submodel attributes onto the
// backdrop/panel elements: `data-enter` while entering, `data-leave` while
// leaving (never `data-state`). The sync script rewrites upstream's
// `data-open:`/`data-closed:` animation utilities to these windows during token
// sync; persistent `data-open:` styling passes through untouched.
export const dialogBackdropClass = cx(
  css({
    backgroundColor: 'color-mix(in oklab, #000 10%, transparent)',
    '@supports (backdrop-filter: blur(0))': {
      backdropFilter: 'blur(4px)',
    },
    position: 'fixed',
    inset: '0',
    isolation: 'isolate',
    zIndex: '50',
  }),
  'enter-backdrop',
)

export const dialogPanelClass = cx(
  css({
    layerStyle: 'surface',
    color: 'popoverForeground',
    boxShadow: 'float',
    display: 'grid',
    maxWidth: 'calc(100% - 2rem)',
    gap: '4',
    borderRadius: '2xl',
    padding: '4',
    fontSize: 'calc(0.875rem * var(--type-scale))',
    lineHeight: 'calc(1.25 / 0.875)',
    sm: { maxWidth: '96' },
    position: 'fixed',
    top: '50%',
    left: '50%',
    zIndex: '50',
    width: '100%',
    translate: '-50% -50%',
    outlineStyle: 'none',
  }),
  'enter-modal',
)

/** Upstream renders its close control as `<Button variant="ghost" size="icon-sm"
 *  className="cn-dialog-close">`; compose the same tokens here. */
export const dialogCloseButtonClass = css({
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  backgroundClip: 'padding-box',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: '1.4285714285714286',
  fontWeight: '500',
  display: 'inline-flex',
  flexShrink: '0',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  transitionProperty: 'all',
  transitionDuration: 'default',
  transitionTimingFunction: 'default',
  outlineStyle: 'none',
  userSelect: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
  '& svg:not([data-svg-icon])': { width: '4', height: '4' },
  _focusVisible: {
    borderColor: 'ring',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
  },
  '[data-text="150"] &': { lineHeight: '1.45' },
  '&[aria-disabled="true"]': { pointerEvents: 'none', opacity: 0.5 },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  '&[aria-invalid="true"]': {
    borderColor: 'destructive',
    boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 20%, transparent)',
  },
  _dark: {
    '&[aria-invalid="true"]': {
      borderColor: 'color-mix(in oklab, var(--destructive) 50%, transparent)',
      boxShadow: '0 0 0 3px color-mix(in oklab, var(--destructive) 40%, transparent)',
    },
  },
  _disabled: { pointerEvents: 'none', opacity: 0.5 },
  _hover: { backgroundColor: 'muted', color: 'foreground' },
  _expanded: { backgroundColor: 'muted', color: 'foreground' },
  width: '7',
  height: '7',
  borderRadius: 'min(var(--radius-md), 12px)',
  '&:active:not([aria-haspopup])': { translate: '0 1px' },
  '[data-slot="button-group"] &': { borderRadius: 'lg' },
  position: 'absolute',
  top: '2',
  right: '2',
})

export const dialogTitleClass = css({
  fontSize: 'calc(1rem * var(--type-scale))',
  lineHeight: '1',
  fontWeight: '500',
  fontFamily: 'heading',
})

export const dialogDescriptionClass = css({
  color: 'mutedForeground',
  fontSize: 'calc(0.875rem * var(--type-scale))',
  lineHeight: 'calc(1.25 / 0.875)',
  '& > a': {
    textDecorationLine: 'underline',
    textUnderlineOffset: '3px',
    _hover: { color: 'foreground' },
  },
})

export const dialogHeaderClass = css({
  gap: '2',
  display: 'flex',
  flexDirection: 'column',
})

export const dialogFooterClass = css({
  backgroundColor: 'nested',
  marginInline: '-1rem',
  marginBottom: '-1rem',
  borderBottomLeftRadius: '2xl',
  borderBottomRightRadius: '2xl',
  borderTopWidth: '1px',
  borderTopStyle: 'solid',
  borderColor: 'hairline',
  padding: '4',
  display: 'flex',
  flexDirection: 'column-reverse',
  gap: '2',
  sm: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
})

// These abstract away element types, base classes, and attribute spreading.
// Use inside `styledViewInputs` content callbacks:
//
//   content: (render, h) => [
//     Dialog.header({}, [
//       Dialog.title({ attributes: render.title }, ['Title'], h),
//       Dialog.description({ attributes: render.description }, ['Subtitle'], h),
//     ], h),
//     Dialog.footer({}, [button(...)], h),
//   ]
//
// Every builder follows one shape: `(config, children, h)`. Attribute
// bundles handed to you by `styledViewInputs` go in `config.attributes`.

type StyleConfig<M> = Readonly<{
  className?: string
  /** Submodel-provided attributes (from the `styledViewInputs` content
   *  callback render bundle) to merge onto the element. */
  attributes?: ReadonlyArray<Attribute<M> | ChildAttribute>
}>

export const header = <M>(
  config: StyleConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'dialog-header'), h.Class(cx(dialogHeaderClass, config.className))],
    children,
  )

/** Dialog title — merges with the submodel's title attributes. */
export const title = <M>(
  config: StyleConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.h2(
    [
      ...(config.attributes ?? []),
      h.DataAttribute('slot', 'dialog-title'),
      h.Class(cx(dialogTitleClass, config.className)),
    ],
    children,
  )

/** Dialog description — merges with the submodel's description attributes. */
export const description = <M>(
  config: StyleConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.p(
    [
      ...(config.attributes ?? []),
      h.DataAttribute('slot', 'dialog-description'),
      h.Class(cx(dialogDescriptionClass, config.className)),
    ],
    children,
  )

export const footer = <M>(
  config: StyleConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.div(
    [h.DataAttribute('slot', 'dialog-footer'), h.Class(cx(dialogFooterClass, config.className))],
    children,
  )

/** Close button — merges with the submodel's closeButton attributes. */
export const closeButton = <M>(
  config: StyleConfig<M>,
  children: ReadonlyArray<Child>,
  h: HtmlBuilder<M>,
): Html =>
  h.button(
    [
      ...(config.attributes ?? []),
      h.DataAttribute('slot', 'dialog-close'),
      h.Class(cx(dialogCloseButtonClass, config.className)),
    ],
    children,
  )

export type DialogContent<M> = Readonly<{
  closeButton: ReadonlyArray<Attribute<M> | ChildAttribute>
  title: ReadonlyArray<Attribute<M> | ChildAttribute>
  description: ReadonlyArray<Attribute<M> | ChildAttribute>
}>

export type StyledViewInputs<M> = Readonly<{
  /** Set when content renders the description element. */
  hasDescription?: boolean
  /** Panel content. Receives the close-button, title and description
   *  attribute bundles to spread onto your own elements, or pass to
   *  Dialog.title / Dialog.description / Dialog.closeButton helpers via
   *  their `attributes` config field. */
  content: (render: DialogContent<M>, h: HtmlBuilder<M>) => ReadonlyArray<Child>
  className?: string
  backdropClass?: string
  panelClass?: string
}>

/** Build styled `Dialog.ViewInputs`. Pass your view's `h` so the content
 *  callback can dispatch your app's own messages (e.g. a destructive
 *  action button next to the dialog's `closeButton`). */
export const styledViewInputs = <M>(
  viewInputs: StyledViewInputs<M>,
  h: HtmlBuilder<M>,
): FoldkitDialog.ViewInputs => ({
  ...(viewInputs.hasDescription === undefined ? {} : { hasDescription: viewInputs.hasDescription }),
  toView: ({ dialog, backdrop, panel, closeButton, title, description, isVisible }) =>
    h.dialog(
      [
        ...dialog,
        h.DataAttribute('slot', 'dialog'),
        h.Class(cx(dialogClass, viewInputs.className)),
      ],
      isVisible
        ? [
            h.div([
              ...backdrop,
              h.DataAttribute('slot', 'dialog-overlay'),
              h.Class(cx(dialogBackdropClass, viewInputs.backdropClass)),
            ]),
            h.div(
              [
                ...panel,
                h.DataAttribute('slot', 'dialog-content'),
                h.Class(cx(dialogPanelClass, viewInputs.panelClass)),
              ],
              viewInputs.content({ closeButton, title, description }, h),
            ),
          ]
        : [],
    ),
})
