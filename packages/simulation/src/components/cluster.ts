import { Effect, Schema } from 'effect'
export {
  POD_BURN,
  NOISY_SHARE,
  NOISY_MS,
  POD_RESCHEDULE_SECONDS,
  UPGRADE_CRASHES,
  SUPPORTED_QUARTERS,
  PLATFORM_TAX,
  clusterGlossary,
} from '../generated/cluster.ts'

export const clusterFields = {
  upgradedAt: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
