import { Command } from '@effect/ui'
import { Effect } from 'effect'
import { loadFounder, loadPassed, loadPrefs, loadSaves, today } from './data.ts'
import { TitleMessage } from './messages.ts'

export const LoadSaves = Command.make('LoadSaves', {}, () =>
  Effect.sync(() => TitleMessage.SavesLoaded({ index: loadSaves() })),
)

export const LoadFounder = Command.make('LoadFounder', {}, () =>
  Effect.sync(() => TitleMessage.FounderLoaded({ founder: loadFounder(), today: today() })),
)

export const LoadPrefs = Command.make('LoadPrefs', {}, () =>
  Effect.sync(() => TitleMessage.PrefsLoaded({ prefs: loadPrefs() })),
)

export const LoadSandbox = Command.make('LoadSandbox', {}, () =>
  Effect.sync(() => TitleMessage.SandboxLoaded({ passed: loadPassed() })),
)
