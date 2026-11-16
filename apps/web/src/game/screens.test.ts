import { describe, test } from 'vitest'
import { Lazy } from 'foldkit/test'
import { newGame } from '@quorum/simulation/company'
import { Message } from './message.ts'
import type { Model } from './model.ts'
import { AppRoute } from './route.ts'
import { labScreen } from './screens.ts'
import { initialModel, update } from './update.ts'

/** A Company that ran for a minute, so the Dashboard has history to draw. */
const played = (panel: Model['panel']): Model => {
  const fresh = initialModel()
  let model: Model = {
    ...fresh,
    route: AppRoute.Company(),
    board: { ...fresh.board, game: newGame() },
  }
  for (let tick = 0; tick < 240; tick += 1)
    model = update(model, Message.Ticked({ elapsedMs: 250 })).model
  return { ...model, panel }
}

// A memoized view that receives a fresh object on every render never hits its cache, and
// nothing on screen shows it. These fail when a lazy view's arguments stop being stable.
describe('memoized views', () => {
  test('the Dashboard reuses its gauges, rows, and timelines for an unchanged Model', () => {
    Lazy.expectAllReused({ view: labScreen, model: played('dashboard') })
  })

  test('the Research tree reuses its items for an unchanged Model', () => {
    Lazy.expectAllReused({ view: labScreen, model: played('research') })
  })
})
