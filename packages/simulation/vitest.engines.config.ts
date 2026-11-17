import { playwright } from '@vitest/browser-playwright'
import './host/node.ts'
import { defineConfig } from 'vitest/config'
import { report } from './engines/report.ts'
import { simVersion } from './sim-version.ts'

export default defineConfig({
  plugins: [simVersion()],
  test: {
    include: ['engines/**/*.browser.test.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      commands: { node: () => report() },
      instances: [{ browser: 'chromium' }, { browser: 'firefox' }, { browser: 'webkit' }],
    },
  },
})
