import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const version = (): string =>
  process.env['SIM_VERSION'] ||
  execFileSync('git', ['rev-parse', '--short=8', 'HEAD:packages/simulation/src'], {
    cwd: fileURLToPath(new URL('.', import.meta.url)),
    encoding: 'utf8',
  }).trim()

export const simVersion = () => {
  const value = version()
  return {
    name: 'sim-version',
    transform: (code: string, id: string): string | null =>
      id.endsWith('/simulation/src/version.ts') ? code.replace('__SIM_VERSION__', value) : null,
  }
}
