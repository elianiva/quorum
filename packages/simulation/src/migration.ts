import { Result } from 'effect'
import {
  FIX_BUGS_SHARE,
  FRAMEWORKS,
  LANGUAGES,
  MIGRATION_FACTORS,
  MIGRATION_STEPS,
  MIGRATION_TRANCHES,
  MONOLITH_MIGRATION,
  RUNTIMES,
  type FrameworkId,
  type RuntimeId,
} from './catalog.ts'
import { hasMutator } from './founding.ts'
import { Refusal, setFramework, setRuntime, type Action } from './actions.ts'
import { Migration } from './state.ts'
import type { Game, GameNode } from './state.ts'
import { enqueue, serviceOf, stackOf, withService } from './team.ts'

export type StackTarget = Readonly<{ runtime: RuntimeId; framework: FrameworkId }>

export const stepOf = (migration: Migration): number =>
  Migration.match(migration, {
    Building: ({ step }) => step,
    Ready: ({ step }) => step,
    Finishing: () => MIGRATION_STEPS.length,
  })

export const isReady = Migration.guards.Ready

export const trancheBuilt = (migration: Migration): Migration => {
  if (!Migration.guards.Building(migration)) return migration
  const { runtime, framework, fromRuntime, fromFramework, total, step, bugs } = migration
  return Migration.cases.Ready.make({
    runtime,
    framework,
    fromRuntime,
    fromFramework,
    total,
    step,
    bugs,
  })
}

export const shifted = (migration: Migration, moved: boolean): Migration | null => {
  if (!Migration.guards.Ready(migration)) return migration
  const { runtime, framework, fromRuntime, fromFramework, total } = migration
  const step = migration.step + 1
  const bugs = migration.bugs || moved
  if (step >= MIGRATION_STEPS.length)
    return bugs
      ? Migration.cases.Finishing.make({
          runtime,
          framework,
          fromRuntime,
          fromFramework,
          total,
          bugs,
        })
      : null
  return Migration.cases.Building.make({
    runtime,
    framework,
    fromRuntime,
    fromFramework,
    total,
    step,
    bugs,
  })
}

export const fixed = (migration: Migration): Migration | null =>
  Migration.guards.Finishing(migration) ? null : { ...migration, bugs: false }

export const migrationFactor = (from: StackTarget, to: StackTarget): number => {
  const language = RUNTIMES[to.runtime].language
  if (RUNTIMES[from.runtime].language !== language)
    return MIGRATION_FACTORS.language / LANGUAGES[language].velocity
  if (from.framework !== to.framework) return MIGRATION_FACTORS.framework
  return MIGRATION_FACTORS.variant
}

export const migrationCost = (game: Game, to: StackTarget): number =>
  Math.max(
    0.5,
    Math.round(
      serviceOf(game).codebase *
        migrationFactor(stackOf(game), to) *
        (hasMutator(game, 'legacy-monolith') ? MONOLITH_MIGRATION : 1) *
        10,
    ) / 10,
  )

export const trancheOf = (migration: Migration, step: number): number =>
  Math.round(migration.total * (MIGRATION_TRANCHES[step - 1] ?? 0) * 10) / 10

export const targetOf = (
  node: GameNode,
  choice: Readonly<{ runtime?: RuntimeId; framework?: FrameworkId }>,
): StackTarget => {
  const runtime = choice.runtime ?? node.runtime
  const framework =
    choice.framework ??
    (FRAMEWORKS[node.framework].language === RUNTIMES[runtime].language ? node.framework : 'none')
  return { runtime, framework }
}

const servers = (game: Game) => game.nodes.filter((node) => node.type === 'server')

const onStack = (node: GameNode, stack: StackTarget): boolean =>
  node.runtime === stack.runtime && node.framework === stack.framework

const swap = (game: Game, id: string, stack: StackTarget): Action =>
  Result.flatMap(setRuntime(game, id, stack.runtime), (next) =>
    setFramework(next, id, stack.framework),
  )

const convert = (game: Game, stack: StackTarget, count: number): Game => {
  let next = game
  for (const node of servers(game)) {
    if (servers(next).filter((entry) => onStack(entry, stack)).length >= count) break
    if (!onStack(node, stack)) next = Result.getOrElse(swap(next, node.id, stack), () => next)
  }
  return next
}

export const serversAt = (game: Game, step: number): number => {
  const total = servers(game).length
  return step >= MIGRATION_STEPS.length
    ? total
    : Math.floor(total * (MIGRATION_STEPS[step - 1] ?? 0))
}

export const startMigration = (game: Game, to: StackTarget): Action => {
  const running = serviceOf(game).migration
  if (running)
    return Result.fail(
      Refusal.NotAllowed({
        reason: Migration.guards.Finishing(running)
          ? 'Fix the last migration’s bugs first.'
          : `Finish or cancel the migration to ${RUNTIMES[running.runtime].name} first.`,
      }),
    )
  const from = stackOf(game)
  const first = servers(game)[0]
  if (!first) return Result.fail(Refusal.NotAllowed({ reason: 'There is no App Server.' }))
  if (from.runtime === to.runtime && from.framework === to.framework) return Result.succeed(game)
  const checked = swap(game, first.id, to)
  if (Result.isFailure(checked)) return checked
  const migration = Migration.cases.Building.make({
    runtime: to.runtime,
    framework: to.framework,
    fromRuntime: from.runtime,
    fromFramework: from.framework,
    total: migrationCost(game, to),
    step: 0,
    bugs: false,
  })
  return Result.succeed(
    enqueue(withService(game, { migration }), 'migration', 'step-1', trancheOf(migration, 1)),
  )
}

export const shiftMigration = (game: Game): Action => {
  const migration = serviceOf(game).migration
  if (!migration) return Result.fail(Refusal.NotAllowed({ reason: 'No migration is running.' }))
  if (!Migration.guards.Ready(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'The next step is still being built.' }))
  const step = migration.step + 1
  const stack = { runtime: migration.runtime, framework: migration.framework }
  const before = servers(game).filter((node) => onStack(node, stack)).length
  let next = convert(game, stack, serversAt(game, step))
  const moved = servers(next).filter((node) => onStack(node, stack)).length > before
  if (moved && !next.backlog.some((item) => item.ref === 'fix-bugs'))
    next = enqueue(
      next,
      'task',
      'fix-bugs',
      Math.max(1, Math.round(trancheOf(migration, step) * FIX_BUGS_SHARE * 10) / 10),
      true,
    )
  const done = step >= MIGRATION_STEPS.length
  if (!done) next = enqueue(next, 'migration', `step-${step + 1}`, trancheOf(migration, step + 1))
  return Result.succeed(withService(next, { migration: shifted(migration, moved) }))
}

export const bugsFixed = (game: Game): Game => {
  const migration = serviceOf(game).migration
  if (!migration) return game
  return withService(game, { migration: fixed(migration) })
}

export const cancelMigration = (game: Game): Action => {
  const migration = serviceOf(game).migration
  if (!migration) return Result.fail(Refusal.NotAllowed({ reason: 'No migration is running.' }))
  if (Migration.guards.Finishing(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'Every App Server has moved. Fix its bugs.' }))
  const from = { runtime: migration.fromRuntime, framework: migration.fromFramework }
  const reverted = convert(game, from, servers(game).length)
  return Result.succeed(
    withService(
      {
        ...reverted,
        backlog: reverted.backlog.filter(
          (item) => item.kind !== 'migration' && item.ref !== 'fix-bugs',
        ),
      },
      { migration: null },
    ),
  )
}
