import { markdown } from '@effect/ui/html/MarkdownVite'
import { defineConfig } from 'vitest/config'
import pandacss from '@pandacss/vite'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { contentIndex } from './src/content-index.ts'
import { Frontmatter } from './src/frontmatter.ts'
import { islandAttributes } from './src/islands.ts'

export default defineConfig({
  plugins: [
    pandacss({ codegen: false }),
    simVersion(),
    contentIndex(),
    markdown({ frontmatter: Frontmatter, islands: islandAttributes }),
  ],
  resolve: { dedupe: ['effect'] },
  test: {
    testTimeout: 30_000,
    setupFiles: ['@quorum/simulation/host/node'],
  },
})
