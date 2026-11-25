# qmc

qmc compiles the content files in `packages/simulation/content/**/*.qm` into
`packages/simulation/src/generated/*.ts`. It is written in Rust with no dependencies outside `std`.

```sh
pnpm --filter @quorum/simulation content   # compile the content and write the generated files
cargo run -- build <content> <out> --solver <catalog.ts> <catalog.rs>  # what `content` runs
cargo run -- expand file.qm                 # print a file after macro expansion
cargo run -- fmt content                    # lay out fields and tables
cargo run -- fmt --check content            # report files that would change
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

(type ZoneIds (array string))

(def calendar-pace 24)
(def zones :type ZoneIds ["a" "b" "c"])
(def challenge-tuning :type Tuning :doc "The pace of a challenge run."
  (:pace 1 :incidentGap 720 :calendarPace calendar-pace))
```

`:type` and `:satisfies` take a type name, a type expression, or a string of raw TypeScript. The
type expression forms are `(array T)`, `(record K V)`, `(partial T)`, `(readonly T)`, `(union …)`,
and `(intersection …)`; a generic form such as `(Record K V)` also works. `(type NAME expression)`
writes a TypeScript type alias to `generated/types.ts`, and an annotation imports that name.

A name in kebab case is exported in SCREAM_CASE: `(def db-engines …)` writes `DB_ENGINES`, and
content may read it as `db-engines` or `DB_ENGINES`. A name with an uppercase letter is a TypeScript
name, such as `wideGlossary`, and keeps its casing.

When a family shares a prefix, write the prefix once. Each entry takes the exports of a `def`, and
the group's `:type` and `:satisfies` are defaults an entry can override:

```lisp
(constants scale :type const
  (targets [0.4 0.6 0.8])
  (in 0.6))
```

This writes `SCALE_TARGETS` and `SCALE_IN`. An entry named like the prefix exports the prefix
itself: `(constants regions (regions …) (from-stage 5))` writes `REGIONS` and `REGIONS_FROM_STAGE`.
The group name stays out of the generated module.

A family whose members belong to different modules lives in `content/families.qm` and names the
owning module on each entry: `(auth (move-dh :module team 120))`. The value is written to
`generated/team.ts`, and the module must be a content file stem. Within each generated module qmc
orders defs after the local defs they read, so moving an entry does not change initialization order.

A value is a number, a string, `true`, `false`, `null`, `undefined`, `Infinity`, the name of
another value, a row `[a b]` (an array), or a list. `(:key value …)` is a record, and
`(record "key" value …)` is one whose first key is not a plain name. `(... NAME)` spreads a value
into a row or record. `(ref NAME key 0)` reads a property. `(era NAME)` reads an Era id as the index of that Era.
`(+ a b)`, `(- a b)`, `(* a b)`, and `(/ a b)` are emitted as written, so the generated code
computes the same floating-point value the hand-written code did. `(as Type value)` is a type
assertion. `:type T` annotates the declaration, `:type const` writes `as const`, `:satisfies T`
writes `satisfies T`, and `:doc` writes a doc comment. `(types "path" Name …)` names the TypeScript
types an annotation uses.

Eras are declared by their id, such as `(era garage …)`. Research, incidents, and feature data name
that id, not an index: `:era garage` in a research or incident form, and `(era garage)` in a data
value.

### State and setters

A Component's writable settings are one `(state …)` form in the Component's content file. Each
`field` declares its type and default, plus an optional `(gate …)` and `(set …)`. qmc writes the
Effect Schema fields, the SCREAM_CASE tuples, and the setter:

```lisp
(state database
  (field shard-key (enum hash range tenant region) :default hash
    :schema ShardKey :values shard-key-values
    :set (setShardKey :refuse "Only a Database shards."))
  (field shards (one-of 1 2 4 8) :default 1
    :gate (sharding) :values shard-counts
    :set (setShards :refuse "Only a Database shards." :values-label "Shard counts"))
  (field topology (enum single sharded multi) :default single :schema DbTopology
    :set (setTopology :scope all-of-type)))
```

`:schema` names an enum or number Schema const. `:values` names the generated tuple. `:gate` names
the research, with a label or `:labels TABLE` when the research name is not what the refusal should
say. A field with `:required` has no default. A `(set …)` form names the setter and its `:refuse`
text, `:values-label`, and `:scope all-of-type`. A setter that needs more than those checks stays in
the `.rule.ts` file.

### Tables

A wide table is a header and rows. `:key` makes a record keyed by that column and drops the key
from each row; `:keep-key` keeps it. Without `:key` the value is an array of records. Every row has
the header's width, and a key is unique. A cell can be a map or a list. A `-` cell leaves that
column out of that row, so records with optional fields share one table:

```lisp
(table db-engines :key id
  [id name connections connectionMB read write]
  [postgres "PostgreSQL" max-connections 8 0.95 1.15]
  [mysql "MySQL" 500 1 1.05 0.85])
```

A key cannot be `-`. An omitted column is absent from the generated record, not `undefined`.

### Formatting

`qmc fmt` puts keyword fields one per line and aligns their values. It aligns table columns from the left, up to the first column wider than 28 characters; prose columns
stay compact because padding them makes the rows harder to scan. It keeps comments and the source spelling of numbers and strings.

```sh
cargo run -- fmt ../simulation/content
cargo run -- fmt --check ../simulation/content
```

`--check` prints every file that would change and exits with failure. Comments stay between forms;
the formatter refuses a comment inside a form because it has no field line to attach to. `pnpm check`
runs the check, and the `format:qm` script formats the content from the repository root.

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
- research, an incident, or a data value that names no declared Era
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
- a def that reads a value or names a type that does not exist, that reads itself or forms a cycle
  with other defs, that repeats a key in one record, or that takes a name another form declares
- a `:module` that names no content file
- a state that names no Component, appears twice, repeats a field or Schema name, or has a default
  outside its values
- a table whose rows do not match the header, whose columns repeat, whose key is not a column, or
  whose key repeats or is `-`

It warns about a requirement another requirement already implies, about an unused import, and about
an incident the Director cannot pick until an Era later than the one it names.

## Parallel and deterministic

Files are read, expanded, and lowered in parallel, the check passes run at once over the shared
catalog, and the generated files are written at once. Diagnostics are sorted by position and output
is written in dependency order with declaration order as the tie-break, so every run gives the same
bytes. Set `QMC_THREADS` to change the number of worker threads.
