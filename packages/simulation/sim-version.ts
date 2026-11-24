import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'

// The generated catalog and solver.wasm are built, not committed, so the version hashes the trees
// they are built from as well as the Simulation's own source.
const SOURCES = [
  'packages/simulation/src',
  'packages/simulation/content',
  'packages/simulation/solver',
  'packages/qmc',
]

export const version = (): string =>
  process.env['SIM_VERSION'] ||
  createHash('sha256')
    .update(
      execFileSync('git', ['rev-parse', ...SOURCES.map((path) => `HEAD:${path}`)], {
        cwd: fileURLToPath(new URL('.', import.meta.url)),
        encoding: 'utf8',
      }),
    )
    .digest('hex')
    .slice(0, 8)

export const simVersion = () => {
  const value = version()
  return {
    name: 'sim-version',
    transform: (code: string, id: string): string | null =>
      id.endsWith('/simulation/src/version.ts') ? code.replace('__SIM_VERSION__', value) : null,
  }
}
