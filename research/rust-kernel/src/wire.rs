//! The Ledger on the wire: one stream of `f64`s the host reads front to back,
//! in the order `ledger-wire.ts` decodes it. A record keeps its key order, and
//! a missing figure is a flag, so the host rebuilds the TypeScript `Ledger`
//! exactly: the same keys, in the same order, with the same nulls.

use crate::catalog::*;
use crate::dist::CAUSE_COUNT;
use crate::ledger::{Keyed, Ledger, NodeRow};
use crate::model::{Gauge, Order, Resources};

/// The stream, as the kernel writes it.
#[derive(Default)]
pub struct Wire(Vec<f64>);

impl Wire {
    #[inline]
    fn num(&mut self, value: f64) {
        self.0.push(value);
    }

    #[inline]
    fn flag(&mut self, on: bool) {
        self.num(if on { 1.0 } else { 0.0 });
    }

    /// A slot, or -1 for none.
    #[inline]
    fn slot(&mut self, slot: Option<usize>) {
        self.num(slot.map_or(-1.0, |slot| slot as f64));
    }

    /// A presence flag, then the value or 0.
    fn opt(&mut self, value: Option<f64>) {
        self.flag(value.is_some());
        self.num(value.unwrap_or(0.0));
    }

    fn pair(&mut self, value: Option<(f64, f64)>) {
        self.flag(value.is_some());
        let (a, b) = value.unwrap_or((0.0, 0.0));
        self.num(a);
        self.num(b);
    }

    fn gauge(&mut self, gauge: Option<Gauge>) {
        self.pair(gauge.map(|gauge| (gauge.used, gauge.total)));
    }

    /// A count, then each key and its value.
    fn keyed(&mut self, keyed: &Keyed) {
        self.num(keyed.keys.len() as f64);
        for (kind, value) in keyed.entries() {
            self.num(kind as f64);
            self.num(value);
        }
    }

    /// A count, then the keys.
    fn order(&mut self, order: &Order) {
        self.num(order.len() as f64);
        for kind in order.iter() {
            self.num(kind as f64);
        }
    }

    /// A count, then each kind with a non-zero value and the value, in kind order.
    fn by_kind(&mut self, values: &[f64]) {
        let present = values.iter().filter(|value| **value != 0.0).count();
        self.num(present as f64);
        for (kind, value) in values.iter().enumerate().filter(|(_, value)| **value != 0.0) {
            self.num(kind as f64);
            self.num(*value);
        }
    }

    fn resources(&mut self, resources: &Resources) {
        self.gauge(resources.cpu_cores);
        self.gauge(resources.ram_gb);
        self.gauge(resources.slots);
        self.gauge(resources.network_kbps);
        self.pair(resources.credits);
    }

    /// One Node row, in `NodeLedger`'s key order.
    fn node(&mut self, row: &NodeRow) {
        self.num(row.inbound);
        self.keyed(&row.traffic);
        self.num(row.capacity);
        self.num(row.utilization);
        self.num(row.limit as f64);
        self.num(row.latency);
        self.num(row.p99);
        self.keyed(&row.hop_by_kind);
        self.keyed(&row.wait_by_kind);
        self.keyed(&row.work_share);
        self.num(row.work_unit.map_or(-1.0, |unit| unit as usize as f64));
        self.num(row.cost);
        self.num(row.repeated);
        self.keyed(&row.origins);
        self.num(row.dropped);
        self.num(row.refused);
        self.num(row.stranded);
        self.order(&row.stranded_kinds);
        self.pair(row.connections);
        self.opt(row.hit_ratio);
        self.opt(row.evictions);
        self.opt(row.age);
        self.opt(row.lag_ms);
        self.flag(row.disk);
        self.keyed(&row.out);
        self.resources(&row.resources);
        self.flag(row.throttled);
        self.flag(row.swapping);
        self.num(row.status as usize as f64);
    }

    /// The Ledger, in `Ledger`'s key order, so the host decodes it into object
    /// literals as it reads.
    pub fn ledger(ledger: &Ledger) -> Vec<f64> {
        let mut wire = Wire(Vec::with_capacity(64 + ledger.nodes.len() * 96));
        wire.num(ledger.nodes.len() as f64);
        for row in &ledger.nodes {
            wire.node(row);
        }
        let kinds: Vec<usize> = (0..NR).filter(|kind| ledger.kinds[*kind].rate > 0.0).collect();
        wire.num(kinds.len() as f64);
        for kind in kinds {
            let row = ledger.kinds[kind];
            wire.num(kind as f64);
            for figure in [row.rate, row.success, row.apdex] {
                wire.num(figure);
            }
            wire.opt(row.completion);
            for figure in [row.mean, row.p50, row.p95, row.p99] {
                wire.num(figure);
            }
        }
        wire.num(ledger.demand);
        wire.num(ledger.served);
        for cause in 0..CAUSE_COUNT {
            wire.num(ledger.errors[cause]);
        }
        for figure in [ledger.error_share, ledger.latency, ledger.p50, ledger.p95, ledger.p99, ledger.apdex] {
            wire.num(figure);
        }
        wire.num(ledger.revenue);
        wire.num(ledger.subscriptions);
        wire.num(ledger.fines);
        wire.by_kind(&ledger.revenue_by_kind);
        wire.by_kind(&ledger.fines_by_kind);
        wire.num(ledger.failing.len() as f64);
        for kind in &ledger.failing {
            wire.num(*kind as f64);
        }
        wire.slot(ledger.bottleneck);
        let bottlenecks: Vec<(usize, usize)> = ledger
            .bottleneck_by_kind
            .iter()
            .enumerate()
            .filter_map(|(kind, slot)| slot.map(|slot| (kind, slot)))
            .collect();
        wire.num(bottlenecks.len() as f64);
        for (kind, slot) in bottlenecks {
            wire.num(kind as f64);
            wire.num(slot as f64);
        }
        wire.0
    }
}
