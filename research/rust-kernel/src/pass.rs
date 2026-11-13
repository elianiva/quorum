//! One forward pass: each Node's model, what it serves, and where it sends it.
//!
//! Ported from `solve-pass.ts` (`forward`, `callsOf`, `splitOf`, `route`) and the
//! `serve` and `connections` halves of each component rule. A kind's rates live
//! in a fixed `[f64; NK]`, so a pass allocates nothing per Node once `Scratch`
//! has warmed up.

use crate::catalog::*;
use crate::extra::*;
use crate::model::{database_model, flat_model, flat_scale, server_model, GameCtx, Model, Node, Rates, ServerCtx};
use crate::routing::{Design, Scratch};

/// What one pass produced. The fields after `connections` are what the Ledger
/// reads, and what the pass loop feeds back into the next pass.
pub struct Pass {
    pub arriving: Vec<Rates>,
    pub models: Vec<Model>,
    pub links: Vec<Rates>,
    pub link_order: Vec<usize>,
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

#[inline]
pub fn is_down(node: &Node) -> bool {
    node.down
}

/// `asLogin`: this kind costs an App Server a password hash.
#[inline]
fn as_login(game: &GameCtx, kind: usize) -> bool {
    kind == kind_index("login") || (kind == kind_index("bot") && game.incident == "stuffing")
}

/// `profileOf`: the kind's profile, or a login when a stuffing incident is on.
#[inline]
fn profile_of(game: &GameCtx, kind: usize) -> usize {
    if kind == kind_index("bot") && game.incident == "stuffing" {
        kind_index("login")
    } else {
        kind
    }
}

/// `callsOf`: the backend calls one request of a kind makes from this Node.
pub fn calls_of(game: &GameCtx, node: &Node, kind: usize, delegated: bool, offloaded: bool) -> Rates {
    let profile = profile_of(game, kind);
    let mut calls = [0.0f64; NK];
    if as_login(game, kind) && delegated {
        calls[NR + backend_index("auth")] = 1.0;
        return calls;
    }
    let orm = PROFILE_ORM[profile]
        && FRAMEWORK_ORM[node.framework]
        && !(game.has("eager-loading") && game.fixed("eager-loading"));
    for slot in 0..NK {
        calls[slot] = PROFILE_CALLS[profile][slot];
    }
    let read = calls[NR + backend_index("q-read")];
    calls[NR + backend_index("q-read")] = read * if orm { ORM_READS } else { 1.0 };
    // Fan-out on write: a feed reads one timeline, and each write fills its followers'.
    if node.fanout == 1 {
        let hybrid = game.has("hybrid-fanout");
        if kind == kind_index("feed") {
            calls[NR + backend_index("q-read")] = if hybrid { HYBRID_READS } else { 1.0 };
        }
        if kind == kind_index("write") && mix_feed(game) > 0.0 {
            calls[NR + backend_index("k-write")] = FOLLOWERS * if hybrid { HYBRID_WRITES } else { 1.0 };
        }
    }
    // A sticky Load Balancer keeps a user on this server, so some reads hit its memory.
    if node.sticky {
        let read = calls[NR + backend_index("q-read")];
        calls[NR + backend_index("q-read")] = read * (1.0 - STICKY_LOCAL_READ);
    }
    // The async part's calls: a Worker makes them once the kind goes through a Queue.
    if offloaded && PROFILE_OFFLOAD[profile] > 0.0 {
        calls[NR + backend_index("task")] = 1.0;
    } else {
        for slot in 0..NK {
            calls[slot] += PROFILE_ASYNC_CALLS[profile][slot];
        }
    }
    calls
}

/// `asyncCallsOf`: the calls the async part of a kind makes.
pub fn async_calls_of(game: &GameCtx, origin: usize) -> Rates {
    let mut calls = [0.0f64; NK];
    let profile = profile_of(game, origin);
    for slot in 0..NK {
        calls[slot] = PROFILE_ASYNC_CALLS[profile][slot];
    }
    calls
}

/// `mixOf(game).feed`, which only the fan-out branch reads. A board that ships
/// no Feature moving it reads the Era's own share.
#[inline]
fn mix_feed(_game: &GameCtx) -> f64 {
    0.0
}

/// The kinds a Component serves by passing the request straight on.
#[inline]
fn passes_on(type_code: usize) -> bool {
    type_code == component_index("users")
        || type_code == component_index("lb")
        || type_code == component_index("pooler")
        || type_code == component_index("dns")
        || type_code == component_index("cdn")
        || type_code == component_index("waf")
        || type_code == component_index("gw")
}

/// Everything a pass reads. One struct rather than fifteen arguments.
pub struct Run<'a> {
    pub design: &'a Design,
    pub game: &'a GameCtx,
    pub nodes: &'a [Node],
    pub demand: &'a Rates,
    pub intake: &'a [f64],
    pub weights: &'a [f64],
    pub nominal: &'a [f64],
    pub sick: &'a [bool],
    /// Milliseconds an App Server holds a slot per call, by backend kind, from the last pass.
    pub call_latency: &'a [[f64; NK]],
    pub inflight: &'a [f64],
    /// Server connections held open on each Node on the last pass.
    pub connections: &'a [f64],
    pub users_in_group: &'a [f64],
    /// CPU overhead from Analytics sampling each Node.
    pub sampling: &'a [f64],
    /// An Auth Provider takes this Node's logins.
    pub delegated: &'a [bool],
    /// This Node can hand async work to a Queue.
    pub offloads: &'a [bool],
    /// This Node runs as pods.
    pub pod: &'a [bool],
    /// A Service Mesh has put a sidecar beside this Node.
    pub mesh: &'a [bool],
    /// The Node the Bottleneck search boosts, if any.
    pub boost: Option<usize>,
}

impl Run<'_> {
    #[inline]
    fn at(values: &[f64], index: usize) -> f64 {
        values.get(index).copied().unwrap_or(0.0)
    }

    #[inline]
    fn flag(values: &[bool], index: usize) -> bool {
        values.get(index).copied().unwrap_or(false)
    }

    #[inline]
    fn boosted(&self, index: usize) -> f64 {
        if self.boost == Some(index) { 2.0 } else { 1.0 }
    }
}

/// `forward`: one pass over the Design.
pub fn forward(run: &Run, scratch: &mut Scratch) -> Pass {
    let design = run.design;
    let game = run.game;
    let nodes = run.nodes;
    let count = design.nodes.len();
    let mut arriving: Vec<Rates> = vec![[0.0; NK]; count];
    let mut models: Vec<Model> = vec![Model::default(); count];
    let mut links: Vec<Rates> = vec![[0.0; NK]; count.max(design.edges.len())];
    let mut link_order: Vec<usize> = Vec::new();
    let hits: Vec<f64> = vec![0.0; count];
    let stale_hits: Vec<f64> = vec![0.0; count];
    let mut stranded: Vec<Option<(f64, u64)>> = vec![None; count];
    let mut repeated: Vec<f64> = vec![0.0; count];
    let mut tasks: Vec<Rates> = vec![[0.0; NK]; count];
    let mut drained: Vec<f64> = vec![0.0; count];

    for &node_index in &design.order {
        let route_node = design.nodes[node_index];
        let type_code = route_node.type_code as usize;
        let slot = node_index;
        if slot >= count {
            continue;
        }
        // A Users Node takes its share of the demand; every other Node takes what
        // its upstream sent it this pass.
        if type_code == component_index("users") {
            let share = Run::at(run.intake, slot);
            for kind in 0..NR {
                arriving[slot][kind] = run.demand[kind] * share;
            }
        }
        let rates = arriving[slot];
        let node = match nodes.get(slot) {
            Some(node) => node,
            None => continue,
        };
        let boost = run.boosted(slot);
        let ctx = ServerCtx {
            boost,
            inflight: Run::at(run.inflight, slot),
            sampling: Run::at(run.sampling, slot),
            hashing: if game.incident == "loop" { 4.0 } else { 1.0 },
            delegated: Run::flag(run.delegated, slot),
            local: node.local_db,
            offloaded: Run::flag(run.offloads, slot),
            worker: type_code == component_index("worker"),
            pod: Run::flag(run.pod, slot),
            mesh: Run::flag(run.mesh, slot),
        };
        let model = if type_code == component_index("server") {
            let mut calls = [[0.0f64; NK]; NR];
            for kind in 0..NR {
                calls[kind] = calls_of(game, node, kind, ctx.delegated, ctx.offloaded);
            }
            let latency = run.call_latency.get(slot).copied().unwrap_or([0.0; NK]);
            server_model(game, node, &rates, &calls, &latency, &ctx)
        } else if type_code == component_index("database") || type_code == component_index("replica") {
            let mut scoped = game.clone();
            scoped.users_in_group = Run::at(run.users_in_group, slot);
            database_model(&scoped, node, &rates, boost, Run::at(run.connections, slot))
        } else {
            let (capacity, fixed, variable) = flat_params(type_code, node, game);
            flat_model(capacity, &rates, fixed, variable, boost)
        };
        models[slot] = model;

        let share = if is_down(node) { 0.0 } else { model.share };
        let mut kept = [0.0f64; NK];
        for kind in 0..NK {
            kept[kind] = rates[kind] * share;
        }

        // The kinds behind the tasks this Node sends on: an App Server enqueues
        // one task per request of a kind that goes async; a Queue passes on its mix.
        let composition = if type_code == component_index("server") {
            let mut offloaded = [0.0f64; NK];
            for kind in 0..NR {
                if PROFILE_OFFLOAD[kind] > 0.0 && kept[kind] > 0.0 {
                    offloaded[kind] = kept[kind];
                }
            }
            shares_of(&offloaded)
        } else if type_code == component_index("queue") || type_code == component_index("log") {
            shares_of(&tasks[slot])
        } else {
            None
        };

        // Serve: a Node that runs code sends one call per backend kind; a flat
        // Component passes the request straight on.
        if passes_on(type_code) {
            for kind in 0..NK {
                let processed = kept[kind];
                if processed > 0.0 {
                    route(
                        run, scratch, &mut arriving, &mut links, &mut link_order, &mut repeated,
                        &mut tasks, &mut stranded, slot, kind, processed, composition,
                    );
                }
            }
        } else if type_code == component_index("server") || type_code == component_index("fn") {
            let delegated = Run::flag(run.delegated, slot);
            let offloaded = Run::flag(run.offloads, slot);
            for kind in 0..NR {
                let processed = kept[kind];
                if processed <= 0.0 {
                    continue;
                }
                let calls = calls_of(game, node, kind, delegated, offloaded);
                for backend in 0..NB {
                    let made = calls[NR + backend];
                    if made != 0.0 {
                        route(
                            run, scratch, &mut arriving, &mut links, &mut link_order, &mut repeated,
                            &mut tasks, &mut stranded, slot, NR + backend, processed * made, composition,
                        );
                    }
                }
            }
        } else if type_code == component_index("worker") {
            // A Worker makes the calls of the kinds its tasks came from.
            let mix = task_mix_of(game, &tasks, slot);
            let mut calls = [0.0f64; NK];
            for origin in 0..NR {
                let share = mix[origin];
                if share <= 0.0 {
                    continue;
                }
                let each = async_calls_of(game, origin);
                for backend in 0..NB {
                    calls[NR + backend] += share * each[NR + backend];
                }
            }
            let processed = kept[NR + backend_index("task")];
            if processed > 0.0 {
                for backend in 0..NB {
                    let made = calls[NR + backend];
                    if made > 0.0 {
                        route(
                            run, scratch, &mut arriving, &mut links, &mut link_order, &mut repeated,
                            &mut tasks, &mut stranded, slot, NR + backend, processed * made, composition,
                        );
                    }
                }
            }
        } else if type_code == component_index("queue") || type_code == component_index("log") {
            // A Queue or Log passes every task on, and keeps the mix of its origins.
            for kind in 0..NK {
                let processed = kept[kind];
                if processed > 0.0 {
                    route(
                        run, scratch, &mut arriving, &mut links, &mut link_order, &mut repeated,
                        &mut tasks, &mut stranded, slot, kind, processed, composition,
                    );
                }
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
        let through = type_code == component_index("lb");
        let out = if through {
            connections_in[slot]
        } else {
            connections_of(run, node, slot, models.get(slot), connections_in[slot])
        };
        if out <= 0.0 {
            continue;
        }
        let mut shares: Vec<(u32, f64)> = Vec::new();
        if through {
            let found = scratch.split(design, slot, kind_index("q-read"), run.weights, run.nominal, run.sick, false);
            shares.extend_from_slice(&scratch.pairs()[..found]);
        }
        let start = design.out_start(slot);
        let end = design.out_end(slot);
        for &edge in design.out_edges_in(start, end) {
            let edge = edge as usize;
            let child = design.edges.get(edge).map(|edge| edge.to as usize).unwrap_or(slot);
            let child_type = design.nodes.get(child).map(|node| node.type_code as usize).unwrap_or(0);
            if !crate::routing::accepts(child_type, kind_index("q-read"))
                && !crate::routing::accepts(child_type, kind_index("q-write"))
            {
                continue;
            }
            let share = if through {
                shares.iter().find(|(each, _)| *each as usize == edge).map(|(_, share)| *share).unwrap_or(0.0)
            } else {
                1.0
            };
            if let Some(into) = connections_in.get_mut(child) {
                *into += out * share;
            }
        }
    }
    let mut pools: Vec<Option<(f64, f64)>> = vec![None; count];
    let mut writes = 0.0;
    for node in 0..count {
        let kind = nodes.get(node).map(|node| node.type_code).unwrap_or(0);
        if kind != component_index("database") && kind != component_index("replica") {
            continue;
        }
        let engine = nodes.get(node).map(|node| node.db_engine.min(1)).unwrap_or(0);
        let boost = run.boosted(node);
        pools[node] = Some((connections_in[node], DB_CONNECTIONS[engine] * boost));
        writes += arriving.get(node).map(|rates| rates[kind_index("q-write")]).unwrap_or(0.0) * DB_LAG[engine];
    }

    // What each Queue's Workers take from it.
    for node in 0..count {
        if nodes.get(node).map(|node| node.type_code) != Some(component_index("queue")) {
            continue;
        }
        let mut total = 0.0;
        for &edge in design.out_edges_of(node) {
            let edge = edge as usize;
            let child = design.edges.get(edge).map(|edge| edge.to as usize).unwrap_or(node);
            if nodes.get(child).map(|node| node.type_code) != Some(component_index("worker")) {
                continue;
            }
            let share = if nodes.get(child).map(|node| node.down).unwrap_or(false) {
                0.0
            } else {
                models.get(child).map(|model| model.share).unwrap_or(1.0)
            };
            total += links.get(edge).map(|rates| rates[NR + backend_index("task")]).unwrap_or(0.0) * share;
        }
        drained[node] = total;
    }

    let surge = game.incident == "repl-lag";
    let lag = REPLICA_LAG_MS + REPLICA_LAG_PER_WRITE * writes;
    Pass {
        arriving,
        models,
        links,
        link_order,
        connections: pools,
        hits,
        stale_hits,
        stranded,
        repeated,
        tasks,
        drained,
        lag_ms: if surge { lag * LAG_SURGE } else { lag },
        stale_share: if surge {
            (lag * LAG_SURGE / 1000.0).min(0.5)
        } else {
            (lag * REPLICA_STALE_REUSE / 1000.0).min(0.15)
        },
    }
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
    if total > 0.0 {
        let mut shares = [0.0f64; NK];
        for kind in 0..NR {
            shares[kind] = own[kind] / total;
        }
        return shares;
    }
    let mut shares = [0.0f64; NK];
    let mut sum = 0.0;
    for kind in 0..NR {
        if PROFILE_OFFLOAD[kind] > 0.0 {
            shares[kind] = PROFILE_OFFLOAD[kind];
            sum += shares[kind];
        }
    }
    if sum <= 0.0 {
        shares[kind_index("upload")] = 1.0;
        return shares;
    }
    for kind in 0..NR {
        shares[kind] /= sum;
    }
    let _ = game;
    shares
}

/// `connections`: the server connections a Node holds to each data Node it reaches.
fn connections_of(run: &Run, node: &Node, slot: usize, model: Option<&Model>, inbound: f64) -> f64 {
    let type_code = node.type_code;
    let processes = model.map(|model| model.processes).unwrap_or(0.0);
    let runtime = node.runtime;
    if type_code == component_index("server") {
        if node.local_db {
            return 0.0;
        }
        let surge = if run.game.incident == "connections" { 2.0 } else { 1.0 };
        return processes * RUNTIME_CONNECTIONS[runtime] * surge;
    }
    if type_code == component_index("worker") || type_code == component_index("fn") {
        return processes * RUNTIME_CONNECTIONS[runtime];
    }
    if type_code == component_index("pooler") {
        return if node.mode == 0 { inbound } else { inbound.min(POOLER_CONNECTIONS) };
    }
    if type_code == component_index("cache") {
        return inbound;
    }
    let _ = slot;
    0.0
}

/// The capacity and service a flat Component answers with.
#[inline]
fn flat_params(type_code: usize, node: &Node, game: &GameCtx) -> (f64, f64, f64) {
    let capacity = FLAT_CAPACITY[type_code] * flat_scale(node.size);
    if type_code == component_index("users") {
        (f64::INFINITY, 30.0, 0.0)
    } else if type_code == component_index("lb") {
        (
            capacity
                * if node.variant == 1 { L4_CAPACITY } else { 1.0 }
                * if node.policy == 3 && game.has("lb-algorithms") { P2C_CAPACITY } else { 1.0 },
            if node.variant == 1 { L4_MS } else { 1.0 },
            0.1,
        )
    } else if type_code == component_index("pooler") {
        (capacity, 0.3, 0.0)
    } else {
        (capacity, 1.0, 0.1)
    }
}

/// `route`: split `rate` of `kind` over the Links out of `node` and add it on.
#[allow(clippy::too_many_arguments)]
fn route(
    run: &Run,
    scratch: &mut Scratch,
    arriving: &mut [Rates],
    links: &mut [Rates],
    link_order: &mut Vec<usize>,
    repeated: &mut [f64],
    tasks: &mut [Rates],
    stranded: &mut [Option<(f64, u64)>],
    node: usize,
    kind: usize,
    rate: f64,
    composition: Option<Rates>,
) {
    if rate <= 0.0 || kind == kind_index("callout") {
        return;
    }
    let count = scratch.split(run.design, node, kind, run.weights, run.nominal, run.sick, false);
    if count == 0 {
        if let Some(entry) = stranded.get_mut(node) {
            let (total, kinds) = entry.unwrap_or((0.0, 0));
            *entry = Some((total + rate, kinds | (1u64 << kind)));
        }
        return;
    }
    for index in 0..count {
        let (edge, weight) = scratch.pairs()[index];
        let edge = edge as usize;
        let policy = match run.design.edges.get(edge) {
            Some(edge) => *edge,
            None => continue,
        };
        // Retries resend what failed, and a hedged Link sends its second copy.
        let amplified = crate::routing::amplification(&policy, 0.0) * if policy.hedge { 1.0 + HEDGE_LOAD } else { 1.0 };
        let sent = rate * weight * amplified;
        if amplified > 1.0 {
            if let Some(entry) = repeated.get_mut(policy.to as usize) {
                *entry += sent - rate * weight;
            }
        }
        if let Some(into) = arriving.get_mut(policy.to as usize) {
            into[kind] += sent;
        }
        if let Some(carried) = links.get_mut(edge) {
            if carried[kind] == 0.0 && !link_order.contains(&edge) {
                link_order.push(edge);
            }
            carried[kind] += sent;
        }
        // A task carries the mix of the request kinds that enqueued it.
        if kind == NR + backend_index("task") {
            if let Some(origins) = composition {
                if let Some(into) = tasks.get_mut(policy.to as usize) {
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

#[inline]
fn backend_index(name: &str) -> usize {
    match name {
        "q-read" => 0,
        "q-write" => 1,
        "auth" => 2,
        "q-search" => 3,
        "q-vector" => 4,
        "blob-put" => 5,
        "task" => 6,
        "blob-get" => 7,
        "q-tx" => 8,
        "charge" => 9,
        "q-scan" => 10,
        "infer" => 11,
        "notify" => 12,
        "callout" => 13,
        "k-write" => 14,
        _ => 15,
    }
}
