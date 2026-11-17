import { def } from './define.ts'

export const ROLLOUT_STEPS = [0, 0.05, 0.25, 0.5, 1] as const
export const ROLLOUT_ALL = 1

export const ffDef = def({
  id: 'ff',
  code: 'ff',
  name: 'Feature Flags',
  product: 'LaunchDarkly',
  group: 'ops',
  blurb:
    'Rolls a Feature out to 5%, 25%, 50% or every user, and turns it off. Changes propagate to every server in seconds. A bad deploy reaches only the share that has it.',
  cost: 150,
  burn: 0.01,
  latency: 0,
  accepts: [],
  maxOut: 0,
  unlock: 'feature-flags',
})
