import { Schema } from 'effect'
import { Game, Region, Sample } from '@quorum/simulation/state'
import { NodeSample } from './node-metrics.ts'

export const AgentMode = Schema.Literals(['company', 'sandbox', 'challenge'])
export type AgentMode = typeof AgentMode.Type

export const AgentMailPhase = Schema.Union([
  Schema.TaggedStruct('Active', {}),
  Schema.TaggedStruct('Answered', { answer: Schema.String }),
  Schema.TaggedStruct('Resolved', {}),
])
export type AgentMailPhase = typeof AgentMailPhase.Type

export const AgentMail = Schema.Struct({
  id: Schema.Finite,
  sender: Schema.String,
  subject: Schema.String,
  time: Schema.Finite,
  read: Schema.Boolean,
  trashed: Schema.Boolean,
  spam: Schema.Boolean,
  phase: AgentMailPhase,
  actions: Schema.Array(Schema.String),
  entries: Schema.Array(Schema.Unknown),
})
export type AgentMail = typeof AgentMail.Type

export const AgentScreen = Schema.Struct({
  route: Schema.String,
  panel: Schema.String,
  region: Region,
  selectedNode: Schema.NullOr(Schema.String),
})
export type AgentScreen = typeof AgentScreen.Type

export const AgentWhatIf = Schema.Struct({
  nodeId: Schema.String,
  at: Schema.Finite,
  rows: Schema.Array(
    Schema.Struct({
      change: Schema.String,
      target: Schema.String,
      before: Schema.Finite,
      after: Schema.Finite,
    }),
  ),
})
export type AgentWhatIf = typeof AgentWhatIf.Type

export const AgentHead = Schema.Struct({
  game: Schema.NullOr(Game),
  mode: AgentMode,
  screen: AgentScreen,
  paused: Schema.Boolean,
  speed: Schema.Finite,
  bottleneck: Schema.NullOr(Schema.String),
  whatIfs: Schema.NullOr(AgentWhatIf),
  inboxHash: Schema.String,
})
export type AgentHead = typeof AgentHead.Type

export const Upload = Schema.Struct({
  v: Schema.Literal(1),
  epoch: Schema.String,
  rev: Schema.Finite,
  reset: Schema.Boolean,
  head: AgentHead,
  samples: Schema.Struct({
    from: Schema.Finite,
    to: Schema.Finite,
    items: Schema.Array(Sample),
  }),
  nodes: Schema.Struct({
    from: Schema.Finite,
    items: Schema.Record(Schema.String, Schema.Array(NodeSample)),
  }),
  inbox: Schema.NullOr(Schema.Array(AgentMail)),
})
export type Upload = typeof Upload.Type

export const Ack = Schema.Struct({
  epoch: Schema.String,
  rev: Schema.Finite,
  sampleSeq: Schema.Finite,
  nodeTime: Schema.Finite,
  inboxHash: Schema.String,
  at: Schema.Finite,
})
export type Ack = typeof Ack.Type

export const Status = Schema.Struct({
  mode: AgentMode,
  updatedAt: Schema.Finite,
  sampleSeq: Schema.Finite,
  nodeTime: Schema.Finite,
  samples: Schema.Finite,
  nodes: Schema.Finite,
  inbox: Schema.Finite,
  epoch: Schema.String,
  rev: Schema.Finite,
})
export type Status = typeof Status.Type

export type AgentSnapshot = Readonly<{
  game: Game | null
  mode: AgentMode
  screen: AgentScreen
  paused: boolean
  speed: number
  bottleneck: string | null
  whatIfs: AgentWhatIf | null
  samples: ReadonlyArray<Sample>
  nodeSamples: Readonly<Record<string, ReadonlyArray<NodeSample>>>
  inbox: ReadonlyArray<AgentMail>
  updatedAt: number
}>
