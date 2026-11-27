import { Router } from '@effect/ui'
import { HtmlLocator, HtmlPlay } from '@effect/ui/html/testing'
import { Locator, TestHost } from '@effect/ui/testing'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import { expect, it } from 'vitest'
import { App } from './App.ts'
import { AppRoute } from './routes.ts'

const testLayers = Layer.mergeAll(
  TestClock.layer(),
  Router.memory({ routes: AppRoute, url: '/' }),
).pipe(Layer.provideMerge(TestHost.layer()))

it('boots into the title and founds a company through the wizard', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const play = yield* HtmlPlay.make(App, { route: AppRoute.Title() })

        yield* play.click(HtmlLocator.role('button', { name: 'Clock in' }))
        yield* TestClock.adjust('900 millis')
        yield* play.expect(Locator.text('Start a company')).toExist()

        yield* play.click(HtmlLocator.role('button', { name: 'Start a company' }))
        yield* play.expect(Locator.text('Company name')).toExist()
        yield* play.type(HtmlLocator.label('Company name'), 'Acme')

        yield* play.click(Locator.attr('data-key', 'next'))
        yield* play.click(Locator.attr('data-key', 'e-commerce'))
        yield* play.click(Locator.attr('data-key', 'next'))

        yield* play.click(Locator.attr('data-key', 'chaos-monkey'))
        yield* play.expect(Locator.text('Chaos Monkey')).toExist()
        yield* play.expect(Locator.text('Found Acme')).toExist()

        expect(play.root.text()).toContain('E-commerce')
      }),
    ).pipe(Effect.provide(testLayers)),
  )
})
