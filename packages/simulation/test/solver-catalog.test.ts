import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { solverCatalogHash } from '../src/solver.ts'

/*
 * The solver reads the catalog from `solver/src/catalog.rs`, which `gen-catalog.ts` writes from the
 * TypeScript catalog, and `src/solver.wasm` is built from that. A catalog change that skips either
 * step would solve with the old numbers, so this regenerates the file and checks both.
 */

const solver = resolve(import.meta.dirname, '../solver')
const FIX =
  'Run `pnpm --filter @quorum/simulation catalog`, then `solver/build.sh`, and commit both.'

test('the solver is built from the current catalog', () => {
  const fresh = join(mkdtempSync(join(tmpdir(), 'catalog-')), 'catalog.rs')
  execFileSync(process.execPath, [join(solver, 'gen-catalog.ts'), fresh], { stdio: 'ignore' })
  const generated = readFileSync(fresh, 'utf8')
  expect(readFileSync(join(solver, 'src/catalog.rs'), 'utf8') === generated, FIX).toBe(true)

  const stamp = Number(/CATALOG_HASH: u32 = (0x[0-9a-f]+);/.exec(generated)?.[1])
  expect(solverCatalogHash(), FIX).toBe(stamp)
})
