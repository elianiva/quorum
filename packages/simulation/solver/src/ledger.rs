use crate::catalog::*;
use crate::dist::*;
use crate::model::{GameCtx, Limit, Order, Rates, Resources, WorkUnit};
use crate::outcomes::Tree;
use crate::pass::Pass;

const DANGER_UTILIZATION: f64 = 0.9;
const WARN_UTILIZATION: f64 = 0.7;
const BUSY_UTILIZATION: f64 = 0.6;
const BUSIEST_NODE_COUNT: usize = 3;
const LIMIT_CONNECTIONS: usize = Limit::Disk as usize + 1;
const NO_INDEX: usize = usize::MAX;
const NO_TRAFFIC_YET: f64 = -1.0;
const MS_PER_SECOND: f64 = 1000.0;
const KB_PER_GB: f64 = 1_000_000.0;
const MEDIAN: f64 = 0.5;
const P95: f64 = 0.95;
const P99: f64 = 0.99;
const FAILING_MAX_SUCCESS: f64 = 0.05;
const FAILING_MIN_STRANDED: f64 = 0.5;
const LINK_FAILING_MIN_DROPPED_SHARE: f64 = 0.01;
const ANALYTICS_CAPACITY_GROWTH_PER_SIZE: f64 = 2.0;
const TAIL_SAMPLING_FAILURE_MULTIPLIER: f64 = 2.0;

#[inline]
fn has_kind(mask: u64, kind: usize) -> bool {
    (mask >> kind) & 1 == 1
}

#[derive(Clone, Copy, Default)]
pub struct Route {
    pub region: usize,

    pub source: Option<usize>,
    pub share: f64,

    pub extra_ms: f64,
}

#[derive(Default)]
pub struct Completions {
    pub enqueued: Vec<f64>,
    pub scored: Vec<f64>,
    pub waits: Vec<f64>,
}

#[derive(Clone, Copy, Default)]
pub struct KindRow {
    pub rate: f64,
    pub success: f64,
    pub apdex: f64,

    pub completion: Option<f64>,
    pub mean: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

#[derive(Clone, Copy, Default, PartialEq, Eq)]
pub enum Status {
    #[default]
    Idle,
    Ok,
    Warn,
    Danger,
    Down,
}

pub fn status_of(down: bool, inbound: f64, utilization: f64, trouble: bool) -> Status {
    if down {
        Status::Down
    } else if inbound <= 0.0 {
        Status::Idle
    } else if utilization >= DANGER_UTILIZATION {
        Status::Danger
    } else if utilization >= WARN_UTILIZATION || trouble {
        Status::Warn
    } else {
        Status::Ok
    }
}

#[derive(Clone, Copy)]
pub struct Keyed {
    pub values: Rates,
    pub keys: Order,
}

impl Default for Keyed {
    fn default() -> Self {
        Keyed {
            values: [0.0; NK],
            keys: Order::default(),
        }
    }
}

impl Keyed {
    #[inline]
    pub fn add(&mut self, kind: usize, value: f64) {
        self.values[kind] += value;
        self.keys.push(kind);
    }

    #[inline]
    pub fn set(&mut self, kind: usize, value: f64) {
        self.values[kind] = value;
        self.keys.push(kind);
    }

    pub fn entries(&self) -> impl Iterator<Item = (usize, f64)> + '_ {
        self.keys.iter().map(|kind| (kind, self.values[kind]))
    }
}

#[derive(Clone, Copy)]
pub struct RegionKindRow {
    pub rate: f64,
    pub success: f64,
    pub apdex: f64,
    pub near: f64,
    pub fail: [f64; CAUSE_COUNT],
    pub hop_ms: f64,
    pub p99: f64,
}

#[derive(Clone, Default)]
pub struct NodeRow {
    pub inbound: f64,
    pub traffic: Keyed,
    pub capacity: f64,
    pub utilization: f64,
    pub limit: usize,
    pub latency: f64,
    pub p99: f64,
    pub hop_by_kind: Keyed,
    pub wait_by_kind: Keyed,
    pub work_share: Keyed,
    pub work_unit: Option<WorkUnit>,
    pub cost: f64,

    pub receipts: Vec<(usize, crate::model::Receipt)>,
    pub repeated: f64,
    pub origins: Keyed,
    pub dropped: f64,
    pub refused: f64,
    pub stranded: f64,
    pub stranded_kinds: Order,
    pub connections: Option<(f64, f64)>,
    pub hit_ratio: Option<f64>,
    pub evictions: Option<f64>,
    pub age: Option<f64>,
    pub lag_ms: Option<f64>,
    pub disk: bool,
    pub out: Keyed,
    pub resources: Resources,
    pub throttled: bool,
    pub swapping: bool,
    pub status: Status,
}

#[derive(Default)]
pub struct Ledger {
    pub kinds: Vec<KindRow>,
    pub nodes: Vec<NodeRow>,
    pub demand: f64,
    pub served: f64,
    pub errors: [f64; CAUSE_COUNT],
    pub error_share: f64,
    pub latency: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
    pub apdex: f64,
    pub revenue: f64,
    pub subscriptions_per_second: f64,
    pub fines: f64,
    pub revenue_by_kind: Vec<f64>,
    pub fines_by_kind: Vec<f64>,

    pub regions: Vec<(usize, f64)>,

    pub region_kinds: Vec<(usize, Vec<(usize, RegionKindRow)>)>,
    pub links: Vec<LinkRow>,
    pub bill: crate::bill::Bill,
    pub costs: crate::bill::Costs,
    pub velocity: f64,

    pub salaries: f64,
    pub game_shares: [f64; 4],

    pub insight: [f64; INSIGHT_POOLS.len()],

    pub breadth: Keyed,

    pub breadth_regions: Keyed,
    pub failing: Vec<usize>,

    pub bottleneck_by_kind: Vec<Option<usize>>,
    pub bottleneck: Option<usize>,
}

pub fn attempts_allowed(dlq: bool, attempts: f64) -> f64 {
    if dlq {
        attempts
    } else {
        FOREVER_ATTEMPTS
    }
}

pub fn sum_rates(rates: &Rates) -> f64 {
    rates.iter().sum()
}

pub fn database_sick(
    design: &crate::routing::Design,
    pass: &Pass,
    nodes: &[crate::model::Node],
    server: usize,
) -> bool {
    let mut seen = vec![false; nodes.len()];
    sick_visit(design, pass, nodes, server, &mut seen)
}

fn sick_visit(
    design: &crate::routing::Design,
    pass: &Pass,
    nodes: &[crate::model::Node],
    node: usize,
    seen: &mut [bool],
) -> bool {
    for &edge in design.out_edges_of(node) {
        let child = match design.edges.get(edge as usize) {
            Some(edge) => edge.to as usize,
            None => continue,
        };
        if seen.get(child).copied().unwrap_or(true) {
            continue;
        }
        let child_node = match nodes.get(child) {
            Some(child_node) => child_node,
            None => continue,
        };
        if !crate::routing::accepts(child_node.type_code, kind::Q_READ)
            && !crate::routing::accepts(child_node.type_code, kind::Q_WRITE)
        {
            continue;
        }
        seen[child] = true;
        if child_node.down {
            return true;
        }
        if (child_node.type_code == component::DATABASE
            || child_node.type_code == component::REPLICA)
            && pass
                .models
                .get(child)
                .map(|model| model.utilization)
                .unwrap_or(0.0)
                >= 1.0
        {
            return true;
        }
        if sick_visit(design, pass, nodes, child, seen) {
            return true;
        }
    }
    false
}

pub fn completions_of(pass: &Pass, nodes: &[crate::model::Node], tree: &mut Tree) -> Completions {
    let mut done = Completions {
        enqueued: vec![0.0; NR],
        scored: vec![0.0; NR],
        waits: vec![0.0; nodes.len()],
    };
    for (slot, node) in nodes.iter().enumerate() {
        if node.type_code != component::QUEUE {
            continue;
        }
        let drained = pass.drained.get(slot).copied().unwrap_or(0.0);
        let wait_seconds = if node.depth <= 0.0 {
            0.0
        } else if drained > 0.0 {
            node.depth / drained
        } else {
            f64::INFINITY
        };
        done.waits[slot] = wait_seconds;
        let tasks = pass.tasks.get(slot).copied().unwrap_or([0.0; NK]);
        if tasks.iter().all(|rate| *rate <= 0.0) || node.down {
            continue;
        }
        let worker = tree.downstream(slot, NR + backend::TASK, 0.0);

        let attempt_failure = (1.0 - worker.success - worker.fail[DROPPED]).clamp(0.0, 1.0);
        let allowed = attempts_allowed(node.dlq, node.attempts);
        let lost = task_lost(attempt_failure, allowed);
        let extra_attempts = task_attempts(attempt_failure, allowed) - 1.0;
        let completed = if !wait_seconds.is_finite() || worker.fail[STRANDED] >= 1.0 {
            failed(STRANDED)
        } else {
            let mut finished = worker.without_failures();
            finished.success = 1.0 - lost;
            finished.fixed_ms = worker.fixed_ms
                + (wait_seconds + extra_attempts * TASK_RETRY_SECONDS) * MS_PER_SECOND;
            finished.fail[UPSTREAM] = lost;
            finished
        };
        for kind in 0..NR {
            let target = PROFILE_COMPLETION[kind];
            let rate = tasks[kind];
            if target <= 0.0 || rate <= 0.0 {
                continue;
            }
            done.enqueued[kind] += rate;
            done.scored[kind] += rate * completed.success * apdex_of(&completed, target);
        }
    }
    done
}

pub fn answers_of(
    tree: &mut Tree,
    routes: &[Route],
    kind: usize,
) -> Vec<(Route, Outcome, Outcome)> {
    let mut answers = Vec::with_capacity(routes.len());
    for route in routes {
        let raw = match route.source {
            Some(source) => tree.outcome(source, kind),
            None => failed(STRANDED),
        };
        let extra_ms = user_hop_ms(tree.game(), route.extra_ms, kind) + regressed_ms(tree.game());
        let answer = if extra_ms > 0.0 {
            through_one(hop(extra_ms, 0.0), raw, false)
        } else {
            raw
        };
        answers.push((*route, answer, raw));
    }
    answers
}

pub fn answer_of(tree: &Tree, answers: &[(Route, Outcome, Outcome)], kind: usize) -> Outcome {
    if let [(route, answer, _)] = answers {
        if user_hop_ms(tree.game(), route.extra_ms, kind) + regressed_ms(tree.game()) == 0.0 {
            return *answer;
        }
    }
    let entries: Vec<(Outcome, f64)> = answers
        .iter()
        .map(|(route, answer, _)| (*answer, route.share))
        .collect();
    blend(&entries).unwrap_or_else(|| failed(STRANDED))
}

#[inline]
fn regressed_ms(game: &GameCtx) -> f64 {
    if game.incident == Some(crate::model::Incident::LatencyRegression) {
        LATENCY_REGRESSION_MS
    } else {
        0.0
    }
}

#[inline]
pub fn user_hop_ms(game: &GameCtx, ms: f64, kind: usize) -> f64 {
    if kind == kind::PAGE && game.has(research::HTTP2) {
        ms * (1.0 - HTTP2_CUT)
    } else {
        ms
    }
}

#[inline]
pub fn earns_in_time(game: &GameCtx, ms: f64) -> bool {
    let deadline = VENTURE_DEADLINE[game.venture.min(VENTURE_DEADLINE.len() - 1)];
    deadline < 0.0 || ms <= deadline
}

pub fn earned_of(game: &GameCtx, kind: usize, rate: f64, result: &Outcome, apdex: f64) -> f64 {
    let factor = game.value[kind];
    rate * result.success
        * apdex
        * KIND_VALUE[kind]
        * result.value
        * factor
        * if earns_in_time(game, mean_of(result)) {
            1.0
        } else {
            0.0
        }
}

pub struct KindScore {
    pub result: Outcome,

    pub answers: Vec<(Route, Outcome, Outcome)>,

    pub finish: f64,
    pub apdex: f64,
    pub completion: Option<f64>,
    pub earned: f64,
}

pub fn revenue_of(
    game: &GameCtx,
    demand: &Rates,
    pass: &Pass,
    nodes: &[crate::model::Node],
    tree: &mut Tree,
    routes: &[Route],
) -> f64 {
    let completion = completions_of(pass, nodes, tree);
    let mut revenue = 0.0;
    for kind in 0..NR {
        let rate = demand[kind];
        if rate <= 0.0 || !PROFILE_SCORED[kind] {
            continue;
        }
        let score = score_kind(game, tree, routes, &completion, kind, rate);
        revenue += score.earned;
    }
    revenue + game.subscriptions_per_second
}

pub fn score_kind(
    game: &GameCtx,
    tree: &mut Tree,
    routes: &[Route],
    completion: &Completions,
    kind: usize,
    rate: f64,
) -> KindScore {
    let answers = answers_of(tree, routes, kind);
    let result = answer_of(tree, &answers, kind);
    let enqueued = completion.enqueued[kind];
    let done = if enqueued > 0.0 {
        Some(completion.scored[kind] / enqueued)
    } else {
        None
    };
    let async_share = match done {
        None => 0.0,
        Some(_) if result.success <= 0.0 => 0.0,
        Some(_) => (enqueued / (rate * result.success)).min(1.0),
    };
    let finish = 1.0 - async_share + async_share * done.unwrap_or(1.0);
    let apdex = apdex_of(&result, PROFILE_APDEX[kind]) * finish;
    let earned = earned_of(game, kind, rate, &result, apdex);
    KindScore {
        result,
        answers,
        finish,
        apdex,
        completion: done,
        earned,
    }
}

pub fn ledger_of(setup: &crate::solve::Setup, pass: &Pass, tree: &mut Tree) -> Ledger {
    let crate::pass::Board {
        game,
        design,
        demand,
        nodes,
        ..
    } = setup.board;
    let routes = setup.routes;
    let completion = completions_of(pass, nodes, tree);
    let mut ledger = Ledger {
        kinds: vec![KindRow::default(); NR],
        nodes: vec![NodeRow::default(); nodes.len()],
        revenue_by_kind: vec![0.0; NR],
        fines_by_kind: vec![0.0; NR],
        bottleneck_by_kind: vec![None; NR],
        ..Ledger::default()
    };
    let mut mixture: Vec<(Outcome, f64)> = Vec::new();
    let mut rate_total = 0.0;
    let mut served = 0.0;
    let mut satisfied = 0.0;
    let mut latency_weight = 0.0;

    let mut region_sent_and_satisfied: Vec<(usize, f64, f64)> = Vec::new();
    for kind in 0..NR {
        let rate = demand[kind];
        if rate <= 0.0 {
            continue;
        }
        let score = score_kind(game, tree, routes, &completion, kind, rate);
        ledger.kinds[kind] = KindRow {
            rate,
            success: score.result.success,
            apdex: score.apdex,
            completion: score.completion,
            mean: mean_of(&score.result),
            p50: percentile(&score.result, MEDIAN),
            p95: percentile(&score.result, P95),
            p99: percentile(&score.result, P99),
        };

        if !PROFILE_SCORED[kind] {
            continue;
        }
        for (route, answer, raw) in &score.answers {
            let sent = rate * route.share;
            let own = apdex_of(answer, PROFILE_APDEX[kind]) * score.finish;
            let at = match region_sent_and_satisfied
                .iter()
                .position(|(region, _, _)| *region == route.region)
            {
                Some(at) => at,
                None => {
                    region_sent_and_satisfied.push((route.region, 0.0, 0.0));
                    region_sent_and_satisfied.len() - 1
                }
            };
            region_sent_and_satisfied[at].1 += sent;
            region_sent_and_satisfied[at].2 += sent * answer.success * own;
            let row = RegionKindRow {
                rate: sent,
                success: answer.success,
                apdex: own,
                near: apdex_of(raw, PROFILE_APDEX[kind]) * score.finish,
                fail: answer.fail,
                hop_ms: user_hop_ms(game, route.extra_ms, kind),
                p99: percentile(answer, P99),
            };
            let rows = match ledger
                .region_kinds
                .iter_mut()
                .find(|(region, _)| *region == route.region)
            {
                Some((_, rows)) => rows,
                None => {
                    ledger.region_kinds.push((route.region, Vec::new()));
                    &mut ledger.region_kinds.last_mut().expect("just pushed").1
                }
            };
            match rows.iter_mut().find(|(at, _)| *at == kind) {
                Some((_, entry)) => *entry = row,
                None => rows.push((kind, row)),
            }
        }
        rate_total += rate;
        served += rate * score.result.success;
        satisfied += rate * score.result.success * score.apdex;
        latency_weight += rate * score.result.success * mean_of(&score.result);
        ledger.revenue += score.earned;
        if score.earned > 0.0 {
            ledger.revenue_by_kind[kind] = score.earned;
        }
        for cause in 0..CAUSE_COUNT {
            ledger.errors[cause] += rate * score.result.fail[cause];
        }

        if !game.sandbox && has_kind(MONEY_KINDS_MASK, kind) {
            let fine = rate
                * score.result.fail[STALE]
                * KIND_VALUE[kind]
                * VENTURE_STALE_FINE[game.venture.min(VENTURE_STALE_FINE.len() - 1)];
            if fine > 0.0 {
                ledger.fines += fine;
                ledger.fines_by_kind[kind] = fine;
            }
        }
        if score.result.success > 0.0 {
            mixture.push((score.result, rate * score.result.success));
        }
        if score.result.success < FAILING_MAX_SUCCESS
            && score.result.fail[STRANDED] >= FAILING_MIN_STRANDED
        {
            ledger.failing.push(kind);
        }
    }
    let overall = blend(&mixture);
    ledger.regions = region_sent_and_satisfied
        .iter()
        .map(|&(region, sent, satisfied)| (region, if sent > 0.0 { satisfied / sent } else { 1.0 }))
        .collect();
    ledger.demand = rate_total;
    ledger.served = served;
    ledger.latency = if served > 0.0 {
        latency_weight / served
    } else {
        0.0
    };
    ledger.apdex = if rate_total > 0.0 {
        satisfied / rate_total
    } else {
        1.0
    };
    ledger.error_share = if rate_total > 0.0 {
        ledger.errors.iter().sum::<f64>() / rate_total
    } else {
        0.0
    };
    if let Some(overall) = overall {
        ledger.p50 = percentile(&overall, MEDIAN);
        ledger.p95 = percentile(&overall, P95);
        ledger.p99 = percentile(&overall, P99);
    }
    ledger.subscriptions_per_second = game.subscriptions_per_second;
    ledger.revenue += game.subscriptions_per_second;

    let origins = origins_of(design, pass);
    for (slot, node) in nodes.iter().enumerate() {
        let rates = pass.rates(slot);
        let order = pass.order.get(slot).copied().unwrap_or_default();
        let model = pass.models.get(slot);
        let inbound = order.sum(rates);
        let share = if node.down {
            0.0
        } else {
            model.map(|model| model.share).unwrap_or(1.0)
        };
        let pool = pass.connections.get(slot).copied().flatten();
        let refused_share = match pool {
            Some((used, max)) if used > max => 1.0 - max / used,
            _ => 0.0,
        };
        let mut out = Keyed::default();
        for &edge in design.out_edges_of(slot) {
            let edge = edge as usize;
            let (Some(carried), Some(keys)) = (pass.links.get(edge), pass.link_kinds.get(edge))
            else {
                continue;
            };
            for kind in keys.iter() {
                out.add(kind, carried[kind]);
            }
        }

        let mut hop_by_kind = Keyed::default();
        if let Some(model) = model {
            for kind in order
                .iter()
                .filter(|kind| has_kind(model.service_mask, *kind))
            {
                hop_by_kind.set(
                    kind,
                    model.service_fixed[kind] + model.service_variable[kind],
                );
            }
        }
        let latency = if inbound > 0.0 && model.is_some() {
            order.iter().fold(0.0, |total, kind| {
                total + rates[kind] * hop_by_kind.values[kind]
            }) / inbound
        } else {
            0.0
        };

        let mut wait_by_kind = Keyed::default();
        if node.type_code == component::QUEUE {
            let tasks = pass.tasks.get(slot).copied().unwrap_or([0.0; NK]);
            for kind in pass
                .task_order
                .get(slot)
                .copied()
                .unwrap_or_default()
                .iter()
            {
                if tasks[kind] > 0.0 {
                    wait_by_kind.set(kind, completion.waits[slot]);
                }
            }
        }

        let busiest = order.iter().fold(None::<usize>, |best, kind| match best {
            Some(current)
                if rates[kind].partial_cmp(&rates[current])
                    != Some(core::cmp::Ordering::Greater) =>
            {
                Some(current)
            }
            _ => Some(kind),
        });
        let p99 = match (model, busiest) {
            (Some(model), Some(kind)) if inbound > 0.0 && has_kind(model.service_mask, kind) => {
                let own = crate::dist::Hop {
                    share: 1.0,
                    fixed_ms: model.service_fixed[kind],
                    variable_ms: model.service_variable[kind],
                    tail_p: model.tail_p,
                    tail_ms: model.tail_ms,
                    value: 1.0,
                    ..crate::dist::Hop::default()
                };
                percentile(&through(own, &[], false), P99)
            }
            _ => 0.0,
        };

        let work_of = |kind: usize| match model {
            Some(model) if model.work_unit.is_some() => model.work[kind],
            _ => 1.0,
        };
        let work_total = order
            .iter()
            .fold(0.0, |total, kind| total + rates[kind] * work_of(kind));
        let mut work_share = Keyed::default();
        if work_total > 0.0 {
            for kind in order.iter() {
                work_share.set(kind, rates[kind] * work_of(kind) / work_total);
            }
        }

        let mut receipts = Vec::new();
        if let Some(model) = model {
            for kind in order.iter().filter(|kind| rates[*kind] > 0.0) {
                let receipt = match node.type_code {
                    component::SERVER if kind < NR => {
                        let code = setup.board.code.node(slot);
                        let flags = setup.board.flags.get(slot).copied().unwrap_or_default();
                        Some(crate::model::server_receipt(
                            game,
                            node,
                            model,
                            kind,
                            &code.calls[kind],
                            &flags,
                            code.cpu[kind],
                        ))
                    }
                    component::DATABASE | component::REPLICA => {
                        crate::model::database_receipt(game, node, model, rates, kind)
                    }
                    _ => None,
                };
                if let Some(receipt) = receipt {
                    receipts.push((kind, receipt));
                }
            }
        }
        let mut from_users = Keyed::default();
        for (kind, part) in origins[slot].entries() {
            from_users.set(kind, inbound * part);
        }
        let utilization = if refused_share > 0.0 {
            model
                .map(|model| model.utilization)
                .unwrap_or(0.0)
                .max(1.0 / (1.0 - refused_share))
        } else {
            model.map(|model| model.utilization).unwrap_or(0.0)
        };
        let strand = pass.stranded.get(slot).copied().flatten();
        let stranded = strand.map(|(rate, _)| rate).unwrap_or(0.0);
        let hits = pass.hits.get(slot).copied().unwrap_or(0.0);
        let queued = matches!(node.type_code, component::QUEUE | component::LOG);
        ledger.nodes[slot] = NodeRow {
            inbound,
            traffic: Keyed {
                values: *rates,
                keys: order,
            },
            capacity: if inbound > 0.0 {
                model.map(|model| model.capacity).unwrap_or(0.0)
            } else {
                0.0
            },
            utilization,
            limit: if refused_share > 0.0 {
                LIMIT_CONNECTIONS
            } else {
                model.map(|model| model.limit as usize).unwrap_or(0)
            },
            latency,
            p99,
            hop_by_kind,
            wait_by_kind,
            work_share,
            work_unit: model.and_then(|model| model.work_unit),
            cost: if inbound > 0.0 {
                work_total / inbound
            } else {
                0.0
            },
            receipts,
            repeated: inbound.min(pass.repeated.get(slot).copied().unwrap_or(0.0)),
            origins: from_users,
            dropped: inbound * (1.0 - share),
            refused: inbound * share * refused_share,
            stranded,
            stranded_kinds: strand.map(|(_, kinds)| kinds).unwrap_or_default(),
            connections: pool,
            hit_ratio: matches!(node.type_code, component::CACHE | component::CDN).then_some(hits),
            evictions: (node.type_code == component::CACHE).then(|| {
                rates[NR + backend::Q_READ] * (1.0 - hits) * eviction_share_of(game, node)
            }),
            age: queued.then(|| completion.waits[slot]),
            lag_ms: (node.type_code == component::REPLICA).then_some(pass.lag_ms),
            disk: model.is_some_and(|model| model.disk),
            out,
            resources: model.map(|model| model.resources).unwrap_or_default(),
            throttled: model.is_some_and(|model| model.throttled),
            swapping: model.is_some_and(|model| model.swapping),
            status: status_of(
                node.down,
                inbound,
                utilization,
                stranded > 0.0 || refused_share > 0.0,
            ),
        };
    }

    let insight = insight_of(
        game,
        nodes,
        setup.links,
        &origins,
        &ledger.kinds,
        &mut ledger.nodes,
    );
    ledger.insight = insight.pools;
    ledger.breadth = insight.breadth;
    ledger.breadth_regions = insight.regions;
    ledger.links = setup
        .links
        .iter()
        .map(|link| link_row(game, design, pass, tree, &ledger.nodes, link))
        .collect();

    ledger.salaries = game.salaries;
    ledger.game_shares = game.shares;
    ledger.velocity = crate::bill::velocity_of(game, nodes, &ledger.nodes);
    ledger.bill = crate::bill::bill_of(game, design, nodes, pass, &ledger.nodes, &ledger.kinds);
    ledger.costs = crate::bill::costs_of(game, &ledger.kinds, ledger.demand, ledger.bill.total);

    ledger.bottleneck_by_kind = bottleneck_by_kind(nodes, &ledger.nodes);
    ledger
}

#[derive(Clone, Copy)]
pub struct LinkIn {
    pub from: usize,
    pub to: usize,

    pub edge: Option<usize>,
    pub breaker: bool,
}

#[derive(Clone, Copy, Default)]
pub struct LinkRow {
    pub rate: f64,
    pub traffic: Keyed,

    pub kind: usize,
    pub failing: bool,
    pub failure: f64,
    pub timeout: f64,
    pub mean: f64,
    pub p99: f64,
}

const TAP_LINK_SHARE: f64 = 0.15;

fn sampled_traffic(source: Option<&NodeRow>, rate: f64) -> Keyed {
    let mut traffic = Keyed::default();
    let Some(source) = source.filter(|source| source.inbound > 0.0) else {
        return traffic;
    };
    let scale = ((source.inbound - source.dropped) / source.inbound) * rate;
    for (kind, carried) in source.traffic.entries() {
        traffic.set(kind, carried * scale);
    }
    traffic
}

fn link_row(
    game: &GameCtx,
    design: &crate::routing::Design,
    pass: &Pass,
    tree: &mut Tree,
    rows: &[NodeRow],
    link: &LinkIn,
) -> LinkRow {
    if design
        .nodes
        .get(link.to)
        .is_some_and(|to| COMPONENT_TAP[to.type_code as usize])
    {
        let source = rows.get(link.from);
        return LinkRow {
            rate: source.map_or(0.0, |source| {
                (source.inbound - source.dropped) * TAP_LINK_SHARE
            }),
            traffic: sampled_traffic(source, TAP_LINK_SHARE),
            kind: kind::PAGE,
            failing: false,
            failure: 0.0,
            timeout: 0.0,
            mean: 0.0,
            p99: 0.0,
        };
    }
    let carried = match link.edge {
        Some(edge) => Keyed {
            values: pass.links[edge],
            keys: pass.link_kinds[edge],
        },
        None => Keyed::default(),
    };
    let (kind, _) = carried
        .entries()
        .fold((kind::PAGE, NO_TRAFFIC_YET), |best, (kind, rate)| {
            if rate > best.1 {
                (kind, rate)
            } else {
                best
            }
        });
    let rate = carried.entries().fold(0.0, |total, (_, rate)| total + rate);
    let failing = rows.get(link.to).is_some_and(|target| {
        target.status == Status::Down
            || target.refused > 0.0
            || target.dropped > LINK_FAILING_MIN_DROPPED_SHARE
    });
    let (timeout, mean, p99) = match link.edge {
        Some(edge) if rate > 0.0 => carried.entries().fold(
            (0.0_f64, 0.0_f64, 0.0_f64),
            |(timeout, mean, p99), (kind, share)| {
                let weight = share / rate;
                let over = tree.over_budget_on(edge, kind);
                let latency = tree.latency(edge, kind);
                (
                    timeout + weight * over,
                    mean + weight * mean_of(&latency),
                    p99.max(percentile(&latency, P99)),
                )
            },
        ),
        _ => (0.0, 0.0, 0.0),
    };
    LinkRow {
        rate,
        traffic: carried,
        kind,
        failing,
        failure: link_failure(game, design, tree, link, &carried, rate),
        timeout,
        mean,
        p99,
    }
}

fn link_failure(
    game: &GameCtx,
    design: &crate::routing::Design,
    tree: &mut Tree,
    link: &LinkIn,
    carried: &Keyed,
    rate: f64,
) -> f64 {
    let Some(edge) = link.edge else { return 0.0 };
    let Some(policy) = design.edges.get(edge).copied() else {
        return 0.0;
    };
    let watched = policy.retry != 0 || (link.breaker && game.has(research::CIRCUIT_BREAKERS));
    if !watched || policy.open || rate <= 0.0 {
        return 0.0;
    }
    carried.entries().fold(0.0, |total, (kind, share)| {
        total + (share / rate) * tree.failure_on(edge, kind)
    })
}

struct Insight {
    pools: [f64; INSIGHT_POOLS.len()],
    breadth: Keyed,
    regions: Keyed,
}

#[derive(Clone, Copy)]
struct Sampled {
    kind: usize,
    samples: f64,
    meshed: f64,
    profiled: f64,
}

fn insight_of(
    game: &GameCtx,
    nodes: &[crate::model::Node],
    links: &[LinkIn],
    origins: &[Keyed],
    kinds: &[KindRow],
    rows: &mut [NodeRow],
) -> Insight {
    let mut taps: Vec<(usize, Vec<usize>)> = Vec::new();
    for link in links {
        if !nodes
            .get(link.to)
            .is_some_and(|to| COMPONENT_TAP[to.type_code])
        {
            continue;
        }
        match taps.iter_mut().find(|(tap, _)| *tap == link.to) {
            Some((_, sources)) => sources.push(link.from),
            None => taps.push((link.to, vec![link.from])),
        }
    }

    let mut sampled: Vec<Sampled> = Vec::new();
    let mut index = vec![NO_INDEX; COMPONENT_TAP.len() * NR];

    let mut failed: Vec<(usize, f64)> = Vec::new();
    let mut regions = Keyed::default();
    let mut seen_regions = [0u64; NR];
    for (tap_slot, sources) in &taps {
        let Some(tap) = nodes.get(*tap_slot) else {
            continue;
        };
        let sample_rate = tap.sample_rate;
        let volume = sources.iter().fold(0.0, |total, source| {
            total
                + rows
                    .get(*source)
                    .map_or(0.0, |entry| entry.inbound - entry.dropped)
        });
        let mut traffic = Keyed::default();
        for source in sources {
            for (kind, value) in sampled_traffic(rows.get(*source), sample_rate).entries() {
                traffic.add(kind, value);
            }
        }
        let capacity = crate::model::grown(
            ANALYTICS_CAPACITY,
            ANALYTICS_CAPACITY_GROWTH_PER_SIZE,
            tap.size - 1.0,
        );

        let kept = if tap.down || volume * sample_rate <= 0.0 {
            0.0
        } else {
            (capacity / (volume * sample_rate)).min(1.0)
        };
        for source in sources {
            let (Some(entry), Some(from)) = (rows.get(*source), nodes.get(*source)) else {
                continue;
            };
            if kept <= 0.0 {
                continue;
            }
            let done = (entry.inbound - entry.dropped) * sample_rate * kept;
            for (kind, share) in origins[*source].entries() {
                let samples = done * share;
                if samples <= 0.0 {
                    continue;
                }
                let key = from.type_code * NR + kind;
                if index[key] == NO_INDEX {
                    index[key] = sampled.len();
                    sampled.push(Sampled {
                        kind,
                        samples: 0.0,
                        meshed: 0.0,
                        profiled: 0.0,
                    });
                }
                if seen_regions[kind] & (1 << from.region) == 0 {
                    seen_regions[kind] |= 1 << from.region;
                    regions.add(kind, 1.0);
                }
                let entry = &mut sampled[index[key]];
                entry.samples += samples;
                if from.mesh {
                    entry.meshed += samples;
                }
                if from.type_code == component::SERVER
                    && RUNTIME_LANGUAGE[from.runtime] == language::JAVA
                {
                    entry.profiled += samples;
                }

                let answer = kinds[kind];
                if answer.rate > 0.0 && PROFILE_SCORED[kind] {
                    let lost = samples * (1.0 - answer.success * answer.apdex);
                    match failed
                        .iter_mut()
                        .find(|(type_code, _)| *type_code == from.type_code)
                    {
                        Some((_, total)) => *total += lost,
                        None => failed.push((from.type_code, 0.0 + lost)),
                    }
                }
            }
        }
        let inbound = volume * sample_rate;
        let utilization = if capacity > 0.0 {
            inbound / capacity
        } else {
            0.0
        };
        if let Some(row) = rows.get_mut(*tap_slot) {
            row.inbound = inbound;
            row.traffic = traffic;
            row.capacity = capacity;
            row.utilization = utilization;
            row.limit = if inbound > capacity {
                Limit::Throughput as usize
            } else {
                Limit::None as usize
            };
            row.status = status_of(tap.down, volume, utilization, false);
        }
    }

    let perk = game.insight_perk;
    let mut pools = [0.0f64; INSIGHT_POOLS.len()];
    let mut breadth = Keyed::default();
    for entry in &sampled {
        pools[entry.kind] += INSIGHT_YIELD
            * (entry.samples.sqrt()
                + MESH_INSIGHT * entry.meshed.sqrt()
                + JVM_INSIGHT * entry.profiled.sqrt())
            * perk;
        breadth.add(entry.kind, 1.0);
    }

    let tail_failure_multiplier = if game.has(research::TAIL_SAMPLING) {
        TAIL_SAMPLING_FAILURE_MULTIPLIER
    } else {
        1.0
    };
    for (_, lost) in &failed {
        pools[NR] +=
            INSIGHT_YIELD * FAILURE_YIELD * lost.max(0.0).sqrt() * perk * tail_failure_multiplier;
    }
    Insight {
        pools,
        breadth,
        regions,
    }
}

fn eviction_share_of(game: &GameCtx, node: &crate::model::Node) -> f64 {
    let hot = (game.users * HOT_KB_PER_USER) / KB_PER_GB;
    if hot > 0.0 {
        (1.0 - (crate::model::flat_scale(node.size) / hot).min(1.0)).max(0.0)
    } else {
        0.0
    }
}

pub fn origins_of(design: &crate::routing::Design, pass: &Pass) -> Vec<Keyed> {
    let count = design.nodes.len();

    let mut parents: Vec<Vec<usize>> = vec![Vec::new(); count];
    let mut routed = vec![false; design.edges.len()];
    for node in 0..count {
        for &edge in design.out_edges_of(node) {
            if let Some(flag) = routed.get_mut(edge as usize) {
                *flag = true;
            }
        }
    }
    for (edge, link) in design.edges.iter().enumerate() {
        if routed[edge] {
            if let Some(into) = parents.get_mut(link.to as usize) {
                into.push(edge);
            }
        }
    }
    let mut origins = vec![Keyed::default(); count];
    for &node in &design.order {
        let mut mix = Keyed::default();
        let arriving = pass.rates(node);
        for (kind, &rate) in arriving[..NR].iter().enumerate() {
            if rate > 0.0 {
                mix.set(kind, rate);
            }
        }
        for &edge in &parents[node] {
            let link = &design.edges[edge];
            let carried = pass.links.get(edge).copied().unwrap_or([0.0; NK]);
            let backend = carried[NR..].iter().fold(0.0, |total, rate| total + rate);
            if backend <= 0.0 {
                continue;
            }
            let parent = origins[link.from as usize];
            for (kind, share) in parent.entries() {
                mix.add(kind, backend * share);
            }
        }
        let total = mix.entries().fold(0.0, |total, (_, rate)| total + rate);
        if total > 0.0 {
            let mut shares = Keyed::default();
            for (kind, rate) in mix.entries() {
                shares.set(kind, rate / total);
            }
            origins[node] = shares;
        }
    }
    origins
}

pub fn bottleneck_by_kind(nodes: &[crate::model::Node], rows: &[NodeRow]) -> Vec<Option<usize>> {
    let mut by_kind = vec![None; NR];
    for (kind, by_kind) in by_kind.iter_mut().enumerate() {
        let mut best: Option<usize> = None;
        let mut best_utilization = BUSY_UTILIZATION;
        for (slot, node) in nodes.iter().enumerate() {
            if !COMPONENT_LIMITING[node.type_code] || node.down {
                continue;
            }
            let row = match rows.get(slot) {
                Some(row) => row,
                None => continue,
            };
            if row.traffic.values[kind] <= 0.0 {
                continue;
            }
            if row.utilization > best_utilization {
                best_utilization = row.utilization;
                best = Some(slot);
            }
        }
        *by_kind = best;
    }
    by_kind
}

pub fn busiest_nodes(nodes: &[crate::model::Node], rows: &[NodeRow]) -> Vec<usize> {
    let mut ranked: Vec<(usize, f64)> = Vec::new();
    for (slot, node) in nodes.iter().enumerate() {
        if !COMPONENT_LIMITING[node.type_code] || node.down {
            continue;
        }
        let utilization = rows.get(slot).map(|row| row.utilization).unwrap_or(0.0);
        if utilization > BUSY_UTILIZATION {
            ranked.push((slot, utilization));
        }
    }
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(core::cmp::Ordering::Equal));
    ranked.truncate(BUSIEST_NODE_COUNT);
    ranked.into_iter().map(|(slot, _)| slot).collect()
}
