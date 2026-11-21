use crate::catalog::*;
use crate::extra::*;
use crate::pass::{Calls, Code};

const BURSTABLE_FAMILY: usize = 0;
const GENERAL_FAMILY: usize = 1;
const COMPUTE_FAMILY: usize = 2;
const MEMORY_FAMILY: usize = 3;
const ARM_FAMILY: usize = 4;
const SHED_BISECTION_STEPS: usize = 16;
const NO_CAPACITY_UTILIZATION: f64 = 99.0;
const MS_PER_SECOND: f64 = 1_000.0;
const KB_PER_GB: f64 = 1_048_576.0;
const MB_PER_GB: f64 = 1024.0;
const BITS_PER_BYTE: f64 = 8.0;
const KB_PER_SECOND_PER_GBPS: f64 = 125_000.0;
const MIN_UTILIZATION: f64 = 1e-9;
const DOC_FIXED_MS: f64 = 3.0;

#[inline]
fn bit_set(mask: u64, bit: usize) -> bool {
    (mask >> bit) & 1 == 1
}

struct VariantMemory {
    factor: f64,
    extra_mb: f64,
}

struct Collector {
    present: bool,
    memory_factor: f64,
    pause_ms: f64,
    cpu: f64,
    tuning: f64,
}

pub mod topology {
    pub const MULTI: usize = 1;
    pub const SHARDED: usize = 2;
}

pub type Rates = [f64; NK];

#[derive(Clone, Copy, Debug)]
pub struct Order {
    kinds: [u8; NK],
    len: u8,
    seen: u64,
}

impl Default for Order {
    fn default() -> Self {
        Order {
            kinds: [0; NK],
            len: 0,
            seen: 0,
        }
    }
}

impl Order {
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
        self.kinds[..self.len as usize]
            .iter()
            .map(|&kind| kind as usize)
    }

    #[inline]
    pub fn len(&self) -> usize {
        self.len as usize
    }

    #[inline]
    pub fn is_empty(&self) -> bool {
        self.len == 0
    }

    #[inline]
    pub fn sum(&self, rates: &Rates) -> f64 {
        self.iter().fold(0.0, |total, kind| total + rates[kind])
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Cause {
    Runtime,
    Collector,
    Opcache,
    Variant,
    Arm,
    Recycle,
    Warmup,
    Framework,
    Jit,
    Hashing,
    Async,
    Compression,
    LocalDb,
    Serialization,
    Auth,
    Sampling,
    Neighbours,
    Swapping,
    Gc,
    SlowQuery,
    Disk,
    Eviction,
    HotShard,
    Bloat,
    Denormalization,
    Indexes,
    Features,
    Engine,
    MultiLeader,
    Scatter,
    Report,
    Retention,
    View,
    BusiestShard,
}

#[derive(Clone, Copy)]
pub struct CostLine {
    pub cause: Cause,
    pub plus: bool,
    pub value: f64,
}

#[derive(Clone, Default)]
pub struct Receipt {
    pub base: f64,
    pub lines: Vec<CostLine>,
    pub total: f64,
}

pub trait Lines {
    fn times(&mut self, cause: Cause, value: f64);
    fn plus(&mut self, cause: Cause, value: f64);
}

impl Lines for () {
    #[inline]
    fn times(&mut self, _: Cause, _: f64) {}
    #[inline]
    fn plus(&mut self, _: Cause, _: f64) {}
}

impl Lines for Vec<CostLine> {
    fn times(&mut self, cause: Cause, value: f64) {
        if value != 1.0 {
            self.push(CostLine {
                cause,
                plus: false,
                value,
            });
        }
    }
    fn plus(&mut self, cause: Cause, value: f64) {
        if value != 0.0 {
            self.push(CostLine {
                cause,
                plus: true,
                value,
            });
        }
    }
}

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

    Elsewhere,
}

#[derive(Clone, PartialEq)]
pub struct GameCtx {
    pub users: f64,

    pub researched_bits: [u64; 4],

    pub incident: Option<Incident>,

    pub incident_code_plus_one: usize,

    pub incident_region: Option<usize>,

    pub chaos_target: Option<usize>,

    pub any_certificate_issued: bool,
    pub incident_node: usize,

    pub incident_throttled: bool,
    pub incident_started_at_seconds: f64,
    pub sandbox: bool,
    pub scenario_tasks: bool,

    pub fixes_shipped_bits: u64,

    pub data_staffed: bool,

    pub cdn_on_board: bool,

    pub edge_on_board: bool,

    pub edge_auth: bool,

    pub data_gb: f64,

    pub static_pages: f64,

    pub mix: [f64; NR],

    pub spread_region_bits: f64,

    pub value: [f64; NR],
    pub payload: [f64; NR],
    pub query: [f64; NB],

    pub subscriptions_per_second: f64,

    pub insight_perk: f64,
    pub seed: f64,
    pub time: f64,

    pub service_count: usize,
    pub service_indexes: f64,

    pub stage: f64,

    pub venture: usize,

    pub fixed_mix: bool,

    pub scenario_daily: bool,

    pub deploy_share: f64,
    pub deploy_kinds: u64,

    pub runtime_failure: f64,

    pub cost_index: f64,
    pub egress_factor: f64,

    pub salaries: f64,

    pub shares: [f64; 4],

    pub kind_service: [usize; NR],
}

impl GameCtx {
    #[inline]
    pub fn has(&self, research: usize) -> bool {
        (self.researched_bits[research / 64] >> (research % 64)) & 1 == 1
    }

    #[inline]
    pub fn fixed(&self, fix: usize) -> bool {
        (self.sandbox && !self.scenario_tasks) || bit_set(self.fixes_shipped_bits, fix)
    }
}

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

    pub warm_share: f64,
    pub down: bool,
    pub zone: usize,
    pub region: usize,
    pub db_engine: usize,
    pub ryw: bool,
    pub materialized: bool,
    pub shed: bool,
    pub degrade: bool,
    pub sticky: bool,

    pub fanout: u8,
    pub policy: usize,
    pub variant: usize,
    pub depth: f64,

    pub shards: f64,
    pub shard_key: usize,
    pub iops: usize,
    pub keep: usize,

    pub topology: usize,

    pub pooler_mode: usize,

    pub synchronous_replica: bool,

    pub cert_expires_at_seconds: Option<f64>,

    pub rate_limit: f64,
    pub burst: f64,

    pub max_length: f64,
    pub dlq: bool,
    pub attempts: f64,

    pub transactions: bool,

    pub blast: f64,
    pub buggy: bool,

    pub databases_in_group: f64,
    pub sync_stalled: bool,

    pub has_primary: bool,

    pub mesh: bool,

    pub down_oom: bool,

    pub sampling_ms: f64,

    pub users_in_group: f64,

    pub r2: bool,

    pub archived_share: f64,

    pub search_variant: usize,
    pub search_shards: f64,
    pub heap: usize,
    pub search_replicas: f64,
    pub refresh_seconds: f64,

    pub second_provider: bool,

    pub gpu: usize,
    pub gpu_model: usize,
    pub precision: usize,
    pub batch: f64,

    pub quorum_n: f64,
    pub quorum_r: f64,
    pub quorum_w: f64,
    pub lost_replicas: f64,
    pub spread: bool,

    pub local_region_bits: u32,

    pub queue_attempts: f64,

    pub cache_engine: usize,
    pub ttl_seconds: f64,
    pub swr: bool,
    pub early_expiry: bool,
    pub coalesce: bool,
    pub cache_strategy: usize,
    pub split: bool,

    pub paranoia: f64,
    pub under_attack: bool,

    pub poisoned: bool,

    pub ramped: bool,

    pub sample_rate: f64,

    pub burn: f64,

    pub retrieval: f64,
    pub store_get: f64,
    pub store_put: f64,

    pub sync_wait: f64,

    pub iops_factor: f64,

    pub steal: f64,

    pub cluster: usize,

    pub index_type: usize,

    pub vec_recall: Option<f64>,

    pub majority_ms: f64,

    pub stale_until: f64,

    pub cache_key: usize,

    pub presence: bool,
    pub backoff: bool,
    pub clustering: bool,

    pub warming: bool,

    pub pinned: bool,

    pub partitions: f64,
    pub acks: usize,
    pub retain: f64,
    pub keyed: bool,

    pub cdc_mirrored: bool,

    pub auth_edge: bool,
    pub merge: bool,

    pub shut: bool,
}

#[derive(Clone, Copy)]
pub struct Model {
    pub utilization: f64,
    pub share: f64,
    pub capacity: f64,
    pub limit: Limit,
    pub service_fixed: [f64; NK],
    pub service_variable: [f64; NK],

    pub service_mask: u64,
    pub tail_p: f64,
    pub tail_ms: f64,
    pub processes: f64,
    pub inflight: f64,

    pub shares: [f64; NR],
    pub shares_mask: u64,

    pub efficiency: f64,
    pub collecting: f64,

    pub work_unit: Option<WorkUnit>,

    pub work: [f64; NK],
    pub resources: Resources,
    pub throttled: bool,
    pub swapping: bool,
    pub disk: bool,
}

#[derive(Clone, Copy, Default, PartialEq)]
pub struct Gauge {
    pub used: f64,
    pub total: f64,
}

#[derive(Clone, Copy, Default, PartialEq)]
pub struct Resources {
    pub cpu_cores: Option<Gauge>,
    pub ram_gb: Option<Gauge>,
    pub slots: Option<Gauge>,
    pub network_kbps: Option<Gauge>,

    pub credits: Option<(f64, f64)>,
}

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
            efficiency: 1.0,
            collecting: 1.0,
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

#[derive(Clone, Copy, Default, PartialEq)]
pub struct ServerFlags {
    pub sampling: f64,
    pub hashing: f64,

    pub delegated: bool,
    pub local: bool,

    pub offloaded: bool,
    pub worker: bool,

    pub pod: bool,
    pub mesh: bool,
}

impl ServerFlags {
    pub fn of(
        game: &GameCtx,
        node: &Node,
        sampling: f64,
        delegated: bool,
        offloaded: bool,
        pod: bool,
    ) -> ServerFlags {
        let worker = node.type_code == component::WORKER;
        ServerFlags {
            sampling,

            hashing: if game.incident == Some(Incident::Loop) && !worker {
                4.0
            } else {
                1.0
            },
            delegated: delegated && !worker,
            local: node.local_db && !worker,
            offloaded: offloaded && !worker,
            worker,
            pod,
            mesh: node.mesh,
        }
    }
}

#[derive(Clone, Copy)]
pub struct ServerCtx {
    pub boost: f64,
    pub inflight: f64,
    pub flags: ServerFlags,
}

#[inline]
fn wait_for(service: f64, utilization: f64, servers: f64) -> f64 {
    let rho = if utilization < 0.98 {
        utilization
    } else {
        0.98
    };
    let s = if servers > 1.0 { servers } else { 1.0 };
    (service * rho) / (s * (1.0 - rho))
}

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
    gbps_of(size) * KB_PER_SECOND_PER_GBPS
}

#[inline]
pub fn ram_of(size: f64, family: usize) -> f64 {
    let per_vcpu = match family {
        BURSTABLE_FAMILY => 2.0,
        GENERAL_FAMILY => 4.0,
        COMPUTE_FAMILY => 2.0,
        MEMORY_FAMILY => 8.0,
        _ => 4.0,
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
    base * if node.compress && PROFILE_COMPRESSIBLE[kind] {
        GZIP_RATIO
    } else {
        1.0
    }
}

#[inline]
pub fn transfer_ms(node: &Node, kind: usize, offloaded: bool) -> f64 {
    let payload = payload_of(node, kind, offloaded);
    let streamed = if PROFILE_STREAM[kind] {
        payload.min(STREAM_KB)
    } else {
        payload
    };
    (streamed * BITS_PER_BYTE) / USER_MBPS + (PROFILE_IN_KB[kind] * BITS_PER_BYTE) / USER_UP_MBPS
}

#[inline]
fn hashes_on_pool(game: &GameCtx, node: &Node, kind: usize, flags: &ServerFlags) -> bool {
    RUNTIME_LANGUAGE[node.runtime] == language::NODE
        && game.has(research::LIBUV_POOL)
        && crate::pass::as_login(game, kind)
        && !flags.delegated
        && !flags.worker
}

#[inline]
pub fn cpu_base(
    game: &GameCtx,
    node: &Node,
    kind: usize,
    calls: &Calls,
    flags: &ServerFlags,
) -> f64 {
    cpu_base_with(game, node, kind, calls, flags, &mut ()).1
}

pub fn cpu_base_with(
    game: &GameCtx,
    node: &Node,
    kind: usize,
    calls: &Calls,
    flags: &ServerFlags,
    lines: &mut dyn Lines,
) -> (f64, f64) {
    let parts = speed_parts(game, node);
    let speed = parts.iter().fold(1.0, |speed, (_, part)| speed * part);
    let overhead = overhead_of(node, kind);

    let profile = crate::pass::profile_of(game, kind);
    let login = crate::pass::as_login(game, kind);
    let variant = kind_speed_of(game, node, kind);
    let delegated_login = login && flags.delegated && !flags.worker;

    let slowed = |lines: &mut dyn Lines| {
        lines.times(Cause::Framework, overhead);
        for (cause, part) in parts {
            lines.times(cause, 1.0 / part);
        }
    };
    let base = if delegated_login {
        LOGIN_DELEGATED_CPU
    } else {
        PROFILE_CPU[profile]
    };

    let mut cpu;
    if delegated_login {
        cpu = (LOGIN_DELEGATED_CPU * overhead) / speed;
        slowed(lines);
    } else if PROFILE_NATIVE[profile] {
        cpu = PROFILE_CPU[profile] * if login { flags.hashing } else { 1.0 };
        lines.times(Cause::Hashing, if login { flags.hashing } else { 1.0 });
    } else {
        cpu = (PROFILE_CPU[profile] * overhead) / speed;
        slowed(lines);
    }

    cpu /= variant;
    lines.times(Cause::Jit, 1.0 / variant);
    let mut made = 0.0;
    for &count in calls {
        made += count;
    }
    let serial = made
        * SERIALIZE_MS
        * if game.has(research::BINARY_RPC) {
            0.5
        } else {
            1.0
        };
    let auth =
        if AUTHENTICATED_KINDS_MASK[kind] == 1 && !game.edge_auth && !(login && flags.delegated) {
            AUTH_CHECK_MS
        } else {
            0.0
        };
    if flags.worker {
        lines.plus(Cause::Serialization, serial);
        lines.times(Cause::Async, PROFILE_OFFLOAD[profile]);
        lines.times(Cause::Sampling, 1.0 + flags.sampling);
        return (
            base,
            (cpu + serial) * PROFILE_OFFLOAD[profile] * (1.0 + flags.sampling),
        );
    }
    if flags.offloaded {
        cpu *= 1.0 - PROFILE_OFFLOAD[profile];
        lines.times(Cause::Async, 1.0 - PROFILE_OFFLOAD[profile]);
    }
    if node.compress && PROFILE_COMPRESSIBLE[profile] {
        cpu *= GZIP_CPU;
        lines.times(Cause::Compression, GZIP_CPU);
    }
    if flags.local {
        let mut queries = 0.0;
        for (&count, &each) in calls.iter().zip(&QUERY_CPU_BY_BACKEND) {
            if count != 0.0 && each >= 0.0 {
                queries += count * each;
            }
        }
        cpu += queries * LOCAL_DB_CONTENTION;
        lines.plus(Cause::LocalDb, queries * LOCAL_DB_CONTENTION);
    }
    lines.plus(Cause::Serialization, serial);
    lines.plus(Cause::Auth, auth);
    lines.times(Cause::Sampling, 1.0 + flags.sampling);
    (base, (cpu + serial + auth) * (1.0 + flags.sampling))
}

fn speed_parts(game: &GameCtx, node: &Node) -> [(Cause, f64); 7] {
    let runtime = node.runtime;
    let language = RUNTIME_LANGUAGE[runtime];
    let collector = if language == language::JAVA {
        COLLECTOR_SPEED[node.collector.min(2)]
    } else {
        1.0
    };
    let opcache = if language == language::PHP && game.has(research::OPCACHE) {
        1.0 + (OPCACHE_SPEED - 1.0) * node.warm_share
    } else {
        1.0
    };

    let variant = (if language == language::RUBY && game.has(research::YJIT) {
        YJIT_SPEED
    } else {
        1.0
    }) * if language == language::RUST && game.has(research::JEMALLOC) {
        JEMALLOC_SPEED
    } else {
        1.0
    };
    let arm = if node.family == ARM_FAMILY {
        ARM_SPEED
    } else {
        1.0
    };

    let recycled = if node.recycle && RUNTIME_PERSISTENT[runtime] {
        1.0 - (RUNTIME_STARTUP_S[runtime]
            + (1.0 - RUNTIME_WARM_FROM[runtime]) * RUNTIME_WARMUP[runtime])
            / RECYCLE_CYCLE_SECONDS
    } else {
        1.0
    };

    let scaled_up_cold =
        game.incident == Some(Incident::JvmWarmup) && game.incident_node == node.id && !node.ramped;
    let warmup = RUNTIME_WARM_FROM[runtime]
        + (1.0 - RUNTIME_WARM_FROM[runtime]) * if scaled_up_cold { 0.0 } else { node.warm_share };
    [
        (Cause::Runtime, RUNTIME_SPEED[runtime]),
        (Cause::Collector, collector),
        (Cause::Opcache, opcache),
        (Cause::Variant, variant),
        (Cause::Arm, arm),
        (Cause::Recycle, recycled),
        (Cause::Warmup, warmup),
    ]
}

fn overhead_of(node: &Node, kind: usize) -> f64 {
    let runtime = node.runtime;
    let framework = node.framework;

    if FRAMEWORK_ASGI[framework] && RUNTIME_MODEL[runtime] != Concurrency::Loop {
        return FRAMEWORK_CPU[framework][kind];
    }
    let factor = RUNTIME_OVERHEAD_FACTOR[runtime];
    let booted = if factor == 0.0 {
        let kept = FRAMEWORK_WORKER_OVERHEAD[framework];
        if kept >= 0.0 {
            kept
        } else {
            1.0
        }
    } else {
        1.0 + (FRAMEWORK_OVERHEAD[framework] - 1.0) * factor
    };
    booted * FRAMEWORK_CPU[framework][kind]
}

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

fn variant_memory(game: &GameCtx, node: &Node) -> VariantMemory {
    let mut factor = 1.0;
    if RUNTIME_LANGUAGE[node.runtime] == language::RUBY && game.has(research::YJIT) {
        factor *= YJIT_MEMORY;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUST && game.has(research::JEMALLOC) {
        factor *= JEMALLOC_MEMORY;
    }
    let mut extra_mb = 0.0;
    if RUNTIME_LANGUAGE[node.runtime] == language::NODE && game.has(research::WORKER_THREADS) {
        extra_mb += WORKER_THREADS * WORKER_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::NODE && game.has(research::LIBUV_POOL) {
        extra_mb += LIBUV_THREADS * LIBUV_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == language::RUST && game.has(research::SPAWN_BLOCKING) {
        extra_mb += SPAWN_BLOCKING_THREADS * SPAWN_BLOCKING_THREAD_MB;
    }
    VariantMemory { factor, extra_mb }
}

fn collector_of(node: &Node) -> Collector {
    let language = RUNTIME_LANGUAGE[node.runtime];
    if RUNTIME_GC_PAUSE[node.runtime] < 0.0 {
        return Collector {
            present: false,
            memory_factor: 1.0,
            pause_ms: 0.0,
            cpu: 0.0,
            tuning: 1.0,
        };
    }
    if language == language::JAVA {
        let index = node.collector.min(2);
        return Collector {
            present: true,
            memory_factor: COLLECTOR_MEMORY[index],
            pause_ms: COLLECTOR_PAUSE[index],
            cpu: RUNTIME_GC_CPU[node.runtime],
            tuning: 1.0,
        };
    }
    if language == language::GO {
        let index = if node.gogc < 3 { node.gogc } else { 1 };
        return Collector {
            present: true,
            memory_factor: GOGC_MEMORY[index],
            pause_ms: RUNTIME_GC_PAUSE[node.runtime],
            cpu: RUNTIME_GC_CPU[node.runtime] * GOGC_CPU[index],
            tuning: 1.0 + RUNTIME_GC_CPU[node.runtime] * (GOGC_CPU[index] - 1.0),
        };
    }
    Collector {
        present: true,
        memory_factor: 1.0,
        pause_ms: RUNTIME_GC_PAUSE[node.runtime],
        cpu: RUNTIME_GC_CPU[node.runtime],
        tuning: 1.0,
    }
}

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
    let VariantMemory {
        factor: variant_factor,
        extra_mb: variant_extra,
    } = variant_memory(game, node);
    let copies = node.replicas;
    let vcpu = vcpu_of(node.size) * ctx.boost * copies;
    let ram = ram_of(node.size, node.family) * ctx.boost * copies;
    let model = RUNTIME_MODEL[runtime];

    let processes = if runtime == runtime::MOD_PHP {
        APACHE_MAX_WORKERS.min((ctx.inflight).ceil() + APACHE_SPARE)
    } else if RUNTIME_POOL[runtime] {
        node.workers * copies
    } else if (model == Concurrency::Threads && !RUNTIME_PARALLEL[runtime])
        || runtime == runtime::NODE_CLUSTER
    {
        (vcpu / copies).round().max(1.0) * copies
    } else {
        copies
    };
    let slots =
        if model == Concurrency::Loop || model == Concurrency::Green || model == Concurrency::Async
        {
            f64::INFINITY
        } else if model == Concurrency::Threads {
            processes * RUNTIME_THREADS[runtime]
        } else if runtime == runtime::MOD_PHP {
            APACHE_MAX_WORKERS * ctx.boost * copies
        } else {
            node.workers * ctx.boost * copies
        };

    let pm = if runtime == runtime::PHP_FPM {
        node.pm.min(PM_SPARES.len() - 1)
    } else {
        0
    };
    let (pm_spares, pm_spawn_share, pm_spawn_ms) =
        (PM_SPARES[pm], PM_SPAWN_SHARE[pm], PM_SPAWN_MS[pm]);
    let resident = if pm_spares < 0.0 {
        processes
    } else {
        processes.min((ctx.inflight.ceil() + pm_spares).max(1.0))
    };
    let connections = arriving[kind::RT] * RT_HOLD_SECONDS;
    let connection_kb = RUNTIME_CONNECTION_KB[runtime];
    let connection_ram = if connections > 0.0 && connection_kb >= 0.0 {
        (connections * connection_kb) / KB_PER_GB
    } else {
        0.0
    };
    let Collector {
        present: has_collector,
        memory_factor: collector_memory,
        pause_ms: gc_pause,
        cpu: gc_cpu,
        tuning: gc_tuning,
    } = collector_of(node);
    let usable = if RUNTIME_PARALLEL[runtime] {
        vcpu
    } else if model == Concurrency::Process {
        vcpu.min(processes.max(1.0))
    } else {
        vcpu.min(processes)
    };
    let throttled = node.family == BURSTABLE_FAMILY && node.credits < 1.0;
    let shared = if ctx.flags.mesh {
        usable * (1.0 - MESH_OVERHEAD)
    } else {
        usable
    };
    let cores = if throttled {
        shared.min(BURST_BASELINE * vcpu)
    } else {
        shared
    };
    let mut ram_used = OS_RAM * copies;
    ram_used += (resident
        * (RUNTIME_MEMORY_MB[runtime] * variant_factor * collector_memory
            + FRAMEWORK_MEMORY_MB[framework]))
        / 1024.0;
    ram_used += (resident * variant_extra) / 1024.0;
    if ctx.flags.local {
        ram_used += LOCAL_DB_RAM + game.users * LOCAL_DB_RAM_PER_USER;
    }

    if RUNTIME_PERSISTENT[runtime] && !ctx.flags.worker {
        let total_rate: f64 = arriving[..NR].iter().sum();
        let offered_work: f64 = (0..NR).map(|kind| arriving[kind] * code.cpu[kind]).sum();
        let admitted = if offered_work > 0.0 {
            (cores * 1000.0 / offered_work).min(1.0)
        } else {
            1.0
        };
        ram_used += (total_rate * admitted
            * ACTIVE_USERS_PER_RPS
            * LANGUAGE_SESSION_KB[RUNTIME_LANGUAGE[runtime]]
            * collector_memory)
            / KB_PER_GB;
    }
    ram_used += node.leak;
    ram_used += connection_ram;
    let swapping = ram_used > ram;
    let efficiency = if swapping {
        (1.0 - (2.5 * (ram_used - ram)) / ram).max(0.15)
    } else {
        1.0
    };
    let heap = if ram > 0.0 { ram_used / ram } else { 0.0 };
    let storm =
        has_collector && game.incident == Some(Incident::GcStorm) && game.incident_node == node.id;
    let live = if storm {
        (heap + GC_STORM_HEAP).min(1.0)
    } else {
        heap
    };
    let pressure = if has_collector && live > GC_HEAP_SHARE_BEFORE_PAUSES {
        ((live - GC_HEAP_SHARE_BEFORE_PAUSES) / (1.0 - GC_HEAP_SHARE_BEFORE_PAUSES)).min(1.0)
    } else {
        0.0
    };
    let collecting = if pressure > 0.0 && has_collector {
        1.0 + gc_cpu * pressure
    } else {
        1.0
    };

    let per_request = cores.min(1.0);

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
        cpu[kind] = ((code.cpu[kind] / efficiency) * gc_tuning)
            * if collecting > 1.0 { collecting } else { 1.0 };
    }
    let mut cpu_work = 0.0;
    for &kind in kinds {
        cpu_work += arriving[kind] * cpu[kind];
    }
    let cpu_utilization = if cores > 0.0 {
        cpu_work / (cores * 1000.0)
    } else if rate > 0.0 {
        NO_CAPACITY_UTILIZATION
    } else {
        0.0
    };
    let mean_service = if rate > 0.0 {
        cpu_work / rate / per_request
    } else {
        0.0
    };
    let cpu_wait = wait_for(mean_service, cpu_utilization, cores);

    let fetching = if ctx.flags.worker {
        FETCH_MS / node.prefetch.max(1.0)
    } else {
        0.0
    };
    let mut residence = [0.0f64; NR];
    let mut slot_work = 0.0;
    for &kind in kinds {
        let profile = crate::pass::profile_of(game, kind);
        let receiving = if ctx.flags.worker || PROFILE_IN_KB[profile] <= 0.0 {
            0.0
        } else {
            ((PROFILE_IN_KB[profile] * 8.0) / USER_UP_MBPS)
                * if ctx.flags.offloaded {
                    1.0 - PROFILE_OFFLOAD[profile]
                } else {
                    1.0
                }
        };
        let mut waiting = 0.0;
        if !ctx.flags.local {
            waiting = wait_of(&code.calls[kind], call_latency) + fetching;
        }
        let each = cpu[kind] / per_request + cpu_wait + waiting + receiving;
        residence[kind] = each;
        slot_work += arriving[kind] * each;
    }
    let slot_utilization = if slots.is_infinite() {
        0.0
    } else {
        slot_work / (slots * 1000.0)
    };
    let slot_wait = if rate > 0.0 {
        wait_for(slot_work / rate, slot_utilization, slots)
    } else {
        0.0
    };

    let mut bytes = 0.0;
    if !ctx.flags.worker {
        for &kind in kinds {
            bytes +=
                arriving[kind] * payload_of(node, kind, ctx.flags.offloaded) * game.payload[kind];
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
    let share = if utilization > 1.0 {
        1.0 / utilization
    } else {
        1.0
    };
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
                        || (RUNTIME_LANGUAGE[runtime] == language::PYTHON
                            && model == Concurrency::Loop))
                    && CPU_HEAVY_MASK[kind] == 1);
            if off_loop {
                continue;
            }
            let callback = cpu[kind] / per_request;
            loop_work += arriving[kind] * callback;
            loop_squares += arriving[kind] * callback * callback;
        }
    }
    let loop_block = if loop_work > 0.0 {
        loop_squares / loop_work
    } else {
        0.0
    };
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

    let used_cores = (cpu_work * share).min(cores * 1000.0) / 1000.0;

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
        capacity: if rate > 0.0 {
            rate / utilization.max(MIN_UTILIZATION)
        } else {
            0.0
        },
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
        efficiency,
        collecting,
        work_unit: Some(work_unit),
        work,
        resources: Resources {
            cpu_cores: Some(Gauge {
                used: used_cores,
                total: cores,
            }),
            ram_gb: Some(Gauge {
                used: ram_used,
                total: ram,
            }),
            slots: (!slots.is_infinite()).then(|| Gauge {
                used: (slot_work * share) / 1000.0,
                total: slots,
            }),
            network_kbps: Some(Gauge {
                used: bytes * share,
                total: network_of(node.size) * ctx.boost,
            }),
            credits: (node.family == BURSTABLE_FAMILY)
                .then_some((node.credits, BURST_BASELINE * vcpu - used_cores)),
        },
        throttled,
        swapping,
        disk: false,
    }
}

impl Model {
    #[inline]
    pub fn share_of(&self, kind: usize) -> f64 {
        if kind < NR && bit_set(self.shares_mask, kind) {
            self.shares[kind]
        } else {
            self.share
        }
    }
}

pub fn server_model_shed(
    game: &GameCtx,
    node: &Node,
    arriving: &Rates,
    code: &Code,
    call_latency: &[f64; NK],
    ctx: &ServerCtx,
) -> Model {
    let full = server_model(game, node, arriving, code, call_latency, ctx);
    if full.utilization <= SHED_FROM || ctx.flags.worker {
        return full;
    }
    let degrade = node.degrade && game.has(research::GRACEFUL_DEGRADATION);
    if !degrade && !(node.shed && game.has(research::LOAD_SHEDDING)) {
        return full;
    }

    let mut kinds: Vec<usize> = (0..NR).filter(|kind| arriving[*kind] > 0.0).collect();
    if degrade {
        let cpu = |kind: usize| PROFILE_CPU[crate::pass::profile_of(game, kind)];
        kinds.sort_by(|a, b| cpu(*b).total_cmp(&cpu(*a)));
    } else {
        let density = |kind: usize| {
            KIND_VALUE[kind] / PROFILE_CPU[crate::pass::profile_of(game, kind)].max(f64::EPSILON)
        };
        kinds.sort_by(|a, b| density(*a).total_cmp(&density(*b)));
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

    let mut dropped = 0;
    while dropped < kinds.len() && run(&keep(dropped + 1, 1.0)).utilization > SHED_TO {
        dropped += 1;
    }
    let (mut low, mut high) = (0.0f64, 1.0f64);
    for _ in 0..SHED_BISECTION_STEPS {
        let middle = (low + high) / 2.0;
        if run(&keep(dropped, middle)).utilization > SHED_TO {
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
fn combine_tail(a_p: f64, a_ms: f64, b_p: f64, b_ms: f64) -> (f64, f64) {
    let either_p = 1.0 - (1.0 - a_p) * (1.0 - b_p);
    (
        either_p,
        if a_p + b_p > 0.0 {
            (a_p * a_ms + b_p * b_ms) / (a_p + b_p)
        } else {
            0.0
        },
    )
}

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

pub fn flat_model(
    capacity: f64,
    arriving: &Rates,
    order: &Order,
    fixed_ms: f64,
    variable_ms: f64,
    boost: f64,
) -> Model {
    let rate = order.sum(arriving);
    let utilization = if capacity.is_infinite() {
        0.0
    } else {
        rate / (capacity * boost)
    };
    let share = if utilization > 1.0 {
        1.0 / utilization
    } else {
        1.0
    };
    let wait = wait_for(variable_ms, utilization, 1.0);
    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];

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
        limit: if utilization <= 0.0 {
            Limit::None
        } else {
            Limit::Throughput
        },
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

pub fn flat_component(
    game: &GameCtx,
    node: &Node,
    rates: &Rates,
    order: &Order,
    boost: f64,
) -> Model {
    let scale = flat_scale(node.size);
    let flat = |capacity: f64, fixed_ms: f64, variable_ms: f64| {
        flat_model(capacity, rates, order, fixed_ms, variable_ms, boost)
    };

    let unlimited = |fixed_ms: f64, variable_ms: f64| {
        flat_model(f64::INFINITY, rates, order, fixed_ms, variable_ms, 1.0)
    };
    match node.type_code {
        component::USERS => unlimited(30.0, 0.0),
        component::DNS => unlimited(0.0, 0.0),
        component::AUTH => unlimited(120.0, 15.0),
        component::WAREHOUSE => unlimited(1_500.0, 200.0),
        component::LB => flat(
            FLAT_CAPACITY[component::LB]
                * scale
                * if node.variant == 1 { L4_CAPACITY } else { 1.0 }
                * if node.policy == 3 && game.has(research::LB_ALGORITHMS) {
                    P2C_CAPACITY
                } else {
                    1.0
                },
            if node.variant == 1 { L4_MS } else { 1.0 },
            0.1,
        ),
        component::POOLER => flat(FLAT_CAPACITY[component::POOLER] * scale, 0.3, 0.0),

        component::CDC => flat(
            CDC_RATE * scale,
            CDC_MS
                * if game.data_staffed {
                    DATA_TEAM_LAG
                } else {
                    1.0
                },
            0.05,
        ),
        component::MSGP => flat(MSGP_RATE * scale, 100.0, 10.0),
        component::PSP => {
            let slow = if game.incident == Some(Incident::DoubleCharge) {
                SLOW_CHARGE_MS
            } else {
                0.0
            };
            flat(PSP_CAPACITY * scale, 400.0, 30.0 + slow)
        }
        component::LLM => flat(LLM_RATE * scale, LLM_FIRST_TOKEN_MS, 0.0),

        component::STORAGE => unlimited(
            40.0 + if node.r2 && !game.cdn_on_board {
                R2_FIRST_BYTE_MS
            } else {
                0.0
            },
            5.0,
        ),
        component::GPU => {
            let batch = GPU_BATCHES_BATCH
                .iter()
                .position(|size| *size == node.batch)
                .unwrap_or(0);
            let capacity = (GPU_TYPES_TOKENS[node.gpu] * scale) / TOKENS_PER_PROMPT
                * GPU_MODELS_SPEED[node.gpu_model]
                * GPU_PRECISIONS_SPEED[node.precision]
                * GPU_BATCHES_GAIN[batch]
                * node.warm_share.max(0.1);

            let ttft = if game.has(research::CONTINUOUS_BATCHING) {
                0.0
            } else {
                GPU_BATCHES_TTFT[batch]
            };
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
        component::LOG => flat(
            LOG_RATE * scale / hot_key_factor(game, node),
            LOG_ACKS_LATENCY[node.acks] * 5.0,
            0.1,
        ),

        component::VEC => flat(
            VEC_QUERIES * scale * VEC_INDEXES_QUERIES[node.index_type] / hot_key_factor(game, node),
            20.0,
            2.0,
        ),

        component::CACHE => {
            let cores = if CACHE_ENGINES_SCALES[node.cache_engine] {
                grown(1.0, 2.0, node.size - 3.0).max(1.0)
            } else {
                1.0
            };
            flat(CACHE_OPS * cores / hot_key_factor(game, node), 0.5, 0.2)
        }
        component::WAF => {
            let waf = Waf::of(node, game);
            let regex = if game.incident == Some(Incident::Regex) {
                REGEX_CAPACITY
            } else {
                1.0
            };
            let attack = if node.under_attack {
                UNDER_ATTACK_LATENCY[0]
            } else {
                0.0
            };
            flat(
                FLAT_CAPACITY[component::WAF] * scale / waf.cpu * regex,
                2.0 + attack,
                0.1,
            )
        }

        _ => flat_model(f64::INFINITY, &[0.0; NK], &Order::default(), 0.0, 0.0, 1.0),
    }
}

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

pub struct Waf {
    pub block: f64,
    pub false_positive: f64,
    pub cpu: f64,
}

impl Waf {
    pub fn of(node: &Node, game: &GameCtx) -> Waf {
        let soften = |rate: f64| {
            if game.has(research::BOT_MANAGEMENT) {
                rate * BOT_MANAGEMENT_FALSE
            } else {
                rate
            }
        };
        if node.under_attack {
            return Waf {
                block: UNDER_ATTACK_BLOCK[0],
                false_positive: soften(UNDER_ATTACK_FALSE_POSITIVE[0]),
                cpu: UNDER_ATTACK_CPU[0],
            };
        }
        let level = (node.paranoia - 1.0).clamp(0.0, (PARANOIA_BLOCK.len() - 1) as f64) as usize;
        Waf {
            block: PARANOIA_BLOCK[level],
            false_positive: soften(PARANOIA_FALSE_POSITIVE[level]),
            cpu: PARANOIA_CPU[level],
        }
    }

    #[inline]
    pub fn stops(&self, kind: usize) -> f64 {
        if kind == kind::BOT {
            self.block
        } else {
            self.false_positive
        }
    }
}

pub mod cache {
    use super::*;

    #[inline]
    pub fn ttl_row(node: &Node) -> usize {
        if node.ttl_seconds <= 10.0 {
            0
        } else if node.ttl_seconds < 3_600.0 {
            1
        } else {
            2
        }
    }

    #[inline]
    pub fn strategy(game: &GameCtx, node: &Node) -> usize {
        if game.has(research::CACHE_STRATEGIES) {
            node.cache_strategy
        } else {
            cache_strategy::ASIDE
        }
    }

    pub fn ttl_factor(game: &GameCtx, node: &Node) -> f64 {
        let factor = CACHE_TTLS_FACTOR[ttl_row(node)];
        if !game.has(research::STAMPEDE_PROTECTION) {
            return factor;
        }
        if node.swr {
            return 1.0;
        }
        if node.early_expiry {
            factor + (1.0 - factor) * EARLY_LIFT
        } else {
            factor
        }
    }

    pub fn hit_ratio(game: &GameCtx, node: &Node, write_share: f64, warm_share: f64) -> f64 {
        let memory = flat_scale(node.size);
        let hot = (game.users * HOT_KB_PER_USER) / 1_000_000.0;
        let fits = if hot > 0.0 {
            (memory / hot).min(1.0)
        } else {
            1.0
        };
        fits.sqrt() * ttl_factor(game, node) * (1.0 - (2.0 * write_share).min(0.5)) * warm_share
    }
}

#[inline]
pub fn refresh_row(node: &Node) -> usize {
    SEARCH_REFRESH_SECONDS
        .iter()
        .position(|seconds| *seconds == node.refresh_seconds)
        .unwrap_or(0)
}

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
        * node.warm_share)
        / game.query[backend::Q_SEARCH];
    Model {
        tail_p: SEARCH_HEAPS_TAIL_P[heap],
        tail_ms: SEARCH_HEAPS_TAIL_MS[heap],
        ..flat_model(
            capacity,
            rates,
            order,
            SEARCH_VARIANTS_FIXED_MS[variant],
            2.0,
            boost,
        )
    }
}

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

#[inline]
pub fn split_work(rates: &Rates) -> (f64, f64) {
    (
        rates[kind::Q_READ],
        rates[kind::Q_WRITE] + rates[kind::Q_TX] + rates[kind::K_WRITE],
    )
}

fn dsql_model(node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let (reads, writes) = split_work(rates);
    let rate = reads + writes;
    let work = reads * DSQL_READ_COST + writes;
    let capacity = (DSQL_TX * flat_scale(node.size)) / if work > 0.0 { work / rate } else { 1.0 };
    let mut model = flat_model(capacity, rates, order, 3.0, 1.0, boost);
    for kind in (0..NK).filter(|&kind| kind != kind::Q_READ && bit_set(model.service_mask, kind)) {
        model.service_fixed[kind] += node.majority_ms;
    }
    model
}

pub fn cdn_hit(game: &GameCtx, node: &Node, kind: usize) -> f64 {
    let ttl = CDN_TTL_VALUES
        .iter()
        .position(|ttl| *ttl == node.ttl_seconds)
        .unwrap_or(1);
    let base = if kind == kind::PAGE {
        let esi = if game.has(research::ESI) {
            ESI_PAGE_HIT
        } else {
            0.0
        };
        CDN_HIT[kind::PAGE] * ANONYMOUS_PAGE + (CDN_HIT[kind::PAGE] + esi) * (1.0 - ANONYMOUS_PAGE)
    } else if kind == kind::MEDIA && game.has(research::TIERED_CACHING) {
        TIERED_MEDIA_HIT
    } else if kind == kind::READ && game.edge_on_board {
        EDGE_READ_HIT
    } else {
        CDN_HIT[kind]
    };
    let factor = CDN_TTL_FACTOR[ttl];
    let hit = base * factor * CACHE_KEYS_HIT[node.cache_key] * node.warm_share;
    let regenerated = if kind == kind::PAGE {
        game.static_pages
    } else {
        0.0
    };
    (hit + (1.0 - hit) * regenerated * factor * node.warm_share).min(0.95)
}

pub fn hub_connections(node: &Node, built_in: bool) -> f64 {
    let per_connection = RUNTIME_CONNECTION_KB[node.runtime];
    if per_connection < 0.0 {
        return 0.0;
    }
    (HUB_RAM_KB
        * if node.clustering || built_in {
            flat_scale(node.size)
        } else {
            1.0
        })
        / per_connection
}

fn ws_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    if RUNTIME_CONNECTION_KB[node.runtime] < 0.0 {
        return flat_model(f64::INFINITY, rates, order, 1.0, 0.0, boost);
    }

    let built_in = game.has(research::DISTRIBUTED_ERLANG)
        && RUNTIME_LANGUAGE[node.runtime] == language::ELIXIR;
    let rate = (hub_connections(node, built_in) / RT_HOLD_SECONDS)
        * if node.presence {
            1.0 - PRESENCE_CPU
        } else {
            1.0
        };
    flat_model(rate, rates, order, 1.0, 0.0, boost)
}

pub fn serverless_model(
    node: &Node,
    arriving: &Rates,
    code: &Code,
    latency: &Rates,
    boost: f64,
) -> Model {
    let waiting = |kind: usize| {
        code.calls[kind]
            .iter()
            .zip(&latency[NR..])
            .fold(0.0, |sum, (&count, &each)| {
                if count != 0.0 {
                    sum + count * each
                } else {
                    sum
                }
            })
    };
    let kinds = || (0..NR).filter(|&kind| arriving[kind] > 0.0);
    let rate = kinds().fold(0.0, |sum, kind| sum + arriving[kind]);
    let concurrency = SERVERLESS_CONCURRENCY * boost;
    let inflight = kinds().fold(0.0, |sum, kind| {
        sum + (arriving[kind] * (code.cpu[kind] + waiting(kind))) / MS_PER_SECOND
    });
    let utilization = if concurrency > 0.0 {
        inflight / concurrency
    } else if rate > 0.0 {
        NO_CAPACITY_UTILIZATION
    } else {
        0.0
    };
    let share = if utilization > 1.0 {
        1.0 / utilization
    } else {
        1.0
    };

    let cold_start_share =
        (1.0 - node.warm_share).max(1.0 / (1.0 + rate.max(0.0) * SERVERLESS_IDLE_SECONDS));
    let used = inflight * share;
    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];
    for kind in 0..NR {
        service_fixed[kind] = SERVERLESS_MS;
        service_variable[kind] = code.cpu[kind] + waiting(kind);
    }

    let tail_ms = if node.runtime == runtime::GRAAL || node.runtime == runtime::NATIVE_AOT {
        NATIVE_COLD_MS
    } else {
        COLD_START_MS[RUNTIME_LANGUAGE[node.runtime]]
    };
    Model {
        utilization,
        share,
        capacity: if rate > 0.0 {
            rate / utilization.max(MIN_UTILIZATION)
        } else {
            0.0
        },
        limit: if utilization <= 0.0 {
            Limit::None
        } else {
            Limit::Throughput
        },
        service_fixed,
        service_variable,
        service_mask: (1u64 << NR) - 1,
        tail_p: cold_start_share,
        tail_ms,
        processes: used,
        inflight: used,
        resources: Resources {
            slots: Some(Gauge {
                used,
                total: concurrency,
            }),
            ..Resources::default()
        },
        ..Model::default()
    }
}

fn doc_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let join = |kind: usize| {
        if kind == kind::Q_TX || kind == kind::Q_SCAN {
            DOC_JOIN_COST
        } else {
            1.0
        }
    };
    let (rate, ops) = order.iter().fold((0.0, 0.0), |(rate, ops), kind| {
        (rate + rates[kind], ops + rates[kind] * join(kind))
    });
    let per_op = if rate > 0.0 { ops / rate } else { 1.0 };
    let capacity = DOC_OPS * flat_scale(node.size) / hot_key_factor(game, node) / per_op;
    let mut model = flat_model(capacity, rates, order, DOC_FIXED_MS, DOC_OP_MS, boost);
    let read = if bit_set(model.service_mask, kind::Q_READ) {
        model.service_variable[kind::Q_READ]
    } else {
        DOC_OP_MS
    };
    let wait = read - DOC_OP_MS;
    for kind in (0..NK).filter(|&kind| bit_set(model.service_mask, kind)) {
        let slower = if node.transactions && (kind == kind::Q_WRITE || kind == kind::Q_TX) {
            1.0 + DOC_TXN_LATENCY
        } else {
            1.0
        };
        model.service_variable[kind] = DOC_OP_MS * join(kind) * slower + wait;
    }
    model
}

const WIDE_REPLICA_MS: f64 = 2.0;

fn wide_model(game: &GameCtx, node: &Node, rates: &Rates, order: &Order, boost: f64) -> Model {
    let (reads, writes) = split_work(rates);
    let ops = reads * quorum_r(node) + writes * quorum_n(node);
    let rate = reads + writes;
    let capacity = (WIDE_OPS * flat_scale(node.size))
        / hot_key_factor(game, node)
        / if ops > 0.0 { ops / rate } else { 1.0 };
    let mut model = flat_model(capacity, rates, order, 1.0, 0.0, boost);
    let wait = if bit_set(model.service_mask, kind::Q_READ) {
        model.service_variable[kind::Q_READ]
    } else {
        0.0
    };
    for kind in 0..NK {
        if !bit_set(model.service_mask, kind) {
            continue;
        }
        let quorum = if kind == kind::Q_READ {
            quorum_r(node)
        } else {
            quorum_w(node)
        };
        model.service_fixed[kind] = 1.0;
        model.service_variable[kind] =
            wait + WIDE_REPLICA_MS * crate::dist::kth_fastest(quorum, quorum_n(node));
    }
    model
}

#[inline]
fn scan_eviction(scan_work: f64, cores: f64) -> f64 {
    if cores > 0.0 {
        (2.0 * scan_work / (cores * 1000.0)).min(1.0)
    } else {
        1.0
    }
}

#[inline]
pub fn index_write_factor(game: &GameCtx) -> f64 {
    1.0 + INDEX_WRITE_COST * game.service_indexes
}

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
    let shards = if node.shards.floor() > 1.0 {
        node.shards.floor()
    } else {
        1.0
    };
    let key = node.shard_key.min(3);
    let cross = if shards > 1.0 {
        SHARD_CROSS[key] * (1.0 - 1.0 / shards)
    } else {
        0.0
    };
    Sharding {
        shards,
        hot: if shards > 1.0 {
            SHARD_HOT[key] + (1.0 - SHARD_HOT[key]) / shards
        } else {
            1.0
        },
        cross,
        scatter: 1.0 + SCATTER_CPU * (shards - 1.0),
        scatter_ms: SCATTER_MS * (shards - 1.0),
        far_ms: if shards > 1.0 {
            SHARD_FAR_MS[key] * (1.0 - 1.0 / shards)
        } else {
            0.0
        },
    }
}

#[derive(Clone, Copy)]
pub struct DbCpu {
    pub engine: usize,
    pub warmth: f64,

    pub scan: f64,
    pub scans: f64,
    pub retention: usize,
    pub view: f64,
    pub report: f64,
    pub scatter: f64,
    pub evicted: f64,
    pub shard: f64,
    pub bloat: f64,
    pub denormalized: bool,
    pub multi_leader: bool,
    pub disk: bool,
    pub read_cpu: f64,
    pub write_cpu: f64,
    pub search_cpu: f64,
    pub put_cpu: f64,
    pub tx_cpu: f64,
    pub get_cpu: f64,
    pub scan_cpu: f64,
}

pub fn db_cpu(
    game: &GameCtx,
    node: &Node,
    arriving: &Rates,
    cores: f64,
    scatter: f64,
    disk: bool,
    database_count: f64,
) -> DbCpu {
    let engine = node.db_engine.min(1);
    let group_users = node.users_in_group;
    let topology = node.topology;
    let incident = game.incident;
    let report = if incident == Some(Incident::ReportDb) {
        REPORT_SURGE
    } else {
        1.0
    };
    let warmth = 0.5 + 0.5 * node.warm_share;
    let scan = if incident == Some(Incident::SlowQuery) {
        group_users * ROWS_PER_USER * UNINDEXED_MS_PER_ROW
    } else {
        0.0
    };
    let scans = arriving[NR + backend::Q_SCAN];
    let retention = node.keep.min(2);
    let view = if node.materialized && game.has(research::PRECOMPUTE) {
        MATERIALIZED_SCAN
    } else {
        1.0
    };
    let scan_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_SCAN]
        * DB_SCAN[engine]
        * scatter
        * report
        * RETENTION_REBUILD[retention]
        * view)
        / warmth;
    let evicted = if scans > 0.0 {
        scan_eviction(scans * scan_cpu, cores)
    } else {
        0.0
    };
    let shard = if incident == Some(Incident::HotShard) && game.incident_node == node.id {
        HOT_SHARD_CPU
    } else {
        1.0
    };
    let bloat = if incident == Some(Incident::TableBloat) && game.incident_node == node.id {
        BLOAT_CPU
    } else {
        1.0
    };
    let denormalized = game.has(research::DENORMALIZATION);
    let read_cpu = (if evicted > 0.0 {
        ((QUERY_CPU_BY_BACKEND[backend::Q_READ] + scan)
            * if disk { 1.5 } else { 1.0 + 0.5 * evicted })
            / warmth
    } else {
        ((QUERY_CPU_BY_BACKEND[backend::Q_READ] + scan) * if disk { 1.5 } else { 1.0 }) / warmth
    }) * shard
        * bloat
        * if denormalized { DENORMALIZED_READ } else { 1.0 }
        * DB_READ[engine];
    let multi_leader = topology == topology::MULTI && database_count > 1.0;
    let write_cpu = ((QUERY_CPU_BY_BACKEND[backend::Q_WRITE] * game.query[backend::Q_WRITE])
        / warmth)
        * (1.0 + 0.5 * evicted)
        * shard
        * bloat
        * index_write_factor(game)
        * if denormalized {
            DENORMALIZED_WRITE
        } else {
            1.0
        }
        * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 };
    let search_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_SEARCH]
        * game.query[backend::Q_SEARCH]
        * DB_SEARCH_COST[engine]
        * scatter)
        / warmth;
    let put_cpu = QUERY_CPU_BY_BACKEND[backend::BLOB_PUT] / warmth;
    let tx_cpu = (QUERY_CPU_BY_BACKEND[backend::Q_TX]
        * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 })
        / warmth;
    let get_cpu = QUERY_CPU_BY_BACKEND[backend::BLOB_GET] / warmth;
    DbCpu {
        engine,
        warmth,
        scan,
        scans,
        retention,
        view,
        report,
        scatter,
        evicted,
        shard,
        bloat,
        denormalized,
        multi_leader,
        disk,
        read_cpu,
        write_cpu,
        search_cpu,
        put_cpu,
        tx_cpu,
        get_cpu,
        scan_cpu,
    }
}

#[derive(Clone, Copy)]
pub struct DbShards {
    pub shards: f64,
    pub cross: f64,
    pub scatter: f64,
    pub hot: f64,
}

pub fn db_shards(node: &Node, logical: &Sharding, database_count: f64) -> DbShards {
    let shards = logical.shards
        * if node.topology == topology::SHARDED && node.type_code == component::DATABASE {
            database_count
        } else {
            1.0
        };
    let key = node.shard_key.min(3);
    DbShards {
        shards,
        cross: if shards > 1.0 {
            SHARD_CROSS[key] * (1.0 - 1.0 / shards)
        } else {
            0.0
        },
        scatter: 1.0 + SCATTER_CPU * (shards - 1.0),
        hot: if shards > 1.0 {
            SHARD_HOT[key] + (1.0 - SHARD_HOT[key]) / shards
        } else {
            1.0
        },
    }
}

#[inline]
pub fn database_count(node: &Node) -> f64 {
    if node.type_code == component::DATABASE {
        node.databases_in_group
    } else {
        1.0
    }
}

pub fn database_receipt(
    game: &GameCtx,
    node: &Node,
    model: &Model,
    arriving: &Rates,
    kind: usize,
) -> Option<Receipt> {
    let count = database_count(node);
    let DbShards { scatter, hot, .. } = db_shards(node, &sharding_of(node), count);
    let cores = model.resources.cpu_cores.map_or(0.0, |gauge| gauge.total);
    let cost = db_cpu(game, node, arriving, cores, scatter, model.disk, count);
    let engine = cost.engine;
    let cold = (Cause::Warmup, 1.0 / cost.warmth);
    let shard = [(Cause::HotShard, cost.shard), (Cause::Bloat, cost.bloat)];
    let multi = cost
        .multi_leader
        .then_some((Cause::MultiLeader, MULTI_WRITE_CPU));
    let backend = kind.checked_sub(NR)?;
    let (factors, total, added): (Vec<(Cause, f64)>, f64, f64) = match backend {
        backend::Q_READ => (
            [
                if cost.disk {
                    (Cause::Disk, 1.5)
                } else {
                    (Cause::Eviction, 1.0 + 0.5 * cost.evicted)
                },
                (Cause::Engine, DB_READ[engine]),
                cold,
            ]
            .into_iter()
            .chain(shard)
            .chain([(
                Cause::Denormalization,
                if cost.denormalized {
                    DENORMALIZED_READ
                } else {
                    1.0
                },
            )])
            .collect(),
            cost.read_cpu,
            cost.scan,
        ),
        backend::Q_WRITE => (
            [
                (Cause::Features, game.query[backend::Q_WRITE]),
                (Cause::Engine, DB_WRITE[engine]),
            ]
            .into_iter()
            .chain(multi)
            .chain([
                cold,
                (Cause::Eviction, 1.0 + 0.5 * cost.evicted),
                (Cause::Indexes, index_write_factor(game)),
                (
                    Cause::Denormalization,
                    if cost.denormalized {
                        DENORMALIZED_WRITE
                    } else {
                        1.0
                    },
                ),
            ])
            .chain(shard)
            .chain([(Cause::BusiestShard, hot)])
            .collect(),
            cost.write_cpu * hot,
            0.0,
        ),
        backend::Q_SEARCH => (
            vec![
                (Cause::Features, game.query[backend::Q_SEARCH]),
                (Cause::Engine, DB_SEARCH_COST[engine]),
                (Cause::Scatter, cost.scatter),
                cold,
            ],
            cost.search_cpu,
            0.0,
        ),
        backend::BLOB_PUT => (
            vec![cold, (Cause::BusiestShard, hot)],
            cost.put_cpu * hot,
            0.0,
        ),
        backend::Q_TX => (
            [(Cause::Engine, DB_WRITE[engine])]
                .into_iter()
                .chain(multi)
                .chain([cold])
                .collect(),
            cost.tx_cpu,
            0.0,
        ),
        backend::BLOB_GET => (vec![cold], cost.get_cpu, 0.0),
        backend::Q_SCAN => (
            vec![
                (Cause::Scatter, cost.scatter),
                (Cause::Report, cost.report),
                (Cause::Retention, RETENTION_REBUILD[cost.retention]),
                (Cause::View, cost.view),
                (Cause::Engine, DB_SCAN[engine]),
                cold,
            ],
            cost.scan_cpu,
            0.0,
        ),
        _ => return None,
    };
    let mut lines: Vec<CostLine> = Vec::new();
    lines.plus(Cause::SlowQuery, added);
    for (cause, value) in factors {
        lines.times(cause, value);
    }
    Some(Receipt {
        base: QUERY_CPU_BY_BACKEND[backend],
        lines,
        total,
    })
}

pub fn server_receipt(
    game: &GameCtx,
    node: &Node,
    model: &Model,
    kind: usize,
    calls: &Calls,
    flags: &ServerFlags,
    cpu: f64,
) -> Receipt {
    let mut lines: Vec<CostLine> = Vec::new();
    let (base, _) = cpu_base_with(game, node, kind, calls, flags, &mut lines);
    lines.times(Cause::Neighbours, 1.0 / (1.0 - node.steal));
    lines.times(Cause::Swapping, 1.0 / model.efficiency);
    lines.times(
        Cause::Gc,
        if model.collecting > 1.0 {
            model.collecting
        } else {
            1.0
        },
    );

    let shed = kind < NR && bit_set(model.shares_mask, kind) && model.shares[kind] == 0.0;
    let total = if shed {
        0.0
    } else {
        (cpu / model.efficiency)
            * if model.collecting > 1.0 {
                model.collecting
            } else {
                1.0
            }
    };
    Receipt { base, lines, total }
}

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
    let connection_ram = (connections * DB_CONNECTION_MB[engine]) / MB_PER_GB;

    let group_users = node.users_in_group;
    let topology = node.topology;
    let database_count = database_count(node);
    let shard_share = if topology == topology::SHARDED && database_count > 1.0 {
        1.0 / database_count
    } else {
        1.0
    };
    let working_set = (LOCAL_DB_RAM + group_users * LOCAL_DB_RAM_PER_USER) * shard_share;
    let footprint = working_set + connection_ram;
    let disk = footprint > ram - OS_RAM;
    let logical = sharding_of(node);
    let DbShards {
        shards,
        cross,
        scatter,
        hot,
    } = db_shards(node, &logical, database_count);
    let far_ms = if shards > 1.0 {
        SHARD_FAR_MS[node.shard_key.min(3)] * (1.0 - 1.0 / shards)
    } else {
        0.0
    };
    let iops = STORAGE_IOPS[node.iops.min(1)] * shards * node.iops_factor;
    let throttled = node.family == BURSTABLE_FAMILY && node.credits < 1.0;
    let incident = game.incident;
    let slowed = incident == Some(Incident::RetryStorm)
        && game.incident_node == node.id
        && game.time - game.incident_started_at_seconds < STORM_TRIGGER;
    let cores = (if throttled {
        BURST_BASELINE * vcpu
    } else {
        vcpu
    }) * if slowed { STORM_SLOWDOWN } else { 1.0 };
    let per_request = cores.min(1.0);
    let cost = db_cpu(game, node, arriving, cores, scatter, disk, database_count);
    let DbCpu {
        warmth,
        scan,
        retention,
        scans,
        evicted,
        read_cpu,
        write_cpu,
        search_cpu,
        put_cpu,
        tx_cpu,
        get_cpu,
        scan_cpu,
        ..
    } = cost;
    let _ = (warmth, scan);

    let reads = arriving[NR + backend::Q_READ];
    let writes = arriving[NR + backend::Q_WRITE];
    let searches = arriving[NR + backend::Q_SEARCH];
    let puts = arriving[NR + backend::BLOB_PUT];
    let txs = arriving[NR + backend::Q_TX];
    let gets = arriving[NR + backend::BLOB_GET];
    let mut rate = reads + writes + searches + puts;
    let mut work =
        reads * read_cpu + (writes * write_cpu + puts * put_cpu) * hot + searches * search_cpu;
    if txs > 0.0 || gets > 0.0 {
        rate += txs + gets;
        work += txs * tx_cpu + gets * get_cpu;
    }
    if scans > 0.0 {
        rate += scans;
        work += scans * scan_cpu;
    }

    let cdc_ops = if node.cdc_mirrored { writes + txs } else { 0.0 };
    let disk_ops = writes + txs + puts + gets + scans + if disk { reads } else { 0.0 } + cdc_ops;
    let io_utilization = if iops > 0.0 { disk_ops / iops } else { 0.0 };
    let io_wait = wait_for(disk_ms(node.iops), io_utilization.min(0.98), 1.0);
    let cpu_utilization = if cores > 0.0 {
        work / (cores * 1000.0)
    } else if rate > 0.0 {
        NO_CAPACITY_UTILIZATION
    } else {
        0.0
    };
    let utilization = cpu_utilization.max(io_utilization);
    let capacity = if rate > 0.0 {
        rate / utilization.max(MIN_UTILIZATION)
    } else {
        0.0
    };
    let backlog = if node.depth > 0.0 && capacity > 0.0 {
        (node.depth / capacity) * 1000.0
    } else {
        0.0
    };
    let wait = if rate > 0.0 {
        wait_for(work / rate / per_request, utilization, cores) + backlog
    } else {
        backlog
    };
    let share = if utilization > 1.0 {
        1.0 / utilization
    } else {
        1.0
    };
    let used = (work * share).min(cores * 1000.0) / 1000.0;
    let on_disk = io_utilization > 0.0 && io_utilization >= cpu_utilization;
    let distributed = 1.0 + 2.0 * cross;
    let sync_ms = node.sync_wait;
    let tx_service_fixed = 2.5 * distributed + sync_ms + far_ms;
    let tx_service_variable = (tx_cpu / per_request + wait + io_wait) * distributed;

    let mut service_fixed = [0.0f64; NK];
    let mut service_variable = [0.0f64; NK];

    let mut service_mask = 0u64;
    let mut put = |backend: usize, fixed: f64, variable: f64, mask: &mut u64| {
        let kind = NR + backend;
        *mask |= 1u64 << kind;
        service_fixed[kind] = fixed;
        service_variable[kind] = variable;
    };
    put(
        backend::Q_READ,
        2.5 + far_ms
            + if disk {
                8.0
            } else if evicted > 0.0 {
                8.0 * evicted
            } else {
                0.0
            },
        read_cpu / per_request + wait + if disk { io_wait } else { 0.0 },
        &mut service_mask,
    );
    put(
        backend::Q_WRITE,
        2.5 + sync_ms + far_ms,
        write_cpu / per_request + wait + io_wait,
        &mut service_mask,
    );
    put(
        backend::Q_SEARCH,
        2.5 + logical.scatter_ms,
        search_cpu / per_request + wait,
        &mut service_mask,
    );
    put(
        backend::BLOB_PUT,
        2.5,
        put_cpu / per_request + wait + io_wait,
        &mut service_mask,
    );
    put(
        backend::Q_TX,
        tx_service_fixed,
        tx_service_variable,
        &mut service_mask,
    );
    put(
        backend::BLOB_GET,
        2.5 + 8.0,
        get_cpu / per_request + wait + io_wait,
        &mut service_mask,
    );
    put(
        backend::Q_SCAN,
        2.5 + 8.0 + RETENTION_SCAN_MS[retention] + logical.scatter_ms,
        scan_cpu / per_request + wait + io_wait,
        &mut service_mask,
    );

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
        efficiency: 1.0,
        collecting: 1.0,
        work_unit: Some(if on_disk {
            WorkUnit::Disk
        } else {
            WorkUnit::Cpu
        }),
        work,
        resources: Resources {
            cpu_cores: Some(Gauge { used, total: cores }),
            ram_gb: Some(Gauge {
                used: (footprint + OS_RAM).min(ram),
                total: ram,
            }),
            credits: (node.family == BURSTABLE_FAMILY)
                .then_some((node.credits, BURST_BASELINE * vcpu - used)),
            ..Resources::default()
        },
        throttled,
        swapping: false,
        disk,
    }
}

#[inline]
fn disk_ms(iops: usize) -> f64 {
    let volume_iops = STORAGE_IOPS[iops.min(1)];
    MS_PER_SECOND / volume_iops
}
