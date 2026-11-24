import { type ComponentId } from '@quorum/simulation/catalog'
import { type SlotKind } from '@quorum/simulation/parts'
import { type Ledger } from '@quorum/simulation/ledger'
import { type Game, type Region } from '@quorum/simulation/state'
import { type SeatActivity } from '@quorum/simulation/room'

export type BoardSound = 'pull' | 'lift' | 'detent' | 'snap' | 'release'

export type BoardEvents = Readonly<{
  onNodeTap: (nodeId: string) => void
  onSlot: (nodeId: string, slot: SlotKind) => void
  onNodeMove: (nodeId: string, x: number, y: number) => void
  onFooter: (nodeId: string) => void
  onLink: (from: string, to: string) => void
  onUnlink: (from: string, to: string) => void
  onPlace: (x: number, y: number) => void
  onEmptyTap: () => void
  onNodeToggle: (nodeId: string) => void
  onBox: (ids: ReadonlyArray<string>, mode: 'replace' | 'add' | 'subtract') => void
  onCursor?: (
    at: Readonly<{
      x: number
      y: number
      region: Region
      activity: SeatActivity | null
    }>,
  ) => void
  onCursorGone?: () => void
  onReady?: () => void
  onUnavailable?: (reason: 'webgl' | 'start') => void
  onStartFailed?: (error: unknown) => void
  onSound?: (sound: BoardSound, pitch?: number, spatial?: boolean) => void
}>

export type Stamp = ReadonlyArray<
  Readonly<{ type: ComponentId; dx: number; dy: number; ghost: boolean }>
>

export type BoardState = Readonly<{
  locale: string
  translate: (text: string) => string
  translateActivity?: (activity: SeatActivity) => string
  game: Game
  ledger: Ledger
  selected: string | null
  selection: ReadonlyArray<string>
  placing: ComponentId | null
  stamp: Stamp | null
  history: Readonly<Record<string, ReadonlyArray<number>>>
  ordinals: Readonly<Record<string, number>>
  region: Region
  paused: boolean
  speed: number
  suspended: boolean
  cue: string | null
  /** Why dropping a Link on a Node would be refused, or null when it is legal. */
  linkCheck?: (from: string, to: string) => string | null
  readOnly?: boolean
  animate?: boolean
  inset?: Readonly<{ top: number; bottom: number; left: number }>
  pad?: number
  minScale?: number
}>
