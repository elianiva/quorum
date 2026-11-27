import * as Sentry from '@sentry/cloudflare'
import { API_PREFIX, POSTHOG_PROXY_PREFIX, MCP_PATH } from '@quorum/rpc'
import { isAppPath } from './shell-routes.ts'

interface ApiBinding {
  fetch(request: Request): Promise<Response>
}

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

interface Environment {
  readonly API: ApiBinding
  readonly ASSETS: ApiBinding
  readonly RATE_LIMIT_API?: RateLimitBinding
  readonly RATE_LIMIT_INGEST?: RateLimitBinding
  readonly SENTRY_DSN?: string
  readonly SENTRY_RELEASE?: string
}

const POSTHOG_API = 'us.i.posthog.com'
const POSTHOG_ASSETS = 'us-assets.i.posthog.com'

const isIngest = (pathname: string): boolean =>
  pathname === POSTHOG_PROXY_PREFIX || pathname.startsWith(`${POSTHOG_PROXY_PREFIX}/`)

const isApi = (pathname: string): boolean =>
  pathname === API_PREFIX ||
  pathname.startsWith(`${API_PREFIX}/`) ||
  pathname === MCP_PATH ||
  pathname.startsWith(`${MCP_PATH}/`)

const isHashedAsset = (pathname: string): boolean => pathname.startsWith('/assets/')

/* A deploy replaces hashed files. A stale page that asks for a removed one gets the 404 page, and
   the immutable header from _headers would pin that page in the edge and browser for a year. */
const hashedAsset = async (request: Request, env: Environment): Promise<Response> => {
  const response = await env.ASSETS.fetch(request)
  if (response.ok || response.status === 304) return response
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'no-store')
  return new Response(response.body, { status: response.status, headers })
}

const allowedOrFailOpen = async (
  binding: RateLimitBinding | undefined,
  key: string,
): Promise<boolean> => {
  if (binding === undefined) return true
  try {
    return (await binding.limit({ key })).success
  } catch {
    return true
  }
}

const tooMany = (): Response =>
  new Response('Too many requests. Try again in a minute.', {
    status: 429,
    headers: { 'Retry-After': '60', 'Content-Type': 'text/plain; charset=utf-8' },
  })

const ingest = async (request: Request, url: URL): Promise<Response> => {
  const path = url.pathname.slice(POSTHOG_PROXY_PREFIX.length) || '/'
  const asset = path.startsWith('/static/') || path.startsWith('/array/')
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  if (!/^Bearer ph[csx]_/.test(headers.get('authorization') ?? '')) headers.delete('authorization')
  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) headers.set('X-Forwarded-For', ip)
  return fetch(`https://${asset ? POSTHOG_ASSETS : POSTHOG_API}${path}${url.search}`, {
    method: request.method,
    headers,
    body:
      request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
    redirect: request.redirect,
  })
}

export default Sentry.withSentry(
  (env: Environment) => ({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    tracesSampler: ({ parentSampled }) => (parentSampled ? 1 : 0),
    initialScope: { tags: { service: 'website-worker' } },
  }),
  {
    async fetch(request: Request, env: Environment): Promise<Response> {
      const url = new URL(request.url)
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
      if (isIngest(url.pathname)) {
        if (!(await allowedOrFailOpen(env.RATE_LIMIT_INGEST, ip))) return tooMany()
        return ingest(request, url)
      }
      if (isHashedAsset(url.pathname)) return hashedAsset(request, env)
      if (isAppPath(url.pathname)) return env.ASSETS.fetch(new Request(new URL('/', url), request))
      if (isApi(url.pathname) && !(await allowedOrFailOpen(env.RATE_LIMIT_API, ip)))
        return tooMany()
      return env.API.fetch(request)
    },
  },
)
