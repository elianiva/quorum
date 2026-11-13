import { defineConfig } from 'vitest/config'

// The solve runs in the Rust kernel; every test run installs it first.
export default defineConfig({ test: { setupFiles: ['@quorum/simulation/host/node'] } })
