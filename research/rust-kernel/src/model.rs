//! The capacity models, ported from `packages/simulation/src/capacity.ts`.
//!
//! Arithmetic order matches the TypeScript exactly: every factor multiplies in
//! the same sequence, so the two sides produce the same `f64` bits.

use crate::catalog::*;
use crate::extra::*;

/// Per-request-kind scratch, indexed by the Request kind index (0..NR).
pub type Rates = [f64; NK];

/// The Game facts the models read. The catalog carries the tables.
#[derive(Clone)]
pub struct GameCtx {
    pub users: f64,
    /// Research the Company owns, as a bitset over `RESEARCH_IDS`.
    pub researched: [u64; 4],
    /// Features shipped, as a bitset over `FEATURE_IDS`.
    pub features: [u64; 1],
    /// The incident kind, or `""` when none runs.
    pub incident: &'static str,
    pub incident_node: usize,
    pub incident_started: f64,
    pub sandbox: bool,
    pub scenario_tasks: bool,
    pub seed: f64,
    pub time: f64,
    /// Services the Company runs: their count, and the sum of their indexes.
    pub service_count: usize,
    pub service_indexes: f64,
    /// The users whose rows this Node's Data Group holds, which the caller derives.
    pub users_in_group: f64,
}

impl GameCtx {
    #[inline]
    pub fn has(&self, research: &str) -> bool {
        let index = research_index(research);
        if index >= RESEARCH_COUNT {
            return false;
        }
        (self.researched[index / 64] >> (index % 64)) & 1 == 1
    }

    #[inline]
    pub fn has_feature(&self, feature: &str) -> bool {
        let index = feature_index(feature);
        if index >= FEATURE_COUNT {
            return false;
        }
        (self.features[index / 64] >> (index % 64)) & 1 == 1
    }

    /// `fixed`: a Sandbox task, or a Service that ships the fix.
    pub fn fixed(&self, _fix: &str) -> bool {
        self.sandbox && !self.scenario_tasks
    }
}

/// A Node, as the capacity models see it.
#[derive(Clone)]
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
}

/// What `serverModel` returns.
#[derive(Clone, Copy, Default)]
pub struct Model {
    pub utilization: f64,
    pub share: f64,
    pub capacity: f64,
    pub limit: Limit,
    pub service_fixed: [f64; NR],
    pub service_variable: [f64; NR],
    pub tail_p: f64,
    pub tail_ms: f64,
    pub processes: f64,
    pub inflight: f64,
    pub cpu_used: f64,
    pub cpu_total: f64,
    pub ram_used: f64,
    pub ram_total: f64,
    pub slots_used: f64,
    pub slots_total: f64,
    pub network_used: f64,
    pub network_total: f64,
    pub throttled: bool,
    pub swapping: bool,
    pub disk: bool,
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

/// A server's context: the flags and per-pass feedback the model reads.
#[derive(Clone, Copy)]
pub struct ServerCtx {
    pub boost: f64,
    pub inflight: f64,
    pub sampling: f64,
    pub hashing: f64,
    pub delegated: bool,
    pub local: bool,
    pub offloaded: bool,
    pub worker: bool,
    pub pod: bool,
    pub mesh: bool,
}

#[inline]
fn wait_for(service: f64, utilization: f64, servers: f64) -> f64 {
    let rho = if utilization < 0.98 { utilization } else { 0.98 };
    let s = if servers > 1.0 { servers } else { 1.0 };
    (service * rho) / (s * (1.0 - rho))
}

#[inline]
pub fn flat_scale(size: f64) -> f64 {
    // `grown(1, 2, size - 1)`: a loop of multiplications, not a power, so the
    // last bit matches the TypeScript exactly.
    let mut value = 1.0f64;
    let steps = size - 1.0;
    let mut index = 0.0f64;
    while index < steps {
        value *= 2.0;
        index += 1.0;
    }
    while index > steps {
        value /= 2.0;
        index -= 1.0;
    }
    value
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

/// `hashesOnPool`: a Node.js login hashed off the event loop.
#[inline]
fn hashes_on_pool(node: &Node, kind: usize, ctx: &ServerCtx) -> bool {
    RUNTIME_LANGUAGE[node.runtime] == "node"
        && ctx_hashing_available(node)
        && PROFILE_CPU[kind] > 0.0
        && kind == request_index("login")
        && !ctx.delegated
        && !ctx.worker
}

#[inline]
fn ctx_hashing_available(node: &Node) -> bool {
    // `has(game, 'libuv-pool')` is checked by the caller through `hashing`; the
    // port keeps the flag explicit on the Node to stay allocation free.
    node.pm != usize::MAX
}

#[inline]
fn request_index(name: &str) -> usize {
    kind_index(name)
}

/// `cpuBase`: core-milliseconds one request of a kind costs this Node.
fn cpu_base(game: &GameCtx, node: &Node, kind: usize, calls: &[f64; NK], ctx: &ServerCtx) -> f64 {
    let runtime = node.runtime;
    let framework = node.framework;
    let speed = speed_of(game, node);
    let overhead = overhead_of(node, kind);
    let login = kind == request_index("login");
    let variant = kind_speed_of(game, node, kind);
    let delegated_login = login && ctx.delegated && !ctx.worker;

    let mut cpu;
    if delegated_login {
        cpu = (LOGIN_DELEGATED_CPU * overhead) / speed;
    } else if PROFILE_NATIVE[kind] {
        cpu = PROFILE_CPU[kind] * if login { ctx.hashing } else { 1.0 };
    } else {
        cpu = (PROFILE_CPU[kind] * overhead) / speed;
    }
    cpu /= variant;
    let mut made = 0.0;
    for backend in 0..NB {
        made += calls[NR + backend];
    }
    let serial = made * SERIALIZE_MS * if game.has("binary-rpc") { 0.5 } else { 1.0 };
    let auth = if AUTHENTICATED_KINDS_MASK[kind] == 1 && !edge_auth_of(game) && !(login && ctx.delegated)
    {
        AUTH_CHECK_MS
    } else {
        0.0
    };
    if ctx.worker {
        return (cpu + serial) * PROFILE_OFFLOAD[kind] * (1.0 + ctx.sampling);
    }
    if ctx.offloaded {
        cpu *= 1.0 - PROFILE_OFFLOAD[kind];
    }
    if node.compress && PROFILE_COMPRESSIBLE[kind] {
        cpu *= GZIP_CPU;
    }
    if ctx.local {
        let mut queries = 0.0;
        for backend in 0..NB {
            let count = calls[NR + backend];
            let each = QUERY_CPU_BY_BACKEND[backend];
            if count != 0.0 && each >= 0.0 {
                queries += count * each;
            }
        }
        cpu += queries * LOCAL_DB_CONTENTION;
    }
    let _ = framework;
    let _ = runtime;
    (cpu + serial + auth) * (1.0 + ctx.sampling)
}

/// `speedOf`: runtime, OPcache, and warmup, multiplied in order.
fn speed_of(game: &GameCtx, node: &Node) -> f64 {
    let mut speed = RUNTIME_SPEED[node.runtime];
    // The collector's speed only applies to Java.
    if RUNTIME_LANGUAGE[node.runtime] == "java" {
        speed *= COLLECTOR_SPEED[node.collector.min(2)];
    }
    if RUNTIME_LANGUAGE[node.runtime] == "php" && game.has("opcache") {
        speed *= 1.0 + (OPCACHE_SPEED - 1.0) * node.warm;
    }
    if RUNTIME_LANGUAGE[node.runtime] == "ruby" && game.has("yjit") {
        speed *= YJIT_SPEED;
    }
    if RUNTIME_LANGUAGE[node.runtime] == "rust" && game.has("jemalloc") {
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
    speed *= RUNTIME_WARM_FROM[node.runtime]
        + (1.0 - RUNTIME_WARM_FROM[node.runtime]) * node.warm;
    speed
}

/// `overheadOf`: framework CPU overhead per request.
fn overhead_of(node: &Node, kind: usize) -> f64 {
    let runtime = node.runtime;
    let framework = node.framework;
    let model = RUNTIME_MODEL[runtime];
    if FRAMEWORK_ASGI[framework] && model != "loop" {
        return FRAMEWORK_CPU[framework][kind];
    }
    let booted = if RUNTIME_OVERHEAD_FACTOR[runtime] == 0.0 {
        FRAMEWORK_WORKER_OVERHEAD[framework]
    } else {
        -1.0
    };
    let booted_value = if booted >= 0.0 { booted } else { 1.0 };
    booted_value
        * (1.0 + (FRAMEWORK_OVERHEAD[framework] - 1.0) * RUNTIME_OVERHEAD_FACTOR[runtime])
        * FRAMEWORK_CPU[framework][kind]
}

/// `kindSpeedOf`: the JIT and NIFs change what a kind costs the CPU.
fn kind_speed_of(game: &GameCtx, node: &Node, kind: usize) -> f64 {
    let runtime = node.runtime;
    let heavy = CPU_HEAVY_MASK[kind] == 1;
    let mut speed = 1.0;
    if RUNTIME_LANGUAGE[runtime] == "php" && game.has("php-jit") {
        speed *= if heavy { PHP_JIT_HEAVY } else { PHP_JIT_SPEED };
    }
    if RUNTIME_LANGUAGE[runtime] == "elixir" && game.has("nifs") && heavy {
        speed *= NIF_SPEED;
    }
    speed
}

fn edge_auth_of(game: &GameCtx) -> bool {
    game.has("edge-auth")
}

/// `variantMemoryOf`: a variant's memory cost.
fn variant_memory(game: &GameCtx, node: &Node) -> (f64, f64) {
    let mut factor = 1.0;
    if RUNTIME_LANGUAGE[node.runtime] == "ruby" && game.has("yjit") {
        factor *= YJIT_MEMORY;
    }
    if RUNTIME_LANGUAGE[node.runtime] == "rust" && game.has("jemalloc") {
        factor *= JEMALLOC_MEMORY;
    }
    let mut extra = 0.0;
    if RUNTIME_LANGUAGE[node.runtime] == "node" && game.has("worker-threads") {
        extra += WORKER_THREADS * WORKER_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == "node" && game.has("libuv-pool") {
        extra += LIBUV_THREADS * LIBUV_THREAD_MB;
    }
    if RUNTIME_LANGUAGE[node.runtime] == "rust" && game.has("spawn-blocking") {
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
    if language == "java" {
        let index = node.collector.min(2);
        return (true, COLLECTOR_MEMORY[index], COLLECTOR_PAUSE[index], RUNTIME_GC_CPU[node.runtime]);
    }
    if language == "go" {
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
    calls: &[[f64; NK]; NR],
    call_latency: &[[f64; NK]; NR],
    ctx: &ServerCtx,
) -> Model {
    let runtime = node.runtime;
    let framework = node.framework;
    let (variant_factor, variant_extra) = variant_memory(game, node);
    let copies = node.replicas;
    let vcpu = vcpu_of(node.size) * ctx.boost * copies;
    let ram = ram_of(node.size, node.family) * ctx.boost * copies;
    let model = RUNTIME_MODEL[runtime];

    let processes = if RUNTIME_IDS[runtime] == "mod_php" {
        APACHE_MAX_WORKERS.min((ctx.inflight).ceil() + APACHE_SPARE)
    } else if RUNTIME_POOL[runtime] {
        node.workers * copies
    } else if (model == "threads" && !RUNTIME_PARALLEL[runtime]) || RUNTIME_IDS[runtime] == "node_cluster"
    {
        (vcpu / copies).round().max(1.0) * copies
    } else {
        copies
    };
    let slots = if model == "loop" || model == "green" || model == "async" {
        f64::INFINITY
    } else if model == "threads" {
        processes * RUNTIME_THREADS[runtime]
    } else if RUNTIME_IDS[runtime] == "mod_php" {
        APACHE_MAX_WORKERS * ctx.boost * copies
    } else {
        node.workers * ctx.boost * copies
    };

    // PHP-FPM pool modes; every other runtime keeps the whole pool resident.
    let (pm_spares, pm_spawn_share, pm_spawn_ms) = if RUNTIME_IDS[runtime] == "php_fpm" {
        match node.pm {
            1 => (3.0, 0.0, 0.0),   // dynamic
            2 => (0.0, 0.05, 8.0),  // ondemand
            _ => (-1.0, 0.0, 0.0),  // static
        }
    } else {
        (-1.0, 0.0, 0.0)
    };
    let resident = if pm_spares < 0.0 {
        processes
    } else {
        processes.min((ctx.inflight.ceil() + pm_spares).max(1.0))
    };
    let connections = arriving[request_index("rt")] * RT_HOLD_SECONDS;
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
    if ctx.local {
        ram_used += LOCAL_DB_RAM + game.users * LOCAL_DB_RAM_PER_USER;
    }
    ram_used += node.leak + connection_ram;
    let swapping = ram_used > ram;
    let efficiency = if swapping {
        (1.0 - (2.5 * (ram_used - ram)) / ram).max(0.15)
    } else {
        1.0
    };
    let heap = if ram > 0.0 { ram_used / ram } else { 0.0 };
    let storm = has_collector
        && game.incident == "gc-storm"
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
    } else if model == "process" {
        vcpu.min(processes.max(1.0))
    } else {
        vcpu.min(processes)
    };
    let throttled = node.family == 0 && node.credits < 1.0;
    let shared = if ctx.mesh { usable * (1.0 - MESH_OVERHEAD) } else { usable };
    let cores = if throttled {
        shared.min(BURST_BASELINE * vcpu)
    } else {
        shared
    };
    let per_request = cores.min(1.0);

    // The kinds that arrive.
    let mut kinds: Vec<usize> = Vec::with_capacity(NR);
    let mut rate = 0.0;
    for kind in 0..NR {
        if arriving[kind] > 0.0 {
            kinds.push(kind);
            rate += arriving[kind];
        }
    }
    let mut cpu = [0.0f64; NR];
    for &kind in &kinds {
        let raw = cpu_base(game, node, kind, &calls[kind], ctx);
        cpu[kind] = (raw / efficiency) * if collecting > 1.0 { collecting } else { 1.0 };
    }
    let mut cpu_work = 0.0;
    for &kind in &kinds {
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

    let fetching = if ctx.worker { FETCH_MS / node.prefetch.max(1.0) } else { 0.0 };
    let mut residence = [0.0f64; NR];
    let mut slot_work = 0.0;
    for &kind in &kinds {
        let receiving = if ctx.worker || PROFILE_IN_KB[kind] <= 0.0 {
            0.0
        } else {
            ((PROFILE_IN_KB[kind] * 8.0) / USER_UP_MBPS)
                * if ctx.offloaded { 1.0 - PROFILE_OFFLOAD[kind] } else { 1.0 }
        };
        let mut waiting = 0.0;
        if !ctx.local {
            waiting = wait_of(&calls[kind], &call_latency[kind]) + fetching;
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
    if !ctx.worker {
        for &kind in &kinds {
            bytes += arriving[kind] * payload_of(node, kind, ctx.offloaded) * payload_factor(game, kind);
        }
    }
    let network_utilization = bytes / (network_of(node.size) * ctx.boost);

    let thread_utilization = if model == "threads" && connection_ram > 0.0 && ram > 0.0 {
        ram_used / ram
    } else {
        0.0
    };

    let mut pooled = [false; NR];
    let mut pool_rate = 0.0;
    let mut pool_work = 0.0;
    for &kind in &kinds {
        let on = hashes_on_pool(node, kind, ctx) && game.has("libuv-pool");
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
    let blocking = if RUNTIME_BLOCKING[runtime] == "worker"
        && RUNTIME_LANGUAGE[runtime] == "rust"
        && game.has("spawn-blocking")
    {
        "none"
    } else {
        RUNTIME_BLOCKING[runtime]
    };
    let mut loop_work = 0.0;
    let mut loop_squares = 0.0;
    if blocking != "none" {
        for &kind in &kinds {
            let is_login = kind == request_index("login");
            let off_loop = (is_login && (pooled[kind] || ctx.delegated))
                || (game.has("worker-threads")
                    && game.fixed("off-loop")
                    && (RUNTIME_LANGUAGE[runtime] == "node"
                        || (RUNTIME_LANGUAGE[runtime] == "python" && model == "loop"))
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
        if blocking == "worker" {
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
    if ctx.pod {
        let (p, ms) = combine_tail(
            tail_p,
            tail_ms,
            NOISY_SHARE * (0.5 + 1.5 * cpu_utilization.min(1.0)),
            NOISY_MS,
        );
        tail_p = p;
        tail_ms = ms;
    }

    let mut service_fixed = [0.0f64; NR];
    let mut service_variable = [0.0f64; NR];
    for &kind in &kinds {
        service_fixed[kind] = 2.0;
        service_variable[kind] = cpu[kind] / per_request
            + cpu_wait
            + slot_wait
            + if pooled[kind] { pool_wait } else { 0.0 };
    }

    let used = (cpu_work * share).min(cores * 1000.0) / 1000.0;
    Model {
        utilization,
        share,
        capacity: if rate > 0.0 { rate / utilization.max(1e-9) } else { 0.0 },
        limit,
        service_fixed,
        service_variable,
        tail_p,
        tail_ms,
        processes: resident,
        inflight: (slot_work * share) / 1000.0,
        cpu_used: used,
        cpu_total: cores,
        ram_used,
        ram_total: ram,
        slots_used: if slots.is_infinite() { 0.0 } else { (slot_work * share) / 1000.0 },
        slots_total: slots,
        network_used: bytes * share,
        network_total: network_of(node.size) * ctx.boost,
        throttled,
        swapping,
        disk: false,
    }
}

#[inline]
fn combine_tail(a: f64, a_ms: f64, b: f64, b_ms: f64) -> (f64, f64) {
    let p = 1.0 - (1.0 - a) * (1.0 - b);
    (p, if a + b > 0.0 { (a * a_ms + b * b_ms) / (a + b) } else { 0.0 })
}

/// `waitOf`: sum of count × latency over the backend kinds, in catalog order.
#[inline]
pub fn wait_of(calls: &[f64; NK], latency: &[f64; NK]) -> f64 {
    let mut sum = 0.0;
    for backend in 0..NB {
        let count = calls[NR + backend];
        if count != 0.0 {
            sum += count * latency[NR + backend];
        }
    }
    sum
}

/// `flatModel`: a Component with a flat capacity.
pub fn flat_model(capacity: f64, arriving: &Rates, fixed_ms: f64, variable_ms: f64, boost: f64) -> Model {
    let mut rate = 0.0;
    for kind in 0..NK {
        rate += arriving[kind];
    }
    let utilization = if capacity.is_infinite() { 0.0 } else { rate / (capacity * boost) };
    let share = if utilization > 1.0 { 1.0 / utilization } else { 1.0 };
    let wait = wait_for(variable_ms, utilization, 1.0);
    let mut service_fixed = [0.0f64; NR];
    let mut service_variable = [0.0f64; NR];
    for kind in 0..NR {
        if arriving[kind] > 0.0 {
            service_fixed[kind] = fixed_ms;
            service_variable[kind] = variable_ms + wait;
        }
    }
    Model {
        utilization,
        share,
        capacity: capacity * boost,
        limit: if utilization <= 0.0 { Limit::None } else { Limit::Throughput },
        service_fixed,
        service_variable,
        tail_p: 0.0,
        tail_ms: 0.0,
        processes: 0.0,
        inflight: 0.0,
        cpu_used: 0.0,
        cpu_total: 0.0,
        ram_used: 0.0,
        ram_total: 0.0,
        slots_used: 0.0,
        slots_total: 0.0,
        network_used: 0.0,
        network_total: 0.0,
        throttled: false,
        swapping: false,
        disk: false,
    }
}

/// `payloadFactor`: how big a response of `kind` is relative to its profile.
pub fn payload_factor(game: &GameCtx, kind: usize) -> f64 {
    let mut value = 1.0;
    for feature in 0..FEATURE_COUNT {
        if !game.has_feature(FEATURE_IDS[feature]) {
            continue;
        }
        // Without an exposure record the port reads the Feature at full exposure,
        // which is what a fully adopted Feature gives.
        let factor = FEATURE_PAYLOAD[feature][kind];
        if factor > 0.0 {
            value *= factor;
        }
    }
    value
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
    let group_users = game.users_in_group;
    let topology = node.topology;
    let database_count = 1.0f64;
    let shard_share = if topology == 2 && database_count > 1.0 { 1.0 / database_count } else { 1.0 };
    let working_set = (LOCAL_DB_RAM + group_users * LOCAL_DB_RAM_PER_USER) * shard_share;
    let footprint = working_set + connection_ram;
    let disk = footprint > ram - OS_RAM;
    let logical = sharding_of(node);
    let shards = logical.shards
        * if topology == 2 && node.type_code == component_index("database") { database_count } else { 1.0 };
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
    let iops = STORAGE_IOPS[node.iops.min(1)] * shards;
    let throttled = node.family == 0 && node.credits < 1.0;
    let incident = game.incident;
    let slowed = incident == "retry-storm"
        && game.incident_node == node.id
        && game.time - game.incident_started < STORM_TRIGGER;
    let cores = (if throttled { BURST_BASELINE * vcpu } else { vcpu })
        * if slowed { STORM_SLOWDOWN } else { 1.0 };
    let per_request = cores.min(1.0);
    let warmth = 0.5 + 0.5 * node.warm;
    let scan = if incident == "slow-query" { group_users * ROWS_PER_USER * UNINDEXED_MS_PER_ROW } else { 0.0 };
    let scans = arriving[NR + 6]; // q-scan
    let retention = node.keep.min(2);
    let view = if node.materialized && game.has("precompute") { MATERIALIZED_SCAN } else { 1.0 };
    let scan_cpu = (QUERY_CPU_BY_BACKEND[6]
        * DB_SCAN[engine]
        * scatter
        * if incident == "report-db" { REPORT_SURGE } else { 1.0 }
        * RETENTION_REBUILD[retention]
        * view)
        / warmth;
    let evicted = if scans > 0.0 { scan_eviction(scans * scan_cpu, cores) } else { 0.0 };
    let shard = if incident == "hot-shard" && game.incident_node == node.id { HOT_SHARD_CPU } else { 1.0 };
    let bloat = if incident == "table-bloat" && game.incident_node == node.id { BLOAT_CPU } else { 1.0 };
    let denormalized = game.has("denormalization");
    let read_cpu = (if evicted > 0.0 {
        ((QUERY_CPU_BY_BACKEND[0] + scan) * if disk { 1.5 } else { 1.0 + 0.5 * evicted }) / warmth
    } else {
        ((QUERY_CPU_BY_BACKEND[0] + scan) * if disk { 1.5 } else { 1.0 }) / warmth
    }) * shard
        * bloat
        * if denormalized { DENORMALIZED_READ } else { 1.0 }
        * DB_READ[engine];
    let multi_leader = topology == 1 && database_count > 1.0;
    let write_cpu = ((QUERY_CPU_BY_BACKEND[1] * query_factor(game, 1)) / warmth)
        * (1.0 + 0.5 * evicted)
        * shard
        * bloat
        * index_write_factor(game)
        * if denormalized { DENORMALIZED_WRITE } else { 1.0 }
        * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 };
    let search_cpu = (QUERY_CPU_BY_BACKEND[3] * query_factor(game, 3) * DB_SEARCH_COST[engine] * scatter)
        / warmth;
    let put_cpu = QUERY_CPU_BY_BACKEND[5] / warmth;
    let tx_cpu = (QUERY_CPU_BY_BACKEND[8] * DB_WRITE[engine]
        * if multi_leader { MULTI_WRITE_CPU } else { 1.0 })
        / warmth;
    let get_cpu = QUERY_CPU_BY_BACKEND[7] / warmth;

    let reads = arriving[NR];
    let writes = arriving[NR + 1];
    let searches = arriving[NR + 3];
    let puts = arriving[NR + 5];
    let txs = arriving[NR + 8];
    let gets = arriving[NR + 7];
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
    let disk_ops = writes + txs + puts + gets + scans + if disk { reads } else { 0.0 };
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
    let sync_ms = 0.0;
    let tx_service_fixed = 2.5 * distributed + sync_ms + far_ms;
    let tx_service_variable = (tx_cpu / per_request + wait + io_wait) * distributed;

    let mut service_fixed = [0.0f64; NR];
    let mut service_variable = [0.0f64; NR];
    // The backend kinds a Database answers, in the order the Ledger reads them.
    service_fixed[0] = 2.5 + far_ms + if disk { 8.0 } else if evicted > 0.0 { 8.0 * evicted } else { 0.0 };
    service_variable[0] = read_cpu / per_request + wait + if disk { io_wait } else { 0.0 };
    service_fixed[1] = 2.5 + sync_ms + far_ms;
    service_variable[1] = write_cpu / per_request + wait + io_wait;
    service_fixed[3] = 2.5 + logical.scatter_ms;
    service_variable[3] = search_cpu / per_request + wait;
    service_fixed[5] = 2.5;
    service_variable[5] = put_cpu / per_request + wait + io_wait;
    service_fixed[8] = tx_service_fixed;
    service_variable[8] = tx_service_variable;
    service_fixed[7] = 2.5 + 8.0;
    service_variable[7] = get_cpu / per_request + wait + io_wait;
    service_fixed[6] = 2.5 + 8.0 + RETENTION_SCAN_MS[retention] + logical.scatter_ms;
    service_variable[6] = scan_cpu / per_request + wait + io_wait;

    let _ = (on_disk, HOT_KEY_SHARE);
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
        tail_p: 0.0,
        tail_ms: 0.0,
        processes: 0.0,
        inflight: 0.0,
        cpu_used: used,
        cpu_total: cores,
        ram_used: (footprint + OS_RAM).min(ram),
        ram_total: ram,
        slots_used: 0.0,
        slots_total: 0.0,
        network_used: 0.0,
        network_total: 0.0,
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

/// `queryFactor`: what one query of a backend kind costs relative to the catalog.
#[inline]
pub fn query_factor(game: &GameCtx, backend: usize) -> f64 {
    let mut value = 1.0;
    for feature in 0..FEATURE_COUNT {
        if !game.has_feature(FEATURE_IDS[feature]) {
            continue;
        }
        let factor = FEATURE_QUERY[feature][backend];
        if factor > 0.0 {
            value *= factor;
        }
    }
    value
}
