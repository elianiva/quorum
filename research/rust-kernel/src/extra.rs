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
