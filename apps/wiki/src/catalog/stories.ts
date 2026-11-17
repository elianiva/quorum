import {
  COMPONENT_IDS,
  COMPONENTS,
  SIZES,
  ZONES,
  type ComponentId,
} from '@quorum/simulation/catalog'
import type { NodeStatus } from '@quorum/simulation/ledger'

export type Value = string | number | boolean
export type Args = Readonly<Record<string, Value>>

export type Control =
  | Readonly<{ kind: 'bool' }>
  | Readonly<{ kind: 'select'; options: ReadonlyArray<string> }>
  | Readonly<{ kind: 'range'; min: number; max: number; step: number }>

export type ArgType = Readonly<{
  key: string
  group: 'Node' | 'Ledger' | 'Research'
  control: Control
  initial: Value
}>

export type State = Readonly<{ name: string; args: Args }>

export type Story = Readonly<{
  id: ComponentId
  name: string
  group: string
  argTypes: ReadonlyArray<ArgType>
  states: ReadonlyArray<State>
}>

const bool = (key: string, group: ArgType['group'], initial: boolean): ArgType => ({
  key,
  group,
  control: { kind: 'bool' },
  initial,
})
const select = (
  key: string,
  group: ArgType['group'],
  options: ReadonlyArray<string>,
  initial: string,
): ArgType => ({ key, group, control: { kind: 'select', options }, initial })
const range = (
  key: string,
  group: ArgType['group'],
  min: number,
  max: number,
  step: number,
  initial: number,
): ArgType => ({ key, group, control: { kind: 'range', min, max, step }, initial })

export const LIVES = ['running', 'warming', 'restarting', 'stopped'] as const
export const STATUSES: ReadonlyArray<NodeStatus> = ['idle', 'ok', 'warn', 'danger', 'down']
export const RESEARCH = [
  ['profiling', 'profiling'],
  ['metrics', 'metrics'],
  ['percentiles', 'percentiles'],
  ['zones', 'multi-az'],
] as const

const EXTRAS: Partial<Record<ComponentId, ReadonlyArray<ArgType>>> = {
  cache: [range('hitRatio', 'Ledger', 0, 1, 0.01, 0.82)],
  cdn: [range('hitRatio', 'Ledger', 0, 1, 0.01, 0.9)],
  database: [range('connections', 'Ledger', 0, 120, 1, 40)],
  replica: [
    range('connections', 'Ledger', 0, 120, 1, 40),
    range('lagMs', 'Ledger', 0, 5000, 10, 80),
  ],
  queue: [range('depth', 'Node', 0, 5000, 10, 200), range('age', 'Ledger', 0, 600, 1, 4)],
  log: [range('depth', 'Node', 0, 5000, 10, 200)],
}

const argTypesOf = (id: ComponentId): ReadonlyArray<ArgType> => {
  const def = COMPONENTS[id]
  return [
    ...(def.sized
      ? [range('size', 'Node', 0, SIZES.length - 1, 1, 1)]
      : def.steps > 1
        ? [range('size', 'Node', 1, def.steps, 1, 1)]
        : []),
    select('zone', 'Node', ZONES, 'a'),
    range('replicas', 'Node', 1, 8, 1, 1),
    select('life', 'Node', LIVES, 'running'),
    bool('selected', 'Node', false),
    select('status', 'Ledger', STATUSES, 'ok'),
    range('utilization', 'Ledger', 0, 1.5, 0.01, 0.67),
    range('inbound', 'Ledger', 0, 20_000, 10, 800),
    range('capacity', 'Ledger', 10, 20_000, 10, 1200),
    range('latency', 'Ledger', 0, 2000, 1, 12),
    range('p99', 'Ledger', 0, 5000, 1, 40),
    range('dropped', 'Ledger', 0, 5000, 1, 0),
    range('stranded', 'Ledger', 0, 5000, 1, 0),
    ...(EXTRAS[id] ?? []),
    ...RESEARCH.map(([key]) => bool(key, 'Research', true)),
  ]
}

const STATES: ReadonlyArray<State> = [
  { name: 'idle', args: { status: 'idle', inbound: 0, utilization: 0 } },
  { name: 'healthy', args: {} },
  { name: 'busy', args: { status: 'warn', utilization: 0.85 } },
  {
    name: 'saturated',
    args: { status: 'danger', utilization: 1.3, dropped: 300, inbound: 1600 },
  },
  { name: 'stranded', args: { status: 'danger', stranded: 200 } },
  { name: 'booting', args: { life: 'warming', status: 'idle', utilization: 0 } },
  { name: 'down', args: { life: 'stopped', status: 'down', utilization: 0, inbound: 0 } },
]

export const STORIES: ReadonlyArray<Story> = COMPONENT_IDS.map((id) => ({
  id,
  name: COMPONENTS[id].name,
  group: COMPONENTS[id].group,
  argTypes: argTypesOf(id),
  states: STATES,
}))

export const storyOf = (id: string): Story | null =>
  STORIES.find((story) => story.id === id) ?? null

export const DEFAULT_STORY: ComponentId = 'cache'

export const initialArgs = (story: Story): Args =>
  Object.fromEntries(story.argTypes.map((arg) => [arg.key, arg.initial]))

export const stateArgs = (story: Story, state: State): Args => ({
  ...initialArgs(story),
  ...state.args,
})

const SAFE = /^[\w .-]*$/

export const encodeArgs = (story: Story, args: Args): string =>
  story.argTypes
    .filter((arg) => args[arg.key] !== undefined && args[arg.key] !== arg.initial)
    .map((arg) => `${arg.key}:${String(args[arg.key])}`)
    .join(';')

const coerce = (arg: ArgType, text: string): Value | null => {
  const { control } = arg
  if (control.kind === 'bool') return text === 'true' ? true : text === 'false' ? false : null
  if (control.kind === 'select') return control.options.includes(text) ? text : null
  const value = Number(text)
  if (text === '' || !Number.isFinite(value)) return null
  return Math.min(control.max, Math.max(control.min, value))
}

export const decodeArgs = (story: Story, text: string): Args => {
  const found = Object.fromEntries(
    text
      .split(';')
      .map((pair) => pair.split(':'))
      .flatMap(([key = '', value = '']) => {
        const arg = story.argTypes.find((entry) => entry.key === key)
        const coerced = arg && SAFE.test(value) ? coerce(arg, value) : null
        return coerced === null ? [] : [[key, coerced] as const]
      }),
  )
  return { ...initialArgs(story), ...found }
}
