use crate::catalog::*;

const DOWN_CAUSE_RESTART: u8 = 0;
const DOWN_CAUSE_FAILURE: u8 = 1;

const RETRY_NAIVE: u8 = 1;
const RETRY_BACKOFF: u8 = 2;

const LB_WEIGHTED: u8 = 0;
const LB_ROUND_ROBIN: u8 = 1;
const LB_LEAST_CONNECTIONS: u8 = 2;
const LB_POWER_OF_TWO_CHOICES: u8 = 3;
const LB_HASH: u8 = 4;

const WEIGHT_FLOOR: f64 = 1e-6;
const WEIGHT_WHEN_NOT_FINITE: f64 = 1e9;

const NODE_SLOT_TYPE: usize = 0;
const NODE_SLOT_DOWN: usize = 1;
const NODE_SLOT_STICKY: usize = 2;
const NODE_SLOT_POLICY: usize = 3;
const NODE_SLOT_TTL: usize = 4;
const NODE_SLOT_CHECK_EVERY: usize = 5;
const NODE_SLOT_DEEP_CHECK: usize = 6;
const NODE_SLOT_REPLICA: usize = 7;
const NODE_SLOT_HAS_PRIMARY: usize = 8;
const NODE_SLOT_DRAINING: usize = 9;
const NODE_SLOT_DOWN_AT: usize = 10;
const NODE_SLOT_RESTARTING: usize = 11;

const EDGE_SLOT_FROM: usize = 0;
const EDGE_SLOT_TO: usize = 1;
const EDGE_SLOT_KINDS: usize = 2;
const EDGE_SLOT_RETRY: usize = 3;
const EDGE_SLOT_TIMEOUT: usize = 4;
const EDGE_SLOT_OPEN: usize = 5;
const EDGE_SLOT_BULKHEAD: usize = 6;
const EDGE_SLOT_HEDGE: usize = 7;
const EDGE_SLOT_FAILURE: usize = 8;
const EDGE_SLOT_EGRESS: usize = 9;

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

#[derive(Clone, Copy)]
pub struct RouteEdge {
    pub from: u32,
    pub to: u32,

    pub kinds: u64,
    pub retry: u8,
    pub timeout: f64,
    pub open: bool,
    pub bulkhead: bool,
    pub hedge: bool,

    pub failure: f64,

    pub egress: u8,
}

#[derive(Clone)]
pub struct Design {
    pub nodes: Vec<RouteNode>,
    pub edges: Vec<RouteEdge>,

    pub order: Vec<usize>,
    out_starts: Vec<u32>,
    out_edges: Vec<u32>,

    mirror_starts: Vec<u32>,
    mirror_edges: Vec<u32>,
    pub health_checked: bool,
    pub time: f64,

    generation: u64,
}

static GENERATIONS: core::sync::atomic::AtomicU64 = core::sync::atomic::AtomicU64::new(1);

impl Design {
    #[inline]
    pub fn out_start(&self, node: usize) -> usize {
        self.out_starts.get(node).copied().unwrap_or(0) as usize
    }

    #[inline]
    pub fn out_end(&self, node: usize) -> usize {
        self.out_starts.get(node + 1).copied().unwrap_or(0) as usize
    }

    #[inline]
    pub fn out_edges_of(&self, node: usize) -> &[u32] {
        let start = self.out_start(node);
        let end = self.out_end(node).max(start);
        self.out_edges.get(start..end).unwrap_or(&[])
    }

    #[inline]
    pub fn mirror_edges_of(&self, node: usize) -> &[u32] {
        let start = self.mirror_starts.get(node).copied().unwrap_or(0) as usize;
        let end = self.mirror_starts.get(node + 1).copied().unwrap_or(0) as usize;
        self.mirror_edges.get(start..end.max(start)).unwrap_or(&[])
    }

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
        let count = nodes.len();
        let mut mirror_starts = vec![0u32; count + 1];
        let into_cdc =
            |edge: &RouteEdge| nodes[edge.to as usize].type_code as usize == component::CDC;
        for edge in edges.iter().filter(|edge| into_cdc(edge)) {
            mirror_starts[edge.from as usize + 1] += 1;
        }
        for node in 0..count {
            mirror_starts[node + 1] += mirror_starts[node];
        }
        let mut mirror_edges = vec![0u32; mirror_starts[count] as usize];
        let mut filled = mirror_starts.clone();
        for (index, edge) in edges.iter().enumerate() {
            if into_cdc(edge) {
                let at = &mut filled[edge.from as usize];
                mirror_edges[*at as usize] = index as u32;
                *at += 1;
            }
        }

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
            let mirrors =
                &mirror_edges[mirror_starts[node] as usize..mirror_starts[node + 1] as usize];
            for &edge in out_edges[start..end].iter().chain(mirrors) {
                let target = edges[edge as usize].to as usize;
                indegree[target] -= 1;
                if indegree[target] == 0 {
                    queue.push(target);
                }
            }
        }

        for straggler in 0..count {
            if !order.contains(&straggler) {
                order.push(straggler);
            }
        }
        let generation = GENERATIONS.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
        Design {
            nodes,
            edges,
            order,
            out_starts,
            out_edges,
            mirror_starts,
            mirror_edges,
            health_checked,
            time,
            generation,
        }
    }
}

#[inline]
pub fn amplification(policy: &RouteEdge, failure: f64) -> f64 {
    if policy.open {
        return 0.0;
    }
    match policy.retry {
        RETRY_NAIVE => crate::dist::attempts_for(failure),
        RETRY_BACKOFF => {
            1.0 + crate::dist::RETRY_BUDGET.min(crate::dist::attempts_for(failure) - 1.0)
        }
        _ => 1.0,
    }
}

#[derive(Clone, Copy)]
pub struct Weights<'a> {
    pub live: &'a [f64],
    pub nominal: &'a [f64],
    pub sick: &'a [bool],
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Read {
    Unsplit,

    Design,

    Weights,
}

#[derive(Default)]
pub struct Splits {
    scratch: Scratch,

    design_generation: u64,
    read_of: Vec<Read>,

    pair_start: Vec<u32>,
    pair_count: Vec<u32>,
    pairs: Vec<(u32, f64)>,

    compacted_pairs: Vec<(u32, f64)>,
}

impl Splits {
    pub fn reset(&mut self, design: &Design) {
        let keys = design.nodes.len() * NK;
        if self.design_generation != design.generation || self.read_of.len() != keys {
            self.design_generation = design.generation;
            let nodes = design.nodes.len();
            self.read_of.clear();
            self.read_of.resize(nodes * NK, Read::Unsplit);
            self.pair_start.clear();
            self.pair_start.resize(nodes * NK, 0);
            self.pair_count.clear();
            self.pair_count.resize(nodes * NK, 0);
            self.pairs.clear();
            return;
        }
        self.compacted_pairs.clear();
        for key in 0..self.read_of.len() {
            match self.read_of[key] {
                Read::Design => {
                    let start = self.pair_start[key] as usize;
                    let end = start + self.pair_count[key] as usize;
                    self.pair_start[key] = self.compacted_pairs.len() as u32;
                    self.compacted_pairs
                        .extend_from_slice(&self.pairs[start..end]);
                }
                Read::Weights => self.read_of[key] = Read::Unsplit,
                Read::Unsplit => {}
            }
        }
        core::mem::swap(&mut self.pairs, &mut self.compacted_pairs);
    }

    #[inline]
    pub fn range(
        &mut self,
        design: &Design,
        node: usize,
        kind: usize,
        weights: &Weights,
    ) -> core::ops::Range<usize> {
        let key = node * NK + kind;
        let start = match self.read_of.get(key) {
            Some(Read::Unsplit) => {
                let start = self.pairs.len();
                let (count, read) = self
                    .scratch
                    .split_reading(design, node, kind, weights, false);
                self.pairs.extend_from_slice(&self.scratch.pairs[..count]);
                self.read_of[key] = read;
                self.pair_start[key] = start as u32;
                self.pair_count[key] = count as u32;
                start
            }
            Some(_) => self.pair_start[key] as usize,

            None => return 0..0,
        };
        start..start + self.pair_count[key] as usize
    }

    #[inline]
    pub fn get(
        &mut self,
        design: &Design,
        node: usize,
        kind: usize,
        weights: &Weights,
    ) -> &[(u32, f64)] {
        let range = self.range(design, node, kind, weights);
        &self.pairs[range]
    }

    #[inline]
    pub fn pair(&self, index: usize) -> (u32, f64) {
        self.pairs[index]
    }
}

#[derive(Default)]
pub struct Scratch {
    accepting_edges: Vec<u32>,

    edges_with_way_on: Vec<u32>,

    edges_built_for_kind: Vec<u32>,

    edges_not_noticed_down: Vec<u32>,

    healthy: Vec<u32>,

    targets: Vec<u32>,

    algorithm_shares: Vec<(u32, f64)>,

    pairs: Vec<(u32, f64)>,

    clamped_weights: Vec<f64>,
}

#[inline]
pub fn accepts(type_code: usize, kind: usize) -> bool {
    (COMPONENT_ACCEPTS[type_code] >> kind) & 1 == 1
}

#[inline]
fn carries(edge: &RouteEdge, source: &RouteNode, kind: usize) -> bool {
    let routes_every_kind = source.type_code as usize != component::GW;
    let names_kind = (edge.kinds >> kind) & 1 == 1;
    routes_every_kind || names_kind
}

#[inline]
fn noticed(design: &Design, child: usize, after_secs: f64) -> bool {
    let node = &design.nodes[child];
    node.down && (node.down_cause == DOWN_CAUSE_RESTART || design.time - node.down_at >= after_secs)
}

impl Scratch {
    #[inline]
    fn weighted(&mut self, design: &Design, weight_of: impl Fn(&Design, u32) -> f64) -> usize {
        self.clamped_weights.clear();
        let mut sum = 0.0;
        for &edge in &self.targets {
            let weight = weight_of(design, edge);
            let clamped = if weight.is_finite() {
                weight.max(WEIGHT_FLOOR)
            } else {
                WEIGHT_WHEN_NOT_FINITE
            };
            self.clamped_weights.push(clamped);
            sum += clamped;
        }
        self.pairs.clear();
        for (index, &edge) in self.targets.iter().enumerate() {
            let share = self.clamped_weights[index] / sum;
            self.pairs.push((edge, share));
        }
        self.pairs.len()
    }

    #[inline]
    fn even(&mut self) -> usize {
        let share = 1.0 / self.targets.len() as f64;
        self.pairs.clear();
        for &edge in &self.targets {
            self.pairs.push((edge, share));
        }
        self.pairs.len()
    }

    fn takers(&mut self, design: &Design, node: usize, kind: usize) -> usize {
        let source = design.nodes[node];
        self.accepting_edges.clear();
        for &edge in design.out(node) {
            let target = design.nodes[design.edges[edge as usize].to as usize];
            if accepts(target.type_code as usize, kind)
                && carries(&design.edges[edge as usize], &source, kind)
            {
                self.accepting_edges.push(edge);
            }
        }
        self.edges_with_way_on.clear();
        let is_data = (DATA_KINDS_MASK >> kind) & 1 == 1;
        for &edge in &self.accepting_edges {
            let target_index = design.edges[edge as usize].to as usize;
            let target = design.nodes[target_index];
            let type_code = target.type_code as usize;
            let only_falls_back_to_next_hop = type_code == component::CACHE
                || type_code == component::POOLER
                || type_code == component::LB;
            if !only_falls_back_to_next_hop
                || !is_data
                || design.out(target_index).iter().any(|&next| {
                    accepts(
                        design.nodes[design.edges[next as usize].to as usize].type_code as usize,
                        kind,
                    )
                })
            {
                self.edges_with_way_on.push(edge);
            }
        }
        let usable_edges: &[u32] = if self.edges_with_way_on.is_empty() {
            &self.accepting_edges
        } else {
            &self.edges_with_way_on
        };
        self.edges_built_for_kind.clear();
        for &edge in usable_edges {
            let target_type =
                design.nodes[design.edges[edge as usize].to as usize].type_code as usize;
            if (COMPONENT_FALLBACK[target_type] >> kind) & 1 == 0 {
                self.edges_built_for_kind.push(edge);
            }
        }

        if kind == kind::Q_SCAN {
            let leads_to_live_warehouse = |edge: u32| {
                let target = design.edges[edge as usize].to as usize;
                design.nodes[target].type_code as usize == component::WAREHOUSE
                    && !design.nodes[target].down
            };
            let mut warehouse = 0;
            for &edge in &self.edges_built_for_kind {
                if leads_to_live_warehouse(edge) {
                    warehouse += 1;
                }
            }
            if warehouse > 0 {
                self.targets.clear();
                for &edge in &self.edges_built_for_kind {
                    if leads_to_live_warehouse(edge) {
                        self.targets.push(edge);
                    }
                }
                return self.targets.len();
            }
        }

        self.targets.clear();
        if self.edges_built_for_kind.is_empty() {
            self.targets.extend_from_slice(usable_edges);
        } else {
            self.targets.extend_from_slice(&self.edges_built_for_kind);
        }
        self.targets.len()
    }

    pub fn split(
        &mut self,
        design: &Design,
        node: usize,
        kind: usize,
        weights: &Weights,
        lb_algorithms: bool,
    ) -> usize {
        self.split_reading(design, node, kind, weights, lb_algorithms)
            .0
    }

    fn split_reading(
        &mut self,
        design: &Design,
        node: usize,
        kind: usize,
        weights: &Weights,
        lb_algorithms: bool,
    ) -> (usize, Read) {
        let Weights {
            live: weights,
            nominal,
            sick,
        } = *weights;
        let source = design.nodes[node];
        if self.takers(design, node, kind) == 0 {
            self.pairs.clear();
            return (0, Read::Design);
        }

        let mut any_out_of_rotation = false;
        for &edge in &self.targets {
            let target = &design.nodes[design.edges[edge as usize].to as usize];
            let out_of_rotation = target.draining || (target.replica && !target.has_primary);
            if out_of_rotation {
                any_out_of_rotation = true;
                break;
            }
        }
        if any_out_of_rotation {
            let mut kept = 0;
            for index in 0..self.targets.len() {
                let edge = self.targets[index];
                let target = &design.nodes[design.edges[edge as usize].to as usize];
                let in_rotation = !target.draining && (!target.replica || target.has_primary);
                if in_rotation {
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

        if self.targets.len() == 1 && source.type_code as usize != component::LB {
            let edge = self.targets[0];
            self.pairs.clear();
            self.pairs.push((edge, 1.0));
            return (1, Read::Design);
        }

        if source.type_code as usize == component::LOG && kind == kind::CHANGE {
            self.pairs.clear();
            for &edge in &self.targets {
                self.pairs.push((edge, 1.0));
            }
            return (self.pairs.len(), Read::Design);
        }
        if source.type_code as usize == component::DNS {
            self.edges_not_noticed_down.clear();
            if design.health_checked {
                for &edge in &self.targets {
                    if !noticed(design, design.edges[edge as usize].to as usize, source.ttl) {
                        self.edges_not_noticed_down.push(edge);
                    }
                }
            }
            let live: &[u32] = if !design.health_checked || self.edges_not_noticed_down.is_empty() {
                &self.targets
            } else {
                &self.edges_not_noticed_down
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

        self.edges_not_noticed_down.clear();
        for &edge in &self.targets {
            if !noticed(
                design,
                design.edges[edge as usize].to as usize,
                source.check_every,
            ) {
                self.edges_not_noticed_down.push(edge);
            }
        }
        let checked: &[u32] = if self.edges_not_noticed_down.is_empty() {
            &self.targets
        } else {
            &self.edges_not_noticed_down
        };
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
        let algorithm_unlocked = lb_algorithms || source.policy == LB_ROUND_ROBIN;
        let policy = if algorithm_unlocked {
            source.policy
        } else {
            LB_WEIGHTED
        };

        std::mem::swap(&mut self.targets, &mut self.healthy);
        let count = match policy {
            LB_ROUND_ROBIN => self.even(),
            LB_WEIGHTED => self.weighted(design, |design, edge| {
                nominal[design.edges[edge as usize].to as usize]
            }),
            LB_LEAST_CONNECTIONS => self.weighted(design, |design, edge| {
                let target = design.edges[edge as usize].to as usize;
                if design.nodes[target].down {
                    nominal[target]
                } else {
                    weights[target]
                }
            }),
            LB_HASH => self.even(),
            LB_POWER_OF_TWO_CHOICES => {
                let even_share = 1.0 / self.targets.len() as f64;
                self.clamped_weights.clear();
                let mut sum = 0.0;
                for &edge in &self.targets {
                    let target = design.edges[edge as usize].to as usize;
                    let weight = if design.nodes[target].down {
                        nominal[target]
                    } else {
                        weights[target]
                    };
                    let clamped = if weight.is_finite() {
                        weight.max(WEIGHT_FLOOR)
                    } else {
                        WEIGHT_WHEN_NOT_FINITE
                    };
                    self.clamped_weights.push(clamped);
                    sum += clamped;
                }
                self.pairs.clear();
                for (index, &edge) in self.targets.iter().enumerate() {
                    self.pairs.push((
                        edge,
                        (1.0 - P2C_IMBALANCE) * (self.clamped_weights[index] / sum)
                            + P2C_IMBALANCE * even_share,
                    ));
                }
                self.pairs.len()
            }
            _ => self.weighted(design, |design, edge| {
                nominal[design.edges[edge as usize].to as usize]
            }),
        };

        if source.sticky {
            std::mem::swap(&mut self.algorithm_shares, &mut self.pairs);
            self.pairs.clear();
            let mut rank_weight_sum = 0.0;
            let mut rank_weight = 1.0;
            for _ in 0..self.targets.len() {
                rank_weight_sum += rank_weight;
                rank_weight *= STICKY_DECAY;
            }
            rank_weight = 1.0;
            for &edge in &self.targets {
                let algorithm = self
                    .algorithm_shares
                    .iter()
                    .find(|(each, _)| *each == edge)
                    .map(|(_, share)| *share)
                    .unwrap_or(0.0);
                self.pairs.push((
                    edge,
                    (1.0 - STICKY_SHARE) * algorithm
                        + (STICKY_SHARE * rank_weight) / rank_weight_sum,
                ));
                rank_weight *= STICKY_DECAY;
            }
            return (self.pairs.len(), Read::Weights);
        }
        (count, Read::Weights)
    }
}

pub fn with_design<R>(read: impl FnOnce(&Design) -> R) -> Option<R> {
    CACHED.with(|cell| cell.borrow().as_ref().map(|(design, _)| read(design)))
}

thread_local! {

    static CACHED: core::cell::RefCell<Option<(Design, Scratch)>> =
        const { core::cell::RefCell::new(None) };
}

pub fn compile(inputs: &crate::abi::Inputs) -> Result<Design, i32> {
    if !inputs
        .node_fields
        .len()
        .is_multiple_of(crate::abi::NODE_FIELDS)
        || !inputs
            .edge_fields
            .len()
            .is_multiple_of(crate::abi::EDGE_FIELDS)
    {
        return Err(crate::abi::SHORT_BLOCK);
    }
    let count = inputs.node_fields.len() / crate::abi::NODE_FIELDS;
    if count > u32::MAX as usize {
        return Err(crate::abi::TOO_LARGE);
    }
    let nodes: Vec<RouteNode> = inputs
        .node_fields
        .as_chunks::<{ crate::abi::NODE_FIELDS }>()
        .0
        .iter()
        .map(|row| {
            let field = |index: usize| row.get(index).copied().unwrap_or(0.0);
            RouteNode {
                type_code: field(NODE_SLOT_TYPE) as u16,
                down: field(NODE_SLOT_DOWN) != 0.0,

                down_cause: if field(NODE_SLOT_RESTARTING) != 0.0 {
                    DOWN_CAUSE_RESTART
                } else {
                    DOWN_CAUSE_FAILURE
                },
                down_at: field(NODE_SLOT_DOWN_AT),
                sticky: field(NODE_SLOT_STICKY) != 0.0,
                policy: field(NODE_SLOT_POLICY) as u8,
                ttl: field(NODE_SLOT_TTL),
                check_every: field(NODE_SLOT_CHECK_EVERY),
                deep_check: field(NODE_SLOT_DEEP_CHECK) != 0.0,
                replica: field(NODE_SLOT_REPLICA) != 0.0,
                has_primary: field(NODE_SLOT_HAS_PRIMARY) != 0.0,
                draining: field(NODE_SLOT_DRAINING) != 0.0,
            }
        })
        .collect();
    let mut edges: Vec<RouteEdge> =
        Vec::with_capacity(inputs.edge_fields.len() / crate::abi::EDGE_FIELDS);
    for row in inputs
        .edge_fields
        .as_chunks::<{ crate::abi::EDGE_FIELDS }>()
        .0
    {
        let field = |index: usize| row.get(index).copied().unwrap_or(0.0);
        let from = field(EDGE_SLOT_FROM) as u32;
        let to = field(EDGE_SLOT_TO) as u32;
        if from as usize >= count || to as usize >= count {
            return Err(crate::abi::BAD_EDGE);
        }
        edges.push(RouteEdge {
            from,
            to,
            kinds: field(EDGE_SLOT_KINDS) as u64,
            retry: field(EDGE_SLOT_RETRY) as u8,
            timeout: field(EDGE_SLOT_TIMEOUT),
            open: field(EDGE_SLOT_OPEN) != 0.0,
            bulkhead: field(EDGE_SLOT_BULKHEAD) != 0.0,
            hedge: field(EDGE_SLOT_HEDGE) != 0.0,
            failure: field(EDGE_SLOT_FAILURE),
            egress: field(EDGE_SLOT_EGRESS) as u8,
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
    let adjacency: Vec<u32> = inputs
        .out_edges
        .iter()
        .take(total)
        .map(|&edge| edge.max(0) as u32)
        .collect();
    if let Some(&edge) = adjacency.iter().find(|&&edge| edge as usize >= edges.len()) {
        let _ = edge;
        return Err(crate::abi::BAD_EDGE);
    }
    Ok(Design::new(nodes, edges, adjacency, starts, false, 0.0))
}

#[no_mangle]
pub extern "C" fn design_set(health_checked: f64, time: f64) -> i32 {
    let compiled = crate::abi::with_inputs(compile);
    match compiled {
        Ok(design) => {
            let design = Design {
                health_checked: health_checked != 0.0,
                time,
                ..design
            };
            CACHED.with(|cell| *cell.borrow_mut() = Some((design, Scratch::default())));
            crate::abi::OK
        }
        Err(status) => status,
    }
}

#[no_mangle]
pub extern "C" fn design_touch(health_checked: f64, time: f64) -> i32 {
    CACHED.with(|cell| match cell.borrow_mut().as_mut() {
        Some((design, _)) => {
            design.health_checked = health_checked != 0.0;
            design.time = time;
            design.generation = GENERATIONS.fetch_add(1, core::sync::atomic::Ordering::Relaxed);
            crate::abi::OK
        }
        None => crate::abi::NO_DESIGN,
    })
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
        let design = Design::new(
            vec![node(component::USERS), node(component::LB)],
            vec![RouteEdge {
                from: 0,
                to: 1,
                kinds: u64::MAX,
                retry: 0,
                timeout: 30_000.0,
                open: false,
                bulkhead: false,
                hedge: false,
                failure: 0.0,
                egress: 0,
            }],
            vec![0],
            vec![0, 1, 1],
            false,
            0.0,
        );
        let weights = Weights {
            live: &[1.0, 1.0],
            nominal: &[1.0, 1.0],
            sick: &[false, false],
        };
        let mut scratch = Scratch::default();
        for (kind, name) in KINDS.iter().enumerate().take(NR) {
            let count = scratch.split(&design, 0, kind, &weights, false);
            assert_eq!(count, 1, "kind {kind} ({name}) had {count} targets");
            assert_eq!(scratch.pairs[0].0, 0);
            assert_eq!(scratch.pairs[0].1, 1.0);
        }
    }
}
