/// <reference types="vitest/config" />
import { foldkit } from '@foldkit/vite-plugin'
import { mkdirSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { asrQuery, ASR_PATH } from '../../packages/rpc/src/speech.ts'
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

/**
 * Speech to text, dev only. The page streams 16 kHz PCM to this route, and the
 * route forwards the socket to Deepgram's Nova-3 on Workers AI. The token and
 * the gateway name stay on the server. A local prototype: the API Worker gets
 * the same socket with an `AI` binding before this ships.
 */
const asrProxy = (): Record<string, import('vite').ProxyOptions> => {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const gateway = process.env.CLOUDFLARE_AI_GATEWAY ?? 'mochimemo'
  if (!token || !account) return {}
  return {
    [ASR_PATH]: {
      target: 'wss://gateway.ai.cloudflare.com',
      ws: true,
      changeOrigin: true,
      headers: { 'cf-aig-authorization': `Bearer ${token}` },
      rewrite: () => `/v1/${account}/${gateway}/workers-ai?${asrQuery()}`,
    },
  }
}

const authToken = process.env.SENTRY_AUTH_TOKEN
const release = process.env.VITE_SENTRY_RELEASE

export default defineConfig({
  server: { proxy: asrProxy() },
  build: {
    sourcemap: authToken ? 'hidden' : false,
  },
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
