import { Schema } from 'effect'

export const STEADY_TICKS = 12
export const SETTLE_LIMIT_SECONDS = 30
export const STABLE_TICKS = 8

export const Figures = Schema.Struct({
  revenue: Schema.Finite,
  latency: Schema.Finite,
  p99: Schema.Finite,
  errors: Schema.Finite,
})
export type Figures = typeof Figures.Type

export const Change = Schema.Struct({
  label: Schema.String,
  count: Schema.Finite,
  startedAt: Schema.Finite,
  before: Figures,
  recent: Schema.Array(
    Schema.Struct({ revenue: Schema.Finite, served: Schema.Finite, errors: Schema.Finite }),
  ),
  steady: Schema.Finite,
})
export type Change = typeof Change.Type

export const PreviewFigures = Schema.Struct({
  before: Figures,
  after: Figures,
  burn: Schema.Array(Schema.Finite),
  restart: Schema.Finite,
  cash: Schema.Finite,
})
export type PreviewFigures = typeof PreviewFigures.Type

export const Delta = Schema.Struct({
  id: Schema.Finite,
  label: Schema.String,
  before: Figures,
  after: Figures,
  worse: Schema.Boolean,
  shownAt: Schema.Finite,
})
export type Delta = typeof Delta.Type

export const Reveal = Schema.Literals([
  'undo',
  'collect',
  'resize',
  'research',
  'errors',
  'team',
  'engineering',
  'autopilot',
  'glossary',
])
export type Reveal = typeof Reveal.Type
