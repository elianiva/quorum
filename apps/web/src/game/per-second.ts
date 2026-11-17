import type { Game } from '@quorum/simulation/state'

type Entry<T> = Readonly<{ game: Game; time: number; value: T }>

export const perSecond = <T>(): ((game: Game, key: string, compute: () => T) => T) => {
  const entries = new Map<string, Entry<T>>()
  return (game, key, compute) => {
    const last = entries.get(key)
    if (last !== undefined) {
      if (last.game === game) return last.value
      const stepped = game.time > last.time && game.nextId === last.game.nextId
      if (stepped && Math.floor(game.time) === Math.floor(last.time)) return last.value
    }
    const value = compute()
    entries.set(key, { game, time: game.time, value })
    return value
  }
}
