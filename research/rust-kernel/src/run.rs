//! The run functions: one boundary crossing per pass, per outcome tree, per solve.
//!
//! Each one reads the ABI's blocks, checks them, and returns a status code. A
//! short block, an Edge that names a Node outside the Design, a Component whose
//! rule is not ported, or a Game outside the ported surface returns a code
//! instead of a figure, so a host never reads a number that only looks right.

use crate::abi::{self, Inputs};
use crate::catalog::*;
use crate::dist::{Outcome, CAUSE_COUNT};
use crate::ledger::{Ledger, Route};
use crate::model::{GameCtx, Model, Node, Rates};
use crate::outcomes::{self, tree, Memo};
use crate::pass::{forward, Run};
use crate::routing::{Design, Scratch};
use crate::solve::{self, Setup};

/// The model block's stride: the figures, then each kind's fixed and variable part.
pub const MODEL_STRIDE: usize = 18 + 2 * NR;
/// The Outcome block's stride: seven figures, then twelve failure shares.
pub const OUTCOME_STRIDE: usize = 19;
/// Where the Ledger's per-kind rows start.
pub const LEDGER_KIND_BASE: usize = 64;
/// One kind row: rate, success, apdex, completion, mean, p50, p95, p99.
pub const LEDGER_KIND_STRIDE: usize = 8;
/// One Node row's stride.
pub const LEDGER_NODE_STRIDE: usize = 14;
/// Where the Ledger's per-kind bottlenecks start.
pub const LEDGER_BOTTLENECK_BASE: usize = 28;
/// Where the Ledger's error shares start.
pub const LEDGER_ERROR_BASE: usize = 16;
/// The summary block: the figures a caller reads without the rows.
pub const SUMMARY_REVENUE: usize = 0;
pub const SUMMARY_BOTTLENECK: usize = 1;
pub const SUMMARY_PASSES: usize = 2;
pub const SUMMARY_NODES: usize = 3;
pub const SUMMARY_LEN: usize = 4;

/// How many `f64`s a Ledger of `nodes` Nodes takes.
pub fn ledger_len(nodes: usize) -> usize {
    LEDGER_KIND_BASE + NR * LEDGER_KIND_STRIDE + nodes * LEDGER_NODE_STRIDE
}

#[no_mangle]
pub extern "C" fn model_stride() -> i32 {
    MODEL_STRIDE as i32
}

#[no_mangle]
pub extern "C" fn outcome_stride() -> i32 {
    OUTCOME_STRIDE as i32
}

#[no_mangle]
pub extern "C" fn ledger_kind_base() -> i32 {
    LEDGER_KIND_BASE as i32
}

#[no_mangle]
pub extern "C" fn ledger_kind_stride() -> i32 {
    LEDGER_KIND_STRIDE as i32
}

#[no_mangle]
pub extern "C" fn ledger_node_stride() -> i32 {
    LEDGER_NODE_STRIDE as i32
}

#[no_mangle]
pub extern "C" fn ledger_node_base() -> i32 {
    (LEDGER_KIND_BASE + NR * LEDGER_KIND_STRIDE) as i32
}

#[no_mangle]
pub extern "C" fn ledger_bottleneck_base() -> i32 {
    LEDGER_BOTTLENECK_BASE as i32
}

#[no_mangle]
pub extern "C" fn ledger_error_base() -> i32 {
    LEDGER_ERROR_BASE as i32
}

#[no_mangle]
pub extern "C" fn ledger_len_for(nodes: i32) -> i32 {
    ledger_len(nodes.max(0) as usize) as i32
}

#[no_mangle]
pub extern "C" fn summary_len() -> i32 {
    SUMMARY_LEN as i32
}

/// The status a Game outside the ported surface returns.
fn surface(nodes: &[Node], game: &GameCtx, inputs: &Inputs) -> i32 {
    if nodes.iter().any(|node| !outcomes::supports(node.type_code)) {
        return abi::UNSUPPORTED;
    }
    // An incident rewrites figures through rules the port has not reached yet.
    if !game.incident.is_empty() {
        return abi::UNSUPPORTED;
    }
    // A shipped Feature moves demand, payload, and value.
    if game.features.iter().any(|bits| *bits != 0) {
        return abi::UNSUPPORTED;
    }
    // A Product lever moves a kind's share, which needs the Era's mix.
    if inputs.levers.iter().any(|step| *step > 0.0) {
        return abi::UNSUPPORTED;
    }
    abi::OK
}

/// The Nodes, the Game, and the Design a run reads, or the status that stops it.
fn prepare(inputs: &Inputs) -> Result<(Design, Vec<Node>, GameCtx), i32> {
    let design = match crate::routing::with_design(|design| design.clone()) {
        Some(design) => design,
        None => return Err(abi::NO_DESIGN),
    };
    let count = design.nodes.len();
    if inputs.scalars.len() < count * abi::SCALARS {
        return Err(abi::SHORT_BLOCK);
    }
    if inputs.weights.len() < count
        || inputs.nominal.len() < count
        || inputs.sick.len() < count
        || inputs.intake.len() < count
        || inputs.demand.len() < NK
    {
        return Err(abi::SHORT_BLOCK);
    }
    let nodes: Vec<Node> = (0..count).map(|slot| abi::node_of(inputs.row(slot))).collect();
    let game = abi::game_with(inputs.row(0), abi::research_of(&inputs.research), abi::features_of(&inputs.features));
    let status = surface(&nodes, &game, inputs);
    if status != abi::OK {
        return Err(status);
    }
    Ok((design, nodes, game))
}

/// The demand block, as rates.
fn demand_of(inputs: &Inputs) -> Rates {
    let mut demand = [0.0f64; NK];
    for kind in 0..NK {
        demand[kind] = inputs.demand.get(kind).copied().unwrap_or(0.0);
    }
    demand
}

/// The latency block: one `Calls` record per Node, by backend kind.
fn latency_of(inputs: &Inputs, nodes: usize) -> Vec<[f64; NK]> {
    (0..nodes)
        .map(|slot| {
            let mut calls = [0.0f64; NK];
            for kind in 0..NK {
                calls[kind] = inputs.latency.get(slot * NK + kind).copied().unwrap_or(0.0);
            }
            calls
        })
        .collect()
}

fn sick_of(inputs: &Inputs) -> Vec<bool> {
    inputs.sick.iter().map(|byte| *byte != 0).collect()
}

fn mesh_of(nodes: &[Node]) -> Vec<bool> {
    nodes.iter().map(|node| node.mesh).collect()
}

/// `forward_run`: one pass over the cached Design.
#[no_mangle]
pub extern "C" fn forward_run() -> i32 {
    abi::with_inputs(|inputs| {
        let (design, nodes, game) = match prepare(inputs) {
            Ok(prepared) => prepared,
            Err(status) => return status,
        };
        let demand = demand_of(inputs);
        let latency = latency_of(inputs, nodes.len());
        let sick = sick_of(inputs);
        let sampling = inputs.column(abi::S_SAMPLING_MS);
        let delegated = inputs.flags(abi::S_DELEGATED);
        let offloads = inputs.flags(abi::S_OFFLOADED);
        let pod = inputs.flags(abi::S_POD);
        let mesh = mesh_of(&nodes);
        let users_in_group = inputs.column(abi::S_USERS_IN_GROUP);
        let inflight = inputs.column(abi::S_INFLIGHT);
        let connections = inputs.column(abi::S_CONNECTIONS);
        let mut scratch = Scratch::default();
        let run = Run {
            design: &design,
            game: &game,
            nodes: &nodes,
            demand: &demand,
            intake: &inputs.intake,
            weights: &inputs.weights,
            nominal: &inputs.nominal,
            sick: &sick,
            call_latency: &latency,
            inflight: &inflight,
            connections: &connections,
            users_in_group: &users_in_group,
            sampling: &sampling,
            delegated: &delegated,
            offloads: &offloads,
            pod: &pod,
            mesh: &mesh,
            boost: None,
        };
        let pass = forward(&run, &mut scratch);
        abi::with_outputs(|outputs| {
            // The kernel sizes its own outputs: the host reads them after the call.
            outputs.arriving.clear();
            outputs.arriving.resize(nodes.len() * NK, 0.0);
            outputs.models.clear();
            outputs.models.resize(nodes.len() * MODEL_STRIDE, 0.0);
            for slot in 0..nodes.len() {
                for kind in 0..NK {
                    outputs.arriving[slot * NK + kind] = pass.arriving[slot][kind];
                }
                let base = slot * MODEL_STRIDE;
                write_model(&pass.models[slot], &mut outputs.models[base..base + MODEL_STRIDE]);
            }
            abi::OK
        })
    })
}

fn write_model(model: &Model, out: &mut [f64]) {
    let values = [
        model.utilization,
        model.share,
        model.capacity,
        model.limit as usize as f64,
        model.tail_p,
        model.tail_ms,
        model.processes,
        model.inflight,
        model.cpu_used,
        model.cpu_total,
        model.ram_used,
        model.ram_total,
        model.slots_used,
        model.slots_total,
        model.network_used,
        model.network_total,
        if model.throttled { 1.0 } else { 0.0 },
        if model.swapping { 1.0 } else { 0.0 },
    ];
    for (index, value) in values.iter().enumerate() {
        if let Some(cell) = out.get_mut(index) {
            *cell = *value;
        }
    }
    for kind in 0..NR {
        if let Some(cell) = out.get_mut(18 + kind) {
            *cell = model.service_fixed[kind];
        }
        if let Some(cell) = out.get_mut(18 + NR + kind) {
            *cell = model.service_variable[kind];
        }
    }
}

/// `outcome_run`: one pass, then every Users Node's outcome per request kind.
#[no_mangle]
pub extern "C" fn outcome_run() -> i32 {
    abi::with_inputs(|inputs| {
        let (design, nodes, game) = match prepare(inputs) {
            Ok(prepared) => prepared,
            Err(status) => return status,
        };
        let demand = demand_of(inputs);
        let latency = latency_of(inputs, nodes.len());
        let sick = sick_of(inputs);
        let sampling = inputs.column(abi::S_SAMPLING_MS);
        let delegated = inputs.flags(abi::S_DELEGATED);
        let offloads = inputs.flags(abi::S_OFFLOADED);
        let pod = inputs.flags(abi::S_POD);
        let mesh = mesh_of(&nodes);
        let users_in_group = inputs.column(abi::S_USERS_IN_GROUP);
        let inflight = inputs.column(abi::S_INFLIGHT);
        let connections = inputs.column(abi::S_CONNECTIONS);
        let mut scratch = Scratch::default();
        let run = Run {
            design: &design,
            game: &game,
            nodes: &nodes,
            demand: &demand,
            intake: &inputs.intake,
            weights: &inputs.weights,
            nominal: &inputs.nominal,
            sick: &sick,
            call_latency: &latency,
            inflight: &inflight,
            connections: &connections,
            users_in_group: &users_in_group,
            sampling: &sampling,
            delegated: &delegated,
            offloads: &offloads,
            pod: &pod,
            mesh: &mesh,
            boost: None,
        };
        let pass = forward(&run, &mut scratch);
        let mut memo = Memo::default();
        let mut walk = tree(
            &design,
            &game,
            &nodes,
            &pass,
            &inputs.weights,
            &inputs.nominal,
            &sick,
            &sampling,
            &delegated,
            &offloads,
            &mut scratch,
            &mut memo,
        );
        abi::with_outputs(|outputs| {
            outputs.outcomes.clear();
            outputs.outcomes.resize(nodes.len() * NR * OUTCOME_STRIDE, 0.0);
            for (slot, node) in nodes.iter().enumerate() {
                if node.type_code != component_index("users") {
                    continue;
                }
                for kind in 0..NR {
                    let value = walk.outcome(slot, kind);
                    let base = (slot * NR + kind) * OUTCOME_STRIDE;
                    write_outcome(&value, &mut outputs.outcomes[base..base + OUTCOME_STRIDE]);
                }
            }
            abi::OK
        })
    })
}

fn write_outcome(value: &Outcome, out: &mut [f64]) {
    let figures = [
        value.success,
        value.fixed_ms,
        value.variable_ms,
        value.tail_p,
        value.tail_ms,
        value.stale,
        value.value,
    ];
    for (index, figure) in figures.iter().enumerate() {
        if let Some(cell) = out.get_mut(index) {
            *cell = *figure;
        }
    }
    for cause in 0..CAUSE_COUNT {
        if let Some(cell) = out.get_mut(7 + cause) {
            *cell = value.fail[cause];
        }
    }
}

/// `outcome_probe`: one Node's outcome for one kind, so a harness can trace a chain.
#[no_mangle]
pub extern "C" fn outcome_probe(node: i32, kind: i32) -> i32 {
    abi::with_inputs(|inputs| {
        let (design, nodes, game) = match prepare(inputs) {
            Ok(prepared) => prepared,
            Err(status) => return status,
        };
        let demand = demand_of(inputs);
        let latency = latency_of(inputs, nodes.len());
        let sick = sick_of(inputs);
        let sampling = inputs.column(abi::S_SAMPLING_MS);
        let delegated = inputs.flags(abi::S_DELEGATED);
        let offloads = inputs.flags(abi::S_OFFLOADED);
        let pod = inputs.flags(abi::S_POD);
        let mesh = mesh_of(&nodes);
        let users_in_group = inputs.column(abi::S_USERS_IN_GROUP);
        let inflight = inputs.column(abi::S_INFLIGHT);
        let connections = inputs.column(abi::S_CONNECTIONS);
        let mut scratch = Scratch::default();
        let run = Run {
            design: &design,
            game: &game,
            nodes: &nodes,
            demand: &demand,
            intake: &inputs.intake,
            weights: &inputs.weights,
            nominal: &inputs.nominal,
            sick: &sick,
            call_latency: &latency,
            inflight: &inflight,
            connections: &connections,
            users_in_group: &users_in_group,
            sampling: &sampling,
            delegated: &delegated,
            offloads: &offloads,
            pod: &pod,
            mesh: &mesh,
            boost: None,
        };
        let pass = forward(&run, &mut scratch);
        let mut memo = Memo::default();
        let mut walk = tree(
            &design, &game, &nodes, &pass, &inputs.weights, &inputs.nominal, &sick, &sampling,
            &delegated, &offloads, &mut scratch, &mut memo,
        );
        let value = walk.outcome(node.max(0) as usize, kind.max(0) as usize);
        abi::with_outputs(|outputs| {
            outputs.outcomes.clear();
            outputs.outcomes.resize(OUTCOME_STRIDE, 0.0);
            write_outcome(&value, &mut outputs.outcomes[..OUTCOME_STRIDE]);
            abi::OK
        })
    })
}

/// The routes block: each region's users, as (region, source slot, share, hop ms).
fn routes_of(inputs: &Inputs) -> Result<Vec<Route>, i32> {
    if inputs.routes.len() % 4 != 0 {
        return Err(abi::BAD_EDGE);
    }
    Ok(inputs
        .routes
        .chunks_exact(4)
        .map(|row| {
            let source = row[1];
            Route {
                region: row[0] as usize,
                source: if source >= 0.0 { Some(source as usize) } else { None },
                share: row[2],
                extra_ms: row[3],
            }
        })
        .collect())
}

/// `solve_run`: the pass loop, from the probe to the Ledger.
#[no_mangle]
pub extern "C" fn solve_run(boost_slot: i32, passes: i32, revenue_only: i32) -> i32 {
    solve_impl(boost_slot, passes, revenue_only, false)
}

thread_local! {
    /// The state the last `solve_run` converged to, so the Bottleneck search
    /// starts where the flow solve ended, as the TypeScript's cached state does.
    static CONVERGED: core::cell::RefCell<Option<(usize, solve::State, f64)>> =
        core::cell::RefCell::new(None);
}

/// `bottleneck_run`: the Bottleneck search over the last solve's converged state.
/// With no solve before it, this solves first and then searches.
#[no_mangle]
pub extern "C" fn bottleneck_run(passes: i32) -> i32 {
    solve_impl(-1, passes, 0, true)
}

/// Forgets the converged state, so the next search solves from the probe again.
#[no_mangle]
pub extern "C" fn forget_solve() -> i32 {
    CONVERGED.with(|cell| *cell.borrow_mut() = None);
    abi::OK
}

fn solve_impl(boost_slot: i32, passes: i32, revenue_only: i32, search: bool) -> i32 {
    abi::with_inputs(|inputs| {
        let (design, nodes, game) = match prepare(inputs) {
            Ok(prepared) => prepared,
            Err(status) => return status,
        };
        if inputs.probe.len() < NR {
            return abi::SHORT_BLOCK;
        }
        let routes = match routes_of(inputs) {
            Ok(routes) => routes,
            Err(status) => return status,
        };
        let demand = demand_of(inputs);
        let mut probe = [0.0f64; NK];
        for kind in 0..NR {
            probe[kind] = inputs.probe.get(kind).copied().unwrap_or(0.0);
        }
        let sampling = inputs.column(abi::S_SAMPLING_MS);
        let delegated = inputs.flags(abi::S_DELEGATED);
        let offloads = inputs.flags(abi::S_OFFLOADED);
        let pod = inputs.flags(abi::S_POD);
        let mesh = mesh_of(&nodes);
        let users_in_group = inputs.column(abi::S_USERS_IN_GROUP);
        let setup = Setup {
            design: &design,
            game: &game,
            nodes: &nodes,
            demand: &demand,
            intake: &inputs.intake,
            routes: &routes,
            probe_mix: &probe,
            sampling: &sampling,
            delegated: &delegated,
            offloads: &offloads,
            pod: &pod,
            mesh: &mesh,
            users_in_group: &users_in_group,
        };
        let mut scratch = Scratch::default();
        let mut memo = Memo::default();
        let boost = if boost_slot >= 0 { Some(boost_slot as usize) } else { None };
        // A search starts from the state the last flow solve converged to, which
        // is what the TypeScript's cached `SolveState` gives it.
        let start = if search {
            CONVERGED.with(|cell| {
                cell.borrow()
                    .as_ref()
                    .filter(|(count, _, _)| *count == nodes.len())
                    .map(|(_, state, _)| state.clone())
            })
        } else {
            None
        };
        let solved = solve::solve_with(
            &setup,
            &mut scratch,
            &mut memo,
            boost,
            start.as_ref(),
            if passes <= 0 { solve::PASSES } else { passes as usize },
            revenue_only != 0,
        );
        if !search && boost.is_none() {
            CONVERGED.with(|cell| *cell.borrow_mut() = Some((nodes.len(), solved.state.clone(), solved.revenue)));
        }
        let mut bottleneck = boost_slot;
        let mut ledger = solved.ledger;
        if search {
            let base = match ledger.as_ref() {
                Some(base) => base,
                None => return abi::SHORT_BLOCK,
            };
            bottleneck = solve::bottleneck_of(&setup, base, solved.revenue, &solved.state, &mut scratch, &mut memo)
                .map(|slot| slot as i32)
                .unwrap_or(-1);
            if let Some(base) = ledger.as_mut() {
                base.bottleneck = if bottleneck >= 0 { Some(bottleneck as usize) } else { None };
            }
        }
        abi::with_outputs(|outputs| {
            outputs.summary.clear();
            outputs.summary.resize(SUMMARY_LEN, 0.0);
            outputs.summary[SUMMARY_REVENUE] = solved.revenue;
            outputs.summary[SUMMARY_BOTTLENECK] = bottleneck as f64;
            outputs.summary[SUMMARY_PASSES] = solved.passes as f64;
            outputs.summary[SUMMARY_NODES] = nodes.len() as f64;
            let ledger = match ledger.as_ref() {
                Some(ledger) => ledger,
                None => return abi::OK,
            };
            outputs.ledger.clear();
            outputs.ledger.resize(ledger_len(nodes.len()), 0.0);
            write_ledger(ledger, &mut outputs.ledger, nodes.len());
            abi::OK
        })
    })
}

fn write_ledger(ledger: &Ledger, out: &mut [f64], nodes: usize) {
    let mut put = |index: usize, value: f64| {
        if let Some(cell) = out.get_mut(index) {
            *cell = value;
        }
    };
    put(0, ledger.revenue);
    put(1, ledger.demand);
    put(2, ledger.served);
    put(3, ledger.apdex);
    put(4, ledger.latency);
    put(5, ledger.p50);
    put(6, ledger.p95);
    put(7, ledger.p99);
    put(8, ledger.error_share);
    put(9, ledger.fines);
    put(10, ledger.subscriptions);
    put(11, ledger.bottleneck.map(|slot| slot as f64).unwrap_or(-1.0));
    put(12, ledger.failing.len() as f64);
    put(13, ledger.errors.iter().sum::<f64>());
    for cause in 0..CAUSE_COUNT {
        put(LEDGER_ERROR_BASE + cause, ledger.errors[cause]);
    }
    for kind in 0..NR {
        let slot = ledger.bottleneck_by_kind.get(kind).copied().flatten();
        put(LEDGER_BOTTLENECK_BASE + kind, slot.map(|slot| slot as f64).unwrap_or(-1.0));
        let row = ledger.kinds.get(kind).copied().unwrap_or_default();
        let base = LEDGER_KIND_BASE + kind * LEDGER_KIND_STRIDE;
        put(base, row.rate);
        put(base + 1, row.success);
        put(base + 2, row.apdex);
        put(base + 3, row.completion.unwrap_or(-1.0));
        put(base + 4, row.mean);
        put(base + 5, row.p50);
        put(base + 6, row.p95);
        put(base + 7, row.p99);
    }
    let node_base = LEDGER_KIND_BASE + NR * LEDGER_KIND_STRIDE;
    for slot in 0..nodes.min(ledger.nodes.len()) {
        let row = &ledger.nodes[slot];
        let base = node_base + slot * LEDGER_NODE_STRIDE;
        put(base, row.inbound);
        put(base + 1, row.capacity);
        put(base + 2, row.utilization);
        put(base + 3, row.dropped);
        put(base + 4, row.refused);
        put(base + 5, row.stranded);
        put(base + 6, row.latency);
        put(base + 7, row.p99);
        put(base + 8, row.repeated);
        put(base + 9, row.limit as f64);
        put(base + 10, row.connections.map(|(used, _)| used).unwrap_or(0.0));
        put(base + 11, row.connections.map(|(_, max)| max).unwrap_or(0.0));
        put(base + 12, row.hit_ratio.unwrap_or(-1.0));
        put(base + 13, row.lag_ms.unwrap_or(-1.0));
    }
}
