# qmc

qmc compiles the content files in `packages/simulation/content/**/*.qm` into
`packages/simulation/src/generated/*.ts`. It is written in Rust with no dependencies outside `std`.

```sh
pnpm --filter @quorum/simulation content   # compile the content and write the generated files
cargo run -- build <content> <out> --solver <catalog.rs>  # what `content` runs
cargo run -- expand file.qm                 # print a file after macro expansion
cargo run -- fmt content                    # lay out fields, tables, and records
cargo run -- fmt --check content            # report files that would change
cargo test
```

## The language

A content file is S-expressions. Numbers are exact fractions and can carry a unit: `2ms`, `300s`,
`44%`, `1.15x`, and `5_000`. A field declares the unit it takes, so `:share 2s` is an error.

`defmacro` takes a quasiquote template. A template substitutes its arguments, joins names with
`(sym "fw-" id)`, and runs no code. A macro call is a top-level form, so a list in a data position
is never a call, and a macro cannot expand into itself, so expansion always ends.

Content refers to a generated value by its content name. qmc resolves the name through the whole
catalog and writes the import from the module that owns it. There is no hand-written import form and
no separate constant form: a number is a `def` like any other value.

### Plain data

A table or number that needs no rule of its own is a `def`. It lands in the generated file named
after its content file, so `content/tuning.qm` writes `generated/tuning.ts`:

```lisp
(type Tuning
  (readonly
    (object
      (pace number)
      (incidentGap number)
      (firstIncidentAfter number)
      (calendarPace number))))

(type ZoneIds (array string))

(def calendar-pace 24)
(def zones :type ZoneIds ["a" "b" "c"])
(def challenge-tuning :type Tuning :doc "The pace of a challenge run."
  (:pace 1 :incidentGap 720 :calendarPace calendar-pace))
```

`:type` and `:satisfies` take a type expression. A string is still accepted as raw TypeScript when
a type has no expression form yet. The structured forms are:

- `(array T)` and `(readonly T)`
- `(record K V)` and `(partial T)`
- `(object (field T) (optional? T) …)`
- `(literal "a" "b" 1 true null)`: one literal, or the union of several
- `(union T …)` and `(intersection T …)`
- `(exclude T U)`, `(keyof T)`, and a generic application such as `(Record K V)`
- `(keys-of value)` and `(item-of value)`: the keys of a `:type const` record or the items of a
  `:type const` array, so a type does not repeat a list the content already declares:
  `(type Axis (item-of axes))`

`(type NAME expression)` writes a TypeScript type alias to `generated/types.ts`, and an annotation
imports that name. qmc resolves those imports from the same content scope as values, so a type in a
component file can name a type from `types.qm` or a table id without an import.

A name in kebab case is exported in SCREAM_CASE: `(def db-engines …)` writes `DB_ENGINES`. Content
reads every value by its kebab name, including the generated values that no `def` declares:
`incidents` reads `INCIDENTS`, and `:ids runtime-ids` names the exported `RUNTIME_IDS`. A name with
an uppercase letter is a TypeScript name, such as `wideGlossary`, and keeps its casing.

When a family shares a prefix, write the prefix once. Each entry takes the exports of a `def`, and
the group's `:type` and `:satisfies` are defaults an entry can override:

```lisp
(constants scale :type const
  (targets [0.4 0.6 0.8])
  (in 0.6))
```

This writes `SCALE_TARGETS` and `SCALE_IN`. An entry named like the prefix exports the prefix
itself. A constants group stays in its own file. If two domains share an English word by accident,
they do not become one family.

A value is a number, a string, `true`, `false`, `null`, `undefined`, `Infinity`, the name of
another value, a row `[a b]` (an array), or a list. `(:key value …)` is a record, and
`(record "key" value …)` is one whose first key is not a plain name. `(... NAME)` spreads a value
into a row or record. `(ref NAME key 0)` reads a property. `(era NAME)` reads an Era id as the
index of that Era. `(+ a b)`, `(- a b)`, `(* a b)`, and `(/ a b)` are emitted as written, so the
generated code computes the same floating-point value the hand-written code did. `(as Type value)`
is a type assertion. `(mix :page 60% :read 40%)` is a record of request kind shares; qmc checks it
like an Era's mix, so the shares name declared kinds and sum to exactly 100%. `:type T` annotates the declaration, `:type const` writes `as const`,
`:satisfies T` writes `satisfies T`, and `:doc` writes a doc comment.

Eras are declared by their id, such as `(era garage …)`. Research, incidents, and feature data name
that id, not an index: `:era garage` in a research or incident form, and `(era garage)` in a data
value.

### State and setters

A Component's writable settings are one `(state …)` form in the Component's content file. Each
`field` declares its type and default, plus an optional gate and setter. qmc writes the Effect
Schema fields, the SCREAM_CASE tuples, and the setter:

```lisp
(state database
  (field shard-key (key-of shard-keys)
    :default hash
    :schema  ShardKey
    :values  shard-key-values
    :set     (setShardKey :refuse "Only a Database shards."))
  (field shards (one-of 1 2 4 8)
    :default 1
    :values  shard-counts
    :gate    (sharding)
    :set     (setShards :refuse "Only a Database shards." :values-label "Shard counts"))
  (field topology (enum single sharded multi)
    :default single
    :schema  DbTopology
    :set     (setTopology :scope all-of-type)))
```

A field type is `number`, `bool`, `(enum …)`, `(one-of …)`, or `(key-of table)`. `(key-of table)`
takes the keys of a keyed `table` or `records` form, so the state does not repeat them. A `one-of`
emits `Schema.Literals` over the allowed values, not `Schema.Finite`. `:schema` names an enum,
one-of, or number Schema const. `:values` names the generated tuple. A field with `:required` has
no default. A `(set …)` form names the setter and its `:refuse` text, `:values-label`, and
`:scope all-of-type`. A setter that needs more than those checks stays in the `.rule.ts` file.

A setting that needs research uses `:gate`:

```lisp
(field compress bool :default false :gate (gzip "Gzip" :lock-all))
(field precision (key-of gpu-precisions) :default fp16 :schema GpuPrecision
  :gate (quantization :labels gpu-precisions))
(field store-variant (key-of store-variants) :default s3 :schema StoreVariant
  :gate (egress-optimization "R2" :locked ("r2")))
```

`:locked` lists the only values the research locks. `:lock-all` locks every value, which is how a
boolean setting refuses before its research. Without either, the default is the free value. A gate
belongs to the field it locks, so qmc can check that the field is declared on that Component.
`GATES` in `generated/components.ts` holds them, keyed `component.field`, and a rule calls
`locked(game, 'database.keep', keep)`.

### Tables and records

A narrow table is a header and rows. `:key` makes a record keyed by that column and drops the key
from each row; `:keep-key` keeps it as a string, so a key is written bare: `[php "PHP" …]`. Without `:key` the value is an array of records. Every row has
the header's width, and a key is unique. A cell can be a map or a list. A `-` cell leaves that
column out of that row, so records with optional fields share one table:

```lisp
(table db-engines :key id
  [id name connections connectionMB read write]
  [postgres "PostgreSQL" max-connections 8 0.95 1.15]
  [mysql "MySQL" 500 1 1.05 0.85])
```

A wide or nested catalog is a `records` form instead. Each entry reads like a record, the key column
is copied into the entry, and omitted fields stay omitted. `:defaults NAME` spreads a shared record
into every entry. `:ids` exports the key array and `:id-type` generates its Effect Schema. `:array`
makes the value an array of entries rather than a keyed record.

`:refs (:column table …)` says a column holds keys of another keyed table. qmc checks each value,
and a bare name in that column is the key itself, so `:language php` and
`:glossary [cold-start tech-debt]` need no quotes. A ref column may also hold a list of keys or
`null`.

`:export-rust` marks a table or def whose columns the Solver catalog exports. Every row of such a
table fills every column with one type of value, because the Solver reads each column as one Rust
array. A table that also has
`:ids` gets a Rust module named after the id array without `_IDS`, so `SEARCH_VARIANT_IDS` becomes
`search_variant`. The `(solver …)` form in `content/solver.qm` declares everything else the Solver
reads; see [The Solver catalog](#the-solver-catalog).

```lisp
(constants runtime
  (defaults
    :satisfies (partial RuntimeDef)
    (:pool false :threads 1 :persistent true :parallel false :blocking null :gc null)))

(records runtimes
  :defaults runtime-defaults
  :key      id
  :ids      runtime-ids
  :id-type  RuntimeId
  :refs     (:language languages :glossary glossary)
  :type     (record RuntimeId RuntimeDef)
  (puma
    :axes           (:throughput 3 :tail 3 :memory 2 :velocity 4 :resilience 4 :operability 2)
    :glossary       [gil-global-interpreter-lock cold-start]
    :language       ruby
    :name           "Puma"
    :model          "threads"
    :speed          0.25
    :memoryMb       180
    :threads        5
    :connections    5
    :startupSeconds 10
    :warmFrom       0.9
    :warmup         15
    :connectionKB   100
    :research       "lang-ruby"
    :blurb          "One process per core, 5 threads each. Threads overlap waits; the GVL keeps CPU on one core."))
```

`(records glossary :array :key id …)` emits an array of records, not a keyed record. An id array
from a table or records form is the only declaration of that list. A separate `(id NAME VALUES)`
form remains for a plain `def` array that no table owns.

### Component glossary

A Component keeps its glossary ids on the component itself:

```lisp
(component queue
  :code queue
  :name "Queue"
  :glossary (at-least-once-delivery backpressure dead-letter-queue transactional-outbox)
  …)
```

qmc writes `COMPONENT_GLOSSARY` into `generated/components.ts` and checks every id against the
keys of the `glossary` records. Runtimes, frameworks, and the glossary's own `related` lists name
glossary ids through `:refs`.

### Formatting

`qmc fmt` puts keyword fields one per line and aligns their values. Tables align their columns from
the left, up to the first column wider than 28 characters. Records put each entry's fields on their
own lines and align the keys, so a catalog reads as fields instead of one horizontal line. The
formatter keeps comments and the source spelling of numbers and strings.

```sh
cargo run -- fmt ../simulation/content
cargo run -- fmt --check ../simulation/content
```

`--check` prints every file that would change and exits with failure. Comments stay between forms;
the formatter refuses a comment inside a form because it has no field line to attach to. `pnpm check`
runs the check, and the `format:qm` script formats the content from the repository root.

### Generated registries

qmc writes `generated/fields.ts`, which spreads each Component's generated `*Fields` object into
`COMPONENT_FIELDS` and lists the same fields in `COMPONENT_FIELD_ORDER`. A new `(state …)` field
reaches `GameNode` without a TypeScript list to edit. `generated/components.ts` holds
`COMPONENT_GLOSSARY`, and `generated/database.ts`, `gpu.ts`, `search.ts`, and `waf.ts` hold the
Effect Schemas for their state values.

### The Solver catalog

`--solver ../simulation/solver/src/catalog.rs` also writes the Rust Solver's catalog. The content
owns that ABI: `content/solver.qm` holds one `(solver …)` form, and each clause in it names one
Rust item and the catalog value it reads.

- `(axis NAME :of LIST…)` is an ordered set of ids. `:count`, `:names`, and `:module` write its
  length, its ids, and a `usize` constant per id. `:index` and `:test` write lookup functions.
- `(columns SOURCE :over AXIS (NAME FIELD) …)` writes one array per field, with one value per id
  on the axis. `:default` fills a missing value, `:index AXIS` writes a value's position, and
  `:enum E` writes a Rust enum built from the distinct values.
- `(matrix NAME SOURCE :field F :rows AXIS :cols AXIS)` writes a two-dimensional array.
- `(masks …)` and `(mask NAME LIST :bits AXIS)` write `u128` bit sets. qmc adds a compile-time
  assertion that the axis has at most 128 ids.
- `(member NAME LIST :over AXIS)` writes a flag per id. `(pairs NAME SOURCE :over AXIS :join "-")`
  writes a symmetric matrix from keys such as `a-b`.

Every `:export-rust` table writes its columns, and every other scalar def, a number, flag, string,
or list of numbers or strings, becomes a Rust constant. The file ends with `SCALAR_COUNT` and
`CATALOG_HASH`, a SHA-256 prefix that the Simulation compares with the built module.

qmc evaluates the declarations from the checked catalog in `value.rs`, not from the generated
TypeScript. `value.rs` follows JavaScript's rules: decimal literals become doubles, record keys
keep `Object.keys` order, spreads and arithmetic give the same result, and numbers print as
`String(n)` prints them. The Solver and the Simulation therefore read the same floating-point
values. A clause that names an unknown value, field, or axis, or a value that is not on its axis,
is an error, and two clauses that write one Rust name are an error.

## The checks

qmc refuses content that contradicts itself and reports every problem in one run:

- a name defined twice, or a reference to a research, track, shape, or value that does not exist,
  with the closest name as a suggestion
- research whose requirements loop back to it, with the loop spelled out
- research that requires research from a later Era
- a study shape with a missing or unknown field, a value in the wrong unit, or a share outside
  0% to 100%
- an empty or repeated Insight pool list, and two entries that unlock one framework
- a traffic mix whose shares do not sum to exactly 100%, or that lists a kind twice
- a `(mix …)` value anywhere in the data whose shares name an unknown request kind or do not sum
  to 100%
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
- a gate on a research that does not exist, a gate whose field is not declared on that Component,
  a gate that locks no value or names a value twice, a `:labels` table that is not a keyed record
  or lacks a value the gate lists, and, as a warning, a gate on the research that already unlocks
  the component
- a def that reads a value or names a type that does not exist, that reads itself or forms a cycle
  with other defs, that repeats a key in one record, or that takes a name another form declares
- a key-of that names no keyed table, or a default outside that table's keys
- a state that names no Component, appears twice, repeats a field or Schema name, or has a default
  outside its values
- a table or records form whose rows do not match the header, whose columns repeat, whose key is
  not a column, or whose key repeats or is `-`
- a `:refs` column value that is not a key of its table, a `:refs` table that does not exist, and
  a component glossary id that is not a key of `glossary`
- a `:research` cell in a keyed table that is not a research id or null
- an `:export-rust` table with a row that leaves out a column, or a column that mixes numbers,
  flags, strings, and `null`
- a `(solver …)` clause that names an unknown value, field, or axis, reads a value that is not on
  its axis, or writes a Rust name another clause or scalar already writes

It warns about a requirement another requirement already implies, and about an incident the
Director cannot pick until an Era later than the one it names.

## Parallel and deterministic

Files are read, expanded, and lowered in parallel, the check passes run at once over the shared
catalog, and the generated files are written at once. Diagnostics are sorted by position and output
is written in dependency order with declaration order as the tie-break, so every run gives the same
bytes. Set `QMC_THREADS` to change the number of worker threads.
