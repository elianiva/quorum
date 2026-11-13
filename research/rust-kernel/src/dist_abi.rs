//! A flat ABI for the Outcome algebra: an `Outcome` is 19 `f64`s in the arena.
//!
//! Every function reads the `DIST_IN` block, writes `DIST_OUT`, and takes its
//! other arguments as scalars, so the harness can fuzz the algebra without a
//! pointer anywhere.

use crate::abi::{self, BLOCK_DIST_CALLS, BLOCK_DIST_IN, BLOCK_DIST_OUT};
use crate::dist::*;

pub const OUTCOME_LEN: usize = 19;

/// Reads an Outcome out of a block, or the zero Outcome when the block is short.
fn read(block: &[f64]) -> Outcome {
    let at = |index: usize| block.get(index).copied().unwrap_or(0.0);
    let mut outcome = Outcome {
        success: at(0),
        fixed_ms: at(1),
        variable_ms: at(2),
        tail_p: at(3),
        tail_ms: at(4),
        stale: at(5),
        value: at(6),
        ..Outcome::default()
    };
    for cause in 0..CAUSE_COUNT {
        outcome.fail[cause] = at(7 + cause);
    }
    outcome
}

/// Writes an Outcome into the `DIST_OUT` block.
fn write(outcome: &Outcome) {
    abi::with_outputs(|outputs| {
        let out = &mut outputs.dist_out;
        if out.len() < OUTCOME_LEN {
            return;
        }
        out[0] = outcome.success;
        out[1] = outcome.fixed_ms;
        out[2] = outcome.variable_ms;
        out[3] = outcome.tail_p;
        out[4] = outcome.tail_ms;
        out[5] = outcome.stale;
        out[6] = outcome.value;
        for cause in 0..CAUSE_COUNT {
            out[7 + cause] = outcome.fail[cause];
        }
    });
}

/// Runs `body` on the input Outcome, then writes the result.
fn unary(body: impl FnOnce(&Outcome) -> Outcome) -> i32 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    write(&body(&outcome));
    abi::OK
}

#[no_mangle]
pub extern "C" fn outcome_len() -> i32 {
    OUTCOME_LEN as i32
}

/// `through`: the calls block holds `count` pairs of (Outcome, weight).
#[no_mangle]
pub extern "C" fn through_flat(count: i32, stale_counts: i32) -> i32 {
    let (hop, entries) = abi::with_outputs(|outputs| {
        // A Hop rides in the input block as `share, fixed, variable, tailP,
        // tailMs, cause, value`: the Outcome shape with the cause in `stale`.
        let own = read(&outputs.dist_in);
        let hop = Hop {
            share: own.success,
            cause: (own.stale.max(0.0) as usize).min(CAUSE_COUNT - 1),
            fixed_ms: own.fixed_ms,
            variable_ms: own.variable_ms,
            tail_p: own.tail_p,
            tail_ms: own.tail_ms,
            value: own.value,
        };
        let mut entries = Vec::with_capacity(count.max(0) as usize);
        for index in 0..count.max(0) as usize {
            let base = index * (OUTCOME_LEN + 1);
            let row = outputs.dist_calls.get(base..base + OUTCOME_LEN).unwrap_or(&[]);
            let weight = outputs.dist_calls.get(base + OUTCOME_LEN).copied().unwrap_or(0.0);
            entries.push((read(row), weight));
        }
        (hop, entries)
    });
    write(&through(hop, &entries, stale_counts != 0));
    abi::OK
}

/// `blend`: the calls block holds `count` pairs. Returns 1 when it blended.
#[no_mangle]
pub extern "C" fn blend_flat(count: i32) -> i32 {
    let entries = abi::with_outputs(|outputs| {
        let mut entries = Vec::with_capacity(count.max(0) as usize);
        for index in 0..count.max(0) as usize {
            let base = index * (OUTCOME_LEN + 1);
            let row = outputs.dist_calls.get(base..base + OUTCOME_LEN).unwrap_or(&[]);
            let weight = outputs.dist_calls.get(base + OUTCOME_LEN).copied().unwrap_or(0.0);
            entries.push((read(row), weight));
        }
        entries
    });
    match blend(&entries) {
        Some(value) => {
            write(&value);
            1
        }
        None => 0,
    }
}

#[no_mangle]
pub extern "C" fn timed_out_flat(ms: f64) -> i32 {
    unary(|outcome| timed_out(*outcome, ms))
}

#[no_mangle]
pub extern "C" fn retried_flat(ms: f64) -> i32 {
    unary(|outcome| retried(*outcome, ms))
}

#[no_mangle]
pub extern "C" fn backed_off_flat(ms: f64, budget: f64) -> i32 {
    unary(|outcome| backed_off(*outcome, ms, budget))
}

#[no_mangle]
pub extern "C" fn fail_some_flat(share: f64, cause: i32) -> i32 {
    let cause = (cause.max(0) as usize).min(CAUSE_COUNT - 1);
    unary(|outcome| fail_some(*outcome, share, cause))
}

#[no_mangle]
pub extern "C" fn hedged_flat() -> i32 {
    unary(|outcome| hedged(*outcome))
}

#[no_mangle]
pub extern "C" fn answered_flat(fixed_ms: f64, variable_ms: f64) -> i32 {
    write(&answered(fixed_ms, variable_ms));
    abi::OK
}

#[no_mangle]
pub extern "C" fn failed_flat(cause: i32) -> i32 {
    let cause = (cause.max(0) as usize).min(CAUSE_COUNT - 1);
    write(&failed(cause));
    abi::OK
}

#[no_mangle]
pub extern "C" fn percentile_flat(q: f64) -> f64 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    percentile(&outcome, q)
}

#[no_mangle]
pub extern "C" fn held_for_flat(ms: f64) -> f64 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    held_for(&outcome, ms)
}

#[no_mangle]
pub extern "C" fn apdex_of_flat(target: f64) -> f64 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    apdex_of(&outcome, target)
}

#[no_mangle]
pub extern "C" fn slower_than_flat(ms: f64) -> f64 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    slower_than(&outcome, ms)
}

#[no_mangle]
pub extern "C" fn mean_of_flat() -> f64 {
    let outcome = abi::with_outputs(|outputs| read(&outputs.dist_in));
    mean_of(&outcome)
}

#[no_mangle]
pub extern "C" fn decay_flat(x: f64) -> f64 {
    decay(x)
}

#[no_mangle]
pub extern "C" fn task_attempts_flat(failure: f64, n: f64) -> f64 {
    task_attempts(failure, n)
}

#[no_mangle]
pub extern "C" fn task_lost_flat(failure: f64, n: f64) -> f64 {
    task_lost(failure, n)
}

#[no_mangle]
pub extern "C" fn kth_fastest_flat(k: f64, n: f64) -> f64 {
    kth_fastest(k, n)
}

#[no_mangle]
pub extern "C" fn combine_tail_flat(a: f64, a_ms: f64, b: f64, b_ms: f64) -> i32 {
    let (tail_p, tail_ms) = combine_tail(a, a_ms, b, b_ms);
    abi::with_outputs(|outputs| {
        if outputs.dist_out.len() >= 2 {
            outputs.dist_out[0] = tail_p;
            outputs.dist_out[1] = tail_ms;
        }
    });
    abi::OK
}

/// Keeps the block ids this module owns in one place, so the harness and the
/// arena cannot drift apart.
#[no_mangle]
pub extern "C" fn dist_blocks() -> i32 {
    (BLOCK_DIST_IN << 16) | (BLOCK_DIST_OUT << 8) | BLOCK_DIST_CALLS
}
