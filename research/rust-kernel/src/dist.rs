//! The Outcome algebra, ported from `packages/simulation/src/distribution.ts`.
//!
//! `Outcome` is a plain `Copy` struct of seventeen `f64`s, so a hop builds one
//! on the stack instead of an object on the heap. Operation order matches the
//! TypeScript exactly.

/// The twelve failure causes, in the order the catalog and the Ledger use.
pub const CAUSE_COUNT: usize = 12;
pub const STRANDED: usize = 0;
pub const DROPPED: usize = 1;
pub const REFUSED: usize = 2;
pub const DOWN: usize = 3;
pub const STALE: usize = 4;
pub const OOM: usize = 5;
pub const TIMEOUT: usize = 6;
pub const CRASH: usize = 7;
pub const BLOCKED: usize = 8;
pub const UPSTREAM: usize = 9;
pub const THROTTLED: usize = 10;
pub const DUPLICATE: usize = 11;

/// What one request gets back.
#[derive(Clone, Copy, Debug, Default)]
pub struct Outcome {
    pub success: f64,
    pub fixed_ms: f64,
    pub variable_ms: f64,
    pub tail_p: f64,
    pub tail_ms: f64,
    pub stale: f64,
    pub value: f64,
    /// Failures, flat and by cause, so a hop builds one struct and not a record.
    pub fail: [f64; CAUSE_COUNT],
}

impl Outcome {
    #[inline]
    pub fn failure(&self, cause: usize) -> f64 {
        self.fail[cause]
    }

    /// The same outcome with every failure share scaled, for retries.
    #[inline]
    pub fn scaled_failures(&self, by: f64) -> Outcome {
        let mut next = *self;
        for cause in 0..CAUSE_COUNT {
            next.fail[cause] = self.fail[cause] * by;
        }
        next
    }

    /// The same outcome with no failures at all.
    #[inline]
    pub fn without_failures(&self) -> Outcome {
        let mut next = *self;
        next.fail = [0.0; CAUSE_COUNT];
        next
    }
}

/// `failed`: nothing succeeds, and the whole loss is one cause.
pub fn failed(cause: usize) -> Outcome {
    let mut fail = [0.0f64; CAUSE_COUNT];
    fail[cause] = 1.0;
    Outcome { success: 0.0, value: 1.0, fail, ..Outcome::default() }
}

/// `answered`: everything succeeds, with a fixed and a variable part.
pub fn answered(fixed_ms: f64, variable_ms: f64) -> Outcome {
    Outcome { success: 1.0, value: 1.0, fixed_ms, variable_ms, ..Outcome::default() }
}

/// `failSome`: a share of the answered requests fails for `cause` instead.
pub fn fail_some(outcome: Outcome, share: f64, cause: usize) -> Outcome {
    if share <= 0.0 {
        return outcome;
    }
    let add = outcome.success * share;
    let mut next = outcome;
    next.success = outcome.success * (1.0 - share);
    next.fail[cause] = outcome.fail[cause] + add;
    next
}

/// What a Node adds before it passes the request on.
#[derive(Clone, Copy, Debug)]
pub struct Hop {
    pub share: f64,
    pub cause: usize,
    pub fixed_ms: f64,
    pub variable_ms: f64,
    pub tail_p: f64,
    pub tail_ms: f64,
    pub value: f64,
}

impl Default for Hop {
    fn default() -> Self {
        Hop {
            share: 1.0,
            cause: DROPPED,
            fixed_ms: 0.0,
            variable_ms: 0.0,
            tail_p: 0.0,
            tail_ms: 0.0,
            value: 1.0,
        }
    }
}

#[inline]
pub fn hop(fixed_ms: f64, variable_ms: f64) -> Hop {
    Hop { fixed_ms, variable_ms, ..Hop::default() }
}

#[inline]
pub fn hop_share(share: f64, fixed_ms: f64, variable_ms: f64, tail_p: f64, tail_ms: f64) -> Hop {
    Hop { share, fixed_ms, variable_ms, tail_p, tail_ms, ..Hop::default() }
}

/// Two independent tail events as one: either can hit, and the length is their weighted mean.
#[inline]
pub fn combine_tail(a: f64, a_ms: f64, b: f64, b_ms: f64) -> (f64, f64) {
    let p = 1.0 - (1.0 - a) * (1.0 - b);
    (p, if a + b > 0.0 { (a * a_ms + b * b_ms) / (a + b) } else { 0.0 })
}

/// A hop followed by the requests it sends, called in sequence.
///
/// `calls` is a slice of `(Outcome, count)`; `stale_counts` folds a stale share
/// into the failure instead of carrying it.
#[inline]
pub fn through(own: Hop, calls: &[(Outcome, f64)], stale_counts: bool) -> Outcome {
    let mut success = 1.0;
    let mut fixed_ms = own.fixed_ms;
    let mut variable_ms = own.variable_ms;
    let mut value = own.value;
    let (mut tail_p, mut tail_ms) = (own.tail_p, own.tail_ms);
    let mut fail = [0.0f64; CAUSE_COUNT];
    let mut cause_weight = 0.0;
    let mut stale = 0.0;

    for &(call, count) in calls {
        if count <= 0.0 {
            continue;
        }
        let mut reached = 1.0;
        // `count` is a small whole number in the game, so a loop is exact.
        let mut index = 0.0;
        while index < count {
            reached *= call.success;
            index += 1.0;
        }
        success *= reached;
        fixed_ms += call.fixed_ms * count;
        variable_ms += call.variable_ms * count;
        let (p, ms) = combine_tail(tail_p, tail_ms, call.tail_p, call.tail_ms);
        tail_p = p;
        tail_ms = ms;
        for (fail, add) in fail.iter_mut().zip(&call.fail) {
            *fail += add * count;
        }
        cause_weight += (1.0 - call.success) * count;
        if call.stale > stale {
            stale = call.stale;
        }
        value *= call.value;
    }

    let stale_loss = if stale_counts { stale } else { 0.0 };
    let child_failure = 1.0 - success;
    let ratio = if cause_weight > 0.0 { child_failure / cause_weight } else { 0.0 };
    let reached = own.share;
    let own_fail = 1.0 - reached;
    let mut out_fail = [0.0f64; CAUSE_COUNT];
    for cause in 0..CAUSE_COUNT {
        out_fail[cause] = fail[cause] * ratio * reached + if own.cause == cause { own_fail } else { 0.0 };
    }
    out_fail[STALE] = (fail[STALE] * ratio + success * stale_loss) * reached
        + if own.cause == STALE { own_fail } else { 0.0 };

    Outcome {
        success: reached * success * (1.0 - stale_loss),
        fixed_ms,
        variable_ms,
        tail_p,
        tail_ms,
        stale: if stale_counts { 0.0 } else { stale },
        value,
        fail: out_fail,
    }
}

/// `throughOne`: a hop followed by exactly one call, with no list to build.
#[inline]
pub fn through_one(own: Hop, call: Outcome, stale_counts: bool) -> Outcome {
    through(own, &[(call, 1.0)], stale_counts)
}

/// A weighted mix of several outcomes. `None` when there are none.
#[inline]
pub fn blend(entries: &[(Outcome, f64)]) -> Option<Outcome> {
    let total: f64 = entries.iter().map(|(_, weight)| *weight).sum();
    if entries.is_empty() {
        return None;
    }
    let mut mix = Blend::new(total)?;
    for (entry, weight) in entries {
        mix.add(entry, *weight);
    }
    Some(mix.finish())
}

/// `blend`, one entry at a time, for a caller that knows the total weight
/// before it has the outcomes. Same operations in the same order, so the same bits.
pub struct Blend {
    total: f64,
    out: Outcome,
    tail_weight: f64,
}

impl Blend {
    /// `None` when the total weight leaves nothing to mix.
    #[inline]
    pub fn new(total: f64) -> Option<Blend> {
        if total <= 0.0 {
            return None;
        }
        Some(Blend { total, out: Outcome::default(), tail_weight: 0.0 })
    }

    #[inline]
    pub fn add(&mut self, entry: &Outcome, weight: f64) {
        let w = weight / self.total;
        let out = &mut self.out;
        self.tail_weight += entry.tail_p * w * entry.tail_ms;
        out.success += entry.success * w;
        out.fixed_ms += entry.fixed_ms * w;
        out.variable_ms += entry.variable_ms * w;
        out.tail_p += entry.tail_p * w;
        out.stale += entry.stale * w;
        out.value += entry.value * w;
        for (fail, add) in out.fail.iter_mut().zip(&entry.fail) {
            *fail += add * w;
        }
    }

    #[inline]
    pub fn finish(self) -> Outcome {
        let mut out = self.out;
        out.tail_ms = if out.tail_p > 0.0 { self.tail_weight / out.tail_p } else { 0.0 };
        out
    }
}

/// e^(-x) for x >= 0, from a short series and eight squarings.
#[inline]
pub fn decay(x: f64) -> f64 {
    if x <= 0.0 {
        return 1.0;
    }
    if x > 60.0 {
        return 0.0;
    }
    let y = x / 256.0;
    let mut value = 1.0 - y + (y * y) / 2.0 - (y * y * y) / 6.0;
    for _ in 0..8 {
        value *= value;
    }
    value
}

/// Share of answered requests slower than `ms`.
#[inline]
pub fn slower_than(outcome: &Outcome, ms: f64) -> f64 {
    let base = |at: f64| -> f64 {
        let left = at - outcome.fixed_ms;
        if left < 0.0 {
            return 1.0;
        }
        if outcome.variable_ms > 0.0 {
            decay(left / outcome.variable_ms)
        } else {
            0.0
        }
    };
    if outcome.tail_p <= 0.0 || outcome.tail_ms <= 0.0 {
        return base(ms);
    }
    let plain = base(ms);
    let with_tail = base(ms - outcome.tail_ms);
    plain.max(if outcome.tail_p < with_tail { outcome.tail_p } else { with_tail })
}

#[inline]
pub fn mean_of(outcome: &Outcome) -> f64 {
    outcome.fixed_ms + outcome.variable_ms + outcome.tail_p * outcome.tail_ms
}

/// A call with a timeout: answers slower than `ms` fail as `timeout`.
#[inline]
pub fn timed_out(outcome: Outcome, ms: f64) -> Outcome {
    let late = slower_than(&outcome, ms);
    if late <= 1e-12 || outcome.success <= 0.0 {
        return outcome;
    }
    let room = ms - outcome.fixed_ms;
    let v = outcome.variable_ms;
    let cut = if room > 0.0 && v > 0.0 { decay(room / v) } else { 1.0 };
    let variable_ms = if room > 0.0 && v > 0.0 && cut < 1.0 {
        (v - (room * cut) / (1.0 - cut)).max(0.0)
    } else {
        0.0
    };
    let tail_kept = outcome.fixed_ms + outcome.tail_ms < ms;
    let mut next = outcome;
    next.success = outcome.success * (1.0 - late);
    next.variable_ms = variable_ms;
    next.tail_p = if tail_kept { outcome.tail_p } else { 0.0 };
    next.tail_ms = if tail_kept { outcome.tail_ms } else { 0.0 };
    next.fail[TIMEOUT] = outcome.fail[TIMEOUT] + outcome.success * late;
    next
}

/// Attempts per call with naive retries when a share `f` fails: 1 + f + f^2 + f^3.
#[inline]
pub fn attempts_for(failure: f64) -> f64 {
    1.0 + failure + failure * failure + failure * failure * failure
}

/// Attempts per task when a share `f` fails and the Queue allows `n`.
pub fn task_attempts(failure: f64, n: f64) -> f64 {
    let mut total = 0.0;
    let mut term = 1.0;
    let mut attempt = 0.0;
    while attempt < n {
        total += term;
        term *= failure;
        attempt += 1.0;
    }
    total
}

/// Share of tasks that fail every one of `n` attempts.
pub fn task_lost(failure: f64, n: f64) -> f64 {
    let mut lost = 1.0;
    let mut attempt = 0.0;
    while attempt < n {
        lost *= failure;
        attempt += 1.0;
    }
    lost
}

/// A timed-out call with up to three naive retries.
#[inline]
pub fn retried(call: Outcome, ms: f64) -> Outcome {
    let failure = 1.0 - call.success;
    if failure <= 1e-12 {
        return call;
    }
    let still = failure * failure * failure * failure;
    let wasted =
        (call.fail[TIMEOUT] * ms + (failure - call.fail[TIMEOUT]) * call.fixed_ms) / failure;
    let mut next = call.scaled_failures(still / failure);
    next.success = 1.0 - still;
    next.fixed_ms = call.fixed_ms + (attempts_for(failure) - 1.0) * wasted;
    next
}

/// Retries with backoff stay within this share of extra calls.
pub const RETRY_BUDGET: f64 = 0.1;
/// Milliseconds a backed-off retry waits, on average, before it goes.
pub const BACKOFF_MS: f64 = 200.0;

/// A call that retries with backoff and jitter, inside a retry budget.
#[inline]
pub fn backed_off(call: Outcome, ms: f64, budget: f64) -> Outcome {
    let failure = 1.0 - call.success;
    if failure <= 1e-12 {
        return call;
    }
    let extra = attempts_for(failure) - 1.0;
    let allowed = (budget / extra).min(1.0);
    let still = failure * (1.0 - allowed * (1.0 - failure * failure * failure));
    let wasted =
        (call.fail[TIMEOUT] * ms + (failure - call.fail[TIMEOUT]) * call.fixed_ms) / failure;
    let mut next = call.scaled_failures(still / failure);
    next.success = 1.0 - still;
    next.fixed_ms = call.fixed_ms + allowed * extra * (wasted + BACKOFF_MS);
    next
}

/// How long a caller holds its slot on one attempt: E[min(X, T)].
#[inline]
pub fn held_for(outcome: &Outcome, ms: f64) -> f64 {
    let room = ms - outcome.fixed_ms;
    if room <= 0.0 {
        return ms;
    }
    let v = outcome.variable_ms;
    let part = if v > 0.0 { v * (1.0 - decay(room / v)) } else { 0.0 };
    outcome.fixed_ms
        + part
        + outcome.tail_p * outcome.tail_ms.min((room - part).max(0.0))
}

/// Apdex of the answered requests: satisfied plus half the tolerating.
#[inline]
pub fn apdex_of(outcome: &Outcome, target: f64) -> f64 {
    let slow = slower_than(outcome, target);
    let frustrated = slower_than(outcome, target * 4.0);
    1.0 - slow + (slow - frustrated) / 2.0
}

/// The q-th percentile of answered requests, in milliseconds.
#[inline]
pub fn percentile(outcome: &Outcome, q: f64) -> f64 {
    let mut low = outcome.fixed_ms;
    let mut high = outcome.fixed_ms + outcome.tail_ms + outcome.variable_ms * 12.0 + 1.0;
    for _ in 0..40 {
        let middle = (low + high) / 2.0;
        if slower_than(outcome, middle) > 1.0 - q {
            low = middle;
        } else {
            high = middle;
        }
    }
    high
}

/// Mean of the k-th fastest of n exponential replicas.
pub fn kth_fastest(k: f64, n: f64) -> f64 {
    let mut sum = 0.0;
    let mut i = (n - k + 1.0).max(1.0);
    while i <= n {
        sum += 1.0 / i;
        i += 1.0;
    }
    sum
}

/// The faster of two independent copies of a call.
pub fn hedged(call: Outcome) -> Outcome {
    let mut next = call;
    next.variable_ms = call.variable_ms * kth_fastest(1.0, 2.0);
    next.tail_p = call.tail_p * call.tail_p;
    next.tail_ms = call.tail_ms / 2.0;
    next
}
