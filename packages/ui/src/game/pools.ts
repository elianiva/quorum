import { FEATURES, type StudyShapeKind } from '@quorum/simulation/catalog'
import { StudyStall } from '@quorum/simulation/studies'
import { poolName } from './pool-visuals.ts'

export * from './pool-visuals.ts'

/** What a stalled Study waits for, as the rest of a "can’t run unless …" sentence (10 "Studies"). */
export const stallNeed = (stall: StudyStall): string =>
  StudyStall.match(stall, {
    Breadth: ({ unit, target }) =>
      unit === 'regions'
        ? `Analytics samples its request kinds in ${target} regions`
        : `Analytics samples its request kinds at ${target} Component types`,
    Pool: ({ pool, feature }) =>
      feature
        ? `something earns ${poolName(pool)} (ship ${FEATURES[feature].name})`
        : pool === 'failure'
          ? 'failed requests earn Failure Insight'
          : `something earns ${poolName(pool)}`,
    Shape: ({ shape, value }) => shapeNeed(shape, value),
  })

/** Why a Study stalls, in one sentence, for a surface that names the Study beside it. */
export const stallReason = (stall: StudyStall): string => `It can’t run unless ${stallNeed(stall)}.`

/** The behaviour a shape asks the Design to show, in one clause. */
export const shapeNeed = (shape: StudyShapeKind, value: number): string => {
  const pct = `${Math.round(value * 100)}%`
  switch (shape) {
    case 'connections':
      return `the App Servers hold more than ${value} database connections`
    case 'read-share':
      return `a Database spends ${pct} of its work on reads`
    case 'cache-hit':
      return `a Cache hits on ${pct} of its reads`
    case 'backlog':
      return `a Queue holds a backlog of ${value} s or more`
    case 'report-share':
      return `a Database spends ${pct} of its work on reports`
    case 'saturation':
      return `a Node runs at ${pct} of its capacity`
    case 'replica':
      return 'a Read Replica serves reads'
  }
}
