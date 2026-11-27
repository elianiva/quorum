import { Query } from '@effect/ui'
import { Effect, Schema } from 'effect'
import { REPOSITORY_API } from '../site.ts'

export const ProjectStats = Schema.Struct({
  stars: Schema.Finite,
  forks: Schema.Finite,
  issues: Schema.Finite,
  contributors: Schema.Finite,
  license: Schema.String,
  language: Schema.String,
})
export type ProjectStats = typeof ProjectStats.Type

const Repo = Schema.Struct({
  stargazers_count: Schema.Finite,
  forks_count: Schema.Finite,
  open_issues_count: Schema.Finite,
  language: Schema.NullOr(Schema.String),
  license: Schema.NullOr(Schema.Struct({ spdx_id: Schema.NullOr(Schema.String) })),
})

const HEADERS: HeadersInit = { Accept: 'application/vnd.github+json' }
const decodeRepo = Schema.decodeUnknownSync(Repo)

const get = async (url: string): Promise<Response> => {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(4000) })
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

const fetchStats = async (): Promise<ProjectStats | null> => {
  try {
    const [repo, people] = await Promise.all([
      get(REPOSITORY_API).then(async (response) => decodeRepo(await response.json())),
      contributors().catch(() => 0),
    ])
    return {
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      issues: repo.open_issues_count,
      contributors: people,
      license: repo.license?.spdx_id ?? 'GPL-3.0',
      language: repo.language ?? 'TypeScript',
    }
  } catch {
    return null
  }
}

export class GetProject extends Query.Service<GetProject>()('wiki/GetProject', {
  args: {},
  success: Schema.NullOr(ProjectStats),
  error: Schema.Never,
  staleTime: '1 hour',
}) {
  static readonly layer = this.toLayer(Effect.succeed(() => Effect.promise(fetchStats)))
}
