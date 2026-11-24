import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { solverCatalogHash } from '../src/solver.ts'

const solver = resolve(import.meta.dirname, '../solver')

// qmc writes catalog.rs and its CI checks that the file is current. This check needs no Rust: the
// committed module must be the build of the committed catalog.
test('the solver is built from the current catalog', () => {
  const catalog = readFileSync(join(solver, 'src/catalog.rs'), 'utf8')
  const stamp = Number(/CATALOG_HASH: u32 = (0x[0-9a-f]+);/.exec(catalog)?.[1])
  expect(solverCatalogHash(), 'Run `solver/build.sh` and commit src/solver.wasm.').toBe(stamp)
})
