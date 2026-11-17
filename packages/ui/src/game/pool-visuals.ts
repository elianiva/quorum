import {
  Bell,
  BookOpen,
  Bot,
  ChartColumn,
  Clapperboard,
  FileText,
  Flame,
  Gavel,
  type IconNode,
  KeyRound,
  Package,
  PenLine,
  Radio,
  Rss,
  Search,
  ShoppingCart,
  Sparkles,
  Upload,
  Webhook,
} from 'lucide'
import {
  INSIGHT_POOLS,
  POOLS,
  RECIPE,
  VENDOR_DISCOUNT,
  type InsightPool,
  type ResearchId,
} from '@quorum/simulation/catalog'

export const POOL_ICONS: Record<InsightPool, IconNode> = {
  page: FileText,
  read: BookOpen,
  write: PenLine,
  login: KeyRound,
  search: Search,
  upload: Upload,
  bot: Bot,
  media: Clapperboard,
  rt: Radio,
  buy: ShoppingCart,
  job: Package,
  report: ChartColumn,
  ai: Sparkles,
  feed: Rss,
  hook: Webhook,
  push: Bell,
  bid: Gavel,
  failure: Flame,
}

export const poolColor = (pool: InsightPool): string =>
  `#${POOLS[pool].color.toString(16).padStart(6, '0')}`

export const poolName = (pool: InsightPool): string => `${POOLS[pool].label} Insight`

export const POOL_ORDER: ReadonlyArray<InsightPool> = INSIGHT_POOLS

export const recipeOf = (
  id: ResearchId,
  discounts: ReadonlyArray<ResearchId> = [],
): ReadonlyArray<readonly [InsightPool, number]> =>
  POOL_ORDER.flatMap((pool) => {
    const cost = RECIPE[id][pool]
    return cost
      ? [[pool, discounts.includes(id) ? cost * (1 - VENDOR_DISCOUNT) : cost] as const]
      : []
  })
