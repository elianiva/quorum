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
