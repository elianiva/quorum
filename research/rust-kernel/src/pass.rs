//! One forward pass: each Node's model, what it serves, and where it sends it.
//!
//! Ported from `solve-pass.ts` (`forward`, `callsOf`, `splitOf`, `route`) and the
//! `serve` and `connections` halves of each component rule. A kind's rates live
//! in a fixed `[f64; NK]`, so a pass allocates nothing per Node once `Scratch`
//! has warmed up.

use crate::catalog::*;
use crate::extra::*;
use crate::dist::task_attempts;
use crate::model::{cache, Waf};
use crate::model::{cpu_base, database_model, flat_component, flat_scale, server_model, GameCtx, Incident, Model, Node, Order, Rates, ServerCtx, ServerFlags};
use crate::routing::{Design, Splits, Weights};

/// What one pass produced. The fields after `connections` are what the Ledger
/// reads, and what the pass loop feeds back into the next pass.
pub struct Pass {
    pub arriving: Vec<Rates>,
    /// The order each Node's `arriving` kinds were first sent in.
    pub order: Vec<Order>,
    pub models: Vec<Model>,
    pub links: Vec<Rates>,
    pub link_order: Vec<usize>,
    /// Whether `link_order` already lists each Edge.
    listed: Vec<bool>,
    pub connections: Vec<Option<(f64, f64)>>,
    /// A Cache's or CDN's hit ratio, and the share of its hits that are stale.
    pub hits: Vec<f64>,
    pub stale_hits: Vec<f64>,
    /// What a Node was sent and could not route: the rate, and the kinds.
    pub stranded: Vec<Option<(f64, u64)>>,
    /// Calls per second each Node gets on top of the first try.
    pub repeated: Vec<f64>,
    /// Tasks per second each Queue or Worker gets, by the request kind behind them.
    pub tasks: Vec<Rates>,
    /// Tasks per second each Queue's Workers take from it.
    pub drained: Vec<f64>,
    pub lag_ms: f64,
    pub stale_share: f64,
}

impl Pass {
    #[inline]
    pub fn rates(&self, slot: usize) -> &Rates {
        self.arriving.get(slot).unwrap_or(&ZERO_RATES)
    }

    #[inline]
    pub fn model(&self, slot: usize) -> Option<&Model> {
        self.models.get(slot)
    }
}

static ZERO_RATES: Rates = [0.0; NK];

/// `demandOf`'s key order: the mix's kinds in index order, then the bots an
/// attack adds when the mix has none of its own.
fn demand_order(game: &GameCtx, demand: &Rates) -> Order {
    let mut order = Order::default();
    let appended = game.mix[kind::BOT] <= 0.0;
    for kind in (0..NR).filter(|&kind| demand[kind] > 0.0 && !(appended && kind == kind::BOT)) {
        order.push(kind);
    }
    if appended && demand[kind::BOT] > 0.0 {
        order.push(kind::BOT);
    }
    order
}

#[inline]
pub fn is_down(node: &Node) -> bool {
    node.down
}

/// `asLogin`: this kind costs an App Server a password hash.
#[inline]
pub(crate) fn as_login(game: &GameCtx, kind: usize) -> bool {
    kind == kind::LOGIN || (kind == kind::BOT && game.incident == Some(Incident::Stuffing))
}

/// `profileOf`: the kind's profile, or a login when a stuffing incident is on.
#[inline]
pub(crate) fn profile_of(game: &GameCtx, kind: usize) -> usize {
    if kind == kind::BOT && game.incident == Some(Incident::Stuffing) {
        kind::LOGIN
    } else {
        kind
    }
}

/// Backend calls one request makes, by backend kind (`NR + backend` in a `Rates`).
pub type Calls = [f64; NB];

/// What one request of each kind costs a Node that runs code, before any pass:
/// the backend calls it makes, and the core-milliseconds it takes.
#[derive(Clone, Copy)]
pub struct Code {
    pub calls: [Calls; NR],
    /// `cpuBase` by request kind. Zero on a Function, whose model is flat. On an
    /// Edge Function, `requestCpuMs`: what its CPU ceiling is checked against.
    pub cpu: [f64; NR],
}

static NO_CODE: Code = Code { calls: [[0.0; NB]; NR], cpu: [0.0; NR] };

/// `callsOf` and `cpuBase` for every Node that runs code, worked out once per run.
///
/// Both read only the Game, the Node, and its `ServerFlags`, so they hold for
/// every pass, every tree, and every Bottleneck candidate. A row exists only for
/// an App Server, a Worker, or a Function; every other slot reads zeros.
#[derive(Default)]
pub struct CodeTable {
    /// Each slot's row in `rows`, or `u32::MAX` when it runs no code.
    row_of: Vec<u32>,
    rows: Vec<Code>,
}

impl CodeTable {
    pub fn new(game: &GameCtx, nodes: &[Node], flags: &[ServerFlags]) -> CodeTable {
        let mut table = CodeTable { row_of: vec![u32::MAX; nodes.len()], rows: Vec::new() };
        for ((slot, node), flags) in nodes.iter().enumerate().zip(flags) {
            if !matches!(node.type_code, component::SERVER | component::FN | component::WORKER | component::EDGE) {
                continue;
            }
            let mut code = NO_CODE;
            for kind in 0..NR {
                // A Worker runs only the async part of each kind.
                code.calls[kind] = if node.type_code == component::WORKER {
                    let mut calls = [0.0; NB];
                    calls.copy_from_slice(&async_calls_of(game, kind)[NR..]);
                    calls
                } else {
                    calls_of(game, node, kind, flags.delegated, flags.offloaded)
                };
                if node.type_code == component::EDGE {
                    // `requestCpuMs`: one request alone, with no offload, sampling, or incident.
                    let alone = ServerFlags { sampling: 0.0, hashing: 1.0, offloaded: false, local: false, ..*flags };
                    let calls = calls_of(game, node, kind, flags.delegated, false);
                    code.cpu[kind] = cpu_base(game, node, kind, &calls, &alone);
                } else if node.type_code != component::FN {
                    code.cpu[kind] = cpu_base(game, node, kind, &code.calls[kind], flags);
                }
            }
            table.row_of[slot] = table.rows.len() as u32;
            table.rows.push(code);
        }
        table
    }

    /// One Node's row.
    #[inline]
    pub fn node(&self, slot: usize) -> &Code {
        self.row_of
            .get(slot)
            .and_then(|&row| self.rows.get(row as usize))
            .unwrap_or(&NO_CODE)
    }
}

/// `callsOf`: the backend calls one request of a kind makes from this Node.
pub fn calls_of(game: &GameCtx, node: &Node, kind: usize, delegated: bool, offloaded: bool) -> Calls {
    let profile = profile_of(game, kind);
    let mut calls = [0.0f64; NB];
    if as_login(game, kind) && delegated {
        calls[backend::AUTH] = 1.0;
        return calls;
    }
    let orm = PROFILE_ORM[profile]
        && FRAMEWORK_ORM[node.framework]
        && !(game.has(research::EAGER_LOADING) && game.fixed(fix::EAGER_LOADING));
    calls.copy_from_slice(&PROFILE_CALLS[profile][NR..]);
    calls[backend::Q_READ] *= if orm { ORM_READS } else { 1.0 };
    // Fan-out on write: a feed reads one timeline, and each write fills its followers'.
    if node.fanout == 1 {
        let hybrid = game.has(research::HYBRID_FANOUT);
        if kind == kind::FEED {
            calls[backend::Q_READ] = if hybrid { HYBRID_READS } else { 1.0 };
        }
        if kind == kind::WRITE && mix_feed(game) > 0.0 {
            calls[backend::K_WRITE] = FOLLOWERS * if hybrid { HYBRID_WRITES } else { 1.0 };
        }
    }
    // A sticky Load Balancer keeps a user on this server, so some reads hit its memory.
    if node.pinned {
        calls[backend::Q_READ] *= 1.0 - STICKY_LOCAL_READ;
    }
    // The async part's calls: a Worker makes them once the kind goes through a Queue.
    if offloaded && PROFILE_OFFLOAD[profile] > 0.0 {
        calls[backend::TASK] = 1.0;
    } else {
        for (call, extra) in calls.iter_mut().zip(&PROFILE_ASYNC_CALLS[profile][NR..]) {
            *call += extra;
        }
    }
    // A prompt on a Node that reaches a Vector Index pays one nearest-neighbour lookup.
    if kind == kind::AI && node.vec_recall.is_some() {
        calls[backend::Q_VECTOR] += 1.0;
    }
    calls
}

/// `asyncCallsOf`: the calls the async part of a kind makes.
pub fn async_calls_of(game: &GameCtx, origin: usize) -> &'static Rates {
    &PROFILE_ASYNC_CALLS[profile_of(game, origin)]
}

/// `mixOf(game).feed`, which only the fan-out branch reads. A board that ships
/// no Feature moving it reads the Era's own share.
#[inline]
fn mix_feed(game: &GameCtx) -> f64 {
    game.mix[kind::FEED]
}

/// `edgeRuns`: the Stack's language runs at the edge, natively or as WebAssembly.
#[inline]
pub fn edge_runs(node: &Node) -> bool {
    EDGE_LANGUAGES.contains(&LANGUAGE_IDS[RUNTIME_LANGUAGE[node.runtime]])
}

/// `edgeFits`: one request of a kind fits the Edge Function's CPU ceiling.
#[inline]
pub fn edge_fits(code: &Code, kind: usize) -> bool {
    kind < NR && code.cpu[kind] <= EDGE_CPU_MS
}

/// The kinds a Component serves by passing the request straight on.
#[inline]
fn passes_on(type_code: usize) -> bool {
    type_code == component::USERS
        || type_code == component::LB
        || type_code == component::POOLER
        || type_code == component::DNS
        || type_code == component::GW
}

/// What a solve holds fixed: the Design, the Game, the Nodes, and the columns
/// the host wrote once. A pass, a tree, and the Ledger all read the same one.
#[derive(Clone, Copy)]
pub struct Board<'a> {
    pub design: &'a Design,
    pub game: &'a GameCtx,
    pub nodes: &'a [Node],
    pub demand: &'a Rates,
    pub intake: &'a [f64],
    /// Each Node's `ServerFlags`, by slot.
    pub flags: &'a [ServerFlags],
    /// `callsOf` and `cpuBase` for every Node that runs code.
    pub code: &'a CodeTable,
}

/// One pass's inputs: the Board, and the feedback the last pass left.
pub struct Run<'a> {
    pub board: Board<'a>,
    pub weights: Weights<'a>,
    /// Milliseconds an App Server holds a slot per call, by backend kind, from the last pass.
    pub call_latency: &'a [[f64; NK]],
    pub inflight: &'a [f64],
    /// Server connections held open on each Node on the last pass.
    pub connections: &'a [f64],
    /// The failure share on each retrying Link, by kind; NaN where none was seen.
    pub failures: &'a [[f64; NK]],
    /// The share of a Worker's attempts that failed on the last pass; NaN where none was seen.
    pub task_failure: &'a [f64],
    /// Tasks per second each Worker could take on the last pass; infinite where unknown.
    pub task_capacity: &'a [f64],
    /// The Node the Bottleneck search boosts, if any.
    pub boost: Option<usize>,
}

impl Run<'_> {
    #[inline]
    fn at(values: &[f64], index: usize) -> f64 {
        values.get(index).copied().unwrap_or(0.0)
    }


    #[inline]
    fn boosted(&self, index: usize) -> f64 {
        if self.boost == Some(index) { 2.0 } else { 1.0 }
    }

    /// `solver.attempts`: the attempts each task takes on a Worker, from the
    /// failure share its last pass saw and its Queue's limit.
    fn attempts(&self, node: &Node, slot: usize) -> f64 {
        if node.queue_attempts == 0.0 {
            return 1.0;
        }
        let failure = self.task_failure.get(slot).copied().filter(|share| !share.is_nan()).unwrap_or(0.0);
        task_attempts(failure.min(0.99), node.queue_attempts)
    }

    /// `solver.drainable(node, 'task')`: tasks per second a Queue's live Workers can take.
    fn drainable(&self, slot: usize, kind: usize) -> f64 {
        let design = self.board.design;
        let mut total = 0.0;
        let mut slowest = f64::INFINITY;
        let mut found = false;
        for &edge in design.out_edges_of(slot) {
            let child = design.edges[edge as usize].to as usize;
            let Some(node) = self.board.nodes.get(child) else { continue };
            if is_down(node) || !crate::routing::accepts(node.type_code, kind) {
                continue;
            }
            // A Worker takes tasks at the rate its last pass could; a buffer takes either kind
            // at its own rate, and a Warehouse takes every change.
            let flat = FLAT_CAPACITY[node.type_code] * flat_scale(node.size);
            let capacity = match node.type_code {
                component::WORKER => self.task_capacity.get(child).copied().unwrap_or(f64::INFINITY),
                component::WAREHOUSE => f64::INFINITY,
                component::QUEUE | component::LOG => flat,
                _ if kind == kind::CHANGE => if flat == 0.0 { 1_000.0 } else { flat },
                _ => 0.0,
            };
            found = true;
            // A Stream broadcasts a change to every consumer, so its slowest one sets the rate.
            // Tasks go to a consumer group, whose Workers share the rate.
            if kind == kind::CHANGE {
                slowest = slowest.min(capacity);
            } else {
                total += capacity;
            }
        }
        if kind == kind::CHANGE {
            return if found { slowest } else { 0.0 };
        }
        total
    }
}

/// `forward`: one pass over the Design.
pub fn forward(run: &Run, splits: &mut Splits) -> Pass {
    let Board { design, game, nodes, demand, intake, flags, code } = run.board;
    let count = design.nodes.len();
    let links = count.max(design.edges.len());
    let mut out = Pass {
        arriving: vec![[0.0; NK]; count],
        order: vec![Order::default(); count],
        models: vec![Model::default(); count],
        links: vec![[0.0; NK]; links],
        link_order: Vec::new(),
        listed: vec![false; links],
        connections: vec![None; count],
        hits: vec![0.0; count],
        stale_hits: vec![0.0; count],
        stranded: vec![None; count],
        repeated: vec![0.0; count],
        tasks: vec![[0.0; NK]; count],
        drained: vec![0.0; count],
        lag_ms: 0.0,
        stale_share: 0.0,
    };

    for &node_index in &design.order {
        let route_node = design.nodes[node_index];
        let type_code = route_node.type_code as usize;
        let slot = node_index;
        if slot >= count {
            continue;
        }
        // A Users Node takes its share of the demand; every other Node takes what
        // its upstream sent it this pass.
        if type_code == component::USERS {
            let share = Run::at(intake, slot);
            for (into, rate) in out.arriving[slot].iter_mut().zip(&demand[..NR]) {
                *into = rate * share;
            }
            out.order[slot] = demand_order(game, demand);
        }
        let rates = out.arriving[slot];
        let order = out.order[slot];
        let node = match nodes.get(slot) {
            Some(node) => node,
            None => continue,
        };
        let boost = run.boosted(slot);
        let ctx = ServerCtx {
            boost,
            inflight: Run::at(run.inflight, slot),
            flags: flags.get(slot).copied().unwrap_or_default(),
        };
        let model = if type_code == component::SERVER {
            let latency = run.call_latency.get(slot).unwrap_or(&[0.0; NK]);
            server_model(game, node, &rates, code.node(slot), latency, &ctx)
        } else if type_code == component::WORKER {
            // Each task costs the async part of the kind it came from, once per attempt.
            // A poison message eats most of its time.
            let tasks = rates[NR + backend::TASK] * run.attempts(node, slot) / if node.poisoned { 1.0 - POISON_SHARE } else { 1.0 };
            let mix = task_mix_of(game, &out.tasks, slot);
            let mut work = [0.0f64; NK];
            for kind in 0..NR {
                work[kind] = tasks * mix[kind];
            }
            let latency = run.call_latency.get(slot).unwrap_or(&[0.0; NK]);
            server_model(game, node, &work, code.node(slot), latency, &ctx)
        } else if type_code == component::DATABASE || type_code == component::REPLICA {
            database_model(game, node, &rates, boost, Run::at(run.connections, slot))
        } else {
            flat_component(game, node, &rates, &order, boost)
        };
        out.models[slot] = model;

        let share = if is_down(node) { 0.0 } else { model.share };
        let mut kept = [0.0f64; NK];
        for kind in 0..NK {
            kept[kind] = rates[kind] * share;
        }

        // The kinds behind the tasks this Node sends on: an App Server enqueues
        // one task per request of a kind that goes async; a Queue passes on its mix.
        let composition = if type_code == component::SERVER {
            // TypeScript's `kept` is the arriving record itself unless the Node sheds, which
            // the port does not: the mix comes from what arrived, before the share.
            let mut offloaded = [0.0f64; NK];
            for kind in 0..NR {
                if PROFILE_OFFLOAD[kind] > 0.0 && rates[kind] > 0.0 {
                    offloaded[kind] = rates[kind];
                }
            }
            shares_of(&offloaded)
        } else if type_code == component::QUEUE || type_code == component::LOG {
            shares_of(&out.tasks[slot])
        } else {
            None
        };

        // Serve: a Node that runs code sends one call per backend kind; a flat
        // Component passes the request straight on.
        if type_code == component::CACHE {
            let (hit, stale, sent, flush) = cache_serve(game, node, &rates);
            out.hits[slot] = hit;
            out.stale_hits[slot] = stale;
            for kind in order.iter() {
                let processed = kept[kind];
                // A change invalidates the Cache's copy. It has no answer to send on.
                if processed <= 0.0 || kind == kind::CHANGE {
                    continue;
                }
                let rate = match kind {
                    kind::Q_READ => processed * sent,
                    // Write-behind answers the write here and flushes only its share on.
                    kind::Q_WRITE if flush < 1.0 => processed * flush,
                    _ => processed,
                };
                out.route(run, splits, slot, kind, rate, composition);
            }
        } else if type_code == component::CDN {
            out.hits[slot] = crate::model::cdn_hit(game, node, kind::PAGE);
            out.stale_hits[slot] = 0.0;
            for kind in order.iter() {
                let processed = kept[kind];
                if processed > 0.0 {
                    out.route(run, splits, slot, kind, processed * (1.0 - crate::model::cdn_hit(game, node, kind)), composition);
                }
            }
        } else if type_code == component::WAF {
            // Bots stop here at the block rate; real users at the false positive rate.
            let waf = Waf::of(node, game);
            for kind in order.iter() {
                let processed = kept[kind];
                if processed > 0.0 {
                    out.route(run, splits, slot, kind, processed * (1.0 - waf.stops(kind)), composition);
                }
            }
        } else if passes_on(type_code) {
            for kind in order.iter() {
                let processed = kept[kind];
                if processed > 0.0 {
                    out.route(run, splits, slot, kind, processed, composition);
                }
            }
        } else if (type_code == component::SERVER || type_code == component::FN) && !node.local_db {
            let table = &code.node(slot).calls;
            for kind in order.iter().filter(|&kind| kind < NR) {
                let (processed, calls) = (kept[kind], &table[kind]);
                if processed <= 0.0 {
                    continue;
                }
                for (backend, &made) in calls.iter().enumerate() {
                    if made != 0.0 {
                        out.route(run, splits, slot, NR + backend, processed * made, composition);
                    }
                }
            }
        } else if type_code == component::EDGE && edge_runs(node) {
            // A handler past the CPU ceiling is killed; the rest make their calls.
            let delegated = flags.get(slot).is_some_and(|flags| flags.delegated);
            for kind in order.iter().filter(|&kind| kind < NR) {
                let processed = kept[kind];
                if processed <= 0.0 || !edge_fits(code.node(slot), kind) {
                    continue;
                }
                let calls = calls_of(game, node, kind, delegated, false);
                for (backend, &made) in calls.iter().enumerate() {
                    if made != 0.0 {
                        out.route(run, splits, slot, NR + backend, processed * made, composition);
                    }
                }
            }
        } else if type_code == component::WORKER {
            // A Worker makes the async part's calls of the kinds its tasks came
            // from, once per attempt: an export's 50 reads.
            let tasks = kept[NR + backend::TASK] * run.attempts(node, slot);
            if tasks > 0.0 {
                let mix = task_mix_of(game, &out.tasks, slot);
                for (origin, &share) in mix[..NR].iter().enumerate() {
                    let each = async_calls_of(game, origin);
                    for backend in 0..NB {
                        out.route(run, splits, slot, NR + backend, tasks * share * each[NR + backend], composition);
                    }
                }
            }
        } else if type_code == component::QUEUE {
            // It offers its Workers what arrived, plus a share of its backlog as far as they have room.
            if share > 0.0 {
                let arrived = kept[NR + backend::TASK];
                let room = (run.drainable(slot, NR + backend::TASK) - arrived).max(0.0);
                out.route(run, splits, slot, NR + backend::TASK, arrived + (node.depth / DRAIN_SECONDS).min(room), composition);
            }
        } else if type_code == component::CDC {
            // It publishes each change it copied as one `change`.
            let changes = [kind::Q_WRITE, kind::Q_TX, kind::K_WRITE].iter().fold(0.0, |total, &kind| total + rates[kind] * share);
            if changes > 0.0 {
                out.route(run, splits, slot, kind::CHANGE, changes, composition);
            }
        } else if type_code == component::LOG && share > 0.0 {
            // It offers its consumers what arrived plus a share of its lag, no faster than
            // one consumer per partition reads.
            let task = rates[NR + backend::TASK] * share;
            let change = rates[kind::CHANGE] * share;
            let arrived = task + change;
            let room = (run.drainable(slot, NR + backend::TASK) + run.drainable(slot, kind::CHANGE) - arrived).max(0.0);
            let read = LOG_READ_RATE * node.partitions.floor().max(1.0);
            let backlog = (node.depth / DRAIN_SECONDS).min(room).min(read);
            let offered = (arrived + backlog).min(read);
            if arrived > 0.0 {
                let ratio = offered / arrived;
                if task > 0.0 {
                    out.route(run, splits, slot, NR + backend::TASK, task * ratio, composition);
                }
                if change > 0.0 {
                    out.route(run, splits, slot, kind::CHANGE, change * ratio, composition);
                }
            } else if backlog > 0.0 {
                // No producer is sending: drain what it holds to the consumers it feeds, split
                // only when both kinds have one.
                let consumers = || design.out_edges_of(slot).iter().map(|&edge| design.edges[edge as usize].to as usize);
                let takes = |kind: usize| consumers().any(|child| crate::routing::accepts(nodes[child].type_code, kind));
                match (takes(NR + backend::TASK), takes(kind::CHANGE)) {
                    (true, true) => {
                        out.route(run, splits, slot, NR + backend::TASK, backlog / 2.0, composition);
                        out.route(run, splits, slot, kind::CHANGE, backlog / 2.0, composition);
                    }
                    (true, false) => out.route(run, splits, slot, NR + backend::TASK, backlog, composition),
                    (false, true) => out.route(run, splits, slot, kind::CHANGE, backlog, composition),
                    (false, false) => {}
                }
            }
        }

        // A CDC Connector takes a copy of the changes this Node wrote and none of its
        // traffic: the writes stay answered here, and the connector publishes them.
        for &edge in design.mirror_edges_of(slot) {
            let edge = edge as usize;
            let to = design.edges[edge].to as usize;
            for kind in [kind::Q_WRITE, kind::Q_TX, kind::K_WRITE] {
                let written = kept[kind];
                if written <= 0.0 {
                    continue;
                }
                out.arriving[to][kind] += written;
                out.order[to].push(kind);
                if !out.listed[edge] {
                    out.listed[edge] = true;
                    out.link_order.push(edge);
                }
                out.links[edge][kind] += written;
            }
        }
    }

    // Every app process holds its own pool to each database it reaches.
    let mut connections_in: Vec<f64> = vec![0.0; count];
    for &node_index in &design.order {
        let slot = node_index;
        if slot >= count {
            continue;
        }
        let node = match nodes.get(slot) {
            Some(node) => node,
            None => continue,
        };
        let type_code = node.type_code;
        let through = type_code == component::LB;
        let held = if through {
            connections_in[slot]
        } else {
            connections_of(run, node, slot, out.models.get(slot), connections_in[slot])
        };
        if held <= 0.0 {
            continue;
        }
        let shares: &[(u32, f64)] = if through {
            splits.get(design, slot, kind::Q_READ, &run.weights)
        } else {
            &[]
        };
        let start = design.out_start(slot);
        let end = design.out_end(slot);
        for &edge in design.out_edges_in(start, end) {
            let edge = edge as usize;
            let child = design.edges.get(edge).map(|edge| edge.to as usize).unwrap_or(slot);
            let child_type = design.nodes.get(child).map(|node| node.type_code as usize).unwrap_or(0);
            if !crate::routing::accepts(child_type, kind::Q_READ)
                && !crate::routing::accepts(child_type, kind::Q_WRITE)
            {
                continue;
            }
            let share = if through {
                shares.iter().find(|(each, _)| *each as usize == edge).map(|(_, share)| *share).unwrap_or(0.0)
            } else {
                1.0
            };
            if let Some(into) = connections_in.get_mut(child) {
                *into += held * share;
            }
        }
    }

    let mut writes = 0.0;
    for (node, &held) in connections_in.iter().enumerate() {
        let kind = nodes.get(node).map(|node| node.type_code).unwrap_or(0);
        if kind != component::DATABASE && kind != component::REPLICA {
            continue;
        }
        let engine = nodes.get(node).map(|node| node.db_engine.min(1)).unwrap_or(0);
        let boost = run.boosted(node);
        out.connections[node] = Some((held, DB_CONNECTIONS[engine] * boost));
        writes += out.arriving.get(node).map(|rates| rates[kind::Q_WRITE]).unwrap_or(0.0) * DB_LAG[engine];
    }

    // What each Queue's Workers take from it.
    for node in 0..count {
        if nodes.get(node).map(|node| node.type_code) != Some(component::QUEUE) {
            continue;
        }
        let mut total = 0.0;
        for &edge in design.out_edges_of(node) {
            let edge = edge as usize;
            let child = design.edges.get(edge).map(|edge| edge.to as usize).unwrap_or(node);
            if nodes.get(child).map(|node| node.type_code) != Some(component::WORKER) {
                continue;
            }
            let share = if nodes.get(child).map(|node| node.down).unwrap_or(false) {
                0.0
            } else {
                out.models.get(child).map(|model| model.share).unwrap_or(1.0)
            };
            total += out.links.get(edge).map(|rates| rates[NR + backend::TASK]).unwrap_or(0.0) * share;
        }
        out.drained[node] = total;
    }

    let surge = game.incident == Some(Incident::ReplLag);
    let lag = REPLICA_LAG_MS + REPLICA_LAG_PER_WRITE * writes;
    out.lag_ms = if surge { lag * LAG_SURGE } else { lag };
    out.stale_share = if surge {
        (lag * LAG_SURGE / 1000.0).min(0.5)
    } else {
        (lag * REPLICA_STALE_REUSE / 1000.0).min(0.15)
    };
    out
}

/// `cacheRule.serve`'s figures: the hit ratio, the stale share of hits, the
/// share of reads sent on, and the share of writes a write-behind Cache flushes
/// (1 for every other strategy).
fn cache_serve(game: &GameCtx, node: &Node, rates: &Rates) -> (f64, f64, f64, f64) {
    let reads = rates[kind::Q_READ];
    let writes = rates[kind::Q_WRITE];
    let write_share = if reads + writes > 0.0 { writes / (reads + writes) } else { 0.0 };
    let strategy = cache::strategy(game, node);
    let guarded = game.has(research::STAMPEDE_PROTECTION);
    let hit = cache::hit_ratio(game, node, write_share, node.warm);
    let ttl = cache::ttl_row(node);
    // Stale-while-revalidate answers the reads an expired key would have missed from the old value.
    let revalidating = if node.swr && guarded { 1.0 - CACHE_TTLS_FACTOR[ttl] } else { 0.0 };
    let surge = if game.incident == Some(Incident::StaleRead) && game.incident_node == node.id { STALE_SURGE } else { 1.0 };
    let stale = (CACHE_TTLS_STALE[ttl] * write_share * CACHE_STRATEGIES_STALE[strategy] * surge + revalidating).min(1.0);
    // Stampede protection: misses only a cold Cache has wait on one fetch per key.
    let warm_hit = cache::hit_ratio(game, node, write_share, 1.0);
    let early = if node.early_expiry && guarded { hit * EARLY_REFRESH } else { 0.0 };
    let missed = if node.coalesce && guarded { 1.0 - warm_hit + (warm_hit - hit) * COALESCED } else { 1.0 - hit };
    let flush = if CACHE_STRATEGIES_WRITE[strategy] == "ahead" { CACHE_STRATEGIES_FLUSH[strategy] } else { 1.0 };
    (hit, stale, missed + early, flush)
}

/// `sharesOf`: a rate record as shares of its own total, or `None` when it is empty.
pub fn shares_of(rates: &Rates) -> Option<Rates> {
    let total: f64 = rates.iter().sum();
    if total <= 0.0 {
        return None;
    }
    let mut shares = [0.0f64; NK];
    for kind in 0..NK {
        shares[kind] = rates[kind] / total;
    }
    Some(shares)
}

/// `taskMixOf` for a Node: its own mix when the pass has one, the Era's otherwise.
pub fn task_mix_of(game: &GameCtx, tasks: &[Rates], slot: usize) -> Rates {
    let own = tasks.get(slot).copied().unwrap_or([0.0; NK]);
    let total: f64 = own.iter().sum();
    let mut shares = [0.0f64; NK];
    if total > 0.0 {
        for kind in 0..NR {
            shares[kind] = own[kind] / total;
        }
        return shares;
    }
    // `taskMixOf`: the Era's mix over the kinds that can go async.
    let mut sum = 0.0;
    for kind in 0..NR {
        if PROFILE_OFFLOAD[kind] > 0.0 && game.mix[kind] > 0.0 {
            shares[kind] = game.mix[kind];
            sum += game.mix[kind];
        }
    }
    if sum <= 0.0 {
        shares[kind::UPLOAD] = 1.0;
        return shares;
    }
    for share in &mut shares[..NR] {
        *share /= sum;
    }
    shares
}

/// `connections`: the server connections a Node holds to each data Node it reaches.
fn connections_of(run: &Run, node: &Node, slot: usize, model: Option<&Model>, inbound: f64) -> f64 {
    let type_code = node.type_code;
    let processes = model.map(|model| model.processes).unwrap_or(0.0);
    let runtime = node.runtime;
    if type_code == component::SERVER {
        if node.local_db {
            return 0.0;
        }
        let surge = if run.board.game.incident == Some(Incident::Connections) { 2.0 } else { 1.0 };
        return processes * RUNTIME_CONNECTIONS[runtime] * surge;
    }
    if type_code == component::WORKER || type_code == component::FN {
        return processes * RUNTIME_CONNECTIONS[runtime];
    }
    if type_code == component::POOLER {
        return if node.mode == 0 { inbound } else { inbound.min(POOLER_CONNECTIONS) };
    }
    if type_code == component::CACHE {
        return inbound;
    }
    let _ = slot;
    0.0
}

impl Pass {
    /// `route`: split `rate` of `kind` over the Links out of `node` and add it on.
    fn route(
        &mut self,
        run: &Run,
        splits: &mut Splits,
        node: usize,
        kind: usize,
        rate: f64,
        composition: Option<Rates>,
    ) {
        if rate <= 0.0 || kind == kind::CALLOUT {
            return;
        }
        let split = splits.range(run.board.design, node, kind, &run.weights);
        if split.is_empty() {
            if let Some(entry) = self.stranded.get_mut(node) {
                let (total, kinds) = entry.unwrap_or((0.0, 0));
                *entry = Some((total + rate, kinds | (1u64 << kind)));
            }
            return;
        }
        for index in split {
            let (edge, weight) = splits.pair(index);
            let edge = edge as usize;
            let policy = match run.board.design.edges.get(edge) {
                Some(edge) => *edge,
                None => continue,
            };
            // Retries resend what failed, and a hedged Link sends its second copy.
            let failure = run.failures.get(edge).map(|shares| shares[kind]).filter(|share| !share.is_nan()).unwrap_or(0.0);
            let amplified = crate::routing::amplification(&policy, failure) * if policy.hedge { 1.0 + HEDGE_LOAD } else { 1.0 };
            let sent = rate * weight * amplified;
            if amplified > 1.0 {
                if let Some(entry) = self.repeated.get_mut(policy.to as usize) {
                    // Left to right, as `repeated + sent - rate * weight` rounds.
                    *entry = *entry + sent - rate * weight;
                }
            }
            if let Some(into) = self.arriving.get_mut(policy.to as usize) {
                into[kind] += sent;
                self.order[policy.to as usize].push(kind);
            }
            if let Some(carried) = self.links.get_mut(edge) {
                if carried[kind] == 0.0 && !self.listed[edge] {
                    self.listed[edge] = true;
                    self.link_order.push(edge);
                }
                carried[kind] += sent;
            }
            // A task carries the mix of the request kinds that enqueued it.
            if kind == NR + backend::TASK {
                if let Some(origins) = composition {
                    if let Some(into) = self.tasks.get_mut(policy.to as usize) {
                        for origin in 0..NR {
                            if origins[origin] > 0.0 {
                                into[origin] += sent * origins[origin];
                            }
                        }
                    }
                }
            }
        }
    }
}

