//! Constants the solve reads that live outside `catalog.ts`, so the generated
//! catalog stays a pure mirror of the TypeScript tables.

/// `capacity.ts`: share of requests an event loop stalls on.
pub const LOOP_TAIL_SHARE: f64 = 0.02;
/// `capacity.ts`: heap share above which a collector starts pausing requests.
pub const GC_HEAP: f64 = 0.7;
/// `capacity.ts`: share of requests a GC pause lands on at a full heap.
pub const GC_TAIL_SHARE: f64 = 0.02;
/// `capacity.ts`: a saturated App Server keeps its load at this share.
pub const SHED_AT: f64 = 0.9;
/// `rule-kit.ts`: share of stale reads read-your-writes routing still sends to a replica.
pub const RYW_STALE: f64 = 0.2;
/// `solve-pass.ts`: replication lag's floor, in milliseconds.
pub const REPLICA_LAG_MS: f64 = 20.0;
/// `solve-pass.ts`: milliseconds of lag per write per second replayed.
pub const REPLICA_LAG_PER_WRITE: f64 = 2.0;
/// `solve-pass.ts`: share of reads in a lag window that ask for a just-written row.
pub const REPLICA_STALE_REUSE: f64 = 0.25;
