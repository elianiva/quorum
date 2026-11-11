import { describe, expect, test } from 'vitest'
import { LEASE_MS, LIVE_ROOMS, released, reserved, type Lease } from './leases.ts'

/* A lease is the account's only guard against a pile of Rooms it has to pay for. */

const at = 1_000

const filled = (): ReadonlyArray<Lease> =>
  Array.from({ length: LIVE_ROOMS }, (_, index) => ({ code: `R${index}`, at }))

describe('the Room slots', () => {
  test('a new code takes a slot', () => {
    expect(reserved([], 'ABC234', at)).toEqual([{ code: 'ABC234', at }])
  })

  test('the account refuses a Room once every slot is taken', () => {
    expect(reserved(filled(), 'NEW234', at)).toBeNull()
  })

  test('a code that holds a slot keeps it while the account is full', () => {
    expect(reserved(filled(), 'R0', at)).toEqual(filled())
  })

  test('a lease older than the Room lifetime frees its slot', () => {
    const stale = filled().map((lease) => ({ ...lease, at: at - LEASE_MS - 1 }))
    expect(reserved(stale, 'NEW234', at)).toEqual([{ code: 'NEW234', at }])
  })

  test('a released lease frees its slot', () => {
    expect(reserved(released(filled(), 'R0'), 'NEW234', at)).toEqual([
      ...filled().slice(1),
      { code: 'NEW234', at },
    ])
  })
})
