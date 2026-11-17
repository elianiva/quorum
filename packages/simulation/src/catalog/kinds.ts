export const REQUEST_KINDS = [
  'page',
  'read',
  'write',
  'login',
  'search',
  'upload',
  'bot',
  'media',
  'rt',
  'buy',
  'job',
  'report',
  'ai',
  'feed',
  'hook',
  'push',
  'bid',
] as const
export type RequestKind = (typeof REQUEST_KINDS)[number]

export const BACKEND_KINDS = [
  'q-read',
  'q-write',
  'auth',
  'q-search',
  'q-vector',
  'blob-put',
  'task',
  'blob-get',
  'q-tx',
  'charge',
  'q-scan',
  'infer',
  'notify',
  'callout',
  'k-write',
  'change',
] as const
export type BackendKind = (typeof BACKEND_KINDS)[number]

export const DATA_KINDS = [
  'q-read',
  'q-write',
  'q-search',
  'q-vector',
  'blob-put',
  'q-tx',
  'blob-get',
  'q-scan',
  'k-write',
] as const

export type Kind = RequestKind | BackendKind

export const isBackendKind = (kind: Kind): kind is BackendKind =>
  (BACKEND_KINDS as ReadonlyArray<Kind>).includes(kind)

export type KindInfo = Readonly<{
  label: string
  value: number
  color: number
}>

export const KINDS: Record<Kind, KindInfo> = {
  page: { label: 'Page view', value: 0.1, color: 0x77a4f6 },
  read: { label: 'API read', value: 0.2, color: 0x4f7fe0 },
  write: { label: 'API write', value: 0.5, color: 0x7152b5 },
  login: { label: 'Login', value: 0.25, color: 0xd0438b },
  search: { label: 'Search', value: 0.6, color: 0x2f9e8f },
  upload: { label: 'Upload', value: 0.75, color: 0xd9822b },
  bot: { label: 'Bot', value: 0, color: 0x8a8f98 },
  media: { label: 'Video', value: 1, color: 0xe0564f },
  rt: { label: 'Realtime', value: 0.025, color: 0x3fb6c9 },
  buy: { label: 'Checkout', value: 25, color: 0x2e9d57 },
  job: { label: 'Export', value: 1.6, color: 0x9a7b4f },
  report: { label: 'Report', value: 2, color: 0x5b6abf },
  ai: { label: 'AI prompt', value: 24, color: 0xb04fc7 },
  'q-read': { label: 'Read query', value: 0, color: 0x4f7fe0 },
  'q-write': { label: 'Write query', value: 0, color: 0x7152b5 },
  auth: { label: 'Auth call', value: 0, color: 0xd0438b },
  'q-search': { label: 'Search query', value: 0, color: 0x2f9e8f },
  'q-vector': { label: 'Vector lookup', value: 0, color: 0x7a6fae },
  'blob-put': { label: 'Object put', value: 0, color: 0xd9822b },
  task: { label: 'Task', value: 0, color: 0xb8a03a },
  'blob-get': { label: 'Object get', value: 0, color: 0xe0564f },
  'q-tx': { label: 'Transaction', value: 0, color: 0x2e9d57 },
  charge: { label: 'Charge', value: 0, color: 0x2e9d57 },
  'q-scan': { label: 'Scan', value: 0, color: 0x5b6abf },
  infer: { label: 'Inference', value: 0, color: 0xb04fc7 },
  feed: { label: 'Feed', value: 0.3, color: 0xc9a227 },
  hook: { label: 'Webhook', value: 0.4, color: 0x6d8f3a },
  push: { label: 'Notify', value: 0.05, color: 0xd96b9a },
  bid: { label: 'Bid request', value: 0.001, color: 0x8e7cc3 },
  notify: { label: 'Push message', value: 0, color: 0xd96b9a },
  callout: { label: 'Customer call', value: 0, color: 0x6d8f3a },
  'k-write': { label: 'Timeline write', value: 0, color: 0xc9a227 },
  change: { label: 'Change', value: 0, color: 0x8a6f4d },
}

export const INSIGHT_POOLS = [...REQUEST_KINDS, 'failure'] as const
export type InsightPool = (typeof INSIGHT_POOLS)[number]

export const POOLS: Record<InsightPool, Readonly<{ label: string; color: number }>> = {
  ...(Object.fromEntries(
    REQUEST_KINDS.map((kind) => [kind, { label: KINDS[kind].label, color: KINDS[kind].color }]),
  ) as Record<RequestKind, Readonly<{ label: string; color: number }>>),
  failure: { label: 'Failure', color: 0xf04438 },
}

export type RequestProfile = Readonly<{
  cpu: number
  native: boolean
  apdex: number
  calls: Readonly<Partial<Record<Exclude<BackendKind, 'auth' | 'task'>, number>>>
  asyncCalls: Readonly<
    Partial<Record<'q-read' | 'q-write' | 'blob-put' | 'notify' | 'callout', number>>
  >
  orm: boolean
  payloadKB: number
  asyncKB: number
  stream: boolean
  compressible: boolean
  inKB: number
  offload: number
  completion?: number
  scored: boolean
}>

export const PROFILES: Record<RequestKind, RequestProfile> = {
  page: {
    cpu: 4,
    native: false,
    apdex: 400,
    calls: { 'q-read': 2, 'q-write': 0 },
    asyncCalls: {},
    orm: true,
    payloadKB: 80,
    asyncKB: 80,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  read: {
    cpu: 1.5,
    native: false,
    apdex: 200,
    calls: { 'q-read': 1, 'q-write': 0 },
    asyncCalls: {},
    orm: true,
    payloadKB: 4,
    asyncKB: 4,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  write: {
    cpu: 2,
    native: false,
    apdex: 300,
    calls: { 'q-read': 0, 'q-write': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 2,
    asyncKB: 2,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  login: {
    cpu: 80,
    native: true,
    apdex: 800,
    calls: { 'q-read': 1, 'q-write': 0 },
    asyncCalls: {},
    orm: false,
    payloadKB: 1,
    asyncKB: 1,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  search: {
    cpu: 3,
    native: false,
    apdex: 300,
    calls: { 'q-search': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 8,
    asyncKB: 8,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  upload: {
    cpu: 120,
    native: true,
    apdex: 1_500,
    calls: {},
    asyncCalls: { 'blob-put': 1, 'q-write': 1 },
    orm: false,
    payloadKB: 2,
    asyncKB: 2,
    stream: false,
    compressible: false,
    inKB: 2_000,
    offload: 0.9,
    completion: 10_000,
    scored: true,
  },
  bot: {
    cpu: 2,
    native: false,
    apdex: 400,
    calls: { 'q-read': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 4,
    asyncKB: 4,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: false,
  },
  media: {
    cpu: 1,
    native: false,
    apdex: 1_000,
    calls: { 'blob-get': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 5_000,
    asyncKB: 5_000,
    stream: true,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  rt: {
    cpu: 0.3,
    native: false,
    apdex: 100,
    calls: {},
    asyncCalls: {},
    orm: false,
    payloadKB: 1,
    asyncKB: 1,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  buy: {
    cpu: 5,
    native: false,
    apdex: 2_000,
    calls: { 'q-read': 1, 'q-tx': 1, charge: 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 2,
    asyncKB: 2,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  job: {
    cpu: 400,
    native: false,
    apdex: 1_000,
    calls: {},
    asyncCalls: { 'q-read': 50 },
    orm: false,
    payloadKB: 10_000,
    asyncKB: 2,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0.95,
    completion: 60_000,
    scored: true,
  },
  report: {
    cpu: 20,
    native: false,
    apdex: 3_000,
    calls: { 'q-scan': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 50,
    asyncKB: 50,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  ai: {
    cpu: 5,
    native: false,
    apdex: 4_000,
    calls: { infer: 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 4,
    asyncKB: 4,
    stream: true,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  feed: {
    cpu: 6,
    native: false,
    apdex: 300,
    calls: { 'q-read': 20 },
    asyncCalls: {},
    orm: false,
    payloadKB: 30,
    asyncKB: 30,
    stream: false,
    compressible: true,
    inKB: 0,
    offload: 0,
    scored: true,
  },
  hook: {
    cpu: 2,
    native: false,
    apdex: 1_000,
    calls: {},
    asyncCalls: { callout: 1 },
    orm: false,
    payloadKB: 2,
    asyncKB: 2,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0.9,
    scored: true,
  },
  push: {
    cpu: 0.5,
    native: false,
    apdex: 1_000,
    calls: {},
    asyncCalls: { notify: 1 },
    orm: false,
    payloadKB: 1,
    asyncKB: 1,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0.9,
    scored: true,
  },
  bid: {
    cpu: 0.5,
    native: false,
    apdex: 100,
    calls: { 'q-read': 1 },
    asyncCalls: {},
    orm: false,
    payloadKB: 1,
    asyncKB: 1,
    stream: false,
    compressible: false,
    inKB: 0,
    offload: 0,
    scored: true,
  },
}

export const QUERY_CPU: Readonly<{
  'q-read': number
  'q-write': number
  'q-search': number
  'blob-put': number
  'q-tx': number
  'blob-get': number
  'q-scan': number
}> = {
  'q-read': 8,
  'q-write': 25,
  'q-search': 80,
  'blob-put': 60,
  'q-tx': 40,
  'blob-get': 30,
  'q-scan': 100,
}

export const STREAM_KB = 500
export const RT_HOLD_SECONDS = 300

export const USER_MBPS = 20
export const USER_UP_MBPS = 20
export const GZIP_RATIO = 0.3
export const GZIP_CPU = 1.1

export const LOGIN_DELEGATED_CPU = 2

export const CALLOUT_MS = 800
export const CALLOUT_FAILURE = 0.02
export const FOLLOWERS = 20
export const HYBRID_WRITES = 0.5
export const HYBRID_READS = 2
