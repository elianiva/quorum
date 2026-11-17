export const EXIT_IDS = ['acqui-hire', 'acquisition', 'ipo', 'step-down'] as const
export type ExitId = (typeof EXIT_IDS)[number]

export type ExitDef = Readonly<{
  id: ExitId
  name: string
  stage: number
  cap: number
  multiplier: number
  continues: boolean
}>

export const EXITS: Record<ExitId, ExitDef> = {
  'acqui-hire': {
    id: 'acqui-hire',
    name: 'Acqui-hire',
    stage: 3,
    cap: 50_000_000,
    multiplier: 0.5,
    continues: false,
  },
  acquisition: {
    id: 'acquisition',
    name: 'Acquisition',
    stage: 4,
    cap: Number.POSITIVE_INFINITY,
    multiplier: 1,
    continues: false,
  },
  ipo: {
    id: 'ipo',
    name: 'IPO',
    stage: 6,
    cap: Number.POSITIVE_INFINITY,
    multiplier: 1.5,
    continues: true,
  },
  'step-down': {
    id: 'step-down',
    name: 'Step down',
    stage: 7,
    cap: Number.POSITIVE_INFINITY,
    multiplier: 1.5,
    continues: false,
  },
}

export const STREAK_BONUS = 0.1
export const STREAK_BONUS_CAP = 1

export const PERK_IDS = [
  'angel-network',
  'alumni-network',
  'institutional-knowledge',
  'pattern-recognition',
  'founders-reputation',
  'better-terms',
  'night-shift',
  'time-dilation',
  'playbooks',
  'war-stories',
  'head-start',
  'autopilot',
] as const
export type PerkId = (typeof PERK_IDS)[number]

export type PerkDef = Readonly<{
  id: PerkId
  name: string
  costs: ReadonlyArray<number>
  effect: string
}>

const doubling = (first: number, levels: number): ReadonlyArray<number> => {
  const costs: Array<number> = []
  let cost = first
  for (let level = 0; level < levels; level += 1) {
    costs.push(cost)
    cost *= 2
  }
  return costs
}

const tripling = (first: number, levels: number): ReadonlyArray<number> => {
  const costs: Array<number> = []
  let cost = first
  for (let level = 0; level < levels; level += 1) {
    costs.push(cost)
    cost *= 3
  }
  return costs
}

const shopPrice = (costs: ReadonlyArray<number>): ReadonlyArray<number> =>
  costs.map((cost) => Math.round(cost * 1.125))

export const PERKS: Record<PerkId, PerkDef> = {
  'angel-network': {
    id: 'angel-network',
    name: 'Angel network',
    costs: shopPrice(doubling(2, 5)),
    effect: 'Starting Cash ×2',
  },
  'alumni-network': {
    id: 'alumni-network',
    name: 'Alumni network',
    costs: shopPrice(doubling(3, 5)),
    effect: '+1 engineer at Pre-seed',
  },
  'institutional-knowledge': {
    id: 'institutional-knowledge',
    name: 'Institutional knowledge',
    costs: shopPrice(Array.from({ length: 10 }, () => 5)),
    effect: 'Keep 1 research through an Exit',
  },
  'pattern-recognition': {
    id: 'pattern-recognition',
    name: 'Pattern recognition',
    costs: shopPrice(doubling(4, 5)),
    effect: 'Insight +20%',
  },
  'founders-reputation': {
    id: 'founders-reputation',
    name: 'Founder’s reputation',
    costs: shopPrice(doubling(4, 5)),
    effect: 'User growth +10%',
  },
  'better-terms': {
    id: 'better-terms',
    name: 'Better terms',
    costs: shopPrice(doubling(6, 5)),
    effect: 'Dilution per round −2 points',
  },
  'night-shift': {
    id: 'night-shift',
    name: 'Night shift',
    costs: shopPrice(tripling(5, 3)),
    effect: 'Dev Hours +10%',
  },
  'time-dilation': {
    id: 'time-dilation',
    name: 'Time dilation',
    costs: shopPrice([20, 80]),
    effect: 'Unlocks 20×, then 40× speed',
  },
  playbooks: {
    id: 'playbooks',
    name: 'Playbooks',
    costs: shopPrice(tripling(5, 4)),
    effect: 'Playbook slots 2, 5, 10, 25',
  },
  'war-stories': {
    id: 'war-stories',
    name: 'War stories',
    costs: shopPrice(tripling(8, 3)),
    effect: 'Open action items raise odds half as much',
  },
  'head-start': {
    id: 'head-start',
    name: 'Head start',
    costs: shopPrice([25, 75, 225]),
    effect: 'Start in Pre-seed, then Seed, then Series A',
  },
  autopilot: {
    id: 'autopilot',
    name: 'Autopilot',
    costs: shopPrice(tripling(10, 3)),
    effect: 'Policies: queue the cheapest Study, hire, keep App Servers cool',
  },
}

export const POLICY_LEVEL = { research: 1, hire: 2, upgrade: 3 } as const

export const AUTOPILOT_PAYROLL = 0.25
export const AUTOPILOT_HIRES = 4
export const AUTOPILOT_LOAD = 0.7

export const PLAYBOOK_SLOTS: ReadonlyArray<number> = [1, 2, 5, 10, 25]
export const DILATION_SPEEDS: ReadonlyArray<ReadonlyArray<number>> = [[], [20], [20, 40]]
