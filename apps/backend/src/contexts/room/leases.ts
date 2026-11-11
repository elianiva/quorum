import { ROOM_IDLE_MS } from './room.ts'

/* ==========================================================================
   How many Rooms the account keeps. A Room costs Durable Object duration for
   every second it is awake, so the count is the ceiling on the whole bill.
   ========================================================================== */

/**
 * The Rooms the account holds at once. Twelve four-Seat Rooms fill at 48
 * players, and twelve awake Rooms spend 130,000 GB-s a day: ten times the Free
 * plan's 13,000, and about $1.60 a day on the Paid plan at $12.50 per million.
 * Raise this when the game outgrows it, not before.
 */
export const LIVE_ROOMS = 12

/** A lease lasts as long as the Room it holds: the 24 hours an empty Room keeps its Company. */
export const LEASE_MS = ROOM_IDLE_MS

/** One Room's claim on a slot. `at` is when it took the slot, or last retook it. */
export type Lease = Readonly<{ code: string; at: number }>

const held = (leases: ReadonlyArray<Lease>, now: number): ReadonlyArray<Lease> =>
  leases.filter((lease) => now - lease.at <= LEASE_MS)

/**
 * The leases after one more Room claims a slot, or null when the account holds
 * every one it allows. A code that already holds a lease keeps it, so a Room
 * that is published twice spends one slot. Expired leases are dropped on the
 * way, which is how a slot comes back without anyone releasing it.
 */
export const reserved = (
  leases: ReadonlyArray<Lease>,
  code: string,
  now: number,
): ReadonlyArray<Lease> | null => {
  const live = held(leases, now)
  if (live.some((lease) => lease.code === code)) return live
  if (live.length >= LIVE_ROOMS) return null
  return [...live, { code, at: now }]
}

/** Gives a slot back when its Room sleeps or goes away. */
export const released = (leases: ReadonlyArray<Lease>, code: string): ReadonlyArray<Lease> =>
  leases.filter((lease) => lease.code !== code)
