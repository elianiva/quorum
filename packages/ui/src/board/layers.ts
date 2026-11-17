import {
  Container,
  Graphics,
  Particle,
  ParticleContainer,
  Rectangle,
  Text,
  Texture,
  type Renderer,
} from 'pixi.js'
import { type Box, type Pt, type Route } from './geometry.ts'
import { type PacketShape } from '../game/packets.ts'
import { CHEVRON_GAP_PX, CHEVRON_HALF, CHEVRON_DEPTH, packetAt } from './marks.ts'
import { arcOf } from './paths.ts'
import { MONO } from './text.ts'

export class ChevronLayer {
  readonly root = new ParticleContainer<Particle>({
    dynamicProperties: { position: true, rotation: true, color: true },
  })
  private texture: Texture | null = null
  private anchor = { x: 0, y: 0 }
  private used = 0
  private grown = false

  init(renderer: Renderer): void {
    const pad = 1.5
    const shape = new Graphics()
      .moveTo(pad, pad)
      .lineTo(pad + CHEVRON_DEPTH, pad + CHEVRON_HALF)
      .lineTo(pad, pad + 2 * CHEVRON_HALF)
      .stroke({ color: 0xffffff, width: 1 })
    const w = CHEVRON_DEPTH + 2 * pad
    const h = 2 * CHEVRON_HALF + 2 * pad
    this.texture = renderer.generateTexture({
      target: shape,
      resolution: 4,
      frame: new Rectangle(0, 0, w, h),
    })
    shape.destroy()
    this.anchor = { x: (pad + CHEVRON_DEPTH) / w, y: (pad + CHEVRON_HALF) / h }
  }

  begin(): void {
    this.used = 0
  }

  add(pieces: ReadonlyArray<Route>, offset: number, tint: number, alpha: number, view: Box): void {
    const texture = this.texture
    if (!texture) return
    const pool = this.root.particleChildren
    const color = particleColor(tint, alpha)
    const x1 = view.x + view.w
    const y1 = view.y + view.h
    const first = ((offset % CHEVRON_GAP_PX) + CHEVRON_GAP_PX) % CHEVRON_GAP_PX
    for (const piece of pieces) {
      const arc = arcOf(piece)
      let next = first
      for (let index = 1; index < piece.length; index += 1) {
        const start = arc.along[index - 1] as number
        const end = arc.along[index] as number
        if (end === start) continue
        const a = piece[index - 1] as Pt
        const b = piece[index] as Pt
        const hidden =
          Math.max(a.x, b.x) < view.x ||
          Math.min(a.x, b.x) > x1 ||
          Math.max(a.y, b.y) < view.y ||
          Math.min(a.y, b.y) > y1
        if (hidden) {
          if (next <= end) next += (Math.floor((end - next) / CHEVRON_GAP_PX) + 1) * CHEVRON_GAP_PX
          continue
        }
        const dx = arc.ux[index] as number
        const dy = arc.uy[index] as number
        const rotation = Math.atan2(dy, dx)
        while (next <= end) {
          const k = next - start
          const x = a.x + dx * k
          const y = a.y + dy * k
          next += CHEVRON_GAP_PX
          if (x < view.x || x > x1 || y < view.y || y > y1) continue
          let particle = pool[this.used]
          if (!particle) {
            particle = new Particle({ texture, anchorX: this.anchor.x, anchorY: this.anchor.y })
            pool.push(particle)
            this.grown = true
          }
          particle.x = x
          particle.y = y
          particle.rotation = rotation
          particle.color = color
          this.used += 1
        }
      }
    }
  }

  end(): void {
    const pool = this.root.particleChildren
    for (let index = this.used; index < pool.length; index += 1) (pool[index] as Particle).color = 0
    if (this.grown) {
      this.grown = false
      this.root.update()
    }
  }
}

const PACKET_R = 2.4
const PACKET_CELL = 10
const PACKET_SHAPES: ReadonlyArray<PacketShape> = ['circle', 'square', 'triangle', 'diamond']

export class PacketLayer {
  readonly root = new ParticleContainer<Particle>({
    dynamicProperties: { position: true, color: true, uvs: true },
  })
  private textures = new Map<PacketShape, Texture>()
  private used = 0
  private grown = false

  init(renderer: Renderer): void {
    const shapes = new Graphics()
    PACKET_SHAPES.forEach((shape, index) =>
      packetAt(shapes, shape, PACKET_CELL * (index + 0.5), PACKET_CELL / 2, PACKET_R),
    )
    shapes.fill(0xffffff)
    const sheet = renderer.generateTexture({
      target: shapes,
      resolution: 4,
      frame: new Rectangle(0, 0, PACKET_CELL * PACKET_SHAPES.length, PACKET_CELL),
    })
    shapes.destroy()
    PACKET_SHAPES.forEach((shape, index) =>
      this.textures.set(
        shape,
        new Texture({
          source: sheet.source,
          frame: new Rectangle(PACKET_CELL * index, 0, PACKET_CELL, PACKET_CELL),
        }),
      ),
    )
  }

  begin(): void {
    this.used = 0
  }

  add(shape: PacketShape, x: number, y: number, color: number): void {
    const texture = this.textures.get(shape)
    if (!texture) return
    const pool = this.root.particleChildren
    let particle = pool[this.used]
    if (!particle) {
      particle = new Particle({ texture, anchorX: 0.5, anchorY: 0.5 })
      pool.push(particle)
      this.grown = true
    }
    particle.texture = texture
    particle.x = x
    particle.y = y
    particle.color = color
    this.used += 1
  }

  end(): void {
    const pool = this.root.particleChildren
    for (let index = this.used; index < pool.length; index += 1) (pool[index] as Particle).color = 0
    if (this.grown) {
      this.grown = false
      this.root.update()
    }
  }
}

export const particleColor = (tint: number, alpha: number): number =>
  ((tint & 0xff) << 16) + (tint & 0xff00) + ((tint >> 16) & 0xff) + (((alpha * 255) | 0) << 24)

export class NoteLayer {
  readonly root = new Container()
  private readonly backs = new Graphics()
  private readonly pool: Array<Text> = []
  private used = 0

  constructor() {
    this.root.addChild(this.backs)
  }

  begin(): void {
    this.used = 0
    if (this.backs.context.instructions.length > 0) this.backs.clear()
  }

  add(x: number, y: number, text: string, tint: number, plate: number, lift: number): void {
    let view = this.pool[this.used]
    if (!view) {
      view = new Text({
        text: '',
        style: {
          fontFamily: MONO,
          fontSize: 10,
          fontWeight: '600',
          fill: 0xffffff,
        },
        resolution: 2,
      })
      view.anchor.set(0.5, 1)
      this.pool.push(view)
      this.root.addChild(view)
    }
    view.text = text
    view.tint = tint
    view.position.set(x, y - lift)
    view.visible = true
    this.backs
      .roundRect(
        x - view.width / 2 - 3.5,
        y - lift - view.height - 2,
        view.width + 7,
        view.height + 4,
        3,
      )
      .fill({ color: plate, alpha: 0.88 })
    this.used += 1
  }

  end(): void {
    for (let index = this.used; index < this.pool.length; index += 1)
      (this.pool[index] as Text).visible = false
  }
}
