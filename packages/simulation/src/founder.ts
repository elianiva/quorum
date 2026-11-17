import { Effect, Result, Schema } from 'effect'
import {
  ACHIEVEMENT_IDS,
  FALLACY_IDS,
  MUTATOR_IDS,
  PERKS,
  PLAYBOOK_SLOTS,
  type AchievementId,
  type MutatorId,
  type PerkId,
  type ResearchId,
  type VentureId,
} from './catalog.ts'
import { Refusal } from './actions.ts'
import { HistoryRow, type ExitResult } from './exit.ts'
import { Playbook } from './playbook.ts'
import {
  MutatorId as MutatorSchema,
  ResearchId as ResearchSchema,
  VentureId as VentureSchema,
  type Founding,
} from './state.ts'

const withDefault = <S extends Schema.Top>(schema: S, value: S['Type']) =>
  schema.pipe(Schema.withDecodingDefaultKey(Effect.succeed(value)))

export const Founder = Schema.Struct({
  legacy: withDefault(Schema.Finite, 0),
  earned: withDefault(Schema.Finite, 0),
  perks: withDefault(Schema.Record(Schema.String, Schema.Finite), {}),
  venture: withDefault(VentureSchema, 'b2b-saas'),
  chosen: withDefault(Schema.Array(MutatorSchema), []),
  keep: withDefault(Schema.Array(ResearchSchema), []),
  playbooks: withDefault(Schema.Array(Playbook), []),
  history: withDefault(Schema.Array(HistoryRow), []),
  erasReached: withDefault(Schema.Array(Schema.Finite), []),
  completed: withDefault(Schema.Array(Schema.String), []),
  deviceId: withDefault(Schema.String, ''),
  achievements: withDefault(Schema.Array(Schema.Literals(ACHIEVEMENT_IDS)), []),
  stats: withDefault(
    Schema.Struct({
      postmortems: Schema.Finite,
      terminations: Schema.Finite,
      fallacies: Schema.Array(Schema.Literals(FALLACY_IDS)).pipe(
        Schema.withDecodingDefaultKey(Effect.succeed([])),
      ),
    }),
    { postmortems: 0, terminations: 0, fallacies: [] },
  ),
})
export type Founder = typeof Founder.Type

export const emptyFounder = (): Founder => Schema.decodeSync(Founder)({})

type Change = Result.Result<Founder, Refusal>
const ok = (founder: Founder): Change => Result.succeed(founder)
const no = (reason: string): Change => Result.fail(Refusal.NotAllowed({ reason }))

export const levelOf = (founder: Founder, id: PerkId): number => founder.perks[id] ?? 0

export const perkPrice = (founder: Founder, id: PerkId): number | null =>
  PERKS[id].costs[levelOf(founder, id)] ?? null

export const buyPerk = (founder: Founder, id: PerkId): Change => {
  const price = perkPrice(founder, id)
  if (price === null) return no(`${PERKS[id].name} is at its top level.`)
  if (founder.legacy < price) return no(`${PERKS[id].name} needs ${price} Legacy.`)
  return ok({
    ...founder,
    legacy: founder.legacy - price,
    perks: { ...founder.perks, [id]: levelOf(founder, id) + 1 },
  })
}

export const chooseVenture = (founder: Founder, id: VentureId): Change =>
  founder.venture === id ? ok(founder) : ok({ ...founder, venture: id })

export const toggleMutator = (founder: Founder, id: MutatorId): Change =>
  ok({
    ...founder,
    chosen: founder.chosen.includes(id)
      ? founder.chosen.filter((entry) => entry !== id)
      : [...founder.chosen, id],
  })

export const keepSlots = (founder: Founder): number => levelOf(founder, 'institutional-knowledge')

export const toggleKeep = (founder: Founder, id: ResearchId): Change => {
  if (founder.keep.includes(id))
    return ok({ ...founder, keep: founder.keep.filter((x) => x !== id) })
  if (founder.keep.length >= keepSlots(founder))
    return no(
      keepSlots(founder) === 0
        ? 'Institutional knowledge keeps research through an Exit.'
        : `Keep at most ${keepSlots(founder)}.`,
    )
  return ok({ ...founder, keep: [...founder.keep, id] })
}

export const recordExit = (founder: Founder, result: ExitResult): Founder => ({
  ...founder,
  legacy: founder.legacy + result.legacy,
  earned: founder.earned + result.legacy,
  history: [...founder.history, result.row],
  keep: [],
})

export const earnAchievements = (founder: Founder, ids: ReadonlyArray<AchievementId>): Founder => {
  const fresh = ids.filter((id, at) => !founder.achievements.includes(id) && ids.indexOf(id) === at)
  if (fresh.length === 0) return founder
  return { ...founder, achievements: [...founder.achievements, ...fresh] }
}

export const foundingOf = (founder: Founder): Founding => ({
  venture: founder.venture,
  mutators: founder.chosen.filter((id) => MUTATOR_IDS.includes(id)),
  perks: founder.perks,
})

export const founded = (founder: Founder): Founder => ({ ...founder, keep: [] })

export const playbookSlots = (founder: Founder): number =>
  PLAYBOOK_SLOTS[levelOf(founder, 'playbooks')] ?? PLAYBOOK_SLOTS[0] ?? 1

export const savePlaybook = (founder: Founder, playbook: Playbook): Change =>
  founder.playbooks.length >= playbookSlots(founder)
    ? no(
        `Every Playbook slot is full (${playbookSlots(founder)}). Delete one, or buy more in the Legacy shop.`,
      )
    : ok({ ...founder, playbooks: [...founder.playbooks, playbook] })

export const removePlaybook = (founder: Founder, index: number): Founder => ({
  ...founder,
  playbooks: founder.playbooks.filter((_, at) => at !== index),
})

export const recordEra = (founder: Founder, stage: number): Founder =>
  founder.erasReached.includes(stage)
    ? founder
    : { ...founder, erasReached: [...founder.erasReached, stage] }

export const completeChallenge = (founder: Founder, id: string, legacy: number): Founder => {
  const done = founder.completed.includes(id)
    ? founder
    : {
        ...founder,
        completed: [...founder.completed, id],
        legacy: founder.legacy + legacy,
        earned: founder.earned + legacy,
      }
  return id === 'five-nines' ? earnAchievements(done, ['five-nines']) : done
}
