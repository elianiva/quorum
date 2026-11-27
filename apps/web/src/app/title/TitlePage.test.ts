import { Story } from '@effect/ui/testing'
import { Effect } from 'effect'
import { expect, it } from 'vitest'
import { EMPTY_SAVE_INDEX } from '../../game/saves.ts'
import { LoadFounder, LoadPrefs, LoadSandbox, LoadSaves } from './commands.ts'
import { TitleMessage } from './messages.ts'
import { TitlePage } from './TitlePage.ts'

it('starts from the four stored loads', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const story = yield* Story.make(TitlePage, {})

        story.resolve(LoadSaves, TitleMessage.SavesLoaded({ index: EMPTY_SAVE_INDEX }))
        story.resolve(
          LoadPrefs,
          TitleMessage.PrefsLoaded({
            prefs: {
              locale: 'en',
              seenTradeoffs: [],
              muted: false,
              volume: 100,
              autoPause: false,
              blurPause: true,
              easyMode: false,
              motion: 'system',
              text: 'normal',
              theme: 'light',
              agentAccess: false,
              analytics: true,
              pwaPromptSeen: false,
            },
          }),
        )
        story.resolve(LoadSandbox, TitleMessage.SandboxLoaded({ passed: [] }))
        story.resolve(
          LoadFounder,
          TitleMessage.FounderLoaded({
            founder: {
              legacy: 0,
              earned: 0,
              perks: {},
              venture: 'b2b-saas',
              chosen: [],
              keep: [],
              playbooks: [],
              history: [],
              erasReached: [],
              completed: [],
              deviceId: 'test',
              achievements: [],
              stats: { postmortems: 0, terminations: 0, fallacies: [] },
            },
            today: '2026-11-27',
          }),
        )

        expect(story.model.saves).toEqual({ _tag: 'Ready', index: EMPTY_SAVE_INDEX })
        expect(story.model.passed).toEqual([])
        expect(story.model.founder.deviceId).toBe('test')
      }),
    ),
  )
})
