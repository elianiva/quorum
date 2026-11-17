import { def } from './define.ts'
import { REQUEST_KINDS } from '../catalog/kinds.ts'
import type { LanguageId } from '../catalog/runtimes.ts'

export const SERVERLESS_REQUEST_PRICE = 0.00024
export const SERVERLESS_GB_SECOND = 0.02
export const SERVERLESS_MEMORY_GB = 1
export const SERVERLESS_CONCURRENCY = 1_000
export const SERVERLESS_IDLE_SECONDS = 5
export const COLD_START_MS: Record<LanguageId, number> = {
  go: 50,
  rust: 50,
  zig: 50,
  haskell: 100,
  node: 200,
  python: 200,
  php: 200,
  ruby: 300,
  csharp: 500,
  elixir: 500,
  java: 2_000,
}
export const NATIVE_COLD_MS = 100
export const FUNCTION_LIMIT_MS = 900_000
export const EXPORT_MS_PER_GB = 4_000

export const SERVERLESS_MS = 1

export const fnDef = def({
  id: 'fn',
  code: 'fn',
  name: 'Serverless Function',
  product: 'AWS Lambda',
  group: 'compute',
  blurb:
    'Runs your code per request with no box to pay for: nothing while it idles, a cold start when it has, and 1,000 executions at once.',
  cost: 0,
  latency: SERVERLESS_MS,
  accepts: REQUEST_KINDS.filter((kind) => kind !== 'rt'),
  sends: [
    'q-read',
    'q-write',
    'auth',
    'q-search',
    'q-vector',
    'blob-put',
    'blob-get',
    'q-tx',
    'charge',
    'q-scan',
    'infer',
    'notify',
    'callout',
    'k-write',
  ],
  unlock: 'serverless',
  stack: true,
  limiting: true,
  coldStart: true,
})
