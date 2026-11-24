import { Effect, Schema } from 'effect'

export const POD_BURN = 0.85
export const NOISY_SHARE = 0.01
export const NOISY_MS = 10

export const POD_RESCHEDULE_SECONDS = 30
export const UPGRADE_CRASHES = 0.3
export const SUPPORTED_QUARTERS = 1
export const PLATFORM_TAX = 0.5

export const clusterGlossary: ReadonlyArray<string> = ['cold-start', 'container-orchestration']

export const clusterFields = {
  upgradedAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
