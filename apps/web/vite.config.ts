import { foldkit } from '@foldkit/vite-plugin'
import { mkdirSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import pandacss from '@pandacss/vite'
import { fileURLToPath } from 'node:url'
import { type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import { simVersion } from '../../packages/simulation/sim-version.ts'
import { pwa } from './pwa/plugin.ts'

const skipBranding = /\/packages\/simulation\/|\/src\/i18n\/builder\.ts|\/src\/app\//

const unbrandedModules = (plugin: Plugin): Plugin => {
  if (plugin.name !== 'foldkit:view-identity' || typeof plugin.transform !== 'function')
    return plugin
  const transform = plugin.transform
  return {
    ...plugin,
    transform(code, id, options) {
      if (skipBranding.test(id)) return null
      return transform.call(this, code, id, options)
    },
  }
}

const layoutHarness = (): Plugin => ({
  name: 'layout-harness',
  configureServer(server) {
    server.middlewares.use('/harness/save', (request, response) => {
      if (request.method !== 'POST') {
        response.statusCode = 405
        response.end('POST only')
        return
      }
      let body = ''
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          const directory = new URL('../../.amp/in/artifacts/tidy/', import.meta.url)
          mkdirSync(directory, { recursive: true })
          writeFileSync(new URL('user-layout.json', directory), JSON.stringify(parsed, null, 2))
          response.statusCode = 200
          response.end('saved')
        } catch (error) {
          response.statusCode = 400
          response.end(`bad request: ${String(error)}`)
        }
      })
    })
  },
})

const authToken = process.env.SENTRY_AUTH_TOKEN
const release = process.env.VITE_SENTRY_RELEASE

export default defineConfig({
  build: {
    sourcemap: authToken ? 'hidden' : false,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor', test: /\/node_modules\/(?!\.pnpm\/pixi\.js@|pixi\.js\/)/ },
            {
              name: 'catalog',
              test: /\/packages\/(?:simulation\/src\/catalog\/|ui\/src\/i18n\/catalog\/en\.ts)/,
            },
            { name: 'copy', test: /\/apps\/web\/src\/(?:game\/copy|i18n\/en)\// },
          ],
        },
      },
    },
  },
  plugins: [
    layoutHarness(),
    pandacss({ codegen: false }),
    foldkit().map(unbrandedModules),
    simVersion(),
    pwa(),
    authToken
      ? sentryVitePlugin({
          authToken,
          ...(release ? { release: { name: release } } : {}),
          sourcemaps: {
            assets: ['./dist/ssr/**', './dist/client/**'],
            filesToDeleteAfterUpload: ['./dist/client/**/*.map'],
          },
        })
      : null,
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    dedupe: ['effect', 'foldkit'],
  },
  test: {
    setupFiles: ['@quorum/simulation/host/node'],
    maxWorkers: availableParallelism(),
  },
})
