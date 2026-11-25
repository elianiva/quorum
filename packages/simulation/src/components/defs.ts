import type { ComponentId } from '../catalog/components.ts'
import { analyticsGlossary } from '../generated/analytics.ts'
import { serverGlossary } from '../generated/server.ts'
import { dnsGlossary } from '../generated/dns.ts'
import { lbGlossary } from '../generated/lb.ts'
import { poolerGlossary } from '../generated/pooler.ts'
import { cacheGlossary } from '../generated/cache.ts'
import { replicaGlossary } from '../generated/replica.ts'
import { authGlossary } from '../generated/auth.ts'
import { searchGlossary } from '../generated/search.ts'
import { storageGlossary } from '../generated/storage.ts'
import { docGlossary } from '../generated/doc.ts'
import { queueGlossary } from '../generated/queue.ts'
import { logGlossary } from '../generated/log.ts'
import { cdnGlossary } from '../generated/cdn.ts'
import { wafGlossary } from '../generated/waf.ts'
import { pspGlossary } from '../generated/psp.ts'
import { autoscalerGlossary } from '../generated/autoscaler.ts'
import { clusterGlossary } from '../generated/cluster.ts'
import { warehouseGlossary } from '../generated/warehouse.ts'
import { vecGlossary } from '../generated/vec.ts'
import { gpuGlossary } from '../generated/gpu.ts'
import { llmGlossary } from '../generated/llm.ts'
import { wideGlossary } from '../generated/wide.ts'
import { dsqlGlossary } from '../generated/dsql.ts'

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
