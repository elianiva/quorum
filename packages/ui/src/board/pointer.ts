import { holds } from './card-parts.ts'
import { CARD_W, heightOf, outPort } from './geometry.ts'
import type { BoardController } from './controller.ts'

export const bindPointer = (c: BoardController): void => {
  const canvas = c.app.canvas
  const { signal } = c.abort
  canvas.style.touchAction = 'none'
  canvas.addEventListener('contextmenu', (event) => event.preventDefault(), { signal })

  canvas.addEventListener(
    'pointerdown',
    (event) => {
      c.coarse = event.pointerType !== 'mouse'
      c.panSpeed = 0
      if (event.pointerType !== 'mouse') {
        canvas.setPointerCapture(event.pointerId)
        const touch = { id: event.pointerId, x: event.clientX, y: event.clientY }
        if (c.gesture._tag === 'Pinching') {
          if (c.gesture.touches.length >= 2) return
          c.beginPinch([...c.gesture.touches, touch])
          return
        }
        if (!event.isPrimary) {
          const first = c.pointerOf(c.gesture)
          if (first) c.beginPinch([first, touch])
          return
        }
      }
      const point = c.toWorld(event)
      c.pointer = point
      c.over = true
      c.pointerKnown = true
      c.activity = null
      c.hoverAim = null
      if (event.button === 2) {
        const link = c.linkAt(point)
        if (link) c.selectLink(link)
        return
      }
      if (event.button !== 0) return
      canvas.setPointerCapture(event.pointerId)
      if (c.state?.readOnly) {
        c.gestureStep({
          _tag: 'EmptyPressed',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: point,
          cut: null,
          box: false,
        })
        return
      }
      if (c.state?.stamp) {
        c.events.onPlace(Math.round(point.x / 8) * 8, Math.round(point.y / 8) * 8)
        return
      }
      if (c.state?.placing) {
        c.events.onPlace(point.x - CARD_W / 2, point.y - heightOf(c.state.placing) / 2)
        return
      }
      const port = c.outPortAt(point)
      if (port) {
        c.hoverLink = null
        c.wireEnd = outPort(c.shown().get(port.id) ?? port)
        c.snapGlow = 0
        c.events.onSound?.('pull', 1, true)
        c.gestureStep({
          _tag: 'PortPressed',
          pointerId: event.pointerId,
          from: port.id,
          at: point,
        })
        return
      }
      const node = c.nodeAt(point)
      if (node) {
        const slot = c.slotAt(node, point)
        if (slot) {
          c.slotPress = {
            pointerId: event.pointerId,
            id: node.id,
            slot,
            x: event.clientX,
            y: event.clientY,
            moved: false,
          }
          canvas.style.cursor = 'pointer'
          return
        }
        if (c.footerAt(node, point)) {
          c.gestureStep({
            _tag: 'FooterPressed',
            pointerId: event.pointerId,
            id: node.id,
            dx: point.x - node.x,
            dy: point.y - node.y,
            x: event.clientX,
            y: event.clientY,
            since: c.state && holds(c.state.game, node) ? performance.now() : null,
          })
          c.syncCards()
        } else {
          const view = c.views.get(node.id)
          if (view) view.held = true
          c.gestureStep({
            _tag: 'NodePressed',
            pointerId: event.pointerId,
            id: node.id,
            dx: point.x - node.x,
            dy: point.y - node.y,
            x: event.clientX,
            y: event.clientY,
            at: point,
            frame: false,
          })
        }
        return
      }
      if (event.shiftKey) {
        c.gestureStep({
          _tag: 'EmptyPressed',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: point,
          cut: null,
          box: true,
        })
        return
      }
      if (c.selectedLink && c.onBadge(point)) {
        c.events.onUnlink(c.selectedLink.from, c.selectedLink.to)
        c.selectedLink = null
        return
      }
      const frame = c.selectionFrame()
      const lead = c.nodes().find((entry) => c.state?.selection[0] === entry.id)
      if (
        frame &&
        lead &&
        point.x >= frame.x &&
        point.x <= frame.x + frame.w &&
        point.y >= frame.y &&
        point.y <= frame.y + frame.h
      ) {
        c.gestureStep({
          _tag: 'NodePressed',
          pointerId: event.pointerId,
          id: lead.id,
          dx: point.x - lead.x,
          dy: point.y - lead.y,
          x: event.clientX,
          y: event.clientY,
          at: point,
          frame: true,
        })
        return
      }
      const link = c.linkAt(point)
      if (link) {
        c.selectLink(link)
        return
      }
      c.gestureStep({
        _tag: 'EmptyPressed',
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        at: point,
        cut: c.coarse ? c.linkAt(point) : null,
        box: false,
      })
    },
    { signal },
  )

  canvas.addEventListener(
    'pointermove',
    (event) => {
      if (c.gesture._tag === 'Pinching') {
        const before = c.gesture
        const next = c.gestureStep({
          _tag: 'PointerMoved',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: c.toWorld(event),
          over: null,
        })
        if (next._tag === 'Pinching') c.zoomBetween(before, next)
        return
      }
      const point = c.toWorld(event)
      c.pointer = point
      c.over = true
      c.pointerKnown = true
      c.activity = null
      c.cursorWaiting = true
      if (c.slotPress) {
        if (Math.hypot(event.clientX - c.slotPress.x, event.clientY - c.slotPress.y) >= 4)
          c.slotPress.moved = true
        canvas.style.cursor = 'pointer'
        return
      }
      const gesture = c.gesture
      if (gesture._tag === 'Panning') {
        const next = c.gestureStep({
          _tag: 'PointerMoved',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: point,
          over: null,
        })
        if (next._tag !== 'Panning' || !next.moved) return
        c.world.position.x += event.clientX - gesture.x
        c.world.position.y += event.clientY - gesture.y
        c.paint()
        canvas.style.cursor = 'grabbing'
        return
      }
      if (
        gesture._tag === 'Dragging' ||
        gesture._tag === 'PressPending' ||
        gesture._tag === 'Holding'
      ) {
        const next = c.gestureStep({
          _tag: 'PointerMoved',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: point,
          over: null,
        })
        if (next._tag !== 'Dragging' || !next.moved) return
        const view = c.views.get(next.id)
        if (!(gesture._tag === 'Dragging' && gesture.moved) && view) {
          view.held = false
          view.lifted = true
          c.cards.addChild(view.root)
          c.events.onSound?.('lift', 1, true)
        }
        const last = c.heldOf(gesture)
        const held = c.heldOf(next)
        if (last && held && (last.x !== held.x || last.y !== held.y)) c.events.onSound?.('detent')
        c.syncCards()
        canvas.style.cursor = 'grabbing'
        return
      }
      if (gesture._tag === 'Linking' || gesture._tag === 'Boxing') {
        const next = c.gestureStep({
          _tag: 'PointerMoved',
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          at: point,
          over: c.nodeAt(point)?.id ?? null,
        })
        if (next._tag === 'Linking' || next._tag === 'Boxing') {
          if (next.snapTo !== gesture.snapTo) {
            if (next.snapTo) c.events.onSound?.('snap')
            else c.events.onSound?.('detent', 0.7)
          }
        }
        canvas.style.cursor = 'crosshair'
        return
      }
      if (c.state?.stamp) {
        canvas.style.cursor = 'copy'
        return
      }
      if (c.state?.placing) {
        canvas.style.cursor = 'copy'
        return
      }
      const node = c.nodeAt(point)
      const port = c.outPortAt(point)
      const link = node || port ? null : c.linkAt(point)
      c.aimHover(node?.id ?? null, link)
      canvas.style.cursor = port
        ? 'crosshair'
        : node
          ? c.slotAt(node, point)
            ? 'pointer'
            : c.footerAt(node, point)
              ? 'pointer'
              : 'move'
          : link
            ? 'pointer'
            : 'grab'
    },
    { signal },
  )

  const finish = (event: PointerEvent, cancelled: boolean) => {
    if (c.slotPress) {
      const press = c.slotPress
      c.slotPress = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      if (!cancelled && !press.moved) c.events.onSlot(press.id, press.slot)
      return
    }
    const gesture = c.gesture
    if (gesture._tag === 'Pinching') {
      c.gestureStep({ _tag: 'TouchEnded', pointerId: event.pointerId })
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      return
    }
    const point = c.toWorld(event)
    const over = c.nodeAt(point)?.id ?? null
    const pressed = c.pressedId() !== null
    c.gestureStep(
      cancelled ? { _tag: 'PointerCancelled' } : { _tag: 'PointerReleased', at: point, over },
    )
    c.letGo()
    if (pressed) c.syncCards()
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    canvas.style.cursor = 'grab'
    if (cancelled) {
      if (gesture._tag === 'Linking') c.springBack(gesture.from)
      c.dropped = null
      return
    }
    if (gesture._tag === 'Idle') {
      c.dropped = null
      return
    }
    if (gesture._tag === 'Panning') {
      if (gesture.moved) return
      if (gesture.cut) c.selectLink(gesture.cut)
      else {
        c.selectedLink = null
        c.events.onEmptyTap()
      }
      return
    }
    if (gesture._tag === 'Dragging') {
      const held = c.heldOf(gesture)
      if (gesture.moved && held) {
        c.droppedAt = performance.now()
        const landing = c.landingOf(held) ?? held
        c.dropped = { id: gesture.id, x: landing.x, y: landing.y }
        c.syncCards()
        c.events.onNodeMove(gesture.id, landing.x, landing.y)
        return
      }
      c.dropped = null
      if (gesture.frame) return
      if (event.shiftKey) {
        c.events.onNodeToggle(gesture.id)
        return
      }
      const node = c.nodes().find((entry) => entry.id === gesture.id)
      if (node && c.footerAt(node, point)) {
        if (!c.state || !holds(c.state.game, node)) c.events.onFooter(gesture.id)
      } else c.events.onNodeTap(gesture.id)
      return
    }
    if (gesture._tag === 'PressPending' || gesture._tag === 'Holding') {
      c.dropped = null
      if (event.shiftKey) {
        c.events.onNodeToggle(gesture.id)
        return
      }
      const node = c.nodes().find((entry) => entry.id === gesture.id)
      if (node && c.footerAt(node, point)) {
        if (gesture._tag === 'PressPending' && gesture.since === null) c.events.onFooter(gesture.id)
      } else c.events.onNodeTap(gesture.id)
      return
    }
    if (gesture._tag === 'Linking') {
      if (over !== null && over !== gesture.from) {
        c.wired = `${gesture.from}>${over}`
        c.wireEnd = null
        c.events.onLink(gesture.from, over)
      } else c.springBack(gesture.from)
      return
    }
    if (gesture._tag === 'Boxing') {
      const left = Math.min(gesture.from.x, point.x)
      const right = Math.max(gesture.from.x, point.x)
      const top = Math.min(gesture.from.y, point.y)
      const bottom = Math.max(gesture.from.y, point.y)
      c.events.onBox(
        c
          .nodes()
          .filter(
            (node) =>
              node.x < right &&
              node.x + CARD_W > left &&
              node.y < bottom &&
              node.y + heightOf(node.type) > top,
          )
          .map((node) => node.id),
        event.altKey ? 'subtract' : event.ctrlKey || event.metaKey ? 'add' : 'replace',
      )
    }
  }
  canvas.addEventListener('pointerup', (event) => finish(event, false), { signal })
  canvas.addEventListener('pointercancel', (event) => finish(event, true), { signal })
  canvas.addEventListener(
    'pointerleave',
    () => {
      c.over = false
      c.hoverLink = null
      c.hoverNode = null
      c.hoverAim = null
      if (c.activity !== null) {
        c.emitCursor()
        return
      }
      c.cursorWaiting = false
      c.events.onCursorGone?.()
    },
    { signal },
  )
  window.addEventListener(
    'blur',
    () => {
      c.over = false
      c.cursorWaiting = false
      c.hoverAim = null
      c.slotPress = null
      c.events.onCursorGone?.()
    },
    { signal },
  )
  window.addEventListener(
    'keydown',
    (event) => {
      const link = c.selectedLink
      if (!link) return
      if (event.key === 'Escape') c.selectedLink = null
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      c.selectedLink = null
      c.events.onUnlink(link.from, link.to)
    },
    { signal },
  )

  canvas.addEventListener(
    'wheel',
    (event) => {
      if (c.state?.readOnly && !event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      if (!event.ctrlKey && !event.metaKey && Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        c.panBy(event.deltaX)
        return
      }
      c.panSpeed = 0
      const rect = c.host.getBoundingClientRect()
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const before = c.toWorld(event)
      const scale = Math.min(
        1.6,
        Math.max(0.25, c.world.scale.x * Math.exp(-event.deltaY * 0.0015)),
      )
      c.world.scale.set(scale)
      c.world.position.set(screen.x - before.x * scale, screen.y - before.y * scale)
    },
    { signal, passive: false },
  )
}
