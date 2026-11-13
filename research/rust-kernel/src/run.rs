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
use crate::model::{GameCtx, Model, Node, Rates, ServerFlags};
use crate::outcomes::{self, tree, Memo};
use crate::pass::{forward, Board, CodeTable, Pass, Run};
use crate::routing::{Design, Splits, Weights};
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
    if game.incident_code != 0 && game.incident.is_none() {
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

/// The blocks every run reads, decoded once per call into columns the kernel owns.
struct Prepared {
    nodes: Vec<Node>,
    game: GameCtx,
    demand: Rates,
    sick: Vec<bool>,
    flags: Vec<ServerFlags>,
}

impl Prepared {
    fn board<'a>(&'a self, design: &'a Design, inputs: &'a Inputs, code: &'a CodeTable) -> Board<'a> {
        Board {
            design,
            game: &self.game,
            nodes: &self.nodes,
            demand: &self.demand,
            intake: &inputs.intake,
            flags: &self.flags,
            code,
        }
    }
}

/// Decodes the blocks against the cached Design, or returns the status that stops the run.
fn prepare(design: &Design, inputs: &Inputs) -> Result<Prepared, i32> {
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
    let mut nodes: Vec<Node> = (0..count).map(|slot| abi::node_of(inputs.row(slot))).collect();
    // `runsLocalDb`: Postgres still runs on an App Server until it links to a database.
    for (slot, node) in nodes.iter_mut().enumerate() {
        node.local_db &= !design.out_edges_of(slot).iter().any(|&edge| {
            design.edges.get(edge as usize).is_some_and(|edge| {
                let child = design.nodes[edge.to as usize].type_code as usize;
                crate::routing::accepts(child, kind::Q_READ) || crate::routing::accepts(child, kind::Q_WRITE)
            })
        });
    }
    let mut game = abi::game_with(inputs.row(0), abi::research_of(&inputs.research), abi::features_of(&inputs.features));
    for (cell, value) in game.scenario_value.iter_mut().zip(&inputs.value) {
        *cell = *value;
    }
    for (cell, share) in game.mix.iter_mut().zip(&inputs.probe) {
        *cell = *share;
    }
    // `queueOf`: a Worker takes the attempts of the first Queue that feeds it.
    for edge in &design.edges {
        let (from, to) = (edge.from as usize, edge.to as usize);
        if nodes[from].type_code == component::QUEUE
            && nodes[to].type_code == component::WORKER
            && nodes[to].queue_attempts == 0.0
        {
            nodes[to].queue_attempts = crate::ledger::attempts_allowed(nodes[from].dlq, nodes[from].attempts);
        }
    }
    game.cert_nodes = nodes.iter().any(|node| {
        node.cert_until.is_some()
            && matches!(node.type_code, component::LB | component::CDN | component::WAF | component::GW | component::WS | component::EDGE)
    });
    game.cdn_on_board = nodes.iter().any(|node| node.type_code == component::CDN);
    // `spreadCount`: North America and every region with users, up to the cap.
    let regions = nodes
        .iter()
        .filter(|node| node.type_code == component::USERS)
        .fold(1u32, |seen, node| seen | 1 << node.region.min(31));
    game.spread_regions = (regions.count_ones() as f64).min(SPREAD_REGIONS);
    // `spreadRegions`: the open regions nearest a spread store's own, up to the cap.
    for node in nodes.iter_mut().filter(|node| node.type_code == component::WIDE && node.spread) {
        let home = node.region.min(REGIONS.len() - 1);
        let mut open: Vec<usize> = (0..REGIONS.len()).filter(|region| regions >> region & 1 == 1).collect();
        open.sort_by(|a, b| REGION_RTT[home][*a].total_cmp(&REGION_RTT[home][*b]));
        node.local_regions = open.iter().take(SPREAD_REGIONS as usize).fold(0, |mask, region| mask | 1 << region);
    }
    let status = surface(&nodes, &game, inputs);
    if status != abi::OK {
        return Err(status);
    }
    let mut demand = [0.0f64; NK];
    demand.copy_from_slice(&inputs.demand[..NK]);
    let flags: Vec<ServerFlags> = nodes
        .iter()
        .enumerate()
        .map(|(slot, node)| {
            let row = inputs.row(slot);
            let flag = |index: usize| row.get(index).is_some_and(|value| *value != 0.0);
            let sampling = row.get(abi::S_SAMPLING_MS).copied().unwrap_or(0.0);
            ServerFlags::of(&game, node, sampling, flag(abi::S_DELEGATED), flag(abi::S_OFFLOADED), flag(abi::S_POD))
        })
        .collect();
    Ok(Prepared { sick: inputs.sick.iter().map(|byte| *byte != 0).collect(), nodes, game, demand, flags })
}

/// The scratch a run works in: the split cache, the memo tables, and the code
/// table. Kept for the life of the module, so a run reuses what the last one
/// allocated, and what it worked out from inputs that have not changed since.
#[derive(Default)]
struct Workspace {
    splits: Splits,
    memo: Memo,
    code: CodeTable,
    /// The Game, Nodes, and flags `code` was built from.
    code_for: Option<(GameCtx, Vec<Node>, Vec<ServerFlags>)>,
}

impl Workspace {
    /// Rebuilds the code table when these inputs differ from the ones it was built from.
    fn refresh_code(&mut self, prepared: &Prepared) {
        let fresh = self.code_for.as_ref().is_some_and(|(game, nodes, flags)| {
            *game == prepared.game && *nodes == prepared.nodes && *flags == prepared.flags
        });
        if !fresh {
            self.code = CodeTable::new(&prepared.game, &prepared.nodes, &prepared.flags);
            self.code_for = Some((prepared.game.clone(), prepared.nodes.clone(), prepared.flags.clone()));
        }
    }
}

thread_local! {
    static WORKSPACE: core::cell::RefCell<Workspace> = core::cell::RefCell::new(Workspace::default());
}

/// Runs `body` over the cached Design, the decoded blocks, and the workspace.
fn with_prepared(body: impl FnOnce(&Design, &Inputs, &Prepared, &mut Workspace) -> i32) -> i32 {
    abi::with_inputs(|inputs| {
        crate::routing::with_design(|design| match prepare(design, inputs) {
            Ok(prepared) => WORKSPACE.with(|cell| body(design, inputs, &prepared, &mut cell.borrow_mut())),
            Err(status) => status,
        })
        .unwrap_or(abi::NO_DESIGN)
    })
}

/// One pass over the feedback the host wrote, for the harnesses that check a
/// pass or a tree on their own.
fn host_pass(board: Board, inputs: &Inputs, sick: &[bool], splits: &mut Splits) -> Pass {
    let latency: Vec<[f64; NK]> = (0..board.nodes.len())
        .map(|slot| {
            let mut calls = [0.0f64; NK];
            if let Some(row) = inputs.latency.get(slot * NK..(slot + 1) * NK) {
                calls.copy_from_slice(row);
            }
            calls
        })
        .collect();
    let inflight = inputs.column(abi::S_INFLIGHT);
    let connections = inputs.column(abi::S_CONNECTIONS);
    let run = Run {
        board,
        weights: host_weights(inputs, sick),
        call_latency: &latency,
        inflight: &inflight,
        connections: &connections,
        failures: &[],
        task_failure: &[],
        task_capacity: &[],
        boost: None,
    };
    splits.reset(board.design);
    forward(&run, splits)
}

fn host_weights<'a>(inputs: &'a Inputs, sick: &'a [bool]) -> Weights<'a> {
    Weights { live: &inputs.weights, nominal: &inputs.nominal, sick }
}

/// `forward_run`: one pass over the cached Design.
#[no_mangle]
pub extern "C" fn forward_run() -> i32 {
    with_prepared(|design, inputs, prepared, work| {
        work.refresh_code(prepared);
        let Workspace { splits, code, .. } = work;
        let board = prepared.board(design, inputs, code);
        let pass = host_pass(board, inputs, &prepared.sick, splits);
        let count = board.nodes.len();
        abi::with_outputs(|outputs| {
            // The kernel sizes its own outputs: the host reads them after the call.
            outputs.arriving.clear();
            outputs.arriving.extend(pass.arriving.iter().flatten());
            outputs.models.clear();
            outputs.models.resize(count * MODEL_STRIDE, 0.0);
            for (model, out) in pass.models.iter().zip(outputs.models.as_chunks_mut::<MODEL_STRIDE>().0) {
                write_model(model, out);
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
    with_prepared(|design, inputs, prepared, work| {
        work.refresh_code(prepared);
        let Workspace { splits, memo, code, .. } = work;
        let board = prepared.board(design, inputs, code);
        let pass = host_pass(board, inputs, &prepared.sick, splits);
        let mut walk = tree(board, &pass, host_weights(inputs, &prepared.sick), splits, memo);
        abi::with_outputs(|outputs| {
            outputs.outcomes.clear();
            outputs.outcomes.resize(board.nodes.len() * NR * OUTCOME_STRIDE, 0.0);
            for (slot, node) in board.nodes.iter().enumerate() {
                if node.type_code != component::USERS {
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
    with_prepared(|design, inputs, prepared, work| {
        work.refresh_code(prepared);
        let Workspace { splits, memo, code, .. } = work;
        let board = prepared.board(design, inputs, code);
        let pass = host_pass(board, inputs, &prepared.sick, splits);
        let mut walk = tree(board, &pass, host_weights(inputs, &prepared.sick), splits, memo);
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
    if !inputs.routes.len().is_multiple_of(4) {
        return Err(abi::BAD_EDGE);
    }
    Ok(inputs
        .routes
        .as_chunks::<4>().0.iter()
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

/// What the last `solve_run` converged to: the Bottleneck search ranks its
/// Ledger and re-solves each candidate from its state, as the TypeScript's
/// `bottleneckOf(game, flow)` does with the flow solve and its cached state.
struct Converged {
    nodes: usize,
    solved: solve::Solved,
}

thread_local! {
    static CONVERGED: core::cell::RefCell<Option<Converged>> = const { core::cell::RefCell::new(None) };
}

/// `bottleneck_run`: the Bottleneck search over the last solve's Ledger and state.
/// With no solve before it, or one that kept no Ledger, this solves first.
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
    with_prepared(|design, inputs, prepared, work| {
        if inputs.probe.len() < NR {
            return abi::SHORT_BLOCK;
        }
        let routes = match routes_of(inputs) {
            Ok(routes) => routes,
            Err(status) => return status,
        };
        let mut probe = [0.0f64; NK];
        probe[..NR].copy_from_slice(&inputs.probe[..NR]);
        work.refresh_code(prepared);
        let Workspace { splits, memo, code, .. } = work;
        let setup = Setup { board: prepared.board(design, inputs, code), routes: &routes, probe_mix: &probe };
        let count = prepared.nodes.len();
        let boost = if boost_slot >= 0 { Some(boost_slot as usize) } else { None };
        let passes = if passes <= 0 { solve::PASSES } else { passes as usize };
        let cached = if search {
            CONVERGED.with(|cell| cell.borrow_mut().take_if(|converged| converged.nodes == count))
        } else {
            None
        };
        let want = if revenue_only != 0 { solve::Want::Revenue } else { solve::Want::Ledger };
        let mut solved = match cached {
            Some(converged) if converged.solved.ledger.is_some() => converged.solved,
            // A revenue-only solve kept no Ledger to rank: solve again from its state.
            Some(converged) => {
                solve::solve_with(&setup, splits, memo, boost, Some(&converged.solved.state), passes, want)
            }
            None => solve::solve_with(&setup, splits, memo, boost, None, passes, want),
        };
        let mut bottleneck = boost_slot;
        if search {
            let base = match solved.ledger.as_ref() {
                Some(base) => base,
                None => return abi::SHORT_BLOCK,
            };
            let found = solve::bottleneck_of(&setup, base, solved.revenue, &solved.state, splits, memo);
            bottleneck = found.map(|slot| slot as i32).unwrap_or(-1);
            if let Some(base) = solved.ledger.as_mut() {
                base.bottleneck = found;
            }
        }
        let status = abi::with_outputs(|outputs| {
            outputs.summary.clear();
            outputs.summary.resize(SUMMARY_LEN, 0.0);
            outputs.summary[SUMMARY_REVENUE] = solved.revenue;
            outputs.summary[SUMMARY_BOTTLENECK] = bottleneck as f64;
            outputs.summary[SUMMARY_PASSES] = solved.passes as f64;
            outputs.summary[SUMMARY_NODES] = count as f64;
            if let Some(ledger) = solved.ledger.as_ref() {
                outputs.ledger.clear();
                outputs.ledger.resize(ledger_len(count), 0.0);
                write_ledger(ledger, &mut outputs.ledger, count);
            }
            abi::OK
        });
        // The flow solve, and a search that ran on it, leave it for the next search.
        if boost.is_none() {
            CONVERGED.with(|cell| *cell.borrow_mut() = Some(Converged { nodes: count, solved }));
        }
        status
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
