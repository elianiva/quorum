//! The pass loop: what the solve relaxes to, and the Bottleneck search over it.
//!
//! Ported from `solve.ts` (`solveWith`, `bottleneckOf`) and `solve-converge.ts`
//! (`passRepeats`). Six passes at most, and convergence can stop it sooner: once
//! a pass repeats the figures the Ledger reads, later passes cannot change the
//! answer.

use crate::catalog::*;
use crate::ledger::{self, Ledger, Route};
use crate::model::{database_model, flat_component, flat_scale, Order, Rates, ServerCtx};
use crate::outcomes::{hop_ms, tree, Memo};
use crate::pass::{forward, is_down, Board, Pass, Run};
use crate::routing::{Splits, Weights};

/// The most passes a solve runs.
pub const PASSES: usize = 6;
/// The relative epsilon `passRepeats` judges a repeat at.
const EPSILON: f64 = 1e-9;

/// The figures one pass hands the next. A solve that starts from them re-solves
/// only what a boost moves.
#[derive(Clone, Default)]
pub struct State {
    pub call_latency: Vec<[f64; NK]>,
    pub inflight: Vec<f64>,
    pub weights: Vec<f64>,
    pub failures: Vec<[f64; NK]>,
    pub task_failure: Vec<f64>,
    pub task_capacity: Vec<f64>,
    pub connection_used: Vec<f64>,
    pub nominal: Vec<f64>,
    pub sick: Vec<bool>,
}

/// Everything a solve reads, fixed for its whole run.
pub struct Setup<'a> {
    pub board: Board<'a>,
    pub routes: &'a [Route],
    /// Every Link in Game order, for the Ledger's Link rows and Analytics taps.
    pub links: &'a [crate::ledger::LinkIn],
    /// The Era's mix, which an App Server probes its capacity with.
    pub probe_mix: &'a Rates,
}

/// What one solve produced.
pub struct Solved {
    pub ledger: Option<Ledger>,
    pub revenue: f64,
    pub state: State,
    pub passes: usize,
}

/// `probeCapacity`: requests per second a Node could take with its probe mix,
/// at the boost and in-flight work this solve gives it.
pub fn probe_capacity(setup: &Setup, slot: usize, boost: Option<usize>, state: &State) -> f64 {
    let board = &setup.board;
    let node = match board.nodes.get(slot) {
        Some(node) => node,
        None => return 1_000.0,
    };
    let mut probe = [0.0f64; NK];
    match node.type_code {
        component::SERVER | component::FN => probe = *setup.probe_mix,
        component::DATABASE | component::REPLICA | component::WIDE | component::DOC => probe[kind::Q_READ] = 1.0,
        component::VEC => probe[kind::Q_VECTOR] = 1.0,
        component::DSQL => probe[kind::Q_TX] = 1.0,
        component::WS => probe[kind::RT] = 1.0,
        // A Component with no probe answers its flat capacity, or a thousand without one.
        type_code => {
            let flat = FLAT_CAPACITY.get(type_code).copied().unwrap_or(0.0);
            return if flat == 0.0 { 1_000.0 } else { flat * flat_scale(node.size) };
        }
    }
    let boost = if boost == Some(slot) { 2.0 } else { 1.0 };
    let ctx = ServerCtx {
        boost,
        inflight: state.inflight.get(slot).copied().unwrap_or(0.0),
        flags: board.flags.get(slot).copied().unwrap_or_default(),
    };
    // The probe reads the state the solve starts from: a re-probed Node in a
    // search still waits on its calls and holds its connections.
    let call_latency = state.call_latency.get(slot).unwrap_or(&[0.0; NK]);
    // `replicaRule.model` passes no connections: only a Database holds their memory.
    let connections =
        if node.type_code == component::DATABASE { state.connection_used.get(slot).copied().unwrap_or(0.0) } else { 0.0 };
    let model = match node.type_code {
        component::SERVER => crate::model::server_model_shed(board.game, node, &probe, board.code.node(slot), call_latency, &ctx),
        component::FN => crate::model::serverless_model(node, &probe, board.code.node(slot), call_latency, boost),
        component::DATABASE | component::REPLICA => database_model(board.game, node, &probe, boost, connections),
        // `probeMixOf` walks `REQUEST_KINDS`.
        _ => flat_component(board.game, node, &probe, &Order::indexed(), boost),
    };
    if model.utilization > 0.0 {
        1.0 / model.utilization
    } else {
        1_000.0
    }
}

/// What a solve's caller reads once it ends.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Want {
    /// The whole Ledger, and the state to start a search from.
    Ledger,
    /// The revenue, and the state to start a search from.
    Revenue,
    /// The revenue alone: a Bottleneck candidate drops its state, so its last
    /// pass skips the feedback only a next pass would read.
    Candidate,
}

/// `solveWith`: the pass loop, from a seed or from the converged state.
pub fn solve_with(
    setup: &Setup,
    splits: &mut Splits,
    memo: &mut Memo,
    boost: Option<usize>,
    start: Option<&State>,
    passes: usize,
    want: Want,
) -> Solved {
    let board = setup.board;
    let count = board.nodes.len();
    let mut state = start.cloned().unwrap_or_default();
    state.call_latency.resize(count, [0.0; NK]);
    state.inflight.resize(count, 0.0);
    state.weights.resize(count, 1.0);
    state.failures.resize(board.design.edges.len(), [f64::NAN; NK]);
    state.task_failure.resize(count, f64::NAN);
    state.task_capacity.resize(count, f64::INFINITY);
    state.connection_used.resize(count, 0.0);
    state.nominal.resize(count, 1.0);
    state.sick.resize(count, false);
    if start.is_none() {
        // Retrying Links start from the failure share they saw last Step.
        for (edge, policy) in board.design.edges.iter().enumerate() {
            if policy.failure <= 0.0 || policy.retry == 0 {
                continue;
            }
            let target = board.design.nodes[policy.to as usize].type_code as usize;
            for (kind, share) in state.failures[edge].iter_mut().enumerate() {
                if crate::routing::accepts(target, kind) {
                    *share = policy.failure;
                }
            }
        }
        for slot in 0..count {
            state.nominal[slot] = probe_capacity(setup, slot, boost, &state);
        }
        state.weights = state.nominal.clone();
    } else if let Some(slot) = boost {
        state.nominal[slot] = probe_capacity(setup, slot, boost, &state);
    }
    // Every split below answers for `state`'s Weights until they move.
    splits.reset(board.design);

    let mut previous: Option<Pass> = None;
    // A pass's new Weights and sick servers reach the next pass, but its own
    // tree routes with what the pass ran with, as `outcomesOf(inputs, pass)` does.
    let mut pending: Option<(Vec<f64>, Vec<usize>)> = None;
    let mut ran = 0;
    for index in 0..passes {
        if let Some(update) = pending.take() {
            apply(&mut state, update);
            splits.reset(board.design);
        }
        let current = forward(
            &Run {
                board,
                weights: weights_of(&state),
                call_latency: &state.call_latency,
                inflight: &state.inflight,
                connections: &state.connection_used,
                failures: &state.failures,
                task_failure: &state.task_failure,
                task_capacity: &state.task_capacity,
                boost,
            },
            splits,
        );
        ran = index + 1;
        // The pass loop is a relaxation that settles: once a pass repeats the
        // figures the Ledger reads, later passes cannot change the answer.
        if previous.as_ref().is_some_and(|before| pass_repeats(before, &current)) {
            previous = Some(current);
            break;
        }
        // The Weights and the sick set reach the final tree; everything else
        // only reaches a next pass, which a candidate's last pass does not have.
        let feedback = !(want == Want::Candidate && index + 1 == passes);
        let mut next_weights = vec![1.0; count];
        for (slot, node) in board.nodes.iter().enumerate() {
            let rate = ledger::sum_rates(current.rates(slot));
            next_weights[slot] = if is_down(node) {
                0.0
            } else if rate > 0.0 {
                current.models.get(slot).map(|model| model.capacity).unwrap_or(state.weights[slot])
            } else {
                state.weights[slot]
            };
        }
        if feedback {
            feed_back(board, &current, &mut state, splits, memo, index);
        }
        // Once a deep check fails a server in a pass, it stays out for the solve.
        let sick = (0..count)
            .filter(|&slot| {
                board.nodes[slot].type_code == component::SERVER
                    && ledger::database_sick(board.design, &current, board.nodes, slot)
            })
            .collect();
        pending = Some((next_weights, sick));
        previous = Some(current);
    }
    let current = match previous {
        Some(current) => current,
        None => {
            return Solved { ledger: None, revenue: 0.0, state, passes: ran };
        }
    };
    let mut tree = tree(board, &current, weights_of(&state), splits, memo);
    let revenue = ledger::revenue_of(board.game, board.demand, &current, board.nodes, &mut tree, setup.routes);
    let ledger = (want == Want::Ledger).then(|| {
        ledger::ledger_of(setup, &current, &mut tree)
    });
    if let Some(update) = pending {
        apply(&mut state, update);
    }
    Solved { ledger, revenue, state, passes: ran }
}

/// Hands a pass's new Weights and sick servers to the state the next pass reads.
fn apply(state: &mut State, (weights, sick): (Vec<f64>, Vec<usize>)) {
    state.weights = weights;
    for slot in sick {
        state.sick[slot] = true;
    }
}

/// The Weights a pass and its tree route with.
#[inline]
fn weights_of(state: &State) -> Weights<'_> {
    Weights { live: &state.weights, nominal: &state.nominal, sick: &state.sick }
}

/// The figures one pass hands the next, other than its Weights: what each
/// Worker can take, the pools it held, the in-flight work, how long a server
/// holds a slot per call, and the failure share on each retrying Link.
fn feed_back(board: Board, current: &Pass, state: &mut State, splits: &mut Splits, memo: &mut Memo, index: usize) {
    let count = board.nodes.len();
    let mut task_capacity = vec![f64::INFINITY; count];
    for (slot, node) in board.nodes.iter().enumerate() {
        if node.type_code != component::WORKER {
            continue;
        }
        let utilization = current.models.get(slot).map(|model| model.utilization).unwrap_or(0.0);
        let offered = current.rates(slot)[NR + backend::TASK];
        if utilization > 0.0 && offered > 0.0 {
            task_capacity[slot] = offered / utilization;
        }
    }
    let mut next_inflight = vec![0.0; count];
    let mut next_latency = vec![[0.0f64; NK]; count];
    let mut next_failures = vec![[f64::NAN; NK]; board.design.edges.len()];
    let mut next_task_failure = vec![f64::NAN; count];
    {
        let mut tree = tree(board, current, weights_of(state), splits, memo);
        let hop = hop_ms(board.game);
        for (slot, node) in board.nodes.iter().enumerate() {
            let model = current.models.get(slot);
            next_inflight[slot] = (state.inflight[slot] + model.map(|model| model.inflight).unwrap_or(0.0)) / 2.0;
            // A Node that runs code holds its slot while it waits on each call it makes.
            if !COMPONENT_STACK[node.type_code] {
                continue;
            }
            for (kind, latency) in next_latency[slot].iter_mut().enumerate().skip(NR) {
                if (COMPONENT_SENDS[node.type_code] >> kind) & 1 == 0 {
                    continue;
                }
                let fresh = if kind == kind::CALLOUT { CALLOUT_MS } else { tree.held(slot, kind, hop) };
                *latency =
                    if index == 0 { fresh } else { (state.call_latency[slot][kind] + fresh) / 2.0 };
            }
        }
        // A Worker's failed attempts come back: what its calls and code failed, not
        // what it dropped, since a dropped task waits in the Queue.
        for (slot, node) in board.nodes.iter().enumerate() {
            if node.type_code != component::WORKER || current.tasks.get(slot).is_none_or(|tasks| tasks.iter().all(|rate| *rate == 0.0)) {
                continue;
            }
            let result = tree.outcome(slot, NR + backend::TASK);
            let fresh = (1.0 - (result.success + result.fail[crate::dist::DROPPED])).max(0.0);
            let carried = state.task_failure[slot];
            next_task_failure[slot] = if carried.is_nan() { fresh } else { (carried + fresh) / 2.0 };
        }
        // Failure shares on retrying Links, blended like the call latencies.
        for &edge in &current.link_order {
            let policy = match board.design.edges.get(edge) {
                Some(policy) => *policy,
                None => continue,
            };
            if policy.retry == 0 {
                continue;
            }
            for kind in 0..NK {
                if current.links.get(edge).map(|rates| rates[kind]).unwrap_or(0.0) <= 0.0 {
                    continue;
                }
                let fresh = tree.failure_on(edge, kind);
                let carried = state.failures[edge][kind];
                next_failures[edge][kind] = if carried.is_nan() { fresh } else { (carried + fresh) / 2.0 };
            }
        }
    }
    state.connection_used = current.connections.iter().map(|pool| pool.map(|(used, _)| used).unwrap_or(0.0)).collect();
    state.call_latency = next_latency;
    state.inflight = next_inflight;
    state.failures = next_failures;
    state.task_failure = next_task_failure;
    state.task_capacity = task_capacity;
}

/// `bottleneckOf`: the Node whose doubled capacity would earn the most.
pub fn bottleneck_of(
    setup: &Setup,
    base: &Ledger,
    base_revenue: f64,
    start: &State,
    splits: &mut Splits,
    memo: &mut Memo,
) -> Option<usize> {
    let busiest = ledger::busiest_nodes(setup.board.nodes, &base.nodes);
    let mut best: Option<usize> = None;
    let mut gain = (base_revenue * 0.01).max(0.005);
    for slot in busiest {
        let boosted = solve_with(setup, splits, memo, Some(slot), Some(start), 1, Want::Candidate);
        let revenue = boosted.revenue - base_revenue;
        if revenue > gain {
            gain = revenue;
            best = Some(slot);
        }
    }
    best
}

/// `passRepeats`: whether a pass repeated the one before it, judged on the
/// figures the Ledger reads, at a relative epsilon of 1e-9.
pub fn pass_repeats(previous: &Pass, current: &Pass) -> bool {
    if previous.models.len() != current.models.len() {
        return false;
    }
    if !near(previous.lag_ms, current.lag_ms) || !near(previous.stale_share, current.stale_share) {
        return false;
    }
    for slot in 0..current.models.len() {
        if !near_rates(previous.rates(slot), current.rates(slot)) {
            return false;
        }
        let before = previous.models.get(slot);
        let after = current.models.get(slot);
        match (before, after) {
            (None, None) => continue,
            (Some(before), Some(after)) => {
                if !near(before.capacity, after.capacity)
                    || !near(before.utilization, after.utilization)
                    || !near(before.share, after.share)
                    || !near(before.tail_p, after.tail_p)
                    || !near(before.tail_ms, after.tail_ms)
                {
                    return false;
                }
                if before.limit != after.limit {
                    return false;
                }
                if before.throttled != after.throttled || before.swapping != after.swapping {
                    return false;
                }
                if before.disk != after.disk {
                    return false;
                }
                if before.service_mask != after.service_mask {
                    return false;
                }
                for kind in 0..NK {
                    if !near(before.service_fixed[kind], after.service_fixed[kind])
                        || !near(before.service_variable[kind], after.service_variable[kind])
                    {
                        return false;
                    }
                }
                // The resource gauges: Apache's processes move its memory before its capacity.
                let near_gauge = |was: Option<crate::model::Gauge>, is: Option<crate::model::Gauge>| match (was, is) {
                    (Some(was), Some(is)) => near(was.used, is.used) && near(was.total, is.total),
                    (was, is) => was.is_none() && is.is_none(),
                };
                let (was, is) = (&before.resources, &after.resources);
                if !near_gauge(was.cpu_cores, is.cpu_cores)
                    || !near_gauge(was.ram_gb, is.ram_gb)
                    || !near_gauge(was.slots, is.slots)
                    || !near_gauge(was.network_kbps, is.network_kbps)
                {
                    return false;
                }
            }
            _ => return false,
        }
        // A Queue's or Worker's task mix, by the request kind behind each task.
        if !near_rates(
            previous.tasks.get(slot).unwrap_or(&[0.0; NK]),
            current.tasks.get(slot).unwrap_or(&[0.0; NK]),
        ) {
            return false;
        }
        if !near(previous.hits.get(slot).copied().unwrap_or(0.0), current.hits.get(slot).copied().unwrap_or(0.0)) {
            return false;
        }
        if !near(previous.stale_hits.get(slot).copied().unwrap_or(0.0), current.stale_hits.get(slot).copied().unwrap_or(0.0)) {
            return false;
        }
        if !near(previous.repeated.get(slot).copied().unwrap_or(0.0), current.repeated.get(slot).copied().unwrap_or(0.0)) {
            return false;
        }
        if !near(previous.drained.get(slot).copied().unwrap_or(0.0), current.drained.get(slot).copied().unwrap_or(0.0)) {
            return false;
        }
        let was_stranded = previous.stranded.get(slot).copied().flatten();
        let is_stranded = current.stranded.get(slot).copied().flatten();
        if !near(was_stranded.map(|(rate, _)| rate).unwrap_or(0.0), is_stranded.map(|(rate, _)| rate).unwrap_or(0.0)) {
            return false;
        }
        if was_stranded.map(|(_, kinds)| kinds.len()).unwrap_or(0)
            != is_stranded.map(|(_, kinds)| kinds.len()).unwrap_or(0)
        {
            return false;
        }
        let was_pool = previous.connections.get(slot).copied().flatten();
        let is_pool = current.connections.get(slot).copied().flatten();
        if !near(was_pool.map(|(used, _)| used).unwrap_or(0.0), is_pool.map(|(used, _)| used).unwrap_or(0.0))
            || !near(was_pool.map(|(_, max)| max).unwrap_or(0.0), is_pool.map(|(_, max)| max).unwrap_or(0.0))
        {
            return false;
        }
    }
    for edge in 0..current.links.len() {
        let left = previous.links.get(edge).copied().unwrap_or([0.0; NK]);
        let right = current.links.get(edge).copied().unwrap_or([0.0; NK]);
        if !near_rates(&left, &right) {
            return false;
        }
    }
    true
}

#[inline]
fn near(a: f64, b: f64) -> bool {
    if a == b {
        return true;
    }
    if !a.is_finite() || !b.is_finite() {
        return false;
    }
    let scale = a.abs().max(b.abs());
    scale == 0.0 || (a - b).abs() <= EPSILON * scale
}

/// `nearRates`: two rate records agree, key set and values.
fn near_rates(a: &Rates, b: &Rates) -> bool {
    let mut left = 0;
    let mut right = 0;
    for kind in 0..NK {
        if a[kind] != 0.0 {
            left += 1;
        }
        if b[kind] != 0.0 {
            right += 1;
        }
        if !near(a[kind], b[kind]) {
            return false;
        }
    }
    left == right
}
