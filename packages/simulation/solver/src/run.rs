//! The run functions: one boundary crossing per pass, per outcome tree, per solve.
//!
//! Each one reads the ABI's blocks, checks them, and returns a status code. A
//! short block, an Edge that names a Node outside the Design, a Component whose
//! rule is not ported, or a Game outside the ported surface returns a code
//! instead of a figure, so a host never reads a number that only looks right.

use crate::abi::{self, Inputs};
use crate::catalog::*;
use crate::ledger::Route;
use crate::model::{GameCtx, Node, Rates, ServerFlags};
use crate::outcomes::Memo;
use crate::pass::{Board, CodeTable};
use crate::routing::{Design, Splits};
use crate::solve::{self, Setup};

/// The summary block: the figures a caller reads without the rows.
pub const SUMMARY_REVENUE: usize = 0;
pub const SUMMARY_BOTTLENECK: usize = 1;
pub const SUMMARY_PASSES: usize = 2;
pub const SUMMARY_NODES: usize = 3;
pub const SUMMARY_LEN: usize = 4;

#[no_mangle]
pub extern "C" fn summary_len() -> i32 {
    SUMMARY_LEN as i32
}

/// The status a Game outside the ported surface returns.
fn surface(game: &GameCtx) -> i32 {
    // An incident code from a catalog newer than the solver's.
    if game.incident_code != 0 && game.incident.is_none() {
        return abi::UNSUPPORTED;
    }
    abi::OK
}

/// The blocks every run reads, decoded once per call into columns the solver owns.
struct Prepared {
    nodes: Vec<Node>,
    game: GameCtx,
    demand: Rates,
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
    let mut game = abi::game_with(inputs.row(0), abi::research_of(&inputs.research));
    let columns = [(&mut game.value[..], &inputs.value), (&mut game.payload[..], &inputs.payload), (&mut game.query[..], &inputs.query)];
    for (cells, column) in columns {
        for (cell, value) in cells.iter_mut().zip(column) {
            *cell = *value;
        }
    }
    for (cell, service) in game.kind_service.iter_mut().zip(&inputs.kind_service) {
        *cell = if *service >= 0.0 { *service as usize } else { usize::MAX };
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
    game.edge_on_board = nodes.iter().any(|node| node.type_code == component::EDGE && !node.down);
    game.edge_auth = nodes.iter().any(|node| node.type_code == component::GW && node.auth_edge && !node.down && !node.shut);
    game.static_pages = nodes
        .iter()
        .filter(|node| node.type_code == component::SERVER && !node.down)
        .fold(0.0, |best, node| best.max(FRAMEWORK_CACHEABLE[node.framework]));
    // `pinnedOf`: a sticky Load Balancer links to the Node. `vecOf`: the first live
    // Vector Index, in board order, that a Node links to.
    for (slot, node) in nodes.iter_mut().enumerate() {
        node.cdc_mirrored = !design.mirror_edges_of(slot).is_empty();
    }
    let mut first_vec = vec![usize::MAX; nodes.len()];
    for edge in &design.edges {
        let (from, to) = (edge.from as usize, edge.to as usize);
        if nodes[from].type_code == component::LB && nodes[from].sticky {
            nodes[to].pinned = true;
        }
        if nodes[to].type_code == component::VEC && !nodes[to].down {
            first_vec[from] = first_vec[from].min(to);
        }
    }
    let recalls: Vec<Option<f64>> =
        first_vec.iter().map(|&vec| (vec != usize::MAX).then(|| VEC_INDEXES_RECALL[nodes[vec].index_type])).collect();
    for (node, recall) in nodes.iter_mut().zip(recalls) {
        node.vec_recall = recall;
    }
    // `spreadCount`: North America and every region with users, up to the cap.
    let regions = nodes
        .iter()
        .filter(|node| node.type_code == component::USERS)
        .fold(1u32, |seen, node| seen | 1 << node.region.min(31));
    game.spread_regions = (regions.count_ones() as f64).min(SPREAD_REGIONS);
    // `spreadRegions`: the open regions nearest a spread store's own, up to the cap.
    for node in nodes.iter_mut().filter(|node| matches!(node.type_code, component::WIDE | component::DSQL) && node.spread) {
        let home = node.region.min(REGIONS.len() - 1);
        let mut open: Vec<usize> = (0..REGIONS.len()).filter(|region| regions >> region & 1 == 1).collect();
        open.sort_by(|a, b| REGION_RTT[home][*a].total_cmp(&REGION_RTT[home][*b]));
        open.truncate(SPREAD_REGIONS as usize);
        node.local_regions = open.iter().fold(0, |mask, region| mask | 1 << region);
        // `majorityMs`: a consensus write waits for the round trip of its majority-th nearest region.
        node.majority_ms = open.get(open.len() / 2).map_or(0.0, |region| REGION_RTT[home][*region]);
    }
    let status = surface(&game);
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
            let sampling = row.get(abi::S_SAMPLING).copied().unwrap_or(0.0);
            ServerFlags::of(&game, node, sampling, flag(abi::S_DELEGATED), flag(abi::S_OFFLOADED), flag(abi::S_POD))
        })
        .collect();
    Ok(Prepared { nodes, game, demand, flags })
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

/// The links block: each Link in Game order, as (from slot, to slot, Edge or -1, breaker).
fn links_of(inputs: &Inputs, nodes: usize, edges: usize) -> Result<Vec<crate::ledger::LinkIn>, i32> {
    let (rows, rest) = inputs.links.as_chunks::<{ abi::LINK_FIELDS }>();
    if !rest.is_empty() {
        return Err(abi::BAD_EDGE);
    }
    rows.iter()
        .map(|row| {
            let (from, to, edge) = (row[0] as usize, row[1] as usize, row[2]);
            if from >= nodes || to >= nodes || edge >= edges as f64 {
                return Err(abi::BAD_EDGE);
            }
            Ok(crate::ledger::LinkIn {
                from,
                to,
                edge: (edge >= 0.0).then_some(edge as usize),
                breaker: row[3] != 0.0,
            })
        })
        .collect()
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
        let links = match links_of(inputs, prepared.nodes.len(), design.edges.len()) {
            Ok(links) => links,
            Err(status) => return status,
        };
        let mut probe = [0.0f64; NK];
        probe[..NR].copy_from_slice(&inputs.probe[..NR]);
        work.refresh_code(prepared);
        let Workspace { splits, memo, code, .. } = work;
        let setup =
            Setup { board: prepared.board(design, inputs, code), routes: &routes, links: &links, probe_mix: &probe };
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
                outputs.ledger = crate::wire::Wire::ledger(ledger);
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
