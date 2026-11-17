import { def } from './define.ts'

export const POISON_SHARE = 0.9
export const TASK_RETRY_SECONDS = 30
export const PREFETCH = [1, 10, 100] as const
export const FETCH_MS = 20

export const workerDef = def({
  id: 'worker',
  code: 'wrk',
  name: 'Worker',
  product: 'Sidekiq',
  group: 'compute',
  blurb:
    'Runs your code on tasks from a Queue. Users never wait for it. Link it to the data its tasks read and write.',
  cost: 60,
  sized: true,
  latency: 0,
  accepts: ['task'],
  sends: ['q-read', 'q-write', 'blob-put', 'notify', 'callout'],
  unlock: 'background-jobs',
  stack: true,
  limiting: true,
  coldStart: true,
})
