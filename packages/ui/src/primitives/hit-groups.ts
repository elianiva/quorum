export const MAX_HIT_TARGETS = 240

export type HitGroup = Readonly<{
  from: number
  to: number
  index: number
}>

export const hitGroups = (count: number, most = MAX_HIT_TARGETS): ReadonlyArray<HitGroup> => {
  const stride = Math.max(1, Math.ceil(count / most))
  const groups: Array<HitGroup> = []
  for (let from = 0; from < count; from += stride) {
    const to = Math.min(count - 1, from + stride - 1)
    groups.push({ from, to, index: from + Math.floor((to - from) / 2) })
  }
  return groups
}
