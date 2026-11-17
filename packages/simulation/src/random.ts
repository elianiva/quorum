export const nextRandom = (seed: number): readonly [number, number] => {
  const next = (Math.imul(seed, 1_103_515_245) + 12_345) & 0x7f_ff_ff_ff
  return [next / 2_147_483_648, next]
}

export const pickWeighted = <A>(
  entries: ReadonlyArray<readonly [A, number]>,
  roll: number,
): A | undefined => {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (total <= 0) return undefined
  let left = roll * total
  for (const [entry, weight] of entries) {
    left -= Math.max(0, weight)
    if (left < 0) return entry
  }
  return entries.at(-1)?.[0]
}
