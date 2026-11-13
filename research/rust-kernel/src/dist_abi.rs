//! A flat ABI for the Outcome algebra: an `Outcome` is 19 `f64`s in linear
//! memory (seven figures, then twelve failure shares).

use crate::dist::*;

pub const OUTCOME_LEN: usize = 19;

#[inline]
unsafe fn read(pointer: *const f64) -> Outcome {
    let mut outcome = Outcome::default();
    outcome.success = *pointer;
    outcome.fixed_ms = *pointer.add(1);
    outcome.variable_ms = *pointer.add(2);
    outcome.tail_p = *pointer.add(3);
    outcome.tail_ms = *pointer.add(4);
    outcome.stale = *pointer.add(5);
    outcome.value = *pointer.add(6);
    for cause in 0..CAUSE_COUNT {
        outcome.fail[cause] = *pointer.add(7 + cause);
    }
    outcome
}

#[inline]
unsafe fn write(outcome: &Outcome, pointer: *mut f64) {
    *pointer = outcome.success;
    *pointer.add(1) = outcome.fixed_ms;
    *pointer.add(2) = outcome.variable_ms;
    *pointer.add(3) = outcome.tail_p;
    *pointer.add(4) = outcome.tail_ms;
    *pointer.add(5) = outcome.stale;
    *pointer.add(6) = outcome.value;
    for cause in 0..CAUSE_COUNT {
        *pointer.add(7 + cause) = outcome.fail[cause];
    }
}

#[no_mangle]
pub extern "C" fn outcome_len() -> i32 {
    OUTCOME_LEN as i32
}

/// `through`: `calls` is `count` pairs of (Outcome, weight), laid out back to back.
#[no_mangle]
pub extern "C" fn through_flat(
    own: *const f64,
    calls: *const f64,
    count: i32,
    stale_counts: i32,
    out: *mut f64,
) {
    unsafe {
        let hop = Hop {
            share: *own,
            cause: *own.add(1) as usize,
            fixed_ms: *own.add(2),
            variable_ms: *own.add(3),
            tail_p: *own.add(4),
            tail_ms: *own.add(5),
            value: *own.add(6),
        };
        let mut entries = Vec::with_capacity(count as usize);
        for index in 0..count as usize {
            entries.push((read(calls.add(index * (OUTCOME_LEN + 1))), *calls.add(index * (OUTCOME_LEN + 1) + OUTCOME_LEN)));
        }
        write(&through(hop, &entries, stale_counts != 0), out);
    }
}

#[no_mangle]
pub extern "C" fn blend_flat(entries: *const f64, count: i32, out: *mut f64) -> i32 {
    unsafe {
        let mut list = Vec::with_capacity(count as usize);
        for index in 0..count as usize {
            list.push((read(entries.add(index * (OUTCOME_LEN + 1))), *entries.add(index * (OUTCOME_LEN + 1) + OUTCOME_LEN)));
        }
        match blend(&list) {
            Some(value) => {
                write(&value, out);
                1
            }
            None => 0,
        }
    }
}

#[no_mangle]
pub extern "C" fn timed_out_flat(input: *const f64, ms: f64, out: *mut f64) {
    unsafe { write(&timed_out(read(input), ms), out) }
}

#[no_mangle]
pub extern "C" fn retried_flat(input: *const f64, ms: f64, out: *mut f64) {
    unsafe { write(&retried(read(input), ms), out) }
}

#[no_mangle]
pub extern "C" fn backed_off_flat(input: *const f64, ms: f64, budget: f64, out: *mut f64) {
    unsafe { write(&backed_off(read(input), ms, budget), out) }
}

#[no_mangle]
pub extern "C" fn fail_some_flat(input: *const f64, share: f64, cause: i32, out: *mut f64) {
    unsafe { write(&fail_some(read(input), share, cause as usize), out) }
}

#[no_mangle]
pub extern "C" fn hedged_flat(input: *const f64, out: *mut f64) {
    unsafe { write(&hedged(read(input)), out) }
}

#[no_mangle]
pub extern "C" fn answered_flat(fixed_ms: f64, variable_ms: f64, out: *mut f64) {
    unsafe { write(&answered(fixed_ms, variable_ms), out) }
}

#[no_mangle]
pub extern "C" fn failed_flat(cause: i32, out: *mut f64) {
    unsafe { write(&failed(cause as usize), out) }
}

#[no_mangle]
pub extern "C" fn percentile_flat(input: *const f64, q: f64) -> f64 {
    unsafe { percentile(&read(input), q) }
}

#[no_mangle]
pub extern "C" fn held_for_flat(input: *const f64, ms: f64) -> f64 {
    unsafe { held_for(&read(input), ms) }
}

#[no_mangle]
pub extern "C" fn apdex_of_flat(input: *const f64, target: f64) -> f64 {
    unsafe { apdex_of(&read(input), target) }
}

#[no_mangle]
pub extern "C" fn slower_than_flat(input: *const f64, ms: f64) -> f64 {
    unsafe { slower_than(&read(input), ms) }
}

#[no_mangle]
pub extern "C" fn mean_of_flat(input: *const f64) -> f64 {
    unsafe { mean_of(&read(input)) }
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
pub extern "C" fn combine_tail_flat(a: f64, a_ms: f64, b: f64, b_ms: f64, out: *mut f64) {
    let (p, ms) = combine_tail(a, a_ms, b, b_ms);
    unsafe {
        *out = p;
        *out.add(1) = ms;
    }
}

/// Runs `count` percentiles inside the kernel, so the host pays one call
/// instead of one per percentile. Returns the sum, so the work is not elided.
#[no_mangle]
pub extern "C" fn percentile_batch(input: *const f64, q: f64, count: i32) -> f64 {
    unsafe {
        let outcome = read(input);
        let mut total = 0.0;
        for _ in 0..count {
            total += percentile(&outcome, q);
        }
        total
    }
}

/// The same for `through`, so a pass can build every Outcome in one call.
#[no_mangle]
pub extern "C" fn through_batch(
    own: *const f64,
    calls: *const f64,
    call_count: i32,
    stale_counts: i32,
    count: i32,
) -> f64 {
    unsafe {
        let hop = Hop {
            share: *own,
            cause: *own.add(1) as usize,
            fixed_ms: *own.add(2),
            variable_ms: *own.add(3),
            tail_p: *own.add(4),
            tail_ms: *own.add(5),
            value: *own.add(6),
        };
        let mut entries = Vec::with_capacity(call_count as usize);
        for index in 0..call_count as usize {
            entries.push((
                read(calls.add(index * (OUTCOME_LEN + 1))),
                *calls.add(index * (OUTCOME_LEN + 1) + OUTCOME_LEN),
            ));
        }
        let mut total = 0.0;
        for _ in 0..count {
            total += through(hop, &entries, stale_counts != 0).success;
        }
        total
    }
}
