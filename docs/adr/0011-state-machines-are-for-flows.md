# State machines are for flows, not for numbers

A flow with exclusive phases and more than one event uses a Machine. A number that the solver
integrates stays a number.

A flow written as nullable fields, booleans, and sentinel numbers needs an `if` at every point of
use: a Node's `down`, `warm`, and `downCause` can disagree, a Mail can be both answered and
resolved, and a Company can be loading while another is open. The app uses
`@typeonce/effect-machine` for every flow in both `apps/web` and `packages/simulation`.

## Decision

1. A flow with exclusive phases gets a Machine. Its state is an Effect `Schema` tagged union beside
   the machine. The union makes phase-and-payload combinations unrepresentable. The machine's
   transition table makes the legal events per phase explicit, and every other event leaves the
   state unchanged.
2. The app uses the library's pure planners, not its runtime. `Machine.plan` and `Machine.planInitial`
   run through `Effect.runSync` in `planState`, so a Foldkit update and a Simulation Step stay
   synchronous. The app does not start a fiber, open a service layer, or send events to a running
   machine.
3. The stored value is the tagged state, not `Machine.Snapshot`. A snapshot is an experimental
   shape with completion and history metadata, and a `Game` is saved, replayed, and hashed.
   `planState` rebuilds the root snapshot from the tag on each plan.
4. `packages/simulation` may import `@typeonce/effect-machine`. The package imports only
   `effect` and its own files at runtime; the machine library is schema and planning code with no
   platform dependency.
5. The live schema describes the live shape only. A format change bumps `SAVE_FORMAT` and adds one
   function that turns the previous format into the new one ([ADR 0023](0023-a-company-save-has-a-format.md)).
   There is no stored schema with a `decodeTo` transform.
6. Behaviour is covered through the integration tests that call the flow: `update.test.ts`,
   `inbox.test.ts`, `saves.test.ts`, and the Simulation's Step and replay tests. A test that steps
   the machine's table duplicates the table, so there is none.

## Applications

The inventory is in [State machines](../state-machines.md). The flows fall into three groups.

- **Page and board**: Boot, Board session, Challenge run, Company, Clock, Board interaction,
  Tradeoff, Change, Hold, Delete confirm, Disclosure, and the Exit survey.
- **Company systems**: Bridge, Drill, Quarter, Feature, Hire, Breaker, Autoscaler, Era round,
  Data move, Study, Node service, Work item, Incident, and Mirror.
- **Lifecycle**: Node lifecycle and Stack migration stay tagged unions with total constructors in
  `life.ts` and `migration.ts`. They have a closed state set and no second writer, so they keep
  their shape.

## Consequences

- A phase carries only the fields it can have. A caller cannot read an Apply's landing time from a
  Mirror that is in sync, or a Drain's start from a Node that is in service.
- A late or repeated event is a no-op. `planState` returns the input state when the machine's
  transition table has no transition for the event.
- A save from another format is refused with a message that names both versions
  ([ADR 0023](0023-a-company-save-has-a-format.md)).
- The encoded Game changes when a phase replaces fields, so the golden hashes and `SIM_VERSION`
  move with it.
- The machine library is a dependency of `apps/web` and `packages/simulation`. It is pinned in both
  `package.json` files. A breaking change is a local edit in the flow files, not a codebase-wide
  migration.
- The Simulation decides the rules. A Challenge's score, Legacy, and hash come from
  `@quorum/simulation`, not from the machine.
- What would change it: a machine runtime that keeps a Foldkit update synchronous and a `Game`
  replayable without a fiber. No runtime does both.
