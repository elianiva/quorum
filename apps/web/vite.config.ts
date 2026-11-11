/// <reference types="vitest/config" />
import { foldkit } from '@foldkit/vite-plugin'
import { mkdirSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { simVersion } from '../../packages/simulation/sim-version.ts'

/**
 * Foldkit's view-identity transform wraps every function return in a module. The Simulation has
 * thousands of functions and never builds a view, so branding them only taxes every tick. The
 * localizing builder builds views for its caller, so branding it would give each element the
 * builder's identity and a locale switch would remount the board.
 */
const skipBranding = /\/packages\/simulation\/|\/src\/i18n\/builder\.ts/

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

/**
 * Source maps go to Sentry only from a build that has the upload token, and never into the
 * deployed assets: hidden maps carry no link in the bundle, and the plugin deletes them after.
 */
/**
 * The layout harness at `/harness.html` saves the player's arrangement into the
 * workspace, so an agent can read it back. Dev only: `configureServer` never runs
 * in a build.
 */
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

/**
 * Clef decisions, dev only. The game sends the options it built, and this route
 * forwards them to Workers AI with the account token, which never reaches the
 * browser. A local prototype: the API Worker gets the same route and an `AI`
 * binding before this ships.
 */
const intent = (): Plugin => ({
  name: 'intent',
  configureServer(server) {
    const token = process.env.CLOUDFLARE_API_TOKEN
    const account = process.env.CLOUDFLARE_ACCOUNT_ID
    server.middlewares.use('/api/intent', (request, response) => {
      if (request.method !== 'POST') {
        response.statusCode = 405
        response.end('POST only')
        return
      }
      if (!token || !account) {
        response.statusCode = 503
        response.end('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to dictate.')
        return
      }
      let body = ''
      request.on('data', (chunk: string) => {
        body += chunk
        if (body.length > 1_000_000) request.destroy()
      })
      request.on('end', () => {
        void (async () => {
          try {
            const answer = await fetch(
              `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/cloudflare/clef-flash`,
              {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'clef-flash', ...JSON.parse(body) }),
                signal: AbortSignal.timeout(8_000),
              },
            )
            const payload: unknown = await answer.json()
            const result =
              typeof payload === 'object' && payload !== null && 'result' in payload
                ? payload.result
                : undefined
            const answers =
              typeof result === 'object' && result !== null && 'answers' in result
                ? result.answers
                : undefined
            if (!answer.ok || answers === undefined) {
              response.statusCode = 502
              response.end(JSON.stringify(payload))
              return
            }
            response.setHeader('Content-Type', 'application/json')
            response.end(JSON.stringify(answers))
          } catch (error) {
            response.statusCode = 502
            response.end(error instanceof Error ? error.message : 'no answer')
          }
        })()
      })
    })
  },
})

// The Foldkit dev server: Model preservation across reloads, and the devtools relay.
const foldkitPlugins = foldkit().map(unbrandedModules)

const authToken = process.env.SENTRY_AUTH_TOKEN
const release = process.env.VITE_SENTRY_RELEASE

export default defineConfig({
  // Moonshine's wasm is a threaded build: SharedArrayBuffer, and so the recognizer, needs a
  // cross-origin-isolated page. Credentialless keeps the fonts and the fonts' stylesheet loading.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  },
  build: {
    sourcemap: authToken ? 'hidden' : false,
    rollupOptions: {
      output: {
        // Moonshine's worker asks for `moonshine.wasm` by that name, next to itself. Keep the name
        // it asks for instead of a hashed one, or the module loads without its engine.
        assetFileNames: (asset) =>
          asset.names.some((name) => name.endsWith('.wasm'))
            ? 'assets/moonshine.wasm'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  // The Moonshine wasm spawns Emscripten pthread workers, and its module uses top-level await:
  // an ES worker keeps both, where Vite's default IIFE worker format rejects the await.
  worker: { format: 'es' },
  // Its `.mjs` and `.wasm` must stay as they ship: pre-bundling rewrites the paths they resolve.
  optimizeDeps: { exclude: ['@moonshine-ai/moonshine-wasm'] },
  plugins: [
    layoutHarness(),
    intent(),
    tailwindcss(),
    ...foldkitPlugins,
    simVersion(),
    // Last, so it sees the final bundle.
    authToken
      ? sentryVitePlugin({
          authToken,
          // The plugin reads SENTRY_ORG and SENTRY_PROJECT from the environment itself.
          ...(release ? { release: { name: release } } : {}),
          sourcemaps: {
            // Alchemy builds the Worker (`dist/ssr`) first and the assets (`dist/client`) second,
            // and ships only `index.js` of the first and everything in the second. So every
            // build uploads both directories, and only the public assets lose their maps.
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
    // Every file imports the whole app, and the tests are CPU-bound while the main process idles,
    // so use every core rather than Vitest's default of one fewer.
    maxWorkers: availableParallelism(),
  },
})
