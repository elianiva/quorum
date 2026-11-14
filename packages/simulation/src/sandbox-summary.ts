import type { ComponentId, IncidentId } from './catalog.ts'

/* What a guided Sandbox shows and names: its title, its Era, and the goal of each objective. The
   simulation adds the board it starts from and the condition each objective holds (sandbox.ts).
   The wiki and the catalog copy read this file, so they never load the engine. */

export const SANDBOX_IDS = [
  'out-of-credits',
  'shared-box',
  'second-server',
  'connection-limit',
  'event-loop-stall',
  'read-mostly',
  'stampede',
  'slow-uploads',
  'bots',
  'zone-outage',
  'cold-start',
  'stale-checkout',
  'gc-pauses',
  'retry-storm',
  'analytics-primary',
  'far-away',
  'missed-write',
  'hot-key',
] as const
export type SandboxId = (typeof SANDBOX_IDS)[number]

export type GuidedObjectiveSummary = Readonly<{
  goal: string
  /** Users while this objective runs. Unset keeps the demand of the one before. */
  users?: number
  /** The incident this objective fires, and the only Component kind it may hit. */
  incident?: Readonly<{ kind: IncidentId; only?: ComponentId }>
}>

export type GuidedSummary = Readonly<{
  id: SandboxId
  name: string
  stage: number
  objectives: ReadonlyArray<GuidedObjectiveSummary>
}>

export const GUIDED_SUMMARY: Record<SandboxId, GuidedSummary> = {
  'out-of-credits': {
    id: 'out-of-credits',
    name: 'Out of Credits',
    stage: 0,
    objectives: [
      { goal: 'Serve every request for 90 seconds.' },
      { goal: 'Demand is up 4×. Keep Apdex above 0.85 for 2 minutes.', users: 2400 },
      {
        goal: 'Night traffic is back to the start. Keep Apdex above 0.85 with Burn at $0.12/s or less.',
        users: 600,
      },
    ],
  },
  'shared-box': {
    id: 'shared-box',
    name: 'Shared Box',
    stage: 0,
    objectives: [
      { goal: 'Keep Apdex above 0.85 for 90 seconds.' },
      { goal: 'Demand doubled. Keep Apdex above 0.9 with Burn at $0.16/s or less.', users: 2800 },
      {
        goal: 'Night traffic is back to the start. Keep Apdex above 0.9 with Burn at $0.11/s or less.',
        users: 1400,
      },
    ],
  },
  'second-server': {
    id: 'second-server',
    name: 'Second Server',
    stage: 0,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'A server will fail. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'instance', only: 'server' },
      },
      {
        goal: 'Demand doubled. Keep Apdex above 0.9 through another failure.',
        users: 4800,
        incident: { kind: 'instance', only: 'server' },
      },
    ],
  },
  'connection-limit': {
    id: 'connection-limit',
    name: 'Connection Limit',
    stage: 1,
    objectives: [
      { goal: 'Serve every request for 90 seconds.' },
      { goal: 'Demand doubled. Keep Apdex above 0.9 for 2 minutes.', users: 6000 },
      {
        goal: 'A deploy will double every pool. Keep errors under 1%.',
        incident: { kind: 'connections' },
      },
    ],
  },
  'event-loop-stall': {
    id: 'event-loop-stall',
    name: 'Event Loop Stall',
    stage: 1,
    objectives: [
      { goal: 'Keep p99 under 300 ms for 2 minutes.' },
      {
        goal: 'Password hashing will get 4× slower. Keep p99 under 600 ms for 2 minutes.',
        incident: { kind: 'loop' },
      },
    ],
  },
  'read-mostly': {
    id: 'read-mostly',
    name: 'Read Mostly',
    stage: 1,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      { goal: 'Demand doubled. Keep Apdex above 0.9 with Burn at $2.60/s or less.', users: 8000 },
      {
        goal: 'A query will ship with no index. Keep Apdex above 0.85 for 2 minutes after.',
        incident: { kind: 'slow-query' },
      },
    ],
  },
  stampede: {
    id: 'stampede',
    name: 'Stampede',
    stage: 2,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'The Cache will restart. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'stampede' },
      },
      {
        goal: 'Demand is up 50%. The Cache restarts again. Keep Apdex above 0.85 with Burn at $8.00/s or less.',
        users: 9000,
        incident: { kind: 'stampede' },
      },
    ],
  },
  'slow-uploads': {
    id: 'slow-uploads',
    name: 'Slow Uploads',
    stage: 2,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      { goal: 'Demand is up 60%. Keep Apdex above 0.9 with Burn at $6.00/s or less.', users: 8000 },
      {
        goal: 'A task will fail forever. Keep the Queue under 500 tasks for 2 minutes.',
        incident: { kind: 'poison' },
      },
    ],
  },
  bots: {
    id: 'bots',
    name: 'Bots',
    stage: 2,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'Scrapers are coming. Keep Apdex above 0.9 for 2 minutes.',
        incident: { kind: 'bot-surge' },
      },
      {
        goal: 'They are back. Keep Apdex above 0.9 with Burn at $10.80/s or less.',
        incident: { kind: 'bot-surge' },
      },
    ],
  },
  'zone-outage': {
    id: 'zone-outage',
    name: 'Zone Outage',
    stage: 3,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'A zone will fail. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'zone' },
      },
      {
        goal: 'Demand is up 50%. A zone fails again. Keep Apdex above 0.85 with Burn at $22.20/s or less.',
        users: 12000,
        incident: { kind: 'zone' },
      },
    ],
  },
  'cold-start': {
    id: 'cold-start',
    name: 'Cold Start',
    stage: 3,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'A 4× spike is coming. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'spike' },
      },
      { goal: 'Night traffic. Keep Apdex above 0.9 with Burn at $17.40/s or less.', users: 4000 },
    ],
  },
  'stale-checkout': {
    id: 'stale-checkout',
    name: 'Stale Checkout',
    stage: 3,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'Writes will pile up. Keep every checkout correct for 2 minutes.',
        incident: { kind: 'repl-lag' },
      },
      {
        goal: 'Demand is up 50%, and the writes come back. Keep every checkout correct through it.',
        users: 12000,
        incident: { kind: 'repl-lag' },
      },
    ],
  },
  'gc-pauses': {
    id: 'gc-pauses',
    name: 'GC Pauses',
    stage: 4,
    objectives: [
      { goal: 'Keep API reads under 110 ms at the p99 for 90 seconds.' },
      {
        goal: 'The heap will fill. Keep API reads under 110 ms at the p99 for 2 minutes.',
        incident: { kind: 'gc-storm' },
      },
      {
        goal: 'It fills again. Keep reads under 110 ms at the p99 with Burn at $93.20/s or less.',
        incident: { kind: 'gc-storm' },
      },
    ],
  },
  'retry-storm': {
    id: 'retry-storm',
    name: 'Retry Storm',
    stage: 4,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'The Database will slow down for 20 s. Get errors back under 1% and hold for 2 minutes.',
        incident: { kind: 'retry-storm' },
      },
      {
        goal: 'It slows again. Get errors under 1% and hold with Burn at $197.00/s or less.',
        incident: { kind: 'retry-storm' },
      },
    ],
  },
  'analytics-primary': {
    id: 'analytics-primary',
    name: 'Analytics on Primary',
    stage: 4,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 90 seconds.' },
      {
        goal: 'Quarter end: a report will scan every table. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'report-db' },
      },
      {
        goal: 'Demand is up 50%. Keep Apdex above 0.9 with Burn at $254.00/s or less.',
        users: 12000,
      },
    ],
  },
  'far-away': {
    id: 'far-away',
    name: 'Far Away',
    stage: 5,
    objectives: [
      { goal: 'Serve every request for 2 minutes.' },
      {
        goal: 'Half your users live outside North America. Get API reads under 140 ms on average for 2 minutes.',
      },
    ],
  },
  'missed-write': {
    id: 'missed-write',
    name: 'Missed Write',
    stage: 5,
    objectives: [
      { goal: 'Every API read must see the latest write. Hold it for 2 minutes.' },
      {
        goal: 'A replica will fail. Keep reads fresh and errors under 1% for 2 minutes.',
        incident: { kind: 'instance', only: 'wide' },
      },
    ],
  },
  'hot-key': {
    id: 'hot-key',
    name: 'Hot Key',
    stage: 5,
    objectives: [
      { goal: 'Keep Apdex above 0.9 for 2 minutes.' },
      {
        goal: 'A celebrity will post. Keep Apdex above 0.85 for 2 minutes.',
        incident: { kind: 'hot-key' },
      },
    ],
  },
}
