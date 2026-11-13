//! The flat ABI the harness (and, later, the browser) calls.
//!
//! Every value crosses as an `f64` or a `u8` bitset in linear memory, so the
//! boundary is a copy and never a re-encode.

use crate::catalog::*;
use crate::model::*;

/// Scalar block indices, mirrored by the TypeScript harness.
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
pub const SCALARS: usize = 48;

/// Output block: the model's figures, then per-kind service times.
pub const O_UTILIZATION: usize = 0;
pub const O_SHARE: usize = 1;
pub const O_CAPACITY: usize = 2;
pub const O_LIMIT: usize = 3;
pub const O_TAIL_P: usize = 4;
pub const O_TAIL_MS: usize = 5;
pub const O_PROCESSES: usize = 6;
pub const O_INFLIGHT: usize = 7;
pub const O_CPU_USED: usize = 8;
pub const O_CPU_TOTAL: usize = 9;
pub const O_RAM_USED: usize = 10;
pub const O_RAM_TOTAL: usize = 11;
pub const O_SLOTS_USED: usize = 12;
pub const O_SLOTS_TOTAL: usize = 13;
pub const O_NETWORK_USED: usize = 14;
pub const O_NETWORK_TOTAL: usize = 15;
pub const O_THROTTLED: usize = 16;
pub const O_SWAPPING: usize = 17;
pub const O_SERVICE_FIXED: usize = 18;
pub const O_SERVICE_VARIABLE: usize = O_SERVICE_FIXED + NR;
pub const O_COUNT: usize = O_SERVICE_VARIABLE + NR;

const INCIDENTS: [&str; 4] = ["", "gc-storm", "loop", "connections"];

#[inline]
unsafe fn bit(pointer: *const u8, index: usize) -> bool {
    (*pointer.add(index / 8) >> (index % 8)) & 1 == 1
}

/// Builds the Game context from the scalar block and the two bitsets.
/// The two bitsets, built once for a batch of Nodes.
pub type Research = [u64; 4];
pub type Shipped = [u64; 1];

pub unsafe fn research_of(researched: *const u8) -> Research {
    let mut research = [0u64; 4];
    for index in 0..RESEARCH_COUNT {
        if bit(researched, index) {
            research[index / 64] |= 1 << (index % 64);
        }
    }
    research
}

pub unsafe fn features_of(features: *const u8) -> Shipped {
    let mut shipped = [0u64; 1];
    for index in 0..FEATURE_COUNT {
        if bit(features, index) {
            shipped[index / 64] |= 1 << (index % 64);
        }
    }
    shipped
}

unsafe fn game_of(scalars: *const f64, researched: *const u8, features: *const u8) -> GameCtx {
    game_with(scalars, research_of(researched), features_of(features))
}

#[inline]
pub unsafe fn game_with(scalars: *const f64, research: Research, shipped: Shipped) -> GameCtx {
    let incident_code = *scalars.add(S_INCIDENT) as usize;
    GameCtx {
        users: *scalars.add(S_USERS),
        researched: research,
        features: shipped,
        incident: INCIDENTS.get(incident_code).copied().unwrap_or(""),
        incident_node: *scalars.add(S_INCIDENT_NODE) as usize,
        sandbox: *scalars.add(S_SANDBOX) != 0.0,
        scenario_tasks: *scalars.add(S_SCENARIO_TASKS) != 0.0,
        seed: *scalars.add(S_SEED),
        time: *scalars.add(S_TIME),
        incident_started: 0.0,
        service_count: 1,
        service_indexes: *scalars.add(S_SERVICE_INDEXES),
        users_in_group: *scalars.add(S_USERS_IN_GROUP),
    }
}

pub unsafe fn node_of(scalars: *const f64) -> Node {
    let flag = |index: usize| *scalars.add(index) != 0.0;
    Node {
        id: *scalars.add(S_ID) as usize,
        type_code: *scalars.add(S_TYPE_CODE) as usize,
        size: *scalars.add(S_SIZE),
        workers: *scalars.add(S_WORKERS),
        replicas: *scalars.add(S_REPLICAS),
        runtime: *scalars.add(S_RUNTIME) as usize,
        framework: *scalars.add(S_FRAMEWORK) as usize,
        family: *scalars.add(S_FAMILY) as usize,
        compress: flag(S_COMPRESS),
        local_db: flag(S_LOCAL_DB),
        leak: *scalars.add(S_LEAK),
        credits: *scalars.add(S_CREDITS),
        prefetch: *scalars.add(S_PREFETCH),
        pm: *scalars.add(S_PM) as usize,
        gogc: *scalars.add(S_GOGC) as usize,
        collector: *scalars.add(S_COLLECTOR) as usize,
        recycle: flag(S_RECYCLE),
        warm: *scalars.add(S_WARM),
        down: flag(S_DOWN),
        zone: *scalars.add(S_ZONE) as usize,
        region: *scalars.add(S_REGION) as usize,
        db_engine: *scalars.add(S_DB_ENGINE) as usize,
        ryw: false,
        materialized: false,
        shed: false,
        degrade: false,
        sticky: false,
        fanout: 0,
        policy: 0,
        variant: 0,
        depth: *scalars.add(S_DEPTH),
        shards: *scalars.add(S_SHARDS),
        shard_key: *scalars.add(S_SHARD_KEY) as usize,
        iops: *scalars.add(S_IOPS) as usize,
        keep: *scalars.add(S_KEEP) as usize,
        topology: *scalars.add(S_TOPOLOGY) as usize,
    }
}

unsafe fn ctx_of(scalars: *const f64) -> ServerCtx {
    let flag = |index: usize| *scalars.add(index) != 0.0;
    ServerCtx {
        boost: *scalars.add(S_BOOST),
        inflight: *scalars.add(S_INFLIGHT),
        sampling: *scalars.add(S_SAMPLING),
        hashing: *scalars.add(S_HASHING),
        delegated: flag(S_DELEGATED),
        local: flag(S_LOCAL),
        offloaded: flag(S_OFFLOADED),
        worker: flag(S_WORKER),
        pod: flag(S_POD),
        mesh: flag(S_MESH),
    }
}

unsafe fn read_rates(pointer: *const f64) -> Rates {
    let mut rates = [0.0f64; NK];
    for kind in 0..NK {
        rates[kind] = *pointer.add(kind);
    }
    rates
}

unsafe fn read_calls(pointer: *const f64) -> [[f64; NK]; NR] {
    let mut calls = [[0.0f64; NK]; NR];
    for kind in 0..NR {
        for slot in 0..NK {
            calls[kind][slot] = *pointer.add(kind * NK + slot);
        }
    }
    calls
}

fn write_model(model: &Model, out: *mut f64) {
    unsafe {
        *out.add(O_UTILIZATION) = model.utilization;
        *out.add(O_SHARE) = model.share;
        *out.add(O_CAPACITY) = model.capacity;
        *out.add(O_LIMIT) = model.limit as usize as f64;
        *out.add(O_TAIL_P) = model.tail_p;
        *out.add(O_TAIL_MS) = model.tail_ms;
        *out.add(O_PROCESSES) = model.processes;
        *out.add(O_INFLIGHT) = model.inflight;
        *out.add(O_CPU_USED) = model.cpu_used;
        *out.add(O_CPU_TOTAL) = model.cpu_total;
        *out.add(O_RAM_USED) = model.ram_used;
        *out.add(O_RAM_TOTAL) = model.ram_total;
        *out.add(O_SLOTS_USED) = model.slots_used;
        *out.add(O_SLOTS_TOTAL) = model.slots_total;
        *out.add(O_NETWORK_USED) = model.network_used;
        *out.add(O_NETWORK_TOTAL) = model.network_total;
        *out.add(O_THROTTLED) = if model.throttled { 1.0 } else { 0.0 };
        *out.add(O_SWAPPING) = if model.swapping { 1.0 } else { 0.0 };
        for kind in 0..NR {
            *out.add(O_SERVICE_FIXED + kind) = model.service_fixed[kind];
            *out.add(O_SERVICE_VARIABLE + kind) = model.service_variable[kind];
        }
    }
}

/// `serverModel` over the flat ABI.
#[no_mangle]
pub extern "C" fn server_model_flat(
    scalars: *const f64,
    researched: *const u8,
    features: *const u8,
    arriving: *const f64,
    calls: *const f64,
    latency: *const f64,
    out: *mut f64,
) {
    unsafe {
        let game = game_of(scalars, researched, features);
        let node = node_of(scalars);
        let ctx = ctx_of(scalars);
        let rates = read_rates(arriving);
        let call_table = read_calls(calls);
        let latency_table = read_calls(latency);
        let model = server_model(&game, &node, &rates, &call_table, &latency_table, &ctx);
        write_model(&model, out);
    }
}

/// `flatModel` over the flat ABI: capacity, fixed, variable, boost.
#[no_mangle]
pub extern "C" fn flat_model_flat(
    capacity: f64,
    fixed_ms: f64,
    variable_ms: f64,
    boost: f64,
    arriving: *const f64,
    out: *mut f64,
) {
    unsafe {
        let rates = read_rates(arriving);
        let model = flat_model(capacity, &rates, fixed_ms, variable_ms, boost);
        write_model(&model, out);
    }
}

/// Scratch memory the host writes into, so a call copies inputs once.
#[no_mangle]
pub extern "C" fn alloc(size: i32) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(size as usize);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

#[no_mangle]
pub extern "C" fn dealloc(pointer: *mut u8, size: i32) {
    unsafe {
        drop(Vec::from_raw_parts(pointer, 0, size as usize));
    }
}

/// How many `f64`s the caller must allocate for a model output block.
#[no_mangle]
pub extern "C" fn out_len() -> i32 {
    O_COUNT as i32
}

/// `databaseModel` over the flat ABI. `connections` is the previous pass's pool.
#[no_mangle]
pub extern "C" fn database_model_flat(
    scalars: *const f64,
    researched: *const u8,
    features: *const u8,
    arriving: *const f64,
    out: *mut f64,
) {
    unsafe {
        let game = game_of(scalars, researched, features);
        let node = node_of(scalars);
        let rates = read_rates(arriving);
        let model = database_model(&game, &node, &rates, *scalars.add(S_BOOST), *scalars.add(S_CONNECTIONS));
        write_model(&model, out);
    }
}

/// Runs every Node's model in one call, so a pass pays one boundary crossing
/// rather than one per Node. `kinds` picks the model: 0 server, 1 database,
/// 2 flat (its capacity, fixed, and variable come from `flat_params`).
#[no_mangle]
pub extern "C" fn model_batch(
    count: i32,
    kinds: *const i32,
    scalars: *const f64,
    flat_params: *const f64,
    researched: *const u8,
    features: *const u8,
    arriving: *const f64,
    calls: *const f64,
    latency: *const f64,
    out: *mut f64,
) {
    unsafe {
        let research = research_of(researched);
        let shipped = features_of(features);
        let shared_latency = read_calls(latency);
        for index in 0..count as usize {
            let node_scalars = scalars.add(index * SCALARS);
            let game = game_with(node_scalars, research, shipped);
            let node = node_of(node_scalars);
            let rates = read_rates(arriving.add(index * NK));
            let slot = out.add(index * O_COUNT);
            match *kinds.add(index) {
                0 => {
                    let cells = read_calls(calls.add(index * NR * NK));
                    let ctx = ctx_of(node_scalars);
                    let model = server_model(&game, &node, &rates, &cells, &shared_latency, &ctx);
                    write_model(&model, slot);
                }
                1 => {
                    let model = database_model(
                        &game,
                        &node,
                        &rates,
                        *node_scalars.add(S_BOOST),
                        *node_scalars.add(S_CONNECTIONS),
                    );
                    write_model(&model, slot);
                }
                _ => {
                    let params = flat_params.add(index * 3);
                    let model = flat_model(*params, &rates, *params.add(1), *params.add(2), *node_scalars.add(S_BOOST));
                    write_model(&model, slot);
                }
            }
        }
    }
}

/// The scalar block's stride, so the host can build a batch.
#[no_mangle]
pub extern "C" fn scalar_len() -> i32 {
    SCALARS as i32
}

/// The model output block's stride.
#[no_mangle]
pub extern "C" fn out_stride() -> i32 {
    O_COUNT as i32
}
