/**
 * Differential fuzz test for the Outcome algebra: random outcomes, hops, and
 * call lists, computed by the TypeScript original and by the Rust port, then
 * compared with Object.is so one changed bit fails.
 */
import { readFileSync } from 'node:fs'

const ROOT = new URL('../../packages/simulation/src', import.meta.url).pathname
const D = await import(`${ROOT}/distribution.ts`)

const wasm = await WebAssembly.instantiate(
  readFileSync('./target/wasm32-unknown-unknown/release/qsim.wasm'),
)
const X = wasm.instance.exports
const memory = X.memory
const LEN = 19

const ptr = (values) => {
  const pointer = X.alloc(values.length * 8)
  new Float64Array(memory.buffer, pointer, values.length).set(values)
  return pointer
}
const read = (pointer, length = LEN) =>
  Float64Array.from(new Float64Array(memory.buffer, pointer, length))

const CAUSES = [
  'stranded',
  'dropped',
  'refused',
  'down',
  'stale',
  'oom',
  'timeout',
  'crash',
  'blocked',
  'upstream',
  'throttled',
  'duplicate',
]

/** Packs an Outcome into the ABI's 19 numbers. */
const pack = (o) => [
  o.success,
  o.fixedMs,
  o.variableMs,
  o.tailP,
  o.tailMs,
  o.stale,
  o.value,
  ...CAUSES.map((cause) => o[`fail${cause[0].toUpperCase()}${cause.slice(1)}`] ?? 0),
]

/** A seeded PRNG, so a failure can be replayed. */
let seed = 0x2f6e2b1
const random = () => {
  seed ^= seed << 13
  seed >>>= 0
  seed ^= seed >>> 17
  seed ^= seed << 5
  seed >>>= 0
  return seed / 0x1_00_00_00_00
}
const pick = (values) => values[Math.floor(random() * values.length)]
const share = () => random()

const randomOutcome = () => {
  const success = random() < 0.2 ? pick([0, 1]) : random()
  const fixedMs = pick([0, 0.3, 2, 2.5, 30, 100]) + (random() < 0.3 ? random() * 10 : 0)
  const variableMs = random() < 0.3 ? 0 : random() * 200
  const tailP = random() < 0.6 ? 0 : random() * 0.1
  const tailMs = tailP > 0 ? random() * 500 : 0
  const stale = random() < 0.7 ? 0 : random() * 0.3
  const value = pick([1, 1, 1, 1.2, 0.8])
  const rest = 1 - success
  const fails = CAUSES.map(() => 0)
  // Spread the failure share over a couple of causes so the ratios are exercised.
  if (rest > 0) {
    const first = Math.floor(random() * CAUSES.length)
    const second = Math.floor(random() * CAUSES.length)
    fails[first] += rest * share()
    fails[second] += rest * (1 - fails[first] / rest)
  }
  const o = { success, fixedMs, variableMs, tailP, tailMs, stale, value }
  CAUSES.forEach((cause, index) => {
    o[`fail${cause[0].toUpperCase()}${cause.slice(1)}`] = fails[index]
  })
  return o
}

const compare = (label, a, b, failures) => {
  const pairs = Array.isArray(a) ? a.map((value, index) => [value, b[index]]) : [[a, b]]
  for (const [left, right] of pairs)
    if (!Object.is(left, right)) {
      failures.push(`${label}: ts=${left} rust=${right}`)
      return
    }
}

const failures = []
const CASES = 3_000
for (let test = 0; test < CASES; test += 1) {
  const outcome = randomOutcome()
  const packed = ptr(pack(outcome))
  const out = X.alloc(LEN * 8)

  const ms = pick([1, 5, 15, 30, 100, 1000])
  X.timed_out_flat(packed, ms, out)
  compare(`timedOut ${ms}`, pack(D.timedOut(outcome, ms)), read(out), failures)

  X.retried_flat(packed, ms, out)
  compare('retried', pack(D.retried(outcome, ms)), read(out), failures)

  X.backed_off_flat(packed, ms, 0.1, out)
  compare('backedOff', pack(D.backedOff(outcome, ms, 0.1)), read(out), failures)

  X.hedged_flat(packed, out)
  compare('hedged', pack(D.hedged(outcome)), read(out), failures)

  const cause = Math.floor(random() * CAUSES.length)
  const someShare = random()
  X.fail_some_flat(packed, someShare, cause, out)
  compare(
    `failSome ${CAUSES[cause]}`,
    pack(D.failSome(outcome, someShare, CAUSES[cause])),
    read(out),
    failures,
  )

  const q = pick([0.5, 0.95, 0.99])
  compare(`percentile ${q}`, D.percentile(outcome, q), X.percentile_flat(packed, q), failures)
  compare('heldFor', D.heldFor(outcome, ms), X.held_for_flat(packed, ms), failures)
  compare('apdexOf', D.apdexOf(outcome, ms), X.apdex_of_flat(packed, ms), failures)
  compare('slowerThan', D.slowerThan(outcome, ms), X.slower_than_flat(packed, ms), failures)
  compare('meanOf', D.meanOf(outcome), X.mean_of_flat(packed), failures)
  compare('decay', D.decay(ms), X.decay_flat(ms), failures)
  const f = random()
  compare('taskAttempts', D.taskAttempts(f, 3), X.task_attempts_flat(f, 3), failures)
  compare('taskLost', D.taskLost(f, 3), X.task_lost_flat(f, 3), failures)
  compare('kthFastest', D.kthFastest(1, 2), X.kth_fastest_flat(1, 2), failures)

  // `through` with a random call list.
  const hop = D.hop({
    share: random() < 0.2 ? random() : 1,
    cause: pick(CAUSES),
    fixedMs: pick([0, 2, 2.5]),
    variableMs: pick([0, 1, 20]),
    tailP: random() < 0.7 ? 0 : random() * 0.05,
    tailMs: random() * 100,
    value: pick([1, 1.2]),
  })
  const callCount = 1 + Math.floor(random() * 4)
  const calls = Array.from({ length: callCount }, () => [randomOutcome(), pick([0, 1, 1, 2, 3])])
  const stale = random() < 0.3
  const callBlock = new Float64Array(callCount * (LEN + 1))
  calls.forEach(([call, count], index) => {
    callBlock.set(pack(call), index * (LEN + 1))
    callBlock[index * (LEN + 1) + LEN] = count
  })
  const hopPacked = ptr([
    hop.share,
    CAUSES.indexOf(hop.cause),
    hop.fixedMs,
    hop.variableMs,
    hop.tailP,
    hop.tailMs,
    hop.value,
  ])
  X.through_flat(hopPacked, ptr(callBlock), callCount, stale ? 1 : 0, out)
  compare('through', pack(D.through(hop, calls, stale)), read(out), failures)

  // `blend`.
  const entries = calls.map(([call]) => [call, random()])
  const blendBlock = new Float64Array(entries.length * (LEN + 1))
  entries.forEach(([entry, weight], index) => {
    blendBlock.set(pack(entry), index * (LEN + 1))
    blendBlock[index * (LEN + 1) + LEN] = weight
  })
  const got = X.blend_flat(ptr(blendBlock), entries.length, out)
  const want = D.blend(entries)
  if (want === undefined) {
    if (got !== 0) failures.push('blend: ts none, rust some')
  } else compare('blend', pack(want), read(out), failures)

  if (failures.length > 6) break
}

console.log(
  `distribution: ${failures.length === 0 ? `ALL IDENTICAL over ${CASES} random cases` : `${failures.length} DIFFER`}`,
)
for (const failure of failures.slice(0, 6)) console.log(`  ${failure}`)
