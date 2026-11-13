//! The cloud bill, ported from `solve-bill.ts` (`billOf`), and the figures the
//! Ledger splits it into: cost per kind, cost per Service, and what each Service
//! served. What depends only on the Game (each Node's `burnOf`, payroll, and the
//! burn shares) the host works out and sends; the solver adds what traffic costs.

use crate::catalog::*;
use crate::ledger::{KindRow, NodeRow};
use crate::model::{GameCtx, Node};
use crate::pass::Pass;
use crate::routing::Design;

/// What `billOf` returns.
#[derive(Clone, Copy, Default)]
pub struct Bill {
    pub egress: f64,
    pub retrieval: f64,
    pub third_party: f64,
    pub requests: f64,
    pub total: f64,
}

/// How an Edge's bytes leave their zone.
pub mod egress {
    pub const NONE: u8 = 0;
    pub const CROSS_ZONE: u8 = 1;
    pub const CROSS_REGION: u8 = 2;
}

/// `meanServiceOf`: how long one request lasts at a Node, its tail included.
fn mean_service_of(pass: &Pass, slot: usize) -> f64 {
    let rates = pass.rates(slot);
    let Some(model) = pass.models.get(slot) else { return 0.0 };
    let mut spent = 0.0;
    let mut rate = 0.0;
    for kind in pass.order.get(slot).copied().unwrap_or_default().iter() {
        let each = rates[kind];
        if (model.service_mask >> kind) & 1 == 0 || each <= 0.0 {
            continue;
        }
        spent += each * (model.service_fixed[kind] + model.service_variable[kind]);
        rate += each;
    }
    let cold = model.tail_p * model.tail_ms;
    if rate > 0.0 { spent / rate + cold } else { cold }
}

/// `billOf`: egress, retrieval, third-party fees, per-request lines, and the total Burn.
pub fn bill_of(
    game: &GameCtx,
    design: &Design,
    nodes: &[Node],
    pass: &Pass,
    rows: &[NodeRow],
    kinds: &[KindRow],
) -> Bill {
    let index = game.cost_index;
    let done = |slot: usize| rows.get(slot).map_or(0.0, |row| row.inbound) - rows.get(slot).map_or(0.0, |row| row.dropped);

    let mut egress = 0.0;
    if game.stage >= 2.0 {
        let r2 = game.has(research::EGRESS_OPTIMIZATION);
        for (slot, node) in nodes.iter().enumerate() {
            if node.type_code == component::SERVER {
                let own = rows.get(slot);
                let bytes = own.and_then(|own| own.resources.network_kbps).map_or(0.0, |gauge| gauge.used);
                // The share of this Node's traffic Object Storage serves rides R2's $0 egress.
                let r2_share = match own {
                    Some(own)
                        if r2
                            && own.inbound > 0.0
                            && design.out_edges_of(slot).iter().any(|&edge| {
                                let child = &nodes[design.edges[edge as usize].to as usize];
                                child.type_code == component::STORAGE && child.r2
                            }) =>
                    {
                        (own.traffic.values[kind::UPLOAD] + own.traffic.values[kind::MEDIA]) / own.inbound
                    }
                    _ => 0.0,
                };
                egress += ((bytes * (1.0 - r2_share)) / 1_000_000.0) * EGRESS_ORIGIN;
            }
            if node.type_code == component::CDN && !node.down {
                let rates = pass.rates(slot);
                for kind in 0..NR {
                    egress += ((rates[kind] * crate::model::cdn_hit(game, node, kind) * PROFILE_PAYLOAD_KB[kind])
                        / 1_000_000.0)
                        * EGRESS_CDN;
                }
            }
        }
        // Traffic between zones bills both ways: requests at their payload, backend calls at 4 KB.
        for &edge in &pass.link_order {
            let Some(route) = design.edges.get(edge) else { continue };
            if route.egress == egress::NONE {
                continue;
            }
            let carried = &pass.links[edge];
            for kind in pass.link_kinds[edge].iter() {
                let rate = carried[kind];
                let kb = if kind >= NR { BACKEND_KB } else { PROFILE_PAYLOAD_KB[kind] };
                egress += if route.egress == egress::CROSS_REGION {
                    ((rate * kb) / 1_000_000.0) * EGRESS_CROSS_REGION
                } else {
                    ((rate * kb) / 1_000_000.0) * EGRESS_CROSS_ZONE * 2.0
                };
            }
        }
        // A spread Wide-column Store replicates every write across regions.
        for (slot, node) in nodes.iter().enumerate() {
            if node.type_code != component::WIDE || !node.spread || node.down {
                continue;
            }
            let regions = game.spread_regions;
            if regions <= 1.0 {
                continue;
            }
            let arriving = pass.rates(slot);
            let writes = arriving[kind::Q_WRITE] + arriving[kind::Q_TX] + arriving[kind::K_WRITE];
            egress += ((writes * (regions - 1.0) * SPREAD_REPLICATION_KB) / 1_000_000.0) * EGRESS_CROSS_REGION;
        }
        egress *= index * game.egress_factor;
    }

    // An infrequent-access object bills a retrieval fee per GB read back.
    let mut retrieval = 0.0;
    for (slot, node) in nodes.iter().enumerate() {
        if node.type_code != component::STORAGE || node.down || node.retrieval <= 0.0 {
            continue;
        }
        let reads = pass.rates(slot)[kind::BLOB_GET];
        retrieval += ((reads * PROFILE_PAYLOAD_KB[kind::MEDIA]) / 1_000_000.0) * node.retrieval * index;
    }

    // The Payment Provider takes a share of each checkout and a fixed part, in real dollars.
    let buy = kinds[kind::BUY];
    let checkouts = if buy.rate > 0.0 { buy.rate * buy.success } else { 0.0 };
    let second = nodes.iter().any(|node| node.type_code == component::PSP && node.second_provider);
    let fees = if checkouts > 0.0 {
        checkouts
            * (KIND_VALUE[kind::BUY] * game.value[kind::BUY] * PSP_RATE + PSP_FIXED)
            * if second { SECOND_PROVIDER_FEE } else { 1.0 }
    } else {
        0.0
    };

    // A Data Warehouse bills each scan, the LLM API each token, a push provider each message.
    let mut usage = 0.0;
    for (slot, node) in nodes.iter().enumerate() {
        let done = done(slot);
        if done <= 0.0 || node.down {
            continue;
        }
        match node.type_code {
            component::WAREHOUSE => usage += done * SCAN_PRICE,
            component::LLM => usage += ((done * TOKENS_PER_PROMPT) / 1_000.0) * LLM_PRICE,
            component::MSGP => usage += done * MSGP_PRICE,
            _ => {}
        }
    }
    let third_party = if usage > 0.0 { fees + usage * index } else { fees };

    // Gateways, functions, storage requests, and queue messages bill per request.
    let mut requests = 0.0;
    let kept = crate::pass::gateway_kept(nodes, &pass.arriving, &pass.order);
    for (slot, node) in nodes.iter().enumerate() {
        if node.down {
            continue;
        }
        let done = done(slot);
        if done <= 0.0 {
            continue;
        }
        match node.type_code {
            component::GW => requests += done * kept * GATEWAY_PRICE,
            component::FN => {
                requests += done
                    * (SERVERLESS_REQUEST_PRICE
                        + SERVERLESS_GB_SECOND * SERVERLESS_MEMORY_GB * (mean_service_of(pass, slot) / 1_000.0))
                    * index;
            }
            component::EDGE => requests += done * EDGE_REQUEST_PRICE * index,
            component::STORAGE => {
                let arriving = pass.rates(slot);
                requests += (arriving[kind::BLOB_GET] * node.store_get + arriving[kind::BLOB_PUT] * node.store_put) * index;
            }
            component::QUEUE => requests += done * QUEUE_MESSAGE_PRICE * index,
            _ => {}
        }
    }

    let boxes = nodes.iter().fold(0.0, |total, node| total + node.burn);
    let total = (if third_party > 0.0 { boxes + third_party } else { boxes })
        + game.salaries
        + egress
        + retrieval
        + requests;
    Bill { egress, retrieval, third_party, requests, total }
}

/// What one Service served: the request kinds its Features touch, summed.
#[derive(Clone, Default)]
pub struct ServiceRow {
    pub kinds: Vec<usize>,
    pub rate: f64,
    pub served: f64,
    pub satisfied: f64,
    pub latency: f64,
    pub p99: f64,
}

/// Burn split across kinds and Services, and each Service's figures.
#[derive(Default)]
pub struct Costs {
    /// Dollars per served request of each kind, in kind order where present.
    pub per_kind: Vec<(usize, f64)>,
    /// Dollars per second by Service index, in first-charged order.
    pub per_service: Vec<(usize, f64)>,
    pub services: Vec<ServiceRow>,
}

/// Unit economics and cost allocation: Burn split by each scored kind's share of demand.
pub fn costs_of(game: &GameCtx, kinds: &[KindRow], demand: f64, burn: f64) -> Costs {
    let mut costs = Costs { services: vec![ServiceRow::default(); game.service_count], ..Costs::default() };
    for (kind, entry) in kinds.iter().enumerate().take(NR) {
        if entry.rate <= 0.0 || !PROFILE_SCORED[kind] {
            continue;
        }
        let service = game.kind_service[kind];
        if let Some(work) = costs.services.get_mut(service) {
            let served = entry.rate * entry.success;
            work.kinds.push(kind);
            work.rate += entry.rate;
            work.served += served;
            work.satisfied += entry.rate * entry.apdex;
            work.latency += served * entry.mean;
            // `Math.max`, which keeps a NaN.
            work.p99 = if work.p99.is_nan() || entry.p99.is_nan() { f64::NAN } else { work.p99.max(entry.p99) };
        }
        if demand > 0.0 && burn > 0.0 {
            let kind_burn = burn * (entry.rate / demand);
            let served = entry.rate * entry.success;
            if served > 0.0 {
                costs.per_kind.push((kind, kind_burn / served));
            }
            match costs.per_service.iter_mut().find(|(at, _)| *at == service) {
                Some((_, total)) => *total += kind_burn,
                None => costs.per_service.push((service, 0.0 + kind_burn)),
            }
        }
    }
    costs
}

/// Traffic-weighted velocity of the App Servers' Stacks: language × framework.
pub fn velocity_of(game: &GameCtx, nodes: &[Node], rows: &[NodeRow]) -> f64 {
    let servers: Vec<usize> = (0..nodes.len()).filter(|slot| nodes[*slot].type_code == component::SERVER).collect();
    if servers.is_empty() {
        return 1.0;
    }
    let inbound = |slot: usize| rows.get(slot).map_or(0.0, |row| row.inbound);
    let traffic = servers.iter().fold(0.0, |total, slot| total + inbound(*slot));
    let verification = if game.has(research::FORMAL_VERIFICATION) { FORMAL_VERIFICATION_VELOCITY } else { 1.0 };
    servers.iter().fold(0.0, |total, &slot| {
        let node = &nodes[slot];
        let weight = if traffic > 0.0 { inbound(slot) / traffic } else { 1.0 / servers.len() as f64 };
        total
            + weight
                * LANGUAGE_VELOCITY[RUNTIME_LANGUAGE[node.runtime]]
                * verification
                * FRAMEWORK_VELOCITY[node.framework]
                * RUNTIME_VELOCITY[node.runtime]
    })
}
