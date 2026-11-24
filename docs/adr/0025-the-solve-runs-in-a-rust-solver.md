# The solve runs in a Rust Solver

The solve, the part of the Simulation that turns a Game into the Ledger and finds the Bottleneck,
runs in a WebAssembly module built from Rust in `packages/simulation/solver`. The rest of the
Simulation stays in TypeScript: the catalog, the Game schema, the Step, actions, and the Sandboxes.
`src/solve.ts` keeps `solve`, `solveFlow`, and `bottleneckOf`, so no caller changes, and each of
them hands the Game to the Solver.

The solve is where the game spends its time. A Step on a 200-Node board solves the pass loop, the
outcome tree, and the Ledger, and the Tradeoff preview and the Bottleneck search solve again on top
of that. A TypeScript solve builds thousands of short-lived objects, so the garbage collector runs on
most Steps. The Solver keeps its tables in flat arrays it owns and reuses them between solves. On
that board a full `solve` takes 2.15 ms against 8.95 ms in TypeScript, and 300 solves trigger 8
scavenges where TypeScript needs 184.

Every figure matches a TypeScript solve bit for bit. Rust and JavaScript both compute in IEEE 754
doubles, and the Solver keeps TypeScript's order of operations, including the order it sums each
record in. The purity rules of
[ADR 0004](./0004-simulation-package.md) hold, because every runtime runs the same module.

Considered options:

- **Optimize the TypeScript solve.** Its cost is the object graph itself, not one hot loop.
  Removing the allocations would mean writing typed arrays by hand in TypeScript, which gives up
  the type safety that made it worth keeping in TypeScript. Rejected.
- **Port only the hot loops and keep the Ledger in TypeScript.** Every pass would cross the
  boundary several times and copy its state both ways, which spends much of what the port saves.
  The two halves would also own one model between them. Rejected.
- **Use `wasm-bindgen`.** It generates glue for strings and objects that the Solver does not pass.
  The boundary is a few named `f64` blocks, and plain exports keep the crate free of dependencies.
  Rejected.
- **Keep a TypeScript fallback.** Two solves would have to agree forever, and the slower one would
  run only where nobody looks. Rejected: a solve with no Solver installed throws.
- **Commit the module.** Nobody would need Rust to run the game, but every catalog change would
  carry a regenerated binary, and a stale one could reach `main`. Rejected by
  [ADR 0030](./0030-catalog-content-is-written-in-lisp.md): the module is built by the `content`
  task before every check, build, and deploy, so every contributor and CI job needs the pinned Rust.

## Consequences

- The word "Solver" names the module ([CONTEXT.md](../../CONTEXT.md)). "Kernel" and "engine"
  stay out of code and copy.
- The Simulation names no host globals, so each runtime installs the Solver once at start through
  `@quorum/simulation/host/node`, `host/browser`, or `host/worker`. The browser host exports
  `solverReady`, and the web and wiki entries wait for it. Every Vitest config loads `host/node`.
- `src/solver.ts` is the only TypeScript that knows the module's layout. It writes the Game into the
  Solver's blocks and decodes the Ledger. `installSolver` checks that both sides agree on the block
  layout, so a slot added on one side fails at start instead of producing a wrong figure.
- `src/solver.wasm` is built into `packages/simulation/src` and ignored by git. `SIM_VERSION`
  hashes the trees it is built from, so it changes whenever the module can.
- qmc, the content compiler in `packages/qmc`, writes `solver/src/catalog.rs` from the generated
  catalog and stamps it with `CATALOG_HASH`. `test/solver-catalog.test.ts` fails when the module
  in place is older than `catalog.rs`.
- `.github/workflows/solver.yml` runs when the Rust source, the content, or qmc changes. It writes
  `catalog.rs`, then runs clippy with warnings as errors and the Rust tests.
- A change to how the Simulation solves is a Rust change. A change to a catalog number is a
  content change. `pnpm --filter @quorum/simulation content` rebuilds both.
