//! The flat ABI the harness calls: named blocks in memory this crate owns.
//!
//! Every input and output is a `Vec` inside one of two arenas. The host asks for
//! a block's pointer with `ptr`, fills it through a `Float64Array` view, then
//! calls a run function that reads the block with checked indexing. Nothing here
//! uses `unsafe`: a short, unknown, or out-of-range block makes a run function
//! return a status code instead of trapping, and the host re-reads `ptr` after
//! any call that may grow memory, because a grown memory detaches its views.
//!
//! Block ids are stable: they are the ABI.

use crate::catalog::*;
use crate::model::*;

// ---- the scalar block: one row per Node, plus the Game's own slots ----

pub const S_USERS: usize = 0;
pub const S_SEED: usize = 1;
pub const S_TIME: usize = 2;
pub const S_SANDBOX: usize = 3;
pub const S_SCENARIO_TASKS: usize = 4;
pub const S_INCIDENT_NODE: usize = 5;
pub const S_SIZE: usize = 6;
pub const S_WORKERS: usize = 7;
pub const S_REPLICAS: usize = 8;
pub const S_RUNTIME: usize = 9;
pub const S_FRAMEWORK: usize = 10;
pub const S_FAMILY: usize = 11;
pub const S_COMPRESS: usize = 12;
pub const S_LOCAL_DB: usize = 13;
pub const S_LEAK: usize = 14;
pub const S_CREDITS: usize = 15;
pub const S_PREFETCH: usize = 16;
pub const S_PM: usize = 17;
pub const S_GOGC: usize = 18;
pub const S_COLLECTOR: usize = 19;
pub const S_RECYCLE: usize = 20;
pub const S_WARM: usize = 21;
pub const S_DOWN: usize = 22;
pub const S_ZONE: usize = 23;
pub const S_REGION: usize = 24;
pub const S_DB_ENGINE: usize = 25;
pub const S_BOOST: usize = 26;
pub const S_INFLIGHT: usize = 27;
pub const S_SAMPLING: usize = 28;
pub const S_HASHING: usize = 29;
pub const S_DELEGATED: usize = 30;
pub const S_LOCAL: usize = 31;
pub const S_OFFLOADED: usize = 32;
pub const S_WORKER: usize = 33;
pub const S_POD: usize = 34;
pub const S_MESH: usize = 35;
pub const S_TYPE_CODE: usize = 36;
pub const S_ID: usize = 37;
pub const S_INCIDENT: usize = 38;
pub const S_SHARDS: usize = 39;
pub const S_SHARD_KEY: usize = 40;
pub const S_IOPS: usize = 41;
pub const S_KEEP: usize = 42;
pub const S_TOPOLOGY: usize = 43;
pub const S_DEPTH: usize = 44;
pub const S_CONNECTIONS: usize = 45;
pub const S_USERS_IN_GROUP: usize = 46;
pub const S_SERVICE_INDEXES: usize = 47;
pub const S_STAGE: usize = 48;
pub const S_VENTURE: usize = 49;
pub const S_FIXED_MIX: usize = 50;
pub const S_SCENARIO_DAILY: usize = 51;
pub const S_VARIANT: usize = 52;
pub const S_POLICY: usize = 53;
pub const S_STICKY: usize = 54;
pub const S_FANOUT: usize = 55;
pub const S_MODE: usize = 56;
pub const S_MATERIALIZED: usize = 57;
pub const S_SYNC: usize = 58;
pub const S_RYW: usize = 59;
pub const S_CERT_UNTIL: usize = 60;
pub const S_RATE_LIMIT: usize = 61;
pub const S_BURST: usize = 62;
pub const S_MAX_LENGTH: usize = 63;
pub const S_DLQ: usize = 64;
pub const S_ATTEMPTS: usize = 65;
pub const S_BLAST: usize = 66;
pub const S_BUGGY: usize = 67;
pub const S_DATABASES_IN_GROUP: usize = 68;
pub const S_SYNC_STALLED: usize = 69;
pub const S_PRIMARY: usize = 70;
pub const S_POISONED: usize = 71;
pub const S_TRANSACTIONS: usize = 72;
pub const S_SAMPLING_MS: usize = 73;
pub const S_DOWN_OOM: usize = 74;
/// The fixes the Company's Service has shipped, as a bitset over `FIXES`. Row 0 only.
pub const S_FIXES: usize = 75;
pub const S_R2: usize = 76;
pub const S_ARCHIVED: usize = 77;
pub const S_SEARCH_VARIANT: usize = 78;
pub const S_SEARCH_SHARDS: usize = 79;
pub const S_HEAP: usize = 80;
pub const S_SEARCH_REPLICAS: usize = 81;
pub const S_REFRESH: usize = 82;
pub const S_SECOND_PROVIDER: usize = 83;
pub const S_GPU: usize = 84;
pub const S_GPU_MODEL: usize = 85;
pub const S_PRECISION: usize = 86;
pub const S_BATCH: usize = 87;
pub const S_QUORUM_N: usize = 88;
pub const S_QUORUM_R: usize = 89;
pub const S_QUORUM_W: usize = 90;
pub const S_LOST: usize = 91;
pub const S_SPREAD: usize = 92;
pub const S_DATA_STAFFED: usize = 93;
pub const S_CACHE_ENGINE: usize = 94;
pub const S_TTL: usize = 95;
pub const S_SWR: usize = 96;
pub const S_EARLY_EXPIRY: usize = 97;
pub const S_COALESCE: usize = 98;
pub const S_CACHE_STRATEGY: usize = 99;
pub const S_SPLIT: usize = 100;
pub const S_PARANOIA: usize = 101;
pub const S_UNDER_ATTACK: usize = 102;
pub const S_INCIDENT_STARTED: usize = 103;
pub const S_INCIDENT_REGION: usize = 104;
pub const S_CHAOS_TARGET: usize = 105;
pub const S_RAMPED: usize = 106;
pub const S_CLUSTER: usize = 107;
pub const S_DEPLOY_SHARE: usize = 108;
pub const S_DEPLOY_KINDS: usize = 109;
pub const S_RUNTIME_FAILURE: usize = 110;
pub const S_INDEX_TYPE: usize = 111;
pub const S_STALE_UNTIL: usize = 112;
pub const S_CACHE_KEY: usize = 113;
pub const S_PRESENCE: usize = 114;
pub const S_BACKOFF: usize = 115;
pub const S_CLUSTERING: usize = 116;
pub const S_WARMING: usize = 117;
pub const S_INCIDENT_THROTTLED: usize = 118;
pub const S_PARTITIONS: usize = 119;
pub const S_ACKS: usize = 120;
pub const S_RETAIN: usize = 121;
pub const S_KEYED: usize = 122;
pub const S_AUTH_EDGE: usize = 123;
pub const S_MERGE: usize = 124;
pub const S_SHUT: usize = 125;
pub const S_DATA: usize = 126;
pub const S_SUBSCRIPTIONS: usize = 127;
pub const SCALARS: usize = 128;

/// The node-fields block: one row per Node, read by the routing Design.
pub const NODE_FIELDS: usize = 10;
/// The edge-fields block: one row per Edge.
pub const EDGE_FIELDS: usize = 9;

// ---- block ids ----

pub const BLOCK_SCALARS: i32 = 1;
pub const BLOCK_NODE_FIELDS: i32 = 2;
pub const BLOCK_EDGE_FIELDS: i32 = 3;
pub const BLOCK_OUT_STARTS: i32 = 4;
pub const BLOCK_OUT_EDGES: i32 = 5;
pub const BLOCK_WEIGHTS: i32 = 6;
pub const BLOCK_NOMINAL: i32 = 7;
pub const BLOCK_SICK: i32 = 8;
pub const BLOCK_DEMAND: i32 = 9;
pub const BLOCK_INTAKE: i32 = 10;
pub const BLOCK_LATENCY: i32 = 11;
/// `payloadFactor` per request kind: how big a response is with the shipped Features.
pub const BLOCK_PAYLOAD: i32 = 12;
pub const BLOCK_PROBE: i32 = 13;
pub const BLOCK_ROUTES: i32 = 14;
/// `valueFactor` per request kind: the Features, the levers, the Venture, and the Scenario.
pub const BLOCK_VALUE: i32 = 15;
pub const BLOCK_RESEARCH: i32 = 16;
/// `queryFactor` per backend kind: what one query costs with the shipped Features.
pub const BLOCK_QUERY: i32 = 17;
pub const BLOCK_ARRIVING: i32 = 20;
pub const BLOCK_MODELS: i32 = 21;
pub const BLOCK_OUTCOMES: i32 = 22;
pub const BLOCK_LEDGER: i32 = 23;
pub const BLOCK_SUMMARY: i32 = 24;
pub const BLOCK_SPLITS: i32 = 25;
pub const BLOCK_DIST_IN: i32 = 30;
pub const BLOCK_DIST_OUT: i32 = 31;
pub const BLOCK_DIST_CALLS: i32 = 32;

/// Status codes a run function returns.
pub const OK: i32 = 0;
pub const UNKNOWN_BLOCK: i32 = 1;
pub const NO_DESIGN: i32 = 2;
pub const SHORT_BLOCK: i32 = 3;
pub const BAD_EDGE: i32 = 4;
pub const TOO_LARGE: i32 = 5;
pub const UNSUPPORTED: i32 = 6;

/// The input blocks: everything the host writes before a run.
#[derive(Default)]
pub struct Inputs {
    pub scalars: Vec<f64>,
    pub node_fields: Vec<f64>,
    pub edge_fields: Vec<f64>,
    pub out_starts: Vec<i32>,
    pub out_edges: Vec<i32>,
    pub weights: Vec<f64>,
    pub nominal: Vec<f64>,
    pub sick: Vec<u8>,
    pub demand: Vec<f64>,
    pub intake: Vec<f64>,
    pub latency: Vec<f64>,
    pub payload: Vec<f64>,
    pub value: Vec<f64>,
    pub probe: Vec<f64>,
    pub routes: Vec<f64>,
    pub research: Vec<u8>,
    pub query: Vec<f64>,
}

/// The output blocks: everything a run writes, and the two scratch blocks the
/// Outcome algebra's harness reads and writes.
#[derive(Default)]
pub struct Outputs {
    pub arriving: Vec<f64>,
    pub models: Vec<f64>,
    pub outcomes: Vec<f64>,
    pub ledger: Vec<f64>,
    pub summary: Vec<f64>,
    pub splits: Vec<f64>,
    pub dist_in: Vec<f64>,
    pub dist_out: Vec<f64>,
    pub dist_calls: Vec<f64>,
}

impl Inputs {
    /// The Game's slots, one row at index 0 of the scalar block.
    #[inline]
    pub fn scalar(&self, slot: usize) -> f64 {
        self.scalars.get(slot).copied().unwrap_or(0.0)
    }

    /// One slot of every Node's row, as a column.
    pub fn column(&self, slot: usize) -> Vec<f64> {
        let count = self.scalars.len() / SCALARS;
        (0..count)
            .map(|node| self.scalars.get(node * SCALARS + slot).copied().unwrap_or(0.0))
            .collect()
    }

    /// One slot of every Node's row, as flags.
    pub fn flags(&self, slot: usize) -> Vec<bool> {
        self.column(slot).into_iter().map(|value| value != 0.0).collect()
    }

    /// One Node's scalar row, or zeroes when the block is short.
    #[inline]
    pub fn row(&self, node: usize) -> &[f64] {
        let start = node.saturating_mul(SCALARS);
        match self.scalars.get(start..start + SCALARS) {
            Some(row) => row,
            None => &[],
        }
    }
}

thread_local! {
    static INPUT: core::cell::RefCell<Inputs> = core::cell::RefCell::new(Inputs::default());
    static OUTPUT: core::cell::RefCell<Outputs> = core::cell::RefCell::new(Outputs::default());
}

/// Reads the input arena. Never held across a call that borrows it again.
pub fn with_inputs<R>(read: impl FnOnce(&Inputs) -> R) -> R {
    INPUT.with(|cell| read(&cell.borrow()))
}

/// Writes the output arena.
pub fn with_outputs<R>(write: impl FnOnce(&mut Outputs) -> R) -> R {
    OUTPUT.with(|cell| write(&mut cell.borrow_mut()))
}

/// The number of `f64`s one scalar row holds, so the host builds a batch.
#[no_mangle]
pub extern "C" fn scalar_len() -> i32 {
    SCALARS as i32
}

/// The scalar row's stride, under the name the harness already used.
#[no_mangle]
pub extern "C" fn node_field_len() -> i32 {
    NODE_FIELDS as i32
}

#[no_mangle]
pub extern "C" fn edge_field_len() -> i32 {
    EDGE_FIELDS as i32
}

/// Resizes a block so the host can fill it. Returns `OK` or `UNKNOWN_BLOCK`.
#[no_mangle]
pub extern "C" fn reserve(block: i32, len: i32) -> i32 {
    let want = len.max(0) as usize;
    let sized = INPUT.with(|cell| {
        let mut inputs = cell.borrow_mut();
        match block {
            BLOCK_SCALARS => Some(&mut inputs.scalars),
            BLOCK_NODE_FIELDS => Some(&mut inputs.node_fields),
            BLOCK_EDGE_FIELDS => Some(&mut inputs.edge_fields),
            BLOCK_WEIGHTS => Some(&mut inputs.weights),
            BLOCK_NOMINAL => Some(&mut inputs.nominal),
            BLOCK_DEMAND => Some(&mut inputs.demand),
            BLOCK_INTAKE => Some(&mut inputs.intake),
            BLOCK_LATENCY => Some(&mut inputs.latency),
            BLOCK_PAYLOAD => Some(&mut inputs.payload),
            BLOCK_QUERY => Some(&mut inputs.query),
            BLOCK_VALUE => Some(&mut inputs.value),
            BLOCK_PROBE => Some(&mut inputs.probe),
            BLOCK_ROUTES => Some(&mut inputs.routes),
            _ => None,
        }
        .map(|values| {
            values.clear();
            values.resize(want, 0.0);
        })
        .is_some()
    });
    if sized {
        return OK;
    }
    let sized = INPUT.with(|cell| {
        let mut inputs = cell.borrow_mut();
        match block {
            BLOCK_OUT_STARTS => Some(&mut inputs.out_starts),
            BLOCK_OUT_EDGES => Some(&mut inputs.out_edges),
            _ => None,
        }
        .map(|values| {
            values.clear();
            values.resize(want, 0);
        })
        .is_some()
    });
    if sized {
        return OK;
    }
    let sized = INPUT.with(|cell| {
        let mut inputs = cell.borrow_mut();
        match block {
            BLOCK_SICK => Some(&mut inputs.sick),
            BLOCK_RESEARCH => Some(&mut inputs.research),
            _ => None,
        }
        .map(|values| {
            values.clear();
            values.resize(want, 0);
        })
        .is_some()
    });
    if sized {
        return OK;
    }
    let sized = OUTPUT.with(|cell| {
        let mut outputs = cell.borrow_mut();
        match block {
            BLOCK_ARRIVING => Some(&mut outputs.arriving),
            BLOCK_MODELS => Some(&mut outputs.models),
            BLOCK_OUTCOMES => Some(&mut outputs.outcomes),
            BLOCK_LEDGER => Some(&mut outputs.ledger),
            BLOCK_SUMMARY => Some(&mut outputs.summary),
            BLOCK_SPLITS => Some(&mut outputs.splits),
            BLOCK_DIST_IN => Some(&mut outputs.dist_in),
            BLOCK_DIST_OUT => Some(&mut outputs.dist_out),
            BLOCK_DIST_CALLS => Some(&mut outputs.dist_calls),
            _ => None,
        }
        .map(|values| {
            values.clear();
            values.resize(want, 0.0);
        })
        .is_some()
    });
    if sized {
        OK
    } else {
        UNKNOWN_BLOCK
    }
}

/// A block's address in linear memory, or 0 for an unknown id. The host writes
/// through a typed-array view of it, and must ask again after memory grows.
#[no_mangle]
pub extern "C" fn ptr(block: i32) -> usize {
    let address = INPUT.with(|cell| {
        let inputs = cell.borrow();
        match block {
            BLOCK_SCALARS => Some(inputs.scalars.as_ptr()),
            BLOCK_NODE_FIELDS => Some(inputs.node_fields.as_ptr().cast::<f64>()),
            BLOCK_EDGE_FIELDS => Some(inputs.edge_fields.as_ptr()),
            BLOCK_WEIGHTS => Some(inputs.weights.as_ptr()),
            BLOCK_NOMINAL => Some(inputs.nominal.as_ptr()),
            BLOCK_DEMAND => Some(inputs.demand.as_ptr()),
            BLOCK_INTAKE => Some(inputs.intake.as_ptr()),
            BLOCK_LATENCY => Some(inputs.latency.as_ptr()),
            BLOCK_PAYLOAD => Some(inputs.payload.as_ptr()),
            BLOCK_QUERY => Some(inputs.query.as_ptr()),
            BLOCK_VALUE => Some(inputs.value.as_ptr()),
            BLOCK_PROBE => Some(inputs.probe.as_ptr()),
            BLOCK_ROUTES => Some(inputs.routes.as_ptr()),
            BLOCK_OUT_STARTS => Some(inputs.out_starts.as_ptr().cast::<f64>()),
            BLOCK_OUT_EDGES => Some(inputs.out_edges.as_ptr().cast::<f64>()),
            BLOCK_SICK => Some(inputs.sick.as_ptr().cast::<f64>()),
            BLOCK_RESEARCH => Some(inputs.research.as_ptr().cast::<f64>()),
            _ => None,
        }
    });
    if let Some(address) = address {
        return address as usize;
    }
    OUTPUT.with(|cell| {
        let outputs = cell.borrow();
        let address = match block {
            BLOCK_ARRIVING => Some(outputs.arriving.as_ptr()),
            BLOCK_MODELS => Some(outputs.models.as_ptr()),
            BLOCK_OUTCOMES => Some(outputs.outcomes.as_ptr()),
            BLOCK_LEDGER => Some(outputs.ledger.as_ptr()),
            BLOCK_SUMMARY => Some(outputs.summary.as_ptr()),
            BLOCK_SPLITS => Some(outputs.splits.as_ptr()),
            BLOCK_DIST_IN => Some(outputs.dist_in.as_ptr()),
            BLOCK_DIST_OUT => Some(outputs.dist_out.as_ptr()),
            BLOCK_DIST_CALLS => Some(outputs.dist_calls.as_ptr()),
            _ => None,
        };
        address.map(|pointer| pointer as usize).unwrap_or(0)
    })
}

/// A block's length in elements, or 0 for an unknown id.
#[no_mangle]
pub extern "C" fn len(block: i32) -> i32 {
    let count = INPUT.with(|cell| {
        let inputs = cell.borrow();
        match block {
            BLOCK_SCALARS => Some(inputs.scalars.len()),
            BLOCK_NODE_FIELDS => Some(inputs.node_fields.len()),
            BLOCK_EDGE_FIELDS => Some(inputs.edge_fields.len()),
            BLOCK_WEIGHTS => Some(inputs.weights.len()),
            BLOCK_NOMINAL => Some(inputs.nominal.len()),
            BLOCK_DEMAND => Some(inputs.demand.len()),
            BLOCK_INTAKE => Some(inputs.intake.len()),
            BLOCK_LATENCY => Some(inputs.latency.len()),
            BLOCK_PAYLOAD => Some(inputs.payload.len()),
            BLOCK_QUERY => Some(inputs.query.len()),
            BLOCK_VALUE => Some(inputs.value.len()),
            BLOCK_PROBE => Some(inputs.probe.len()),
            BLOCK_ROUTES => Some(inputs.routes.len()),
            BLOCK_OUT_STARTS => Some(inputs.out_starts.len()),
            BLOCK_OUT_EDGES => Some(inputs.out_edges.len()),
            BLOCK_SICK => Some(inputs.sick.len()),
            BLOCK_RESEARCH => Some(inputs.research.len()),
            _ => None,
        }
    });
    if let Some(count) = count {
        return count as i32;
    }
    OUTPUT.with(|cell| {
        let outputs = cell.borrow();
        let count = match block {
            BLOCK_ARRIVING => Some(outputs.arriving.len()),
            BLOCK_MODELS => Some(outputs.models.len()),
            BLOCK_OUTCOMES => Some(outputs.outcomes.len()),
            BLOCK_LEDGER => Some(outputs.ledger.len()),
            BLOCK_SUMMARY => Some(outputs.summary.len()),
            BLOCK_SPLITS => Some(outputs.splits.len()),
            BLOCK_DIST_IN => Some(outputs.dist_in.len()),
            BLOCK_DIST_OUT => Some(outputs.dist_out.len()),
            BLOCK_DIST_CALLS => Some(outputs.dist_calls.len()),
            _ => None,
        };
        count.map(|count| count as i32).unwrap_or(0)
    })
}

// ---- reading a Game out of the blocks ----

/// The research bitset, built once for a batch of Nodes.
pub type Research = [u64; 4];

#[inline]
fn bit(bytes: &[u8], index: usize) -> bool {
    match bytes.get(index / 8) {
        Some(byte) => (byte >> (index % 8)) & 1 == 1,
        None => false,
    }
}

pub fn research_of(bytes: &[u8]) -> Research {
    let mut research = [0u64; 4];
    for index in 0..RESEARCH_COUNT {
        if bit(bytes, index) {
            research[index / 64] |= 1 << (index % 64);
        }
    }
    research
}

/// The incident the host writes, as its index into `INCIDENT_IDS` plus one, 0
/// for none. Only the kinds a ported model reads have a variant.
fn incident_of(code: usize) -> Option<Incident> {
    let id = INCIDENT_IDS.get(code.checked_sub(1)?)?;
    Some(match *id {
        "gc-storm" => Incident::GcStorm,
        "loop" => Incident::Loop,
        "connections" => Incident::Connections,
        "retry-storm" => Incident::RetryStorm,
        "slow-query" => Incident::SlowQuery,
        "report-db" => Incident::ReportDb,
        "hot-shard" => Incident::HotShard,
        "table-bloat" => Incident::TableBloat,
        "stuffing" => Incident::Stuffing,
        "repl-lag" => Incident::ReplLag,
        "reconnect" => Incident::Reconnect,
        "split-brain" => Incident::SplitBrain,
        "hot-key" => Incident::HotKey,
        "regex" => Incident::Regex,
        "stale-read" => Incident::StaleRead,
        "zone" => Incident::Zone,
        "region" => Incident::Region,
        "dr-drill" => Incident::DrDrill,
        "bgp" => Incident::Bgp,
        "certificate" => Incident::Certificate,
        "double-charge" => Incident::DoubleCharge,
        "psp-outage" => Incident::PspOutage,
        "partition" => Incident::Partition,
        "leap-second" => Incident::LeapSecond,
        "mtu" => Incident::Mtu,
        "jvm-warmup" => Incident::JvmWarmup,
        "poison" => Incident::Poison,
        "disk-full" => Incident::DiskFull,
        "migration-lock" => Incident::MigrationLock,
        "accidental-delete" => Incident::AccidentalDelete,
        "bad-deploy" => Incident::BadDeploy,
        "cluster-upgrade" => Incident::ClusterUpgrade,
        "latency-regression" => Incident::LatencyRegression,
        // Demand surges, outages the host writes as down Nodes or routes, and
        // the runtime failures `runtime_failure` carries.
        _ => Incident::Elsewhere,
    })
}

/// A slot the host wrote as a Node index, or `usize::MAX` for none: `-1.0 as
/// usize` saturates to 0, which would name the first Node.
fn slot_of(value: f64) -> usize {
    if value >= 0.0 { value as usize } else { usize::MAX }
}

/// The Game context: row 0 of the scalar block, plus the two bitsets.
pub fn game_with(scalars: &[f64], research: Research) -> GameCtx {
    let slot = |index: usize| scalars.get(index).copied().unwrap_or(0.0);
    let incident_code = slot(S_INCIDENT) as usize;
    GameCtx {
        users: slot(S_USERS),
        researched: research,
        incident: incident_of(incident_code),
        incident_code,
        incident_node: slot_of(slot(S_INCIDENT_NODE)),
        incident_throttled: slot(S_INCIDENT_THROTTLED) != 0.0,
        incident_region: (slot(S_INCIDENT_REGION) >= 0.0).then(|| slot(S_INCIDENT_REGION) as usize),
        chaos_target: (slot(S_CHAOS_TARGET) >= 0.0).then(|| slot(S_CHAOS_TARGET) as usize),
        cert_nodes: false,
        sandbox: slot(S_SANDBOX) != 0.0,
        scenario_tasks: slot(S_SCENARIO_TASKS) != 0.0,
        fixes: slot(S_FIXES) as u64,
        data_staffed: slot(S_DATA_STAFFED) != 0.0,
        cdn_on_board: false,
        edge_on_board: false,
        edge_auth: false,
        data: slot(S_DATA),
        static_pages: 0.0,
        spread_regions: 1.0,
        value: [1.0; NR],
        payload: [1.0; NR],
        query: [1.0; NB],
        subscriptions: slot(S_SUBSCRIPTIONS),
        mix: [0.0; NR],
        seed: slot(S_SEED),
        time: slot(S_TIME),
        incident_started: slot(S_INCIDENT_STARTED),
        service_count: 1,
        service_indexes: slot(S_SERVICE_INDEXES),
        stage: slot(S_STAGE),
        venture: slot(S_VENTURE) as usize,
        fixed_mix: slot(S_FIXED_MIX) != 0.0,
        scenario_daily: slot(S_SCENARIO_DAILY) != 0.0,
        deploy_share: slot(S_DEPLOY_SHARE),
        deploy_kinds: slot(S_DEPLOY_KINDS) as u64,
        runtime_failure: slot(S_RUNTIME_FAILURE),
    }
}

/// One Node's row of the scalar block.
pub fn node_of(row: &[f64]) -> Node {
    let slot = |index: usize| row.get(index).copied().unwrap_or(0.0);
    let flag = |index: usize| slot(index) != 0.0;
    let cert = slot(S_CERT_UNTIL);
    Node {
        id: slot(S_ID) as usize,
        type_code: slot(S_TYPE_CODE) as usize,
        size: slot(S_SIZE),
        workers: slot(S_WORKERS),
        replicas: slot(S_REPLICAS),
        runtime: slot(S_RUNTIME) as usize,
        framework: slot(S_FRAMEWORK) as usize,
        family: slot(S_FAMILY) as usize,
        compress: flag(S_COMPRESS),
        local_db: flag(S_LOCAL_DB),
        leak: slot(S_LEAK),
        credits: slot(S_CREDITS),
        prefetch: slot(S_PREFETCH),
        pm: slot(S_PM) as usize,
        gogc: slot(S_GOGC) as usize,
        collector: slot(S_COLLECTOR) as usize,
        recycle: flag(S_RECYCLE),
        warm: slot(S_WARM),
        down: flag(S_DOWN),
        zone: slot(S_ZONE) as usize,
        region: slot(S_REGION) as usize,
        db_engine: slot(S_DB_ENGINE) as usize,
        ryw: flag(S_RYW),
        materialized: flag(S_MATERIALIZED),
        shed: false,
        degrade: false,
        sticky: flag(S_STICKY),
        fanout: slot(S_FANOUT) as u8,
        policy: slot(S_POLICY) as usize,
        variant: slot(S_VARIANT) as usize,
        depth: slot(S_DEPTH),
        shards: slot(S_SHARDS),
        shard_key: slot(S_SHARD_KEY) as usize,
        iops: slot(S_IOPS) as usize,
        keep: slot(S_KEEP) as usize,
        topology: slot(S_TOPOLOGY) as usize,
        mode: slot(S_MODE) as usize,
        sync: flag(S_SYNC),
        cert_until: if cert > 0.0 { Some(cert) } else { None },
        rate_limit: slot(S_RATE_LIMIT),
        burst: slot(S_BURST),
        max_length: slot(S_MAX_LENGTH),
        dlq: flag(S_DLQ),
        attempts: slot(S_ATTEMPTS),
        transactions: flag(S_TRANSACTIONS),
        blast: {
            let blast = slot(S_BLAST);
            if blast > 0.0 { blast } else { 1.0 }
        },
        buggy: flag(S_BUGGY),
        databases_in_group: slot(S_DATABASES_IN_GROUP),
        sync_stalled: flag(S_SYNC_STALLED),
        has_primary: flag(S_PRIMARY),
        mesh: flag(S_MESH),
        down_oom: flag(S_DOWN_OOM),
        sampling_ms: slot(S_SAMPLING_MS),
        users_in_group: slot(S_USERS_IN_GROUP),
        r2: flag(S_R2),
        archived: slot(S_ARCHIVED),
        search_variant: slot(S_SEARCH_VARIANT) as usize,
        search_shards: slot(S_SEARCH_SHARDS),
        heap: slot(S_HEAP) as usize,
        search_replicas: slot(S_SEARCH_REPLICAS),
        refresh: slot(S_REFRESH),
        second_provider: flag(S_SECOND_PROVIDER),
        gpu: slot(S_GPU) as usize,
        gpu_model: slot(S_GPU_MODEL) as usize,
        precision: slot(S_PRECISION) as usize,
        batch: slot(S_BATCH),
        quorum_n: slot(S_QUORUM_N),
        quorum_r: slot(S_QUORUM_R),
        quorum_w: slot(S_QUORUM_W),
        lost: slot(S_LOST),
        spread: flag(S_SPREAD),
        local_regions: 0,
        queue_attempts: 0.0,
        cache_engine: slot(S_CACHE_ENGINE) as usize,
        ttl: slot(S_TTL),
        swr: flag(S_SWR),
        early_expiry: flag(S_EARLY_EXPIRY),
        coalesce: flag(S_COALESCE),
        cache_strategy: slot(S_CACHE_STRATEGY) as usize,
        split: flag(S_SPLIT),
        paranoia: slot(S_PARANOIA),
        under_attack: flag(S_UNDER_ATTACK),
        poisoned: flag(S_POISONED),
        ramped: flag(S_RAMPED),
        cluster: slot_of(slot(S_CLUSTER)),
        index_type: slot(S_INDEX_TYPE) as usize,
        vec_recall: None,
        majority_ms: 0.0,
        stale_until: slot(S_STALE_UNTIL),
        cache_key: slot(S_CACHE_KEY) as usize,
        presence: flag(S_PRESENCE),
        backoff: flag(S_BACKOFF),
        clustering: flag(S_CLUSTERING),
        warming: flag(S_WARMING),
        pinned: false,
        partitions: slot(S_PARTITIONS),
        acks: slot(S_ACKS) as usize,
        retain: slot(S_RETAIN),
        keyed: flag(S_KEYED),
        cdc_mirrored: false,
        auth_edge: flag(S_AUTH_EDGE),
        merge: flag(S_MERGE),
        shut: flag(S_SHUT),
    }
}
