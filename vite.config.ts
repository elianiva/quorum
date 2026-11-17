import { defineConfig } from 'vite-plus'

const ignored = [
  '.git/**',
  '.turbo/**',
  '.alchemy/**',
  '.wrangler/**',
  'node_modules/**',
  'dist/**',
  'coverage/**',
  'apps/web/art/kit/**',
  '.agents/skills/statechart/**',
  'packages/simulation/solver/target/**',
]

export default defineConfig({
  fmt: {
    ignorePatterns: [...ignored, '**/*.d.ts'],
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
  },
  lint: {
    ignorePatterns: ignored,
    options: { typeAware: true, typeCheck: false },
    plugins: ['typescript', 'unicorn', 'oxc'],
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'typescript/no-explicit-any': 'error',
    },
    overrides: [
      {
        files: ['apps/wiki/src/virtual-content.d.ts'],
        rules: { 'typescript/no-redundant-type-constituents': 'off' },
      },
      {
        files: ['apps/web/pwa/precache.test.ts'],
        rules: { 'typescript/no-implied-eval': 'off' },
      },
    ],
  },
})
