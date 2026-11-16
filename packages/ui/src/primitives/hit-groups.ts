/**
 * The most hover targets a chart draws. A chart is a few hundred pixels wide, so
 * past this count a target is narrower than a pointer can pick, and each one is
 * an element the view builds and compares on every render.
 */
export const MAX_HIT_TARGETS = 240

export type HitGroup = Readonly<{
  /** The first and last category the target covers. */
  from: number
  to: number
  /** The category the target reports: the middle of its span. */
  index: number
}>

/** Splits `count` categories into at most `most` runs of equal length, in order. */
export const hitGroups = (count: number, most = MAX_HIT_TARGETS): ReadonlyArray<HitGroup> => {
  const stride = Math.max(1, Math.ceil(count / most))
  const groups: Array<HitGroup> = []
  for (let from = 0; from < count; from += stride) {
    const to = Math.min(count - 1, from + stride - 1)
    groups.push({ from, to, index: from + Math.floor((to - from) / 2) })
  }
  return groups
}
