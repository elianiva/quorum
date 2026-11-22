import 'pixi.js/unsafe-eval'
import type { Ledger } from '@quorum/simulation/ledger'
import { inFooter } from './card-parts.ts'
import { Application, Container, Graphics, Point, type RendererPreference } from 'pixi.js'
import { COMPONENTS, type ComponentId } from '@quorum/simulation/catalog'
import { type SlotKind } from '@quorum/simulation/parts'
import { replicationPairsOf } from '@quorum/simulation/lookups'
import { type Game, type GameNode } from '@quorum/simulation/state'
import { type SeatActivity } from '@quorum/simulation/room'
import {
  CARD_W,
  HEAD,
  PORT_R,
  boxOf,
  freeSpot,
  heightOf,
  layoutOf,
  outPort,
  route,
  SLOT_H,
  SLOT_W,
  slotLeft,
  slotTop,
  type Placed,
  type Pt,
  type Route,
} from './geometry.ts'
import { compute } from './compute.ts'
import { CHIP_GONE_AT_ZOOM } from './lod.ts'
import { type RoutedLink, type RoutedNode, type Wire } from './routing.ts'
import { COMPONENT_ICONS } from '../game/component-icons.ts'
import { CursorOverlay, type SeatCursor } from './cursors.ts'
import { animate } from './frame.ts'
import { bindPointer } from './pointer.ts'
import { type BoardEvents, type BoardState } from './types.ts'
import { type Palette, palette } from './palette.ts'
import { silhouette, badgeGlyph } from './shapes.ts'
import { DRAW_IN_S, CURSOR_MS, HOVER_SETTLE_MS } from './motion.ts'
import { glyph, paint } from './glyphs.ts'
import { BADGE_X, BADGE_Y, BADGE_R, TITLE_X, medallion, headerBand } from './card-parts.ts'
import { pointOn, distanceTo, laneUnder, routeOf, ROUTE_SLACK_PX, bent, dashed } from './paths.ts'
import { SANS, label } from './text.ts'
import { MIN_FIT_SCALE, MIN_FIT_SCALE_PHONE, NodeView } from './node-view.ts'
import { BeltView, linkKey, type Mouth } from './belt-view.ts'
import { ChevronLayer, PacketLayer, NoteLayer } from './layers.ts'
import {
  IDLE_GESTURE,
  gestureStep,
  holdOf,
  holdProgress,
  pressedNode,
  touchCenter,
  type GestureEvent,
  type GestureState,
  type TouchPoint,
} from './gesture-machine.ts'

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

const isPhone = (): boolean => matchMedia('(max-width: 639px), (max-height: 499px)').matches

const PHONE_SHEET_HEIGHT_SHARE = 0.52
const sheetShown = (): boolean => matchMedia('(max-width: 639px) and (min-height: 500px)').matches

const GLIDE_EASE_SECONDS = 0.28
const GLIDE_MAX_PX_PER_S = 2400
const GLIDE_NEW_GESTURE_GAP_MS = 120
const GLIDE_WHEEL_IDLE_MS = 32
const GLIDE_STOPPED_PX_PER_S = 20

const isWebKit = (): boolean =>
  /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Android/.test(navigator.userAgent)

const rendererPreference = async (): Promise<Array<RendererPreference>> => {
  if (isWebKit() || !navigator.gpu) return ['webgl']
  const adapter = await navigator.gpu.requestAdapter().catch(() => null)
  return adapter ? ['webgpu', 'webgl'] : ['webgl']
}

export class BoardController {
  readonly app = new Application()
  readonly world = new Container()
  readonly wires = new Container()
  readonly bodies = new Container()
  readonly chevrons = new ChevronLayer()
  readonly mouths = new Container()
  readonly belts = new Map<string, BeltView>()
  beltLinks: ReadonlyArray<unknown> = []
  beltOrder = ''
  readonly splitters = new Graphics()
  splittersKey = ''
  splitLinks: Game['links'] | null = null
  splitFresh = 0
  readonly portals = new Graphics()
  mouthsDrawn: ReadonlyArray<Mouth> = []
  portalInk = -1
  readonly packets = new PacketLayer()
  readonly arrows = new Graphics()
  readonly notes = new NoteLayer()
  readonly places = new NoteLayer()
  readonly cards = new Container()
  readonly boxLayer = new Container()
  readonly boxes = new Graphics()
  readonly replication = new Graphics()
  readonly boxNames = new Container()
  boxesKey = ''
  replicationKey = ''
  private boxesFrom: Readonly<{
    boxes: Game['boxes']
    nodes: Game['nodes']
    colors: Palette
    locale: string
  }> | null = null
  private replicationFrom: Readonly<{
    game: Game
    region: BoardState['region']
    pairs: ReturnType<typeof replicationPairsOf>
  }> | null = null
  private replicationWires: ReadonlyArray<Wire> = []
  private pathFrom: Readonly<{
    focus: string
    nodes: Game['nodes']
    links: Game['links']
    path: ReadonlySet<string> | null
  }> | null = null
  readonly overlay = new Graphics()
  readonly ghost = new Container()
  readonly views = new Map<string, NodeView>()
  readonly shownCards = new Map<string, GameNode>()
  readonly drawnCards = new Map<string, { source: GameNode; drawn: Mutable<GameNode> }>()
  leaving: Array<NodeView> = []
  seeded = false
  state: BoardState | null = null
  gesture: GestureState = IDLE_GESTURE
  slotPress: {
    pointerId: number
    id: string
    slot: SlotKind
    x: number
    y: number
    moved: boolean
  } | null = null
  hoverLink: Readonly<{ from: string; to: string }> | null = null
  hoverAim: Readonly<{
    node: string | null
    link: Readonly<{ from: string; to: string }> | null
    since: number
  }> | null = null
  selectedLink: Readonly<{ from: string; to: string }> | null = null
  hoverNode: string | null = null
  pointer: Pt = { x: 0, y: 0 }
  panSpeed = 0
  panAt = 0
  coarse = false
  dropped: Readonly<{ id: string; x: number; y: number }> | null = null
  droppedAt = 0
  landing: Pt | null = null
  landingKey = ''
  routed = new Map<string, Wire>()
  routedNodes = new Map<string, Pt>()
  private readonly wireMemo = new Map<
    string,
    {
      from: GameNode
      to: GameNode
      fx: number
      fy: number
      tx: number
      ty: number
      table: Map<string, Wire>
      held: Map<string, Pt> | null
      wire: Wire
    }
  >()
  private ratesFrom: Ledger['links'] | null = null
  private readonly rates = new Map<string, Ledger['links'][number]>()
  routedFor = ''
  routedGame: Game | null = null
  routedHeld = ''
  routeWanted: Readonly<{
    key: string
    nodes: Array<RoutedNode>
    links: Array<RoutedLink>
  }> | null = null
  routeDone = ''
  routing = false
  heldLanding: Map<string, Pt> | null = null
  ghostType: ComponentId | null = null
  ghostLocale = 'en'
  wireEnd: Pt | null = null
  snapGlow = 0
  retract: { path: Route; t: number } | null = null
  readonly fresh = new Map<string, number>()
  wired: string | null = null
  cuts: Array<{ path: Route; t: number }> = []
  readonly abort = new AbortController()
  readonly cursorLayer = new CursorOverlay()
  cursorWaiting = false
  cursorSentAt = 0
  activity: SeatActivity | null = null
  pointerKnown = false
  over = false
  activityOf: (activity: SeatActivity) => string = (activity) => activity
  readonly resize: ResizeObserver
  readonly sight: IntersectionObserver
  onScreen = true
  phase = 0
  started = false
  fitted = false
  fittedWidth: number | null = null
  destroyed = false
  stillSettled = false
  stillTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    readonly host: HTMLElement,
    readonly events: BoardEvents,
  ) {
    this.resize = new ResizeObserver(() => this.onResize())
    this.sight = new IntersectionObserver((entries) => {
      const entry = entries.at(-1)
      if (!entry) return
      this.onScreen = entry.isIntersecting
      if (this.started) this.run()
    })
  }

  run(): void {
    if (this.state?.animate === false) {
      if (this.stillSettled) {
        this.app.stop()
        this.paint()
        return
      }
      if (this.stillTimer !== null) return
      this.app.start()
      this.stillTimer = setTimeout(() => {
        this.stillTimer = null
        this.stillSettled = true
        this.app.stop()
        this.paint()
      }, 600)
      return
    }
    if (this.stillTimer !== null) {
      clearTimeout(this.stillTimer)
      this.stillTimer = null
      this.stillSettled = false
    }
    if (this.onScreen && !this.state?.suspended) this.app.start()
    else this.app.stop()
  }

  paint(): void {
    if (!this.started || this.destroyed || this.state?.animate !== false) return
    this.app.render()
  }

  async start(initial: BoardState | undefined): Promise<void> {
    this.state = initial ?? null
    const preferred = await rendererPreference()
    await this.app.init({
      autoStart: false,
      backgroundAlpha: 1,
      backgroundColor: palette().canvas,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      width: Math.max(1, this.host.clientWidth),
      height: Math.max(1, this.host.clientHeight),
      preference: preferred,
    })
    await Promise.all([
      document.fonts.load('600 13px "Geist"'),
      document.fonts.load('500 10px "Geist Mono"'),
    ]).catch(() => undefined)
    if (this.destroyed) {
      this.app.destroy(true, { children: true })
      return
    }
    this.host.append(this.app.canvas)
    this.cursorLayer.mount(this.host)
    this.app.stage.addChild(this.world)
    this.chevrons.init(this.app.renderer)
    this.packets.init(this.app.renderer)
    this.wires.addChild(this.bodies, this.chevrons.root, this.mouths, this.portals, this.splitters)
    this.boxLayer.addChild(this.boxes, this.replication, this.boxNames)
    this.boxLayer.isRenderGroup = true
    this.world.addChild(
      this.boxLayer,
      this.wires,
      this.packets.root,
      this.arrows,
      this.notes.root,
      this.places.root,
      this.cards,
      this.overlay,
      this.ghost,
    )
    this.wires.isRenderGroup = true
    this.cards.isRenderGroup = true
    for (const part of [this.overlay, this.arrows, this.splitters, this.portals, this.boxes])
      part.context.batchMode = 'batch'
    this.ghost.alpha = 0.55
    this.ghost.visible = false
    this.bindPointer()
    this.app.ticker.add((ticker) => this.animate(ticker.deltaMS / 1000))
    this.started = true
    this.resize.observe(this.host)
    this.sight.observe(this.host)
    this.onResize()
    if (this.state !== null) this.draw(this.state)
    this.run()
  }

  draw(state: BoardState): void {
    if (this.started && this.seeded) this.diffLinks(state)
    const opened = state.selected !== null && state.selected !== this.state?.selected
    this.state = state
    this.activityOf = state.translateActivity ?? ((activity) => activity)
    const dropped = this.dropped
    if (dropped && this.gesture._tag !== 'Dragging') {
      const node = state.game.nodes.find((entry) => entry.id === dropped.id)
      const stale = performance.now() - this.droppedAt > 250
      if (!node || (node.x === dropped.x && node.y === dropped.y) || stale) this.dropped = null
    }
    if (!this.started) return
    if (state.suspended) {
      this.app.stop()
      return
    }
    if (!this.fitted) this.fit()
    if (opened && state.selected) this.reveal(state.selected)
    this.syncCards()
    this.syncGhost()
    this.run()
  }

  reveal(nodeId: string): void {
    if (!sheetShown()) return
    const node = this.state?.game.nodes.find((entry) => entry.id === nodeId)
    const h = this.host.clientHeight
    if (!node || h === 0) return
    const scale = this.world.scale.x
    const top = this.world.position.y + node.y * scale
    const bottom = top + heightOf(node.type) * scale
    const roomTop = 150
    const roomBottom = h * (1 - PHONE_SHEET_HEIGHT_SHARE) - 12
    if (top >= roomTop && bottom <= roomBottom) return
    const middle = (roomTop + roomBottom) / 2
    const centered = middle - (heightOf(node.type) * scale) / 2
    this.world.position.y += Math.max(roomTop, centered) - top
    this.paint()
  }

  diffLinks(next: BoardState): void {
    const keyOf = (link: Readonly<{ from: string; to: string }>) => `${link.from}>${link.to}`
    const before = this.state?.game.links ?? []
    const was = new Set(before.map(keyOf))
    const now = new Set(next.game.links.map(keyOf))
    for (const link of next.game.links) {
      const key = keyOf(link)
      if (was.has(key)) continue
      this.fresh.set(key, key === this.wired ? DRAW_IN_S : 0)
    }
    this.wired = null
    const shown = this.shown()
    for (const link of before) {
      if (now.has(keyOf(link))) continue
      const from = shown.get(link.from)
      const to = shown.get(link.to)
      if (from && to) this.cuts.push({ path: this.wireOf(from, to).path, t: 0 })
    }
  }

  repaint(): void {
    for (const view of this.views.values()) view.root.destroy({ children: true })
    this.views.clear()
    this.ghostType = null
    this.app.renderer.background.color = palette().canvas
    if (this.state) this.draw(this.state)
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.abort.abort()
    this.resize.disconnect()
    this.sight.disconnect()
    if (this.stillTimer !== null) clearTimeout(this.stillTimer)
    this.stillTimer = null
    this.cursorLayer.destroy()
    this.events.onCursorGone?.()
    if (this.started) this.app.destroy(true, { children: true })
  }

  onResize(): void {
    const { clientWidth: w, clientHeight: h } = this.host
    if (w === 0 || h === 0) return
    this.app.renderer.resize(w, h)
    if (!this.fitted || this.fittedWidth === null || Math.abs(w - this.fittedWidth) > 32) this.fit()
    this.paint()
  }

  fit(): void {
    const nodes = this.state?.game.nodes ?? []
    const { clientWidth: w, clientHeight: h } = this.host
    if (nodes.length === 0 || w === 0 || h === 0) return
    const phone = isPhone()
    const short = matchMedia('(max-height: 499px)').matches
    const pad = phone && this.state?.pad === undefined ? 24 : (this.state?.pad ?? 80)
    const minX = Math.min(...nodes.map((node) => node.x)) - pad
    const minY = Math.min(...nodes.map((node) => node.y)) - pad
    const maxX = Math.max(...nodes.map((node) => node.x + CARD_W)) + pad
    const maxY = Math.max(...nodes.map((node) => node.y + heightOf(node.type))) + pad
    const inset = this.state?.inset
    const top = inset ? inset.top : short ? 120 : phone ? 160 : 120
    const bottom = inset ? inset.bottom : short ? 70 : phone ? 90 : 210
    const room = Math.max(1, h - top - bottom)
    const left = inset ? inset.left : phone || short ? 0 : 380
    const edge = inset || phone || short ? 0 : 24
    const across = Math.max(1, w - left - edge)
    const scale = Math.max(
      phone ? MIN_FIT_SCALE_PHONE : (this.state?.minScale ?? MIN_FIT_SCALE),
      Math.min(1.1, Math.min(across / (maxX - minX), room / (maxY - minY))),
    )
    this.world.scale.set(scale)
    const x =
      phone && (maxX - minX) * scale > w
        ? -minX * scale
        : left + across / 2 - ((minX + maxX) / 2) * scale
    this.world.position.set(x, top + room / 2 - ((minY + maxY) / 2) * scale)
    this.fitted = true
    this.fittedWidth = w
    this.paint()
  }

  zoomBy(factor: number): void {
    const { clientWidth: w, clientHeight: h } = this.host
    if (w === 0 || h === 0 || factor <= 0) return
    const phone = isPhone()
    const top = phone ? 160 : 120
    const bottom = phone ? 90 : 210
    const left = phone ? 0 : 380
    const across = Math.max(1, w - left - (phone ? 0 : 380))
    const room = Math.max(1, h - top - bottom)
    const center = { x: left + across / 2, y: top + room / 2 }
    const before = this.world.toLocal(new Point(center.x, center.y))
    const scale = Math.min(1.6, Math.max(0.25, this.world.scale.x * factor))
    this.world.scale.set(scale)
    this.world.position.set(center.x - before.x * scale, center.y - before.y * scale)
    this.paint()
  }

  panBy(deltaX: number): void {
    const now = performance.now()
    const gap = now - this.panAt
    this.panAt = now
    this.panSpeed =
      gap > 0 && gap < GLIDE_NEW_GESTURE_GAP_MS
        ? Math.max(
            -GLIDE_MAX_PX_PER_S,
            Math.min(GLIDE_MAX_PX_PER_S, (-deltaX / Math.max(8, gap)) * 1000),
          )
        : 0
    this.world.position.x -= deltaX
  }

  glide(seconds: number): void {
    if (this.panSpeed === 0) return
    if (performance.now() - this.panAt < GLIDE_WHEEL_IDLE_MS) return
    const frame = Math.min(seconds, 0.05)
    this.world.position.x += this.panSpeed * frame
    this.panSpeed *= Math.exp(-frame / GLIDE_EASE_SECONDS)
    if (Math.abs(this.panSpeed) < GLIDE_STOPPED_PX_PER_S) this.panSpeed = 0
  }

  focus(nodeId: string): void {
    const node = this.state?.game.nodes.find((entry) => entry.id === nodeId)
    if (!node) return
    const { clientWidth: w, clientHeight: h } = this.host
    if (w === 0 || h === 0) return
    const phone = isPhone()
    const top = phone ? 160 : 120
    const bottom = sheetShown() ? h * PHONE_SHEET_HEIGHT_SHARE : phone ? 90 : 210
    const left = phone ? 0 : 380
    const right = phone ? 0 : 380
    const roomW = Math.max(1, w - left - right)
    const roomH = Math.max(1, h - top - bottom)
    const scale = Math.max(this.world.scale.x, phone ? MIN_FIT_SCALE_PHONE : MIN_FIT_SCALE)
    this.world.scale.set(scale)
    this.world.position.set(
      left + roomW / 2 - (node.x + CARD_W / 2) * scale,
      top + roomH / 2 - (node.y + heightOf(node.type) / 2) * scale,
    )
    this.fitted = true
    this.fittedWidth = w
    this.paint()
  }

  toWorld(event: PointerEvent | WheelEvent): Pt {
    const rect = this.host.getBoundingClientRect()
    const local = this.world.toLocal(new Point(event.clientX - rect.left, event.clientY - rect.top))
    return { x: local.x, y: local.y }
  }

  nodes(held = this.held()): ReadonlyArray<GameNode> {
    const nodes = this.state?.game.nodes ?? []
    if (!held) return nodes
    const lead = nodes.find((node) => node.id === held.id)
    const group = this.groupOf(held.id)
    const dx = lead ? held.x - lead.x : 0
    const dy = lead ? held.y - lead.y : 0
    return nodes.map((node) =>
      node.id === held.id
        ? { ...node, x: held.x, y: held.y }
        : group.includes(node.id)
          ? { ...node, x: node.x + dx, y: node.y + dy }
          : node,
    )
  }

  heldOf(gesture: GestureState): Readonly<{ id: string; x: number; y: number }> | null {
    if (gesture._tag !== 'Dragging' || !gesture.moved) return null
    return {
      id: gesture.id,
      x: Math.round((gesture.at.x - gesture.dx) / 8) * 8,
      y: Math.round((gesture.at.y - gesture.dy) / 8) * 8,
    }
  }

  held(): Readonly<{ id: string; x: number; y: number }> | null {
    return this.heldOf(this.gesture) ?? this.dropped
  }

  selectionFrame(): Readonly<{ x: number; y: number; w: number; h: number }> | null {
    const selection = this.state?.selection ?? []
    if (selection.length < 2) return null
    const cards = this.shown()
    const members = selection.flatMap((id) => cards.get(id) ?? [])
    if (members.length < 2) return null
    const pad = 14
    const left = Math.min(...members.map((node) => node.x)) - pad
    const top = Math.min(...members.map((node) => node.y)) - pad
    return {
      x: left,
      y: top,
      w: Math.max(...members.map((node) => node.x + CARD_W)) + pad - left,
      h: Math.max(...members.map((node) => node.y + heightOf(node.type))) + pad - top,
    }
  }

  groupOf(id: string): ReadonlyArray<string> {
    const selection = this.state?.selection ?? []
    return selection.length > 1 && selection.includes(id) ? selection : [id]
  }

  shown(): Map<string, GameNode> {
    const out = this.shownCards
    out.clear()
    for (const node of this.nodes()) {
      const at = this.views.get(node.id)?.at
      if (!at) {
        out.set(node.id, node)
        continue
      }
      let drawn = this.drawnCards.get(node.id)
      if (!drawn || drawn.source !== node) {
        const own = { writable: true, enumerable: true, configurable: true }
        drawn = {
          source: node,
          drawn: Object.create(node, {
            x: { ...own, value: at.x },
            y: { ...own, value: at.y },
          }) as Mutable<GameNode>,
        }
        this.drawnCards.set(node.id, drawn)
      }
      drawn.drawn.x = at.x
      drawn.drawn.y = at.y
      out.set(node.id, drawn.drawn)
    }
    return out
  }

  aimHover(node: string | null, link: Readonly<{ from: string; to: string }> | null): void {
    const aim = this.hoverAim
    if (
      aim !== null &&
      aim.node === node &&
      aim.link?.from === link?.from &&
      aim.link?.to === link?.to
    )
      return
    const shown =
      node === this.hoverNode &&
      link?.from === this.hoverLink?.from &&
      link?.to === this.hoverLink?.to
    if (shown && aim === null) return
    this.hoverNode = null
    this.hoverLink = null
    this.hoverAim = node === null && link === null ? null : { node, link, since: performance.now() }
  }

  settleHover(now: number): void {
    const aim = this.hoverAim
    if (aim === null || now - aim.since < HOVER_SETTLE_MS) return
    this.hoverNode = aim.node
    this.hoverLink = aim.link
    this.hoverAim = null
  }

  nodeAt(point: Pt): GameNode | null {
    return (
      this.nodes().findLast(
        (node) =>
          point.x >= node.x &&
          point.x <= node.x + CARD_W &&
          point.y >= node.y &&
          point.y <= node.y + heightOf(node.type),
      ) ?? null
    )
  }

  footerAt(node: GameNode, point: Pt): boolean {
    return this.world.scale.x >= CHIP_GONE_AT_ZOOM && inFooter(node, point)
  }

  slotAt(node: GameNode, point: Pt): SlotKind | null {
    if (!layoutOf(node.type).slots) return null
    const top = node.y + slotTop(node.type)
    if (point.y < top || point.y > top + SLOT_H) return null
    const kinds: ReadonlyArray<SlotKind> = ['cpu', 'ram', 'disk']
    const index = kinds.findIndex((_, at) => {
      const left = node.x + slotLeft(at)
      return point.x >= left && point.x <= left + SLOT_W
    })
    return index < 0 ? null : (kinds[index] ?? null)
  }

  outPortAt(point: Pt): GameNode | null {
    const reach = PORT_R + (this.coarse ? 16 : 6) / this.world.scale.x
    return (
      this.nodes().findLast((node) => {
        if (layoutOf(node.type).outRow === null) return false
        const port = outPort(node)
        return Math.hypot(port.x - point.x, port.y - point.y) <= reach
      }) ?? null
    )
  }

  selectLink(link: Readonly<{ from: string; to: string }>): void {
    this.selectedLink = link
    this.events.onEmptyTap()
  }

  onBadge(point: Pt): boolean {
    const link = this.selectedLink
    const from = link && this.shown().get(link.from)
    const to = link && this.shown().get(link.to)
    if (!from || !to) return false
    const mid = pointOn(this.wireOf(from, to).path, 0.5)
    return (
      Math.hypot(mid.x - point.x, mid.y - point.y) <= (this.coarse ? 16 : 11) / this.world.scale.x
    )
  }

  linkAt(point: Pt): Readonly<{ from: string; to: string }> | null {
    const byId = new Map(this.nodes().map((node) => [node.id, node]))
    const reach = (this.coarse ? 14 : 7) / this.world.scale.x
    let nearest: Readonly<{ from: string; to: string }> | null = null
    let closest = reach
    for (const link of this.state?.game.links ?? []) {
      const from = byId.get(link.from)
      const to = byId.get(link.to)
      if (!from || !to) continue
      const apart = distanceTo(this.wireOf(from, to).path, point)
      if (apart > closest) continue
      nearest = link
      closest = apart
    }
    return nearest
  }

  routes(): Map<string, Wire> {
    const game = this.state?.game
    const at = this.held()
    const heldKey = at ? `${at.id}:${at.x}:${at.y}` : ''
    if (!game || (game === this.routedGame && heldKey === this.routedHeld)) return this.routed
    this.routedGame = game
    this.routedHeld = heldKey
    const held = this.gesture._tag === 'Dragging' ? this.heldOf(this.gesture) : null
    const landing = held && this.landingOf()
    const blocked = held && landing && (landing.x !== held.x || landing.y !== held.y)
    const placed = blocked ? this.nodes({ id: held.id, x: landing.x, y: landing.y }) : this.nodes()
    if (blocked) {
      const group = this.groupOf(held.id)
      this.heldLanding = new Map(
        placed
          .filter((node) => group.includes(node.id))
          .map((node) => [node.id, { x: node.x, y: node.y }]),
      )
    } else if (held) this.heldLanding = null
    const links = [
      ...game.links.map(({ from, to }) => ({ from, to })),
      ...this.replicationLinks(game),
    ]
    const key = `${placed.map((node) => `${node.id}:${node.type}:${node.x}:${node.y}`).join('|')}#${links.map((link) => `${link.from}>${link.to}`).join('|')}`
    if (key !== this.routedFor) {
      this.routedFor = key
      this.routeWanted = {
        key,
        nodes: placed.map(({ id, type, x, y }) => ({ id, type, x, y })),
        links,
      }
      this.askRoute()
    }
    return this.routed
  }

  replicationLinks(game: Game): ReadonlyArray<RoutedLink> {
    const region = this.state?.region
    if (!region) return []
    return replicationPairsOf(game)
      .filter((pair) => pair.from.region === region && pair.to.region === region)
      .map((pair) => ({ from: pair.from.id, to: pair.to.id }))
  }

  askRoute(): void {
    const wanted = this.routeWanted
    if (this.routing || !wanted || wanted.key === this.routeDone) return
    this.routing = true
    void compute('route', { nodes: wanted.nodes, links: wanted.links }).then((wires) => {
      this.routing = false
      if (this.destroyed) return
      this.routeDone = wanted.key
      if (wires) {
        this.routed = wires
        this.routedNodes = new Map(wanted.nodes.map((node) => [node.id, node]))
        this.paint()
      }
      this.askRoute()
    })
  }

  wireOf(drawnFrom: GameNode, drawnTo: GameNode, key = `${drawnFrom.id}>${drawnTo.id}`): Wire {
    const table = this.routes()
    const held = this.heldLanding
    let memo = this.wireMemo.get(key)
    if (
      memo &&
      memo.from === drawnFrom &&
      memo.to === drawnTo &&
      memo.fx === drawnFrom.x &&
      memo.fy === drawnFrom.y &&
      memo.tx === drawnTo.x &&
      memo.ty === drawnTo.y &&
      memo.table === table &&
      memo.held === held
    )
      return memo.wire
    const fromAt = held?.get(drawnFrom.id)
    const toAt = held?.get(drawnTo.id)
    const from = fromAt ? { type: drawnFrom.type, x: fromAt.x, y: fromAt.y } : drawnFrom
    const to = toAt ? { type: drawnTo.type, x: toAt.x, y: toAt.y } : drawnTo
    const wire = this.freshWire(table.get(key), drawnFrom.id, drawnTo.id, from, to)
    memo ??= { from: drawnFrom, to: drawnTo, fx: 0, fy: 0, tx: 0, ty: 0, table, held, wire }
    memo.from = drawnFrom
    memo.to = drawnTo
    memo.fx = drawnFrom.x
    memo.fy = drawnFrom.y
    memo.tx = drawnTo.x
    memo.ty = drawnTo.y
    memo.table = table
    memo.held = held
    memo.wire = wire
    this.wireMemo.set(key, memo)
    return wire
  }

  private freshWire(
    wire: Wire | undefined,
    fromId: string,
    toId: string,
    from: Placed,
    to: Placed,
  ): Wire {
    const a = this.routedNodes.get(fromId)
    const b = this.routedNodes.get(toId)
    if (wire && a && b) {
      const da = { x: from.x - a.x, y: from.y - a.y }
      const db = { x: to.x - b.x, y: to.y - b.y }
      const off = Math.max(Math.abs(da.x), Math.abs(da.y), Math.abs(db.x), Math.abs(db.y))
      if (off === 0) return wire
      if (off <= ROUTE_SLACK_PX) {
        const path = bent(wire.path, da, db)
        return { path, pieces: [path], tunnels: [] }
      }
    }
    const path = routeOf(from, to)
    return { path, pieces: [path], tunnels: [] }
  }

  ratesFor(links: Ledger['links']): ReadonlyMap<string, Ledger['links'][number]> {
    if (links !== this.ratesFrom) {
      this.ratesFrom = links
      this.rates.clear()
      for (const link of links) this.rates.set(linkKey(link), link)
    }
    return this.rates
  }

  landingOf(
    dragged = this.gesture._tag === 'Dragging' ? this.heldOf(this.gesture) : null,
  ): Pt | null {
    const state = this.state
    if (!state) return null
    const pointer = { x: Math.round(this.pointer.x), y: Math.round(this.pointer.y) }
    const key = `${this.routedFor}/${dragged?.id}:${dragged?.x}:${dragged?.y}/${state.placing}/${state.stamp ? 'stamp' : ''}/${pointer.x}:${pointer.y}`
    if (key === this.landingKey) return this.landing
    this.landingKey = key
    const group = dragged ? this.groupOf(dragged.id) : []
    const others = state.game.nodes.filter((node) => !group.includes(node.id)).map(boxOf)
    const held = state.game.nodes.find((node) => node.id === dragged?.id)
    const members = state.game.nodes.filter((node) => group.includes(node.id))
    const left = Math.min(...members.map((node) => node.x))
    const top = Math.min(...members.map((node) => node.y))
    this.landing =
      dragged && held
        ? (() => {
            const spot = freeSpot(others, {
              x: left + dragged.x - held.x,
              y: top + dragged.y - held.y,
              w: Math.max(...members.map((node) => node.x + CARD_W)) - left,
              h: Math.max(...members.map((node) => node.y + heightOf(node.type))) - top,
            })
            return { x: held.x + spot.x - left, y: held.y + spot.y - top }
          })()
        : state.stamp
          ? freeSpot(others, {
              x: pointer.x,
              y: pointer.y,
              w: Math.max(...state.stamp.map((entry) => entry.dx)) + CARD_W,
              h: Math.max(...state.stamp.map((entry) => entry.dy + heightOf(entry.type))),
            })
          : state.placing
            ? freeSpot(others, {
                x: pointer.x - CARD_W / 2,
                y: pointer.y - heightOf(state.placing) / 2,
                w: CARD_W,
                h: heightOf(state.placing),
              })
            : null
    return this.landing
  }

  zoomBetween(
    before: Readonly<{ touches: ReadonlyArray<TouchPoint>; distance: number }>,
    next: Readonly<{ touches: ReadonlyArray<TouchPoint>; distance: number }>,
  ): void {
    if (before.touches.length < 2 || next.touches.length < 2 || before.distance <= 0) return
    const last = touchCenter(before.touches)
    const now = touchCenter(next.touches)
    const rect = this.host.getBoundingClientRect()
    const from = this.world.toLocal(new Point(last.x - rect.left, last.y - rect.top))
    const scale = Math.min(
      1.6,
      Math.max(0.25, (this.world.scale.x * next.distance) / before.distance),
    )
    this.world.scale.set(scale)
    this.world.position.set(now.x - rect.left - from.x * scale, now.y - rect.top - from.y * scale)
    this.paint()
  }

  toClient(at: Pt): Pt {
    const rect = this.host.getBoundingClientRect()
    const point = this.world.toGlobal(new Point(at.x, at.y))
    return { x: point.x + rect.left, y: point.y + rect.top }
  }

  pointerOf(gesture: GestureState): TouchPoint | null {
    if (gesture._tag === 'Pinching') return gesture.touches[0] ?? null
    if (gesture._tag === 'Idle') return null
    if (gesture._tag === 'Panning' || gesture._tag === 'PressPending' || gesture._tag === 'Holding')
      return { id: gesture.pointerId, x: gesture.x, y: gesture.y }
    const at = this.toClient(gesture.at)
    return { id: gesture.pointerId, x: at.x, y: at.y }
  }

  beginPinch(touches: ReadonlyArray<TouchPoint>): void {
    if (this.gestureStep({ _tag: 'SecondTouch', touches: [...touches] })._tag !== 'Pinching') return
    this.letGo()
    this.dropped = null
    this.syncCards()
  }

  gestureStep(event: GestureEvent): GestureState {
    this.gesture = gestureStep(this.gesture, event)
    return this.gesture
  }

  pressedId(): string | null {
    return pressedNode(this.gesture)
  }

  bindPointer(): void {
    bindPointer(this)
  }

  advanceHold(): void {
    const state = this.gesture
    const hold = holdOf(state)
    const now = performance.now()
    const share = hold ? holdProgress(hold.since, now) : 0
    for (const [key, view] of this.views) view.setHold(key === hold?.id ? share : 0)
    if (hold === null) return
    const next = this.gestureStep({ _tag: 'HoldTicked', now })
    if (state._tag !== 'Holding' || next._tag !== 'Idle') return
    this.letGo()
    this.syncCards()
    this.views.get(state.id)?.celebrate()
    this.events.onFooter(state.id)
  }

  letGo(): void {
    for (const view of this.views.values()) {
      view.held = false
      view.lifted = false
    }
  }

  springBack(fromId: string): void {
    const from = this.shown().get(fromId)
    const end = this.wireEnd
    this.wireEnd = null
    if (!from || !end) return
    const lane = laneUnder(from, end.y)
    this.retract = { path: route(outPort(from), end, lane), t: 0 }
    this.events.onSound?.('release', 1, true)
  }

  syncCards(): void {
    const state = this.state
    if (!state) return
    const colors = palette()
    const live = new Set<string>()
    const path = this.pathOf(state)
    const pressed = this.pressedId()
    for (const node of this.nodes()) {
      live.add(node.id)
      let view = this.views.get(node.id)
      if (!view || view.type !== node.type) {
        view?.root.destroy({ children: true })
        view = new NodeView(node.type, this.seeded)
        this.views.set(node.id, view)
        this.cards.addChild(view.root)
      }
      view.update(
        state.game,
        node,
        state.ledger,
        state.selected === node.id || state.selection.includes(node.id),
        pressed === node.id,
        colors,
        state.history[node.id] ?? [],
        state.ordinals[node.id] ?? 0,
        state.region,
        state.locale,
        state.translate,
      )
      view.dim = path !== null && !path.has(node.id)
    }
    for (const [id, view] of this.views) {
      if (live.has(id)) continue
      view.leave()
      this.leaving.push(view)
      this.views.delete(id)
      this.drawnCards.delete(id)
    }
    this.seeded = true
  }

  pathOf(state: BoardState): ReadonlySet<string> | null {
    const focus = this.hoverNode ?? state.selected
    if (!focus) return null
    const from = this.pathFrom
    if (
      from !== null &&
      from.focus === focus &&
      from.nodes === state.game.nodes &&
      from.links === state.game.links
    )
      return from.path
    const path = this.reachOf(state, focus)
    this.pathFrom = { focus, nodes: state.game.nodes, links: state.game.links, path }
    return path
  }

  private reachOf(state: BoardState, focus: string): ReadonlySet<string> | null {
    if (!state.game.nodes.some((node) => node.id === focus)) return null
    const reach = (next: (link: { from: string; to: string }) => readonly [string, string]) => {
      const seen = new Set([focus])
      const queue = [focus]
      for (let id = queue.pop(); id !== undefined; id = queue.pop())
        for (const link of state.game.links) {
          const [at, to] = next(link)
          if (at === id && !seen.has(to)) {
            seen.add(to)
            queue.push(to)
          }
        }
      return seen
    }
    const down = reach((link) => [link.from, link.to])
    const up = reach((link) => [link.to, link.from])
    return new Set([...down, ...up])
  }

  syncBelts(links: ReadonlyArray<Readonly<{ from: string; to: string }>>): void {
    if (links === this.beltLinks) return
    this.beltLinks = links
    const keys = links.map((link) => `${link.from}>${link.to}`)
    const order = keys.join('|')
    if (order === this.beltOrder) return
    this.beltOrder = order
    const live = new Set(keys)
    for (const [key, belt] of this.belts) {
      if (live.has(key)) continue
      belt.destroy()
      this.belts.delete(key)
    }
    this.bodies.removeChildren()
    this.mouths.removeChildren()
    for (const key of keys) {
      let belt = this.belts.get(key)
      if (!belt) {
        belt = new BeltView()
        this.belts.set(key, belt)
      }
      this.bodies.addChild(belt.body)
      this.mouths.addChild(belt.mouths)
    }
  }

  syncGhost(): void {
    const type = this.state?.placing ?? null
    const locale = this.state?.locale ?? 'en'
    if (type === this.ghostType && locale === this.ghostLocale) return
    this.ghostLocale = locale
    this.ghostType = type
    this.ghost.removeChildren().forEach((child) => child.destroy({ children: true }))
    this.ghost.visible = type !== null
    if (!type) return
    const colors = palette()
    const height = heightOf(type)
    const group = COMPONENTS[type].group
    const hue = colors.groups[group]
    const frame = new Graphics()
    silhouette(frame, group, 0, 0, CARD_W, height).fill(colors.card)
    headerBand(frame, group, hue, colors)
    silhouette(frame, group, 0, 0, CARD_W, height).stroke({ color: hue, width: 2 })
    medallion(frame, group, hue, colors)
    const name = label(15, SANS, '700')
    name.text = (this.state?.translate ?? String)(COMPONENTS[type].name)
    name.style.fill = colors.ink
    name.anchor.set(0, 0.5)
    name.position.set(TITLE_X, HEAD / 2)
    const size = badgeGlyph(group, BADGE_R)
    const mark = glyph(size)
    paint(mark, COMPONENT_ICONS[type], colors.card)
    mark.position.set(BADGE_X - size / 2, BADGE_Y - size / 2)
    this.ghost.addChild(frame, name, mark)
  }

  drawBoxes(game: Game, colors: Palette): void {
    const locale = this.state?.locale ?? 'en'
    const from = this.boxesFrom
    if (
      from !== null &&
      from.boxes === game.boxes &&
      from.nodes === game.nodes &&
      from.colors === colors &&
      from.locale === locale
    )
      return
    this.boxesFrom = { boxes: game.boxes, nodes: game.nodes, colors, locale }
    const pad = 18
    const found: Array<
      Readonly<{ name: string; x: number; y: number; w: number; h: number; hue: number }>
    > = []
    for (const box of game.boxes) {
      const members = game.nodes.filter((node) => box.nodes.includes(node.id))
      if (members.length < 2) continue
      const left = Math.min(...members.map((node) => node.x))
      const top = Math.min(...members.map((node) => node.y))
      const right = Math.max(...members.map((node) => node.x + CARD_W))
      const bottom = Math.max(...members.map((node) => node.y + heightOf(node.type)))
      found.push({
        name: box.name,
        x: left - pad,
        y: top - pad - 16,
        w: right - left + 2 * pad,
        h: bottom - top + 2 * pad + 16,
        hue: members.every(
          (node) => COMPONENTS[node.type].group === COMPONENTS[members[0]!.type].group,
        )
          ? colors.groups[COMPONENTS[members[0]!.type].group]
          : colors.accent,
      })
    }
    const key = `${this.state?.locale ?? 'en'}|${found.map((box) => `${box.name}:${box.x}:${box.y}:${box.w}:${box.h}:${box.hue}`).join(';')}`
    if (key === this.boxesKey) return
    this.boxesKey = key
    this.boxes.clear()
    this.boxNames.removeChildren().forEach((child) => child.destroy())
    for (const box of found) {
      this.boxes.roundRect(box.x, box.y, box.w, box.h, 16).fill({ color: box.hue, alpha: 0.05 })
      dashed(
        this.boxes,
        [
          { x: box.x, y: box.y },
          { x: box.x + box.w, y: box.y },
          { x: box.x + box.w, y: box.y + box.h },
          { x: box.x, y: box.y + box.h },
          { x: box.x, y: box.y },
        ],
        9,
        6,
      )
      this.boxes.stroke({ color: box.hue, width: 1.5, alpha: 0.55 })
      const name = label(12, SANS, '600')
      name.text = (this.state?.translate ?? String)(box.name)
      name.style.fill = box.hue
      name.position.set(box.x + 12, box.y + 6)
      this.boxNames.addChild(name)
    }
  }

  drawReplication(state: BoardState, colors: Palette): void {
    const from = this.replicationFrom
    const pairs =
      from !== null && from.game === state.game && from.region === state.region
        ? from.pairs
        : replicationPairsOf(state.game).filter(
            (pair) => pair.from.region === state.region && pair.to.region === state.region,
          )
    this.replicationFrom = { game: state.game, region: state.region, pairs }
    if (pairs.length === 0) {
      this.replicationWires = []
      if (this.replicationKey !== '') {
        this.replicationKey = ''
        this.replication.clear()
      }
      return
    }
    const wires = pairs.map((pair) => ({
      replica: pair.to,
      wire: this.wireOf(pair.from, pair.to),
    }))
    const drawn = this.replicationWires
    if (drawn.length === wires.length && wires.every(({ wire }, index) => drawn[index] === wire))
      return
    this.replicationWires = wires.map(({ wire }) => wire)
    const key = wires
      .map(
        ({ replica, wire }) =>
          `${replica.id}:${wire.path.map((point) => `${point.x},${point.y}`).join(' ')}`,
      )
      .join(';')
    if (key === this.replicationKey) return
    this.replicationKey = key
    this.replication.clear()
    for (const { wire } of wires)
      for (const piece of wire.pieces) dashed(this.replication, piece, 9, 6)
    this.replication.stroke({ color: colors.accent, width: 1.25, alpha: 0.45 })
  }

  animate(seconds: number): void {
    this.glide(seconds)
    animate(this, seconds)
  }

  flushCursor(now: number): void {
    if (!this.cursorWaiting) return
    const state = this.state
    if (state === null || now - this.cursorSentAt < CURSOR_MS) return
    this.emitCursor()
  }

  emitCursor(): void {
    const state = this.state
    if (state === null || !this.pointerKnown) return
    this.cursorWaiting = false
    this.cursorSentAt = performance.now()
    this.events.onCursor?.({
      x: this.pointer.x,
      y: this.pointer.y,
      region: state.region,
      activity: this.activity,
    })
  }

  setCursorActivity(activity: SeatActivity | null): void {
    if (this.activity === activity) return
    this.activity = activity
    if (this.state === null || !this.pointerKnown) return
    if (activity !== null || this.over) {
      this.emitCursor()
      return
    }
    this.cursorWaiting = false
    this.events.onCursorGone?.()
  }

  moveSeatCursor(cursor: SeatCursor): void {
    this.cursorLayer.move(cursor, performance.now())
  }

  hideSeatCursor(seat: string): void {
    this.cursorLayer.remove(seat)
  }

  clearSeatCursors(): void {
    this.cursorLayer.clear()
  }
}
