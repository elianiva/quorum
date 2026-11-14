import type { ComponentId } from '@quorum/simulation/catalog'
import type { Layout } from '../components/shared.ts'

/* Every Component's card shape: its rows, the row its input and output ports sit on, and whether
   it has a footer. The board's geometry reads this table; each Component's view draws the same
   layout, and a test keeps the two equal. Kept apart from COMPONENT_VIEWS so measuring a card does
   not load the views (and the Simulation behind them). */

export const LAYOUTS: Record<ComponentId, Layout> = {
  users: { rows: 3, inRow: null, outRow: 2, footer: false },
  payments: { rows: 2, inRow: null, outRow: null, footer: true },
  analytics: { rows: 5, inRow: 0, outRow: null, footer: true },
  server: { rows: 5, inRow: 0, outRow: 4, footer: true },
  database: { rows: 6, inRow: 0, outRow: 5, footer: true },
  dns: { rows: 3, inRow: 0, outRow: 2, footer: false },
  lb: { rows: 4, inRow: 0, outRow: 3, footer: true },
  pooler: { rows: 4, inRow: 0, outRow: 3, footer: true },
  cache: { rows: 4, inRow: 0, outRow: 3, footer: true },
  replica: { rows: 7, inRow: 0, outRow: null, footer: true },
  auth: { rows: 3, inRow: 0, outRow: null, footer: false },
  search: { rows: 3, inRow: 0, outRow: null, footer: true },
  storage: { rows: 4, inRow: 0, outRow: null, footer: false },
  doc: { rows: 4, inRow: 0, outRow: null, footer: true },
  queue: { rows: 4, inRow: 0, outRow: 3, footer: true },
  worker: { rows: 4, inRow: 0, outRow: 3, footer: true },
  log: { rows: 4, inRow: 0, outRow: 3, footer: true },
  fn: { rows: 5, inRow: 0, outRow: 4, footer: true },
  cdn: { rows: 3, inRow: 0, outRow: 2, footer: false },
  waf: { rows: 4, inRow: 0, outRow: 3, footer: true },
  gw: { rows: 4, inRow: 0, outRow: 3, footer: false },
  ws: { rows: 4, inRow: 0, outRow: null, footer: true },
  psp: { rows: 3, inRow: 0, outRow: null, footer: true },
  autoscaler: { rows: 3, inRow: 0, outRow: null, footer: false },
  ci: { rows: 3, inRow: null, outRow: null, footer: false },
  cluster: { rows: 3, inRow: 0, outRow: null, footer: false },
  warehouse: { rows: 3, inRow: 0, outRow: null, footer: false },
  vec: { rows: 4, inRow: 0, outRow: null, footer: true },
  gpu: { rows: 4, inRow: 0, outRow: null, footer: true },
  edge: { rows: 4, inRow: 0, outRow: 3, footer: true },
  llm: { rows: 3, inRow: 0, outRow: null, footer: true },
  msgp: { rows: 3, inRow: 0, outRow: null, footer: false },
  wide: { rows: 4, inRow: 0, outRow: null, footer: true },
  dsql: { rows: 3, inRow: 0, outRow: null, footer: true },
  cdc: { rows: 4, inRow: 0, outRow: 3, footer: false },
  mesh: { rows: 3, inRow: 0, outRow: null, footer: false },
  ff: { rows: 3, inRow: null, outRow: null, footer: false },
  pki: { rows: 3, inRow: null, outRow: null, footer: false },
}
