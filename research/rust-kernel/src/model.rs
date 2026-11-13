//! The capacity models, ported from `packages/simulation/src/capacity.ts`.
//!
//! Arithmetic order matches the TypeScript exactly: every factor multiplies in
//! the same sequence, so the two sides produce the same `f64` bits.

use crate::catalog::*;
use crate::extra::*;
use crate::pass::{Calls, Code};

/// Per-request-kind scratch, indexed by the Request kind index (0..NR).
pub type Rates = [f64; NK];

/// The kinds a rates record holds, in the order they were first written. A
/// TypeScript record walks its keys in that order, so its sums round that way.
#[derive(Clone, Copy, Debug)]
pub struct Order {
    kinds: [u8; NK],
    len: u8,
    seen: u64,
}

impl Default for Order {
    fn default() -> Self {
        Order { kinds: [0; NK], len: 0, seen: 0 }
    }
}

impl Order {
    /// Kinds `0..NK` in index order: a record built by walking `KINDS`.
    pub fn indexed() -> Self {
        let mut order = Order::default();
        for kind in 0..NK {
            order.push(kind);
        }
        order
    }

    #[inline]
    pub fn push(&mut self, kind: usize) {
        if self.seen & 1 << kind == 0 {
            self.seen |= 1 << kind;
            self.kinds[self.len as usize] = kind as u8;
            self.len += 1;
        }
    }

    #[inline]
    pub fn iter(&self) -> impl Iterator<Item = usize> + '_ {
        self.kinds[..self.len as usize].iter().map(|&kind| kind as usize)
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.len as usize
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    /// Every rate, added in key order from 0.
    #[inline]
    pub fn sum(&self, rates: &Rates) -> f64 {
        self.iter().fold(0.0, |total, kind| total + rates[kind])
    }
}

/// An incident a rule reads. Every incident kind decodes; one no figure the solve
/// reads depends on is `Elsewhere`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Incident {
    GcStorm,
    Loop,
    Connections,
    RetryStorm,
    SlowQuery,
    ReportDb,
    HotShard,
    TableBloat,
    Stuffing,
    ReplLag,
    Reconnect,
    SplitBrain,
    HotKey,
    Regex,
    StaleRead,
    Zone,
    Region,
    DrDrill,
    Bgp,
    Certificate,
    DoubleCharge,
    PspOutage,
    Partition,
    LeapSecond,
    Mtu,
    JvmWarmup,
    Poison,
    DiskFull,
    MigrationLock,
    AccidentalDelete,
    BadDeploy,
    ClusterUpgrade,
    LatencyRegression,
    /// An incident whose effect reaches the kernel only through what the host
    /// writes (demand, user routes, down Nodes), or not at all.
    Elsewhere,
}

/// The Game facts the models read. The catalog carries the tables.
#[derive(Clone, PartialEq)]
pub struct GameCtx {
    pub users: f64,
    /// Research the Company owns, as a bitset over `RESEARCH_IDS`.
    pub researched: [u64; 4],
    /// The incident that runs, if any.
    pub incident: Option<Incident>,
    /// The incident's index into `INCIDENT_IDS` plus one, 0 for none, so a
    /// kind no model reads still marks the Game as having one.
    pub incident_code: usize,
    /// The region a Region outage, DR drill, or leap second hit.
    pub incident_region: Option<usize>,
    /// `chaosTarget`: the Node a chaos experiment fails now, if one runs.
    pub chaos_target: Option<usize>,
    /// `certNodes(game).length > 0`: some TLS terminator holds a certificate.
    pub cert_nodes: bool,
    pub incident_node: usize,
    /// The reconnect storm is throttled to the rate the Hub can take.
    pub incident_throttled: bool,
    pub incident_started: f64,
    pub sandbox: bool,
    pub scenario_tasks: bool,
    /// The fixes the Service has shipped, as a bitset over `fix::`.
    pub fixes: u64,
    /// A Data team with engineers on it: `dataStaffed`.
    pub data_staffed: bool,
    /// A CDN is on the board, so R2 has no first-byte penalty.
    pub cdn_on_board: bool,
    /// `hasEdge`: a live Edge Function is on the board.
    pub edge_on_board: bool,
    /// `edgeAuthOf`: a live API Gateway checks auth at the edge, so App Servers skip it.
    pub edge_auth: bool,
    /// The company's data, GB.
    pub data: f64,
    /// `staticPagesOf`: the largest share of pages a live App Server renders statically.
    pub static_pages: f64,
    /// `mixOf(game)`: the Era's share of each Request kind.
    pub mix: [f64; NR],
    /// `spreadCount`: the regions a spread store replicates to.
    pub spread_regions: f64,
    /// `valueFactor`, `payloadFactor`, and `queryFactor`: what the shipped Features at
    /// their exposure, the Product levers, the Venture, and the Scenario make a request
    /// earn, a response weigh, and a query cost. The host works them out once a Game.
    pub value: [f64; NR],
    pub payload: [f64; NR],
    pub query: [f64; NB],
    /// `subscriptionsOf`: dollars per second from paid plans.
    pub subscriptions: f64,
    /// `insightPerk`: what the founder's perks multiply Insight by.
    pub insight_perk: f64,
    pub seed: f64,
    pub time: f64,
    /// Services the Company runs: their count, and the sum of their indexes.
    pub service_count: usize,
    pub service_indexes: f64,
    /// The Era, so a rule reads the stage the same way the TypeScript does.
    pub stage: f64,
    /// The Venture, as its index in `VENTURE_IDS`.
    pub venture: usize,
    /// A Challenge or guided Sandbox pins its mix, so a lever cannot move it.
    pub fixed_mix: bool,
    /// A Sandbox that runs the daily cycle.
    pub scenario_daily: bool,
    /// `badDeployShareOf` of the Service a bad deploy broke, and the Request
    /// kinds it fails (`failsKind`) as a bitset; both 0 without a bad deploy.
    pub deploy_share: f64,
    pub deploy_kinds: u64,
    /// `RUNTIME_INCIDENT_FAILURES` of the incident: the share of the incident
    /// Node's requests its runtime fails.
    pub runtime_failure: f64,
    /// The Era's cost index, and the Venture's egress multiplier.
    pub cost_index: f64,
    pub egress_factor: f64,
    /// `payrollOf`: dollars per second of salaries.
    pub salaries: f64,
    /// `burnSharesOf`: compute, data, storage, and observability.
    pub shares: [f64; 4],
    /// `serviceOfKind`: each request kind's Service index.
    pub kind_service: [usize; NR],
}

impl GameCtx {
    /// Whether the Company owns a Research, by its `research::` index.
    #[inline]
    pub fn has(&self, research: usize) -> bool {
        (self.researched[research / 64] >> (research % 64)) & 1 == 1
    }

    /// `fixed`: a Sandbox without tasks has every fix; otherwise the Service must ship it.
    #[inline]
    pub fn fixed(&self, fix: usize) -> bool {
        (self.sandbox && !self.scenario_tasks) || (self.fixes >> fix) & 1 == 1
    }
}

/// A Node, as the capacity models see it.
#[derive(Clone, Copy, PartialEq)]
pub struct Node {
    pub id: usize,
    pub type_code: usize,
    pub size: f64,
    pub workers: f64,
    pub replicas: f64,
    pub runtime: usize,
    pub framework: usize,
    pub family: usize,
    pub compress: bool,
    pub local_db: bool,
    pub leak: f64,
    pub credits: f64,
    pub prefetch: f64,
    pub pm: usize,
    pub gogc: usize,
    pub collector: usize,
    pub recycle: bool,
    /// `life`: 0 Running, else the warm share.
    pub warm: f64,
    pub down: bool,
    pub zone: usize,
    pub region: usize,
    pub db_engine: usize,
    pub ryw: bool,
    pub materialized: bool,
    pub shed: bool,
    pub degrade: bool,
    pub sticky: bool,
    /// 0 pull, 1 push.
    pub fanout: u8,
    pub policy: usize,
    pub variant: usize,
    pub depth: f64,
    /// Database fields.
    pub shards: f64,
    pub shard_key: usize,
    pub iops: usize,
    pub keep: usize,
    pub topology: usize,
    /// A Connection Pooler's mode: 0 session, 1 transaction, 2 statement.
    pub mode: usize,
    /// A Read Replica that replicates synchronously serves no stale read.
    pub sync: bool,
    /// The sim second this Node's certificate runs out; `None` when none is issued.
    pub cert_until: Option<f64>,
    /// An API Gateway's shared rate limit, and the burst its bucket holds.
    pub rate_limit: f64,
    pub burst: f64,
    /// A Queue's maximum length, dead-letter queue, and attempts per task.
    pub max_length: f64,
    pub dlq: bool,
    pub attempts: f64,
    /// A Document Store that runs multi-document transactions.
    pub transactions: bool,
    /// This Node's language blast factor, and whether a migration's bugs hit it.
    pub blast: f64,
    pub buggy: bool,
    /// The Databases in this Node's Data Group, and whether a synchronous
    /// replica behind it is down.
    pub databases_in_group: f64,
    pub sync_stalled: bool,
    /// A Read Replica's primary exists, so it copies something.
    pub has_primary: bool,
    /// A Service Mesh has put a sidecar beside this Node.
    pub mesh: bool,
    /// The Node is down because the kernel killed it for memory.
    pub down_oom: bool,
    /// Milliseconds Analytics sampling adds to this Node's hop.
    pub sampling_ms: f64,
    /// The users whose rows this Node's Data Group holds.
    pub users_in_group: f64,
    /// An Object Storage Node that is R2 rather than S3.
    pub r2: bool,
    /// Share of an Object Storage Node's objects in an archive class, which the host
    /// works out from `storageBands`: what the store holds, and how old it is.
    pub archived: f64,
    /// A Search Engine's variant, shards, heap row, replicas, and refresh in seconds.
    pub search_variant: usize,
    pub search_shards: f64,
    pub heap: usize,
    pub search_replicas: f64,
    pub refresh: f64,
    /// A Payment Provider switched to the second provider.
    pub second_provider: bool,
    /// A GPU Node's GPU type, model, precision row, and batch size.
    pub gpu: usize,
    pub gpu_model: usize,
    pub precision: usize,
    pub batch: f64,
    /// A Wide-column Store's replicas, read and write quorums, replicas lost, and
    /// whether it spreads across regions.
    pub quorum_n: f64,
    pub quorum_r: f64,
    pub quorum_w: f64,
    pub lost: f64,
    pub spread: bool,
    /// `spreadRegions`: the regions a spread Wide-column Store answers from a
    /// local quorum, as a bitset over `REGIONS`.
    pub local_regions: u32,
    /// `attemptsAllowed` of the Queue a Worker pulls from, or 0 when it pulls
    /// from none and every task takes one attempt.
    pub queue_attempts: f64,
    /// A Cache's engine row, TTL in seconds, stampede guards, strategy row, and
    /// whether its hot keys are split.
    pub cache_engine: usize,
    pub ttl: f64,
    pub swr: bool,
    pub early_expiry: bool,
    pub coalesce: bool,
    pub cache_strategy: usize,
    pub split: bool,
    /// A WAF's paranoia level, 1 to 4, and whether Under attack mode is on.
    pub paranoia: f64,
    pub under_attack: bool,
    /// This Worker pulls from a Queue a poison message is stuck in.
    pub poisoned: bool,
    /// `rampedOf`: a Load Balancer with slow start links to this Node.
    pub ramped: bool,
    /// An Analytics tap's sample rate.
    pub sample_rate: f64,
    /// `burnOf`: what the Node's box bills, before traffic.
    pub burn: f64,
    /// Object Storage's retrieval fee per GB, and its price per read and per write.
    pub retrieval: f64,
    pub store_get: f64,
    pub store_put: f64,
    /// `syncWaitMs`: what a write waits for synchronous copies.
    pub sync_wait: f64,
    /// What a resharding copy leaves of the volume's IOPS.
    pub iops_factor: f64,
    /// `stealOf`: the share of the cores a noisy neighbour takes.
    pub steal: f64,
    /// `clusterOf`: the Cluster this App Server or Worker runs in, or `usize::MAX`.
    pub cluster: usize,
    /// A Vector Index's type, a `vec_index` row.
    pub index_type: usize,
    /// `vecOf`: the recall of the first live Vector Index this Node links to.
    pub vec_recall: Option<f64>,
    /// A Distributed SQL store's consensus wait, ms.
    pub majority_ms: f64,
    /// A CDN serves pages cached before the deploy until this time.
    pub stale_until: f64,
    /// A CDN's cache key, a `cache_key` row.
    pub cache_key: usize,
    /// A Realtime Hub's Presence, Reconnect backoff, and Clustering.
    pub presence: bool,
    pub backoff: bool,
    pub clustering: bool,
    /// The Node is warming up after a start or a restart.
    pub warming: bool,
    /// `pinnedOf`: a sticky Load Balancer links to this Node.
    pub pinned: bool,
    /// An Event Stream's partitions, acknowledgement row, retention in seconds, and key.
    pub partitions: f64,
    pub acks: usize,
    pub retain: f64,
    pub keyed: bool,
    /// `cdcMirrored`: a CDC Connector reads this Node's write log.
    pub cdc_mirrored: bool,
    /// An API Gateway's Auth at the edge and Request coalescing.
    pub auth_edge: bool,
    pub merge: bool,
    /// The Node's Service is shut.
    pub shut: bool,
}

/// What `serverModel` returns.
#[derive(Clone, Copy)]
pub struct Model {
    pub utilization: f64,
    pub share: f64,
    pub capacity: f64,
    pub limit: Limit,
    pub service_fixed: [f64; NK],
    pub service_variable: [f64; NK],
    /// Which kinds the model has a service record for: a missing kind falls back
    /// to the Component's latency, so presence is a bit and not a zero.
    pub service_mask: u64,
    pub tail_p: f64,
    pub tail_ms: f64,
    pub processes: f64,
    pub inflight: f64,
    /// Load shedding's share of each request kind kept, for the kinds in `shares_mask`;
    /// every other kind keeps `share`.
    pub shares: [f64; NR],
    pub shares_mask: u64,
    /// The resource `work` counts, or `None` where every request costs the same.
    pub work_unit: Option<WorkUnit>,
    /// What one request of each kind takes from the resource in `work_unit`.
    pub work: [f64; NK],
    pub resources: Resources,
    pub throttled: bool,
    pub swapping: bool,
    pub disk: bool,
}

/// One resource's use against its size.
#[derive(Clone, Copy, Default, PartialEq)]
pub struct Gauge {
    pub used: f64,
    pub total: f64,
}

/// `Resources`: what a Node's model reports about the box it runs on.
#[derive(Clone, Copy, Default, PartialEq)]
pub struct Resources {
    pub cpu_cores: Option<Gauge>,
    pub ram_gb: Option<Gauge>,
    pub slots: Option<Gauge>,
    pub network_kbps: Option<Gauge>,
    /// Burstable credits in core-seconds, and their change per second.
    pub credits: Option<(f64, f64)>,
}

/// `WorkUnit`: the resource a Node's work share counts.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum WorkUnit {
    Cpu,
    Workers,
    Network,
    Disk,
}

impl Default for Model {
    fn default() -> Self {
        Model {
            utilization: 0.0,
            share: 0.0,
            capacity: 0.0,
            limit: Limit::None,
            service_fixed: [0.0; NK],
            service_variable: [0.0; NK],
            service_mask: 0,
            tail_p: 0.0,
            tail_ms: 0.0,
            processes: 0.0,
            inflight: 0.0,
            shares: [0.0; NR],
            shares_mask: 0,
            work_unit: None,
            work: [0.0; NK],
            resources: Resources::default(),
            throttled: false,
            swapping: false,
            disk: false,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Default)]
pub enum Limit {
    #[default]
    None,
    Cpu,
    Workers,
    Network,
    Memory,
    Credits,
    Throughput,
    Disk,
}

impl Limit {
    pub fn as_str(self) -> &'static str {
        match self {
            Limit::None => "none",
            Limit::Cpu => "cpu",
            Limit::Workers => "workers",
            Limit::Network => "network",
            Limit::Memory => "memory",
            Limit::Credits => "credits",
            Limit::Throughput => "throughput",
            Limit::Disk => "disk",
        }
    }
}

/// What a server's model reads about it that holds for a whole solve.
#[derive(Clone, Copy, Default, PartialEq)]
pub struct ServerFlags {
    /// CPU overhead from Analytics sampling, in milliseconds.
    pub sampling: f64,
    pub hashing: f64,
    /// An Auth Provider takes this Node's logins.
    pub delegated: bool,
    pub local: bool,
    /// This Node can hand async work to a Queue.
    pub offloaded: bool,
    pub worker: bool,
    /// This Node runs as pods.
    pub pod: bool,
    pub mesh: bool,
}

impl ServerFlags {
    pub fn of(game: &GameCtx, node: &Node, sampling: f64, delegated: bool, offloaded: bool, pod: bool) -> ServerFlags {
        let worker = node.type_code == component::WORKER;
        ServerFlags {
            sampling,
            // A Worker answers no user: no logins to hash or hand off, no Queue to offload to.
            hashing: if game.incident == Some(Incident::Loop) && !worker { 4.0 } else { 1.0 },
            delegated: delegated && !worker,
            local: node.local_db && !worker,
            offloaded: offloaded && !worker,
            worker,
            pod,
            mesh: node.mesh,
        }
    }
}

/// A server's context: its flags, and the feedback one pass hands the next.
#[derive(Clone, Copy)]
pub struct ServerCtx {
    pub boost: f64,
    pub inflight: f64,
    pub flags: ServerFlags,
}

#[inline]
fn wait_for(service: f64, utilization: f64, servers: f64) -> f64 {
    let rho = if utilization < 0.98 { utilization } else { 0.98 };
    let s = if servers > 1.0 { servers } else { 1.0 };
    (service * rho) / (s * (1.0 - rho))
}

/// `grown`: `base` multiplied by `factor` once per step, or divided once per
/// step below zero. A loop, not a power, so the last bit matches the TypeScript.
pub fn grown(base: f64, factor: f64, steps: f64) -> f64 {
    let mut value = base;
    let mut index = 0.0f64;
    while index < steps {
        value *= factor;
        index += 1.0;
    }
    let mut index = 0.0f64;
    while index > steps {
        value /= factor;
        index -= 1.0;
    }
    value
}

/// `flatScale`: a flat Component's capacity doubles with each size step.
#[inline]
pub fn flat_scale(size: f64) -> f64 {
    grown(1.0, 2.0, size - 1.0)
}

#[inline]
pub fn vcpu_of(size: f64) -> f64 {
    match size as i64 {
        0 => 0.5,
        1 => 1.0,
        2 => 2.0,
        3 => 4.0,
        4 => 8.0,
        5 => 16.0,
        6 => 32.0,
        7 => 64.0,
        8 => 96.0,
        _ => 1.0,
    }
}

#[inline]
pub fn gbps_of(size: f64) -> f64 {
    match size as i64 {
        0 => 0.5,
        1 => 1.0,
        2 => 2.0,
        3 => 5.0,
        4 => 10.0,
        5 => 12.5,
        6 => 25.0,
        7 => 50.0,
        8 => 100.0,
        _ => 1.0,
    }
}

#[inline]
pub fn network_of(size: f64) -> f64 {
    gbps_of(size) * 125_000.0
}

#[inline]
pub fn ram_of(size: f64, family: usize) -> f64 {
    let per_vcpu = match family {
        0 => 2.0, // burstable
        1 => 4.0, // general
        2 => 2.0, // compute
        3 => 8.0, // memory
        _ => 4.0, // arm
    };
    vcpu_of(size) * per_vcpu
}

#[inline]
pub fn payload_of(node: &Node, kind: usize, offloaded: bool) -> f64 {
    let base = if offloaded && PROFILE_OFFLOAD[kind] > 0.0 {
        PROFILE_ASYNC_KB[kind]
    } else {
        PROFILE_PAYLOAD_KB[kind]
    };
    base * if node.compress && PROFILE_COMPRESSIBLE[kind] { GZIP_RATIO } else { 1.0 }
}

#[inline]
pub fn transfer_ms(node: &Node, kind: usize, offloaded: bool) -> f64 {
    let payload = payload_of(node, kind, offloaded);
    let streamed = if PROFILE_STREAM[kind] {
        payload.min(STREAM_KB)
    } else {
        payload
    };
    (streamed * 8.0) / USER_MBPS + (PROFILE_IN_KB[kind] * 8.0) / USER_UP_MBPS
}

/// `hashesOnPool`: a Node.js login hashed off the event loop. A stuffing bot
/// is a login too.
#[inline]
fn hashes_on_pool(game: &GameCtx, node: &Node, kind: usize, flags: &ServerFlags) -> bool {
    RUNTIME_LANGUAGE[node.runtime] == language::NODE
        && game.has(research::LIBUV_POOL)
        && crate::pass::as_login(game, kind)
        && !flags.delegated
        && !flags.worker
}

/// `cpuBase`: core-milliseconds one request of a kind costs this Node. It reads
/// nothing a pass changes, so a solve works it out once per Node and kind.
pub fn cpu_base(game: &GameCtx, node: &Node, kind: usize, calls: &Calls, flags: &ServerFlags) -> f64 {
    let runtime = node.runtime;
    let framework = node.framework;
    let speed = speed_of(game, node);
    let overhead = overhead_of(node, kind);
    // `profileOf`: a stuffing bot costs what a login costs.
    let profile = crate::pass::profile_of(game, kind);
    let login = crate::pass::as_login(game, kind);
    let variant = kind_speed_of(game, node, kind);
    let delegated_login = login && flags.delegated && !flags.worker;

    let mut cpu;
    if delegated_login {
        cpu = (LOGIN_DELEGATED_CPU * overhead) / speed;
    } else if PROFILE_NATIVE[profile] {
        cpu = PROFILE_CPU[profile] * if login { flags.hashing } else { 1.0 };
    } else {
        cpu = (PROFILE_CPU[profile] * overhead) / speed;
    }
    cpu /= variant;
    let mut made = 0.0;
    for &count in calls {
        made += count;
    }
    let serial = made * SERIALIZE_MS * if game.has(research::BINARY_RPC) { 0.5 } else { 1.0 };
    let auth = if AUTHENTICATED_KINDS_MASK[kind] == 1 && !game.edge_auth && !(login && flags.delegated)
    {
        AUTH_CHECK_MS
    } else {
        0.0
    };
    if flags.worker {
        return (cpu + serial) * PROFILE_OFFLOAD[profile] * (1.0 + flags.sampling);
    }
    if flags.offloaded {
        cpu *= 1.0 - PROFILE_OFFLOAD[profile];
    }
    if node.compress && PROFILE_COMPRESSIBLE[profile] {
        cpu *= GZIP_CPU;
    }
    if flags.local {
        let mut queries = 0.0;
        for (&count, &each) in calls.iter().zip(&QUERY_CPU_BY_BACKEND) {
            if count != 0.0 && each >= 0.0 {
                queries += count * each;
            }
        }
        cpu += queries * LOCAL_DB_CONTENTION;
    }
    let _ = framework;
    let _ = runtime;
    (cpu + serial + auth) * (1.0 + flags.sampling)
}

/// `speedOf`: runtime, OPcache, and warmup, multiplied in order.
fn speed_of(game: &GameCtx, node: &Node) -> f64 {
    let mut speed = RUNTIME_SPEED[node.runtime];
    // The collector's speed only applies to Java.
    if RUNTIME_LANGUAGE[node.runtime] == language::JAVA {
        speed *= COLLECTOR_SPEED[node.collector.min(2)];
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::PHP && game.has(research::OPCACHE) {
        speed *= 1.0 + (OPCACHE_SPEED - 1.0) * node.warm;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUBY && game.has(research::YJIT) {
        speed *= YJIT_SPEED;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUST && game.has(research::JEMALLOC) {
        speed *= JEMALLOC_SPEED;
    }
    if node.family == 4 {
        speed *= ARM_SPEED;
    }
    if node.recycle && RUNTIME_PERSISTENT[node.runtime] {
        speed *= 1.0
            - (RUNTIME_STARTUP_S[node.runtime]
                + (1.0 - RUNTIME_WARM_FROM[node.runtime]) * RUNTIME_WARMUP[node.runtime])
                / RECYCLE_CYCLE;
    }
    // A JVM that scaled up runs cold; the port keeps the warm share the caller passed.
    // A JVM that scaled up under load runs its new copies cold until the warmup finishes.
    let cold = game.incident == Some(Incident::JvmWarmup) && game.incident_node == node.id && !node.ramped;
    speed *= RUNTIME_WARM_FROM[node.runtime]
        + (1.0 - RUNTIME_WARM_FROM[node.runtime]) * if cold { 0.0 } else { node.warm };
    speed
}

/// `overheadOf`: framework CPU overhead per request. An app that boots once
/// (an overhead factor of exactly 0) keeps only what its framework still spends.
fn overhead_of(node: &Node, kind: usize) -> f64 {
    let runtime = node.runtime;
    let framework = node.framework;
    // FastAPI's overhead is ASGI's: on a process-per-request server it does not apply.
    if FRAMEWORK_ASGI[framework] && RUNTIME_MODEL[runtime] != Concurrency::Loop {
        return FRAMEWORK_CPU[framework][kind];
    }
    let factor = RUNTIME_OVERHEAD_FACTOR[runtime];
    let booted = if factor == 0.0 {
        let kept = FRAMEWORK_WORKER_OVERHEAD[framework];
        if kept >= 0.0 { kept } else { 1.0 }
    } else {
        1.0 + (FRAMEWORK_OVERHEAD[framework] - 1.0) * factor
    };
    booted * FRAMEWORK_CPU[framework][kind]
}

/// `kindSpeedOf`: the JIT and NIFs change what a kind costs the CPU.
fn kind_speed_of(game: &GameCtx, node: &Node, kind: usize) -> f64 {
    let runtime = node.runtime;
    let heavy = CPU_HEAVY_MASK[kind] == 1;
    let mut speed = 1.0;
    if RUNTIME_LANGUAGE[runtime] == language::PHP && game.has(research::PHP_JIT) {
        speed *= if heavy { PHP_JIT_HEAVY } else { PHP_JIT_SPEED };
    }
    if RUNTIME_LANGUAGE[runtime] == language::ELIXIR && game.has(research::NIFS) && heavy {
        speed *= NIF_SPEED;
    }
    speed
}

/// `edgeAuthOf`: a live API Gateway that validates tokens at the edge. The port
/// refuses a Design with a Gateway, so no Gateway validates anything here.
/// `variantMemoryOf`: a variant's memory cost.
fn variant_memory(game: &GameCtx, node: &Node) -> (f64, f64) {
    let mut factor = 1.0;
    if RUNTIME_LANGUAGE[node.runtime] == language::RUBY && game.has(research::YJIT) {
        factor *= YJIT_MEMORY;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUST && game.has(research::JEMALLOC) {
        factor *= JEMALLOC_MEMORY;
    }
    let mut extra = 0.0;
    if RUNTIME_LANGUAGE[node.runtime] == language::NODE && game.has(research::WORKER_THREADS) {
        extra += WORKER_THREADS * WORKER_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::NODE && game.has(research::LIBUV_POOL) {
        extra += LIBUV_THREADS * LIBUV_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUST && game.has(research::SPAWN_BLOCKING) {
        extra += SPAWN_BLOCKING_THREADS * SPAWN_BLOCKING_THREAD_MB;
    }
    (factor, extra)
}

/// `collectorOf`: the runtime's collector, or None.
fn collector_memory(node: &Node) -> (bool, f64, f64, f64) {
    // (present, memory multiplier, pauseMs, cpu)
    let language = RUNTIME_LANGUAGE[node.runtime];
    if RUNTIME_GC_PAUSE[node.runtime] < 0.0 {
        return (false, 1.0, 0.0, 0.0);
    }
    if language == language::JAVA {
        let index = node.collector.min(2);
        return (true, COLLECTOR_MEMORY[index], COLLECTOR_PAUSE[index], RUNTIME_GC_CPU[node.runtime]);
    }
    if language == language::GO {
        let index = if node.gogc < 3 { node.gogc } else { 1 };
        return (
            true,
            GOGC_MEMORY[index],
            RUNTIME_GC_PAUSE[node.runtime],
            RUNTIME_GC_CPU[node.runtime] * GOGC_CPU[index],
        );
    }
    (true, 1.0, RUNTIME_GC_PAUSE[node.runtime], RUNTIME_GC_CPU[node.runtime])
}

/// The server's model: `serverModel` from capacity.ts.
pub fn server_model(
    game: &GameCtx,
    node: &Node,
    arriving: &Rates,
    code: &Code,
    call_latency: &[f64; NK],
    ctx: &ServerCtx,
) -> Model {
    let runtime = node.runtime;
    let framework = node.framework;
    let (variant_factor, variant_extra) = variant_memory(game, node);
    let copies = node.replicas;
    let vcpu = vcpu_of(node.size) * ctx.boost * copies;
    let ram = ram_of(node.size, node.family) * ctx.boost * copies;
    let model = RUNTIME_MODEL[runtime];

    let processes = if runtime == runtime::MOD_PHP {
        APACHE_MAX_WORKERS.min((ctx.inflight).ceil() + APACHE_SPARE)
    } else if RUNTIME_POOL[runtime] {
        node.workers * copies
    } else if (model == Concurrency::Threads && !RUNTIME_PARALLEL[runtime]) || runtime == runtime::NODE_CLUSTER
    {
        (vcpu / copies).round().max(1.0) * copies
    } else {
        copies
    };
    let slots = if model == Concurrency::Loop || model == Concurrency::Green || model == Concurrency::Async {
        f64::INFINITY
    } else if model == Concurrency::Threads {
        processes * RUNTIME_THREADS[runtime]
    } else if runtime == runtime::MOD_PHP {
        APACHE_MAX_WORKERS * ctx.boost * copies
    } else {
        node.workers * ctx.boost * copies
    };

    // PHP-FPM pool modes; every other runtime keeps the whole pool resident.
    let pm = if runtime == runtime::PHP_FPM { node.pm.min(PM_SPARES.len() - 1) } else { 0 };
    let (pm_spares, pm_spawn_share, pm_spawn_ms) = (PM_SPARES[pm], PM_SPAWN_SHARE[pm], PM_SPAWN_MS[pm]);
    let resident = if pm_spares < 0.0 {
        processes
    } else {
        processes.min((ctx.inflight.ceil() + pm_spares).max(1.0))
    };
    let connections = arriving[kind::RT] * RT_HOLD_SECONDS;
    let connection_kb = RUNTIME_CONNECTION_KB[runtime];
    let connection_ram = if connections > 0.0 && connection_kb >= 0.0 {
        (connections * connection_kb) / 1_048_576.0
    } else {
        0.0
    };
    let (has_collector, collector_memory, gc_pause, gc_cpu) = collector_memory(node);
    let mut ram_used = OS_RAM * copies;
    ram_used += (resident
        * (RUNTIME_MEMORY_MB[runtime] * variant_factor * collector_memory + FRAMEWORK_MEMORY_MB[framework]))
        / 1024.0;
    ram_used += (resident * variant_extra) / 1024.0;
    if ctx.flags.local {
        ram_used += LOCAL_DB_RAM + game.users * LOCAL_DB_RAM_PER_USER;
    }
    // Left to right, as TypeScript's sum rounds.
    ram_used += node.leak;
    ram_used += connection_ram;
    let swapping = ram_used > ram;
    let efficiency = if swapping {
        (1.0 - (2.5 * (ram_used - ram)) / ram).max(0.15)
    } else {
        1.0
    };
    let heap = if ram > 0.0 { ram_used / ram } else { 0.0 };
    let storm = has_collector
        && game.incident == Some(Incident::GcStorm)
        && game.incident_node == node.id;
    let live = if storm { (heap + GC_STORM_HEAP).min(1.0) } else { heap };
    let pressure = if has_collector && live > GC_HEAP {
        ((live - GC_HEAP) / (1.0 - GC_HEAP)).min(1.0)
    } else {
        0.0
    };
    let collecting = if pressure > 0.0 && has_collector {
        1.0 + gc_cpu * pressure
    } else {
        1.0
    };

    let usable = if RUNTIME_PARALLEL[runtime] {
        vcpu
    } else if model == Concurrency::Process {
        vcpu.min(processes.max(1.0))
    } else {
        vcpu.min(processes)
    };
    let throttled = node.family == 0 && node.credits < 1.0;
    let shared = if ctx.flags.mesh { usable * (1.0 - MESH_OVERHEAD) } else { usable };
    let cores = if throttled {
        shared.min(BURST_BASELINE * vcpu)
    } else {
        shared
    };
    let per_request = cores.min(1.0);

    // The kinds that arrive.
    let mut arrived = [0usize; NR];
    let mut count = 0;
    let mut rate = 0.0;
    for (kind, &arrives) in arriving[..NR].iter().enumerate() {
        if arrives > 0.0 {
            arrived[count] = kind;
            count += 1;
            rate += arrives;
        }
    }
    let kinds = &arrived[..count];
    let mut cpu = [0.0f64; NR];
    for &kind in kinds {
        cpu[kind] = (code.cpu[kind] / efficiency) * if collecting > 1.0 { collecting } else { 1.0 };
    }
    let mut cpu_work = 0.0;
    for &kind in kinds {
        cpu_work += arriving[kind] * cpu[kind];
    }
    let cpu_utilization = if cores > 0.0 {
        cpu_work / (cores * 1000.0)
    } else if rate > 0.0 {
        99.0
    } else {
        0.0
    };
    let mean_service = if rate > 0.0 { cpu_work / rate / per_request } else { 0.0 };
    let cpu_wait = wait_for(mean_service, cpu_utilization, cores);

    let fetching = if ctx.flags.worker { FETCH_MS / node.prefetch.max(1.0) } else { 0.0 };
    let mut residence = [0.0f64; NR];
    let mut slot_work = 0.0;
    for &kind in kinds {
        let profile = crate::pass::profile_of(game, kind);
        let receiving = if ctx.flags.worker || PROFILE_IN_KB[profile] <= 0.0 {
            0.0
        } else {
            ((PROFILE_IN_KB[profile] * 8.0) / USER_UP_MBPS)
                * if ctx.flags.offloaded { 1.0 - PROFILE_OFFLOAD[profile] } else { 1.0 }
        };
        let mut waiting = 0.0;
        if !ctx.flags.local {
            waiting = wait_of(&code.calls[kind], call_latency) + fetching;
        }
        let each = cpu[kind] / per_request + cpu_wait + waiting + receiving;
        residence[kind] = each;
        slot_work += arriving[kind] * each;
    }
    let slot_utilization = if slots.is_infinite() { 0.0 } else { slot_work / (slots * 1000.0) };
    let slot_wait = if rate > 0.0 {
        wait_for(slot_work / rate, slot_utilization, slots)
    } else {
        0.0
    };

    let mut bytes = 0.0;
    if !ctx.flags.worker {
        for &kind in kinds {
            bytes += arriving[kind] * payload_of(node, kind, ctx.flags.offloaded) * game.payload[kind];
        }
    }
    let network_utilization = bytes / (network_of(node.size) * ctx.boost);

    let thread_utilization = if model == Concurrency::Threads && connection_ram > 0.0 && ram > 0.0 {
        ram_used / ram
    } else {
        0.0
    };

    let mut pooled = [false; NR];
    let mut pool_rate = 0.0;
    let mut pool_work = 0.0;
    for &kind in kinds {
        let on = hashes_on_pool(game, node, kind, &ctx.flags);
        pooled[kind] = on;
        if !on {
            continue;
        }
        pool_rate += arriving[kind];
        pool_work += (arriving[kind] * cpu[kind]) / per_request;
    }
    let pool_threads = (1.0f64).max((LIBUV_THREADS * processes.max(1.0)).min(cores));
    let pool_utilization = pool_work / (pool_threads * 1000.0);
    let pool_wait = if pool_rate > 0.0 {
        wait_for(pool_work / pool_rate, pool_utilization, pool_threads)
    } else {
        0.0
    };

    let utilization = cpu_utilization
        .max(slot_utilization)
        .max(network_utilization)
        .max(thread_utilization)
        .max(pool_utilization);
    let share = if utilization > 1.0 { 1.0 / utilization } else { 1.0 };
    let limit = if utilization <= 0.0 {
        Limit::None
    } else if throttled {
        Limit::Credits
    } else if swapping {
        Limit::Memory
    } else if network_utilization >= utilization {
        Limit::Network
    } else if slot_utilization > cpu_utilization {
        Limit::Workers
    } else {
        Limit::Cpu
    };

    // Event-loop stalls.
    let blocking = if RUNTIME_BLOCKING[runtime] == Blocking::Worker
        && RUNTIME_LANGUAGE[runtime] == language::RUST
        && game.has(research::SPAWN_BLOCKING)
    {
        Blocking::None
    } else {
        RUNTIME_BLOCKING[runtime]
    };
    let mut loop_work = 0.0;
    let mut loop_squares = 0.0;
    if blocking != Blocking::None {
        for &kind in kinds {
            let is_login = kind == kind::LOGIN;
            let off_loop = (is_login && (pooled[kind] || ctx.flags.delegated))
                || (game.has(research::WORKER_THREADS)
                    && game.fixed(fix::OFF_LOOP)
                    && (RUNTIME_LANGUAGE[runtime] == language::NODE
                        || (RUNTIME_LANGUAGE[runtime] == language::PYTHON && model == Concurrency::Loop))
                    && CPU_HEAVY_MASK[kind] == 1);
            if off_loop {
                continue;
            }
            let callback = cpu[kind] / per_request;
            loop_work += arriving[kind] * callback;
            loop_squares += arriving[kind] * callback * callback;
        }
    }
    let loop_block = if loop_work > 0.0 { loop_squares / loop_work } else { 0.0 };
    let stall_p = if loop_block > 0.0 {
        if blocking == Blocking::Worker {
            LOOP_TAIL_SHARE / cores.max(1.0)
        } else {
            LOOP_TAIL_SHARE
        }
    } else {
        pm_spawn_share
    };
    let stall_ms = if loop_block > 0.0 {
        loop_block * (1.0f64).min(2.0 * cpu_utilization.min(1.0))
    } else {
        pm_spawn_ms
    };
    let gc_p = if pressure > 0.0 {
        pressure * GC_TAIL_SHARE * if storm { GC_STORM } else { 1.0 }
    } else {
        0.0
    };
    let (mut tail_p, mut tail_ms) = if gc_p > 0.0 && has_collector {
        combine_tail(stall_p, stall_ms, gc_p, gc_pause)
    } else {
        (stall_p, stall_ms)
    };
    if ctx.flags.pod {
        let (p, ms) = combine_tail(
            tail_p,
            tail_ms,
            NOISY_SHARE * (0.5 + 1.5 * cpu_utilization.min(1.0)),
            NOISY_MS,
        );
        tail_p = p;
        tail_ms = ms;
    }

    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];
    let mut service_mask = 0u64;
    for &kind in kinds {
        service_mask |= 1u64 << kind;
        service_fixed[kind] = 2.0;
        service_variable[kind] = cpu[kind] / per_request
            + cpu_wait
            + slot_wait
            + if pooled[kind] { pool_wait } else { 0.0 };
    }

    let used = (cpu_work * share).min(cores * 1000.0) / 1000.0;
    // Work share counts in the unit of the resource the limit names. A Worker's
    // Ledger counts `task`, not the Request kinds behind it: each task counts as one.
    let work_unit = if network_utilization >= utilization {
        WorkUnit::Network
    } else if slot_utilization > cpu_utilization {
        WorkUnit::Workers
    } else {
        WorkUnit::Cpu
    };
    let mut work = [1.0f64; NK];
    for (kind, each) in work[..NR].iter_mut().enumerate() {
        *each = match work_unit {
            WorkUnit::Network => payload_of(node, kind, ctx.flags.offloaded) * game.payload[kind],
            WorkUnit::Workers => residence[kind],
            WorkUnit::Cpu | WorkUnit::Disk => cpu[kind],
        };
    }
    Model {
        utilization,
        share,
        capacity: if rate > 0.0 { rate / utilization.max(1e-9) } else { 0.0 },
        limit,
        service_fixed,
        service_variable,
        service_mask,
        tail_p,
        tail_ms,
        processes: resident,
        inflight: (slot_work * share) / 1000.0,
        shares: [0.0; NR],
        shares_mask: 0,
        work_unit: Some(work_unit),
        work,
        resources: Resources {
            cpu_cores: Some(Gauge { used, total: cores }),
            ram_gb: Some(Gauge { used: ram_used, total: ram }),
            slots: (!slots.is_infinite()).then(|| Gauge { used: (slot_work * share) / 1000.0, total: slots }),
            network_kbps: Some(Gauge { used: bytes * share, total: network_of(node.size) * ctx.boost }),
            credits: (node.family == 0).then_some((node.credits, BURST_BASELINE * vcpu - used)),
        },
        throttled,
        swapping,
        disk: false,
    }
}

impl Model {
    /// The share of `kind` this Node processes: its shed share, or the Node's.
    #[inline]
    pub fn share_of(&self, kind: usize) -> f64 {
        if kind < NR && (self.shares_mask >> kind) & 1 == 1 { self.shares[kind] } else { self.share }
    }
}

/// `serverModel` with its shedding: priority load shedding drops the cheapest-value kinds
/// first until the box runs at `SHED_AT`; graceful degradation drops the dearest ones
/// instead, and wins when a Node has both.
pub fn server_model_shed(
    game: &GameCtx,
    node: &Node,
    arriving: &Rates,
    code: &Code,
    call_latency: &[f64; NK],
    ctx: &ServerCtx,
) -> Model {
    let full = server_model(game, node, arriving, code, call_latency, ctx);
    if full.utilization <= SHED_AT || ctx.flags.worker {
        return full;
    }
    let degrade = node.degrade && game.has(research::GRACEFUL_DEGRADATION);
    if !degrade && !(node.shed && game.has(research::LOAD_SHEDDING)) {
        return full;
    }
    // The kinds that arrive, in the order they go: a stable sort, as `toSorted` is.
    let mut kinds: Vec<usize> = (0..NR).filter(|kind| arriving[*kind] > 0.0).collect();
    if degrade {
        let cpu = |kind: usize| PROFILE_CPU[crate::pass::profile_of(game, kind)];
        kinds.sort_by(|a, b| cpu(*b).total_cmp(&cpu(*a)));
    } else {
        kinds.sort_by(|a, b| KIND_VALUE[*a].total_cmp(&KIND_VALUE[*b]));
    }
    let keep = |dropped: usize, fraction: f64| {
        let mut kept = [0.0f64; NK];
        for (index, &kind) in kinds.iter().enumerate() {
            kept[kind] = match index.cmp(&dropped) {
                core::cmp::Ordering::Less => 0.0,
                core::cmp::Ordering::Equal => arriving[kind] * fraction,
                core::cmp::Ordering::Greater => arriving[kind],
            };
        }
        kept
    };
    let run = |kept: &Rates| server_model(game, node, kept, code, call_latency, ctx);
    // The first kind whose loss brings the load under the line, then how much of it to keep.
    let mut dropped = 0;
    while dropped < kinds.len() && run(&keep(dropped + 1, 1.0)).utilization > SHED_AT {
        dropped += 1;
    }
    let (mut low, mut high) = (0.0f64, 1.0f64);
    for _ in 0..16 {
        let middle = (low + high) / 2.0;
        if run(&keep(dropped, middle)).utilization > SHED_AT {
            high = middle;
        } else {
            low = middle;
        }
    }
    let kept = keep(dropped, low);
    let mut model = run(&kept);
    let (mut total, mut left) = (0.0, 0.0);
    for &kind in &kinds {
        let rate = arriving[kind];
        model.shares[kind] = if rate > 0.0 { kept[kind] / rate } else { 1.0 };
        model.shares_mask |= 1 << kind;
        total += rate;
        left += kept[kind];
    }
    model.share = if total > 0.0 { left / total } else { 1.0 };
    model.capacity = full.capacity;
    model
}

#[inline]
fn combine_tail(a: f64, a_ms: f64, b: f64, b_ms: f64) -> (f64, f64) {
    let p = 1.0 - (1.0 - a) * (1.0 - b);
    (p, if a + b > 0.0 { (a * a_ms + b * b_ms) / (a + b) } else { 0.0 })
}

/// `waitOf`: sum of count × latency over the backend kinds, in catalog order.
#[inline]
pub fn wait_of(calls: &Calls, latency: &[f64; NK]) -> f64 {
    let mut sum = 0.0;
    for (&count, &each) in calls.iter().zip(&latency[NR..]) {
        if count != 0.0 {
            sum += count * each;
        }
    }
    sum
}

/// `flatModel`: a Component with a flat capacity.
pub fn flat_model(capacity: f64, arriving: &Rates, order: &Order, fixed_ms: f64, variable_ms: f64, boost: f64) -> Model {
    let rate = order.sum(arriving);
    let utilization = if capacity.is_infinite() { 0.0 } else { rate / (capacity * boost) };
    let share = if utilization > 1.0 { 1.0 / utilization } else { 1.0 };
    let wait = wait_for(variable_ms, utilization, 1.0);
    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];
    // A service entry for every kind sent, a zero rate included, as `Object.keys(arriving)` lists them.
    let mut service_mask = 0u64;
    for kind in order.iter() {
        service_mask |= 1u64 << kind;
        service_fixed[kind] = fixed_ms;
        service_variable[kind] = variable_ms + wait;
    }
    Model {
        utilization,
        share,
        capacity: capacity * boost,
        limit: if utilization <= 0.0 { Limit::None } else { Limit::Throughput },
        service_fixed,
        service_variable,
        service_mask,
        tail_p: 0.0,
        tail_ms: 0.0,
        processes: 0.0,
        inflight: 0.0,
        ..Model::default()
    }
}

/// The `model` half of every Component rule except an App Server's and a
/// database's: a capacity, and a fixed and a variable service time. The pass and
/// the probe both read it, so a Component's capacity has one definition.
pub fn flat_component(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let scale = flat_scale(node.size);
    let flat = |capacity: f64, fixed: f64, variable: f64| flat_model(capacity, rates, order, fixed, variable, boost);
    // `unlimited`: no capacity to run out of, so the boost does not apply.
    let unlimited = |fixed: f64, variable: f64| flat_model(f64::INFINITY, rates, order, fixed, variable, 1.0);
    match node.type_code {
        component::USERS => unlimited(30.0, 0.0),
        component::DNS => unlimited(0.0, 0.0),
        component::AUTH => unlimited(120.0, 15.0),
        component::WAREHOUSE => unlimited(1_500.0, 200.0),
        component::LB => flat(
            FLAT_CAPACITY[component::LB]
                * scale
                * if node.variant == 1 { L4_CAPACITY } else { 1.0 }
                * if node.policy == 3 && game.has(research::LB_ALGORITHMS) { P2C_CAPACITY } else { 1.0 },
            if node.variant == 1 { L4_MS } else { 1.0 },
            0.1,
        ),
        component::POOLER => flat(FLAT_CAPACITY[component::POOLER] * scale, 0.3, 0.0),
        // A Data team owns the pipelines, and a pipeline has half the lag with one.
        component::CDC => flat(CDC_RATE * scale, CDC_MS * if game.data_staffed { DATA_TEAM_LAG } else { 1.0 }, 0.05),
        component::MSGP => flat(MSGP_RATE * scale, 100.0, 10.0),
        component::PSP => {
            let slow = if game.incident == Some(Incident::DoubleCharge) { SLOW_CHARGE_MS } else { 0.0 };
            flat(PSP_CAPACITY * scale, 400.0, 30.0 + slow)
        }
        component::LLM => flat(LLM_RATE * scale, LLM_FIRST_TOKEN_MS, 0.0),
        // R2 answers later than S3 unless a CDN on the board takes the first byte.
        component::STORAGE => {
            unlimited(40.0 + if node.r2 && !game.cdn_on_board { R2_FIRST_BYTE_MS } else { 0.0 }, 5.0)
        }
        component::GPU => {
            let batch = GPU_BATCHES_BATCH.iter().position(|size| *size == node.batch).unwrap_or(0);
            let capacity = (GPU_TYPES_TOKENS[node.gpu] * scale) / TOKENS_PER_PROMPT
                * GPU_MODELS_SPEED[node.gpu_model]
                * GPU_PRECISIONS_SPEED[node.precision]
                * GPU_BATCHES_GAIN[batch]
                * node.warm.max(0.1);
            // Continuous batching serves the batch as it arrives, so no wait for a first token.
            let ttft = if game.has(research::CONTINUOUS_BATCHING) { 0.0 } else { GPU_BATCHES_TTFT[batch] };
            flat(capacity, GPU_FIRST_TOKEN_MS + ttft, 100.0)
        }
        component::SEARCH => search_model(game, node, rates, order, boost),
        component::WIDE => wide_model(game, node, rates, order, boost),
        component::QUEUE => flat(QUEUE_RATE * scale, 2.0, 0.05),
        component::DSQL => dsql_model(node, rates, order, boost),
        component::DOC => doc_model(game, node, rates, order, boost),
        component::CDN => unlimited(8.0, 0.0),
        component::EDGE => flat(f64::INFINITY, EDGE_MS, 0.0),
        component::WS => ws_model(game, node, rates, order, boost),
        component::GW => flat(
            FLAT_CAPACITY[component::GW] * scale,
            6.0 + if node.auth_edge { GATEWAY_AUTH_MS } else { 0.0 },
            0.1,
        ),
        component::LOG => flat(LOG_RATE * scale / hot_key_factor(game, node), LOG_ACKS_LATENCY[node.acks] * 5.0, 0.1),
        // The index lives in memory: its type decides how many lookups it answers.
        component::VEC => flat(VEC_QUERIES * scale * VEC_INDEXES_QUERIES[node.index_type] / hot_key_factor(game, node), 20.0, 2.0),
        // Redis answers on one main thread; Memcached on every core of its box.
        component::CACHE => {
            let cores = if CACHE_ENGINES_SCALES[node.cache_engine] { grown(1.0, 2.0, node.size - 3.0).max(1.0) } else { 1.0 };
            flat(CACHE_OPS * cores / hot_key_factor(game, node), 0.5, 0.2)
        }
        component::WAF => {
            let waf = Waf::of(node, game);
            let regex = if game.incident == Some(Incident::Regex) { REGEX_CAPACITY } else { 1.0 };
            let attack = if node.under_attack { UNDER_ATTACK_LATENCY[0] } else { 0.0 };
            flat(FLAT_CAPACITY[component::WAF] * scale / waf.cpu * regex, 2.0 + attack, 0.1)
        }
        // Control-plane Components take no traffic.
        _ => flat_model(f64::INFINITY, &[0.0; NK], &Order::default(), 0.0, 0.0, 1.0),
    }
}

/// `hotKeyFactor`: one key takes a big share of a Cache's traffic and lands on
/// one shard, which sets the pace for the rest.
fn hot_key_factor(game: &GameCtx, node: &Node) -> f64 {
    if game.incident != Some(Incident::HotKey) || game.incident_node != node.id {
        return 1.0;
    }
    if node.split && game.has(research::HYBRID_FANOUT) {
        return 1.0;
    }
    let shards = flat_scale(node.size).max(2.0);
    HOT_KEY_SHARE * shards + 1.0 - HOT_KEY_SHARE
}

/// `wafOf`: what a WAF blocks and costs at its paranoia level, or in Under
/// attack mode. Bot management halves its false positives.
pub struct Waf {
    pub block: f64,
    pub false_positive: f64,
    pub cpu: f64,
}

impl Waf {
    pub fn of(node: &Node, game: &GameCtx) -> Waf {
        let soften = |rate: f64| if game.has(research::BOT_MANAGEMENT) { rate * BOT_MANAGEMENT_FALSE } else { rate };
        if node.under_attack {
            return Waf { block: UNDER_ATTACK_BLOCK[0], false_positive: soften(UNDER_ATTACK_FALSE_POSITIVE[0]), cpu: UNDER_ATTACK_CPU[0] };
        }
        let level = (node.paranoia - 1.0).clamp(0.0, (PARANOIA_BLOCK.len() - 1) as f64) as usize;
        Waf { block: PARANOIA_BLOCK[level], false_positive: soften(PARANOIA_FALSE_POSITIVE[level]), cpu: PARANOIA_CPU[level] }
    }

    /// The share of `kind` it stops: bots at the block rate, people at the false positive rate.
    #[inline]
    pub fn stops(&self, kind: usize) -> f64 {
        if kind == kind::BOT { self.block } else { self.false_positive }
    }
}

/// A Cache's view of its TTL, strategy, and hit ratio.
pub mod cache {
    use super::*;

    /// `cacheTtlOf`: the TTL class a Cache's TTL falls in.
    #[inline]
    pub fn ttl_row(node: &Node) -> usize {
        if node.ttl <= 10.0 {
            0
        } else if node.ttl < 3_600.0 {
            1
        } else {
            2
        }
    }

    /// `cacheStrategyOf`: the strategy it runs; without the research, cache-aside.
    #[inline]
    pub fn strategy(game: &GameCtx, node: &Node) -> usize {
        if game.has(research::CACHE_STRATEGIES) { node.cache_strategy } else { cache_strategy::ASIDE }
    }

    /// `ttlFactorOf`: the share of reads its TTL keeps as hits.
    pub fn ttl_factor(game: &GameCtx, node: &Node) -> f64 {
        let factor = CACHE_TTLS_FACTOR[ttl_row(node)];
        if !game.has(research::STAMPEDE_PROTECTION) {
            return factor;
        }
        if node.swr {
            return 1.0;
        }
        if node.early_expiry { factor + (1.0 - factor) * EARLY_LIFT } else { factor }
    }

    /// `hitRatioOf`: sqrt(memory / hot data) x TTL x invalidation x warmth.
    pub fn hit_ratio(game: &GameCtx, node: &Node, write_share: f64, warm: f64) -> f64 {
        let memory = flat_scale(node.size);
        let hot = (game.users * HOT_KB_PER_USER) / 1_000_000.0;
        let fits = if hot > 0.0 { (memory / hot).min(1.0) } else { 1.0 };
        fits.sqrt() * ttl_factor(game, node) * (1.0 - (2.0 * write_share).min(0.5)) * warm
    }
}

/// `refreshOf`: a Search Engine's refresh row, or the first when none matches.
#[inline]
pub fn refresh_row(node: &Node) -> usize {
    SEARCH_REFRESH_SECONDS.iter().position(|seconds| *seconds == node.refresh).unwrap_or(0)
}

/// `searchRule.model`: shards fan a query out, replicas add capacity, and the heap
/// trades collector pauses against the file system cache.
fn search_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let variant = node.search_variant;
    let jvm = SEARCH_VARIANTS_JVM[variant];
    let shards = if jvm { node.search_shards } else { 1.0 };
    let heap = if jvm { node.heap } else { search_heap::HALF };
    let capacity = (SEARCH_QPS
        * flat_scale(node.size)
        * SEARCH_REFRESH_CAPACITY[refresh_row(node)]
        * SEARCH_VARIANTS_CAPACITY[variant]
        * (shards / (1.0 + SEARCH_FANOUT * (shards - 1.0)))
        * (1.0 + if jvm { node.search_replicas } else { 0.0 })
        * SEARCH_HEAPS_CAPACITY[heap]
        * node.warm)
        / game.query[backend::Q_SEARCH];
    Model {
        tail_p: SEARCH_HEAPS_TAIL_P[heap],
        tail_ms: SEARCH_HEAPS_TAIL_MS[heap],
        ..flat_model(capacity, rates, order, SEARCH_VARIANTS_FIXED_MS[variant], 2.0, boost)
    }
}

/// A Wide-column Store's replicas, and its read and write quorums, clamped.
#[inline]
pub fn quorum_n(node: &Node) -> f64 {
    node.quorum_n.clamp(1.0, 5.0)
}

#[inline]
pub fn quorum_r(node: &Node) -> f64 {
    node.quorum_r.min(quorum_n(node)).max(1.0)
}

#[inline]
pub fn quorum_w(node: &Node) -> f64 {
    node.quorum_w.min(quorum_n(node)).max(1.0)
}

/// `splitWork`: a data Node's reads, and its writes of every kind.
#[inline]
pub fn split_work(rates: &Rates) -> (f64, f64) {
    (rates[kind::Q_READ], rates[kind::Q_WRITE] + rates[kind::Q_TX] + rates[kind::K_WRITE])
}

/// `dsqlRule.model`: a write waits for a majority of its regions; a read asks the leaseholder.
fn dsql_model(node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let (reads, writes) = split_work(rates);
    let rate = reads + writes;
    let work = reads * DSQL_READ_COST + writes;
    let capacity = (DSQL_TX * flat_scale(node.size)) / if work > 0.0 { work / rate } else { 1.0 };
    let mut model = flat_model(capacity, rates, order, 3.0, 1.0, boost);
    for kind in (0..NK).filter(|&kind| kind != kind::Q_READ && (model.service_mask >> kind) & 1 == 1) {
        model.service_fixed[kind] += node.majority_ms;
    }
    model
}

/// `cdnHitOf`: the share of a kind a CDN answers at the edge.
pub fn cdn_hit(game: &GameCtx, node: &Node, kind: usize) -> f64 {
    let ttl = CDN_TTL_VALUES.iter().position(|ttl| *ttl == node.ttl).unwrap_or(1);
    let base = if kind == kind::PAGE {
        // The anonymous share, plus the shell of a logged-in page with Edge-side includes.
        let esi = if game.has(research::ESI) { ESI_PAGE_HIT } else { 0.0 };
        CDN_HIT[kind::PAGE] * ANONYMOUS_PAGE + (CDN_HIT[kind::PAGE] + esi) * (1.0 - ANONYMOUS_PAGE)
    } else if kind == kind::MEDIA && game.has(research::TIERED_CACHING) {
        TIERED_MEDIA_HIT
    } else if kind == kind::READ && game.edge_on_board {
        EDGE_READ_HIT
    } else {
        CDN_HIT[kind]
    };
    let factor = CDN_TTL_FACTOR[ttl];
    let hit = base * factor * CACHE_KEYS_HIT[node.cache_key] * node.warm;
    let regenerated = if kind == kind::PAGE { game.static_pages } else { 0.0 };
    (hit + (1.0 - hit) * regenerated * factor * node.warm).min(0.95)
}

/// `hubConnections`: connections a Realtime Hub holds, the RAM it gives them over
/// what one costs its runtime. Without Clustering only one box takes them.
pub fn hub_connections(node: &Node, built_in: bool) -> f64 {
    let per_connection = RUNTIME_CONNECTION_KB[node.runtime];
    if per_connection < 0.0 {
        return 0.0;
    }
    (HUB_RAM_KB * if node.clustering || built_in { flat_scale(node.size) } else { 1.0 }) / per_connection
}

/// `wsRule.model`: a Hub holds a connection for each realtime message for the hold
/// time. A runtime that holds a worker per connection takes the traffic and refuses it.
fn ws_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    if RUNTIME_CONNECTION_KB[node.runtime] < 0.0 {
        return flat_model(f64::INFINITY, rates, order, 1.0, 0.0, boost);
    }
    // Distributed Erlang gives an Elixir Hub its own cluster backbone.
    let built_in = game.has(research::DISTRIBUTED_ERLANG) && RUNTIME_LANGUAGE[node.runtime] == language::ELIXIR;
    let rate = (hub_connections(node, built_in) / RT_HOLD_SECONDS) * if node.presence { 1.0 - PRESENCE_CPU } else { 1.0 };
    flat_model(rate, rates, order, 1.0, 0.0, boost)
}

/// `serverlessModel`: one execution environment per in-flight request, up to the
/// concurrency cap. An execution lasts the request's CPU plus the calls it waits on,
/// so Little's law turns a mean execution into the requests a second the cap allows.
pub fn serverless_model(node: &Node, arriving: &Rates, code: &Code, latency: &Rates, boost: f64) -> Model {
    // `waitOf`: the calls one request waits on, in backend order.
    let waiting = |kind: usize| {
        code.calls[kind].iter().zip(&latency[NR..]).fold(0.0, |sum, (&count, &each)| if count != 0.0 { sum + count * each } else { sum })
    };
    let kinds = || (0..NR).filter(|&kind| arriving[kind] > 0.0);
    let rate = kinds().fold(0.0, |sum, kind| sum + arriving[kind]);
    let concurrency = SERVERLESS_CONCURRENCY * boost;
    let inflight = kinds().fold(0.0, |sum, kind| sum + (arriving[kind] * (code.cpu[kind] + waiting(kind))) / 1_000.0);
    let utilization = if concurrency > 0.0 {
        inflight / concurrency
    } else if rate > 0.0 {
        99.0
    } else {
        0.0
    };
    let share = if utilization > 1.0 { 1.0 / utilization } else { 1.0 };
    // A new environment starts cold, and one reaped after an idle gap starts cold too.
    let cold = (1.0 - node.warm).max(1.0 / (1.0 + rate.max(0.0) * SERVERLESS_IDLE_SECONDS));
    let used = inflight * share;
    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];
    for kind in 0..NR {
        service_fixed[kind] = SERVERLESS_MS;
        service_variable[kind] = code.cpu[kind] + waiting(kind);
    }
    // `coldStartMs`: native images start fast; every other runtime pays its language's start.
    let tail_ms = if node.runtime == runtime::GRAAL || node.runtime == runtime::NATIVE_AOT {
        NATIVE_COLD_MS
    } else {
        COLD_START_MS[RUNTIME_LANGUAGE[node.runtime]]
    };
    Model {
        utilization,
        share,
        capacity: if rate > 0.0 { rate / utilization.max(1e-9) } else { 0.0 },
        limit: if utilization <= 0.0 { Limit::None } else { Limit::Throughput },
        service_fixed,
        service_variable,
        service_mask: (1u64 << NR) - 1,
        tail_p: cold,
        tail_ms,
        processes: used,
        inflight: used,
        resources: Resources { slots: Some(Gauge { used, total: concurrency }), ..Resources::default() },
        ..Model::default()
    }
}

/// `docRule.model`: one flat rate of ops, a join at three of them. A join touches
/// three documents and a transaction waits for each, so latency grows with the ops.
fn doc_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let join = |kind: usize| if kind == kind::Q_TX || kind == kind::Q_SCAN { DOC_JOIN_COST } else { 1.0 };
    let (rate, ops) = order.iter().fold((0.0, 0.0), |(rate, ops), kind| (rate + rates[kind], ops + rates[kind] * join(kind)));
    let per_op = if rate > 0.0 { ops / rate } else { 1.0 };
    let capacity = DOC_OPS * flat_scale(node.size) / hot_key_factor(game, node) / per_op;
    let mut model = flat_model(capacity, rates, order, 3.0, DOC_OP_MS, boost);
    let read = if (model.service_mask >> kind::Q_READ) & 1 == 1 { model.service_variable[kind::Q_READ] } else { DOC_OP_MS };
    let wait = read - DOC_OP_MS;
    for kind in (0..NK).filter(|&kind| (model.service_mask >> kind) & 1 == 1) {
        let slower = if node.transactions && (kind == kind::Q_WRITE || kind == kind::Q_TX) { 1.0 + DOC_TXN_LATENCY } else { 1.0 };
        model.service_variable[kind] = DOC_OP_MS * join(kind) * slower + wait;
    }
    model
}

/// Mean ms one Wide-column replica takes to answer.
const WIDE_REPLICA_MS: f64 = 2.0;

/// `wideRule.model`: a read waits for R replies and a write for W, of N replicas.
fn wide_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let (reads, writes) = split_work(rates);
    let ops = reads * quorum_r(node) + writes * quorum_n(node);
    let rate = reads + writes;
    let capacity = (WIDE_OPS * flat_scale(node.size)) / hot_key_factor(game, node) / if ops > 0.0 { ops / rate } else { 1.0 };
    let mut model = flat_model(capacity, rates, order, 1.0, 0.0, boost);
    let wait = if (model.service_mask >> kind::Q_READ) & 1 == 1 { model.service_variable[kind::Q_READ] } else { 0.0 };
    for kind in 0..NK {
        if (model.service_mask >> kind) & 1 == 0 {
            continue;
        }
        let quorum = if kind == kind::Q_READ { quorum_r(node) } else { quorum_w(node) };
        model.service_fixed[kind] = 1.0;
        model.service_variable[kind] = wait + WIDE_REPLICA_MS * crate::dist::kth_fastest(quorum, quorum_n(node));
    }
    model
}

/// `scanEviction`: the share of the buffer cache report scans evict.
#[inline]
fn scan_eviction(scan_work: f64, cores: f64) -> f64 {
    if cores > 0.0 {
        (2.0 * scan_work / (cores * 1000.0)).min(1.0)
    } else {
        1.0
    }
}

/// `indexWriteFactor`: every index a Service keeps costs a write a little more.
#[inline]
pub fn index_write_factor(game: &GameCtx) -> f64 {
    1.0 + INDEX_WRITE_COST * game.service_indexes
}

/// `shardingOf`: the shards a Database spreads its rows over.
#[derive(Clone, Copy)]
pub struct Sharding {
    pub shards: f64,
    pub hot: f64,
    pub cross: f64,
    pub scatter: f64,
    pub scatter_ms: f64,
    pub far_ms: f64,
}

pub fn sharding_of(node: &Node) -> Sharding {
    let shards = if node.shards.floor() > 1.0 { node.shards.floor() } else { 1.0 };
    let key = node.shard_key.min(3);
    let cross = if shards > 1.0 { SHARD_CROSS[key] * (1.0 - 1.0 / shards) } else { 0.0 };
    Sharding {
        shards,
        hot: if shards > 1.0 { SHARD_HOT[key] + (1.0 - SHARD_HOT[key]) / shards } else { 1.0 },
        cross,
        scatter: 1.0 + SCATTER_CPU * (shards - 1.0),
        scatter_ms: SCATTER_MS * (shards - 1.0),
        far_ms: if shards > 1.0 { SHARD_FAR_MS[key] * (1.0 - 1.0 / shards) } else { 0.0 },
    }
}

/// The Database model: `databaseModel` from capacity.ts.
///
/// A board with no Data Groups and no physical topology reads the same figures
/// the TypeScript does, because every branch it takes is the single-topology
/// branch. Groups and topology are read from the Node, so a board that uses
/// them takes the same branches here.
pub fn database_model(
    game: &GameCtx,
    node: &Node,
    arriving: &Rates,
    boost: f64,
    connections: f64,
) -> Model {
    let engine = node.db_engine.min(1);
    let vcpu = vcpu_of(node.size) * boost;
    let ram = ram_of(node.size, node.family) * boost;
    let connection_ram = (connections * DB_CONNECTION_MB[engine]) / 1024.0;
    // One Service over one Database: the group holds the Company's users.
    let group_users = node.users_in_group;
    let topology = node.topology;
    let database_count = if node.type_code == component::DATABASE { node.databases_in_group } else { 1.0 };
    let shard_share = if topology == 2 && database_count > 1.0 { 1.0 / database_count } else { 1.0 };
    let working_set = (LOCAL_DB_RAM + group_users * LOCAL_DB_RAM_PER_USER) * shard_share;
    let footprint = working_set + connection_ram;
    let disk = footprint > ram - OS_RAM;
    let logical = sharding_of(node);
    let shards = logical.shards
        * if topology == 2 && node.type_code == component::DATABASE { database_count } else { 1.0 };
    let cross = if shards > 1.0 { SHARD_CROSS[node.shard_key.min(3)] * (1.0 - 1.0 / shards) } else { 0.0 };
    let scatter = 1.0 + SCATTER_CPU * (shards - 1.0);
    let hot = if shards > 1.0 {
        SHARD_HOT[node.shard_key.min(3)] + (1.0 - SHARD_HOT[node.shard_key.min(3)]) / shards
    } else {
        1.0
    };
    let far_ms = if shards > 1.0 {
        SHARD_FAR_MS[node.shard_key.min(3)] * (1.0 - 1.0 / shards)
    } else {
        0.0
    };
    let iops = STORAGE_IOPS[node.iops.min(1)] * shards * node.iops_factor;
    let throttled = node.family == 0 && node.credits < 1.0;
    let incident = game.incident;
    let slowed = incident == Some(Incident::RetryStorm)
        && game.incident_node == node.id
        && game.time - game.incident_started < STORM_TRIGGER;
    let cores = (if throttled { BURST_BASELINE * vcpu } else { vcpu })
        * if slowed { STORM_SLOWDOWN } else { 1.0 };
    let per_request = cores.min(1.0);
    let warmth = 0.5 + 0.5 * node.warm;
    let scan = if incident == Some(Incident::SlowQuery) { group_users * ROWS_PER_USER * UNINDEXED_MS_PER_ROW } else { 0.0 };
    let scans = arriving[NR + backend::Q_SCAN];
    let retention = node.keep.min(2);
    let view = if node.materialized && game.has(research::PRECOMPUTE) { MATERIALIZED_SCAN } else { 1.0 };
    let scan_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_SCAN]
        * DB_SCAN[engine]
        * scatter
        * if incident == Some(Incident::ReportDb) { REPORT_SURGE } else { 1.0 }
        * RETENTION_REBUILD[retention]
        * view)
        / warmth;
    let evicted = if scans > 0.0 { scan_eviction(scans * scan_cpu, cores) } else { 0.0 };
    let shard = if incident == Some(Incident::HotShard) && game.incident_node == node.id { HOT_SHARD_CPU } else { 1.0 };
    let bloat = if incident == Some(Incident::TableBloat) && game.incident_node == node.id { BLOAT_CPU } else { 1.0 };
    let denormalized = game.has(research::DENORMALIZATION);
    let read_cpu = (if evicted > 0.0 {
        ((QUERY_CPU_BY_BACKEND[backend::Q_READ] + scan) * if disk { 1.5 } else { 1.0 + 0.5 * evicted }) / warmth
    } else {
        ((QUERY_CPU_BY_BACKEND[backend::Q_READ] + scan) * if disk { 1.5 } else { 1.0 }) / warmth
    }) * shard
        * bloat
        * if denormalized { DENORMALIZED_READ } else { 1.0 }
        * DB_READ[engine];
    let multi_leader = topology == 1 && database_count > 1.0;
    let write_cpu = ((QUERY_CPU_BY_BACKEND[backend::Q_WRITE] * game.query[backend::Q_WRITE]) / warmth)
        * (1.0 + 0.5 * evicted)
        * shard
        * bloat
        * index_write_factor(game)
        * if denormalized { DENORMALIZED_WRITE } else { 1.0 }
        * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 };
    let search_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_SEARCH] * game.query[backend::Q_SEARCH] * DB_SEARCH_COST[engine] * scatter)
        / warmth;
    let put_cpu = QUERY_CPU_BY_BACKEND[backend::BLOB_PUT] / warmth;
    let tx_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_TX] * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 })
        / warmth;
    let get_cpu = QUERY_CPU_BY_BACKEND[backend::BLOB_GET] / warmth;

    let reads = arriving[NR + backend::Q_READ];
    let writes = arriving[NR + backend::Q_WRITE];
    let searches = arriving[NR + backend::Q_SEARCH];
    let puts = arriving[NR + backend::BLOB_PUT];
    let txs = arriving[NR + backend::Q_TX];
    let gets = arriving[NR + backend::BLOB_GET];
    let mut rate = reads + writes + searches + puts;
    let mut work = reads * read_cpu + (writes * write_cpu + puts * put_cpu) * hot + searches * search_cpu;
    if txs > 0.0 || gets > 0.0 {
        rate += txs + gets;
        work += txs * tx_cpu + gets * get_cpu;
    }
    if scans > 0.0 {
        rate += scans;
        work += scans * scan_cpu;
    }
    // A CDC Connector reads the write log: every change it copies is one more read on the volume.
    let cdc_ops = if node.cdc_mirrored { writes + txs } else { 0.0 };
    let disk_ops = writes + txs + puts + gets + scans + if disk { reads } else { 0.0 } + cdc_ops;
    let io_utilization = if iops > 0.0 { disk_ops / iops } else { 0.0 };
    let io_wait = wait_for(disk_ms(node.iops), io_utilization.min(0.98), 1.0);
    let cpu_utilization = if cores > 0.0 {
        work / (cores * 1000.0)
    } else if rate > 0.0 {
        99.0
    } else {
        0.0
    };
    let utilization = cpu_utilization.max(io_utilization);
    let capacity = if rate > 0.0 { rate / utilization.max(1e-9) } else { 0.0 };
    let backlog = if node.depth > 0.0 && capacity > 0.0 { (node.depth / capacity) * 1000.0 } else { 0.0 };
    let wait = if rate > 0.0 {
        wait_for(work / rate / per_request, utilization, cores) + backlog
    } else {
        backlog
    };
    let share = if utilization > 1.0 { 1.0 / utilization } else { 1.0 };
    let used = (work * share).min(cores * 1000.0) / 1000.0;
    let on_disk = io_utilization > 0.0 && io_utilization >= cpu_utilization;
    let distributed = 1.0 + 2.0 * cross;
    let sync_ms = node.sync_wait;
    let tx_service_fixed = 2.5 * distributed + sync_ms + far_ms;
    let tx_service_variable = (tx_cpu / per_request + wait + io_wait) * distributed;

    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];
    // The backend kinds a Database answers, at their place in the full kind list.
    let mut service_mask = 0u64;
    let mut put = |backend: usize, fixed: f64, variable: f64, mask: &mut u64| {
        let kind = NR + backend;
        *mask |= 1u64 << kind;
        service_fixed[kind] = fixed;
        service_variable[kind] = variable;
    };
    put(backend::Q_READ, 2.5 + far_ms + if disk { 8.0 } else if evicted > 0.0 { 8.0 * evicted } else { 0.0 },
        read_cpu / per_request + wait + if disk { io_wait } else { 0.0 }, &mut service_mask);
    put(backend::Q_WRITE, 2.5 + sync_ms + far_ms, write_cpu / per_request + wait + io_wait, &mut service_mask);
    put(backend::Q_SEARCH, 2.5 + logical.scatter_ms, search_cpu / per_request + wait, &mut service_mask);
    put(backend::BLOB_PUT, 2.5, put_cpu / per_request + wait + io_wait, &mut service_mask);
    put(backend::Q_TX, tx_service_fixed, tx_service_variable, &mut service_mask);
    put(backend::BLOB_GET, 2.5 + 8.0, get_cpu / per_request + wait + io_wait, &mut service_mask);
    put(backend::Q_SCAN, 2.5 + 8.0 + RETENTION_SCAN_MS[retention] + logical.scatter_ms, scan_cpu / per_request + wait + io_wait, &mut service_mask);

    // When the volume's IOPS set the load, work counts disk operations: every write,
    // and a read only when the working set misses RAM. Searches stay in memory.
    let mut work = [0.0f64; NK];
    if on_disk {
        work = [1.0; NK];
        work[NR + backend::Q_SEARCH] = 0.0;
        if !disk {
            work[NR + backend::Q_READ] = 0.0;
        }
    } else {
        for (backend, total) in [
            (backend::Q_READ, read_cpu),
            (backend::Q_WRITE, write_cpu * hot),
            (backend::Q_SEARCH, search_cpu),
            (backend::BLOB_PUT, put_cpu * hot),
            (backend::Q_TX, tx_cpu),
            (backend::BLOB_GET, get_cpu),
            (backend::Q_SCAN, scan_cpu),
        ] {
            work[NR + backend] = total;
        }
    }
    Model {
        utilization,
        share,
        capacity,
        limit: if utilization <= 0.0 {
            Limit::None
        } else if throttled {
            Limit::Credits
        } else if disk || io_utilization >= cpu_utilization {
            Limit::Disk
        } else {
            Limit::Cpu
        },
        service_fixed,
        service_variable,
        service_mask,
        tail_p: 0.0,
        tail_ms: 0.0,
        processes: 0.0,
        inflight: 0.0,
        shares: [0.0; NR],
        shares_mask: 0,
        work_unit: Some(if on_disk { WorkUnit::Disk } else { WorkUnit::Cpu }),
        work,
        resources: Resources {
            cpu_cores: Some(Gauge { used, total: cores }),
            ram_gb: Some(Gauge { used: (footprint + OS_RAM).min(ram), total: ram }),
            credits: (node.family == 0).then_some((node.credits, BURST_BASELINE * vcpu - used)),
            ..Resources::default()
        },
        throttled,
        swapping: false,
        disk,
    }
}

/// `diskMs`: how long a disk operation takes on a volume class.
#[inline]
fn disk_ms(iops: usize) -> f64 {
    // `diskMs`: one operation's share of a second, at the volume's IOPS.
    let volume = STORAGE_IOPS[iops.min(1)];
    1_000.0 / volume
}

