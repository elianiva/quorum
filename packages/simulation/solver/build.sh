#!/bin/sh
# Builds solver.wasm and copies it to ../src/solver.wasm. `pnpm --filter @quorum/simulation content`
# runs it after qmc writes src/catalog.rs.
#
# The remaps keep machine paths out of the module, so every checkout builds the same bytes.
set -eu
cd "$(dirname "$0")"
sysroot=$(rustc --print sysroot)
commit=$(rustc -vV | sed -n 's/^commit-hash: //p')
RUSTFLAGS="--remap-path-prefix=$sysroot/lib/rustlib/src/rust=/rustc/$commit --remap-path-prefix=$PWD=/solver --remap-path-prefix=${CARGO_HOME:-$HOME/.cargo}=/cargo"
export RUSTFLAGS
cargo build --release --target wasm32-unknown-unknown
built=target/wasm32-unknown-unknown/release/qsim.wasm
# An unchanged module is not rewritten, so a dev server does not reload for nothing.
cmp -s "$built" ../src/solver.wasm || cp "$built" ../src/solver.wasm
