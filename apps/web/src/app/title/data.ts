import { Founder, emptyFounder } from '@quorum/simulation/founder'
import { Option, Schema } from 'effect'
import { parsePrefs, Prefs } from '../../game/prefs-schema.ts'
import { EMPTY_SAVE_INDEX, parseIndex } from '../../game/saves.ts'
import { SandboxId as SandboxIdSchema } from '../../game/session-machine.ts'
import {
  FOUNDER_KEY,
  PREFS_KEY,
  SANDBOX_KEY,
  SAVE_INDEX_KEY,
  readStored,
} from '../../game/storage.ts'

type SandboxId = typeof SandboxIdSchema.Type

const decodeFounder = Schema.decodeUnknownOption(Schema.fromJsonString(Founder))
const decodeSandbox = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ passed: Schema.Array(SandboxIdSchema) })),
)

export const today = (): string => new Date().toISOString().slice(0, 10)

const newDeviceId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

export const loadSaves = () =>
  Option.getOrElse(
    Option.map(parseIndex(readStored(SAVE_INDEX_KEY) ?? ''), (read) => read.index),
    () => EMPTY_SAVE_INDEX,
  )

export const loadFounder = (): Founder => {
  const stored = readStored(FOUNDER_KEY)
  const founder = Option.getOrElse(
    stored === null ? Option.none() : decodeFounder(stored),
    emptyFounder,
  )
  return founder.deviceId === '' ? { ...founder, deviceId: newDeviceId() } : founder
}

export const loadPrefs = (): Prefs => {
  const stored = readStored(PREFS_KEY)
  const fallback = () => Schema.decodeSync(Prefs)({})
  return stored === null ? fallback() : Option.getOrElse(parsePrefs(stored), fallback)
}

export const loadPassed = (): ReadonlyArray<SandboxId> => {
  const stored = readStored(SANDBOX_KEY)
  const decoded =
    stored === null ? Option.none<{ passed: ReadonlyArray<SandboxId> }>() : decodeSandbox(stored)
  return Option.getOrElse(
    Option.map(decoded, (value) => value.passed),
    () => [] as ReadonlyArray<SandboxId>,
  )
}
