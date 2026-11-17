import { defineConfig } from 'vitest/config'

export default defineConfig({ test: { setupFiles: ['@quorum/simulation/host/node'] } })
