import { css, cx } from '@quorum/styled-system/css'
import { Effect, Option, Queue, Schema as S, Stream } from 'effect'
import * as Command from 'foldkit/command'
import type { Html } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { defineTaggedUnion } from 'foldkit/schema'
import { defineView } from 'foldkit/submodel'
import * as Subscription from 'foldkit/subscription'
import * as Update from 'foldkit/update'
import { modifyFields } from 'foldkit/struct'

export const scrollAreaClass = css({
  position: 'relative',
})

export const scrollAreaViewportClass = css({
  scrollbarWidth: 'none',
  '&::-webkit-scrollbar': { display: 'none' },
  overflow: 'scroll',
  width: '100%',
  height: '100%',
  borderRadius: 'inherit',
  transitionProperty: 'color, box-shadow',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  outlineStyle: 'none',
  _focusVisible: {
    boxShadow: 'focus',
    outlineWidth: '1px',
    outlineStyle: 'solid',
  },
})

export const scrollAreaScrollbarClass = css({
  '&[data-horizontal]': {
    height: '2.5',
    flexDirection: 'column',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: 'transparent',
  },
  '&[data-vertical]': {
    height: '100%',
    width: '2.5',
    borderLeftWidth: '1px',
    borderLeftStyle: 'solid',
    borderLeftColor: 'transparent',
  },
  display: 'flex',
  touchAction: 'none',
  padding: '0.25',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  userSelect: 'none',
})

export const scrollAreaThumbClass = css({
  borderRadius: 'full',
  position: 'relative',
  flex: '1 1 0%',
  backgroundColor: 'border',
})

const SCROLLBAR_PAD_PX = 1
const MIN_THUMB_SIZE_PX = 16
const CORNER_SIZE_PX = 10

export type ScrollAxis = 'vertical' | 'horizontal'

export type ScrollMetrics = Readonly<{
  scrollTop: number
  scrollLeft: number
  scrollHeight: number
  scrollWidth: number
  clientHeight: number
  clientWidth: number
}>

export type ScrollGeometry = Readonly<{
  hasOverflow: boolean
  thumbSizePx: number
  thumbOffsetPx: number
  maxScroll: number
  maxThumbOffsetPx: number
}>

const zeroMetrics: ScrollMetrics = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 0,
  scrollWidth: 0,
  clientHeight: 0,
  clientWidth: 0,
}

export const scrollGeometry = (metrics: ScrollMetrics, axis: ScrollAxis): ScrollGeometry => {
  const vertical = axis === 'vertical'
  const clientSize = vertical ? metrics.clientHeight : metrics.clientWidth
  const scrollSize = vertical ? metrics.scrollHeight : metrics.scrollWidth
  const scrollPos = vertical ? metrics.scrollTop : metrics.scrollLeft
  if (scrollSize <= 0 || scrollSize <= clientSize) {
    return {
      hasOverflow: false,
      thumbSizePx: 0,
      thumbOffsetPx: 0,
      maxScroll: 0,
      maxThumbOffsetPx: 0,
    }
  }
  const maxScroll = Math.max(0, scrollSize - clientSize)
  const ratio = clientSize / scrollSize
  const thumbSizePx = Math.max(MIN_THUMB_SIZE_PX, (clientSize - 2 * SCROLLBAR_PAD_PX) * ratio)
  const maxThumbOffsetPx = Math.max(0, clientSize - thumbSizePx - 2 * SCROLLBAR_PAD_PX)
  const thumbOffsetPx = maxScroll > 0 ? (scrollPos / maxScroll) * maxThumbOffsetPx : 0
  return { hasOverflow: true, thumbSizePx, thumbOffsetPx, maxScroll, maxThumbOffsetPx }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const readMetrics = (element: HTMLElement | null): ScrollMetrics =>
  element === null
    ? zeroMetrics
    : {
        scrollTop: element.scrollTop,
        scrollLeft: element.scrollLeft,
        scrollHeight: element.scrollHeight,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        clientWidth: element.clientWidth,
      }

const viewportId = (id: string): string => `${id}-viewport`

export const scrollbarId = (id: string, axis: ScrollAxis): string => `${id}-scrollbar-${axis}`

const DragState = defineTaggedUnion({
  Idle: {},
  Dragging: {
    axis: S.Literals(['vertical', 'horizontal']),
    pointer: S.Finite,
    scroll: S.Finite,
  },
})
export type DragState = typeof DragState.Type

export const Model = S.Struct({
  id: S.String,
  scrollTop: S.Finite,
  scrollLeft: S.Finite,
  scrollHeight: S.Finite,
  scrollWidth: S.Finite,
  clientHeight: S.Finite,
  clientWidth: S.Finite,
  dragState: DragState,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ScrolledViewport: {
    scrollTop: S.Finite,
    scrollLeft: S.Finite,
    scrollHeight: S.Finite,
    scrollWidth: S.Finite,
    clientHeight: S.Finite,
    clientWidth: S.Finite,
  },
  MeasuredViewport: {
    scrollTop: S.Finite,
    scrollLeft: S.Finite,
    scrollHeight: S.Finite,
    scrollWidth: S.Finite,
    clientHeight: S.Finite,
    clientWidth: S.Finite,
  },
  PressedThumb: {
    axis: S.Literals(['vertical', 'horizontal']),
    clientX: S.Finite,
    clientY: S.Finite,
  },
  PressedTrack: {
    axis: S.Literals(['vertical', 'horizontal']),
    clientX: S.Finite,
    clientY: S.Finite,
  },
  MovedDragPointer: { clientX: S.Finite, clientY: S.Finite },
  ReleasedDragPointer: {},
})
export type Message = typeof Message.Type

export const ApplyScroll = Command.define('ApplyScroll', {
  args: { id: S.String, scrollTop: S.Finite, scrollLeft: S.Finite },
  messages: [Message.ScrolledViewport],
  execute: ({ id, scrollTop, scrollLeft }) =>
    Effect.sync(() => {
      const element = document.getElementById(viewportId(id))
      if (element !== null) {
        element.scrollTop = scrollTop
        element.scrollLeft = scrollLeft
      }
      return Message.ScrolledViewport(readMetrics(element))
    }),
})

export const ScrollToPointer = Command.define('ScrollToPointer', {
  args: {
    id: S.String,
    axis: S.Literals(['vertical', 'horizontal']),
    clientX: S.Finite,
    clientY: S.Finite,
  },
  messages: [Message.ScrolledViewport],
  execute: ({ id, axis, clientX, clientY }) =>
    Effect.sync(() => {
      const viewport = document.getElementById(viewportId(id))
      const scrollbar = document.getElementById(scrollbarId(id, axis))
      if (viewport !== null && scrollbar !== null) {
        const geometry = scrollGeometry(readMetrics(viewport), axis)
        if (geometry.hasOverflow && geometry.maxThumbOffsetPx > 0) {
          const rect = scrollbar.getBoundingClientRect()
          const pointerInTrack = axis === 'vertical' ? clientY - rect.top : clientX - rect.left
          const clickPosition = pointerInTrack - geometry.thumbSizePx / 2 - SCROLLBAR_PAD_PX
          const ratio = clamp(clickPosition / geometry.maxThumbOffsetPx, 0, 1)
          const target = ratio * geometry.maxScroll
          if (axis === 'vertical') {
            viewport.scrollTop = target
          } else {
            viewport.scrollLeft = target
          }
        }
      }
      return Message.ScrolledViewport(readMetrics(viewport))
    }),
})

export type InitConfig = Readonly<{
  id: string
}>

export const init = (config: InitConfig): Model => ({
  id: config.id,
  ...zeroMetrics,
  dragState: DragState.Idle(),
})

const storeMetrics = (model: Model, metrics: ScrollMetrics): Update.Return<Model, Message> => ({
  model: modifyFields(model, {
    scrollTop: () => metrics.scrollTop,
    scrollLeft: () => metrics.scrollLeft,
    scrollHeight: () => metrics.scrollHeight,
    scrollWidth: () => metrics.scrollWidth,
    clientHeight: () => metrics.clientHeight,
    clientWidth: () => metrics.clientWidth,
  }),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    ScrolledViewport: (metrics) => storeMetrics(model, metrics),
    MeasuredViewport: (metrics) => storeMetrics(model, metrics),
    PressedThumb: ({ axis, clientX, clientY }) => ({
      model: modifyFields(model, {
        dragState: () =>
          DragState.Dragging({
            axis,
            pointer: axis === 'vertical' ? clientY : clientX,
            scroll: axis === 'vertical' ? model.scrollTop : model.scrollLeft,
          }),
      }),
    }),
    PressedTrack: ({ axis, clientX, clientY }) =>
      model.dragState._tag === 'Dragging'
        ? { model }
        : {
            model,
            commands: [ScrollToPointer({ id: model.id, axis, clientX, clientY })],
          },
    MovedDragPointer: ({ clientX, clientY }) => {
      if (model.dragState._tag !== 'Dragging') return { model }
      const { axis, pointer, scroll } = model.dragState
      const geometry = scrollGeometry(model, axis)
      if (!geometry.hasOverflow || geometry.maxThumbOffsetPx <= 0) return { model }
      const pointerNow = axis === 'vertical' ? clientY : clientX
      const nextScroll = clamp(
        scroll + ((pointerNow - pointer) / geometry.maxThumbOffsetPx) * geometry.maxScroll,
        0,
        geometry.maxScroll,
      )
      return {
        model,
        commands: [
          ApplyScroll({
            id: model.id,
            scrollTop: axis === 'vertical' ? nextScroll : model.scrollTop,
            scrollLeft: axis === 'horizontal' ? nextScroll : model.scrollLeft,
          }),
        ],
      }
    },
    ReleasedDragPointer: () => ({
      model: modifyFields(model, { dragState: () => DragState.Idle() }),
    }),
  })

type AttachState = {
  scrollListener: (() => void) | null
  resizeObserver: ResizeObserver | null
  observedElement: HTMLElement | null
  pendingFrame: number | null
}

const viewportEventsStream = (id: string): Stream.Stream<Message> =>
  Stream.callback((queue) =>
    Effect.acquireRelease(
      Effect.sync(() => {
        const state: AttachState = {
          scrollListener: null,
          resizeObserver: null,
          observedElement: null,
          pendingFrame: null,
        }
        const detach = () => {
          if (state.resizeObserver !== null) {
            state.resizeObserver.disconnect()
            state.resizeObserver = null
          }
          if (state.observedElement !== null && state.scrollListener !== null) {
            state.observedElement.removeEventListener('scroll', state.scrollListener)
          }
          state.observedElement = null
          state.scrollListener = null
        }
        const attach = (element: HTMLElement) => {
          const listener = () =>
            Queue.offerUnsafe(queue, Message.ScrolledViewport(readMetrics(element)))
          element.addEventListener('scroll', listener, { passive: true })
          state.scrollListener = listener
          state.observedElement = element
          state.resizeObserver = new ResizeObserver(() => {
            Queue.offerUnsafe(queue, Message.MeasuredViewport(readMetrics(element)))
          })
          state.resizeObserver.observe(element)
        }
        const reconcile = () => {
          const element = document.getElementById(viewportId(id))
          if (element === null) {
            if (state.observedElement !== null) detach()
            return
          }
          if (state.observedElement === element) return
          detach()
          attach(element)
        }
        reconcile()
        const mutationObserver = new MutationObserver(() => {
          if (state.pendingFrame !== null) return
          state.pendingFrame = requestAnimationFrame(() => {
            state.pendingFrame = null
            reconcile()
          })
        })
        mutationObserver.observe(document.body, { childList: true, subtree: true })
        return { state, detach, mutationObserver }
      }),
      ({ state, detach, mutationObserver }) =>
        Effect.sync(() => {
          mutationObserver.disconnect()
          if (state.pendingFrame !== null) cancelAnimationFrame(state.pendingFrame)
          detach()
        }),
    ).pipe(Effect.flatMap(() => Effect.never)),
  )

const DragActivity = S.Literals(['Idle', 'Active'])

const dragActivityFromModel = (model: Model): 'Idle' | 'Active' =>
  model.dragState._tag === 'Dragging' ? 'Active' : 'Idle'

const dragPointerStream = (dragActivity: 'Idle' | 'Active'): Stream.Stream<Message> => {
  const pointerEvents = Stream.merge(
    Stream.fromEventListener(document, 'pointermove').pipe(
      Stream.mapEffect((event) =>
        Effect.sync(() =>
          event instanceof PointerEvent
            ? Option.some(
                Message.MovedDragPointer({ clientX: event.clientX, clientY: event.clientY }),
              )
            : Option.none(),
        ),
      ),
      Stream.filter(Option.isSome),
      Stream.map((option) => option.value),
    ),
    Stream.fromEventListener(document, 'pointerup').pipe(
      Stream.map(() => Message.ReleasedDragPointer()),
    ),
  )
  const dragStyles = Stream.callback(() =>
    Effect.acquireRelease(
      Effect.sync(() => {
        document.documentElement.style.setProperty('user-select', 'none')
        document.documentElement.style.setProperty('-webkit-user-select', 'none')
        const cursorStyle = document.createElement('style')
        cursorStyle.textContent = '* { cursor: grabbing !important; }'
        document.head.appendChild(cursorStyle)
        return cursorStyle
      }),
      (cursorStyle) =>
        Effect.sync(() => {
          document.documentElement.style.removeProperty('user-select')
          document.documentElement.style.removeProperty('-webkit-user-select')
          cursorStyle.remove()
        }),
    ).pipe(Effect.flatMap(() => Effect.never)),
  )
  return Stream.when(
    Stream.merge(pointerEvents, dragStyles),
    Effect.sync(() => dragActivity === 'Active'),
  ) as Stream.Stream<Message>
}

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  viewportEvents: entry(
    { id: S.String },
    {
      modelToDependencies: (model) => ({ id: model.id }),
      dependenciesToStream: ({ id }) => viewportEventsStream(id),
    },
  ),
  dragPointer: entry(
    { dragActivity: DragActivity },
    {
      modelToDependencies: (model) => ({
        dragActivity: dragActivityFromModel(model),
      }),
      dependenciesToStream: ({ dragActivity }) => dragPointerStream(dragActivity),
    },
  ),
}))

export type ViewInputs = Readonly<{
  content: Html
  className?: string
}>

const px = (value: number): string => `${String(value)}px`

const scrollbarStyle = (axis: ScrollAxis, cornerPx: number): Readonly<Record<string, string>> => {
  if (axis === 'vertical') {
    return {
      position: 'absolute',
      'touch-action': 'none',
      'user-select': 'none',
      '-webkit-user-select': 'none',
      top: '0',
      bottom: px(cornerPx),
      right: '0',
    }
  }
  return {
    position: 'absolute',
    'touch-action': 'none',
    'user-select': 'none',
    '-webkit-user-select': 'none',
    left: '0',
    right: px(cornerPx),
    bottom: '0',
  }
}

const thumbStyle = (
  axis: ScrollAxis,
  geometry: ScrollGeometry,
): Readonly<Record<string, string>> => {
  if (axis === 'vertical') {
    return {
      height: px(geometry.thumbSizePx),
      transform: `translate3d(0,${px(geometry.thumbOffsetPx)},0)`,
    }
  }
  return {
    width: px(geometry.thumbSizePx),
    transform: `translate3d(${px(geometry.thumbOffsetPx)},0,0)`,
  }
}

const pointerToMessage =
  (message: (clientX: number, clientY: number) => Message) =>
  (
    _pointerType: string,
    button: number,
    _x: number,
    _y: number,
    _t: number,
    clientX: number,
    clientY: number,
  ) =>
    button === 0 ? Option.some(message(clientX, clientY)) : Option.none()

export const view = defineView<Model, Message, ViewInputs>((model, viewInputs, h) => {
  const verticalGeometry = scrollGeometry(model, 'vertical')
  const horizontalGeometry = scrollGeometry(model, 'horizontal')
  const bothOverflow = verticalGeometry.hasOverflow && horizontalGeometry.hasOverflow
  const cornerPx = bothOverflow ? CORNER_SIZE_PX : 0
  const viewportHidden = !verticalGeometry.hasOverflow && !horizontalGeometry.hasOverflow

  const scrollbar = (axis: ScrollAxis, geometry: ScrollGeometry): Html =>
    h.div(
      [
        h.Id(scrollbarId(model.id, axis)),
        h.Class(cx(scrollAreaScrollbarClass)),
        h.DataAttribute('slot', 'scroll-area-scrollbar'),
        h.DataAttribute('orientation', axis),
        h.DataAttribute(axis, ''),
        h.Style(scrollbarStyle(axis, cornerPx)),
        h.OnPointerDown(
          pointerToMessage((clientX, clientY) => Message.PressedTrack({ axis, clientX, clientY })),
        ),
      ],
      [
        h.div(
          [
            h.Class(cx(scrollAreaThumbClass)),
            h.DataAttribute('slot', 'scroll-area-thumb'),
            h.DataAttribute('orientation', axis),
            h.DataAttribute(axis, ''),
            h.Style(thumbStyle(axis, geometry)),
            h.OnPointerDown(
              pointerToMessage((clientX, clientY) =>
                Message.PressedThumb({ axis, clientX, clientY }),
              ),
            ),
          ],
          [],
        ),
      ],
    )

  return h.div(
    [
      h.Class(cx(scrollAreaClass, viewInputs.className)),
      h.DataAttribute('slot', 'scroll-area'),
      h.Role('presentation'),
    ],
    [
      h.div(
        [
          h.Id(viewportId(model.id)),
          h.Class(cx(scrollAreaViewportClass)),
          h.DataAttribute('slot', 'scroll-area-viewport'),
          h.Role('presentation'),
          h.Tabindex(viewportHidden ? -1 : 0),
        ],
        [viewInputs.content],
      ),
      ...(verticalGeometry.hasOverflow ? [scrollbar('vertical', verticalGeometry)] : []),
      ...(horizontalGeometry.hasOverflow ? [scrollbar('horizontal', horizontalGeometry)] : []),
      ...(bothOverflow
        ? [
            h.div(
              [
                h.Style({
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  width: px(CORNER_SIZE_PX),
                  height: px(CORNER_SIZE_PX),
                }),
              ],
              [],
            ),
          ]
        : []),
    ],
  )
})
