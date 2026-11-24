# qmc

qmc compiles the content files in `packages/simulation/content/*.qm` into the Simulation's catalog.
It is written in Rust with no dependencies outside `std`.

A content file is S-expressions. Numbers are exact fractions and can carry a unit: `2ms`, `300s`,
`44%`, `1.15x`, and `5_000`. `defmacro` takes a quasiquote template. A template substitutes its
arguments and runs no code, and a macro cannot expand into itself, so expansion always ends.

Files are read and expanded in parallel, and the checks run in parallel too. Diagnostics are sorted
by position and output is written in declaration order, so the result is the same on every run.
Set `QMC_THREADS` to change the number of worker threads.

```sh
cargo run -- expand file.qm   # print each file after macro expansion
cargo test
```
