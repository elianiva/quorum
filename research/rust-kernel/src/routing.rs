//! Routing: which Links a Node sends a kind on, and what share each takes.
//!
//! Ported from `solve-graph.ts` and `solve-pass.ts` (`takersOf`, `splitFor`,
//! `weighted`, `pinned`, `noticed`, `carries`).
//!
//! The Design is compiled once into a flat, cache-friendly shape: adjacency is
//! a CSR pair of arrays, not `Vec<Vec<_>>`, and every scratch list lives in
//! `Scratch` and is cleared rather than reallocated. A split therefore allocates
//! nothing, which is the whole reason this beats the JavaScript it came from.

use crate::catalog::*;

/// The most targets one split may report, so a result fits a fixed slot.
const MAX_SPLIT: usize = 64;

/// A Node as routing sees it. Kept small and `Copy` so the whole table is one
/// contiguous scan.
#[derive(Clone, Copy)]
pub struct RouteNode {
    pub type_code: u16,
    pub down: bool,
    pub down_cause: u8,
    pub down_at: f64,
    pub sticky: bool,
    pub policy: u8,
    pub ttl: f64,
    pub check_every: f64,
    pub deep_check: bool,
    pub replica: bool,
    pub has_primary: bool,
    pub draining: bool,
}

/// A routing Link, numbered so a pass keeps per-Link state in arrays.
#[derive(Clone, Copy)]
pub struct RouteEdge {
    pub from: u32,
    pub to: u32,
    /// Kinds this Link carries, as a mask over all kinds.
    pub kinds: u64,
    pub retry: u8,
    pub timeout: f64,
    pub open: bool,
    pub bulkhead: bool,
    pub hedge: bool,
    /// `link.failure`: the failure share this Link saw last Step, which a
    /// retrying Link starts a fresh solve from.
    pub failure: f64,
    /// Whether its bytes cross a zone or a region: `bill::egress`.
    pub egress: u8,
}

/// The routing structure, built once per Design.
///
/// Adjacency is CSR: `out_edges[out_starts[n]..out_starts[n + 1]]` are the
/// Edges out of Node `n`. One allocation each, and a Node's Edges are adjacent
/// in memory, so walking them touches one cache line instead of chasing a
/// `Vec` per Node.
#[derive(Clone)]
pub struct Design {
    pub nodes: Vec<RouteNode>,
    pub edges: Vec<RouteEdge>,
    /// Nodes in the order a pass walks them: every Node after the ones that feed it.
    pub order: Vec<usize>,
    out_starts: Vec<u32>,
    out_edges: Vec<u32>,
    /// Each Node's Edges into a CDC Connector, which copy its writes and route nothing,
    /// laid out as `out_edges` is.
    mirror_starts: Vec<u32>,
    mirror_edges: Vec<u32>,
    pub health_checked: bool,
    pub time: f64,
    /// Which compile this is, so a cache of its splits can tell it from the next one.
    generation: u64,
}

/// Counts compiled Designs: every `Design::new` takes the next number.
static GENERATIONS: core::sync::atomic::AtomicU64 = core::sync::atomic::AtomicU64::new(1);

impl Design {
    /// The first index into `out_edges` for a Node's Edges.
    #[inline]
    pub fn out_start(&self, node: usize) -> usize {
        self.out_starts.get(node).copied().unwrap_or(0) as usize
    }

    /// The end of a Node's slice of `out_edges`.
    #[inline]
    pub fn out_end(&self, node: usize) -> usize {
        self.out_starts.get(node + 1).copied().unwrap_or(0) as usize
    }

    /// A Node's Edges, as one contiguous slice.
    #[inline]
    pub fn out_edges_of(&self, node: usize) -> &[u32] {
        let start = self.out_start(node);
        let end = self.out_end(node).max(start);
        self.out_edges.get(start..end).unwrap_or(&[])
    }

    /// A Node's Edges into a CDC Connector.
    #[inline]
    pub fn mirror_edges_of(&self, node: usize) -> &[u32] {
        let start = self.mirror_starts.get(node).copied().unwrap_or(0) as usize;
        let end = self.mirror_starts.get(node + 1).copied().unwrap_or(0) as usize;
        self.mirror_edges.get(start..end.max(start)).unwrap_or(&[])
    }

    /// The Edges between two indices of `out_edges`.
    #[inline]
    pub fn out_edges_in(&self, start: usize, end: usize) -> &[u32] {
        self.out_edges.get(start..end.max(start)).unwrap_or(&[])
    }

    #[inline]
    fn out(&self, node: usize) -> &[u32] {
        let start = self.out_starts[node] as usize;
        let end = self.out_starts[node + 1] as usize;
        &self.out_edges[start..end]
    }

    pub fn new(
        nodes: Vec<RouteNode>,
        edges: Vec<RouteEdge>,
        out_edges: Vec<u32>,
        out_starts: Vec<u32>,
        health_checked: bool,
        time: f64,
    ) -> Design {
        // An Edge into a CDC Connector copies the writes of the Node it leaves.
        let count = nodes.len();
        let mut mirror_starts = vec![0u32; count + 1];
        for edge in edges.iter().filter(|edge| nodes[edge.to as usize].type_code as usize == crate::catalog::component::CDC) {
            mirror_starts[edge.from as usize + 1] += 1;
        }
        for node in 0..count {
            mirror_starts[node + 1] += mirror_starts[node];
        }
        let mut mirror_edges = vec![0u32; mirror_starts[count] as usize];
        let mut filled = mirror_starts.clone();
        for (index, edge) in edges.iter().enumerate() {
            if nodes[edge.to as usize].type_code as usize == crate::catalog::component::CDC {
                let at = &mut filled[edge.from as usize];
                mirror_edges[*at as usize] = index as u32;
                *at += 1;
            }
        }
        // Kahn's order over the routing Edges: a Node walks after every Node that
        // routes to it, so its arrivals are complete when its model runs. A CDC
        // Connector also waits for every Node whose writes it copies.
        let mut indegree = vec![0u32; count];
        for edge in &edges {
            indegree[edge.to as usize] += 1;
        }
        let mut order = Vec::with_capacity(count);
        let mut queue: Vec<usize> = (0..count).filter(|&i| indegree[i] == 0).collect();
        let mut cursor = 0;
        while cursor < queue.len() {
            let node = queue[cursor];
            cursor += 1;
            order.push(node);
            let start = out_starts[node] as usize;
            let end = out_starts[node + 1] as usize;
            let mirrors = &mirror_edges[mirror_starts[node] as usize..mirror_starts[node + 1] as usize];
            for &edge in out_edges[start..end].iter().chain(mirrors) {
                let target = edges[edge as usize].to as usize;
                indegree[target] -= 1;
                if indegree[target] == 0 {
                    queue.push(target);
                }
            }
        }
        // A Design with a cycle leaves the stragglers out; keep them so nothing is dropped.
        for node in 0..count {
            if !order.contains(&node) {
                order.push(node);
            }
        }
        let generation = GENERATIONS.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
        Design { nodes, edges, order, out_starts, out_edges, mirror_starts, mirror_edges, health_checked, time, generation }
    }
}

/// `amplification`: calls per call a retrying Link sends when a share `failure` fails.
#[inline]
pub fn amplification(policy: &RouteEdge, failure: f64) -> f64 {
    if policy.open {
        return 0.0;
    }
    match policy.retry {
        1 => crate::dist::attempts_for(failure),
        2 => 1.0 + crate::dist::RETRY_BUDGET.min(crate::dist::attempts_for(failure) - 1.0),
        _ => 1.0,
    }
}

/// What a router reads about each Node: its live weight, its probed capacity,
/// and whether a deep health check has failed it. One pass reads one of these.
#[derive(Clone, Copy)]
pub struct Weights<'a> {
    pub live: &'a [f64],
    pub nominal: &'a [f64],
    pub sick: &'a [bool],
}

/// What a split's answer was read from.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Read {
    /// Not worked out since the last reset.
    Unsplit,
    /// The Design alone: the answer holds for every set of Weights.
    Design,
    /// The Weights too: the answer holds until they move.
    Weights,
}

/// Every split one Design answers, each worked out on first use.
///
/// A pass and the tree after it ask for the same (Node, kind) splits, and the
/// tree asks again for every caller, so the answers are kept in one flat list
/// indexed by `node * NK + kind`. The owner calls `reset` whenever the Weights
/// it passes change: a split that read them is forgotten, and one that read only
/// the Design, which is most of them, is kept for the rest of the run.
#[derive(Default)]
pub struct Splits {
    scratch: Scratch,
    /// The Design these splits answer for.
    design: u64,
    read: Vec<Read>,
    /// Where each (Node, kind) split starts in `pairs`, and how many pairs it has.
    start: Vec<u32>,
    count: Vec<u32>,
    pairs: Vec<(u32, f64)>,
    /// `reset` compacts the kept answers into this, then swaps it with `pairs`.
    spare: Vec<(u32, f64)>,
}

impl Splits {
    /// Forgets every split that read the Weights, and every split at all when
    /// `design` is not the Design they were worked out for.
    pub fn reset(&mut self, design: &Design) {
        let keys = design.nodes.len() * NK;
        if self.design != design.generation || self.read.len() != keys {
            self.design = design.generation;
            let nodes = design.nodes.len();
            self.read.clear();
            self.read.resize(nodes * NK, Read::Unsplit);
            self.start.clear();
            self.start.resize(nodes * NK, 0);
            self.count.clear();
            self.count.resize(nodes * NK, 0);
            self.pairs.clear();
            return;
        }
        self.spare.clear();
        for key in 0..self.read.len() {
            match self.read[key] {
                Read::Design => {
                    let start = self.start[key] as usize;
                    let end = start + self.count[key] as usize;
                    self.start[key] = self.spare.len() as u32;
                    self.spare.extend_from_slice(&self.pairs[start..end]);
                }
                Read::Weights => self.read[key] = Read::Unsplit,
                Read::Unsplit => {}
            }
        }
        core::mem::swap(&mut self.pairs, &mut self.spare);
    }

    /// The split of `kind` out of `node`, as a range of `pair` indices.
    #[inline]
    pub fn range(&mut self, design: &Design, node: usize, kind: usize, weights: &Weights) -> core::ops::Range<usize> {
        let key = node * NK + kind;
        let start = match self.read.get(key) {
            Some(Read::Unsplit) => {
                let start = self.pairs.len();
                let (count, read) = self.scratch.split_reading(design, node, kind, weights, false);
                self.pairs.extend_from_slice(&self.scratch.pairs[..count]);
                self.read[key] = read;
                self.start[key] = start as u32;
                self.count[key] = count as u32;
                start
            }
            Some(_) => self.start[key] as usize,
            // A key outside the table: answer without keeping it.
            None => return 0..0,
        };
        start..start + self.count[key] as usize
    }

    /// The split of `kind` out of `node`.
    #[inline]
    pub fn get(&mut self, design: &Design, node: usize, kind: usize, weights: &Weights) -> &[(u32, f64)] {
        let range = self.range(design, node, kind, weights);
        &self.pairs[range]
    }

    /// One (Edge, share) pair of a range `range` returned.
    #[inline]
    pub fn pair(&self, index: usize) -> (u32, f64) {
        self.pairs[index]
    }
}

/// Every buffer a split needs, allocated once. `clear` keeps the capacity, so a
/// solve allocates only when a list first grows.
#[derive(Default)]
pub struct Scratch {
    /// Edges that accept the kind and carry it.
    linked: Vec<u32>,
    /// The subset with a way on, for a Cache, Pooler, or Load Balancer.
    live: Vec<u32>,
    /// The subset built for the kind rather than falling back to it.
    own: Vec<u32>,
    /// Load Balancer health-check survivors.
    up: Vec<u32>,
    /// The healthy subset a Load Balancer splits over.
    healthy: Vec<u32>,
    /// The current target set.
    targets: Vec<u32>,
    /// The algorithm's shares before stickiness.
    base: Vec<(u32, f64)>,
    /// The answer for the split just computed.
    pairs: Vec<(u32, f64)>,
    /// Weights, so a share never divides by a stale sum.
    raw: Vec<f64>,
}

#[inline]
pub fn accepts(type_code: usize, kind: usize) -> bool {
    (COMPONENT_ACCEPTS[type_code] >> kind) & 1 == 1
}

/// `carries`: an API Gateway sends only the kinds its route table names.
#[inline]
fn carries(edge: &RouteEdge, source: &RouteNode, kind: usize) -> bool {
    source.type_code as usize != component::GW || (edge.kinds >> kind) & 1 == 1
}

/// `noticed`: whether the router in front of a Node has seen it go down.
#[inline]
fn noticed(design: &Design, child: usize, after: f64) -> bool {
    let node = &design.nodes[child];
    node.down && (node.down_cause == 0 || design.time - node.down_at >= after)
}

impl Scratch {
    /// `weighted`: each target's share of the total weight, with a floor. Writes
    /// into `pairs` and returns the count.
    #[inline]
    fn weighted(&mut self, design: &Design, weight_of: impl Fn(&Design, u32) -> f64) -> usize {
        self.raw.clear();
        let mut sum = 0.0;
        for &edge in &self.targets {
            let weight = weight_of(design, edge);
            let clamped = if weight.is_finite() { weight.max(1e-6) } else { 1e9 };
            self.raw.push(clamped);
            sum += clamped;
        }
        self.pairs.clear();
        for (index, &edge) in self.targets.iter().enumerate() {
            // `raw` was filled in the same pass as `targets`, so the index is sound.
            let share = self.raw[index] / sum;
            self.pairs.push((edge, share));
        }
        self.pairs.len()
    }

    /// `even`: each target takes the same share.
    #[inline]
    fn even(&mut self) -> usize {
        let share = 1.0 / self.targets.len() as f64;
        self.pairs.clear();
        for &edge in &self.targets {
            self.pairs.push((edge, share));
        }
        self.pairs.len()
    }

    /// `takersOf`: the Edges out of `node` that can take `kind`.
    fn takers(&mut self, design: &Design, node: usize, kind: usize) -> usize {
        let source = design.nodes[node];
        self.linked.clear();
        for &edge in design.out(node) {
            let target = design.nodes[design.edges[edge as usize].to as usize];
            if accepts(target.type_code as usize, kind)
                && carries(&design.edges[edge as usize], &source, kind)
            {
                self.linked.push(edge);
            }
        }
        self.live.clear();
        let is_data = (DATA_KINDS_MASK >> kind) & 1 == 1;
        for &edge in &self.linked {
            let target_index = design.edges[edge as usize].to as usize;
            let target = design.nodes[target_index];
            let type_code = target.type_code as usize;
            let fallback = type_code == component::CACHE
                || type_code == component::POOLER
                || type_code == component::LB;
            if !fallback
                || !is_data
                || design.out(target_index).iter().any(|&next| {
                    accepts(design.nodes[design.edges[next as usize].to as usize].type_code as usize, kind)
                })
            {
                self.live.push(edge);
            }
        }
        let usable: &[u32] = if self.live.is_empty() { &self.linked } else { &self.live };
        self.own.clear();
        for &edge in usable {
            let target_type = design.nodes[design.edges[edge as usize].to as usize].type_code as usize;
            if (COMPONENT_FALLBACK[target_type] >> kind) & 1 == 0 {
                self.own.push(edge);
            }
        }
        // A Warehouse is the analytical target, so it takes the scan.
        if kind == kind::Q_SCAN {
            let mut warehouse = 0;
            let mut first = 0;
            for &edge in &self.own {
                let target = design.edges[edge as usize].to as usize;
                if design.nodes[target].type_code as usize == component::WAREHOUSE
                    && !design.nodes[target].down
                {
                    if warehouse == 0 {
                        first = edge;
                    }
                    warehouse += 1;
                }
            }
            if warehouse > 0 {
                self.targets.clear();
                for &edge in &self.own {
                    let target = design.edges[edge as usize].to as usize;
                    if design.nodes[target].type_code as usize == component::WAREHOUSE
                        && !design.nodes[target].down
                    {
                        self.targets.push(edge);
                    }
                }
                let _ = first;
                return self.targets.len();
            }
        }
        // A Node built for the kind takes it from one that only falls back to it.
        self.targets.clear();
        if self.own.is_empty() {
            self.targets.extend_from_slice(usable);
        } else {
            self.targets.extend_from_slice(&self.own);
        }
        self.targets.len()
    }

    /// `splitFor`: the share of `kind` each Edge out of `node` takes. The answer
    /// is `self.pairs[..count]`.
    pub fn split(&mut self, design: &Design, node: usize, kind: usize, weights: &Weights, lb_algorithms: bool) -> usize {
        self.split_reading(design, node, kind, weights, lb_algorithms).0
    }

    /// `split`, and whether the answer read the Weights or only the Design.
    fn split_reading(
        &mut self,
        design: &Design,
        node: usize,
        kind: usize,
        weights: &Weights,
        lb_algorithms: bool,
    ) -> (usize, Read) {
        let Weights { live: weights, nominal, sick } = *weights;
        let source = design.nodes[node];
        if self.takers(design, node, kind) == 0 {
            self.pairs.clear();
            return (0, Read::Design);
        }
        // A drained Node is out of rotation at once, and a Replica no primary
        // ships to copies nothing, so neither takes a query.
        let mut filtered = false;
        for &edge in &self.targets {
            let target = &design.nodes[design.edges[edge as usize].to as usize];
            if target.draining || (target.replica && !target.has_primary) {
                filtered = true;
                break;
            }
        }
        if filtered {
            let mut kept = 0;
            for index in 0..self.targets.len() {
                let edge = self.targets[index];
                let target = &design.nodes[design.edges[edge as usize].to as usize];
                if !target.draining && (!target.replica || target.has_primary) {
                    self.targets[kept] = edge;
                    kept += 1;
                }
            }
            self.targets.truncate(kept);
        }
        if self.targets.is_empty() {
            self.pairs.clear();
            return (0, Read::Design);
        }
        // One way on takes everything.
        if self.targets.len() == 1 && source.type_code as usize != component::LB {
            let edge = self.targets[0];
            self.pairs.clear();
            self.pairs.push((edge, 1.0));
            return (1, Read::Design);
        }
        // A Stream broadcasts a change to every consumer.
        if source.type_code as usize == component::LOG && kind == kind::CHANGE {
            self.pairs.clear();
            for &edge in &self.targets {
                self.pairs.push((edge, 1.0));
            }
            return (self.pairs.len(), Read::Design);
        }
        if source.type_code as usize == component::DNS {
            self.up.clear();
            if design.health_checked {
                for &edge in &self.targets {
                    if !noticed(design, design.edges[edge as usize].to as usize, source.ttl) {
                        self.up.push(edge);
                    }
                }
            }
            let live: &[u32] = if !design.health_checked || self.up.is_empty() {
                &self.targets
            } else {
                &self.up
            };
            let share = 1.0 / live.len() as f64;
            self.pairs.clear();
            for &edge in live {
                self.pairs.push((edge, share));
            }
            return (self.pairs.len(), Read::Design);
        }
        if source.type_code as usize != component::LB {
            let count = self.weighted(design, |design, edge| {
                weights[design.edges[edge as usize].to as usize]
            });
            return (count, Read::Weights);
        }
        // A Load Balancer notices a dead host at its next health check, and a
        // deep check also takes out servers whose database is down.
        self.up.clear();
        for &edge in &self.targets {
            if !noticed(design, design.edges[edge as usize].to as usize, source.check_every) {
                self.up.push(edge);
            }
        }
        let checked: &[u32] = if self.up.is_empty() { &self.targets } else { &self.up };
        self.healthy.clear();
        if source.deep_check && design.health_checked {
            for &edge in checked {
                if !sick[design.edges[edge as usize].to as usize] {
                    self.healthy.push(edge);
                }
            }
        } else {
            self.healthy.extend_from_slice(checked);
        }
        if self.healthy.is_empty() {
            self.pairs.clear();
            return (0, Read::Weights);
        }
        let policy = if lb_algorithms || source.policy == 1 { source.policy } else { 0 };
        // The algorithm splits over `healthy`, so swap it in as the target set.
        std::mem::swap(&mut self.targets, &mut self.healthy);
        let count = match policy {
            1 => self.even(),
            0 => self.weighted(design, |design, edge| {
                nominal[design.edges[edge as usize].to as usize]
            }),
            2 => self.weighted(design, |design, edge| {
                let target = design.edges[edge as usize].to as usize;
                if design.nodes[target].down { nominal[target] } else { weights[target] }
            }),
            4 => self.even(),
            3 => {
                // Two choices: the live split blended towards an even spread.
                let spread = 1.0 / self.targets.len() as f64;
                self.raw.clear();
                let mut sum = 0.0;
                for &edge in &self.targets {
                    let target = design.edges[edge as usize].to as usize;
                    let weight = if design.nodes[target].down { nominal[target] } else { weights[target] };
                    let clamped = if weight.is_finite() { weight.max(1e-6) } else { 1e9 };
                    self.raw.push(clamped);
                    sum += clamped;
                }
                self.pairs.clear();
                for (index, &edge) in self.targets.iter().enumerate() {
                    self.pairs.push((
                        edge,
                        (1.0 - P2C_IMBALANCE) * (self.raw[index] / sum) + P2C_IMBALANCE * spread,
                    ));
                }
                self.pairs.len()
            }
            _ => self.weighted(design, |design, edge| {
                nominal[design.edges[edge as usize].to as usize]
            }),
        };
        // Sticky sessions keep the oldest target's share fixed. The algorithm's
        // shares are swapped into `base` so `pairs` can be rebuilt in place.
        if source.sticky {
            std::mem::swap(&mut self.base, &mut self.pairs);
            self.pairs.clear();
            let mut sum = 0.0;
            let mut weight = 1.0;
            for _ in 0..self.targets.len() {
                sum += weight;
                weight *= STICKY_DECAY;
            }
            weight = 1.0;
            for &edge in &self.targets {
                let algorithm = self
                    .base
                    .iter()
                    .find(|(each, _)| *each == edge)
                    .map(|(_, share)| *share)
                    .unwrap_or(0.0);
                self.pairs.push((
                    edge,
                    (1.0 - STICKY_SHARE) * algorithm + (STICKY_SHARE * weight) / sum,
                ));
                weight *= STICKY_DECAY;
            }
            return (self.pairs.len(), Read::Weights);
        }
        (count, Read::Weights)
    }
}

// ---- compiling a Design out of the ABI's blocks ----

/// Reads the cached Design. `None` when the host has not built one.
pub fn with_design<R>(read: impl FnOnce(&Design) -> R) -> Option<R> {
    CACHED.with(|cell| cell.borrow().as_ref().map(|(design, _)| read(design)))
}

thread_local! {
    /// The Design the host last handed over, so a later pass or a measurement
    /// does not rebuild it. One per thread, which is one per Worker.
    static CACHED: core::cell::RefCell<Option<(Design, Scratch)>> =
        const { core::cell::RefCell::new(None) };
}

/// Compiles the routing tables the host wrote into the ABI's blocks.
///
/// A row that names a Node outside the block is an error, not a panic: the
/// caller turns it into a status code the host can read.
pub fn compile(inputs: &crate::abi::Inputs) -> Result<Design, i32> {
    if !inputs.node_fields.len().is_multiple_of(crate::abi::NODE_FIELDS) || !inputs.edge_fields.len().is_multiple_of(crate::abi::EDGE_FIELDS) {
        return Err(crate::abi::SHORT_BLOCK);
    }
    let count = inputs.node_fields.len() / crate::abi::NODE_FIELDS;
    if count > u32::MAX as usize {
        return Err(crate::abi::TOO_LARGE);
    }
    let nodes: Vec<RouteNode> = inputs
        .node_fields
        .as_chunks::<{ crate::abi::NODE_FIELDS }>().0.iter()
        .map(|row| {
            let field = |index: usize| row.get(index).copied().unwrap_or(0.0);
            RouteNode {
                type_code: field(0) as u16,
                down: field(1) != 0.0,
                // `causeOf(life) === 'restart'`: a planned restart drains first, so routers see it at once.
                down_cause: if field(11) != 0.0 { 0 } else { 1 },
                down_at: field(10),
                sticky: field(2) != 0.0,
                policy: field(3) as u8,
                ttl: field(4),
                check_every: field(5),
                deep_check: field(6) != 0.0,
                replica: field(7) != 0.0,
                has_primary: field(8) != 0.0,
                draining: field(9) != 0.0,
            }
        })
        .collect();
    let mut edges: Vec<RouteEdge> = Vec::with_capacity(inputs.edge_fields.len() / crate::abi::EDGE_FIELDS);
    for row in inputs.edge_fields.as_chunks::<{ crate::abi::EDGE_FIELDS }>().0 {
        let field = |index: usize| row.get(index).copied().unwrap_or(0.0);
        let from = field(0) as u32;
        let to = field(1) as u32;
        if from as usize >= count || to as usize >= count {
            return Err(crate::abi::BAD_EDGE);
        }
        edges.push(RouteEdge {
            from,
            to,
            kinds: field(2) as u64,
            retry: field(3) as u8,
            timeout: field(4),
            open: field(5) != 0.0,
            bulkhead: field(6) != 0.0,
            hedge: field(7) != 0.0,
            failure: field(8),
            egress: field(9) as u8,
        });
    }
    if inputs.out_starts.len() < count + 1 {
        return Err(crate::abi::SHORT_BLOCK);
    }
    let starts: Vec<u32> = inputs
        .out_starts
        .iter()
        .take(count + 1)
        .map(|&value| value.max(0) as u32)
        .collect();
    let total = starts.get(count).copied().unwrap_or(0) as usize;
    if inputs.out_edges.len() < total {
        return Err(crate::abi::SHORT_BLOCK);
    }
    let adjacency: Vec<u32> = inputs.out_edges.iter().take(total).map(|&edge| edge.max(0) as u32).collect();
    if let Some(&edge) = adjacency.iter().find(|&&edge| edge as usize >= edges.len()) {
        let _ = edge;
        return Err(crate::abi::BAD_EDGE);
    }
    Ok(Design::new(nodes, edges, adjacency, starts, false, 0.0))
}

/// Compiles a Design once; `split_all` then answers every split from it.
#[no_mangle]
pub extern "C" fn design_set(health_checked: f64, time: f64) -> i32 {
    let compiled = crate::abi::with_inputs(compile);
    match compiled {
        Ok(design) => {
            let design = Design { health_checked: health_checked != 0.0, time, ..design };
            CACHED.with(|cell| *cell.borrow_mut() = Some((design, Scratch::default())));
            crate::abi::OK
        }
        Err(status) => status,
    }
}

/// Every (Node, kind) split, as fixed slots: a count, then up to `MAX_SPLIT`
/// pairs of (Edge index, share).
#[no_mangle]
pub extern "C" fn split_all(lb_algorithms: f64) -> i32 {
    crate::abi::with_inputs(|inputs| {
        let sick: Vec<bool> = inputs.sick.iter().map(|&byte| byte != 0).collect();
        let weights = Weights { live: &inputs.weights, nominal: &inputs.nominal, sick: &sick };
        CACHED.with(|cell| {
            let mut guard = cell.borrow_mut();
            let Some((design, scratch)) = guard.as_mut() else {
                return crate::abi::NO_DESIGN;
            };
            crate::abi::with_outputs(|outputs| {
                let stride = 1 + 2 * MAX_SPLIT;
                let count = design.nodes.len();
                if outputs.splits.len() < count * NK * stride {
                    return crate::abi::SHORT_BLOCK;
                }
                for node in 0..count {
                    for kind in 0..NK {
                        let found =
                            scratch.split(design, node, kind, &weights, lb_algorithms != 0.0);
                        let base = (node * NK + kind) * stride;
                        outputs.splits[base] = found as f64;
                        for (index, (edge, share)) in scratch.pairs().iter().take(MAX_SPLIT).enumerate() {
                            outputs.splits[base + 1 + index * 2] = *edge as f64;
                            outputs.splits[base + 2 + index * 2] = *share;
                        }
                    }
                }
                crate::abi::OK
            })
        })
    })
}

impl Scratch {
    /// The answer for the split just computed.
    #[inline]
    pub fn pairs(&self) -> &[(u32, f64)] {
        &self.pairs
    }
}

#[no_mangle]
pub extern "C" fn split_stride() -> i32 {
    (1 + 2 * MAX_SPLIT) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    fn node(type_code: usize) -> RouteNode {
        RouteNode {
            type_code: type_code as u16,
            down: false,
            down_cause: 1,
            down_at: 0.0,
            sticky: false,
            policy: 0,
            ttl: 300.0,
            check_every: 10.0,
            deep_check: false,
            replica: false,
            has_primary: false,
            draining: false,
        }
    }

    #[test]
    fn users_sends_every_request_kind_to_its_load_balancer() {
        // users(0) -> lb(1)
        let design = Design::new(
            vec![node(component::USERS), node(component::LB)],
            vec![RouteEdge { from: 0, to: 1, kinds: u64::MAX, retry: 0, timeout: 30_000.0, open: false, bulkhead: false, hedge: false, failure: 0.0, egress: 0 }],
            vec![0],
            vec![0, 1, 1],
            false,
            0.0,
        );
        let weights = Weights { live: &[1.0, 1.0], nominal: &[1.0, 1.0], sick: &[false, false] };
        let mut scratch = Scratch::default();
        for (kind, name) in KINDS.iter().enumerate().take(NR) {
            let count = scratch.split(&design, 0, kind, &weights, false);
            assert_eq!(count, 1, "kind {kind} ({name}) had {count} targets");
            assert_eq!(scratch.pairs()[0].0, 0);
            assert_eq!(scratch.pairs()[0].1, 1.0);
        }
    }
}
