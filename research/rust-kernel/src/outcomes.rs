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
use crate::pass::{Board, Pass};
use crate::routing::{amplification, Splits, Weights};

/// One memo table: an `Outcome` per key, valid while its stamp is the epoch.
#[derive(Default)]
struct Table {
    values: Vec<Outcome>,
    stamps: Vec<u32>,
}

impl Table {
    fn grow(&mut self, len: usize) {
        if self.values.len() < len {
            self.values.resize(len, Outcome::default());
            self.stamps.resize(len, 0);
        }
    }

    #[inline]
    fn get(&self, key: usize, epoch: u32) -> Option<Outcome> {
        match self.stamps.get(key) {
            Some(&stamp) if stamp == epoch => Some(self.values[key]),
            _ => None,
        }
    }

    #[inline]
    fn put(&mut self, key: usize, epoch: u32, value: Outcome) -> Outcome {
        if let (Some(slot), Some(stamp)) = (self.values.get_mut(key), self.stamps.get_mut(key)) {
            *slot = value;
            *stamp = epoch;
        }
        value
    }
}

/// The memo tables, kept for the life of the module and reused by every tree.
///
/// A solve walks one tree per pass and more per Bottleneck candidate. Starting
/// a tree only moves the epoch, so no table is zeroed between walks: an entry
/// whose stamp is an older epoch reads as empty.
#[derive(Default)]
pub struct Memo {
    epoch: u32,
    outcome: Table,
    attempts: Table,
    downstream: Table,
}

impl Memo {
    /// Empties every table, sized for `nodes` Nodes and `edges` Links.
    fn reset(&mut self, nodes: usize, edges: usize) {
        self.outcome.grow(nodes * NK);
        self.downstream.grow(nodes * NK * 2);
        self.attempts.grow(edges * NK);
        self.epoch = self.epoch.wrapping_add(1);
        if self.epoch == 0 {
            // Four billion trees later the stamps wrap: clear them once.
            for table in [&mut self.outcome, &mut self.attempts, &mut self.downstream] {
                table.stamps.fill(0);
            }
            self.epoch = 1;
        }
    }
}

/// One walk of the tree: the Board, the pass it reads, and the memo tables.
pub struct Tree<'a> {
    board: Board<'a>,
    pass: &'a Pass,
    weights: Weights<'a>,
    splits: &'a mut Splits,
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

/// Starts a walk over one pass. `splits` must answer for the same `weights`.
pub fn tree<'a>(
    board: Board<'a>,
    pass: &'a Pass,
    weights: Weights<'a>,
    splits: &'a mut Splits,
    memo: &'a mut Memo,
) -> Tree<'a> {
    memo.reset(board.design.nodes.len(), board.design.edges.len());
    Tree { board, pass, weights, splits, memo }
}

impl<'a> Tree<'a> {
    /// The Game this walk reads, for a caller that has only the tree.
    #[inline]
    pub fn game(&self) -> &'a GameCtx {
        self.board.game
    }

    /// `ownHop`: this Node's own service time for a kind, with the revenue multiplier.
    #[inline]
    pub fn own_hop(&self, node: usize, kind: usize, value: f64) -> Hop {
        let model: &Model = match self.pass.models.get(node) {
            Some(model) => model,
            None => return Hop { value, ..Hop::default() },
        };
        let type_code = self.board.nodes.get(node).map(|node| node.type_code).unwrap_or(0);
        // A kind the model has no service record for falls back to the Component's latency.
        let (fixed, variable) = if kind < NK && (model.service_mask >> kind) & 1 == 1 {
            (model.service_fixed[kind], model.service_variable[kind])
        } else {
            (COMPONENT_LATENCY[type_code], 0.0)
        };
        let sampling = self.board.flags.get(node).map(|flags| flags.sampling).unwrap_or(0.0);
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
        if let Some(memo) = self.memo.attempts.get(slot, self.memo.epoch) {
            return memo;
        }
        let Some(policy) = self.board.design.edges.get(edge).copied() else {
            return failed(STRANDED);
        };
        let wait = if policy.bulkhead { policy.timeout.min(BULKHEAD_MS) } else { policy.timeout };
        let answer = timed_out(self.outcome(policy.to as usize, kind), wait);
        let result = if policy.hedge { hedged(answer) } else { answer };
        self.memo.attempts.put(slot, self.memo.epoch, result)
    }

    /// `call`: one attempt, plus the Link's retries.
    fn call(&mut self, edge: usize, kind: usize) -> Outcome {
        let policy = match self.board.design.edges.get(edge) {
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
        if kind == kind::CHARGE
            && !(self.board.game.has(research::IDEMPOTENCY_KEYS) && self.board.game.fixed(fix::IDEMPOTENCY_KEYS))
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
        let (from, to) = match self.board.design.edges.get(edge) {
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
        let source = match self.board.nodes.get(from) {
            Some(node) => node,
            None => return 0.0,
        };
        let target = match self.board.nodes.get(to) {
            Some(node) => node,
            None => return 0.0,
        };
        if COMPONENT_GLOBAL[source.type_code] || COMPONENT_GLOBAL[target.type_code] {
            return 0.0;
        }
        // A leaderless store spread across regions answers from a local quorum.
        if target.type_code == component::WIDE && target.local_regions >> source.region.min(31) & 1 == 1 {
            return 0.0;
        }
        if source.region != target.region {
            return if source.type_code == component::USERS {
                user_rtt_ms(self.board.game, source.region, target.region)
            } else {
                REGION_RTT[source.region.min(REGIONS.len() - 1)][target.region.min(REGIONS.len() - 1)]
            };
        }
        zone_ms(source, target)
    }

    /// `meshOf`: a sidecar adds a millisecond to every call out of its Node.
    #[inline]
    fn mesh_ms(&self, node: usize) -> f64 {
        if self.board.nodes.get(node).map(|node| node.mesh).unwrap_or(false) {
            MESH_HOP_MS
        } else {
            0.0
        }
    }

    /// `downstream`: what one request of `kind` sent from `node` gets back.
    pub fn downstream(&mut self, node: usize, kind: usize, extra_hop: f64) -> Outcome {
        if kind == kind::CALLOUT {
            return callout_outcome();
        }
        let bucket = if extra_hop == 0.0 { 0 } else { 1 };
        let slot = self.slot(node, kind) * 2 + bucket;
        if let Some(memo) = self.memo.downstream.get(slot, self.memo.epoch) {
            return memo;
        }
        let split = self.splits.range(self.board.design, node, kind, &self.weights);
        let total: f64 = split.clone().map(|index| self.splits.pair(index).1).sum();
        // A split with no targets strands the work, and the hop is not paid.
        let mixed = match Blend::new(total).filter(|_| !split.is_empty()) {
            Some(mut mix) => {
                // The recursion may add splits, but never moves one already kept.
                for index in split {
                    let (edge, weight) = self.splits.pair(index);
                    let answer = self.placed(edge as usize, kind);
                    mix.add(&answer, weight);
                }
                mix.finish()
            }
            None => return self.memo.downstream.put(slot, self.memo.epoch, failed(STRANDED)),
        };
        let result = if extra_hop > 0.0 {
            through_one(hop(extra_hop, 0.0), mixed, false)
        } else {
            mixed
        };
        self.memo.downstream.put(slot, self.memo.epoch, result)
    }

    /// `held`: milliseconds a caller holds its slot for one call of `kind`.
    pub fn held(&mut self, node: usize, kind: usize, extra_hop: f64) -> f64 {
        let split = self.splits.range(self.board.design, node, kind, &self.weights);
        let mut total = 0.0;
        for index in split {
            let (edge, weight) = self.splits.pair(index);
            let edge = edge as usize;
            let policy = match self.board.design.edges.get(edge) {
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
        if let Some(memo) = self.memo.outcome.get(slot, self.memo.epoch) {
            return memo;
        }
        let game_node = match self.board.nodes.get(node) {
            Some(game_node) => game_node,
            None => return failed(STRANDED),
        };
        // A Node the kernel killed for memory fails as `oom` until it is back.
        let result = if game_node.down {
            failed(if game_node.down_oom { OOM } else { DOWN })
        } else if game_node.cert_until.map(|until| self.board.game.time >= until).unwrap_or(false) {
            // A Node whose TLS certificate ran out is refused by every browser.
            failed(DOWN)
        } else {
            self.rule(node, kind)
        };
        self.memo.outcome.put(slot, self.memo.epoch, result)
    }

    /// The `outcome` half of each component rule.
    fn rule(&mut self, node: usize, kind: usize) -> Outcome {
        let type_code = match self.board.nodes.get(node) {
            Some(game_node) => game_node.type_code,
            None => return failed(STRANDED),
        };
        match type_code {
            component::USERS | component::LB | component::DNS | component::CDC => self.relay(node, kind),
            component::POOLER => {
                let mode = self.board.nodes[node].mode;
                if mode == 2 && kind == kind::Q_TX {
                    return failed(REFUSED);
                }
                let relayed = self.relay(node, kind);
                let crashes = if mode != 0 && !self.board.game.fixed(fix::SESSION_STATE) {
                    SESSION_STATE_CRASHES
                } else {
                    0.0
                };
                fail_some(relayed, crashes, CRASH)
            }
            component::DATABASE | component::REPLICA => self.database(node, kind),
            component::SERVER => self.answer_calls(node, kind),
            component::AUTH | component::MSGP | component::WAREHOUSE | component::PSP => {
                through(self.own_hop(node, kind, 1.0), &[], false)
            }
            // Past its rate limit, a model API fails a prompt as `throttled` at once.
            component::LLM => {
                through(Hop { cause: THROTTLED, ..self.own_hop(node, kind, 1.0) }, &[], false)
            }
            component::STORAGE => self.storage(node, kind),
            component::GPU => self.gpu(node, kind),
            component::SEARCH => self.search(node, kind),
            component::WIDE => self.wide(node, kind),
            component::QUEUE => self.queue(node, kind),
            component::WORKER => self.worker(node, kind),
            // A Node with no path for a request strands it.
            _ => failed(STRANDED),
        }
    }

    /// `queueRule.outcome`: the caller waits for the enqueue only, and a long
    /// backlog slows the broker.
    fn queue(&mut self, node: usize, kind: usize) -> Outcome {
        let Some(game_node) = self.board.nodes.get(node).copied() else {
            return failed(STRANDED);
        };
        let own = self.own_hop(node, kind, 1.0);
        // With no Worker linked, the task has nowhere to go.
        if self.downstream(node, kind, 0.0).fail[STRANDED] >= 1.0 {
            return failed(STRANDED);
        }
        let enqueued = through(Hop { fixed_ms: own.fixed_ms + BACKLOG_MS * game_node.depth, ..own }, &[], false);
        // A full Queue refuses what its Workers cannot take (RabbitMQ `reject-publish`).
        if game_node.max_length <= 0.0 || game_node.depth < game_node.max_length {
            return enqueued;
        }
        let inflow = self.pass.rates(node)[NR + backend::TASK];
        let drained = self.pass.drained.get(node).copied().unwrap_or(0.0);
        if inflow > 0.0 {
            fail_some(enqueued, (1.0 - drained / inflow).max(0.0), DROPPED)
        } else {
            enqueued
        }
    }

    /// `workerRule.outcome`: one attempt, its calls, and the code's own failures.
    /// Users never wait for it.
    fn worker(&mut self, node: usize, kind: usize) -> Outcome {
        let Some(game_node) = self.board.nodes.get(node).copied() else {
            return failed(STRANDED);
        };
        let mix = crate::pass::task_mix_of(self.board.game, &self.pass.tasks, node);
        let mut calls = [0.0f64; NB];
        for (origin, &share) in mix[..NR].iter().enumerate() {
            if share <= 0.0 {
                continue;
            }
            let each = crate::pass::async_calls_of(self.board.game, origin);
            for (call, made) in calls.iter_mut().zip(&each[NR..]) {
                *call += share * made;
            }
        }
        let own = self.own_hop(node, kind, 1.0);
        let hop = hop_ms(self.board.game);
        let mut entries = [(Outcome::default(), 0.0); NB];
        let mut made = 0;
        for (backend, &count) in calls.iter().enumerate() {
            if count > 0.0 {
                entries[made] = (self.downstream(node, NR + backend, hop), count);
                made += 1;
            }
        }
        let crashes = self.code_crashes(&game_node, kind);
        fail_some(through(own, &entries[..made], false), crashes, CRASH)
    }

    /// `storageRule.outcome`: a read of an archived object waits hours for its
    /// restore, so the archived share of reads fails as a timeout.
    fn storage(&mut self, node: usize, kind: usize) -> Outcome {
        let own = through(self.own_hop(node, kind, 1.0), &[], false);
        if kind != kind::BLOB_GET {
            return own;
        }
        let archived = self.board.nodes.get(node).map(|node| node.archived).unwrap_or(0.0);
        fail_some(own, archived, TIMEOUT)
    }

    /// `gpuRule.outcome`: a quantized answer is worth less, and a model that does
    /// not fit in the GPUs' memory is killed as it loads.
    fn gpu(&mut self, node: usize, kind: usize) -> Outcome {
        let Some(game_node) = self.board.nodes.get(node).copied() else {
            return failed(STRANDED);
        };
        let need = GPU_MODELS_GB[game_node.gpu_model] * GPU_PRECISIONS_MEMORY[game_node.precision]
            + GPU_CACHE_GB * game_node.batch;
        let held = GPU_TYPES_GB[game_node.gpu] * crate::model::flat_scale(game_node.size);
        if need > held {
            return failed(OOM);
        }
        let value = GPU_PRECISIONS_VALUE[game_node.precision] * GPU_MODELS_VALUE[game_node.gpu_model];
        through(self.own_hop(node, kind, value), &[], false)
    }

    /// `searchRule.outcome`: a search answers as stale as its refresh, its copy of
    /// the data, or its relevance, whichever is worst.
    fn search(&mut self, node: usize, kind: usize) -> Outcome {
        let own = through(self.own_hop(node, kind, 1.0), &[], false);
        if kind != kind::Q_SEARCH {
            return own;
        }
        let Some(game_node) = self.board.nodes.get(node).copied() else {
            return failed(STRANDED);
        };
        let game = self.board.game;
        // The copies can only diverge once the app writes to several of them: Series B.
        let mut diverged = 0.0;
        if game.stage >= 4.0 {
            // A CDC Connector only helps a Search Engine it reaches: the engine must take a change.
            let fed = self.pass.rates(node)[kind::CHANGE] > 0.0;
            let mut cdcs = 0;
            let mut share = 1.0f64;
            if fed {
                for (slot, cdc) in self.board.nodes.iter().enumerate() {
                    if cdc.type_code == component::CDC && !cdc.down {
                        cdcs += 1;
                        share = share.min(self.pass.models.get(slot).map(|model| model.share).unwrap_or(0.0));
                    }
                }
            }
            diverged = if cdcs > 0 {
                CDC_LAG_STALE + (1.0 - share) * CDC_DROP_STALE
            } else if game.has(research::OUTBOX) {
                OUTBOX_STALE
            } else {
                DUAL_WRITE_STALE
            };
        }
        // Meilisearch's relevance falls as the index grows.
        let variant = game_node.search_variant;
        let relevance = SEARCH_VARIANTS_CAP[variant].min(game.users * SEARCH_VARIANTS_RELEVANCE[variant]);
        let stale = SEARCH_REFRESH_STALE[crate::model::refresh_row(&game_node)].max(diverged).max(relevance);
        Outcome { stale, ..own }
    }

    /// `wideRule.outcome`: a quorum that needs more replicas than are left cannot
    /// form, and a weak one reads a missed write now and then.
    fn wide(&mut self, node: usize, kind: usize) -> Outcome {
        use crate::model::{quorum_n, quorum_r, quorum_w, split_work};
        let Some(game_node) = self.board.nodes.get(node).copied() else {
            return failed(STRANDED);
        };
        let n = quorum_n(&game_node);
        let short = if game_node.lost > 0.0 { 1.0 } else { 0.0 };
        let needed = if kind == kind::Q_READ { quorum_r(&game_node) } else { quorum_w(&game_node) };
        if needed > n - short {
            return failed(REFUSED);
        }
        let reply = through(self.own_hop(node, kind, 1.0), &[], false);
        // Overlap is not linearizability: a checkout on a quorum store still goes wrong.
        if kind == kind::Q_TX {
            return fail_some(Outcome { stale: WIDE_TX_STALE, ..reply }, WIDE_TX_DUPLICATE, DUPLICATE);
        }
        if kind != kind::Q_READ {
            return reply;
        }
        let (reads, writes) = split_work(self.pass.rates(node));
        let write_share = if reads + writes > 0.0 { writes / (reads + writes) } else { 0.0 };
        let (r, w) = (quorum_r(&game_node), quorum_w(&game_node));
        // `wideStale`: R + W > N reads the latest write every time.
        let quorum_stale = if r + w > n {
            0.0
        } else {
            let missed = (n - w) / n;
            (WIDE_STALE * write_share * missed * (2.0 / (r + 1.0)) + 0.05 * missed).min(0.5)
        };
        // LOCAL_QUORUM keeps latency local, but cross-region replication lags.
        let regions = self.board.game.spread_regions;
        let spread_stale = if game_node.spread && regions > 1.0 {
            WIDE_SPREAD_LAG_STALE * (1.0 - 1.0 / regions) * write_share
        } else {
            0.0
        };
        Outcome { stale: (quorum_stale + spread_stale).min(1.0), ..reply }
    }

    /// Its own hop, then what it sends on.
    fn relay(&mut self, node: usize, kind: usize) -> Outcome {
        let own = self.own_hop(node, kind, 1.0);
        let down = self.downstream(node, kind, 0.0);
        through_one(own, down, false)
    }

    /// The `databaseRule.outcome` half, which a Read Replica shares.
    fn database(&mut self, node: usize, kind: usize) -> Outcome {
        let game_node = match self.board.nodes.get(node) {
            Some(game_node) => *game_node,
            None => return failed(STRANDED),
        };
        // A synchronous replica that is down stalls every write the primary takes.
        if game_node.type_code == component::DATABASE
            && (kind == kind::Q_WRITE || kind == kind::Q_TX)
            && game_node.sync_stalled
        {
            return failed(TIMEOUT);
        }
        let refused = match self.pass.connections.get(node).copied().flatten() {
            Some((used, max)) if used > max && used > 0.0 => 1.0 - max / used,
            _ => 0.0,
        };
        // A report read from a materialized view is as fresh as its last refresh.
        let stale_scan = if kind == kind::Q_SCAN
            && game_node.materialized
            && self.board.game.has(research::PRECOMPUTE)
        {
            MATERIALIZED_STALE
        } else {
            0.0
        };
        let replica_stale = if game_node.type_code == component::REPLICA
            && kind == kind::Q_READ
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
        if game_node.type_code == component::DATABASE
            && (kind == kind::Q_WRITE || kind == kind::Q_TX || kind == kind::BLOB_PUT)
            && game_node.topology == 2
            && game_node.databases_in_group > 1.0
        {
            let conflict = (MULTI_CONFLICT * (game_node.databases_in_group - 1.0)).min(0.5);
            return fail_some(own, conflict, REFUSED);
        }
        // A transaction across shards commits on each of them, and any one can fail.
        if kind == kind::Q_TX {
            let sharded = game_node.type_code == component::DATABASE && game_node.topology == 1;
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
        let game_node = match self.board.nodes.get(node) {
            Some(game_node) => *game_node,
            None => return failed(STRANDED),
        };
        if kind >= NR {
            return failed(STRANDED);
        }
        // The Stack that answered sets the revenue.
        let served = self.own_hop(node, kind, FRAMEWORK_VALUE[game_node.framework][kind]);
        // The response crosses the user's downlink: bytes over bandwidth.
        let offloaded = self.board.flags.get(node).map(|flags| flags.offloaded).unwrap_or(false);
        let own = Hop {
            fixed_ms: served.fixed_ms
                + crate::model::transfer_ms(&game_node, kind, offloaded) * crate::model::payload_factor(self.board.game, kind),
            ..served
        };
        // A runtime that holds a worker per open connection cannot keep realtime connections.
        if kind == kind::RT && RUNTIME_CONNECTION_KB[game_node.runtime] < 0.0 {
            return failed(REFUSED);
        }
        let crashes = self.code_crashes(&game_node, kind);
        if game_node.local_db {
            return fail_some(through(own, &[], false), crashes, CRASH);
        }
        let calls = self.board.code.node(node).calls[kind];
        let hop = hop_ms(self.board.game);
        let mut entries = [(Outcome::default(), 0.0); NB];
        let mut made = 0;
        for (backend, &count) in calls.iter().enumerate() {
            if backend < 3 || count > 0.0 {
                entries[made] = (self.downstream(node, NR + backend, hop), count);
                made += 1;
            }
        }
        // A stale read fails an API read, a checkout that reads its own write, and a search.
        let stale_counts = kind == kind::READ || kind == kind::BUY || kind == kind::SEARCH;
        let relayed = through(own, &entries[..made], stale_counts);
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
    let zoned = |node: &Node| {
        COMPONENT_LIMITING[node.type_code]
            && !COMPONENT_FIXED[node.type_code]
            // A provider's, and the regional Load Balancer's, WAF's and API Gateway's, span every zone.
            && !matches!(node.type_code, component::PSP | component::LLM | component::LB | component::WAF | component::GW)
            // A store spread across regions keeps replicas in every zone too.
            && !(node.spread && matches!(node.type_code, component::WIDE | component::DSQL))
    };
    if zoned(from) && zoned(to) && from.zone != to.zone {
        CROSS_ZONE_MS
    } else {
        0.0
    }
}

/// `hopMs`: one internal call's wire time, plus a handshake without keep-alive.
#[inline]
pub fn hop_ms(game: &GameCtx) -> f64 {
    HOP_MS + if game.has(research::KEEPALIVE) { 0.0 } else { HANDSHAKE_MS }
}

/// `userRttMs`: milliseconds a user's hop pays between two regions.
pub fn user_rtt_ms(game: &GameCtx, from: usize, to: usize) -> f64 {
    let a = from.min(REGIONS.len() - 1);
    let b = to.min(REGIONS.len() - 1);
    let rtt = REGION_RTT[a][b] * USER_ROUND_TRIPS;
    if rtt <= 0.0 {
        return rtt;
    }
    let cut = if game.has(research::HTTP3) { rtt * (1.0 - HTTP3_CUT) } else { rtt };
    if game.has(research::ANYCAST) {
        (cut - ANYCAST_MS).max(0.0)
    } else {
        cut
    }
}

/// Whether a component's `outcome` rule is ported. A run refuses a Design with a
/// Component whose rule is not, rather than print a figure that only looks right.
pub fn supports(type_code: usize) -> bool {
    use crate::catalog::component::*;
    matches!(
        type_code,
        USERS | LB | DNS | CDC | POOLER | DATABASE | REPLICA | SERVER | AUTH | MSGP | WAREHOUSE
            | PSP | LLM | STORAGE | GPU | SEARCH | WIDE | QUEUE | WORKER
            | ANALYTICS | AUTOSCALER | CI | CLUSTER | FF | MESH | PAYMENTS | PKI
    )
}
