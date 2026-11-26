import { defineConfig, type Config } from '@pandacss/dev'
import { quorumPreset } from './preset.ts'

/* An app adds its own document-level styles (fonts, page base) through `app`;
   everything both apps share lives in the preset. */
type AppStyles = Pick<Config, 'globalCss' | 'globalFontface' | 'theme'>

export const quorumConfig = (
  include: ReadonlyArray<string>,
  outdir = 'styled-system',
  app: AppStyles = {},
) =>
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
    ...app,
  })
