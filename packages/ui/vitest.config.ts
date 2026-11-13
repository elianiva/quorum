import { defineConfig } from 'vitest/config'

// The solve runs in the Rust solver; every test run installs it first.
export default defineConfig({ test: { setupFiles: ['@quorum/simulation/host/node'] } })
