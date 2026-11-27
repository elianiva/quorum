import { Router } from '@effect/ui'
import { Story } from '@effect/ui/testing'
import { newGame } from '@quorum/simulation/company'
import { emptyFounder } from '@quorum/simulation/founder'
import { Effect, Schema } from 'effect'
import { expect, it } from 'vitest'
import { Prefs } from '../../game/prefs-schema.ts'
import { fileFor, type SaveIndex } from '../../game/saves.ts'
import { savesOf } from '../../game/saves-machine.ts'
import {
  LoadCompany,
  LoadFounder,
  LoadPassed,
  LoadPrefs,
  LoadSaves,
  StartCompany,
  WriteFounder,
} from './commands.ts'
import { TitleMessage } from './messages.ts'
import { TitlePage } from './TitlePage.ts'
import type { CurrentCompany } from './model.ts'
import { AppRoute } from '../routes.ts'

const emptyPrefs = () => Schema.decodeSync(Prefs)({})

it('carries the founding choices into the save', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const story = yield* Story.make(TitlePage, { menu: 'found' })

        story
          .resolve(
            LoadSaves,
            TitleMessage.SavesLoaded({ index: { lastPlayed: null, companies: [] } }),
          )
          .resolve(
            LoadFounder,
            TitleMessage.FounderLoaded({ founder: emptyFounder(), today: '2026-11-27' }),
          )
          .resolve(LoadPrefs, TitleMessage.PrefsLoaded({ prefs: emptyPrefs() }))
          .resolve(LoadPassed, TitleMessage.SandboxLoaded({ passed: [] }))

        story
          .send(TitleMessage.CompanyNameChanged({ name: 'Acme' }))
          .send(TitleMessage.LogoChosen({ logo: 'bolt' }))
          .send(TitleMessage.FoundStepChosen({ step: 'venture' }))
          .send(TitleMessage.VentureChosen({ id: 'e-commerce' }))
          .resolve(WriteFounder, TitleMessage.Synced())
          .send(TitleMessage.FoundStepChosen({ step: 'mutators' }))
          .send(TitleMessage.MutatorToggled({ id: 'chaos-monkey' }))
          .resolve(WriteFounder, TitleMessage.Synced())
          .send(TitleMessage.CompanyFounded())

        const issued = story.pending.find((entry) => entry.command.name === 'StartCompany')
        expect(issued).toBeDefined()
        const args = issued!.command.args as Readonly<{
          index: SaveIndex
          founder: ReturnType<typeof emptyFounder>
          current: CurrentCompany
        }>

        expect(args.founder).toMatchObject({
          venture: 'e-commerce',
          chosen: ['chaos-monkey'],
        })
        expect(args.index.companies).toHaveLength(1)
        expect(args.index.companies[0]).toMatchObject({
          name: 'Acme',
          logo: 'bolt',
          venture: 'e-commerce',
          mutators: ['chaos-monkey'],
        })
        expect(args.current).toMatchObject({ name: 'Acme', logo: 'bolt' })

        story.resolve(
          StartCompany,
          TitleMessage.CompanyStarted({ index: args.index, current: args.current }),
        )
        story.resolve(Router.push(AppRoute, AppRoute.Company()), 'navigated')

        expect(story.model.foundStep).toBe('company')
        expect(story.model.draft).toEqual({ name: '', logo: 'bolt' })
        expect(story.model.current?.name).toBe('Acme')
        expect(savesOf(story.model.saves).companies[0]).toMatchObject({
          name: 'Acme',
          venture: 'e-commerce',
          mutators: ['chaos-monkey'],
        })
      }),
    ),
  )
})

it('loads the last played company before continuing into it', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const game = newGame(42)
        const file = fileFor({
          id: 'company-42',
          name: 'Orbit Labs',
          logo: 'orbit',
          founding: game.founding,
          game,
          now: 1_000,
        })
        const index: SaveIndex = { lastPlayed: file.id, companies: [file] }
        const story = yield* Story.make(TitlePage, { menu: 'main' })

        story
          .resolve(LoadSaves, TitleMessage.SavesLoaded({ index }))
          .resolve(
            LoadFounder,
            TitleMessage.FounderLoaded({ founder: emptyFounder(), today: '2026-11-27' }),
          )
          .resolve(LoadPrefs, TitleMessage.PrefsLoaded({ prefs: emptyPrefs() }))
          .resolve(LoadPassed, TitleMessage.SandboxLoaded({ passed: [] }))
          .resolve(
            LoadCompany,
            TitleMessage.CompanyLoaded({ id: file.id, open: false, game, index }),
          )

        expect(story.model.current).toMatchObject({
          id: file.id,
          name: 'Orbit Labs',
          seed: game.seed,
        })

        story.send(TitleMessage.Continued())
        story.resolve(
          LoadCompany,
          TitleMessage.CompanyLoaded({
            id: file.id,
            open: true,
            game,
            index: { ...index, lastPlayed: file.id },
          }),
        )
        story.resolve(Router.push(AppRoute, AppRoute.Company()), 'navigated')

        expect(story.model.current?.id).toBe(file.id)
        expect(savesOf(story.model.saves).lastPlayed).toBe(file.id)
      }),
    ),
  )
})
