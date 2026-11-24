import type { RequestKind } from './kinds.ts'
import type { ResearchId } from './research.ts'
export {
  LANGUAGE_IDS,
  BLAST_FACTOR,
  LANGUAGES,
  RUNTIME_IDS,
  AXES,
  RUNTIMES,
  APACHE_MAX_WORKERS,
  APACHE_SPARE,
  OPCACHE_SPEED,
  YJIT_SPEED,
  YJIT_MEMORY,
  JEMALLOC_SPEED,
  JEMALLOC_MEMORY,
  PHP_JIT_SPEED,
  PHP_JIT_HEAVY,
  NIF_SPEED,
  CPU_HEAVY_KINDS,
  WORKER_THREADS,
  WORKER_THREAD_MB,
  JVM_INSIGHT,
  RECYCLE_CYCLE_SECONDS,
  LIBUV_THREADS,
  LIBUV_THREAD_MB,
  SPAWN_BLOCKING_THREADS,
  SPAWN_BLOCKING_THREAD_MB,
  ML_AI_BONUS,
  ELIXIR_HOT_UPGRADE_DEV_HOURS,
  SIM_SECONDS_PER_DEV_HOUR,
  POOL_LIMITS,
  DEFAULT_FPM_WORKERS,
  FRAMEWORK_IDS,
  FRAMEWORKS,
  COLLECTORS,
  GOGC,
  ORM_READS,
  PM_MODES,
  BEAM_CRASHES_PER_REQUESTS,
  LET_IT_CRASH,
} from '../generated/runtimes.ts'
import { LANGUAGE_IDS, RUNTIME_IDS, AXES, FRAMEWORK_IDS } from '../generated/runtimes.ts'

export type LanguageId = (typeof LANGUAGE_IDS)[number]

export type LanguageDef = Readonly<{
  id: LanguageId
  name: string
  velocity: number
  salary: number
  hireTime: number
  buildMinutes: number
  sessionKB: number
  armSpeed: number
  armPortDh: number
  blast: 'request' | 'whole' | 'task'
}>

export type RuntimeId = (typeof RUNTIME_IDS)[number]

export type ConcurrencyModel = 'process' | 'threads' | 'loop' | 'green' | 'async'

export type Axis = (typeof AXES)[number]
export type Axes = Readonly<Record<Axis, 1 | 2 | 3 | 4 | 5>>

export type RuntimeDef = Readonly<{
  id: RuntimeId
  axes: Axes
  glossary: ReadonlyArray<string>
  language: LanguageId
  name: string
  model: ConcurrencyModel
  speed: number
  memoryMb: number
  pool: boolean
  threads: number
  connections: number
  persistent: boolean
  startupSeconds: number
  warmFrom: number
  warmup: number
  parallel: boolean
  blocking: 'loop' | 'worker' | null
  gc: Readonly<{ pauseMs: number; cpu: number }> | null
  connectionKB: number | null
  overheadFactor?: number
  velocity?: number
  hotReload?: boolean
  build?: number
  research: ResearchId | null
  blurb: string
}>

export type FrameworkId = (typeof FRAMEWORK_IDS)[number]

export type FrameworkDef = Readonly<{
  id: FrameworkId
  axes: Axes
  glossary: ReadonlyArray<string>
  name: string
  language: LanguageId | null
  overhead: number
  cpu?: Partial<Record<RequestKind, number>>
  asgi?: boolean
  velocity: number
  memoryMb: number
  orm: boolean
  value: Partial<Record<RequestKind, number>>
  startupSeconds: number
  workerOverhead?: number
  coordination?: number
  debt?: number
  nativeBuild?: number
  cacheable?: number
  internalTools?: number
  workerHours?: number
  blurb: string
}>
