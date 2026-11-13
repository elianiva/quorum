//! One forward pass: each Node's model, what it serves, and where it sends it.
//!
//! Ported from `solve-pass.ts` (`forward`, `callsOf`, `splitOf`, `route`) and the
//! `serve` half of each component rule. A kind's rates live in a fixed `[f64; NK]`,
//! so a pass allocates nothing per Node once `Scratch` has warmed up.

use crate::catalog::*;
use crate::model::{flat_model, database_model, server_model, flat_scale, Model, Node, Rates, ServerCtx, GameCtx};
use crate::routing::{Design, Scratch};

/// What one pass produced.
pub struct Pass {
    pub arriving: Vec<Rates>,
    pub models: Vec<Model>,
    pub links: Vec<Rates>,
    pub link_order: Vec<usize>,
    pub connections: Vec<Option<(f64, f64)>>,
}

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

/// `callsOf`, for the outcome tree.
#[inline]
pub fn calls_of_public(game: &GameCtx, node: &Node, kind: usize, delegated: bool, offloaded: bool) -> Rates {
    calls_of(game, node, kind, delegated, offloaded)
}

/// `callsOf`: the backend calls one request of a kind makes from this Node.
fn calls_of(game: &GameCtx, node: &Node, kind: usize, delegated: bool, offloaded: bool) -> Rates {
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

/// `mixOf(game).feed`, which only the fan-out branch reads. The benchmark board
/// ships no Feature that moves it, so the Era's own share is the answer.
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

/// `forward`: one pass over the Design.
pub fn forward(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    demand: &Rates,
    intake: &[f64],
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    call_latency: &[[f64; NK]; NR],
    inflight: &[f64],
    connections: &[f64],
    users_in_group: &[f64],
    scratch: &mut Scratch,
) -> Pass {
    let count = design.nodes.len();
    let mut arriving: Vec<Rates> = vec![[0.0; NK]; count];
    let mut models: Vec<Model> = vec![Model::default(); count];
    let mut links: Vec<Rates> = vec![[0.0; NK]; count.max(design.edges.len())];
    let mut link_order: Vec<usize> = Vec::new();
    let mut pools: Vec<Option<(f64, f64)>> = vec![None; count];

    for &node_index in &design.order {
        let route_node = design.nodes[node_index];
        let type_code = route_node.type_code as usize;
        let slot = node_index;
        // A Users Node takes its share of the demand; every other Node takes what
        // its upstream sent it this pass.
        if type_code == component_index("users") {
            let share = intake[slot];
            for kind in 0..NR {
                arriving[slot][kind] = demand[kind] * share;
            }
        }
        let rates = arriving[slot];

        let node = &nodes[slot];
        let ctx = ServerCtx {
            boost: 1.0,
            inflight: inflight[slot],
            sampling: 0.0,
            hashing: if game.incident == "loop" { 4.0 } else { 1.0 },
            delegated: false,
            local: node.local_db,
            offloaded: false,
            worker: false,
            pod: false,
            mesh: false,
        };
        let model = if type_code == component_index("server") {
            let mut calls = [[0.0f64; NK]; NR];
            for kind in 0..NR {
                calls[kind] = calls_of(game, node, kind, false, false);
            }
            server_model(game, node, &rates, &calls, call_latency, &ctx)
        } else if type_code == component_index("database") {
            // A Database's working set holds its Data Group's rows, which is per Node.
            let mut scoped = game.clone();
            scoped.users_in_group = users_in_group[slot];
            database_model(&scoped, node, &rates, 1.0, connections[slot])
        } else {
            let (capacity, fixed, variable) = flat_params(type_code, node);
            flat_model(capacity, &rates, fixed, variable, 1.0)
        };
        models[slot] = model;

        let share = if is_down(node) { 0.0 } else { model.share };
        // What the Node processed, by kind.
        let mut kept = [0.0f64; NK];
        for kind in 0..NK {
            kept[kind] = rates[kind] * share;
        }

        // Serve: a Node that runs code sends one call per backend kind; a flat
        // Component passes the request straight on.
        if passes_on(type_code) {
            for kind in 0..NK {
                let processed = kept[kind];
                if processed > 0.0 {
                    route(design, scratch, &mut arriving, &mut links, &mut link_order, node_index, kind, processed, weights, nominal, sick, game);
                }
            }
        } else if type_code == component_index("server") {
            for kind in 0..NR {
                let processed = kept[kind];
                if processed <= 0.0 {
                    continue;
                }
                let calls = calls_of(game, node, kind, false, false);
                for backend in 0..NB {
                    let made = calls[NR + backend];
                    if made != 0.0 {
                        route(design, scratch, &mut arriving, &mut links, &mut link_order, node_index, NR + backend, processed * made, weights, nominal, sick, game);
                    }
                }
            }
        }
    }

    Pass { arriving, models, links, link_order, connections: pools }
}

/// The capacity and service a flat Component answers with.
#[inline]
fn flat_params(type_code: usize, node: &Node) -> (f64, f64, f64) {
    let capacity = FLAT_CAPACITY[type_code] * flat_scale(node.size);
    if type_code == component_index("users") {
        (f64::INFINITY, 30.0, 0.0)
    } else if type_code == component_index("lb") {
        (
            capacity
                * if node.variant == 1 { L4_CAPACITY } else { 1.0 }
                * if node.policy == 3 && false { P2C_CAPACITY } else { 1.0 },
            if node.variant == 1 { 0.2 } else { 1.0 },
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
    design: &Design,
    scratch: &mut Scratch,
    arriving: &mut [Rates],
    links: &mut [Rates],
    link_order: &mut Vec<usize>,
    node: usize,
    kind: usize,
    rate: f64,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    _game: &GameCtx,
) {
    if rate <= 0.0 {
        return;
    }
    let count = scratch.split(design, node, kind, weights, nominal, sick, false);
    if count == 0 {
        return;
    }
    // The split's pairs are borrowed while `arriving` is written, so copy them out
    // of the scratch one at a time.
    for index in 0..count {
        let (edge, weight) = scratch.pairs()[index];
        let edge = edge as usize;
        let sent = rate * weight;
        let target = design.edges[edge].to as usize;
        arriving[target][kind] += sent;
        if links[edge][kind] == 0.0 && !link_order.contains(&edge) {
            link_order.push(edge);
        }
        links[edge][kind] += sent;
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
