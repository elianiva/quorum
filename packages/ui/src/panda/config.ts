import { defineConfig } from '@pandacss/dev'
import { quorumPreset } from './preset.ts'

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
