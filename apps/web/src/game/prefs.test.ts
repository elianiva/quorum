import { describe, expect, test } from 'vitest'
import { Option, Schema } from 'effect'
import { Prefs, type Model } from './model.ts'
import { PrefsMessage } from './prefs.ts'
import { applySettings } from './commands.ts'
import { initialModel, update } from './update.ts'
import { Message } from './message.ts'
import { AppRoute } from './route.ts'
import { parsePrefs } from './prefs-schema.ts'

type Named = Readonly<{ name: string; args: Record<string, unknown> }>

const named = (model: Model, message: Message): ReadonlyArray<Named> =>
  ((update(model, message) as { commands?: ReadonlyArray<unknown> }).commands ??
    []) as ReadonlyArray<Named>

const rootOf = (): HTMLElement => {
  const classes = new Set<string>()
  return {
    dataset: {},
    lang: '',
    classList: {
      contains: (name: string) => classes.has(name),
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name), on),
    },
  } as unknown as HTMLElement
}

const baseSettings = {
  muted: false,
  volume: 100,
  motion: 'system' as const,
  locale: 'en' as const,
  agentAccess: false,
  analytics: true,
  text: 'normal' as const,
  theme: 'light' as const,
}

describe('text at 150%', () => {
  test('the switch sets the pref, which is saved and applied like motion', () => {
    const start = initialModel()
    const large = update(start, Message.PrefsChanged({ message: PrefsMessage.TextToggled() }))
    expect(large.model.prefs.text).toBe('large')
    expect(large.model.board.game).toBe(start.board.game)
    const write = named(start, Message.PrefsChanged({ message: PrefsMessage.TextToggled() })).find(
      (command) => command.name === 'WritePrefs',
    )
    expect(write?.args['prefs']).toMatchObject({ text: 'large' })
    const apply = named(start, Message.PrefsChanged({ message: PrefsMessage.TextToggled() })).find(
      (command) => command.name === 'ApplySettings',
    )
    expect(apply?.args).toMatchObject({ text: 'large' })
    expect(
      update(large.model, Message.PrefsChanged({ message: PrefsMessage.TextToggled() })).model.prefs
        .text,
    ).toBe('normal')
  })

  test('applying it marks the root, and clears the mark when it is off', () => {
    const root = rootOf()
    const settings = baseSettings
    applySettings(root, { ...settings, text: 'large' })
    expect(root.dataset['text']).toBe('150')
    applySettings(root, { ...settings, text: 'normal' })
    expect(root.dataset['text']).toBeUndefined()
    applySettings(root, { ...settings, motion: 'reduce', locale: 'fr', text: 'large' })
    expect(root.dataset['motion']).toBe('reduce')
    expect(root.lang).toBe('fr')
  })

  test('preferences saved before it existed read at their own size', () => {
    expect(Schema.decodeSync(Prefs)({ muted: true, motion: 'reduce' })).toMatchObject({
      text: 'normal',
    })
    const restored = update(
      initialModel(),
      Message.PrefsLoaded({ json: JSON.stringify({ muted: true, motion: 'reduce' }) }),
    )
    expect(restored.model.prefs.text).toBe('normal')
  })
})

describe('dark mode', () => {
  test('the switch flips the theme, which is saved and applied', () => {
    const start = initialModel()
    expect(start.prefs.theme).toBe('light')
    const result = update(start, Message.PrefsChanged({ message: PrefsMessage.ThemeToggled() }))
    expect(result.model.prefs.theme).toBe('dark')
    const commands = (result.commands ?? []) as ReadonlyArray<Named>
    expect(commands.find((command) => command.name === 'WritePrefs')?.args['prefs']).toMatchObject({
      theme: 'dark',
    })
    expect(commands.find((command) => command.name === 'ApplySettings')?.args).toMatchObject({
      theme: 'dark',
    })
    expect(
      update(result.model, Message.PrefsChanged({ message: PrefsMessage.ThemeToggled() })).model
        .prefs.theme,
    ).toBe('light')
  })

  test('applying it puts `.dark` on the root, and takes it off for light', () => {
    const root = rootOf()
    applySettings(root, { ...baseSettings, theme: 'dark' })
    expect(root.classList.contains('dark')).toBe(true)
    applySettings(root, { ...baseSettings, theme: 'light' })
    expect(root.classList.contains('dark')).toBe(false)
  })

  test('preferences saved before it existed read as light', () => {
    expect(Schema.decodeSync(Prefs)({ muted: true }).theme).toBe('light')
  })
})

describe('volume', () => {
  const atBoard: Model = { ...initialModel(), route: AppRoute.Company() }
  const slideTo = (model: Model, volume: number) =>
    update(model, Message.PrefsChanged({ message: PrefsMessage.VolumeChanged({ volume }) })).model

  test('the level stays between silent and the mastered mix', () => {
    expect(slideTo(initialModel(), 40).prefs.volume).toBe(40)
    expect(slideTo(initialModel(), 140).prefs.volume).toBe(100)
    expect(slideTo(initialModel(), -20).prefs.volume).toBe(0)
  })

  test('it is saved and applied to the page beside Mute sound', () => {
    const result = update(
      atBoard,
      Message.PrefsChanged({ message: PrefsMessage.VolumeChanged({ volume: 40 }) }),
    )
    const commands = (result.commands ?? []) as ReadonlyArray<Named>
    expect(commands.find((command) => command.name === 'WritePrefs')?.args['prefs']).toMatchObject({
      volume: 40,
    })
    expect(commands.find((command) => command.name === 'ApplySettings')?.args).toMatchObject({
      volume: 40,
    })
  })

  test('preferences saved before it existed play at full level', () => {
    expect(Schema.decodeSync(Prefs)({ muted: true }).volume).toBe(100)
  })

  test('a saved level outside the range reads inside it', () => {
    expect(Option.getOrThrow(parsePrefs(JSON.stringify({ volume: 900 }))).volume).toBe(100)
  })

  test('one unreadable saved setting does not reset the others', () => {
    const saved = JSON.stringify({ easyMode: true, locale: 'xx', seenTradeoffs: ['gone'] })
    const prefs = Option.getOrThrow(parsePrefs(saved))
    expect(prefs.easyMode).toBe(true)
    expect(prefs.locale).toBe('en')
    expect(prefs.seenTradeoffs).toEqual([])
  })
})
