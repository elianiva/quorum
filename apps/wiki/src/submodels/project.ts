import { Effect, Schema } from 'effect'
import { Command, type Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { REPOSITORY_API } from '../site.ts'

export const Stats = Schema.Struct({
  stars: Schema.Finite,
  forks: Schema.Finite,
  issues: Schema.Finite,
  contributors: Schema.Finite,
  license: Schema.String,
  language: Schema.String,
})
export type Stats = typeof Stats.Type

export const Model = Schema.Struct({
  status: Schema.Literals(['idle', 'loading', 'ready', 'failed'] as const),
  stats: Schema.NullOr(Stats),
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  Loaded: { stats: Stats },
  Failed: {},
})
export type Message = typeof Message.Type

export const init: Model = { status: 'idle', stats: null }

const RepoFields = Schema.Struct({
  stargazers_count: Schema.Finite,
  forks_count: Schema.Finite,
  open_issues_count: Schema.Finite,
  language: Schema.NullOr(Schema.String),
  license: Schema.NullOr(Schema.Struct({ spdx_id: Schema.NullOr(Schema.String) })),
})

const HEADERS: HeadersInit = { Accept: 'application/vnd.github+json' }

const decodeRepo = Schema.decodeUnknownSync(RepoFields)

const get = async (url: string): Promise<Response> => {
  const response = await fetch(url, { headers: HEADERS })
  if (!response.ok) throw new Error(`GitHub: HTTP ${response.status}`)
  return response
}

const contributors = async (): Promise<number> => {
  const response = await get(`${REPOSITORY_API}/contributors?per_page=1`)
  const last = response.headers.get('link')?.match(/[?&]page=(\d+)>; rel="last"/)
  if (last?.[1] !== undefined) return Number(last[1])
  const page: unknown = await response.json()
  return Array.isArray(page) ? page.length : 0
}

export const Load = Command.define('LoadProject', {
  messages: [Message.Loaded, Message.Failed],
  execute: Effect.promise(async () => {
    try {
      const [repo, people] = await Promise.all([
        get(REPOSITORY_API).then(async (response) => decodeRepo(await response.json())),
        contributors().catch(() => 0),
      ])
      return Message.Loaded({
        stats: {
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          issues: repo.open_issues_count,
          contributors: people,
          license: repo.license?.spdx_id ?? 'GPL-3.0',
          language: repo.language ?? 'TypeScript',
        },
      })
    } catch {
      return Message.Failed()
    }
  }),
})

export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match<Update.Return<Model, Message>>(message, {
    Loaded: ({ stats }) => ({ model: { status: 'ready', stats } }),
    Failed: () => ({ model: { status: 'failed', stats: null } }),
  })
