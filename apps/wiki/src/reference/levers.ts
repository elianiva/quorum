import {
  LEVER_STEPS,
  leverBaseShare,
  leverDh,
  leverEra,
  leverGrowthTotal,
  type LeverKind,
} from '@quorum/simulation/catalog'
import type { Lang } from '../i18n/lang.ts'

export type LeverRow = Readonly<{ step: number; share: number; dh: number; growth: number }>

export const leverRows = (kind: LeverKind): ReadonlyArray<LeverRow> =>
  LEVER_STEPS.slice(1).map((multiplier, index) => ({
    step: index + 1,
    share: leverBaseShare(kind) * multiplier,
    dh: leverDh(index + 1),
    growth: 1 - leverGrowthTotal(index + 1),
  }))

export const leverOf = (
  l: Lang,
  kind: LeverKind,
): Readonly<{ name: string; era: string; base: number }> => ({
  name: l.cat.KINDS[kind].label,
  era: l.cat.ERAS[leverEra(kind)]?.name ?? '',
  base: leverBaseShare(kind),
})
