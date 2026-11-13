import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, test } from 'vitest'
import { kernelCatalogHash } from '../src/kernel.ts'

/*
 * The kernel reads the catalog from `kernel/src/catalog.rs`, which `gen-catalog.ts` writes from the
 * TypeScript catalog, and `src/kernel.wasm` is built from that. A catalog change that skips either
 * step would solve with the old numbers, so this regenerates the file and checks both.
 */

const kernel = resolve(import.meta.dirname, '../kernel')
const FIX =
  'Run `pnpm --filter @quorum/simulation catalog`, then rebuild the kernel (kernel/README.md).'

test('the kernel is built from the current catalog', () => {
  const fresh = join(mkdtempSync(join(tmpdir(), 'catalog-')), 'catalog.rs')
  execFileSync(process.execPath, [join(kernel, 'gen-catalog.ts'), fresh], { stdio: 'ignore' })
  const generated = readFileSync(fresh, 'utf8')
  expect(readFileSync(join(kernel, 'src/catalog.rs'), 'utf8') === generated, FIX).toBe(true)

  const stamp = Number(/CATALOG_HASH: u32 = (0x[0-9a-f]+);/.exec(generated)?.[1])
  expect(kernelCatalogHash(), FIX).toBe(stamp)
})
