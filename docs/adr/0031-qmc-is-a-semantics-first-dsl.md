# qmc is a semantics-first DSL

qmc starts from a small set of meanings, then gives each one syntax. A Component has state fields.
A field has a type, a default, and optionally a gate and a setter. A table is a header and rows. A
constant is a name and a value. Every generated export comes from one of those declarations.

This follows the semantics-driven approach to language design: choose a small composite semantic
core first, then add syntax that maps onto it. A syntax-first language accretes flags for each new
feature, and the flags stop composing. The core here is deliberately smaller than the catalog:

- `component`: the board entity and its metadata.
- `field`: one setting. Its type is `number`, `bool`, `(enum …)`, or `(one-of …)`. It has a
  `:default`, or `:required`, and optional `:schema` and `:values` names.
- `gate`: a field needs research. `(gate sharding)` or `(gate precompute "A view")`. The field is
  free at its default, so the default is the free value. A gate that does not follow that rule
  stays a standalone `(gate …)` in the Component's file.
- `set`: one simple action. `(set setShards :refuse "…" :values-label "Shard counts")` patches one
  Node, or every Node of the Component with `:scope all-of-type`.
- `table`: a header row and data rows, optionally keyed by one column. A `-` cell omits that column
  from one row.
- `def` and `const`: plain data. A kebab-case name exports in SCREAM_CASE. `(constants PREFIX …)`
  writes the prefix once for a family of defs. An entry named like the prefix is the base constant,
  and `:module` names the file that exports an entry in a cross-file family.
- `type`: a generated TypeScript alias for an annotation. Its expression is a name, a string, or a
  generic application such as `(array FeatureId)`.
- `id`: a generated Effect Schema for an array of string ids. `(id ComponentId COMPONENT_IDS)`
  writes `ComponentId` and its type to `generated/ids.ts`; the array comes from a generated table
  or a `def`.

The syntax is sugar over that core, not a second language. `:schema`, `:values`, `:gate`, and
`:set` are the only keys a field takes beyond its type and default. A setter that needs more than
the type, its values, the gate, and the scope stays in the Component's `.rule.ts` file. qmc does
not interpret arbitrary code.

Lisp earns its place here for three reasons. S-expressions give the compiler a uniform syntax tree
for every form, so the reader does not need a grammar per feature. Forms compose as data, so a
Component file can hold its Component, state, tables, and gates without a file-format layer.
Macros let repeated shapes stay sugar, such as a research that shares a framework's name and blurb,
without adding a keyword to the core. The risk is the usual one: macros compose badly when they
hide too much. qmc keeps macros for naming and repetition, and keeps the meaning of a form in Rust,
where diagnostics can point at the form that broke a rule.

A DSL is worth building here because the checks are cross-entry and repeated. TypeScript can say a
field is a number. It cannot say a default is one of the field's values, a gate names real research,
a table key is unique, or a Component file declares every field its schema exports. qmc checks
those rules once, reports every failure in one run, and writes the TypeScript and Rust that would
otherwise drift. A schema alone would catch the shape of one entry. It would not catch the catalog.

This costs a Rust compiler and a content language to learn. The language pays for itself when a
wrong catalog entry fails the build instead of a game state, and when one declaration replaces the
schema, the default, the gate, and the setter that used to live in three files.

Considered options:

- **A generic Lisp with arbitrary code.** Powerful, but every rule becomes a program qmc cannot
  check, and the generated TypeScript stops being predictable. Rejected.
- **More flat keys on `field`.** Easy to add, but `:requires`, `:what`, `:set`, `:only`,
  `:values-what`, and `:scope` describe compound things. Grouping them as `(gate …)` and `(set …)`
  keeps the field readable and the core small. Rejected.
- **Tables as nested records.** This is what the first port used. A wide table becomes a wall of
  `:key value` pairs and column names repeat in every row. A header and rows say the same thing in
  less space. Rejected.
- **Sparse rows as separate forms.** A table with a few optional fields could split into one table
  per shape, or fall back to `def`. Both repeat the header and hide that the rows describe one
  set. `-` keeps one header and one place for the set. Rejected.

## Consequences

- A Component file is self-contained: `content/components/database.qm` holds the Component, its
  state, its gates, and its tables. qmc writes `generated/database.ts` and
  `generated/database.rule.ts`. The exception is a cross-file constant family in
  `content/families.qm`, which names the owning module on each entry.
- `src/components` holds only behavior that needs more than the core: refusal copy that depends on
  another field, random rolls, incident responses, and calculations over several fields.
- The generated modules are build output. A checked-in data file for a Component would be a second
  source of truth, and qmc has a check for a name declared twice.
- Naming is content naming. A constant is written `db-engines`, exported `DB_ENGINES`, and read
  either way in content. A name with an uppercase letter is a TypeScript name and keeps its casing.
- qmc owns every catalog type. Content declares aliases with `(type …)` and ids with `(id …)`;
  the checked-in catalog TypeScript re-exports generated types instead of defining them.
- An Era is named by its content id, such as `garage`. The generated Era data keeps the numeric
  index the Simulation uses.
