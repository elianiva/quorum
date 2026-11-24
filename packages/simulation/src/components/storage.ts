import { Effect, Schema } from 'effect'

export const STORAGE_PRICE = 0.000032

export const STORAGE_CLASSES = {
  standard: { name: 'Standard', price: 1, retrieval: 0, archived: false },
  infrequent: { name: 'Infrequent access', price: 0.5, retrieval: 0.01, archived: false },
  archive: { name: 'Archive', price: 0.1, retrieval: 0, archived: true },
} as const

export const LIFECYCLE_DAYS = [0, 30, 90, 365] as const

export const R2_FIRST_BYTE_MS = 15
export const STORE_VARIANTS = {
  s3: { name: 'S3', egress: true, get: 0.00048, put: 0.006 },
  r2: { name: 'R2', egress: false, get: 0.000432, put: 0.0054 },
} as const

export const storageGlossary: ReadonlyArray<string> = ['object-storage']

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
