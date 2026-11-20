import { describe, expect, test } from 'vitest'
import { copyIn } from '../../i18n/messages.ts'
import { Message } from '../message.ts'
import { initialModel, update } from '../update.ts'

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
        online: false,
        updated: false,
      }),
    ).model
    expect(after.pwa).toEqual({
      install: { _tag: 'Installable' },
      online: false,
      updated: false,
    })
    expect(after.board).toBe(before.board)
  })

  test('the first snapshot after a deploy says that Quorum updated, and the next one is quiet', () => {
    const before = initialModel()
    const changed = Message.PwaChanged({
      installable: false,
      installed: true,
      online: true,
      updated: true,
    })
    const after = update(before, changed)
    expect(after.model.toast?.message).toBe(copyIn('en').pwa.updated)
    const again = update(after.model, changed)
    expect(again.model.toast).toBe(after.model.toast)
  })

  test('an accepted install hides the offer and keeps the prompt from coming back', () => {
    const after = update(initialModel(), Message.PwaInstallOutcome({ outcome: 'accepted' })).model
    expect(after.pwa.install._tag).toBe('Installed')
    expect(after.prefs.pwaPromptSeen).toBe(true)
  })

  test('dismissing the title prompt writes it to the settings', () => {
    const result = update(initialModel(), Message.PwaPromptDismissed())
    expect(result.model.prefs.pwaPromptSeen).toBe(true)
    expect(result.commands?.map((command) => command.name)).toContain('WritePrefs')
  })

  test('pressing install asks the browser', () => {
    expect(commandsOf(Message.PwaInstallChosen())).toContain('AskPwaInstall')
  })
})
