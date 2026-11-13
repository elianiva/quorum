//! The Ledger: what one request earns, and what each Node and kind looks like.
//!
//! Ported from `solve-ledger.ts` (`completionsOf`, `answersOf`, `answerOf`,
//! `earnedOf`, `revenueOf`, `ledgerOf`). The parts the solve itself reads are
//! here in full: revenue, the per-kind rows, the error shares, the Node rows the
//! Bottleneck search ranks, and the per-kind bottleneck. The presentation-only
//! halves of the TypeScript Ledger (bills, Insight, velocity, Link rows, regions,
//! devices) are not ported yet, and a run does not report them.

use crate::catalog::*;
use crate::dist::*;
use crate::model::{GameCtx, Rates};
use crate::outcomes::Tree;
use crate::pass::Pass;

/// One region's users entering the Design.
#[derive(Clone, Copy, Default)]
pub struct Route {
    pub region: usize,
    /// The Users Node they enter at, as a Node slot, or `None` when it strands.
    pub source: Option<usize>,
    pub share: f64,
    /// Milliseconds their hop to the source adds.
    pub extra_ms: f64,
}

/// What a Queue's tasks complete at, for the async half of Apdex.
#[derive(Default)]
pub struct Completions {
    pub enqueued: Vec<f64>,
    pub scored: Vec<f64>,
    pub waits: Vec<f64>,
}

/// One request kind's figures.
#[derive(Clone, Copy, Default)]
pub struct KindRow {
    pub rate: f64,
    pub success: f64,
    pub apdex: f64,
    /// `None` when no part of the kind went through a Queue.
    pub completion: Option<f64>,
    pub mean: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

/// One Node's figures.
#[derive(Clone)]
pub struct NodeRow {
    pub inbound: f64,
    pub traffic: Rates,
    pub capacity: f64,
    pub utilization: f64,
    pub limit: usize,
    pub latency: f64,
    pub p99: f64,
    pub hop_by_kind: Rates,
    pub repeated: f64,
    pub dropped: f64,
    pub refused: f64,
    pub stranded: f64,
    pub connections: Option<(f64, f64)>,
    pub hit_ratio: Option<f64>,
    pub lag_ms: Option<f64>,
    pub disk: bool,
    pub throttled: bool,
    pub swapping: bool,
}

impl Default for NodeRow {
    fn default() -> Self {
        NodeRow {
            inbound: 0.0,
            traffic: [0.0; NK],
            capacity: 0.0,
            utilization: 0.0,
            limit: 0,
            latency: 0.0,
            p99: 0.0,
            hop_by_kind: [0.0; NK],
            repeated: 0.0,
            dropped: 0.0,
            refused: 0.0,
            stranded: 0.0,
            connections: None,
            hit_ratio: None,
            lag_ms: None,
            disk: false,
            throttled: false,
            swapping: false,
        }
    }
}

/// What one solve prints.
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
    pub subscriptions: f64,
    pub fines: f64,
    pub revenue_by_kind: Vec<f64>,
    pub fines_by_kind: Vec<f64>,
    pub failing: Vec<usize>,
    /// The most utilized limiting Node on each kind's path.
    pub bottleneck_by_kind: Vec<Option<usize>>,
    pub bottleneck: Option<usize>,
}

/// `attemptsAllowed`: a Queue's max attempts with a dead-letter queue, else forever.
pub fn attempts_allowed(dlq: bool, attempts: f64) -> f64 {
    if dlq {
        attempts
    } else {
        FOREVER_ATTEMPTS
    }
}

/// `sumRates`: every kind's rate at a Node.
pub fn sum_rates(rates: &Rates) -> f64 {
    rates.iter().sum()
}

/// `databaseSick`: a deep health check fails when a database behind the server is down or full.
pub fn database_sick(design: &crate::routing::Design, pass: &Pass, nodes: &[crate::model::Node], server: usize) -> bool {
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
            && pass.models.get(child).map(|model| model.utilization).unwrap_or(0.0) >= 1.0
        {
            return true;
        }
        if sick_visit(design, pass, nodes, child, seen) {
            return true;
        }
    }
    false
}

/// `completionsOf`: when the async part of each kind is done.
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
        let wait = if node.depth <= 0.0 {
            0.0
        } else if drained > 0.0 {
            node.depth / drained
        } else {
            f64::INFINITY
        };
        done.waits[slot] = wait;
        let tasks = pass.tasks.get(slot).copied().unwrap_or([0.0; NK]);
        if tasks.iter().all(|rate| *rate <= 0.0) || node.down {
            continue;
        }
        let worker = tree.downstream(slot, NR + backend::TASK, 0.0);
        // A task a busy Worker dropped waits in the Queue: the wait counts it.
        let failure = (1.0 - worker.success - worker.fail[DROPPED]).clamp(0.0, 1.0);
        let allowed = attempts_allowed(node.dlq, node.attempts);
        let lost = task_lost(failure, allowed);
        let extra = task_attempts(failure, allowed) - 1.0;
        let completed = if !wait.is_finite() || worker.fail[STRANDED] >= 1.0 {
            failed(STRANDED)
        } else {
            let mut finished = worker.without_failures();
            finished.success = 1.0 - lost;
            finished.fixed_ms = worker.fixed_ms + (wait + extra * TASK_RETRY_SECONDS) * 1000.0;
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

/// `answersOf`: what one request of `kind` gets back for each region's users.
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

/// `answerOf`: what one request of `kind` gets back over every region's users.
pub fn answer_of(tree: &Tree, answers: &[(Route, Outcome, Outcome)], kind: usize) -> Outcome {
    if let [(route, answer, _)] = answers {
        if user_hop_ms(tree.game(), route.extra_ms, kind) + regressed_ms(tree.game()) == 0.0 {
            return *answer;
        }
    }
    let entries: Vec<(Outcome, f64)> = answers.iter().map(|(route, answer, _)| (*answer, route.share)).collect();
    blend(&entries).unwrap_or_else(|| failed(STRANDED))
}

/// A latency regression puts every answer this much further out.
#[inline]
fn regressed_ms(game: &GameCtx) -> f64 {
    if game.incident == Some(crate::model::Incident::LatencyRegression) { LATENCY_REGRESSION_MS } else { 0.0 }
}

/// `userHopMs`: the user hop a request of `kind` pays.
#[inline]
pub fn user_hop_ms(game: &GameCtx, ms: f64, kind: usize) -> f64 {
    if kind == kind::PAGE && game.has(research::HTTP2) {
        ms * (1.0 - HTTP2_CUT)
    } else {
        ms
    }
}

/// `earnsInTime`: a request slower than the Venture's deadline earns nothing.
#[inline]
pub fn earns_in_time(game: &GameCtx, ms: f64) -> bool {
    let deadline = VENTURE_DEADLINE[game.venture.min(VENTURE_DEADLINE.len() - 1)];
    deadline < 0.0 || ms <= deadline
}

/// `earnedOf`: what one request of `kind` earns in a second, at this rate and Apdex.
pub fn earned_of(game: &GameCtx, kind: usize, rate: f64, result: &Outcome, apdex: f64) -> f64 {
    let factor = game.value[kind];
    rate * result.success
        * apdex
        * KIND_VALUE[kind]
        * result.value
        * factor
        * if earns_in_time(game, mean_of(result)) { 1.0 } else { 0.0 }
}

/// What one kind earns and how it scores, shared by `revenueOf` and `ledgerOf`.
pub struct KindScore {
    pub result: Outcome,
    pub apdex: f64,
    pub completion: Option<f64>,
    pub earned: f64,
}

/// `revenueOf`: what the Company earns in a second, without the Node and Link rows.
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
    revenue + game.subscriptions
}

/// The figures one kind scores at: its blended answer, its Apdex, and what it earns.
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
    let done = if enqueued > 0.0 { Some(completion.scored[kind] / enqueued) } else { None };
    let r#async = match done {
        None => 0.0,
        Some(_) if result.success <= 0.0 => 0.0,
        Some(_) => (enqueued / (rate * result.success)).min(1.0),
    };
    let finish = 1.0 - r#async + r#async * done.unwrap_or(1.0);
    let apdex = apdex_of(&result, PROFILE_APDEX[kind]) * finish;
    let earned = earned_of(game, kind, rate, &result, apdex);
    KindScore { result, apdex, completion: done, earned }
}

/// `ledgerOf`: the whole Ledger, as far as the solve and the benchmark read it.
pub fn ledger_of(
    game: &GameCtx,
    design: &crate::routing::Design,
    demand: &Rates,
    pass: &Pass,
    nodes: &[crate::model::Node],
    tree: &mut Tree,
    routes: &[Route],
) -> Ledger {
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
            p50: percentile(&score.result, 0.5),
            p95: percentile(&score.result, 0.95),
            p99: percentile(&score.result, 0.99),
        };
        // Bots earn nothing and do not count toward Apdex or errors.
        if !PROFILE_SCORED[kind] {
            continue;
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
        // Fintech fines a stale answer to a money kind.
        if !game.sandbox && (MONEY_KINDS_MASK >> kind) & 1 == 1 {
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
        if score.result.success < 0.05 && score.result.fail[STRANDED] >= 0.5 {
            ledger.failing.push(kind);
        }
    }
    let overall = blend(&mixture);
    ledger.demand = rate_total;
    ledger.served = served;
    ledger.latency = if served > 0.0 { latency_weight / served } else { 0.0 };
    ledger.apdex = if rate_total > 0.0 { satisfied / rate_total } else { 1.0 };
    ledger.error_share = if rate_total > 0.0 {
        ledger.errors.iter().sum::<f64>() / rate_total
    } else {
        0.0
    };
    if let Some(overall) = overall {
        ledger.p50 = percentile(&overall, 0.5);
        ledger.p95 = percentile(&overall, 0.95);
        ledger.p99 = percentile(&overall, 0.99);
    }
    ledger.subscriptions = game.subscriptions;
    ledger.revenue += game.subscriptions;

    // Node rows: what each Node was sent, what it could take, and what it dropped.
    for (slot, node) in nodes.iter().enumerate() {
        let rates = pass.rates(slot);
        let order = pass.order.get(slot).copied().unwrap_or_default();
        let model = pass.models.get(slot);
        let inbound = order.sum(rates);
        let share = if node.down { 0.0 } else { model.map(|model| model.share).unwrap_or(1.0) };
        let pool = pass.connections.get(slot).copied().flatten();
        let refused_share = match pool {
            Some((used, max)) if used > max && used > 0.0 => 1.0 - max / used,
            _ => 0.0,
        };
        let mut hop_by_kind = [0.0f64; NK];
        for kind in 0..NK {
            if rates[kind] > 0.0 {
                if let Some(model) = model {
                    if (model.service_mask >> kind) & 1 == 1 {
                        hop_by_kind[kind] = model.service_fixed[kind] + model.service_variable[kind];
                    }
                }
            }
        }
        let latency = if inbound > 0.0 {
            order.iter().fold(0.0, |total, kind| total + rates[kind] * hop_by_kind[kind]) / inbound
        } else {
            0.0
        };
        let busiest = order.iter().fold(None::<usize>, |best, kind| match best {
            None if rates[kind] > 0.0 => Some(kind),
            Some(current) if rates[kind] > rates[current] => Some(kind),
            other => other,
        });
        let p99 = match (model, busiest) {
            (Some(model), Some(kind)) if inbound > 0.0 && (model.service_mask >> kind) & 1 == 1 => {
                let own = crate::dist::Hop {
                    share: 1.0,
                    fixed_ms: model.service_fixed[kind],
                    variable_ms: model.service_variable[kind],
                    tail_p: model.tail_p,
                    tail_ms: model.tail_ms,
                    value: 1.0,
                    ..crate::dist::Hop::default()
                };
                percentile(&through(own, &[], false), 0.99)
            }
            _ => 0.0,
        };
        let utilization = if refused_share > 0.0 {
            model
                .map(|model| model.utilization)
                .unwrap_or(0.0)
                .max(1.0 / (1.0 - refused_share))
        } else {
            model.map(|model| model.utilization).unwrap_or(0.0)
        };
        let stranded = pass.stranded.get(slot).copied().flatten().map(|(rate, _)| rate).unwrap_or(0.0);
        ledger.nodes[slot] = NodeRow {
            inbound,
            traffic: *rates,
            capacity: if inbound > 0.0 { model.map(|model| model.capacity).unwrap_or(0.0) } else { 0.0 },
            utilization,
            limit: if refused_share > 0.0 { 8 } else { model.map(|model| model.limit as usize).unwrap_or(0) },
            latency,
            p99,
            hop_by_kind,
            repeated: inbound.min(pass.repeated.get(slot).copied().unwrap_or(0.0)),
            dropped: inbound * (1.0 - share),
            refused: inbound * share * refused_share,
            stranded,
            connections: pool,
            hit_ratio: if node.type_code == component::CACHE || node.type_code == component::CDN {
                Some(pass.hits.get(slot).copied().unwrap_or(0.0))
            } else {
                None
            },
            lag_ms: if node.type_code == component::REPLICA { Some(pass.lag_ms) } else { None },
            disk: model.map(|model| model.disk).unwrap_or(false),
            throttled: model.map(|model| model.throttled).unwrap_or(false),
            swapping: model.map(|model| model.swapping).unwrap_or(false),
        };
    }

    ledger.bottleneck_by_kind = bottleneck_by_kind(nodes, &ledger.nodes);
    let _ = design;
    ledger
}

/// `bottleneckByKindOf`: the most utilized limiting Node on each kind's own path.
pub fn bottleneck_by_kind(nodes: &[crate::model::Node], rows: &[NodeRow]) -> Vec<Option<usize>> {
    let mut by_kind = vec![None; NR];
    for (kind, by_kind) in by_kind.iter_mut().enumerate() {
        let mut best: Option<usize> = None;
        let mut best_utilization = 0.6;
        for (slot, node) in nodes.iter().enumerate() {
            if !COMPONENT_LIMITING[node.type_code] || node.down {
                continue;
            }
            let row = match rows.get(slot) {
                Some(row) => row,
                None => continue,
            };
            if row.traffic[kind] <= 0.0 {
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

/// The Nodes whose doubled capacity would earn the most, busiest first.
pub fn busiest_nodes(nodes: &[crate::model::Node], rows: &[NodeRow]) -> Vec<usize> {
    let mut ranked: Vec<(usize, f64)> = Vec::new();
    for (slot, node) in nodes.iter().enumerate() {
        if !COMPONENT_LIMITING[node.type_code] || node.down {
            continue;
        }
        let utilization = rows.get(slot).map(|row| row.utilization).unwrap_or(0.0);
        if utilization > 0.6 {
            ranked.push((slot, utilization));
        }
    }
    ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(core::cmp::Ordering::Equal));
    ranked.truncate(3);
    ranked.into_iter().map(|(slot, _)| slot).collect()
}
