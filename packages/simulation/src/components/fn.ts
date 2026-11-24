import type { LanguageId } from '../catalog/runtimes.ts'

export const SERVERLESS_REQUEST_PRICE = 0.00024
export const SERVERLESS_GB_SECOND = 0.02
export const SERVERLESS_MEMORY_GB = 1
export const SERVERLESS_CONCURRENCY = 1_000
export const SERVERLESS_IDLE_SECONDS = 5
export const COLD_START_MS: Record<LanguageId, number> = {
  go: 50,
  rust: 50,
  zig: 50,
  haskell: 100,
  node: 200,
  python: 200,
  php: 200,
  ruby: 300,
  csharp: 500,
  elixir: 500,
  java: 2_000,
}
export const NATIVE_COLD_MS = 100
export const FUNCTION_LIMIT_MS = 900_000
export const EXPORT_MS_PER_GB = 4_000

export const SERVERLESS_MS = 1
