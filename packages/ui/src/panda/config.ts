import { defineConfig } from '@pandacss/dev'
import { quorumPreset } from './preset.ts'

/**
 * One config for the game, the wiki, and the shared UI package. Each app passes
 * its own source globs so it ships only the CSS it uses. The root config owns
 * codegen into `packages/styled-system`.
 */
export const quorumConfig = (include: ReadonlyArray<string>, outdir = 'styled-system') =>
  defineConfig({
    presets: ['@pandacss/preset-base', '@pandacss/preset-panda', quorumPreset],
    include: [...include],
    exclude: ['**/*.test.ts', '**/*.perf.ts'],
    importMap: '@quorum/styled-system',
    outdir,
    preflight: true,
    prefix: { className: 'q', cssVar: 'quorum' },
    layers: {
      reset: 'panda-reset',
      base: 'panda-base',
      tokens: 'panda-tokens',
      recipes: 'panda-recipes',
      utilities: 'panda-utilities',
    },
  })
