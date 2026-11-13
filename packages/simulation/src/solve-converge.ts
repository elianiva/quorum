/**
 * Whether a pass repeated the one before it, judged on the figures the Ledger
 * reads. A relative epsilon of 1e-9 is tight enough that a repeat cannot move
 * any figure the Ledger prints.
 */
import type { Pass } from './rules.ts'
import type { Kind } from './catalog.ts'

const EPSILON = 1e-9

const near = (a: number | undefined, b: number | undefined): boolean => {
  if (a === b) return true
  if (a === undefined || b === undefined) return false
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false
  const scale = Math.max(Math.abs(a), Math.abs(b))
  return scale === 0 || Math.abs(a - b) <= EPSILON * scale
}

const nearRates = (
  a: Readonly<Record<string, number>> | undefined,
  b: Readonly<Record<string, number>> | undefined,
): boolean => {
  if (a === b) return true
  const left = a ?? {}
  const right = b ?? {}
  const leftKeys = Object.keys(left)
  if (leftKeys.length !== Object.keys(right).length) return false
  for (const key of leftKeys) if (!near(left[key], right[key])) return false
  return true
}

const nearService = (
  a: Readonly<Record<string, Readonly<{ fixedMs: number; variableMs: number }>>> | undefined,
  b: Readonly<Record<string, Readonly<{ fixedMs: number; variableMs: number }>>> | undefined,
): boolean => {
  if (a === b) return true
  const left = a ?? {}
  const right = b ?? {}
  const leftKeys = Object.keys(left)
  if (leftKeys.length !== Object.keys(right).length) return false
  for (const key of leftKeys) {
    const first = left[key]
    const second = right[key]
    if (!first || !second) return false
    if (!near(first.fixedMs, second.fixedMs) || !near(first.variableMs, second.variableMs))
      return false
  }
  return true
}

const nearGauge = (
  a: Readonly<{ used: number; total: number }> | null | undefined,
  b: Readonly<{ used: number; total: number }> | null | undefined,
): boolean => {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return a === b
  return near(a.used, b.used) && near(a.total, b.total)
}

export const passRepeats = (previous: Pass, current: Pass): boolean => {
  if (previous.models.length !== current.models.length) return false
  if (!near(previous.lagMs, current.lagMs) || !near(previous.staleShare, current.staleShare))
    return false

  for (let slot = 0; slot < current.models.length; slot += 1) {
    // Arrivals: what the Node was sent this pass.
    if (!nearRates(previous.arriving[slot], current.arriving[slot])) return false

    const before = previous.models[slot]
    const after = current.models[slot]
    if (before === after) continue
    if (before === undefined || after === undefined) return false
    if (
      !near(before.capacity, after.capacity) ||
      !near(before.utilization, after.utilization) ||
      !near(before.share, after.share) ||
      !near(before.tailP, after.tailP) ||
      !near(before.tailMs, after.tailMs)
    )
      return false
    if (before.limit !== after.limit || before.workUnit !== after.workUnit) return false
    if (before.throttled !== after.throttled || before.swapping !== after.swapping) return false
    if ((before.disk ?? false) !== (after.disk ?? false)) return false
    if (!nearService(before.service, after.service)) return false
    if (!nearRates(before.shares, after.shares)) return false
    if (
      !nearGauge(before.resources.cpuCores, after.resources.cpuCores) ||
      !nearGauge(before.resources.ramGb, after.resources.ramGb) ||
      !nearGauge(before.resources.slots, after.resources.slots) ||
      !nearGauge(before.resources.networkKbps, after.resources.networkKbps)
    )
      return false
    if (!nearRates(previous.tasks[slot], current.tasks[slot])) return false
    if (!near(previous.hits[slot], current.hits[slot])) return false
    if (!near(previous.staleHits[slot], current.staleHits[slot])) return false
    if (!near(previous.repeated[slot], current.repeated[slot])) return false
    if (!near(previous.drained[slot], current.drained[slot])) return false

    const wasStranded = previous.stranded[slot]
    const isStranded = current.stranded[slot]
    if (!near(wasStranded?.rate, isStranded?.rate)) return false
    if ((wasStranded?.kinds.size ?? 0) !== (isStranded?.kinds.size ?? 0)) return false

    const wasPool = previous.connections[slot]
    const isPool = current.connections[slot]
    if (!near(wasPool?.used, isPool?.used) || !near(wasPool?.max, isPool?.max)) return false
  }

  // Every Link's carried rate.
  for (let edge = 0; edge < current.links.length; edge += 1)
    if (!nearRates(previous.links[edge], current.links[edge])) return false

  return true
}

/** The kinds a stranded Node reports, kept out of the hot path above. */
export type StrandedKinds = ReadonlySet<Kind>
