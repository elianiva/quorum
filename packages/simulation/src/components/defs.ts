import type { ComponentId } from '../catalog/components.ts'
import { analyticsGlossary } from './analytics.ts'
import { serverGlossary } from './server.ts'
import { dnsGlossary } from './dns.ts'
import { lbGlossary } from './lb.ts'
import { poolerGlossary } from './pooler.ts'
import { cacheGlossary } from './cache.ts'
import { replicaGlossary } from './replica.ts'
import { authGlossary } from './auth.ts'
import { searchGlossary } from './search.ts'
import { storageGlossary } from './storage.ts'
import { docGlossary } from './doc.ts'
import { queueGlossary } from './queue.ts'
import { logGlossary } from './log.ts'
import { cdnGlossary } from './cdn.ts'
import { wafGlossary } from './waf.ts'
import { pspGlossary } from './psp.ts'
import { autoscalerGlossary } from './autoscaler.ts'
import { clusterGlossary } from './cluster.ts'
import { warehouseGlossary } from './warehouse.ts'
import { vecGlossary } from './vec.ts'
import { gpuGlossary } from './gpu.ts'
import { llmGlossary } from './llm.ts'
import { wideGlossary } from './wide.ts'
import { dsqlGlossary } from './dsql.ts'

export const COMPONENT_GLOSSARY: Partial<Record<ComponentId, ReadonlyArray<string>>> = {
  queue: queueGlossary,
  autoscaler: autoscalerGlossary,
  auth: authGlossary,
  cache: cacheGlossary,
  cdn: cdnGlossary,
  warehouse: warehouseGlossary,
  cluster: clusterGlossary,
  pooler: poolerGlossary,
  wide: wideGlossary,
  dns: dnsGlossary,
  replica: replicaGlossary,
  lb: lbGlossary,
  psp: pspGlossary,
  search: searchGlossary,
  doc: docGlossary,
  vec: vecGlossary,
  log: logGlossary,
  gpu: gpuGlossary,
  llm: llmGlossary,
  storage: storageGlossary,
  analytics: analyticsGlossary,
  server: serverGlossary,
  dsql: dsqlGlossary,
  waf: wafGlossary,
}
