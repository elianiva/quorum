export {
  SIZES,
  FAMILY_IDS,
  FAMILIES,
  ARM_RESEARCH,
  VCPU_PRICE,
  BURST_BASELINE,
  CREDIT_CAP,
  OS_RAM,
  LOCAL_DB_RAM,
  LOCAL_DB_RAM_PER_USER,
  LOCAL_DB_CONTENTION,
  MAX_CONNECTIONS,
  POOLER_CONNECTIONS,
  RESTART_SECONDS,
  VM_RESTART_SECONDS,
  OOM_RATIO,
  WARMUP_SECONDS,
  HOP_MS,
  HANDSHAKE_MS,
  LINK_TIMEOUT,
  ACTIVE_USERS_PER_RPS,
  SHED_FROM,
  SHED_TO,
  PREFETCH_TASK_MB,
  IO_PER_WRITE,
  IO_PER_TX,
  IO_PER_SCAN,
  IO_PER_SPILLED_READ,
} from '../generated/instances.ts'
import { FAMILY_IDS } from '../generated/instances.ts'

export type FamilyId = (typeof FAMILY_IDS)[number]

export type FamilyDef = Readonly<{
  id: FamilyId
  name: string
  ramPerVcpu: number
  price: number
  blurb: string
}>
