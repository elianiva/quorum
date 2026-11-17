import { def } from './define.ts'
import { REQUEST_KINDS } from '../catalog/kinds.ts'
import type { LanguageId } from '../catalog/runtimes.ts'

export const EDGE_REQUEST_PRICE = 0.00036
export const EDGE_CPU_MS = 10
export const EDGE_MEMORY_MB = 128
export const EDGE_LANGUAGES: ReadonlyArray<LanguageId> = ['node', 'rust', 'go']
export const EDGE_READ_HIT = 0.3

export const EDGE_MS = 5

export const edgeDef = def({
  id: 'edge',
  code: 'edge',
  name: 'Edge Function',
  product: 'Cloudflare Workers',
  group: 'compute',
  blurb:
    'Runs small handlers next to the user: 5 ms, no cold start, and a CPU ceiling instead of a box.',
  cost: 0,
  latency: EDGE_MS,
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
  unlock: 'edge-compute',
  stack: true,
})
