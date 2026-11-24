# qmc

qmc compiles the content files in `packages/simulation/content/*.qm` into
`packages/simulation/src/generated/*.ts`. It is written in Rust with no dependencies outside `std`.

```sh
pnpm --filter @quorum/simulation content   # compile the content and write the generated files
cargo run -- build <content> <out> --check  # fail when the generated files are out of date (CI)
cargo run -- expand file.qm                 # print a file after macro expansion
cargo test
```

## The language

A content file is S-expressions. Numbers are exact fractions and can carry a unit: `2ms`, `300s`,
`44%`, `1.15x`, and `5_000`. A field declares the unit it takes, so `:share 2s` is an error.

`defmacro` takes a quasiquote template. A template substitutes its arguments, joins names with
`(sym "fw-" id)`, and runs no code. A macro call is a top-level form, so a list in a data position
is never a call, and a macro cannot expand into itself, so expansion always ends.

`(const PREMIERE_SURGE 4)` declares a number that `generated/constants.ts` exports and content can
name. `(import "../catalog/runtimes.ts" RUNTIMES)` names a TypeScript value that `(ref RUNTIMES puma blurb)`
reads. TypeScript checks the facts qmc cannot see, such as that `puma` is a runtime or that every
framework has research.

## The checks

qmc refuses content that contradicts itself and reports every problem in one run:

- a name defined twice, or a reference to a research, track, shape, or import that does not exist,
  with the closest name as a suggestion
- research whose requirements loop back to it, with the loop spelled out
- research that requires research from a later Era
- a study shape with a missing or unknown field, a value in the wrong unit, or a share outside
  0% to 100%
- an empty or repeated Insight pool list, and two entries that unlock one framework
- a traffic mix whose shares do not sum to exactly 100%, or that lists a kind twice
- an Era whose raise target is above its market, or that never raises but still has a grant or
  dilution
- research or an incident whose `:era` is past the last Era
- an incident that escalates to a less severe level, that no Era lets the Director start, or
  whose cascades loop back to it
- a fallacy no incident teaches, or one that two incidents teach

It warns about a requirement another requirement already implies, about an unused import, and about
an incident the Director cannot pick until an Era later than the one it names.

## Parallel and deterministic

Files are read, expanded, and lowered in parallel, the check passes run at once over the shared
catalog, and the generated files are written at once. Diagnostics are sorted by position and output
is written in declaration order, so every run gives the same bytes. Set `QMC_THREADS` to change the
number of worker threads.
