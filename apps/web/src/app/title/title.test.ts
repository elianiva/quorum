import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { EMPTY_SAVE_INDEX } from '../../game/saves.ts'
import { LoadFounder, LoadPrefs, LoadSandbox, LoadSaves } from './commands.ts'
import { loadFounder, loadPassed, loadPrefs, loadSaves } from './data.ts'

const run = async (command: { effect?: Effect.Effect<unknown> | undefined }) => {
  if (command.effect === undefined) throw new Error('the command has no effect')
  return Effect.runPromise(command.effect)
}

describe('title data', () => {
  it('starts from empty saves, no sandboxes, and default preferences', () => {
    expect(loadSaves()).toEqual(EMPTY_SAVE_INDEX)
    expect(loadPassed()).toEqual([])
    expect(loadPrefs()).toMatchObject({ locale: 'en', volume: 100, theme: 'light' })
  })

  it('gives a new founder a device id', () => {
    expect(loadFounder().deviceId).toMatch(/^[0-9a-f]{32}$/)
  })

  it('reports what each load found', async () => {
    expect(await run(LoadSaves.make())).toMatchObject({
      _tag: 'SavesLoaded',
      index: EMPTY_SAVE_INDEX,
    })
    expect(await run(LoadFounder.make())).toMatchObject({ _tag: 'FounderLoaded' })
    expect(await run(LoadPrefs.make())).toMatchObject({
      _tag: 'PrefsLoaded',
      prefs: { locale: 'en' },
    })
    expect(await run(LoadSandbox.make())).toMatchObject({ _tag: 'SandboxLoaded', passed: [] })
  })
})
