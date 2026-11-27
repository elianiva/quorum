import { Effect, Option, Schema } from 'effect'
import { Locale } from '../i18n/index.ts'

export const TradeoffKind = Schema.Literals(['runtime', 'framework', 'family'])
export type TradeoffKind = typeof TradeoffKind.Type

export const Motion = Schema.Literals(['system', 'reduce'])
export type Motion = typeof Motion.Type

export const TextSize = Schema.Literals(['normal', 'large'])
export type TextSize = typeof TextSize.Type

export const Theme = Schema.Literals(['light', 'dark'])
export type Theme = typeof Theme.Type

export const Prefs = Schema.Struct({
  locale: Locale.pipe(Schema.withDecodingDefaultKey(Effect.succeed('en' as const))),
  seenTradeoffs: Schema.Array(TradeoffKind).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
  muted: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  volume: Schema.Finite.pipe(Schema.withDecodingDefaultKey(Effect.succeed(100))),
  autoPause: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  blurPause: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  easyMode: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  motion: Motion.pipe(Schema.withDecodingDefaultKey(Effect.succeed('system' as const))),
  text: TextSize.pipe(Schema.withDecodingDefaultKey(Effect.succeed('normal' as const))),
  theme: Theme.pipe(Schema.withDecodingDefaultKey(Effect.succeed('light' as const))),
  agentAccess: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
  analytics: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(true))),
  pwaPromptSeen: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
})
export type Prefs = typeof Prefs.Type

export const volumeIn = (volume: number): number => Math.min(100, Math.max(0, volume))

const readableFields = (saved: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(Prefs.fields)
      .filter(
        ([key, field]) =>
          key in saved &&
          Option.isSome(Schema.decodeUnknownOption(Schema.Struct({ [key]: field }))(saved)),
      )
      .map(([key]) => [key, saved[key]]),
  )

/** Reads only the keys this build knows, so an older or newer file still opens. */
export const parsePrefs = (json: string) =>
  Option.flatMap(
    Schema.decodeOption(Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)))(json),
    (saved) =>
      Option.map(Schema.decodeOption(Prefs)(readableFields(saved)), (prefs) => ({
        ...prefs,
        volume: volumeIn(prefs.volume),
      })),
  )
