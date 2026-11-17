import type { RequestKind } from './kinds.ts'

export type EraDef = Readonly<{
  name: string
  market: number
  raiseAt: number
  grant: number
  dilution: number
  growth: number
  apdexTarget: number
  costIndex: number
  salaryIndex: number
  slo: number
  incidentInterval: number
  maxSeverity: 1 | 2 | 3
  mix: Partial<Record<RequestKind, number>>
  question: string
  arrivals: string
}>

const SERIES_B_MIX: Partial<Record<RequestKind, number>> = {
  page: 0.15,
  read: 0.22,
  write: 0.09,
  login: 0.04,
  search: 0.07,
  upload: 0.04,
  bot: 0.07,
  media: 0.1,
  rt: 0.08,
  buy: 0.03,
  job: 0.02,
  report: 0.03,
  ai: 0.05,
  bid: 0.01,
}

const SERIES_C_MIX: Partial<Record<RequestKind, number>> = {
  page: 0.11,
  read: 0.18,
  write: 0.08,
  login: 0.03,
  search: 0.06,
  upload: 0.03,
  bot: 0.07,
  media: 0.1,
  rt: 0.08,
  buy: 0.03,
  job: 0.02,
  report: 0.02,
  ai: 0.06,
  feed: 0.08,
  hook: 0.02,
  push: 0.02,
  bid: 0.01,
}

export const ERAS: ReadonlyArray<EraDef> = [
  {
    name: 'Garage',
    slo: 0.99,
    incidentInterval: 0,
    maxSeverity: 3,
    market: 1_500,
    raiseAt: 1_000,
    grant: 2_500,
    dilution: 0.1,
    growth: 0.004,
    apdexTarget: 0.85,
    costIndex: 1,
    salaryIndex: 1,
    mix: { page: 0.6, read: 0.4 },
    question: 'How far does one box go?',
    arrivals: 'Page views and API reads.',
  },
  {
    name: 'Pre-seed',
    slo: 0.99,
    incidentInterval: 720,
    maxSeverity: 2,
    market: 7_000,
    raiseAt: 5_000,
    grant: 15_000,
    dilution: 0.19,
    growth: 0.0022,
    apdexTarget: 0.86,
    costIndex: 4,
    salaryIndex: 4,
    mix: { page: 0.44, read: 0.35, write: 0.15, login: 0.06 },
    question: 'What happens when the database is the bottleneck?',
    arrivals: 'Writes contend for the database. Hiring opens. Incidents begin.',
  },
  {
    name: 'Seed',
    slo: 0.995,
    incidentInterval: 600,
    maxSeverity: 2,
    market: 35_000,
    raiseAt: 25_000,
    grant: 80_000,
    dilution: 0.19,
    growth: 0.0016,
    apdexTarget: 0.88,
    costIndex: 8,
    salaryIndex: 8,
    mix: {
      page: 0.26,
      read: 0.29,
      write: 0.12,
      login: 0.06,
      search: 0.1,
      upload: 0.07,
      bot: 0.1,
    },
    question: 'What happens when one App Server type cannot serve every kind?',
    arrivals: 'Search, uploads and bots. Queues, Workers, a CDN and a WAF.',
  },
  {
    name: 'Series A',
    slo: 0.999,
    incidentInterval: 540,
    maxSeverity: 2,
    market: 200_000,
    raiseAt: 150_000,
    grant: 1_500_000,
    dilution: 0.13,
    growth: 0.0009,
    apdexTarget: 0.9,
    costIndex: 12,
    salaryIndex: 12,
    mix: {
      page: 0.15,
      read: 0.25,
      write: 0.1,
      login: 0.04,
      search: 0.1,
      upload: 0.06,
      bot: 0.08,
      media: 0.1,
      rt: 0.08,
      buy: 0.03,
      bid: 0.01,
    },
    question: 'What happens when a whole zone fails?',
    arrivals: 'Video, chat, checkout and bids. Zones, autoscaling and an error budget.',
  },
  {
    name: 'Series B',
    slo: 0.999,
    incidentInterval: 480,
    maxSeverity: 1,
    market: 1_400_000,
    raiseAt: 1_000_000,
    grant: 18_000_000,
    dilution: 0.12,
    growth: 0.0007,
    apdexTarget: 0.91,
    costIndex: 16,
    salaryIndex: 16,
    mix: SERIES_B_MIX,
    question: 'What happens when analytics and AI share a database built for checkouts?',
    arrivals: 'Exports, reports and AI prompts. Warehouses, GPUs, retries and breakers.',
  },
  {
    name: 'Series C',
    slo: 0.9995,
    incidentInterval: 480,
    maxSeverity: 1,
    market: 14_000_000,
    raiseAt: 10_000_000,
    grant: 150_000_000,
    dilution: 0.12,
    growth: 0.0005,
    apdexTarget: 0.92,
    costIndex: 20,
    salaryIndex: 20,
    mix: SERIES_C_MIX,
    question: 'What happens when your users live on four continents?',
    arrivals: 'Feeds, webhooks and push. Regions, GeoDNS, quorums and consensus.',
  },
  {
    name: 'Pre-IPO',
    slo: 0.999,
    incidentInterval: 600,
    maxSeverity: 1,
    market: 70_000_000,
    raiseAt: 50_000_000,
    grant: 0,
    dilution: 0.15,
    growth: 0.0003,
    apdexTarget: 0.93,
    costIndex: 24,
    salaryIndex: 24,
    mix: SERIES_C_MIX,
    question: 'Can you prove the company is ready to go public?',
    arrivals: 'The IPO checklist: reliability, SOC 2, a DR drill, data residency, the Rule of 40.',
  },
  {
    name: 'Public',
    slo: 0.9999,
    incidentInterval: 600,
    maxSeverity: 1,
    market: 6_000_000_000,
    raiseAt: Number.POSITIVE_INFINITY,
    grant: 0,
    dilution: 0,
    growth: 0.0002,
    apdexTarget: 0.94,
    costIndex: 24,
    salaryIndex: 24,
    mix: SERIES_C_MIX,
    question: 'Can you beat your guidance every quarter?',
    arrivals: 'Quarters, guidance and the market multiple. The game is endless.',
  },
]

export const RPS_PER_USER = 0.02
export const DIURNAL_AMPLITUDE = 0.45
export const WEEKEND_FACTOR = 1
export const STEP_SECONDS = 0.1
export const CALENDAR_START = 14 * 60
export const CHURN = 0.004
export const FICKLE_SHARE = 0.5
export const STEADY_CHURN = 0.2
export const FUNNEL_GROWTH = 1.1
export const DECLINED_GROWTH = 0.7
export const APDEX_WINDOW = 60

export const TUNED_PRE_SEED_MIX: Partial<Record<RequestKind, number>> = {
  page: 0.45,
  read: 0.35,
  write: 0.15,
  login: 0.05,
}

export const TUNED_SEED_MIX: Partial<Record<RequestKind, number>> = {
  page: 0.3,
  read: 0.3,
  write: 0.12,
  login: 0.04,
  search: 0.1,
  upload: 0.04,
  bot: 0.1,
}

export const TUNED_SERIES_A_MIX: Partial<Record<RequestKind, number>> = {
  page: 0.21,
  read: 0.25,
  write: 0.1,
  login: 0.03,
  search: 0.08,
  upload: 0.03,
  bot: 0.08,
  media: 0.1,
  rt: 0.08,
  buy: 0.03,
  bid: 0.01,
}
