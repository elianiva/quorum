import { Story } from '@effect/ui/testing'
import { Effect } from 'effect'
import { expect, it } from 'vitest'
import { App, AppMessage, RevealTitle } from './App.ts'
import { AppRoute } from './routes.ts'

it('clocking in holds the title for one beat, then reveals it', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const story = yield* Story.make(App, { route: AppRoute.Title() })

        story.send(AppMessage.ClockedIn()).expectExact(RevealTitle)
        expect(story.model.boot._tag).toBe('Clocking')

        story.resolve(RevealTitle, AppMessage.TitleRevealed())
        expect(story.model.boot._tag).toBe('Ready')
      }),
    ),
  )
})
