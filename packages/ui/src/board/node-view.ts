import { isDown, leftOf, warmOf } from '@quorum/simulation/life'
import { Container, Graphics, Sprite, Text } from 'pixi.js'
import { COMPONENTS, POOLS, type BuildGroup, type ComponentId } from '@quorum/simulation/catalog'
import { POOL_ICONS } from '../game/pool-visuals.ts'
import { type Ledger, type NodeStatus } from '@quorum/simulation/ledger'
import { type Game, type GameNode, type Region } from '@quorum/simulation/state'
import { partsUnlocked } from '@quorum/simulation/parts'
import {
  BAY_H,
  CARD_W,
  HEAD,
  INSET,
  PORT_R,
  ROW,
  SLOT_H,
  SLOT_W,
  heightOf,
  layoutOf,
  rowMid,
  rowTop,
  bayTop,
  panelBottom,
  slotLeft,
  slotTop,
  type Pt,
} from './geometry.ts'
import { FOOT_ICONS, ROW_ICONS, footerOf, rowsOf, sizePips, slotsOf, type RowTone } from './card.ts'
import { COMPONENT_ICONS } from '../game/component-icons.ts'
import { type Palette, mix, gradient } from './palette.ts'
import { silhouette, badgeGlyph } from './shapes.ts'
import { easeOut, ENTER_S, EXIT_S, reducedMotion, follow } from './motion.ts'
import { glyph, paint, paintLogo } from './glyphs.ts'
import {
  footerRect,
  BADGE_X,
  BADGE_Y,
  BADGE_R,
  TITLE_X,
  medallion,
  headerBand,
  recess,
  screw,
  pipsWidth,
  pips,
} from './card-parts.ts'
import { MONO, SANS, fitText, label } from './text.ts'
import { OFF_PATH_ALPHA } from './belt-view.ts'

export const MIN_FIT_SCALE = 0.85
export const MIN_FIT_SCALE_PHONE = 0.42

export class NodeView {
  readonly root = new Container()
  private readonly shadow = new Graphics()
  private readonly ring = new Graphics()
  private readonly frame = new Graphics()
  private readonly medal = new Graphics()
  private readonly bars = new Graphics()
  private readonly ports = new Graphics()
  private readonly mark = glyph(12)
  private readonly chip = new Graphics()
  private readonly chipTitle = label(15, SANS, '600')
  private chipKey = ''
  private chipName = ''
  private chipHue = 0
  private chipStatus: NodeStatus = 'idle'
  private chipLoad = 0
  private readonly title = label(15, SANS, '700')
  private readonly titleShadow = label(15, SANS, '700')
  private readonly grip = new Graphics()
  private readonly glyphs: Array<Sprite> = []
  private readonly names: Array<Text> = []
  private readonly values: Array<Text> = []
  private readonly valueMarks: Array<Sprite> = []
  private readonly rows = new Container()
  private readonly live = new Container()
  private readonly slotsLayer = new Container()
  private readonly slotPads = new Graphics()
  private readonly slotNames: Array<Text> = []
  private readonly slotValues: Array<Text> = []
  private readonly chipLayer = new Container()
  private readonly foot = label(12, SANS, '600')
  private readonly footMark = glyph(14)
  private footed = false
  private readonly markRing = new Graphics()
  private ringAt: Readonly<{ x: number; y: number; ink: number }> | null = null
  private ringKey = ''
  private holdShare = 0
  private readonly holdFill = new Graphics()
  private holdKey = -1
  private cheer = -1
  private readonly burst = new Graphics()
  private digest = ''
  private frameKey = ''
  private medalKey = ''
  private barsKey = ''
  private stranded: boolean | null = null
  private shadowDrawn = false
  private age = Number.POSITIVE_INFINITY
  private leaving = -1

  private readonly group: BuildGroup
  readonly height: number
  at: Pt | null = null
  private target: Pt = { x: 0, y: 0 }
  lifted = false
  private lift = 0
  held = false
  private hold = 0
  private selected = false
  dim = false
  private selection = 0
  private accent = 0

  constructor(
    readonly type: ComponentId,
    enter: boolean,
  ) {
    const layout = layoutOf(type)
    this.group = COMPONENTS[type].group
    this.height = heightOf(type)
    this.root.pivot.set(CARD_W / 2, this.height / 2)
    if (enter) {
      this.age = 0
      this.root.alpha = 0
      if (!reducedMotion()) this.root.scale.set(ENTER_FROM_SCALE)
    }
    this.shadow.alpha = 0
    for (const part of [
      this.shadow,
      this.ring,
      this.frame,
      this.chip,
      this.holdFill,
      this.burst,
      this.bars,
      this.ports,
      this.medal,
      this.markRing,
    ])
      part.context.batchMode = 'batch'
    this.chipLayer.addChild(this.chip)
    this.root.addChild(
      this.shadow,
      this.ring,
      this.frame,
      this.chipLayer,
      this.holdFill,
      this.burst,
      this.ports,
      this.medal,
      this.mark,
      this.titleShadow,
      this.title,
      this.grip,
      this.foot,
      this.footMark,
      this.markRing,
      this.chipTitle,
    )
    this.chipTitle.anchor.set(0.5, 0.5)
    this.chipLayer.visible = false
    this.chipTitle.visible = false
    const glyphSize = badgeGlyph(this.group, BADGE_R)
    this.mark.setSize(glyphSize)
    this.mark.position.set(BADGE_X - glyphSize / 2, BADGE_Y - glyphSize / 2)
    this.title.anchor.set(0, 0.5)
    this.title.position.set(TITLE_X, HEAD / 2)
    this.titleShadow.anchor.set(0, 0.5)
    this.titleShadow.position.set(TITLE_X, HEAD / 2 + 1)
    this.titleShadow.alpha = 0.45
    this.titleShadow.style.fill = 0xffffff
    this.grip.context.batchMode = 'batch'
    for (let index = 0; index < layout.rows; index += 1) {
      const mark = glyph(13)
      const name = label(11, SANS, '500')
      const value = label(11, MONO, '500')
      name.anchor.set(0, 0.5)
      value.anchor.set(1, 0.5)
      mark.position.set(13, rowMid(index) - 7.5)
      name.position.set(32, rowMid(index) - 1)
      value.position.set(CARD_W - 14, rowMid(index) - 1)
      const valueMark = glyph(13)
      valueMark.visible = false
      this.glyphs.push(mark)
      this.names.push(name)
      this.values.push(value)
      this.valueMarks.push(valueMark)
      this.rows.addChild(mark, name, value, valueMark)
    }
    this.live.addChild(this.bars, this.rows)
    this.root.addChild(this.live)
    this.foot.anchor.set(0, 0.5)
    if (layout.slots) {
      this.slotPads.context.batchMode = 'batch'
      this.slotsLayer.addChild(this.slotPads)
      for (let index = 0; index < 3; index += 1) {
        const name = label(8, SANS, '600')
        const value = label(13, MONO, '700')
        name.anchor.set(0.5, 0.5)
        value.anchor.set(0.5, 0.5)
        this.slotNames.push(name)
        this.slotValues.push(value)
        this.slotsLayer.addChild(name, value)
      }
      this.root.addChild(this.slotsLayer)
    }
  }

  detail(rows: number, chip: number, colors: Palette): void {
    const full = 1 - chip
    this.live.visible = full > 0
    this.rows.visible = rows > 0
    this.rows.alpha = rows * full
    this.bars.alpha = full
    for (const part of [
      this.frame,
      this.title,
      this.grip,
      this.foot,
      this.markRing,
      this.slotsLayer,
    ]) {
      part.visible = full > 0
      part.alpha = full
    }
    this.titleShadow.visible = full > 0
    this.titleShadow.alpha = full * 0.45
    this.footMark.visible = full > 0 && this.footed
    this.footMark.alpha = full
    this.chipLayer.visible = chip > 0
    this.chip.alpha = chip
    this.chipTitle.visible = chip > 0
    this.chipTitle.alpha = chip
    if (chip > 0) this.drawChip(colors)
  }

  private drawChip(colors: Palette): void {
    const load = Math.round(this.chipLoad * 20) / 20
    const key = `${this.chipName}:${this.chipHue}:${this.chipStatus}:${load}:${colors.card}:${colors.shade}`
    if (key === this.chipKey) return
    this.chipKey = key
    this.chip.clear()
    silhouette(this.chip, this.group, 0, 0, CARD_W, this.height).fill(
      mix(colors.card, this.chipHue, 0.08),
    )
    silhouette(this.chip, this.group, 0, 0, CARD_W, this.height).stroke({
      color: mix(this.chipHue, colors.shade, 0.25),
      width: 1.5,
      alignment: 1,
    })
    const ring = BADGE_R + 9
    this.chip.circle(BADGE_X, BADGE_Y, ring).stroke({ color: colors.well, width: 3 })
    if (load > 0)
      this.chip
        .moveTo(BADGE_X, BADGE_Y - ring)
        .arc(BADGE_X, BADGE_Y, ring, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * load)
        .stroke({
          color:
            this.chipStatus === 'danger' || this.chipStatus === 'down'
              ? colors.danger
              : load >= 0.9
                ? colors.danger
                : load >= 0.7
                  ? colors.warn
                  : colors.accent,
          width: 3,
          cap: 'round',
        })
    this.chipTitle.style.fill = this.chipStatus === 'down' ? colors.danger : colors.ink
    this.chipTitle.position.set(CARD_W / 2, this.height / 2)
    fitText(this.chipTitle, this.chipName, CARD_W - 24)
  }

  leave(): void {
    this.leaving = 0
  }

  private drawMarkRing(): void {
    const at = this.ringAt
    const key = at ? `${at.x}:${at.y}:${at.ink}:${this.holdShare}` : ''
    if (key === this.ringKey) return
    this.ringKey = key
    this.markRing.clear()
    if (!at) return
    this.markRing.circle(at.x, at.y, 12).stroke({ color: at.ink, width: 1.5, alpha: 0.35 })
    if (this.holdShare > 0)
      this.markRing
        .moveTo(at.x, at.y - 12)
        .arc(at.x, at.y, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.holdShare)
        .stroke({ color: at.ink, width: 2.5 })
  }

  setHold(share: number): void {
    const key = Math.round(share * 200)
    if (key === this.holdKey) return
    this.holdKey = key
    this.holdShare = share
    this.drawMarkRing()
    this.holdFill.clear()
    if (share <= 0) return
    const { x, y, w, h } = footerRect(this.type)
    this.holdFill
      .roundRect(x, y + 2, Math.max(16, w * share), h, 8)
      .fill({ color: 0xffffff, alpha: 0.32 })
  }

  celebrate(): void {
    this.cheer = 0
  }

  private drawCheer(seconds: number, still: boolean): void {
    if (this.cheer < 0) return
    this.cheer += seconds
    const t = Math.min(1, this.cheer / CHEER_S)
    this.burst.clear()
    if (t >= 1 || still) {
      this.cheer = -1
      return
    }
    const out = easeOut(t)
    const fade = 1 - t
    const grow = 6 + 34 * out
    silhouette(
      this.burst,
      this.group,
      -grow,
      -grow,
      CARD_W + grow * 2,
      this.height + grow * 2,
      4 + grow / 2,
    ).stroke({
      color: 0xf5b82e,
      width: 4 * fade + 0.5,
      alpha: 0.9 * fade,
    })
    const { x, y, w, h } = footerRect(this.type)
    this.burst.roundRect(x, y + 2, w, h, 8).fill({ color: 0xffe08a, alpha: 0.7 * fade * fade })
  }

  tick(seconds: number, still: boolean): boolean {
    let scale = 1
    if (this.leaving >= 0) {
      this.leaving += seconds
      const t = easeOut(Math.min(1, this.leaving / EXIT_S))
      this.root.alpha = 1 - t
      scale = 1 - 0.04 * t
    } else if (this.age < ENTER_S) {
      this.age += seconds
      const t = easeOut(Math.min(1, this.age / ENTER_S))
      this.root.alpha = t
      scale = ENTER_FROM_SCALE + (1 - ENTER_FROM_SCALE) * t
    }
    if (this.leaving < 0 && this.age >= ENTER_S)
      this.root.alpha +=
        ((this.dim ? OFF_PATH_ALPHA : 1) - this.root.alpha) * follow(seconds, 16, still)
    const at = this.at ?? this.target
    const k = follow(seconds, this.lifted ? 38 : 16, still)
    const x = at.x + (this.target.x - at.x) * k
    const y = at.y + (this.target.y - at.y) * k
    this.at = {
      x: Math.abs(this.target.x - x) < 0.1 ? this.target.x : x,
      y: Math.abs(this.target.y - y) < 0.1 ? this.target.y : y,
    }
    this.root.position.set(this.at.x + CARD_W / 2, this.at.y + this.height / 2)
    this.drawCheer(seconds, still)
    this.lift += ((this.lifted ? 1 : 0) - this.lift) * follow(seconds, 20, still)
    this.hold += ((this.held ? 1 : 0) - this.hold) * follow(seconds, 32, still)
    this.shadow.alpha = this.lift
    if (!still) scale *= 1 + 0.03 * this.lift - 0.02 * this.hold
    this.root.scale.set(still ? 1 : scale)
    const selection =
      this.selection + ((this.selected ? 1 : 0) - this.selection) * follow(seconds, 24, still)
    if (Math.abs(selection - this.selection) > 0.001) {
      this.selection =
        Math.abs(selection - (this.selected ? 1 : 0)) < 0.01 ? (this.selected ? 1 : 0) : selection
      this.drawRing()
    }
    return this.leaving < EXIT_S
  }

  private drawRing(): void {
    const e = this.selection
    this.ring.clear()
    this.ring.alpha = e
    if (e <= 0) return
    const pad = 2.5 + 5 * (1 - e)
    silhouette(this.ring, this.group, 0, 0, CARD_W, this.height, pad + 2).fill({
      color: this.accent,
      alpha: 0.07,
    })
    silhouette(this.ring, this.group, 0, 0, CARD_W, this.height, pad).stroke({
      color: this.accent,
      width: 2,
    })
  }

  update(
    game: Game,
    node: GameNode,
    ledger: Ledger,
    selected: boolean,
    pressed: boolean,
    colors: Palette,
    history: ReadonlyArray<number>,
    ordinal: number,
    region: Region | null,
    locale: string,
    t: (text: string) => string,
  ): void {
    const own = ledger.nodes[node.id]
    if (!own) return
    const def = COMPONENTS[node.type]
    const layout = layoutOf(node.type)
    const rows = rowsOf(game, node, ledger, history, region, ordinal)
    const footer = footerOf(game, node)
    const slots = slotsOf(node, own, partsUnlocked(game))
    this.chipName = t(def.name)
    this.chipHue = colors.groups[this.group]
    this.chipStatus = own.status
    this.chipLoad = Math.min(1, own.utilization)
    this.target = { x: node.x, y: node.y }
    this.at ??= this.target
    if (this.selected !== selected || this.accent !== colors.accent) {
      this.selected = selected
      this.accent = colors.accent
      this.drawRing()
    }
    const digest = JSON.stringify([
      locale,
      pressed,
      rows,
      footer,
      slots,
      own.limit,
      own.status,
      selected,
      Math.ceil(leftOf(node.life)),
      warmOf(node.life) < 1,
      ordinal,
      colors.card,
      colors.shade,
    ])
    if (digest === this.digest) return
    this.digest = digest

    const height = heightOf(node.type)
    const hotDanger = colors.danger
    const hotWarn = colors.warn
    const toneOf = (tone: RowTone | undefined) =>
      tone === 'danger'
        ? colors.danger
        : tone === 'warn'
          ? colors.warn
          : tone === 'ok'
            ? colors.ok
            : tone === 'muted'
              ? colors.muted
              : colors.ink
    const status =
      own.status === 'down' || own.status === 'danger'
        ? colors.danger
        : own.status === 'warn'
          ? colors.warn
          : own.status === 'ok'
            ? colors.ok
            : colors.border
    const edge = own.status === 'danger' || own.status === 'down' ? colors.danger : colors.border

    const group = this.group
    const hue = colors.groups[group]
    const badgeTone = node.life._tag === 'Stopped' ? colors.muted : hue
    const rect = footerRect(node.type)
    const sink = footer && pressed && footer.enabled && footer.tone !== 'muted' ? 2 : 0
    const frameKey = `${edge}:${isDown(node.life)}:${footer?.tone}:${sink}:${selected}:${colors.card}:${colors.shade}`
    if (frameKey !== this.frameKey) {
      this.frameKey = frameKey
      this.frame.clear()
      silhouette(this.frame, group, 1, 4, CARD_W - 2, height).fill({
        color: colors.shade,
        alpha: 0.06,
      })
      silhouette(this.frame, group, 0, 2, CARD_W, height).fill(mix(colors.card, colors.shade, 0.3))
      silhouette(this.frame, group, 0, 0, CARD_W, height).fill(
        gradient(mix(colors.card, 0xffffff, 0.5), mix(colors.card, colors.shade, 0.05)),
      )
      headerBand(this.frame, group, hue, colors)
      const glint = mix(colors.card, 0xffffff, 0.25)
      silhouette(this.frame, group, 0, 0, CARD_W, height, -1.5).stroke({
        color: glint,
        width: 1,
        alpha: 0.5,
      })
      if (layout.rows > 0)
        recess(
          this.frame,
          INSET,
          HEAD + INSET,
          CARD_W - INSET * 2,
          panelBottom(node.type) - HEAD - INSET,
          7,
          colors,
          mix(colors.card, colors.well, 0.5),
        )
      for (let index = 1; index < layout.rows; index += 1) {
        this.frame
          .moveTo(14, rowTop(index))
          .lineTo(CARD_W - 14, rowTop(index))
          .stroke({ color: colors.shade, width: 1, alpha: 0.1 })
        this.frame
          .moveTo(14, rowTop(index) + 1)
          .lineTo(CARD_W - 14, rowTop(index) + 1)
          .stroke({ color: glint, width: 1, alpha: 0.6 })
      }
      if (isDown(node.life))
        silhouette(this.frame, group, 0, 0, CARD_W, height).fill({
          color: colors.danger,
          alpha: 0.07,
        })
      if (footer) {
        const fill =
          footer.tone === 'ok'
            ? colors.ok
            : footer.tone === 'danger'
              ? colors.danger
              : footer.tone === 'accent'
                ? colors.accent
                : colors.track
        const { x, y, w, h } = rect
        if (footer.tone === 'muted') {
          this.frame.roundRect(x, y + 1, w, h, 8).fill(fill)
          this.frame
            .roundRect(x, y + 1, w, h, 8)
            .stroke({ color: colors.shade, width: 1, alignment: 1, alpha: 0.06 })
          this.frame
            .moveTo(x + 8, y + 1.5)
            .lineTo(x + w - 8, y + 1.5)
            .stroke({ color: colors.shade, width: 1, alpha: 0.06 })
        } else {
          const top = footer.tone === 'accent' ? colors.fillTop : mix(fill, 0xffffff, 0.16)
          const bottom = footer.tone === 'accent' ? colors.fillBottom : mix(fill, 0x000000, 0.08)
          const lifted = y + sink
          if (!sink)
            this.frame.roundRect(x, y + 3, w, h, 8).fill({ color: colors.shade, alpha: 0.12 })
          this.frame.roundRect(x, y + 2, w, h, 8).fill(mix(bottom, 0x000000, 0.28))
          this.frame.roundRect(x, lifted, w, h, 8).fill(gradient(top, bottom))
          this.frame
            .roundRect(x, lifted, w, h, 8)
            .stroke({ color: mix(bottom, 0x000000, 0.3), width: 1, alignment: 1, alpha: 0.7 })
          this.frame
            .moveTo(x + 8, lifted + 1.5)
            .lineTo(x + w - 8, lifted + 1.5)
            .stroke({ color: 0xffffff, width: 1, alpha: 0.28 })
        }
      }
      this.frame
        .moveTo(10, height - 0.5)
        .lineTo(CARD_W - 10, height - 0.5)
        .stroke({ color: colors.shade, width: 1, alpha: 0.28 })
      silhouette(this.frame, group, 0, 0, CARD_W, height).stroke({
        color: edge,
        width: 1,
        alignment: 1,
        alpha: 0.8,
      })
      if (selected)
        silhouette(this.frame, group, 0, 0, CARD_W, height, 4).stroke({
          color: colors.accent,
          width: 2.5,
          alpha: 0.55,
        })
    }
    this.footed = Boolean(footer)
    if (footer) {
      const { x, y, w, h } = rect
      const ink =
        footer.tone === 'muted' ? colors.muted : footer.tone === 'accent' ? colors.onFill : 0xffffff
      this.foot.text = t(footer.text)
      const ringed = footer.enabled && (footer.glyph === 'resize' || footer.glyph === 'more')
      const pad = ringed ? 5 : 0
      const start = x + pad + (w - (14 + 6 + this.foot.width + pad * 2)) / 2
      const mid = y + h / 2 + (footer.tone === 'muted' ? 1 : sink)
      paint(this.footMark, FOOT_ICONS[footer.glyph], ink)
      this.footMark.position.set(start, mid - 7)
      this.ringAt = ringed ? { x: start + 7, y: mid, ink } : null
      this.drawMarkRing()
      this.foot.position.set(start + 20 + pad, mid)
      this.foot.style.fill = ink
    } else {
      this.foot.text = ''
      this.ringAt = null
      this.drawMarkRing()
    }
    if (slots) {
      this.slotPads.clear()
      recess(
        this.slotPads,
        INSET,
        bayTop(node.type),
        CARD_W - INSET * 2,
        BAY_H,
        10,
        colors,
        mix(colors.card, colors.well, 0.5),
      )
      const pinsAt = (SLOT_W - (8 * 4.2 + 2.6)) / 2
      slots.forEach((slot, index) => {
        const x = slotLeft(index)
        const y = slotTop(node.type)
        const hue =
          slot.kind === 'cpu'
            ? colors.groups.compute
            : slot.kind === 'ram'
              ? colors.groups.data
              : colors.warn
        const alert = slot.tone === 'danger' ? hotDanger : slot.tone === 'warn' ? hotWarn : null
        const body = mix(hue, colors.muted, 0.35)
        const gold = mix(colors.warn, 0xffffff, 0.35)
        const socket = mix(colors.card, colors.well, 0.7)

        this.slotPads.roundRect(x - 2, y - 2, SLOT_W + 4, SLOT_H + 4, 11).fill(socket)
        this.slotPads.roundRect(x, y, SLOT_W, SLOT_H, 9).fill({ color: colors.shade, alpha: 0.12 })

        if (!slot.empty) {
          this.slotPads
            .roundRect(x + 0.5, y + 2.5, SLOT_W - 1, SLOT_H - 1, 8)
            .fill({ color: colors.shade, alpha: 0.26 })
          this.slotPads
            .roundRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1, 8)
            .fill(gradient(mix(body, 0xffffff, 0.1), mix(body, 0x000000, 0.5)))
          this.slotPads
            .roundRect(x + 0.5, y + 0.5, SLOT_W - 1, SLOT_H - 1, 8)
            .stroke({ color: mix(body, 0x000000, 0.5), width: 1, alignment: 1 })
          this.slotPads.roundRect(x + 3, y + 3, SLOT_W - 6, SLOT_H - 6, 6).stroke({
            color: mix(hue, 0xffffff, 0.45),
            width: 1,
            alignment: 1,
            alpha: 0.28,
          })
          this.slotPads
            .moveTo(x + 6, y + 2.6)
            .lineTo(x + SLOT_W - 6, y + 2.6)
            .stroke({ color: 0xffffff, width: 1, alpha: 0.16 })
          this.slotPads
            .roundRect(x + 5, y + SLOT_H - 11, SLOT_W - 10, 6, 3)
            .fill({ color: 0x000000, alpha: 0.2 })
          for (let pin = 0; pin < 9; pin += 1)
            this.slotPads
              .roundRect(x + pinsAt + pin * 4.2, y + SLOT_H - 6, 2.6, 3.6, 0.9)
              .fill(gold)
          screw(this.slotPads, x + 8, y + 8, colors, false)
          screw(this.slotPads, x + SLOT_W - 8, y + 8, colors, false)
          screw(this.slotPads, x + 8, y + SLOT_H - 10, colors, false)
          screw(this.slotPads, x + SLOT_W - 8, y + SLOT_H - 10, colors, false)
        } else {
          screw(this.slotPads, x + 8, y + 8, colors, true)
          screw(this.slotPads, x + SLOT_W - 8, y + 8, colors, true)
          screw(this.slotPads, x + 8, y + SLOT_H - 10, colors, true)
          screw(this.slotPads, x + SLOT_W - 8, y + SLOT_H - 10, colors, true)
          for (let pin = 0; pin < 9; pin += 1)
            this.slotPads
              .roundRect(x + pinsAt + pin * 4.2, y + SLOT_H - 6, 2.6, 3.6, 0.9)
              .fill({ color: mix(gold, colors.shade, 0.5), alpha: 0.7 })
          this.slotPads
            .roundRect(x + 3, y + 3, SLOT_W - 6, SLOT_H - 6, 6)
            .stroke({ color: colors.border, width: 1, alignment: 1, alpha: 0.8 })
        }

        this.slotPads.roundRect(x - 2, y - 2, SLOT_W + 4, SLOT_H + 4, 11).stroke({
          color: alert ?? colors.shade,
          width: alert ? 1.5 : 1,
          alignment: 1,
          alpha: alert ? 1 : 0.1,
        })

        const name = this.slotNames[index]
        const value = this.slotValues[index]
        if (!name || !value) return
        name.text = t(slot.label)
        name.style.fill = slot.empty ? colors.muted : mix(0xffffff, hue, 0.18)
        name.position.set(x + SLOT_W / 2, y + 12)
        value.text = t(slot.value)
        value.style.fill = slot.empty ? (alert ?? colors.muted) : 0xffffff
        value.position.set(x + SLOT_W / 2, y + 27)
      })
    }
    if (!this.shadowDrawn) {
      this.shadowDrawn = true
      silhouette(this.shadow, group, 6, 18, CARD_W - 12, height - 6, 10).fill({
        color: colors.shade,
        alpha: 0.05,
      })
      silhouette(this.shadow, group, 2, 9, CARD_W - 4, height - 2, 3).fill({
        color: colors.shade,
        alpha: 0.08,
      })
    }
    const medalKey = `${badgeTone}:${own.status}`
    if (medalKey !== this.medalKey) {
      this.medalKey = medalKey
      this.medal.clear()
      medallion(this.medal, group, badgeTone, colors)
      if (status !== colors.border) {
        const sx = BADGE_X + 15
        const sy = BADGE_Y + 15
        this.medal.circle(sx, sy, 6).fill(colors.card)
        if (own.status === 'ok') this.medal.circle(sx, sy, 3.5).fill(status)
        else if (own.status === 'warn')
          this.medal.poly([sx, sy - 4, sx + 4.2, sy + 3.2, sx - 4.2, sy + 3.2]).fill(status)
        else if (own.status === 'danger') this.medal.rect(sx - 3.3, sy - 3.3, 6.6, 6.6).fill(status)
        else
          this.medal
            .moveTo(sx - 3.5, sy - 3.5)
            .lineTo(sx + 3.5, sy + 3.5)
            .moveTo(sx + 3.5, sy - 3.5)
            .lineTo(sx - 3.5, sy + 3.5)
            .stroke({ color: status, width: 2.2, cap: 'round' })
      }
    }

    paint(this.mark, COMPONENT_ICONS[node.type], colors.card)
    const title =
      node.life._tag === 'Stopped'
        ? t(`${def.name} · failed`)
        : node.life._tag === 'Restarting'
          ? t(`${def.name} · restart`)
          : warmOf(node.life) < 1 && (def.sized || node.type === 'cache')
            ? t(`${def.name} · cold`)
            : t(def.name)
    this.title.style.fill = isDown(node.life) ? colors.danger : colors.ink
    const size = sizePips(node)
    const barsKey = JSON.stringify([size, badgeTone, rows.map((row) => row.trend ?? row.bar)])
    const bars = barsKey !== this.barsKey
    this.barsKey = barsKey
    if (bars) this.bars.clear()
    let right = CARD_W - 12
    if (size) {
      const width = pipsWidth(size.total)
      if (bars)
        pips(
          this.bars,
          right - width,
          HEAD / 2 - 4.5,
          size.filled,
          size.total,
          badgeTone,
          colors.well,
        )
      right -= width + 8
    }
    this.title.text = title
    this.title.scale.set(1)
    if (size && right - 4 - TITLE_X < this.title.width) {
      right = CARD_W - 12
      if (bars) this.bars.clear()
    }
    fitText(this.title, title, right - 4 - this.title.x)
    this.grip.clear()
    const grip = this.title.x + this.title.width + 8
    if (right - 4 - grip >= 14)
      for (let x = grip; x <= right - 6; x += 4) {
        this.grip
          .moveTo(x, HEAD / 2 - 5)
          .lineTo(x, HEAD / 2 + 5)
          .stroke({ color: colors.shade, width: 1, alpha: 0.16 })
        this.grip
          .moveTo(x + 1, HEAD / 2 - 5)
          .lineTo(x + 1, HEAD / 2 + 5)
          .stroke({ color: mix(colors.card, 0xffffff, 0.25), width: 1, alpha: 0.45 })
      }
    this.titleShadow.text = this.title.text
    this.titleShadow.scale.set(this.title.scale.x, this.title.scale.y)

    rows.forEach((row, index) => {
      const mark = this.glyphs[index]
      const name = this.names[index]
      const value = this.values[index]
      const valueMark = this.valueMarks[index]
      if (!mark || !name || !value || !valueMark) return
      if (row.logo) paintLogo(mark, row.logo, colors.ink)
      else if (row.pool) paint(mark, POOL_ICONS[row.pool], POOLS[row.pool].color)
      else paint(mark, ROW_ICONS[row.glyph], colors.muted)
      name.style.fill = row.logo ? colors.ink : colors.muted
      value.text = t(row.value)
      value.style.fill = toneOf(row.tone)
      fitText(name, t(row.name), value.x - value.width - (row.valueLogo ? 22 : 0) - 10 - name.x)
      valueMark.visible = row.valueLogo !== undefined
      if (row.valueLogo) {
        paintLogo(valueMark, row.valueLogo, colors.ink)
        valueMark.position.set(value.x - value.width - 18, rowMid(index) - 7.5)
      }
      if (!bars) return
      if (row.trend) {
        const bottom = rowTop(index) + ROW - 1
        const width = CARD_W - 28
        const points = row.trend
        const at = (i: number) => {
          const x = 14 + (width * i) / (points.length - 1)
          return [x, bottom - 6 * Math.min(1, points[i] ?? 0)] as const
        }
        const [x0, y0] = at(0)
        this.bars.moveTo(x0, y0)
        for (let i = 1; i < points.length; i += 1) this.bars.lineTo(...at(i))
        const peak = Math.max(...points)
        this.bars.stroke({
          color: peak > 0.95 ? colors.danger : peak > 0.8 ? colors.warn : colors.accent,
          width: 1.25,
        })
      } else if (row.bar !== undefined) {
        const y = rowTop(index) + ROW - 4
        const tone = row.bar > 0.95 ? colors.danger : row.bar > 0.8 ? colors.warn : colors.accent
        const share = Math.max(0, Math.min(1, row.bar))
        this.bars.roundRect(14, y, CARD_W - 28, 3, 1.5).fill(colors.well)
        if (share > 0)
          this.bars.roundRect(14, y, Math.max(3, (CARD_W - 28) * share), 3, 1.5).fill(tone)
      }
    })

    const stranded = own.stranded > 0.01
    if (stranded === this.stranded) return
    this.stranded = stranded
    this.ports.clear()
    if (layout.inRow !== null) {
      const y = rowMid(layout.inRow)
      this.ports.circle(0, y, PORT_R).fill(colors.card).stroke({ color: colors.edge, width: 1.5 })
      this.ports.circle(0, y, 2).fill(colors.edge)
    }
    if (layout.outRow !== null) {
      const y = rowMid(layout.outRow)
      this.ports.circle(CARD_W, y, PORT_R).fill(stranded ? hotDanger : colors.groups[this.group])
      this.ports.circle(CARD_W, y, 2).fill(colors.card)
    }
  }
}

const CHEER_S = 0.8
const ENTER_FROM_SCALE = 0.96
