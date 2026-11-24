import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { solverCatalogHash } from '../src/solver.ts'

const solver = resolve(import.meta.dirname, '../solver')

// `pnpm --filter @quorum/simulation content` writes catalog.rs, then builds solver.wasm from it. A
// module left over from an older catalog would solve with the wrong tables.
test('the solver is built from the current catalog', () => {
  const catalog = readFileSync(join(solver, 'src/catalog.rs'), 'utf8')
  const stamp = Number(/CATALOG_HASH: u32 = (0x[0-9a-f]+);/.exec(catalog)?.[1])
  expect(solverCatalogHash(), 'Run `pnpm --filter @quorum/simulation content`.').toBe(stamp)
})
