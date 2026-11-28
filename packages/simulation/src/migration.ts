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
  WORKER_MIGRATION_FACTOR,
  WORKER_MIGRATION_STEPS,
  WORKER_MIGRATION_TRANCHES,
  type FrameworkId,
  type RuntimeId,
} from './catalog.ts'
import { hasMutator } from './founding.ts'
import { Refusal, setFramework, setRuntime, type Action } from './actions.ts'
import { Migration } from './state.ts'
import type { Game, GameNode, Service } from './state.ts'
import { enqueue, nodeServiceOf, serviceOf, serviceOfId, stackOf, withServiceId } from './team.ts'

export type StackTarget = Readonly<{ runtime: RuntimeId; framework: FrameworkId }>

export const stepsFor = (scope: 'design' | 'worker'): ReadonlyArray<number> =>
  scope === 'worker' ? WORKER_MIGRATION_STEPS : MIGRATION_STEPS

export const stepsOf = (migration: Migration): ReadonlyArray<number> =>
  !Migration.guards.Idle(migration) ? stepsFor(migration.scope) : MIGRATION_STEPS

const tranchesOf = (migration: Migration): ReadonlyArray<number> =>
  !Migration.guards.Idle(migration) && migration.scope === 'worker'
    ? WORKER_MIGRATION_TRANCHES
    : MIGRATION_TRANCHES

export const stepOf = (migration: Migration): number =>
  Migration.match(migration, {
    Idle: () => 0,
    Building: ({ step }) => step,
    Ready: ({ step }) => step,
    Finishing: () => MIGRATION_STEPS.length,
  })

export const isIdle = Migration.guards.Idle
export const isReady = Migration.guards.Ready

export const trancheBuilt = (migration: Migration): Migration => {
  if (!Migration.guards.Building(migration)) return migration
  const { runtime, framework, fromRuntime, fromFramework, total, step, bugs, scope } = migration
  return Migration.cases.Ready.make({
    runtime,
    framework,
    fromRuntime,
    fromFramework,
    total,
    step,
    bugs,
    scope,
  })
}

export const shifted = (migration: Migration, moved: boolean): Migration => {
  if (!Migration.guards.Ready(migration)) return migration
  const { runtime, framework, fromRuntime, fromFramework, total, scope } = migration
  const step = migration.step + 1
  const bugs = scope === 'design' && (migration.bugs || moved)
  if (step >= stepsOf(migration).length)
    return scope === 'worker' || !bugs
      ? Migration.cases.Idle.make({})
      : Migration.cases.Finishing.make({
          runtime,
          framework,
          fromRuntime,
          fromFramework,
          total,
          bugs,
          scope,
        })
  return Migration.cases.Building.make({
    runtime,
    framework,
    fromRuntime,
    fromFramework,
    total,
    step,
    bugs,
    scope,
  })
}

export const fixed = (migration: Migration): Migration => {
  if (Migration.guards.Idle(migration)) return migration
  return Migration.guards.Finishing(migration)
    ? Migration.cases.Idle.make({})
    : { ...migration, bugs: false }
}

export const migrationFactor = (from: StackTarget, to: StackTarget): number => {
  const language = RUNTIMES[to.runtime].language
  if (RUNTIMES[from.runtime].language !== language)
    return MIGRATION_FACTORS.language / LANGUAGES[language].velocity
  if (from.framework !== to.framework) return MIGRATION_FACTORS.framework
  return MIGRATION_FACTORS.variant
}

export const migrationCost = (
  game: Game,
  to: StackTarget,
  from: StackTarget = stackOf(game),
  scope: 'design' | 'worker' = 'design',
  service: Service = serviceOf(game),
): number => {
  const codebase =
    scope === 'worker'
      ? game.services.reduce((sum, entry) => sum + entry.codebase, 0)
      : service.codebase
  const worker = scope === 'worker' ? WORKER_MIGRATION_FACTOR : 1
  return Math.max(
    0.5,
    Math.round(
      codebase *
        worker *
        migrationFactor(from, to) *
        (hasMutator(game, 'legacy-monolith') ? MONOLITH_MIGRATION : 1) *
        10,
    ) / 10,
  )
}

export const trancheOf = (migration: Migration, step: number): number =>
  Migration.guards.Idle(migration)
    ? 0
    : Math.round(migration.total * (tranchesOf(migration)[step - 1] ?? 0) * 10) / 10

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

const serversOf = (game: Game, service: Service) =>
  game.nodes.filter(
    (node) => node.type === 'server' && nodeServiceOf(game, node)?.id === service.id,
  )

const workersOf = (game: Game) => game.nodes.filter((node) => node.type === 'worker')

const nodesOf = (game: Game, scope: 'design' | 'worker', service: Service = serviceOf(game)) =>
  scope === 'worker' ? workersOf(game) : serversOf(game, service)

export const migratingService = (game: Game): Service =>
  game.services.find((service) => !Migration.guards.Idle(service.migration)) ?? serviceOf(game)

const onStack = (node: GameNode, stack: StackTarget): boolean =>
  node.runtime === stack.runtime && node.framework === stack.framework

const swap = (game: Game, id: string, stack: StackTarget): Action =>
  Result.flatMap(setRuntime(game, id, stack.runtime), (next) =>
    setFramework(next, id, stack.framework),
  )

const convert = (
  game: Game,
  stack: StackTarget,
  count: number,
  scope: 'design' | 'worker',
  service: Service,
): Game => {
  let next = game
  for (const node of nodesOf(game, scope, service)) {
    if (nodesOf(next, scope, service).filter((entry) => onStack(entry, stack)).length >= count)
      break
    if (!onStack(node, stack)) next = Result.getOrElse(swap(next, node.id, stack), () => next)
  }
  return next
}

export const nodesAt = (
  game: Game,
  step: number,
  scope: 'design' | 'worker',
  service: Service = serviceOf(game),
): number => {
  const steps = stepsFor(scope)
  const total = nodesOf(game, scope, service).length
  return step >= steps.length ? total : Math.floor(total * (steps[step - 1] ?? 0))
}

const refusalFor = (migration: Migration): Action | null =>
  Migration.guards.Idle(migration)
    ? null
    : Result.fail(
        Refusal.NotAllowed({
          reason: Migration.guards.Finishing(migration)
            ? 'Fix the last migration’s bugs first.'
            : `Finish or cancel the migration to ${RUNTIMES[migration.runtime].name} first.`,
        }),
      )

export const startMigration = (
  game: Game,
  to: StackTarget,
  service: Service = serviceOf(game),
): Action => {
  const running =
    refusalFor(service.migration) ??
    (service.id === serviceOf(game).id ? null : refusalFor(serviceOf(game).migration))
  if (running) return running
  const from = stackOf(game, service)
  const first = serversOf(game, service)[0]
  if (!first) return Result.fail(Refusal.NotAllowed({ reason: 'There is no App Server.' }))
  if (from.runtime === to.runtime && from.framework === to.framework) return Result.succeed(game)
  const checked = swap(game, first.id, to)
  if (Result.isFailure(checked)) return checked
  const migration = Migration.cases.Building.make({
    runtime: to.runtime,
    framework: to.framework,
    fromRuntime: from.runtime,
    fromFramework: from.framework,
    total: migrationCost(game, to, from, 'design', service),
    step: 0,
    bugs: false,
    scope: 'design',
  })
  return Result.succeed(
    enqueue(
      withServiceId(game, service.id, { migration }),
      'migration',
      'step-1',
      trancheOf(migration, 1),
      false,
      { service: service.id },
    ),
  )
}

export const startWorkerMigration = (game: Game, nodeId: string, to: StackTarget): Action => {
  const running =
    refusalFor(serviceOf(game).migration) ??
    game.services.map((service) => refusalFor(service.migration)).find(Boolean) ??
    null
  if (running) return running
  const node = game.nodes.find((entry) => entry.id === nodeId && entry.type === 'worker')
  if (!node) return Result.fail(Refusal.NotAllowed({ reason: 'That is not a Worker.' }))
  if (node.runtime === to.runtime && node.framework === to.framework) return Result.succeed(game)
  if (workersOf(game).length === 0)
    return Result.fail(Refusal.NotAllowed({ reason: 'There is no Worker.' }))
  const from = { runtime: node.runtime, framework: node.framework }
  const checked = swap(game, node.id, to)
  if (Result.isFailure(checked)) return checked
  const migration = Migration.cases.Building.make({
    runtime: to.runtime,
    framework: to.framework,
    fromRuntime: from.runtime,
    fromFramework: from.framework,
    total: migrationCost(game, to, from, 'worker'),
    step: 0,
    bugs: false,
    scope: 'worker',
  })
  const service = serviceOf(game)
  return Result.succeed(
    enqueue(
      withServiceId(game, service.id, { migration }),
      'migration',
      'step-1',
      trancheOf(migration, 1),
      false,
      { service: service.id },
    ),
  )
}

export const shiftMigration = (game: Game, serviceId?: string): Action => {
  const service = serviceId === undefined ? migratingService(game) : serviceOfId(game, serviceId)
  const migration = service.migration
  if (Migration.guards.Idle(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'No migration is running.' }))
  if (!Migration.guards.Ready(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'The next step is still being built.' }))
  const scope = migration.scope
  const steps = stepsOf(migration)
  const step = migration.step + 1
  const stack = { runtime: migration.runtime, framework: migration.framework }
  const before = nodesOf(game, scope, service).filter((node) => onStack(node, stack)).length
  let next = convert(game, stack, nodesAt(game, step, scope, service), scope, service)
  const moved = nodesOf(next, scope, service).filter((node) => onStack(node, stack)).length > before
  if (moved && scope === 'design' && !next.backlog.some((item) => item.ref === 'fix-bugs'))
    next = enqueue(
      next,
      'task',
      'fix-bugs',
      Math.max(1, Math.round(trancheOf(migration, step) * FIX_BUGS_SHARE * 10) / 10),
      true,
      { service: service.id },
    )
  const done = step >= steps.length
  if (!done)
    next = enqueue(next, 'migration', `step-${step + 1}`, trancheOf(migration, step + 1), false, {
      service: service.id,
    })
  return Result.succeed(withServiceId(next, service.id, { migration: shifted(migration, moved) }))
}

export const bugsFixed = (game: Game, serviceId?: string): Game => {
  const service = serviceId === undefined ? migratingService(game) : serviceOfId(game, serviceId)
  return withServiceId(game, service.id, { migration: fixed(service.migration) })
}

export const cancelMigration = (game: Game, serviceId?: string): Action => {
  const service = serviceId === undefined ? migratingService(game) : serviceOfId(game, serviceId)
  const migration = service.migration
  if (Migration.guards.Idle(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'No migration is running.' }))
  if (Migration.guards.Finishing(migration))
    return Result.fail(Refusal.NotAllowed({ reason: 'Every App Server has moved. Fix its bugs.' }))
  const cleared = {
    ...game,
    backlog: game.backlog.filter(
      (item) =>
        !(item.kind === 'migration' || item.ref === 'fix-bugs') ||
        (item.service !== undefined && item.service !== service.id),
    ),
  }
  const from = { runtime: migration.fromRuntime, framework: migration.fromFramework }
  const reverted = convert(
    cleared,
    from,
    nodesOf(cleared, migration.scope, service).length,
    migration.scope,
    service,
  )
  return Result.succeed(
    withServiceId(reverted, service.id, { migration: Migration.cases.Idle.make({}) }),
  )
}
