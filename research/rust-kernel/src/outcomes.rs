//! The Outcome tree: what one request of a kind gets back from each Node.
//!
//! Ported from `solve-outcomes.ts`. Every result is a `Copy` `Outcome`, and the
//! memo is a flat `Vec` indexed by Node slot and kind, so a tree walk allocates
//! nothing after the first pass fills it.

use crate::catalog::*;
use crate::dist::*;
use crate::model::{GameCtx, Model, Node};
use crate::pass::Pass;
use crate::routing::{Design, Scratch};

/// The tallest call tree the memo records, and how many kinds it holds.
pub struct Outcomes {
    memo: Vec<Outcome>,
    attempts: Vec<Outcome>,
    downstream: Vec<Outcome>,
    done: Vec<bool>,
    attempts_done: Vec<bool>,
    downstream_done: Vec<bool>,
    node_count: usize,
}

impl Outcomes {
    pub fn new(node_count: usize, edge_count: usize) -> Outcomes {
        Outcomes {
            memo: vec![Outcome::default(); node_count * NK],
            attempts: vec![Outcome::default(); edge_count * NK],
            downstream: vec![Outcome::default(); node_count * NK],
            done: vec![false; node_count * NK],
            attempts_done: vec![false; edge_count * NK],
            downstream_done: vec![false; node_count * NK],
            node_count,
        }
    }

    #[inline]
    fn slot(&self, node: usize, kind: usize) -> usize {
        node * NK + kind
    }
}

/// What one request of `kind` sent from `node` to its targets gets back.
#[allow(clippy::too_many_arguments)]
pub fn outcome(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    node: usize,
    kind: usize,
) -> Outcome {
    let slot = state.slot(node, kind);
    if state.done[slot] {
        return state.memo[slot];
    }
    let game_node = &nodes[node];
    let result = if game_node.down {
        failed(DOWN)
    } else {
        rule_outcome(design, game, nodes, pass, state, scratch, weights, nominal, sick, node, kind)
    };
    state.memo[slot] = result;
    state.done[slot] = true;
    result
}

/// `ownHop`: this Node's own service time for a kind, with the revenue multiplier.
#[inline]
fn own_hop(pass: &Pass, nodes: &[Node], node: usize, kind: usize, value: f64) -> Hop {
    let model = &pass.models[node];
    let type_code = nodes[node].type_code;
    // A kind the model has no service for falls back to the Component's latency.
    let (fixed, variable) = if kind < NR {
        if model.service_fixed[kind] != 0.0 || model.service_variable[kind] != 0.0 {
            (model.service_fixed[kind], model.service_variable[kind])
        } else {
            (COMPONENT_LATENCY[type_code], 0.0)
        }
    } else {
        (0.0, 0.0)
    };
    Hop {
        share: model.share,
        cause: DROPPED,
        fixed_ms: fixed,
        variable_ms: variable,
        tail_p: model.tail_p,
        tail_ms: model.tail_ms,
        value,
    }
}

/// `attempt`: the callee's outcome cut at the Link's timeout or bulkhead.
#[allow(clippy::too_many_arguments)]
fn attempt(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    edge: usize,
    kind: usize,
) -> Outcome {
    let slot = edge * NK + kind;
    if state.attempts_done[slot] {
        return state.attempts[slot];
    }
    let policy = &design.edges[edge];
    let wait = if policy.bulkhead { policy.timeout.min(BULKHEAD_MS) } else { policy.timeout };
    let answer = timed_out(
        outcome(design, game, nodes, pass, state, scratch, weights, nominal, sick, design.edges[edge].to as usize, kind),
        wait,
    );
    let result = if policy.hedge { hedged(answer) } else { answer };
    state.attempts[slot] = result;
    state.attempts_done[slot] = true;
    result
}

/// `call`: one attempt, plus the Link's retries.
#[allow(clippy::too_many_arguments)]
fn call(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    edge: usize,
    kind: usize,
) -> Outcome {
    let policy = &design.edges[edge];
    if policy.open {
        return failed(REFUSED);
    }
    let once = attempt(design, game, nodes, pass, state, scratch, weights, nominal, sick, edge, kind);
    match policy.retry {
        0 => once,
        1 => retried(once, policy.timeout),
        _ => backed_off(once, policy.timeout, RETRY_BUDGET),
    }
}

/// `placed`: a call that leaves its zone or region pays the hop on top.
#[allow(clippy::too_many_arguments)]
fn placed(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    edge: usize,
    kind: usize,
    extra: f64,
) -> Outcome {
    let answer = call(design, game, nodes, pass, state, scratch, weights, nominal, sick, edge, kind);
    if extra > 0.0 {
        through(hop(extra, 0.0), &[(answer, 1.0)], false)
    } else {
        answer
    }
}

/// `downstream`: what one request of `kind` sent from `node` gets back.
#[allow(clippy::too_many_arguments)]
fn downstream(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    node: usize,
    kind: usize,
    extra_hop: f64,
) -> Outcome {
    if kind == kind_index("callout") {
        return callout_outcome();
    }
    // Cached per Node and kind: a second caller with a different hop recomputes.
    let slot = state.slot(node, kind);
    if extra_hop == 0.0 && state.downstream_done[slot] {
        return state.downstream[slot];
    }
    let count = scratch.split(design, node, kind, weights, nominal, sick, false);
    // The recursion below reuses the same scratch, so the split is copied out first.
    let split: Vec<(u32, f64)> = (0..count).map(|i| scratch.pairs()[i]).collect();
    let mut entries: Vec<(Outcome, f64)> = Vec::with_capacity(count);
    for (edge, weight) in split {
        let edge = edge as usize;
        let extra = place_ms(game, &nodes[design.edges[edge].from as usize], &nodes[design.edges[edge].to as usize]);
        entries.push((placed(design, game, nodes, pass, state, scratch, weights, nominal, sick, edge, kind, extra), weight));
    }
    let mixed = blend(&entries).unwrap_or_else(|| failed(STRANDED));
    let result = if extra_hop > 0.0 {
        through(hop(extra_hop, 0.0), &[(mixed, 1.0)], false)
    } else {
        mixed
    };
    if extra_hop == 0.0 {
        state.downstream[slot] = result;
        state.downstream_done[slot] = true;
    }
    result
}

/// A customer's webhook endpoint: slow, and it fails now and then.
#[inline]
fn callout_outcome() -> Outcome {
    fail_some(
        through(hop(CALLOUT_MS / 2.0, CALLOUT_MS / 2.0), &[], false),
        CALLOUT_FAILURE,
        UPSTREAM,
    )
}

/// `placeMs`: the hop a call pays for leaving its zone or region.
#[inline]
fn place_ms(game: &GameCtx, from: &Node, to: &Node) -> f64 {
    // A call that leaves its zone pays the hop; a regional Node spans every zone.
    let extra = if from.zone != to.zone { CROSS_ZONE_MS } else { 0.0 };
    let _ = (game, from.region, to.region);
    extra
}

/// The `outcome` half of each component rule.
#[allow(clippy::too_many_arguments)]
fn rule_outcome(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    node: usize,
    kind: usize,
) -> Outcome {
    let type_code = design.nodes[node].type_code as usize;
    if type_code == component_index("database") || type_code == component_index("replica") {
        // A Database answers from its own service; a refused pool shows in `share`.
        let pool = pass.connections[node];
        let refused = match pool {
            Some((used, max)) if used > max => 1.0 - max / used,
            _ => 0.0,
        };
        let mut reply = Outcome { success: 1.0 - refused, value: 1.0, ..Outcome::default() };
        reply.fail[REFUSED] = refused;
        return through(own_hop(pass, nodes, node, kind, 1.0), &[(reply, 1.0)], false);
    }
    if type_code == component_index("server") {
        return answer_calls(design, game, nodes, pass, state, scratch, weights, nominal, sick, node, kind);
    }
    // Users, Load Balancers, Poolers and the rest relay: own hop, then what they send on.
    let own = own_hop(pass, nodes, node, kind, 1.0);
    let down = downstream(design, game, nodes, pass, state, scratch, weights, nominal, sick, node, kind, 0.0);
    let relayed = through(own, &[(down, 1.0)], false);
    // A Pooler in a sharing mode breaks code that keeps session state.
    if type_code == component_index("pooler") && nodes[node].pm != 0 {
        return fail_some(relayed, SESSION_STATE_CRASHES, CRASH);
    }
    relayed
}

/// `answerCalls`: an App Server's own hop, the calls it makes, and the bytes back.
#[allow(clippy::too_many_arguments)]
fn answer_calls(
    design: &Design,
    game: &GameCtx,
    nodes: &[Node],
    pass: &Pass,
    state: &mut Outcomes,
    scratch: &mut Scratch,
    weights: &[f64],
    nominal: &[f64],
    sick: &[bool],
    node: usize,
    kind: usize,
) -> Outcome {
    let node_data = &nodes[node];
    if kind >= NR {
        return failed(STRANDED);
    }
    // The Stack that answered sets the revenue: a Framework's multiplier reaches the user.
    let served = own_hop(pass, nodes, node, kind, FRAMEWORK_VALUE[node_data.framework][kind]);
    // The response crosses the user's downlink: bytes over bandwidth.
    let own = Hop {
        fixed_ms: served.fixed_ms + transfer_ms(node_data, kind, false),
        ..served
    };
    // A runtime that holds a worker per open connection cannot keep realtime connections.
    if kind == kind_index("rt") && RUNTIME_CONNECTION_KB[node_data.runtime] < 0.0 {
        return failed(REFUSED);
    }
    let calls = crate::pass::calls_of_public(game, node_data, kind, false, false);
    let hop = hop_ms_of(game);
    let mut entries: Vec<(Outcome, f64)> = Vec::with_capacity(NB);
    for backend in 0..NB {
        let count = calls[NR + backend];
        if backend < 3 || count > 0.0 {
            let down = downstream(design, game, nodes, pass, state, scratch, weights, nominal, sick, node, NR + backend, hop);
            entries.push((down, count));
        }
    }
    let stale_counts = kind == kind_index("read") || kind == kind_index("buy") || kind == kind_index("search");
    let mut relayed = through(own, &entries, stale_counts);
    // A call to a Queue returns once the task is enqueued: what happens after is async.
    let _ = hop;
    relayed.fail[CRASH] += 0.0;
    relayed
}

/// `hopMs`: one internal call's wire time, plus a handshake without keep-alive.
#[inline]
fn hop_ms_of(game: &GameCtx) -> f64 {
    HOP_MS + if game.has("keepalive") { 0.0 } else { HANDSHAKE_MS }
}

/// `transferMs`: milliseconds the response takes to reach the user.
#[inline]
fn transfer_ms(node: &Node, kind: usize, offloaded: bool) -> f64 {
    let payload = crate::model::payload_of(node, kind, offloaded);
    let streamed = if PROFILE_STREAM[kind] { payload.min(STREAM_KB) } else { payload };
    (streamed * 8.0) / USER_MBPS + (PROFILE_IN_KB[kind] * 8.0) / USER_UP_MBPS
}

/// `FRAMEWORKS[framework].value[kind]`, which only an App Server multiplies.
#[inline]
fn framework_value(node: &Node, kind: usize) -> f64 {
    if kind < NR {
        crate::catalog::FRAMEWORK_VALUE[node.framework][kind]
    } else {
        1.0
    }
}
