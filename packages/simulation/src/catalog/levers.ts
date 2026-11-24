import { ERAS } from './eras.ts'
export {
  LEVER_KINDS,
  LEVER_STEPS,
  LEVER_DH,
  LEVER_GROWTH,
  LEVER_REFUND,
  MAX_LEVER_STEP,
  LEVER_OWNER,
  LEVER_CAPS,
} from '../generated/levers.ts'
import {
  LEVER_KINDS,
  LEVER_STEPS,
  LEVER_DH,
  LEVER_GROWTH,
  MAX_LEVER_STEP,
} from '../generated/levers.ts'

export type LeverKind = (typeof LEVER_KINDS)[number]

export const leverEra = (kind: LeverKind): number => {
  const index = ERAS.findIndex((era) => (era.mix[kind] ?? 0) > 0)
  return index < 0 ? ERAS.length - 1 : index
}

export const leverBaseShare = (kind: LeverKind): number => ERAS[leverEra(kind)]?.mix[kind] ?? 0

export const leverStepEra = (kind: LeverKind, step: number): number =>
  leverEra(kind) + Math.max(0, step - 1)

export const isLeverKind = (kind: string): kind is LeverKind =>
  (LEVER_KINDS as ReadonlyArray<string>).includes(kind)

export const leverMultiplier = (step: number): number =>
  LEVER_STEPS[Math.max(0, Math.min(MAX_LEVER_STEP, Math.floor(step)))] ?? 1

export const leverDh = (step: number): number => LEVER_DH[Math.max(1, step) - 1] ?? 0

export const leverGrowth = (step: number): number =>
  step <= 0 ? 1 : (LEVER_GROWTH[Math.min(MAX_LEVER_STEP, step) - 1] ?? 1)

export const leverGrowthTotal = (step: number): number => {
  let factor = 1
  for (let each = 1; each <= Math.min(MAX_LEVER_STEP, step); each += 1)
    factor *= LEVER_GROWTH[each - 1] ?? 1
  return factor
}
