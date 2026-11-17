import { def } from './define.ts'

export const MESH_HOP_MS = 1
export const MESH_OVERHEAD = 0.05
export const MESH_INSIGHT = 0.2
export const MESH_TAX = 0.5

export const meshDef = def({
  id: 'mesh',
  code: 'mesh',
  name: 'Service Mesh',
  product: 'Istio',
  group: 'ops',
  blurb:
    'Link App Servers and Workers into it. A sidecar beside each one retries and breaks its calls, and watches them: +1 ms a hop, and 5% of its CPU.',
  cost: 600,
  latency: 0,
  accepts: [],
  maxOut: 0,
  control: true,
  unlock: 'service-mesh',
})
