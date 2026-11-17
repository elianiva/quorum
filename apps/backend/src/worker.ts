// First: a Room steps its Company, and every Step solves on the solver.
import '@quorum/simulation/host/worker'
import * as Sentry from '@sentry/cloudflare'
import { AGENT_ROOM_PATH, MCP_PATH, ROOMS_FULL_CLOSE, ROOM_SOCKET_PATH } from '@quorum/rpc'
import type { AgentRooms } from './contexts/agent/room.ts'
import { MAX_ROOMS } from './contexts/room/room.ts'
import type { RoomStub } from './contexts/room/directory.ts'
import { handlerFor } from './handler.ts'
import { agentHttp } from './platform/agent-http.ts'
import { AgentRoom } from './platform/agent-room.ts'
import { admit, roomDirectory } from './platform/room-directory.ts'
import { RoomObject } from './platform/room-object.ts'
import type { Env } from './handler.ts'

// The Durable Object class must be exported by the script that hosts it.
export { AgentRoom, RoomObject }
export type { Env }

// Built on the first request and kept for the isolate, once per database binding.
let built:
  | Readonly<{
      feedback: Env['FEEDBACK']
      rooms: Env['ROOMS']
      handler: ReturnType<typeof handlerFor>
    }>
  | undefined

/**
 * A refused upgrade shows the browser nothing but a failed socket, so the refusal is a socket that
 * opens and closes at once with `ROOMS_FULL_CLOSE`, which the browser reads.
 */
const roomsFull = (request: Request): Response => {
  if (request.headers.get('Upgrade') !== 'websocket')
    return new Response(`All ${MAX_ROOMS} online Rooms are in use. Try again later.`, {
      status: 503,
    })
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
  server.accept()
  server.close(ROOMS_FULL_CLOSE, 'Rooms full')
  return new Response(null, { status: 101, webSocket: client })
}

/** A Room's socket is forwarded to its object, which owns the connection. */
const roomSocket = async (request: Request, env: Env): Promise<Response> => {
  const code = new URL(request.url).searchParams.get('code')
  if (code === null || !/^[2-9A-HJ-NP-Z]{6}$/.test(code))
    return new Response('No such Room', { status: 404 })
  const stubOf = (name: string) => env.ROOMS.getByName(name) as unknown as RoomStub
  // An empty Room gave its slot up, so coming back needs one free.
  if (!(await admit(code, stubOf, env.FEEDBACK))) return roomsFull(request)
  return stubOf(code).fetch(request)
}

export default Sentry.withSentry(
  (env: Env) => ({
    dsn: env.SENTRY_DSN,
    release: env.SENTRY_RELEASE,
    // Sentry owns traces; Cloudflare Workers Observability keeps logs only (see `alchemy.run.ts`).
    // A request follows the browser's choice; one without a trace header is sampled on its own.
    tracesSampler: ({ parentSampled }) => parentSampled ?? 0.1,
    initialScope: { tags: { service: 'api-worker' } },
  }),
  {
    // The incoming request carries the browser's trace headers. Sentry continues that trace, and
    // the service binding passes the same headers on, so the API Worker joins it.
    fetch: (request: Request, env: Env): Promise<Response> => {
      const path = new URL(request.url).pathname
      if (path === ROOM_SOCKET_PATH) return roomSocket(request, env)
      if (path === MCP_PATH || path === AGENT_ROOM_PATH)
        return agentHttp(request, env.AGENT_ROOMS as unknown as AgentRooms)
      if (built?.feedback !== env.FEEDBACK || built.rooms !== env.ROOMS)
        built = {
          feedback: env.FEEDBACK,
          rooms: env.ROOMS,
          handler: handlerFor({
            feedback: env.FEEDBACK,
            directory: roomDirectory(
              (code) => env.ROOMS.getByName(code) as unknown as RoomStub,
              env.FEEDBACK,
            ),
          }),
        }
      return built.handler.handler(request)
    },
  },
)
