use crate::catalog::*;
use crate::ledger::{KindRow, NodeRow};
use crate::model::{GameCtx, Node};
use crate::pass::Pass;
use crate::routing::Design;

const KB_PER_GB: f64 = 1_000_000.0;
const MS_PER_SECOND: f64 = 1_000.0;
const TOKENS_PER_THOUSAND: f64 = 1_000.0;
const BILLED_BOTH_WAYS: f64 = 2.0;

#[derive(Clone, Copy, Default)]
pub struct Bill {
    pub egress: f64,
    pub retrieval: f64,
    pub third_party: f64,
    pub requests: f64,
    pub total: f64,
}

pub mod egress {
    pub const NONE: u8 = 0;
    pub const CROSS_ZONE: u8 = 1;
    pub const CROSS_REGION: u8 = 2;
}

fn mean_service_of(pass: &Pass, slot: usize) -> f64 {
    let rates = pass.rates(slot);
    let Some(model) = pass.models.get(slot) else {
        return 0.0;
    };
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
    if rate > 0.0 {
        spent / rate + cold
    } else {
        cold
    }
}

pub fn bill_of(
    game: &GameCtx,
    design: &Design,
    nodes: &[Node],
    pass: &Pass,
    rows: &[NodeRow],
    kinds: &[KindRow],
) -> Bill {
    let cost_index = game.cost_index;
    let completed_of = |slot: usize| {
        rows.get(slot).map_or(0.0, |row| row.inbound)
            - rows.get(slot).map_or(0.0, |row| row.dropped)
    };

    let mut egress = 0.0;
    if game.stage >= 2.0 {
        let r2_researched = game.has(research::EGRESS_OPTIMIZATION);
        for (slot, node) in nodes.iter().enumerate() {
            if node.type_code == component::SERVER {
                let own = rows.get(slot);
                let bytes = own
                    .and_then(|own| own.resources.network_kbps)
                    .map_or(0.0, |gauge| gauge.used);

                let r2_share = match own {
                    Some(own)
                        if r2_researched
                            && own.inbound > 0.0
                            && design.out_edges_of(slot).iter().any(|&edge| {
                                let child = &nodes[design.edges[edge as usize].to as usize];
                                child.type_code == component::STORAGE && child.r2
                            }) =>
                    {
                        (own.traffic.values[kind::UPLOAD] + own.traffic.values[kind::MEDIA])
                            / own.inbound
                    }
                    _ => 0.0,
                };
                egress += ((bytes * (1.0 - r2_share)) / KB_PER_GB) * EGRESS_ORIGIN;
            }
            if node.type_code == component::CDN && !node.down {
                let rates = pass.rates(slot);
                for kind in 0..NR {
                    egress += ((rates[kind]
                        * crate::model::cdn_hit(game, node, kind)
                        * PROFILE_PAYLOAD_KB[kind])
                        / KB_PER_GB)
                        * EGRESS_CDN;
                }
            }
        }

        for &edge in &pass.link_order {
            let Some(route) = design.edges.get(edge) else {
                continue;
            };
            if route.egress == egress::NONE {
                continue;
            }
            let carried = &pass.links[edge];
            for kind in pass.link_kinds[edge].iter() {
                let rate = carried[kind];
                let kb = if kind >= NR {
                    BACKEND_KB
                } else {
                    PROFILE_PAYLOAD_KB[kind]
                };
                egress += if route.egress == egress::CROSS_REGION {
                    ((rate * kb) / KB_PER_GB) * EGRESS_CROSS_REGION
                } else {
                    ((rate * kb) / KB_PER_GB) * EGRESS_CROSS_ZONE * BILLED_BOTH_WAYS
                };
            }
        }

        for (slot, node) in nodes.iter().enumerate() {
            if node.type_code != component::WIDE || !node.spread || node.down {
                continue;
            }
            let regions = game.spread_region_bits;
            if regions <= 1.0 {
                continue;
            }
            let arriving = pass.rates(slot);
            let writes = arriving[kind::Q_WRITE] + arriving[kind::Q_TX] + arriving[kind::K_WRITE];
            egress += ((writes * (regions - 1.0) * SPREAD_REPLICATION_KB) / KB_PER_GB)
                * EGRESS_CROSS_REGION;
        }
        egress *= cost_index * game.egress_factor;
    }

    let mut retrieval = 0.0;
    for (slot, node) in nodes.iter().enumerate() {
        if node.type_code != component::STORAGE || node.down || node.retrieval <= 0.0 {
            continue;
        }
        let reads = pass.rates(slot)[kind::BLOB_GET];
        retrieval +=
            ((reads * PROFILE_PAYLOAD_KB[kind::MEDIA]) / KB_PER_GB) * node.retrieval * cost_index;
    }

    let buy = kinds[kind::BUY];
    let checkouts = if buy.rate > 0.0 {
        buy.rate * buy.success
    } else {
        0.0
    };
    let has_second_provider = nodes
        .iter()
        .any(|node| node.type_code == component::PSP && node.second_provider);
    let psp_fees = if checkouts > 0.0 {
        checkouts
            * (KIND_VALUE[kind::BUY] * game.value[kind::BUY] * PSP_RATE + PSP_FIXED)
            * if has_second_provider {
                SECOND_PROVIDER_FEE
            } else {
                1.0
            }
    } else {
        0.0
    };

    let mut usage_fees = 0.0;
    for (slot, node) in nodes.iter().enumerate() {
        let completed = completed_of(slot);
        if completed <= 0.0 || node.down {
            continue;
        }
        match node.type_code {
            component::WAREHOUSE => usage_fees += completed * SCAN_PRICE,
            component::LLM => {
                usage_fees += ((completed * TOKENS_PER_PROMPT) / TOKENS_PER_THOUSAND) * LLM_PRICE
            }
            component::MSGP => usage_fees += completed * MSGP_PRICE,
            _ => {}
        }
    }
    let third_party = if usage_fees > 0.0 {
        psp_fees + usage_fees * cost_index
    } else {
        psp_fees
    };

    let mut requests = 0.0;
    let gateway_kept_share = crate::pass::gateway_kept_share(nodes, &pass.arriving, &pass.order);
    for (slot, node) in nodes.iter().enumerate() {
        if node.down {
            continue;
        }
        let completed = completed_of(slot);
        if completed <= 0.0 {
            continue;
        }
        match node.type_code {
            component::GW => requests += completed * gateway_kept_share * GATEWAY_PRICE,
            component::FN => {
                requests += completed
                    * (SERVERLESS_REQUEST_PRICE
                        + SERVERLESS_GB_SECOND
                            * SERVERLESS_MEMORY_GB
                            * (mean_service_of(pass, slot) / MS_PER_SECOND))
                    * cost_index;
            }
            component::EDGE => requests += completed * EDGE_REQUEST_PRICE * cost_index,
            component::STORAGE => {
                let arriving = pass.rates(slot);
                requests += (arriving[kind::BLOB_GET] * node.store_get
                    + arriving[kind::BLOB_PUT] * node.store_put)
                    * cost_index;
            }
            component::QUEUE => requests += completed * QUEUE_MESSAGE_PRICE * cost_index,
            _ => {}
        }
    }

    let box_burn = nodes.iter().fold(0.0, |total, node| total + node.burn);
    let total = (if third_party > 0.0 {
        box_burn + third_party
    } else {
        box_burn
    }) + game.salaries
        + egress
        + retrieval
        + requests;
    Bill {
        egress,
        retrieval,
        third_party,
        requests,
        total,
    }
}

#[derive(Clone, Default)]
pub struct ServiceRow {
    pub kinds: Vec<usize>,
    pub rate: f64,
    pub served: f64,
    pub satisfied: f64,
    pub latency: f64,
    pub p99: f64,
}

#[derive(Default)]
pub struct Costs {
    pub per_kind: Vec<(usize, f64)>,

    pub per_service: Vec<(usize, f64)>,
    pub services: Vec<ServiceRow>,
}

pub fn costs_of(game: &GameCtx, kinds: &[KindRow], demand: f64, burn: f64) -> Costs {
    let mut costs = Costs {
        services: vec![ServiceRow::default(); game.service_count],
        ..Costs::default()
    };
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

            work.p99 = if work.p99.is_nan() || entry.p99.is_nan() {
                f64::NAN
            } else {
                work.p99.max(entry.p99)
            };
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

pub fn velocity_of(game: &GameCtx, nodes: &[Node], rows: &[NodeRow]) -> f64 {
    let servers: Vec<usize> = (0..nodes.len())
        .filter(|slot| nodes[*slot].type_code == component::SERVER)
        .collect();
    if servers.is_empty() {
        return 1.0;
    }
    let inbound = |slot: usize| rows.get(slot).map_or(0.0, |row| row.inbound);
    let traffic = servers
        .iter()
        .fold(0.0, |total, slot| total + inbound(*slot));
    let verification = if game.has(research::FORMAL_VERIFICATION) {
        FORMAL_VERIFICATION_VELOCITY
    } else {
        1.0
    };
    servers.iter().fold(0.0, |total, &slot| {
        let node = &nodes[slot];
        let weight = if traffic > 0.0 {
            inbound(slot) / traffic
        } else {
            1.0 / servers.len() as f64
        };
        total
            + weight
                * LANGUAGE_VELOCITY[RUNTIME_LANGUAGE[node.runtime]]
                * verification
                * FRAMEWORK_VELOCITY[node.framework]
                * RUNTIME_VELOCITY[node.runtime]
    })
}
