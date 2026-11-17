import { def } from './define.ts'

export const CDC_RATE = 20_000
export const CDC_CHANGES = ['q-write', 'q-tx', 'k-write'] as const

export const CDC_MS = 2

export const cdcDef = def({
  id: 'cdc',
  code: 'cdc',
  name: 'CDC Connector',
  product: 'Debezium',
  group: 'compute',
  blurb:
    'Link a Database into it. It reads every change off the write log and publishes it to an Event Stream, so the app never writes twice.',
  cost: 300,
  burn: 0.05,
  latency: CDC_MS,
  accepts: [],
  sends: ['change'],
  maxOut: 1,
  mirror: true,
  unlock: 'cdc',
  limiting: true,
})
