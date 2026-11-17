import { markdown } from '@foldkit/markdown/vite'
import { foldkit } from '@foldkit/vite-plugin'
import { defineConfig } from 'vitest/config'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { contentIndex } from './src/content-index.ts'
import { Frontmatter } from './src/frontmatter.ts'
import { islandAttributes } from './src/islands.ts'

export default defineConfig({
  plugins: [
    foldkit(),
    simVersion(),
    contentIndex(),
    markdown({ frontmatter: Frontmatter, islands: islandAttributes }),
  ],
  resolve: { dedupe: ['effect', 'foldkit'] },
  test: {
    testTimeout: 30_000,
    setupFiles: ['@quorum/simulation/host/node'],
  },
})
