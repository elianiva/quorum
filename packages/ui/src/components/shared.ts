import {
  Activity,
  Archive,
  ArrowRightFromLine,
  ArrowRightToLine,
  Banknote,
  Cable,
  Check,
  ChevronsUp,
  Coins,
  Copy,
  Tag,
  Plus,
  Gauge,
  Gem,
  HardDrive,
  Hourglass,
  HandCoins,
  Inbox,
  Layers,
  ListOrdered,
  LogIn,
  RotateCcw,
  ScanLine,
  ShieldBan,
  Shuffle,
  Smile,
  Target,
  Timer,
  Unplug,
  Users,
  Wallet,
  type IconNode,
} from 'lucide'
import type { InsightPool } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import type { Game, GameNode } from '@quorum/simulation/state'
import type { StackLogoId } from '../game/icons.ts'

export type RowTone = 'plain' | 'warn' | 'danger' | 'ok' | 'muted'
export const ROW_ICONS = {
  inbound: ArrowRightToLine,
  load: Gauge,
  latency: Timer,
  out: ArrowRightFromLine,
  stranded: Unplug,
  users: Users,
  apdex: Smile,
  requests: Activity,
  revenue: Banknote,
  drawer: Wallet,
  stripe: Check,
  sampling: ScanLine,
  kept: Archive,
  insight: Gem,
  stack: Layers,
  connections: Cable,
  hits: Target,
  lag: Hourglass,
  policy: Shuffle,
  logins: LogIn,
  cost: Coins,
  depth: ListOrdered,
  stored: HardDrive,
  blocked: ShieldBan,
  copies: Copy,
  version: Tag,
  limit: Gauge,
} as const

export const FOOT_ICONS = {
  collect: HandCoins,
  auto: Check,
  empty: Inbox,
  replace: RotateCcw,
  max: ChevronsUp,
  resize: ChevronsUp,
  more: Plus,
} as const

export type Row = Readonly<{
  glyph: keyof typeof ROW_ICONS
  name: string
  value: string
  tone?: RowTone
  bar?: number
  pool?: InsightPool
  logo?: StackLogoId
  valueLogo?: StackLogoId
  trend?: ReadonlyArray<number>
}>
export type Footer = Readonly<{
  glyph: keyof typeof FOOT_ICONS
  text: string
  enabled: boolean
  tone: 'accent' | 'ok' | 'muted' | 'danger'
}>

export const pct = (value: number): string => `${Math.round(value * 100)}%`

export const outRate = (ledger: Ledger, id: string): number =>
  ledger.links.reduce((sum, link) => (link.from === id ? sum + link.rate : sum), 0)

export const membersOf = (game: Game, node: GameNode): ReadonlyArray<GameNode> =>
  game.nodes.filter((entry) =>
    game.links.some((link) => link.from === entry.id && link.to === node.id),
  )

export type Layout = Readonly<{
  rows: number
  inRow: number | null
  outRow: number | null
  footer: boolean
}>

export type RowContext = Readonly<{
  game: Game
  node: GameNode
  ledger: Ledger
  own: Ledger['nodes'][string]
  inbound: Row
  capacity: Row
  latency: Row
  out: Row
}>

export type ComponentView = Readonly<{
  icon: IconNode
  layout: Layout
  rows: (context: RowContext) => ReadonlyArray<Row>
  footer?: (game: Game, node: GameNode) => Footer | null
  resize?: (price: string) => Pick<Footer, 'glyph' | 'text'>
  spreads?: true
}>
