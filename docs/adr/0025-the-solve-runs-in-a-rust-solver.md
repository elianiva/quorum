# The solve runs in a Rust Solver

The solve, the part of the Simulation that turns a Game into the Ledger and finds the Bottleneck,
runs in a WebAssembly module built from Rust in `packages/simulation/solver`. The rest of the
Simulation stays in TypeScript: the catalog, the Game schema, the Step, actions, and the Sandboxes.
`src/solve.ts` keeps `solve`, `solveFlow`, and `bottleneckOf`, so no caller changes, and each of
them hands the Game to the Solver.

The solve is where the game spends its time. A Step on a 200-Node board solves the pass loop, the
outcome tree, and the Ledger, and the Tradeoff preview and the Bottleneck search solve again on top
of that. In TypeScript each solve built thousands of short-lived objects, so the garbage collector
ran on most Steps. The Solver keeps its tables in flat arrays it owns and reuses them between
solves. On that board a full `solve` takes 2.15 ms against 8.95 ms in TypeScript, and 300 solves
trigger 8 scavenges where TypeScript needed 184.

Every figure matches the TypeScript solve bit for bit. Rust and JavaScript both compute in IEEE 754
doubles, and the Solver keeps TypeScript's order of operations, including the order it sums each
record in. Before the TypeScript solve was deleted, both ran on every solve in every test suite:
61,999 solves, with no difference. The purity rules of
[ADR 0004](./0004-simulation-package.md) still hold, because every runtime runs the same module.

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
- **Build the module at deploy time instead of committing it.** Every contributor, the test run,
  and the deploy would need a Rust toolchain, even for a change to a wiki page. Rejected: the
  module is committed, and CI proves it is the build of its source.

## Consequences

- The word "Solver" names the module ([CONTEXT.md](../../CONTEXT.md)). "Kernel" and "engine"
  stay out of code and copy.
- The Simulation names no host globals, so each runtime installs the Solver once at start through
  `@quorum/simulation/host/node`, `host/browser`, or `host/worker`. The browser host exports
  `solverReady`, and the web and wiki entries wait for it. Every Vitest config loads `host/node`.
- `src/solver.ts` is the only TypeScript that knows the module's layout. It writes the Game into the
  Solver's blocks and decodes the Ledger. `installSolver` checks that both sides agree on the block
  layout, so a slot added on one side fails at start instead of producing a wrong figure.
- `src/solver.wasm` is committed and lives under `packages/simulation/src`, so `SIM_VERSION`
  changes whenever the module does.
- `solver/gen-catalog.ts` writes `solver/src/catalog.rs` from the TypeScript catalog and stamps it
  with `CATALOG_HASH`. `test/solver-catalog.test.ts` fails when `catalog.rs` or the committed module
  is older than the catalog, and it needs no Rust.
- `.github/workflows/solver.yml` runs when the Rust source or the module changes. It runs clippy
  with warnings as errors and the Rust tests, then rebuilds the module with the compiler that
  `rust-toolchain.toml` pins and fails unless the build matches the committed file byte for byte.
- A change to how the Simulation solves is a Rust change. A change to a catalog number stays a
  TypeScript change, followed by `pnpm --filter @quorum/simulation catalog` and `solver/build.sh`.
