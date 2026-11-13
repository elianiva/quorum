import { defineConfig } from 'vitest/config'
import { wikiSources } from '../../packages/agent/wiki-sources.ts'
import { simVersion } from '../../packages/simulation/sim-version.ts'

export default defineConfig({
  plugins: [simVersion(), wikiSources()],
  // The solve runs in the Rust solver; every test run installs it first.
  test: { setupFiles: ['@quorum/simulation/host/node'] },
})
