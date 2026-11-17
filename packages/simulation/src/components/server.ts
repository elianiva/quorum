import { Effect, Schema } from 'effect'
import { def } from './define.ts'
import { REQUEST_KINDS } from '../catalog/kinds.ts'

export const serverGlossary: ReadonlyArray<string> = ['process-per-request']

export const PmMode = Schema.Literals(['static', 'dynamic', 'ondemand'])
export type PmMode = typeof PmMode.Type

export const Collector = Schema.Literals(['g1', 'parallel', 'zgc'])
export type Collector = typeof Collector.Type

export const Fanout = Schema.Literals(['pull', 'push'])
export type Fanout = typeof Fanout.Type

export const serverFields = {
  workers: Schema.Finite,
  localDb: Schema.Boolean,
  crashes: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  recycle: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  compress: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  pm: PmMode.pipe(Schema.withDecodingDefaultKey(Effect.succeed('static' as const))),
  collector: Collector.pipe(Schema.withDecodingDefaultKey(Effect.succeed('g1' as const))),
  gogc: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(100))),
  shed: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  degrade: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  ryw: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  fanout: Fanout.pipe(Schema.withDecodingDefaultKey(Effect.succeed('pull' as const))),
} as const

export const serverDef = def({
  id: 'server',
  code: 'app',
  name: 'App Server',
  product: 'VM',
  group: 'compute',
  blurb: 'Runs your code. Answers requests and sends queries to the database.',
  cost: 60,
  sized: true,
  latency: 2,
  accepts: REQUEST_KINDS,
  sends: [
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
  ],
  stack: true,
  limiting: true,
  coldStart: true,
})
