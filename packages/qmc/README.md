# qmc

qmc compiles the content files in `packages/simulation/content/*.qm` into
`packages/simulation/src/generated/*.ts`. It is written in Rust with no dependencies outside `std`.

```sh
pnpm --filter @quorum/simulation content   # compile the content and write the generated files
cargo run -- build <content> <out> --solver <catalog.ts> <catalog.rs>  # what `content` runs
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

### Plain data

A table or number that needs no rule of its own is a `def`. It lands in the generated file named
after its content file, so `content/tuning.qm` writes `generated/tuning.ts`:

```lisp
(types "../catalog/tuning.ts" Tuning)

(def CALENDAR_PACE 24)
(def ZONES :type const ["a" "b" "c"])
(def CHALLENGE_TUNING :type "Tuning" :doc "The pace of a challenge run."
  (:pace 1 :incidentGap 720 :calendarPace CALENDAR_PACE))
```

A value is a number, a string, `true`, `false`, `null`, `undefined`, `Infinity`, the name of
another value, a row `[a b]` (an array), or a list. `(:key value …)` is a record, and
`(record "key" value …)` is one whose first key is not a plain name. `(... NAME)` spreads a value
into a row or record. `(ref NAME key 0)` reads a property. `(+ a b)`, `(- a b)`, `(* a b)`, and
`(/ a b)` are emitted as written, so the generated code computes the same floating-point value the
hand-written code did. `(as "Type" value)` is a type assertion. `:type "T"` annotates the
declaration, `:type const` writes `as const`, `:satisfies "T"` writes `satisfies T`, and `:doc`
writes a doc comment. `(types "path" Name …)` names the TypeScript types an annotation uses.

### Gates

A setting that needs research is a `gate`. `:free` lists the values that need no research, and
`:locked` lists the only values that do:

```lisp
(gate database keep :research retention :what "Retention" :free ("keep"))
(gate storage storeVariant :research egress-optimization :what "R2" :locked ("r2"))
(gate gpu precision :research quantization :labels GPU_PRECISIONS :free ("fp16"))
```

`:labels TABLE` names the value's `name` in that table instead of fixed text, so locking INT8
refuses with "INT8 needs Quantization.". qmc checks that every value the gate lists is a key of the
table.

`GATES` in `generated/components.ts` holds them, keyed `component.field`, and TypeScript checks that
each field is a field of a Node. A rule calls `locked(game, 'database.keep', keep)`, which returns
the refusal "Retention needs Retention policies." until the research is done.

### The Solver catalog

`--solver ../simulation/src/catalog.ts ../simulation/solver/src/catalog.rs` also writes the Rust
Solver's catalog: every number, flag, and string that `catalog.ts` exports, the tables the solve
reads, and `CATALOG_HASH`, a SHA-256 prefix the Simulation compares with the built module. qmc
reads the values back from the generated TypeScript and prints numbers as JavaScript prints them,
so the Solver and the Simulation see the same floating-point values.

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
- a kind a component sends that no component accepts and that is not `:external`, a fallback kind
  the component does not accept, a kind a component accepts that no component sends, and an
  external kind a component accepts
- a component that is both sized and has a fixed capacity, both fixed and sized, or fixed and
  unlocked by research
- a gate on a component or research that does not exist, two gates on one field, a gate that
  locks no value or names a value twice, a `:labels` table that is not a record def or lacks a
  value the gate lists, and, as a warning, a gate on the research that already
  unlocks the component
- a def that reads a value or names a type that does not exist, that reads itself, that repeats a
  key in one record, or that takes a name another form declares

It warns about a requirement another requirement already implies, about an unused import, and about
an incident the Director cannot pick until an Era later than the one it names.

## Parallel and deterministic

Files are read, expanded, and lowered in parallel, the check passes run at once over the shared
catalog, and the generated files are written at once. Diagnostics are sorted by position and output
is written in declaration order, so every run gives the same bytes. Set `QMC_THREADS` to change the
number of worker threads.
