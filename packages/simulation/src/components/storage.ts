import { Effect, Schema } from 'effect'
export {
  STORAGE_PRICE,
  STORAGE_CLASSES,
  LIFECYCLE_DAYS,
  R2_FIRST_BYTE_MS,
  STORE_VARIANTS,
  storageGlossary,
} from '../generated/storage.ts'

export const StorageClass = Schema.Literals(['standard', 'infrequent', 'archive'])
export type StorageClass = typeof StorageClass.Type

export const StoreVariant = Schema.Literals(['s3', 'r2'])
export type StoreVariant = typeof StoreVariant.Type

export const storageFields = {
  storeVariant: StoreVariant.pipe(Schema.withDecodingDefaultKey(Effect.succeed('s3' as const))),
  storageClass: StorageClass.pipe(
    Schema.withDecodingDefaultKey(Effect.succeed('standard' as const)),
  ),
  lifecycle: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
} as const
