import type { Messages } from '../i18n/messages.ts'
import type { Locale } from '../i18n/locale.ts'
import { navOf, pageIn } from './pages.ts'
import type { Page } from './page.ts'

export type PathId = keyof Messages['paths']

export type Path = Readonly<{
  id: PathId
  steps: ReadonlyArray<string>
}>

export const PATHS: ReadonlyArray<Path> = [
  { id: 'play', steps: navOf('en', 'play').map((page) => page.path) },
  {
    id: 'scaling-steps',
    steps: navOf('en', 'patterns')
      .filter((page) => page.group === 'Scaling steps')
      .map((page) => page.path),
  },
  {
    id: 'first-steps',
    steps: [
      '/tutorials/first-company',
      '/tutorials/first-bottleneck',
      '/explanation/requests',
      '/tutorials/first-incident',
      '/tutorials/research-and-insight',
      '/guides/find-the-bottleneck',
    ],
  },
  {
    id: 'read-the-numbers',
    steps: [
      '/explanation/latency',
      '/explanation/queues',
      '/guides/read-p99',
      '/explanation/apdex-and-revenue',
      '/explanation/observability',
    ],
  },
  {
    id: 'scale-up',
    steps: [
      '/explanation/the-data-tier',
      '/guides/scale-the-database',
      '/guides/fix-slow-queries',
      '/guides/survive-a-traffic-spike',
      '/explanation/errors-and-retries',
      '/guides/stop-a-retry-storm',
      '/guides/go-global',
    ],
  },
  {
    id: 'run-the-company',
    steps: [
      '/explanation/money',
      '/guides/cut-the-cloud-bill',
      '/explanation/team-and-velocity',
      '/explanation/progression',
      '/tutorials/first-exit',
      '/explanation/legacy',
      '/guides/prepare-for-an-exit',
    ],
  },
]

export const stepsOf = <Msg>(locale: Locale, path: Path): ReadonlyArray<Page<Msg>> =>
  path.steps.flatMap((step) => {
    const page = pageIn<Msg>(locale, step)
    return page ? [page] : []
  })

export const placeOf = <Msg>(
  locale: Locale,
  pagePath: string,
): Readonly<{ path: Path; index: number }> | null => {
  for (const path of PATHS) {
    const index = stepsOf<Msg>(locale, path).findIndex((page) => page.path === pagePath)
    if (index !== -1) return { path, index }
  }
  return null
}

export const resumeOf = <Msg>(
  locale: Locale,
  path: Path,
  visited: ReadonlyArray<string>,
): Page<Msg> | null => {
  const steps = stepsOf<Msg>(locale, path)
  return steps.find((page) => !visited.includes(page.path)) ?? null
}
