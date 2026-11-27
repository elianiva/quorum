import { sentryRollupPlugin } from '@sentry/rollup-plugin'
import * as Alchemy from 'alchemy'
import * as Cloudflare from '@alchemy.run/cloudflare'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { API_PREFIX, POSTHOG_PROXY_PREFIX, MCP_PATH } from '@quorum/rpc'
import { MENU_PAGES } from './apps/web/src/game/menu-pages.ts'
import { wikiSources } from './packages/agent/wiki-sources.ts'
import { simVersion } from './packages/simulation/sim-version.ts'
import type { AgentRoomInstance } from './apps/backend/src/platform/agent-room.ts'
import type { RoomInstance } from './apps/backend/src/platform/room-object.ts'

const compatibility = { date: '2026-10-08' }
const sentryCompatibility = { ...compatibility, flags: ['nodejs_compat'] }

const posthogKey = process.env.VITE_POSTHOG_KEY ?? ''

const sentryDsn = process.env.VITE_SENTRY_DSN ?? ''
const sentryRelease = process.env.VITE_SENTRY_RELEASE ?? ''
const sentryEnv = {
  ...(sentryDsn && { SENTRY_DSN: sentryDsn }),
  ...(sentryRelease && { SENTRY_RELEASE: sentryRelease }),
}

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const apiBuild = {
  build: {
    input: {
      plugins: [
        simVersion(),
        wikiSources(),
        ...(sentryAuthToken
          ? [
              sentryRollupPlugin({
                authToken: sentryAuthToken,
                ...(sentryRelease ? { release: { name: sentryRelease } } : {}),
              }),
            ]
          : []),
      ],
    },
  },
}

const PRODUCTION_DOMAIN = {
  name: 'playquorum.dev',
  redirects: ['quorum.elianiva.com', 'www.playquorum.dev'],
}

const WIKI_DOMAIN = 'wiki.playquorum.dev'

const observability = {
  enabled: true,
  headSamplingRate: 0.1,
  logs: { enabled: true, invocationLogs: true, headSamplingRate: 0.1, persist: true },
  traces: { enabled: false },
}

const rateLimits = {
  RATE_LIMIT_API: Cloudflare.RateLimit('RateLimitApi', {
    namespaceId: 7301,
    simple: { limit: 60, period: 60 },
  }),
  RATE_LIMIT_INGEST: Cloudflare.RateLimit('RateLimitIngest', {
    namespaceId: 7302,
    simple: { limit: 120, period: 60 },
  }),
}

const state = Layer.unwrap(
  Effect.gen(function* () {
    const dev = yield* Alchemy.ALCHEMY_DEV.pipe(Effect.orDie)
    return dev ? Alchemy.localState() : Cloudflare.state()
  }),
)

export default Alchemy.Stack(
  'quorum',
  { providers: Cloudflare.providers(), state },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stack.use((stack) => Effect.succeed(stack.stage))
    if (stage === 'prod' && posthogKey === '')
      return yield* Effect.die(
        new Error(
          'VITE_POSTHOG_KEY is required for the prod stage. Set it in the deploy environment.',
        ),
      )
    if (stage === 'prod' && sentryDsn === '')
      return yield* Effect.die(
        new Error(
          'VITE_SENTRY_DSN is required for the prod stage. Set it in the deploy environment.',
        ),
      )
    const Results = Cloudflare.D1.Database('Results', { migrations: './apps/backend/migrations' })
    const ApiWorker = Cloudflare.Worker('Api', {
      main: './apps/backend/src/worker.ts',
      env: {
        FEEDBACK: Results,
        ROOMS: Cloudflare.DurableObject<RoomInstance>('RoomObject'),
        AGENT_ROOMS: Cloudflare.DurableObject<AgentRoomInstance>('AgentRoom'),
        ...sentryEnv,
      },
      ...apiBuild,
      compatibility: sentryCompatibility,
      observability,
      workersDev: false,
    })
    const Website = Cloudflare.Website.Foldkit('Website', {
      rootDir: 'apps/web',
      main: 'src/worker.ts',
      env: { API: ApiWorker, ...sentryEnv, ...rateLimits },
      assets: {
        runWorkerFirst: [
          MCP_PATH,
          `${MCP_PATH}/*`,
          `${API_PREFIX}/*`,
          `${POSTHOG_PROXY_PREFIX}/*`,
          '/assets/*',
          '/',
          '/company',
          '/company/',
          ...MENU_PAGES.map((page) => `/${page}`),
          '/sandbox/*',
          '/challenges/*',
          '/room/*',
        ],
        notFoundHandling: '404-page',
      },
      ...(stage === 'prod' && { domain: PRODUCTION_DOMAIN }),
      compatibility: sentryCompatibility,
      observability,
    })

    const Wiki = Cloudflare.Website.StaticSite('Wiki', {
      command: 'pnpm --filter @quorum/wiki build',
      outdir: 'apps/wiki/dist/client',
      assets: {
        htmlHandling: 'drop-trailing-slash',
        notFoundHandling: 'single-page-application',
      },
      ...(stage === 'prod' && { domain: WIKI_DOMAIN }),
      compatibility,
      observability,
    })

    yield* Results
    yield* ApiWorker
    const website = yield* Website
    const wiki = yield* Wiki
    return { url: website.url, wiki: wiki.url }
  }),
)
