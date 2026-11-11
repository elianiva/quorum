import { DurableObject } from 'cloudflare:workers'
import { released, reserved, type Lease } from '../contexts/room/leases.ts'

/* ==========================================================================
   The account's Room slots. One object, one list, so two Rooms published at
   the same moment cannot both take the last one.
   ========================================================================== */

const KEY = 'leases'

export type RoomSlotsEnv = Readonly<Record<string, never>>

export class RoomSlots extends DurableObject<RoomSlotsEnv> {
  /** Claims a slot for this Room, or answers false when the account holds every one. */
  async reserve(code: string): Promise<boolean> {
    const next = await this.ctx.storage.transaction(async (txn) => {
      const leases = (await txn.get<ReadonlyArray<Lease>>(KEY)) ?? []
      const claimed = reserved(leases, code, Date.now())
      if (claimed !== null) await txn.put(KEY, claimed)
      return claimed
    })
    return next !== null
  }

  /** Gives the slot back when the Room sleeps or its Company leaves. */
  async release(code: string): Promise<void> {
    await this.ctx.storage.transaction(async (txn) => {
      const leases = (await txn.get<ReadonlyArray<Lease>>(KEY)) ?? []
      await txn.put(KEY, released(leases, code))
    })
  }
}

/** The instance type the namespace stub carries. */
export type RoomSlotsInstance = RoomSlots
