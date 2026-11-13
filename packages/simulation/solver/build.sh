#!/bin/sh
# Builds solver.wasm and copies it to ../src/solver.wasm. With --check, it compares the build
# with the committed file instead and fails when they differ.
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
if [ "${1:-}" = "--check" ]; then
  if ! cmp -s "$built" ../src/solver.wasm; then
    echo "src/solver.wasm is not the build of this source. Run packages/simulation/solver/build.sh and commit it." >&2
    exit 1
  fi
  echo "src/solver.wasm matches the build."
else
  cp "$built" ../src/solver.wasm
fi
