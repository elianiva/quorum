import type { BackendKind, RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'
export {
  FEATURE_IDS,
  INTERNAL_TOOL_FEATURES,
  BACKGROUND_FEATURES,
  TASK_IDS,
  TASKS,
  QUARTER_DAYS,
  FIXES,
} from '../generated/work.ts'
import { FEATURE_IDS, TASK_IDS, FIXES } from '../generated/work.ts'

export type FeatureId = (typeof FEATURE_IDS)[number]

export type FeatureDef = Readonly<{
  id: FeatureId
  name: string
  era: number
  dh: number
  requires: ReadonlyArray<FeatureId>
  research: ResearchId | null
  market: number
  growth: number
  churn: number
  load: Partial<Record<RequestKind, number>>
  value: Partial<Record<RequestKind, number>>
  payload: Partial<Record<RequestKind, number>>
  queries: Partial<Record<BackendKind, number>>
  unlocks: Readonly<{ kind: RequestKind; share: number; gated: boolean }> | null
  shapes: number
  history: number
  subscription: boolean
  effect: string
  hidden: string | null
}>

const feature = (
  entry: Pick<FeatureDef, 'id' | 'name' | 'era' | 'dh' | 'effect'> & Partial<FeatureDef>,
): FeatureDef => ({
  requires: [],
  research: null,
  market: 1,
  growth: 1,
  churn: 1,
  load: {},
  value: {},
  payload: {},
  queries: {},
  unlocks: null,
  shapes: 0,
  history: 1,
  subscription: false,
  hidden: null,
  ...entry,
})

export const FEATURES: Record<FeatureId, FeatureDef> = {
  'landing-page': feature({
    id: 'landing-page',
    name: 'Landing page',
    era: 0,
    dh: 8,
    market: 1.2,
    load: { page: 1.1 },
    effect: 'Market +20%, page views +10%',
  }),
  'signup-flow': feature({
    id: 'signup-flow',
    name: 'Signup flow',
    era: 0,
    dh: 16,
    growth: 1.15,
    unlocks: { kind: 'write', share: 0.05, gated: false },
    effect: 'Growth +15%, writes arrive early',
  }),
  pagination: feature({
    id: 'pagination',
    name: 'Pagination',
    era: 0,
    dh: 4,
    payload: { read: 0.5 },
    shapes: 1,
    effect: 'API reads send half the bytes',
    hidden: 'Adds a query shape with no index',
  }),
  'password-login': feature({
    id: 'password-login',
    name: 'Password login',
    era: 1,
    dh: 40,
    requires: ['signup-flow'],
    unlocks: { kind: 'login', share: 0.05, gated: true },
    effect: 'Logins arrive: 80 ms of CPU each',
  }),
  'paid-plans': feature({
    id: 'paid-plans',
    name: 'Paid plans',
    era: 1,
    dh: 80,
    requires: ['password-login'],
    value: { write: 1.3 },
    subscription: true,
    effect: 'Writes earn 30% more, plus subscriptions',
  }),
  'email-digests': feature({
    id: 'email-digests',
    name: 'Email digests',
    era: 1,
    dh: 40,
    requires: ['signup-flow'],
    churn: 0.9,
    unlocks: { kind: 'job', share: 0.01, gated: false },
    load: { job: 2 },
    effect:
      'Churn −10%. Digests send in a burst of jobs: twice the exports, 400 ms of CPU and 50 reads each',
    hidden: 'The send is a burst of jobs',
  }),
  'search-filters': feature({
    id: 'search-filters',
    name: 'Search filters',
    era: 2,
    dh: 40,
    value: { search: 1.25 },
    queries: { 'q-search': 1.4 },
    effect: 'Searches earn 25% more',
    hidden: 'Each search query costs 40% more',
  }),
  'profile-photos': feature({
    id: 'profile-photos',
    name: 'Profile photos',
    era: 2,
    dh: 40,
    requires: ['password-login'],
    growth: 1.1,
    unlocks: { kind: 'upload', share: 0.04, gated: true },
    effect: 'Growth +10%, uploads arrive: 120 ms of CPU each',
  }),
  'public-api': feature({
    id: 'public-api',
    name: 'Public API',
    era: 2,
    dh: 160,
    requires: ['password-login'],
    market: 1.25,
    load: { read: 1.3, bot: 1.5 },
    effect: 'Market +25%, API reads +30%',
    hidden: 'Bots +50%',
  }),
  'infinite-scroll': feature({
    id: 'infinite-scroll',
    name: 'Infinite scroll',
    era: 2,
    dh: 24,
    requires: ['pagination'],
    value: { read: 1.1 },
    load: { read: 1.4 },
    effect: 'API reads earn 10% more, and users send 40% more',
  }),
  video: feature({
    id: 'video',
    name: 'Video',
    era: 3,
    dh: 480,
    requires: ['profile-photos'],
    market: 1.4,
    unlocks: { kind: 'media', share: 0.1, gated: true },
    effect: 'Market +40%, video arrives: 5 MB each',
  }),
  chat: feature({
    id: 'chat',
    name: 'Chat',
    era: 3,
    dh: 480,
    requires: ['password-login'],
    churn: 0.8,
    research: 'websockets',
    unlocks: { kind: 'rt', share: 0.08, gated: true },
    effect: 'Churn −20%, realtime messages hold connections open',
  }),
  checkout: feature({
    id: 'checkout',
    name: 'Checkout',
    era: 3,
    dh: 320,
    requires: ['paid-plans'],
    research: 'checkout',
    unlocks: { kind: 'buy', share: 0.03, gated: true },
    effect: 'Checkouts arrive: $25 each, through the Payment Provider',
  }),
  'notifications-center': feature({
    id: 'notifications-center',
    name: 'Notifications center',
    era: 3,
    dh: 80,
    requires: ['chat'],
    growth: 1.1,
    load: { rt: 1.2 },
    effect: 'Growth +10%, realtime +20%',
  }),
  'mobile-app': feature({
    id: 'mobile-app',
    name: 'Mobile app',
    era: 3,
    dh: 960,
    requires: ['public-api'],
    market: 1.6,
    load: { read: 1.5 },
    effect: 'Market +60%, API reads +50%',
  }),
  'data-export': feature({
    id: 'data-export',
    name: 'Data export',
    era: 4,
    dh: 80,
    value: { write: 1.2 },
    unlocks: { kind: 'job', share: 0.02, gated: true },
    effect: 'Writes earn 20% more. Exports arrive: 400 ms of CPU and 50 reads each',
  }),
  dashboards: feature({
    id: 'dashboards',
    name: 'Dashboards',
    era: 4,
    dh: 480,
    market: 1.1,
    history: 0.5,
    unlocks: { kind: 'report', share: 0.03, gated: true },
    effect: 'Market +10%. Reports arrive: a table scan each',
  }),
  'ai-assistant': feature({
    id: 'ai-assistant',
    name: 'AI assistant',
    era: 4,
    dh: 480,
    research: 'hosted-models',
    unlocks: { kind: 'ai', share: 0.05, gated: true },
    effect: 'AI prompts arrive: $24 each, served by a GPU Node or the LLM API',
  }),
  recommendations: feature({
    id: 'recommendations',
    name: 'Recommendations',
    era: 4,
    dh: 480,
    requires: ['video', 'data-export'],
    history: 0.5,
    load: { media: 1.3, job: 1.3 },
    effect: 'Video +30%',
    hidden: 'Exports +30%: the model trains in batch',
  }),
  'audit-log': feature({
    id: 'audit-log',
    name: 'Audit log',
    era: 4,
    dh: 120,
    requires: ['password-login'],
    market: 1.1,
    queries: { 'q-write': 1.2 },
    effect: 'Market +10%: enterprises can buy',
    hidden: 'Each write query costs 20% more',
  }),
  'activity-feed': feature({
    id: 'activity-feed',
    name: 'Activity feed',
    era: 5,
    dh: 480,
    market: 1.5,
    research: 'hybrid-fanout',
    unlocks: { kind: 'feed', share: 0.08, gated: true },
    effect: 'Market +50%. Feeds arrive: 20 reads each, or one timeline with fan-out on write',
  }),
  webhooks: feature({
    id: 'webhooks',
    name: 'Webhooks',
    era: 5,
    dh: 120,
    requires: ['public-api'],
    market: 1.2,
    unlocks: { kind: 'hook', share: 0.02, gated: true },
    effect: 'Market +20%. Webhooks arrive: 800 ms calls to customer servers',
  }),
  'push-notifications': feature({
    id: 'push-notifications',
    name: 'Push notifications',
    era: 5,
    dh: 80,
    requires: ['mobile-app', 'notifications-center'],
    growth: 1.15,
    churn: 1.05,
    research: 'notifications',
    unlocks: { kind: 'push', share: 0.02, gated: true },
    effect: 'Growth +15%. Notifications arrive, through the Push Provider',
    hidden: 'Churn +5%: users tire of them',
  }),
  localization: feature({
    id: 'localization',
    name: 'Localization',
    era: 5,
    dh: 480,
    market: 1.24,
    effect: 'Market +40% outside North America',
  }),
  'offline-mode': feature({
    id: 'offline-mode',
    name: 'Offline mode',
    era: 5,
    dh: 480,
    requires: ['mobile-app'],
    churn: 0.9,
    load: { write: 1.1 },
    effect: 'Churn −10%',
    hidden: 'Writes +10%: devices sync in bursts on reconnect',
  }),
  'single-sign-on': feature({
    id: 'single-sign-on',
    name: 'Single sign-on',
    era: 6,
    dh: 240,
    requires: ['password-login'],
    market: 1.1,
    effect: 'Market +10%: enterprises sign in with SAML',
  }),
  'data-residency': feature({
    id: 'data-residency',
    name: 'Data residency',
    era: 6,
    dh: 1_440,
    effect: 'Required for the EU market: EU data stays in an EU region',
  }),
  'status-page': feature({
    id: 'status-page',
    name: 'Status page',
    era: 6,
    dh: 16,
    churn: 0.9,
    effect: 'Churn −10%: users see you are on it',
  }),
  'usage-pricing': feature({
    id: 'usage-pricing',
    name: 'Usage-based pricing',
    era: 7,
    dh: 480,
    requires: ['paid-plans'],
    value: { job: 1.15, write: 1.15, ai: 1.15, hook: 1.15 },
    effect: 'Exports, writes, prompts and webhooks earn 15% more',
  }),
}

export type TaskId = (typeof TASK_IDS)[number]

export type TaskDef = Readonly<{
  id: TaskId
  name: string
  dh: number
  research: ResearchId | null
  effect: string
  internal: boolean
}>

export type FixId = (typeof FIXES)[number]
