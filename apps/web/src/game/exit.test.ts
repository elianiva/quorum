import { describe, expect, test } from 'vitest'
import { Scene } from 'foldkit/test'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { newGame } from '@quorum/simulation/company'
import { DEFAULT_FOUNDING } from '@quorum/simulation/state'
import type { HistoryRow } from '@quorum/simulation/exit'
import { exitScreen } from '../components/lab/legacy.ts'
import { copyIn } from '../i18n/messages.ts'
import { AppRoute } from './route.ts'
import { Message } from './message.ts'
import { initialModel, update } from './update.ts'
import type { Model } from './model.ts'

const row: HistoryRow = {
  name: 'Exited Co',
  exit: 'acquisition',
  founding: DEFAULT_FOUNDING,
  time: 600,
  peak: 1_000,
  stage: 4,
  payout: 10_000_000,
  legacy: 100,
  stack: [],
  snapshot: { nodes: [], links: [] },
}

const exited = (): Model => {
  const base = initialModel()
  return {
    ...base,
    route: AppRoute.Company(),
    companyPhase: { _tag: 'Exited', id: 'c1', row, researched: [] },
    panel: 'exited',
    board: { ...base.board, game: newGame() },
  }
}

const view = (model: Model, h: HtmlBuilder<Message>): Html => exitScreen(model, h)

describe('the exit screen', () => {
  test('shows the survey and a Venture for the next Company', () => {
    const t = copyIn('en')
    Scene.scene(
      { update, view },
      Scene.given(exited()),
      Scene.expect(Scene.text(t.survey.title)).toExist(),
      Scene.expect(Scene.role('combobox', { name: t.legacy.nextVenture })).toExist(),
    )
  })

  test('the Venture field sets the next Company Venture', () => {
    const next = update(exited(), Message.VentureChosen({ id: 'fintech' })).model
    expect(next.founder.venture).toBe('fintech')
  })
})
