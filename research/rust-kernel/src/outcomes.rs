//! The Outcome tree: what one request of a kind gets back from each Node.
//!
//! Ported from `solve-outcomes.ts`. Every result is a `Copy` `Outcome`, and each
//! memo is a flat `Vec` indexed by Node slot and kind, so a tree walk allocates
//! nothing after the first pass fills it. The whole walk lives on one `Tree`
//! struct: the Design, the Game, the pass, and the memo tables, so no rule takes
//! ten arguments.

use crate::catalog::*;
use crate::dist::*;
use crate::model::{GameCtx, Model, Node};
use crate::pass::Pass;
use crate::routing::{amplification, Design, Scratch};

/// The memo tables, allocated once per Design and reused: a solve builds one tree
/// per pass and three more per Bottleneck candidate, so clearing a flag beats
/// zeroing five megabytes.
#[derive(Default)]
pub struct Memo {
    memo: Vec<Outcome>,
    memo_done: Vec<u8>,
    attempts: Vec<Outcome>,
    attempts_done: Vec<u8>,
    downstream: Vec<Outcome>,
    downstream_done: Vec<u8>,
}

impl Memo {
    /// Marks every slot empty without touching the Outcomes.
    fn reset(&mut self, nodes: usize, edges: usize) {
        let memo = nodes * NK;
        let downstream = memo * 2;
        let attempts = edges * NK;
        if self.memo.len() < memo {
            self.memo.resize(memo, Outcome::default());
            self.memo_done.resize(memo, 0);
        }
        if self.downstream.len() < downstream {
            self.downstream.resize(downstream, Outcome::default());
            self.downstream_done.resize(downstream, 0);
        }
        if self.attempts.len() < attempts {
            self.attempts.resize(attempts, Outcome::default());
            self.attempts_done.resize(attempts, 0);
        }
        self.memo_done.fill(0);
        self.downstream_done.fill(0);
        self.attempts_done.fill(0);
    }
}

/// The memo tables: one entry per Node and kind, or per Edge and kind.
pub struct Tree<'a> {
    design: &'a Design,
    game: &'a GameCtx,
    nodes: &'a [Node],
    pass: &'a Pass,
    weights: &'a [f64],
    nominal: &'a [f64],
    sick: &'a [bool],
    sampling_ms: &'a [f64],
    delegated: &'a [bool],
    offloads: &'a [bool],
    scratch: &'a mut Scratch,
    memo: &'a mut Memo,
}

impl Tree<'_> {
    #[inline]
    fn slot(&self, node: usize, kind: usize) -> usize {
        node * NK + kind
    }

    #[inline]
    fn edge_slot(&self, edge: usize, kind: usize) -> usize {
        edge * NK + kind
    }
}

/// Builds the tree's memo tables for a Design of `nodes` Nodes and `edges` Links.
pub fn tree<'a>(
    design: &'a Design,
    game: &'a GameCtx,
    nodes: &'a [Node],
    pass: &'a Pass,
    weights: &'a [f64],
    nominal: &'a [f64],
    sick: &'a [bool],
    sampling_ms: &'a [f64],
    delegated: &'a [bool],
    offloads: &'a [bool],
    scratch: &'a mut Scratch,
    memo: &'a mut Memo,
) -> Tree<'a> {
    memo.reset(design.nodes.len(), design.edges.len());
    Tree {
        design,
        game,
        nodes,
        pass,
        weights,
        nominal,
        sick,
        sampling_ms,
        delegated,
        offloads,
        scratch,
        memo,
    }
}

impl<'a> Tree<'a> {
    /// The Game this walk reads, for a caller that has only the tree.
    #[inline]
    pub fn game(&self) -> &'a GameCtx {
        self.game
    }

    /// `ownHop`: this Node's own service time for a kind, with the revenue multiplier.
    #[inline]
    pub fn own_hop(&self, node: usize, kind: usize, value: f64) -> Hop {
        let model: &Model = match self.pass.models.get(node) {
            Some(model) => model,
            None => return Hop { value, ..Hop::default() },
        };
        let type_code = self.nodes.get(node).map(|node| node.type_code).unwrap_or(0);
        // A kind the model has no service record for falls back to the Component's latency.
        let (fixed, variable) = if kind < NK && (model.service_mask >> kind) & 1 == 1 {
            (model.service_fixed[kind], model.service_variable[kind])
        } else {
            (COMPONENT_LATENCY[type_code], 0.0)
        };
        let sampling = self.sampling_ms.get(node).copied().unwrap_or(0.0);
        Hop {
            share: model.share,
            fixed_ms: fixed + sampling,
            variable_ms: variable,
            tail_p: model.tail_p,
            tail_ms: model.tail_ms,
            value,
            ..Hop::default()
        }
    }

    /// `attempt`: the callee's outcome cut at the Link's timeout or bulkhead.
    fn attempt(&mut self, edge: usize, kind: usize) -> Outcome {
        let slot = self.edge_slot(edge, kind);
        if self.memo.attempts_done.get(slot).copied().unwrap_or(1) == 1 {
            return self.memo.attempts[slot];
        }
        let Some(policy) = self.design.edges.get(edge).copied() else {
            return failed(STRANDED);
        };
        let wait = if policy.bulkhead { policy.timeout.min(BULKHEAD_MS) } else { policy.timeout };
        let answer = timed_out(self.outcome(policy.to as usize, kind), wait);
        let result = if policy.hedge { hedged(answer) } else { answer };
        self.memo.attempts[slot] = result;
        self.memo.attempts_done[slot] = 1;
        result
    }

    /// `call`: one attempt, plus the Link's retries.
    fn call(&mut self, edge: usize, kind: usize) -> Outcome {
        let policy = match self.design.edges.get(edge) {
            Some(policy) => *policy,
            None => return failed(STRANDED),
        };
        if policy.open {
            return failed(REFUSED);
        }
        let once = self.attempt(edge, kind);
        let again = match policy.retry {
            0 => return once,
            1 => retried(once, policy.timeout),
            _ => backed_off(once, policy.timeout, RETRY_BUDGET),
        };
        // A charge that succeeded on a retry after a timeout charged twice: the
        // first one went through.
        let timed_out_share = if once.success < 1.0 { once.fail[TIMEOUT] / (1.0 - once.success) } else { 0.0 };
        let duplicates = if again.success > 0.0 {
            ((again.success - once.success).max(0.0) / again.success) * timed_out_share
        } else {
            0.0
        };
        if kind == kind_index("charge")
            && !(self.game.has("idempotency-keys") && self.game.fixed("idempotency-keys"))
            && duplicates > 0.0
        {
            return fail_some(again, duplicates, DUPLICATE);
        }
        again
    }

    /// `failureOn`: the share of attempts that fail on a Link.
    pub fn failure_on(&mut self, edge: usize, kind: usize) -> f64 {
        1.0 - self.attempt(edge, kind).success
    }

    /// `placed`: a call that leaves its zone or region pays the hop on top.
    fn placed(&mut self, edge: usize, kind: usize) -> Outcome {
        let (from, to) = match self.design.edges.get(edge) {
            Some(policy) => (policy.from as usize, policy.to as usize),
            None => return failed(STRANDED),
        };
        let extra = self.place_ms(from, to) + self.mesh_ms(from);
        let answer = self.call(edge, kind);
        if extra > 0.0 {
            through_one(hop(extra, 0.0), answer, false)
        } else {
            answer
        }
    }

    /// `placeMs`: the hop a call pays for leaving its zone or region.
    pub fn place_ms(&self, from: usize, to: usize) -> f64 {
        let source = match self.nodes.get(from) {
            Some(node) => node,
            None => return 0.0,
        };
        let target = match self.nodes.get(to) {
            Some(node) => node,
            None => return 0.0,
        };
        if COMPONENT_GLOBAL[source.type_code] || COMPONENT_GLOBAL[target.type_code] {
            return 0.0;
        }
        if source.region != target.region {
            return if source.type_code == component_index("users") {
                user_rtt_ms(self.game, source.region, target.region)
            } else {
                REGION_RTT[source.region.min(REGIONS.len() - 1)][target.region.min(REGIONS.len() - 1)]
            };
        }
        zone_ms(source, target)
    }

    /// `meshOf`: a sidecar adds a millisecond to every call out of its Node.
    #[inline]
    fn mesh_ms(&self, node: usize) -> f64 {
        if self.nodes.get(node).map(|node| node.mesh).unwrap_or(false) {
            MESH_HOP_MS
        } else {
            0.0
        }
    }

    /// `downstream`: what one request of `kind` sent from `node` gets back.
    pub fn downstream(&mut self, node: usize, kind: usize, extra_hop: f64) -> Outcome {
        if kind == kind_index("callout") {
            return callout_outcome();
        }
        let bucket = if extra_hop == 0.0 { 0 } else { 1 };
        let slot = self.slot(node, kind) * 2 + bucket;
        if self.memo.downstream_done.get(slot).copied().unwrap_or(1) == 1 {
            return self.memo.downstream[slot];
        }
        let count = self.scratch.split(
            self.design, node, kind, self.weights, self.nominal, self.sick, false,
        );
        // The recursion below reuses the same scratch, so the split is copied out first.
        let split: Vec<(u32, f64)> = self.scratch.pairs().iter().take(count).copied().collect();
        let mut entries: Vec<(Outcome, f64)> = Vec::with_capacity(count);
        for (edge, weight) in split {
            let answer = self.placed(edge as usize, kind);
            entries.push((answer, weight));
        }
        // A split with no targets strands the work, and the hop is not paid.
        let mixed = match blend(&entries) {
            Some(mixed) => mixed,
            None => {
                self.memo.downstream[slot] = failed(STRANDED);
                self.memo.downstream_done[slot] = 1;
                return self.memo.downstream[slot];
            }
        };
        let result = if extra_hop > 0.0 {
            through_one(hop(extra_hop, 0.0), mixed, false)
        } else {
            mixed
        };
        self.memo.downstream[slot] = result;
        self.memo.downstream_done[slot] = 1;
        result
    }

    /// `held`: milliseconds a caller holds its slot for one call of `kind`.
    pub fn held(&mut self, node: usize, kind: usize, extra_hop: f64) -> f64 {
        let count = self.scratch.split(
            self.design, node, kind, self.weights, self.nominal, self.sick, false,
        );
        let split: Vec<(u32, f64)> = self.scratch.pairs().iter().take(count).copied().collect();
        let mut total = 0.0;
        for (edge, weight) in split {
            let edge = edge as usize;
            let policy = match self.design.edges.get(edge) {
                Some(policy) => *policy,
                None => continue,
            };
            if policy.open {
                continue;
            }
            let attempts = if policy.retry == 0 { 1.0 } else { amplification(&policy, self.failure_on(edge, kind)) };
            let wait = if policy.bulkhead { policy.timeout.min(BULKHEAD_MS) } else { policy.timeout };
            let both = if policy.hedge { 1.0 + HEDGE_LOAD } else { 1.0 };
            let answer = self.outcome(policy.to as usize, kind);
            let each = held_for(&answer, wait)
                + extra_hop
                + self.place_ms(node, policy.to as usize)
                + self.mesh_ms(node);
            total += weight * attempts * both * wait.min(each);
        }
        total
    }

    /// `outcome`: what one request of `kind` gets back from `node`.
    pub fn outcome(&mut self, node: usize, kind: usize) -> Outcome {
        let slot = self.slot(node, kind);
        if self.memo.memo_done.get(slot).copied().unwrap_or(1) == 1 {
            return self.memo.memo[slot];
        }
        let game_node = match self.nodes.get(node) {
            Some(game_node) => game_node,
            None => return failed(STRANDED),
        };
        // A Node the kernel killed for memory fails as `oom` until it is back.
        let result = if game_node.down {
            failed(if game_node.down_oom { OOM } else { DOWN })
        } else if game_node.cert_until.map(|until| self.game.time >= until).unwrap_or(false) {
            // A Node whose TLS certificate ran out is refused by every browser.
            failed(DOWN)
        } else {
            self.rule(node, kind)
        };
        self.memo.memo[slot] = result;
        self.memo.memo_done[slot] = 1;
        result
    }

    /// The `outcome` half of each component rule.
    fn rule(&mut self, node: usize, kind: usize) -> Outcome {
        let type_code = match self.nodes.get(node) {
            Some(game_node) => game_node.type_code,
            None => return failed(STRANDED),
        };
        if type_code == component_index("users")
            || type_code == component_index("lb")
            || type_code == component_index("dns")
            || type_code == component_index("cdc")
        {
            return self.relay(node, kind);
        }
        if type_code == component_index("pooler") {
            let mode = self.nodes[node].mode;
            if mode == 2 && kind == kind_index("q-tx") {
                return failed(REFUSED);
            }
            let relayed = self.relay(node, kind);
            let crashes = if mode != 0 && !self.game.fixed("session-state") {
                SESSION_STATE_CRASHES
            } else {
                0.0
            };
            return fail_some(relayed, crashes, CRASH);
        }
        if type_code == component_index("database") || type_code == component_index("replica") {
            return self.database(node, kind);
        }
        if type_code == component_index("server") {
            return self.answer_calls(node, kind);
        }
        if type_code == component_index("auth")
            || type_code == component_index("dsql")
            || type_code == component_index("msgp")
            || type_code == component_index("warehouse")
        {
            let own = self.own_hop(node, kind, 1.0);
            return through(own, &[], false);
        }
        // A Node with no path for a request strands it.
        failed(STRANDED)
    }

    /// Its own hop, then what it sends on.
    fn relay(&mut self, node: usize, kind: usize) -> Outcome {
        let own = self.own_hop(node, kind, 1.0);
        let down = self.downstream(node, kind, 0.0);
        through_one(own, down, false)
    }

    /// The `databaseRule.outcome` half, which a Read Replica shares.
    fn database(&mut self, node: usize, kind: usize) -> Outcome {
        let game_node = match self.nodes.get(node) {
            Some(game_node) => *game_node,
            None => return failed(STRANDED),
        };
        // A synchronous replica that is down stalls every write the primary takes.
        if game_node.type_code == component_index("database")
            && (kind == kind_index("q-write") || kind == kind_index("q-tx"))
            && game_node.sync_stalled
        {
            return failed(TIMEOUT);
        }
        let refused = match self.pass.connections.get(node).copied().flatten() {
            Some((used, max)) if used > max && used > 0.0 => 1.0 - max / used,
            _ => 0.0,
        };
        // A report read from a materialized view is as fresh as its last refresh.
        let stale_scan = if kind == kind_index("q-scan")
            && game_node.materialized
            && self.game.has("precompute")
        {
            MATERIALIZED_STALE
        } else {
            0.0
        };
        let replica_stale = if game_node.type_code == component_index("replica")
            && kind == kind_index("q-read")
            && !game_node.sync
        {
            self.pass.stale_share
        } else {
            0.0
        };
        let mut reply = Outcome { success: 1.0 - refused, value: 1.0, stale: replica_stale.max(stale_scan), ..Outcome::default() };
        reply.fail[REFUSED] = refused;
        let own = through(self.own_hop(node, kind, 1.0), &[(reply, 1.0)], false);
        // A multi-leader certifies every write against its peers.
        if game_node.type_code == component_index("database")
            && (kind == kind_index("q-write") || kind == kind_index("q-tx") || kind == kind_index("blob-put"))
            && game_node.topology == 2
            && game_node.databases_in_group > 1.0
        {
            let conflict = (MULTI_CONFLICT * (game_node.databases_in_group - 1.0)).min(0.5);
            return fail_some(own, conflict, REFUSED);
        }
        // A transaction across shards commits on each of them, and any one can fail.
        if kind == kind_index("q-tx") {
            let sharded = game_node.type_code == component_index("database") && game_node.topology == 1;
            let logical = crate::model::sharding_of(&game_node);
            let shards = logical.shards * if sharded { game_node.databases_in_group.max(1.0) } else { 1.0 };
            let cross = if shards > 1.0 { SHARD_CROSS[game_node.shard_key.min(3)] * (1.0 - 1.0 / shards) } else { 0.0 };
            let failure = cross * DISTRIBUTED_TX_FAILURE * shards;
            return fail_some(own, failure, TIMEOUT);
        }
        own
    }

    /// `answerCalls`: an App Server's own hop, the calls it makes, and the bytes back.
    fn answer_calls(&mut self, node: usize, kind: usize) -> Outcome {
        let game_node = match self.nodes.get(node) {
            Some(game_node) => *game_node,
            None => return failed(STRANDED),
        };
        if kind >= NR {
            return failed(STRANDED);
        }
        // The Stack that answered sets the revenue.
        let served = self.own_hop(node, kind, FRAMEWORK_VALUE[game_node.framework][kind]);
        // The response crosses the user's downlink: bytes over bandwidth.
        let offloaded = self.offloads.get(node).copied().unwrap_or(false);
        let own = Hop {
            fixed_ms: served.fixed_ms
                + crate::model::transfer_ms(&game_node, kind, offloaded) * crate::model::payload_factor(self.game, kind),
            ..served
        };
        // A runtime that holds a worker per open connection cannot keep realtime connections.
        if kind == kind_index("rt") && RUNTIME_CONNECTION_KB[game_node.runtime] < 0.0 {
            return failed(REFUSED);
        }
        let crashes = self.code_crashes(&game_node, kind);
        if game_node.local_db {
            return fail_some(through(own, &[], false), crashes, CRASH);
        }
        let delegated = self.delegated.get(node).copied().unwrap_or(false);
        let calls = crate::pass::calls_of(self.game, &game_node, kind, delegated, offloaded);
        let hop = hop_ms(self.game);
        let mut entries: Vec<(Outcome, f64)> = Vec::with_capacity(NB);
        for backend in 0..NB {
            let count = calls[NR + backend];
            if backend < 3 || count > 0.0 {
                let answer = self.downstream(node, NR + backend, hop);
                entries.push((answer, count));
            }
        }
        // A stale read fails an API read, a checkout that reads its own write, and a search.
        let stale_counts = kind == kind_index("read") || kind == kind_index("buy") || kind == kind_index("search");
        let relayed = through(own, &entries, stale_counts);
        fail_some(relayed, crashes, CRASH)
    }

    /// `codeCrashes`: the share of requests the code itself fails.
    fn code_crashes(&self, node: &Node, _kind: usize) -> f64 {
        let bugs = if node.buggy { MIGRATION_BUGS } else { 0.0 };
        (bugs * node.blast).min(1.0)
    }
}

/// A customer's webhook endpoint: slow, and it fails now and then.
fn callout_outcome() -> Outcome {
    fail_some(
        through(hop(CALLOUT_MS / 2.0, CALLOUT_MS / 2.0), &[], false),
        CALLOUT_FAILURE,
        UPSTREAM,
    )
}

/// `zoneMs`: extra milliseconds a call pays for leaving its zone.
#[inline]
fn zone_ms(from: &Node, to: &Node) -> f64 {
    let zoned = |node: &Node| COMPONENT_LIMITING[node.type_code] && !COMPONENT_FIXED[node.type_code];
    if zoned(from) && zoned(to) && from.zone != to.zone {
        CROSS_ZONE_MS
    } else {
        0.0
    }
}

/// `hopMs`: one internal call's wire time, plus a handshake without keep-alive.
#[inline]
pub fn hop_ms(game: &GameCtx) -> f64 {
    HOP_MS + if game.has("keepalive") { 0.0 } else { HANDSHAKE_MS }
}

/// `userRttMs`: milliseconds a user's hop pays between two regions.
pub fn user_rtt_ms(game: &GameCtx, from: usize, to: usize) -> f64 {
    let a = from.min(REGIONS.len() - 1);
    let b = to.min(REGIONS.len() - 1);
    let rtt = REGION_RTT[a][b] * USER_ROUND_TRIPS;
    if rtt <= 0.0 {
        return rtt;
    }
    let cut = if game.has("http3") { rtt * (1.0 - HTTP3_CUT) } else { rtt };
    if game.has("anycast") {
        (cut - ANYCAST_MS).max(0.0)
    } else {
        cut
    }
}

/// Whether a component's `outcome` rule is ported. A run refuses a Design with a
/// Component whose rule is not, rather than print a figure that only looks right.
pub fn supports(type_code: usize) -> bool {
    let supported = [
        "users",
        "lb",
        "dns",
        "cdc",
        "pooler",
        "database",
        "replica",
        "server",
        "auth",
        "dsql",
        "msgp",
        "warehouse",
        "analytics",
        "autoscaler",
        "ci",
        "cluster",
        "ff",
        "mesh",
        "payments",
        "pki",
    ];
    supported.iter().any(|name| component_index(name) == type_code)
}
