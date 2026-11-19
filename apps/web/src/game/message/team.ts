import { IncidentId } from '@quorum/simulation/state'
import { ResearchMessage } from '../research.ts'
import { Schema } from 'effect'
import { TASK_IDS } from '@quorum/simulation/catalog'
import { TeamMessage } from '../team.ts'

export const teamCases = {
  ResearchChanged: { message: ResearchMessage },
  TeamChanged: { message: TeamMessage },
  TaskQueued: { id: Schema.Literals(TASK_IDS) },
  AuthMoveQueued: {},
  RunbookQueued: { kind: IncidentId },
  PolicyToggled: { policy: Schema.Literals(['research', 'hire', 'upgrade']), on: Schema.Boolean },
  WorkMoved: { id: Schema.Finite, direction: Schema.Literals([1, -1]) },
  WorkCancelled: { id: Schema.Finite },
  WorkResumed: { id: Schema.Finite },
  WorkApproved: { id: Schema.Finite },
  WorkDeferred: { id: Schema.Finite },
  WorkPatched: { id: Schema.Finite },
  WorkPatchQueued: { id: Schema.Finite },
  EngineerGivenTimeOff: { engineerId: Schema.String },
  EngineerGivenRaise: { engineerId: Schema.String },
  EngineerResigned: { engineerId: Schema.String },
  WorkPrioritized: { id: Schema.Finite },
  WorkRushed: { id: Schema.Finite },
  AutopilotToggled: {},
  MigrationShifted: {},
  MigrationCancelled: {},
  RolledBack: {},
}
