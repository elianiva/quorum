import type { Game } from '@quorum/simulation/state'

/* ==========================================================================
   A cache for a figure that costs a forecast or a solve to compute and that a
   view reads on every render. Every Step returns a new Game, so a cache keyed on
   the Game alone misses on every tick while the clock runs.
   ========================================================================== */

type Entry<T> = Readonly<{ game: Game; time: number; value: T }>

/**
 * Computes a figure once per sim second and per key. While the clock runs, the
 * figure is at most one sim second old. While it is stopped, a new Game at the
 * same time is a move the player made, so the figure is computed again.
 */
export const perSecond = <T>(): ((game: Game, key: string, compute: () => T) => T) => {
  const entries = new Map<string, Entry<T>>()
  return (game, key, compute) => {
    const last = entries.get(key)
    if (last !== undefined) {
      if (last.game === game) return last.value
      // Steps moved the clock forward and placed nothing: this is the same Company, a moment on.
      const stepped = game.time > last.time && game.nextId === last.game.nextId
      if (stepped && Math.floor(game.time) === Math.floor(last.time)) return last.value
    }
    const value = compute()
    entries.set(key, { game, time: game.time, value })
    return value
  }
}
