import { analyticsFields } from '../generated/analytics.ts'
import { serverFields } from '../generated/server.ts'
import { lbFields } from '../generated/lb.ts'
import { pspFields } from '../generated/psp.ts'
import { cdnFields } from '../generated/cdn.ts'
import { cacheFields } from '../generated/cache.ts'
import { databaseFields } from '../generated/database.ts'
import { replicaFields } from '../generated/replica.ts'
import { searchFields } from '../generated/search.ts'
import { storageFields } from '../generated/storage.ts'
import { gwFields } from '../generated/gw.ts'
import { queueFields } from '../generated/queue.ts'
import { clusterFields } from '../generated/cluster.ts'
import { wafFields } from '../generated/waf.ts'
import { ciFields } from '../generated/ci.ts'
import { wsFields } from '../generated/ws.ts'
import { autoscalerFields } from '../generated/autoscaler.ts'
import { gpuFields } from '../generated/gpu.ts'
import { wideFields } from '../generated/wide.ts'
import { docFields } from '../generated/doc.ts'
import { vecFields } from '../generated/vec.ts'
import { logFields } from '../generated/log.ts'
import { poolerFields } from '../generated/pooler.ts'

export const COMPONENT_FIELDS = {
  ...analyticsFields,
  ...serverFields,
  ...lbFields,
  ...pspFields,
  ...cdnFields,
  ...cacheFields,
  ...databaseFields,
  ...replicaFields,
  ...searchFields,
  ...storageFields,
  ...gwFields,
  ...queueFields,
  ...clusterFields,
  ...wafFields,
  ...ciFields,
  ...wsFields,
  ...autoscalerFields,
  ...gpuFields,
  ...wideFields,
  ...docFields,
  ...vecFields,
  ...logFields,
  ...poolerFields,
} as const
