# Patterns this kernel uses, and why

Before writing more Rust I read what the ecosystem currently recommends for a numeric
kernel compiled to `wasm32-unknown-unknown`. This note records the sources, what they
say, and which pattern each one changed in the crate. The short version: the port is
data-oriented and pointer-free, and the boundary is a set of named blocks rather than a
set of pointers.

## Sources

- Rust Performance Book, [Data layout](https://nnethercote.github.io/perf-book/type-sizes.html)
  and [Bounds checks](https://nnethercote.github.io/perf-book/bounds-checks.html).
- The Rust standard library's [Data Types and Layout](https://doc.rust-lang.org/std/#data-types-and-layout)
  guidance on `Vec<T>` as the default contiguous container.
- `core::attribute.inline` reference, <https://doc.rust-lang.org/stable/core/attribute.inline.html>.
- The standard library developers' guide, [When to `#[inline]`](https://std-dev-guide.rust-lang.org/policy/inline.html).
- The wasm-bindgen guide, [Number Slices](https://wasm-bindgen.github.io/wasm-bindgen/reference/types/number-slices.html)
  and [`slice`/`vec` attributes](https://wasm-bindgen.github.io/wasm-bindgen/reference/attributes/on-js-imports/slice.html).
- The Rust Programming Language, [To panic or not to panic](https://doc.rust-lang.org/book/ch09-03-to-panic-or-not-to-panic.html).
- Rustonomicon, [Data layout](https://doc.rust-lang.org/nomicon/data.html), for why the
  typed-array views below are a *layout* contract and not a language one.
- The Rust reference on [`chunks_exact`](https://doc.rust-lang.org/std/primitive.slice.html#method.chunks_exact)
  and [`windows`](https://doc.rust-lang.org/std/primitive.slice.html#method.windows).

## What the sources say, and what this crate does

### Struct of arrays with `u32` indices, not an object graph

The layout advice is consistent: an array of structs is for object-centric logic, and a
struct of arrays is for numeric kernels and batch passes, because the inner loop should
read the fields it needs and nothing else. Pointer-heavy graphs are called out as the
worst case for locality, with an arena-backed contiguous store as the fix.

Adopted: `Design` holds `nodes: Vec<RouteNode>` and `edges: Vec<RouteEdge>`, both `Copy`
rows indexed by `u32`, and adjacency is CSR — `out_edges[out_starts[n]..out_starts[n+1]]`
is one contiguous slice per Node. Every memo in the outcome walk is a flat `Vec` indexed
by `slot * NK + kind`, so a tree walk touches one allocation per table and no pointers.
The pass's per-Node figures are columns (`Vec<Rates>`, `Vec<Model>`), and a Node is
identified by its slot everywhere: `Edge.to` is a `u32` slot, never a reference.

Where the crate still uses a struct of fields rather than pure SoA (`Node`, `RouteNode`)
it is because every rule reads most of the row; splitting those would add names without
removing traffic.

### Arena and slab allocation for the graph

The guidance is to build the graph once, in a bump or arena allocator, and hand out
indices. Rust's `typed-arena` and `bumpalo` do that with lifetimes; `slotmap` does it with
generational handles when entries are removed.

Adopted, without a dependency: the Design is the arena. It is compiled once per Design
and cached in a `thread_local`, the tables are plain `Vec`s that never shrink, and the
scratch lists a split needs (`Scratch`) are cleared rather than reallocated. Generational
handles are unnecessary because Nodes are never removed during a solve; a slot is stable
for the life of the Design.

The one allocation pattern that mattered for speed was the outcome memo: a fresh tree per
pass, three more per Bottleneck candidate. The first version allocated six `Vec`s per
tree — about five megabytes zeroed per solve. `Memo` now owns the tables and `reset` only
clears the `u8` done-flags, so a solve reuses one arena of memo slots. That alone took
`bottleneckOf` from 0.62× to 1.27× of the TypeScript.

### Iterator chains, `chunks_exact`, and bounds checks

The Performance Book's bounds-check advice is to help LLVM prove the index is in range:
iterate rather than index, use `chunks_exact` when the stride is fixed, and keep the hot
loop over a slice whose length the compiler can see.

Adopted: every block the ABI reads is walked with `chunks_exact(NODE_FIELDS)` or
`chunks_exact(EDGE_FIELDS)`, so a row read cannot index past its row. Arithmetic loops
that combine two arrays at the same index use `iter().zip()` where that reads better than
`a[i] + b[i]`. Where an index genuinely can be out of range — a slot that came from the
host, an Edge that names a missing Node — the crate uses `get()`/`get_mut()` and returns a
status instead of relying on a panic; the compiler keeps the check, and the check is the
point.

Deliberately not done: no `unsafe` `get_unchecked`, no `unsafe` slice construction from
pointers, no manual SIMD. The constraint for this experiment is no `unsafe` anywhere, and
none of the above needed it.

### `#[inline]` and codegen settings that matter for wasm

The reference and the std-dev-guide agree on what `#[inline]` actually does: it is not a
hint so much as permission to codegen the body into every referencing codegen unit, and
its real value is *crossing a crate boundary*, where the callee's body is otherwise
unavailable. `#[inline(always)]` is called out as almost never needed.

Adopted: `#[inline]` stays on the small, hot, cross-module helpers (`hop`, `through`,
`blend`, `timed_out`, `held_for`, `decay`, `percentile`), and on accessors that are one
index away from a field. With `lto = true` and `codegen-units = 1` in the release profile
the compiler already sees the whole crate, so no new `#[inline]` was added to private
functions that only one module calls.

Codegen settings, unchanged from the crate's first commit and confirmed as the current
advice: `opt-level = 3`, `lto = true`, `codegen-units = 1`, `panic = "abort"`. `panic =
"abort"` is what makes a panic a trap in wasm; since the crate returns status codes
instead, it is now a backstop rather than a control path. `wasm-opt` is not run: the
harness loads the raw `cargo` output, and the numbers below are for that artifact.

### No `unwrap`, no `panic`, and `Option`/`Result` at the boundary

The book's guidance is that a library should panic only when continuing would be unsound,
and return `Result` when the caller can act. At an FFI boundary a panic is worse than an
error: it traps the module and takes the caller's state with it.

Adopted: the exported functions have no `unwrap`, no `expect`, no indexing that can panic,
and no arithmetic that can overflow a slot count without a checked conversion. They return
an `i32` status: `0` ok, `3` a short block, `4` an Edge that names a Node outside the
Design, `6` a Component or Game outside the ported surface, and so on. Inside the crate,
`Option` is used where absence is meaningful (`blend` returns `None` when there is nothing
to mix, `value_factor` returns `None` when a Game ships a Feature the port has not
reached), and `unwrap_or_else`/`match` everywhere else.

This is also the fix for the panic this branch started with. `forward.ts` wrote four
fields per Edge while the ABI read eight, so the Edge's target slot was whatever the next
buffer happened to hold, and `Design::new` indexed past its `indegree` vector. The read is
now length-checked against the block, and a mismatch is status 3, not a trap.

### The boundary: a flat typed-array ABI, not wasm-bindgen

The wasm-bindgen guide is explicit about what a `&[f64]` parameter gives you: a zero-copy
typed-array view into linear memory that is valid only for the duration of the call, and
that *detaches* if wasm memory grows during it. That is the right shape for a numeric
kernel, and it is also the reason to keep the number of crossings small.

Adopted: no `wasm-bindgen` and no generated glue. The crate exports named blocks —
scalars, node fields, edge fields, CSR starts and edges, weights, demand, intake, latency,
probes, routes, research and feature bitsets — each a `Vec` the crate owns. The host asks
for `ptr(block)` and writes through a `Float64Array` view; the kernel sizes its own output
blocks and the host re-reads the pointer after any call that may have grown memory. A
solve therefore crosses the boundary a fixed number of times (one `design_set`, one
`solve_run`, one `bottleneck_run`), not once per Node.

`wasm-bindgen` would remove the manual `ptr`/`reserve` dance, but it would also add a
build step and a second source of truth for the block layout, and it copies `Vec` returns
rather than lending them. For a kernel whose whole point is to keep the working set in
linear memory, the flat ABI is the smaller machine. The cost is the contract documented
above: a stale view after a growing call, and a host that must respect each block's length.
Both are checked where they can be (`reserve` returns a status, `ptr` returns 0 for an
unknown block, and every run validates its blocks before reading them).

## Second pass: hoist what does not change

A profile of the first version put 20% of the time in `calls_of`, 9% in `split`, and 5%
in string matches (`research_index`, `component_index`, `kind_index`). All three answered
questions whose inputs do not change during a solve. Data-oriented design calls this out
first: find out what changes how often, and compute each thing at the rate its inputs
change. The changes below follow that rule. Each one kept 1,849/1,849 Ledger figures
identical.

| Step | `solveFlow` | `bottleneckOf` |
| --- | --- | --- |
| Before | 1,891 µs | 1,927 µs |
| Names become typed constants and enums | 1,784 µs | 1,776 µs |
| `callsOf` table, split cache, no per-visit `Vec`, candidates skip feedback | 976 µs | 1,031 µs |
| Search reuses the flow solve's Ledger | 961 µs | 479 µs |
| Epoch memo, workspace kept across runs | 868 µs | 410 µs |
| `cpuBase` in the code table, code table kept while inputs hold | 790 µs | 338 µs |

### Names are types, not strings

`gen-catalog.ts` now emits `kind::LOGIN`, `component::SERVER`, `research::OPCACHE`, and the
same for backends, runtimes, and languages, as `usize` constants. It also emits the
`Concurrency` and `Blocking` enums for a runtime's model. `GameCtx::has` takes a bit
index. `Incident` is an enum, not a `&'static str`. A typo is now a compile error instead
of a lookup that returns "not found", and a rule's `match` on a type code is a jump table.

### Compute at the rate the inputs change

- `CodeTable` holds `callsOf` and `cpuBase` for each Node that runs code. Both read only
  the Game, the Node, and its `ServerFlags`, so the run function builds the table once and
  keeps it in a `thread_local` workspace until those inputs differ.
- `Splits` caches every (Node, kind) split in one flat list. A split records whether it
  read the Weights. `reset` keeps the ones that read only the Design and drops the rest,
  so a new pass recomputes only the Load Balancer and weighted splits. The cache also
  stores the Design's generation, so a different Design with the same Node count can never
  read stale splits. A scratch harness solved Design A and then Design B and compared the
  bytes with a fresh B. With the generation check removed, that harness fails.
- The flow solve leaves its Ledger and state behind, and `bottleneck_run` ranks that
  Ledger instead of solving again. This is the same thing `bottleneckOf(game, flow)` does
  in TypeScript.
- A Bottleneck candidate drops its state, so its last pass skips the feedback that only a
  next pass reads (`held`, failure shares, in-flight work). A scratch probe boosted all 200
  Nodes at 1 to 3 passes and compared revenue with and without the shortcut: 600 of 600
  results were bit-identical.

### Reset is a counter, not a fill

`Memo` stamps each entry with an epoch. Starting a tree increments the epoch, so the
tables are never zeroed between walks, and the stamps are cleared once when the counter
wraps. The memo, split cache, and code table live in one `Workspace` for the life of the
module. Repeated runs therefore allocate nothing for them.

### No heap on the hot path

`server_model` collects the arriving kinds into a `[usize; NR]`, not a `Vec`. The tree
blends a split with `Blend`, which accumulates one entry at a time in the same order as
`blend`, and `answer_calls` fills a `[_; NB]` array. `Pass::route` is a method on the pass
it writes, which replaces a function that took twelve arguments.

### Tried and dropped

`-C target-feature=+simd128` changed nothing measurable, because the hot loops are
branchy and short, not wide arithmetic. It is not enabled.

## Challenge boards

The stress board exercises the ported Components. The Challenges exercise the game, so
`challenges.ts` compares every opening board, and `forward.ts <id>` compares one board's
first pass. Porting six more rules found these bugs, each confirmed on a board before the
fix and gone after it:

- The Database model read `q-scan` at backend index 6, which is `task`. Report scans cost
  nothing, so postgres-for-everything served 1.6% too many requests. Every backend index
  in `database_model` is now a `backend::` constant. `completions_of` had the same kind of
  slip (`callout` for `task`), which no supported board reached yet.
- The pass never read the retry failure shares the solve carried, and the blend treated a
  stored 0 as "never seen". exactly-once missed a 2.4e-8 retried share into the PSP. The
  shares now start as NaN, seed from `link.failure` on a fresh solve, and reach the pass.
- `placeMs` charged the cross-region round trip into a spread Wide-column Store, and
  `zoneMs` charged a zone hop to provider APIs, the regional LB, WAF and API Gateway, and
  spread stores. follow-the-sun was 49 ms slow on every kind.
- `game.scenario.value` never reached the kernel. A new input block carries it per kind,
  and gpu-economics now earns the same.
- The probe ignored the start state. A Bottleneck candidate re-probes its boosted Node,
  and TypeScript's probe reads that Node's carried call latency and connections. Rust read
  zero, so thirteen-engineers boosted each server into 2.37 of revenue instead of 1.01.
- The final tree routed with the Weights and sick set the last pass produced, not the ones
  it ran with. Only a solve that runs out of passes sees the difference, and none of the 22
  boards did, but it is what `outcomesOf(inputs, pass)` reads.

## Queues, Workers, and whole runs

An opening board has empty Queues, cold Nodes, and no carried failures, so
`trajectory.ts` plays each Challenge's canonical run through `beginRun` and `advanceRun`
and compares the Game after every Step. The untouched runs reach Queue backlogs, Workers
that drop tasks, warm-up, and Links that carry a failure share into the next Step. A
scratch variant gave every Queue a dead-letter queue, 3 attempts, and a full backlog, and
compared 3,200 more states. Porting Queue and Worker, and running whole runs, found:

- The harness wrote incident 0 for every Game, and the kernel decoded only 4 incident
  kinds. A run with a scripted incident was solved as if none ran. The slot now holds the
  `INCIDENT_IDS` index plus one, and any incident is refused.
- `pass_repeats` left out the resource gauges, the backend kinds' service times, and the
  service mask. On hello-world, Apache's in-flight work moves its memory but not its
  capacity, so Rust stopped a pass early and carried a different in-flight figure into
  the Bottleneck search.
- A Worker's model is `serverModel` over its task mix, once per attempt. Its attempts come
  from its Queue's dead-letter setting and the task failure share the last pass fed back,
  which the solve now carries. The task mix falls back to the Era's mix, which the kernel
  now reads from the probe block, where it had weighted kinds by their offload share.
  `mix_feed` reads the same mix instead of 0.
- `repeated` added `sent - rate * weight` in one step; TypeScript adds `sent` and then
  subtracts, which rounds differently. metastable showed it once its incident was out of
  the way.

## Cache and WAF

Only healthcare-launch has a Cache and only regex-of-doom a WAF, each at its defaults, and
healthcare-launch's Cache has no Link to the Database until the player adds one. A Cache
with no store behind it takes no reads, so its runs say nothing about the hit ratio. A
scratch sweep added that Link and the research, then played every strategy, TTL class,
stampede guard, engine, and two sizes, warm and cold, plus every paranoia level with and
without Under attack mode: 1,248 states with 493 distinct revenues, all identical.

`gen-catalog.ts` now emits string columns other than `name` (`CACHE_STRATEGIES_WRITE`) and
treats a single settings object such as `UNDER_ATTACK` as a table of one row. `grown`
replaces the loop inside `flat_scale`, written as TypeScript writes it, so a Memcached box
below size 3 divides instead of multiplying.

## Incidents

Every incident kind now decodes. Kinds with no effect on a figure the solve reads decode
to `Incident::Elsewhere`, so the kernel refuses only a code it does not know. A scratch
sweep forced each of the 56 kinds on every Challenge board and compared the first 6 Steps.
It found:

- A TypeScript rates record sums its kinds in the order they were first written, not in
  index order. An attack appends `bot` after the mix when the mix has no bots, and a Node
  that gets `blob-get` from a Server before `blob-put` from a Worker holds them in that
  order. No single order fits a whole board: on rule-of-40 one Node gets `q-read` first
  and another `q-write`. The pass now keeps an `Order` per Node, filled in `route`, and
  the serve loops, `flat_model`, and the Ledger's inbound, latency, and busiest kind walk
  it. The rates themselves stay dense arrays.
- A Server's task mix came from its rates after the share. TypeScript takes it from the
  arriving record, and `sharesOf` rounds the two differently once a Server is overloaded.
- A stuffing bot costs an App Server a login. `cpu_base` and the server model now read
  the kind's profile, as `profileOf` does.
- jvm-warmup differed only when the sweep reused one Game object across solves.
  TypeScript caches a server's table by Design, and the cache misses the warm-up change.
  With a deep copy per solve (`FRESH=1`) the figures are identical, so the kernel is right.

