//! The pass loop: what the solve relaxes to, and the Bottleneck search over it.
//!
//! Ported from `solve.ts` (`solveWith`, `bottleneckOf`) and `solve-converge.ts`
//! (`passRepeats`). Six passes at most, and convergence can stop it sooner: once
//! a pass repeats the figures the Ledger reads, later passes cannot change the
//! answer.

use crate::catalog::*;
use crate::ledger::{self, Ledger, Route};
use crate::model::{flat_model, flat_scale, database_model, server_model, GameCtx, Model, Node, Rates, ServerCtx};
use crate::outcomes::{hop_ms, tree, Memo};
use crate::pass::{forward, is_down, Run, Pass};
use crate::routing::Design;

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
    pub design: &'a Design,
    pub game: &'a GameCtx,
    pub nodes: &'a [Node],
    pub demand: &'a Rates,
    pub intake: &'a [f64],
    pub routes: &'a [Route],
    /// The Era's mix, which an App Server probes its capacity with.
    pub probe_mix: &'a Rates,
    pub sampling: &'a [f64],
    pub delegated: &'a [bool],
    pub offloads: &'a [bool],
    pub pod: &'a [bool],
    pub mesh: &'a [bool],
    pub users_in_group: &'a [f64],
}

/// What one solve produced.
pub struct Solved {
    pub ledger: Option<Ledger>,
    pub revenue: f64,
    pub state: State,
    pub passes: usize,
}

/// `probeCapacity`: requests per second a Node could take with the Era's mix.
pub fn probe_capacity(setup: &Setup, slot: usize, weights: &[f64]) -> f64 {
    let node = match setup.nodes.get(slot) {
        Some(node) => node,
        None => return 1_000.0,
    };
    let type_code = node.type_code;
    let probe = if type_code == component_index("server") {
        Some(*setup.probe_mix)
    } else if type_code == component_index("database")
        || type_code == component_index("replica")
    {
        let mut probe = [0.0f64; NK];
        probe[kind_index("q-read")] = 1.0;
        Some(probe)
    } else {
        None
    };
    let probe = match probe {
        Some(probe) => probe,
        None => {
            let flat = FLAT_CAPACITY.get(type_code).copied().unwrap_or(0.0);
            return if flat == 0.0 { 1_000.0 } else { flat * flat_scale(node.size) };
        }
    };
    let model = model_of(setup, slot, &probe, weights, &[0.0; NK]);
    if model.utilization > 0.0 {
        1.0 / model.utilization
    } else {
        1_000.0
    }
}

/// One Node's model at the pass's feedback, which the probe and the loop share.
fn model_of(setup: &Setup, slot: usize, rates: &Rates, state: &[f64], call_latency: &[f64; NK]) -> Model {
    let node = match setup.nodes.get(slot) {
        Some(node) => node,
        None => return Model::default(),
    };
    let boost = 1.0;
    let ctx = ServerCtx {
        boost,
        inflight: state.first().copied().unwrap_or(0.0),
        sampling: setup.sampling.get(slot).copied().unwrap_or(0.0),
        hashing: if setup.game.incident == "loop" { 4.0 } else { 1.0 },
        delegated: setup.delegated.get(slot).copied().unwrap_or(false),
        local: node.local_db,
        offloaded: setup.offloads.get(slot).copied().unwrap_or(false),
        worker: node.type_code == component_index("worker"),
        pod: setup.pod.get(slot).copied().unwrap_or(false),
        mesh: setup.mesh.get(slot).copied().unwrap_or(false),
    };
    if node.type_code == component_index("server") {
        let mut calls = [[0.0f64; NK]; NR];
        for kind in 0..NR {
            calls[kind] = crate::pass::calls_of(setup.game, node, kind, ctx.delegated, ctx.offloaded);
        }
        return server_model(setup.game, node, rates, &calls, call_latency, &ctx);
    }
    if node.type_code == component_index("database") || node.type_code == component_index("replica") {
        let mut scoped = setup.game.clone();
        scoped.users_in_group = setup.users_in_group.get(slot).copied().unwrap_or(0.0);
        return database_model(&scoped, node, rates, boost, 0.0);
    }
    let (capacity, fixed, variable) = flat_params(node);
    flat_model(capacity, rates, fixed, variable, boost)
}

#[inline]
fn flat_params(node: &Node) -> (f64, f64, f64) {
    let capacity = FLAT_CAPACITY.get(node.type_code).copied().unwrap_or(0.0) * flat_scale(node.size);
    if node.type_code == component_index("users") {
        (f64::INFINITY, 30.0, 0.0)
    } else if node.type_code == component_index("lb") {
        (capacity, if node.variant == 1 { L4_MS } else { 1.0 }, 0.1)
    } else if node.type_code == component_index("pooler") {
        (capacity, 0.3, 0.0)
    } else {
        (capacity, 1.0, 0.1)
    }
}

/// `solveWith`: the pass loop, from a seed or from the converged state.
pub fn solve_with(
    setup: &Setup,
    scratch: &mut crate::routing::Scratch,
    memo: &mut Memo,
    boost: Option<usize>,
    start: Option<&State>,
    passes: usize,
    revenue_only: bool,
) -> Solved {
    let count = setup.nodes.len();
    let mut state = start.cloned().unwrap_or_default();
    state.call_latency.resize(count, [0.0; NK]);
    state.inflight.resize(count, 0.0);
    state.weights.resize(count, 1.0);
    state.failures.resize(setup.design.edges.len(), [0.0; NK]);
    state.task_failure.resize(count, 0.0);
    state.task_capacity.resize(count, f64::INFINITY);
    state.connection_used.resize(count, 0.0);
    state.nominal.resize(count, 1.0);
    state.sick.resize(count, false);
    if start.is_none() {
        for slot in 0..count {
            state.nominal[slot] = probe_capacity(setup, slot, &state.weights);
        }
        state.weights = state.nominal.clone();
    } else if let Some(slot) = boost {
        state.nominal[slot] = probe_capacity(setup, slot, &state.weights);
    }

    let mut previous: Option<Pass> = None;
    let mut ran = 0;
    for index in 0..passes {
        let current = {
            let run = Run {
                design: setup.design,
                game: setup.game,
                nodes: setup.nodes,
                demand: setup.demand,
                intake: setup.intake,
                weights: &state.weights,
                nominal: &state.nominal,
                sick: &state.sick,
                call_latency: &state.call_latency,
                inflight: &state.inflight,
                connections: &state.connection_used,
                users_in_group: &setup.users_in_group,
                sampling: setup.sampling,
                delegated: setup.delegated,
                offloads: setup.offloads,
                pod: setup.pod,
                mesh: setup.mesh,
                boost,
            };
            forward(&run, scratch)
        };
        ran = index + 1;
        // The pass loop is a relaxation that settles: once a pass repeats the
        // figures the Ledger reads, later passes cannot change the answer.
        let repeated = previous.as_ref().map(|before| pass_repeats(before, &current)).unwrap_or(false);
        if repeated {
            previous = Some(current);
            break;
        }
        let task_failure = vec![0.0; count];
        let mut task_capacity = vec![f64::INFINITY; count];
        for (slot, node) in setup.nodes.iter().enumerate() {
            if node.type_code != component_index("worker") {
                continue;
            }
            let utilization = current.models.get(slot).map(|model| model.utilization).unwrap_or(0.0);
            let offered = current.rates(slot)[NR + 6];
            if utilization > 0.0 && offered > 0.0 {
                task_capacity[slot] = offered / utilization;
            }
        }
        state.connection_used = current
            .connections
            .iter()
            .map(|pool| pool.map(|(used, _)| used).unwrap_or(0.0))
            .collect();
        let mut next_inflight = vec![0.0; count];
        let mut next_weights = vec![1.0; count];
        let mut next_latency = vec![[0.0f64; NK]; count];
        let mut next_failures = vec![[0.0f64; NK]; setup.design.edges.len()];
        {
            let mut tree = tree(
                setup.design,
                setup.game,
                setup.nodes,
                &current,
                &state.weights,
                &state.nominal,
                &state.sick,
                setup.sampling,
                setup.delegated,
                setup.offloads,
                scratch,
                memo,
            );
            for (slot, node) in setup.nodes.iter().enumerate() {
                let model = current.models.get(slot);
                next_inflight[slot] =
                    (state.inflight[slot] + model.map(|model| model.inflight).unwrap_or(0.0)) / 2.0;
                let rate = ledger::sum_rates(current.rates(slot));
                next_weights[slot] = if is_down(node) {
                    0.0
                } else if rate > 0.0 {
                    model.map(|model| model.capacity).unwrap_or(state.weights[slot])
                } else {
                    state.weights[slot]
                };
                // A Node that runs code holds its slot while it waits on each call it makes.
                if !COMPONENT_STACK[node.type_code] {
                    continue;
                }
                for backend in 0..NB {
                    let kind = NR + backend;
                    if (COMPONENT_SENDS[node.type_code] >> kind) & 1 == 0 {
                        continue;
                    }
                    let fresh = if kind == kind_index("callout") {
                        CALLOUT_MS
                    } else {
                        tree.held(slot, kind, hop_ms(setup.game))
                    };
                    next_latency[slot][kind] = if index == 0 {
                        fresh
                    } else {
                        (state.call_latency[slot][kind] + fresh) / 2.0
                    };
                }
            }
            // Failure shares on retrying Links, blended like the call latencies.
            for &edge in &current.link_order {
                let policy = match setup.design.edges.get(edge) {
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
                    next_failures[edge][kind] = if carried == 0.0 { fresh } else { (carried + fresh) / 2.0 };
                }
            }
        }
        // Once a deep check fails a server in a pass, it stays out for the solve.
        for (slot, node) in setup.nodes.iter().enumerate() {
            if node.type_code == component_index("server")
                && ledger::database_sick(setup.design, &current, setup.nodes, slot)
            {
                state.sick[slot] = true;
            }
        }
        state.call_latency = next_latency;
        state.inflight = next_inflight;
        state.weights = next_weights;
        state.failures = next_failures;
        state.task_failure = task_failure;
        state.task_capacity = task_capacity;
        previous = Some(current);
    }
    let current = match previous {
        Some(current) => current,
        None => {
            return Solved { ledger: None, revenue: 0.0, state, passes: ran };
        }
    };
    let mut tree = tree(
        setup.design,
        setup.game,
        setup.nodes,
        &current,
        &state.weights,
        &state.nominal,
        &state.sick,
        setup.sampling,
        setup.delegated,
        setup.offloads,
        scratch,
        memo,
    );
    let revenue = ledger::revenue_of(setup.game, setup.demand, &current, setup.nodes, &mut tree, setup.routes);
    let ledger = if revenue_only {
        None
    } else {
        Some(ledger::ledger_of(
            setup.game,
            setup.design,
            setup.demand,
            &current,
            setup.nodes,
            &mut tree,
            setup.routes,
        ))
    };
    Solved { ledger, revenue, state, passes: ran }
}

/// `bottleneckOf`: the Node whose doubled capacity would earn the most.
pub fn bottleneck_of(
    setup: &Setup,
    base: &Ledger,
    base_revenue: f64,
    start: &State,
    scratch: &mut crate::routing::Scratch,
    memo: &mut Memo,
) -> Option<usize> {
    let busiest = ledger::busiest_nodes(setup.nodes, &base.nodes);
    let mut best: Option<usize> = None;
    let mut gain = (base_revenue * 0.01).max(0.005);
    for slot in busiest {
        let boosted = solve_with(setup, scratch, memo, Some(slot), Some(start), 1, true);
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
                for kind in 0..NR {
                    if !near(before.service_fixed[kind], after.service_fixed[kind])
                        || !near(before.service_variable[kind], after.service_variable[kind])
                    {
                        return false;
                    }
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
        if was_stranded.map(|(_, kinds)| kinds.count_ones()).unwrap_or(0)
            != is_stranded.map(|(_, kinds)| kinds.count_ones()).unwrap_or(0)
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
