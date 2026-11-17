export const SIZES = [
  { name: 'nano', vcpu: 0.5, gbps: 0.5 },
  { name: 'micro', vcpu: 1, gbps: 1 },
  { name: 'small', vcpu: 2, gbps: 2 },
  { name: 'medium', vcpu: 4, gbps: 5 },
  { name: 'large', vcpu: 8, gbps: 10 },
  { name: 'xlarge', vcpu: 16, gbps: 12.5 },
  { name: '2xlarge', vcpu: 32, gbps: 25 },
  { name: '4xlarge', vcpu: 64, gbps: 50 },
  { name: 'metal', vcpu: 96, gbps: 100 },
] as const

export const FAMILY_IDS = ['burstable', 'general', 'compute', 'memory', 'arm'] as const
export type FamilyId = (typeof FAMILY_IDS)[number]

export type FamilyDef = Readonly<{
  id: FamilyId
  name: string
  ramPerVcpu: number
  price: number
  blurb: string
}>

export const FAMILIES: Record<FamilyId, FamilyDef> = {
  burstable: {
    id: 'burstable',
    name: 'Burstable',
    ramPerVcpu: 2,
    price: 0.4,
    blurb: 'Cheap. Earns CPU credits while idle and drops to 20% CPU when they run out.',
  },
  general: { id: 'general', name: 'General', ramPerVcpu: 4, price: 1, blurb: '1 vCPU : 4 GB.' },
  compute: { id: 'compute', name: 'Compute', ramPerVcpu: 2, price: 0.85, blurb: '1 vCPU : 2 GB.' },
  memory: { id: 'memory', name: 'Memory', ramPerVcpu: 8, price: 1.3, blurb: '1 vCPU : 8 GB.' },
  arm: {
    id: 'arm',
    name: 'ARM',
    ramPerVcpu: 4,
    price: 0.8,
    blurb: 'Same as General for 20% less. Some runtimes and libraries need work to port.',
  },
}

export const ARM_SPEED = 0.95
export const ARM_RESEARCH = 'arm-instances' as const

export const VCPU_PRICE = 0.05
export const BURST_BASELINE = 0.2
export const CREDIT_CAP = 100
export const OS_RAM = 0.25
export const LOCAL_DB_RAM = 0.6
export const LOCAL_DB_RAM_PER_USER = 0.0015
export const LOCAL_DB_CONTENTION = 1.5
export const MAX_CONNECTIONS = 100
export const POOLER_CONNECTIONS = 20
export const RESTART_SECONDS = 2
export const VM_RESTART_SECONDS = 1
export const OOM_RATIO = 1.25
export const WARMUP_SECONDS = 15
export const HOP_MS = 0.5
export const HANDSHAKE_MS = 1
export const LINK_TIMEOUT = 30
