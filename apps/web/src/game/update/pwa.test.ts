import { describe, expect, test } from 'vitest'
import { Message } from '../message.ts'
import { initialModel, update } from '../update.ts'

/* The PWA slice: the browser's state, the one-time prompt, and the update the player takes. */

const commandsOf = (message: Message): ReadonlyArray<string> =>
  (update(initialModel(), message).commands ?? []).map((command) => command.name)

describe('the PWA state', () => {
  test('a browser event replaces the four flags', () => {
    const before = initialModel()
    const after = update(
      before,
      Message.PwaChanged({
        installable: true,
        installed: false,
        updateReady: true,
        online: false,
      }),
    ).model
    expect(after.pwa).toEqual({
      installable: true,
      installed: false,
      updateReady: true,
      online: false,
    })
    expect(after.board).toBe(before.board)
  })

  test('an accepted install hides the offer and keeps the prompt from coming back', () => {
    const after = update(initialModel(), Message.PwaInstallOutcome({ outcome: 'accepted' })).model
    expect(after.pwa.installed).toBe(true)
    expect(after.pwa.installable).toBe(false)
    expect(after.prefs.pwaPromptSeen).toBe(true)
  })

  test('dismissing the title prompt writes it to the settings', () => {
    const result = update(initialModel(), Message.PwaPromptDismissed())
    expect(result.model.prefs.pwaPromptSeen).toBe(true)
    expect(result.commands?.map((command) => command.name)).toContain('WritePrefs')
  })

  test('the player taking an update asks the worker, and nothing else reloads the page', () => {
    expect(commandsOf(Message.PwaUpdateChosen())).toContain('TakePwaUpdate')
  })

  test('pressing install asks the browser', () => {
    expect(commandsOf(Message.PwaInstallChosen())).toContain('AskPwaInstall')
  })
})
