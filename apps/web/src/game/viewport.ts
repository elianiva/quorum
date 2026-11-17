export const isPhone = (): boolean =>
  typeof globalThis.matchMedia === 'function' &&
  globalThis.matchMedia('(max-width: 639px), (max-height: 499px)').matches

export type Direction = 'up' | 'down' | 'left' | 'right'

type Point = Readonly<{ id: string; x: number; y: number }>

export const nearestNode = (
  nodes: ReadonlyArray<Point>,
  from: string | null,
  direction: Direction,
): string | null => {
  const start = nodes.find((node) => node.id === from)
  if (!start) return [...nodes].sort((a, b) => a.y + a.x - (b.y + b.x))[0]?.id ?? null
  let best: Readonly<{ id: string; score: number }> | null = null
  for (const node of nodes) {
    if (node.id === start.id) continue
    const dx = node.x - start.x
    const dy = node.y - start.y
    const [ahead, side] =
      direction === 'left'
        ? [-dx, dy]
        : direction === 'right'
          ? [dx, dy]
          : direction === 'up'
            ? [-dy, dx]
            : [dy, dx]
    if (ahead <= 0) continue
    const score = ahead + 2 * Math.abs(side)
    if (!best || score < best.score) best = { id: node.id, score }
  }
  return best?.id ?? null
}
