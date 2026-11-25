# Catalog content is written in Lisp and compiled by qmc

The catalog's data, meaning research, Eras, incidents, kinds, Components, the tables in each
Component file, and the research gates on Node settings, lives in the `.qm` files under `packages/simulation/content`.
These files are S-expressions. qmc, a Rust compiler in `packages/qmc` with no dependencies outside
`std`, reads them and writes two outputs: `packages/simulation/src/generated/*.ts`, which the
catalog files re-export, and the Solver's `solver/src/catalog.rs`. Types are content too: a
`(type NAME expression)` form becomes an alias in `generated/types.ts`. Pure functions such as
`rttOf`, and tables computed from others such as `RECIPE`, stay in TypeScript. A Component's
`(state …)` form declares its settings, so qmc writes the Effect Schema fields and the setters that
only check a field's values, its gate, and its scope. A setter that needs more, such as a backup
that rolls a restore, stays in the `.rule.ts` file.

A catalog in TypeScript let one entry contradict another, and nothing caught it until a game reached
that state. One example is research that requires research from a later Era. Another is a kind a
Component sends that no Component accepts. A third is a traffic mix that sums to 99%. TypeScript
types cannot express these rules, so they lived in tests or nowhere. qmc checks them when the content
compiles, and it reports every problem in one run with the closest name as a suggestion. Numbers
are exact fractions with units, so `(44% 35% 15% 6%)` sums to exactly 1 and `:share 2s` is an error.

Considered options:

- **Keep the catalog in TypeScript and add tests.** Each rule becomes a test over the built values.
  A test cannot point at the line that broke the rule, and the tests cannot share one pass over
  the content. Rejected.
- **JSON or YAML with a schema.** A schema checks the shape of one entry, but not rules across
  entries. Neither format has macros, so repeated entries stay repeated. Rejected.
- **A compiler in TypeScript.** It would run in the same toolchain, but the Solver catalog is
  already Rust, and a compiler in Rust can run its passes on threads with no dependencies. Rejected.

## Consequences

- To change a catalog number, edit the `.qm` file. `src/generated`, `catalog.rs`, and
  `solver.wasm` are build output that git ignores. The turbo `content` task, which is
  `pnpm --filter @quorum/simulation content`, writes them, and `dev`, `check`, `typecheck`, `test`,
  `build`, and the deploy run it first. A committed file can never be stale.
- Every contributor and every CI job needs the Rust that `rust-toolchain.toml` pins.
  `.agents/setup` installs it in an orb, and `.github/actions/rust` installs it in CI. Turbo caches
  the task, so an unchanged checkout does not rebuild it.
- `(def NAME value)` emits arithmetic as written, so the generated code computes the same
  floating-point values a hand-written table did. qmc reads the generated modules back as
  JavaScript would and prints numbers as JavaScript prints them, so the Solver and the Simulation
  agree bit for bit.
- A setting that needs research has a `:gate` on its state field. The gate names its research, its
  refusal label, and the values that research locks. A rule refuses a locked value through `locked`
  in `src/action-kit.ts`, so the research and the label of a gate are content and not code.
- A content file describes one thing completely. `content/components/database.qm` holds the
  Database's component, state fields, tables, and glossary. qmc writes `generated/database.ts` and
  `generated/database.rule.ts`, and `src/components/database.ts` does not exist. A rule that needs
  more than a field, its values, its gate, and its scope, such as a check against the links of a
  Node, stays in the `.rule.ts` file.
- A constant is written in kebab case and exported in SCREAM_CASE: `(def db-engines …)` writes
  `DB_ENGINES`, and content reads it as `db-engines`. A name with an uppercase
  letter is a TypeScript name, such as `wideGlossary`, and keeps its casing.
- An Era has an id such as `garage`. Research, incidents, and data values name that id, and qmc
  turns it into the index the generated data uses.
- A TypeScript annotation is a structured type expression such as `(array FeatureId)` or
  `(object (id FeatureId) (name string))`. A raw string remains an escape hatch for a type qmc has no
  form for. `(type NAME expression)` writes a generated TypeScript alias in `generated/types.ts`.
- A family of constants that shares a prefix is one `(constants PREFIX …)` form. Each entry names
  only the suffix, or the prefix itself for the base constant, and the group's `:type` and
  `:satisfies` are defaults, so a family states its shared prefix and type once. The group stays in
  the file that owns its domain. A constant does not move into another file just because two
  unrelated constants share a first word.
- A table row can leave a cell out with `-`. The generated record omits that key, which lets one
  header describe rows with optional fields. A wide or nested catalog uses a `records` form instead,
  where each entry reads as its own record and can omit fields without a placeholder.
