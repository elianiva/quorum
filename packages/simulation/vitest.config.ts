import { availableParallelism } from 'node:os'
import { configDefaults, defineConfig } from 'vitest/config'
import { simVersion } from './sim-version.ts'

const FULL_ONLY = ['breadth', 'pacing', 'challenges'].map((name) => `test/${name}.test.ts`)

export default defineConfig({
  plugins: [simVersion()],
  test: {
    setupFiles: ['./host/node.ts'],
    exclude: [
      ...configDefaults.exclude,
      'engines/**',
      ...(process.env.FULL_TESTS ? [] : FULL_ONLY),
    ],
    testTimeout: 20_000,
    maxWorkers: availableParallelism(),
  },
})
