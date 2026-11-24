# The Simulation is a workspace package

The Simulation lives in `packages/simulation` (`@quorum/simulation`), not inside the website.
The browser plays it, and the API Worker steps an online Company in a Durable Object
([ADR 0019](./0019-anonymous-multiplayer-rooms.md)). Both execute the same code, so it is a real shared boundary, and [GDD 17](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/17-scope-and-roadmap.md#scope-rules) names it: the Simulation stays a pure module that runs in tests, the Tradeoff preview, and a Room. CONTEXT.md defines the word, so the package is named for it.

Considered options:

- Keep it in `apps/web/src/game/engine` and let the backend import it by relative path or through
  `@quorum/web`. Rejected: an app-to-app dependency breaks the dependency direction in
  [Architecture](../architecture.md), and it pulls the website's Vite and DOM configuration into
  the Worker.
- Put it in `packages/rpc`. Rejected: that package is the wire contract only.
- Copy it into the backend. Rejected: the Room and the browser would drift, and one Game would mean
  two things.

## Consequences

- `apps/web` and `apps/backend` depend on `@quorum/simulation`. `packages/rpc` does not: a Room's
  payloads live beside the Simulation, because both ends import it.
- The Simulation imports only `effect`, `@typeonce/effect-machine`, and its own files. Its tsconfig has no DOM library, and
  `test/purity.test.ts` rejects any other import, host globals such as `Date` and `window`, and the
  math that engines may compute differently (`Math.cos`, `Math.exp`, `Math.pow`, `**`, and the
  rest), as [GDD 04](https://github.com/elianiva/quorum/blob/main/apps/wiki/content/design/04-simulation.md#determinism-and-randomness) requires.
- `SIM_VERSION` hashes the git trees of `packages/simulation/src`, `content`, and `solver`, and of
  `packages/qmc`, which builds the generated catalog and the Solver. It is filled in at build time
  by `packages/simulation/sim-version.ts`. A commit that changes the Simulation changes the version, so
  results from different versions are never compared, and nobody bumps a number or re-pins a hash.
  `pnpm test:engines` replays one fixed Company and every Challenge's reference solution in each
  engine and compares the hashes with Node's, which it computes on the spot.
- The UI stays in `apps/web`. The Simulation exports data and pure functions; it never renders,
  stores, or schedules anything.
