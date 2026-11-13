// Generated from packages/simulation/src/catalog.ts. Do not edit by hand.
pub const NK: usize = 33;
pub const NR: usize = 17;
pub const NB: usize = 16;

pub static KINDS: [&str; NK] = ["page", "read", "write", "login", "search", "upload", "bot", "media", "rt", "buy", "job", "report", "ai", "feed", "hook", "push", "bid", "q-read", "q-write", "auth", "q-search", "q-vector", "blob-put", "task", "blob-get", "q-tx", "charge", "q-scan", "infer", "notify", "callout", "k-write", "change"];

/// The index of a kind, or NK when the name is unknown.
pub fn kind_index(name: &str) -> usize {
    match name {
        "page" => 0,
        "read" => 1,
        "write" => 2,
        "login" => 3,
        "search" => 4,
        "upload" => 5,
        "bot" => 6,
        "media" => 7,
        "rt" => 8,
        "buy" => 9,
        "job" => 10,
        "report" => 11,
        "ai" => 12,
        "feed" => 13,
        "hook" => 14,
        "push" => 15,
        "bid" => 16,
        "q-read" => 17,
        "q-write" => 18,
        "auth" => 19,
        "q-search" => 20,
        "q-vector" => 21,
        "blob-put" => 22,
        "task" => 23,
        "blob-get" => 24,
        "q-tx" => 25,
        "charge" => 26,
        "q-scan" => 27,
        "infer" => 28,
        "notify" => 29,
        "callout" => 30,
        "k-write" => 31,
        "change" => 32,
        _ => NK,
    }
}

/// Whether a kind index is one a user asks for (a Request kind).
pub fn is_request_kind(kind: usize) -> bool {
    kind < 17
}

// ---- scalar constants, generated ----
pub const ABROAD_SEED: f64 = 0.05;
pub const ACCIDENTAL_DELETE_SECONDS: f64 = 120.0;
pub static ACHIEVEMENT_IDS: [&str; 42] = ["hello-world", "works-on-my-machine", "split-brain", "averages-lie", "shared-nothing", "blocked", "off-by-one-region", "littles-law", "metastable", "big-rewrite", "strangler", "quorum", "eventually", "polyglot", "zero-gc", "no-cache", "celebrity", "follow-the-sun", "postgres-for-everything", "hug-of-death", "egress-shock", "chaos-monkey", "blameless", "nines", "five-nines", "monoglot", "default-alive", "unicorn", "decacorn", "everyone-online", "warm-start", "rule-of-40", "beat-and-raise", "serial-founder", "two-hard-things", "conways-law", "fallacies", "thundering-herd", "runbook", "finops", "spot-the-difference", "let-it-crash"];
pub const ADOPTION_DAYS: f64 = 7.0;
pub const ALERT_FATIGUE: f64 = 5.0;
pub const ANALYTICS_CAPACITY: f64 = 4.0;
pub const ANOMALY_DETECTION_HOLD: f64 = 0.5;
pub const ANONYMOUS_PAGE: f64 = 0.6;
pub const ANYCAST_MS: f64 = 20.0;
pub const APACHE_MAX_WORKERS: f64 = 150.0;
pub const APACHE_SPARE: f64 = 5.0;
pub const APDEX_WINDOW: f64 = 60.0;
pub const ARM_RESEARCH: &str = "arm-instances";
pub const ARM_SPEED: f64 = 0.95;
pub static AUTHENTICATED_KINDS: [&str; 10] = ["read", "write", "search", "upload", "buy", "job", "report", "ai", "feed", "hook"];
pub const AUTH_CHECK_MS: f64 = 0.02;
pub const AUTH_MOVE_DH: f64 = 120.0;
pub const AUTH_PRICE_PER_USER: f64 = 0.00006;
pub const AUTOPILOT_HIRES: f64 = 4.0;
pub const AUTOPILOT_LOAD: f64 = 0.7;
pub const AUTOPILOT_PAYROLL: f64 = 0.25;
pub static AXES: [&str; 6] = ["throughput", "tail", "memory", "velocity", "resilience", "operability"];
pub const BACKDOOR_FUSE: f64 = 300.0;
pub const BACKEND_KB: f64 = 4.0;
pub static BACKEND_KINDS: [&str; 16] = ["q-read", "q-write", "auth", "q-search", "q-vector", "blob-put", "task", "blob-get", "q-tx", "charge", "q-scan", "infer", "notify", "callout", "k-write", "change"];
pub static BACKGROUND_FEATURES: [&str; 5] = ["email-digests", "data-export", "notifications-center", "webhooks", "push-notifications"];
pub const BACKLOG_MS: f64 = 0.01;
pub static BAD_DEPLOY_BASE: [f64; 3] = [0.0, 0.1, 0.1];
pub const BAD_DEPLOY_ERRORS: f64 = 0.08;
pub const BAD_DEPLOY_MAX: f64 = 0.4;
pub const BEAM_CRASHES_PER_REQUESTS: f64 = 100.0;
pub const BLOAT_CPU: f64 = 2.0;
pub const BLOCK_REMIND_DAYS: f64 = 1.0;
pub const BLOCK_SIZE_AT: f64 = 8.0;
pub const BORDER_MIXING: f64 = 0.1;
pub const BOT_MANAGEMENT_FALSE: f64 = 0.5;
pub const BOT_SURGE: f64 = 0.8;
pub const BREAKER_OPEN: f64 = 5.0;
pub const BREAKER_THRESHOLD: f64 = 0.5;
pub const BUILD_CACHE: f64 = 0.75;
pub const BULKHEAD_MS: f64 = 1000.0;
pub const BURST_BASELINE: f64 = 0.2;
pub const CACHE_OPS: f64 = 50000.0;
pub const CALENDAR_DAY: f64 = 1440.0;
pub const CALENDAR_PACE: f64 = 24.0;
pub const CALENDAR_START: f64 = 840.0;
pub const CALLOUT_FAILURE: f64 = 0.02;
pub const CALLOUT_MS: f64 = 800.0;
pub const CASCADE_FROM_STAGE: f64 = 3.0;
pub static CDC_CHANGES: [&str; 3] = ["q-write", "q-tx", "k-write"];
pub const CDC_DROP_STALE: f64 = 0.005;
pub const CDC_LAG_STALE: f64 = 0.0002;
pub const CDC_MS: f64 = 2.0;
pub const CDC_RATE: f64 = 20000.0;
pub const CERT_DAYS: f64 = 90.0;
pub const CERT_DAYS_SHORT: f64 = 45.0;
pub const CERT_FROM_STAGE: f64 = 2.0;
pub const CERT_RENEW: f64 = 0.6666666666666666;
pub const CERT_SHORT_FROM: f64 = 5.0;
pub const CHAOS_EVERY: f64 = 120.0;
pub const CHAOS_FAILURE: f64 = 0.2;
pub const CHAOS_FROM_STAGE: f64 = 2.0;
pub const CHAOS_INSIGHT: f64 = 1.0;
pub const CHAOS_SECONDS: f64 = 10.0;
pub const CHAOS_WEIGHT: f64 = 4.0;
pub static CHECK_INTERVALS: [f64; 3] = [2.0, 10.0, 30.0];
pub const CHURN: f64 = 0.004;
pub const CI_DEPLOY_MINUTES: f64 = 5.0;
pub const CLOCK_SKEW_LOSS: f64 = 0.1;
pub const CLOCK_SKEW_MS: f64 = 1000.0;
pub const COALESCED: f64 = 0.25;
pub const COALESCE_HOT: f64 = 0.3;
pub static COALESCE_KINDS: [&str; 4] = ["page", "read", "feed", "search"];
pub const COALESCE_WINDOW: f64 = 0.05;
pub const CODE_REVIEW_FACTOR: f64 = 0.2;
pub const CONTENT_MOOD: f64 = 0.7;
pub const COORDINATION: f64 = 0.08;
pub const COPY_PRICE_GROWTH: f64 = 1.25;
pub static CPU_HEAVY_KINDS: [&str; 3] = ["upload", "report", "job"];
pub const CREDENTIAL_PROTECTION_BLOCK: f64 = 0.2;
pub const CREDIT_CAP: f64 = 100.0;
pub const CROSS_ZONE_MS: f64 = 1.0;
pub const CVE_EVERY: f64 = 420.0;
pub const DATASTORE_MOVE_DH: f64 = 16.0;
pub static DATA_KINDS: [&str; 9] = ["q-read", "q-write", "q-search", "q-vector", "blob-put", "q-tx", "blob-get", "q-scan", "k-write"];
pub static DATA_PATTERNS: [&str; 4] = ["replica", "primary", "replicate", "call"];
pub const DATA_TEAM_HOURS: f64 = 0.7;
pub const DATA_TEAM_LAG: f64 = 0.5;
pub const DB_STORAGE_MULT: f64 = 3.5;
pub const DDOS_MAGNITUDE: f64 = 50.0;
pub const DEADLINE_SURGE: f64 = 3.0;
pub const DECLINED_GROWTH: f64 = 0.7;
pub const DEFAULT_FPM_WORKERS: f64 = 5.0;
pub const DELETE_CHURN: f64 = 0.1;
pub const DENORMALIZED_READ: f64 = 0.7;
pub const DENORMALIZED_WRITE: f64 = 1.2;
pub static DEPLOY_STRATEGY_IDS: [&str; 4] = ["recreate", "rolling", "blue-green", "canary"];
pub static DEVICES: [&str; 3] = ["desktop", "mobile", "tablet"];
pub const DEV_ENVIRONMENT_RAMP: f64 = 0.5;
pub const DEV_HOURS_PER_DAY: f64 = 8.0;
pub const DISTRIBUTED_TX_FAILURE: f64 = 0.005;
pub const DIURNAL_AMPLITUDE: f64 = 0.45;
pub static DNS_TTLS: [f64; 3] = [30.0, 300.0, 3600.0];
pub const DOC_JOIN_COST: f64 = 3.0;
pub const DOC_OPS: f64 = 3000.0;
pub const DOC_OP_MS: f64 = 1.0;
pub const DOC_PARTIAL: f64 = 0.02;
pub const DOC_PATTERN_FACTOR: f64 = 1.1;
pub const DOC_REBALANCE_MINUTES_PER_GB: f64 = 0.4;
pub const DOC_SHAPE_DH: f64 = 0.75;
pub const DOC_TXN_LATENCY: f64 = 0.5;
pub const DRAIN_SECONDS: f64 = 10.0;
pub const DRAWER_MIN: f64 = 25.0;
pub const DRAWER_SECONDS: f64 = 60.0;
pub const DRILL_INSIGHT: f64 = 5.0;
pub const DRILL_RECOVERED: f64 = 0.01;
pub const DRILL_RPO: f64 = 5.0;
pub const DRILL_RTO: f64 = 60.0;
pub const DRILL_SECONDS: f64 = 60.0;
pub const DSQL_READ_COST: f64 = 0.25;
pub const DSQL_TX: f64 = 6000.0;
pub const DUAL_WRITE_STALE: f64 = 0.005;
pub const EARLY_LIFT: f64 = 0.5;
pub const EARLY_REFRESH: f64 = 0.02;
pub const EDGE_CPU_MS: f64 = 10.0;
pub static EDGE_LANGUAGES: [&str; 3] = ["node", "rust", "go"];
pub const EDGE_MEMORY_MB: f64 = 128.0;
pub const EDGE_MS: f64 = 5.0;
pub const EDGE_READ_HIT: f64 = 0.3;
pub const EDGE_REQUEST_PRICE: f64 = 0.00036;
pub const EGRESS_CDN: f64 = 0.02;
pub const EGRESS_CROSS_REGION: f64 = 0.02;
pub const EGRESS_CROSS_ZONE: f64 = 0.01;
pub const EGRESS_ORIGIN: f64 = 0.09;
pub const ELIXIR_HOT_UPGRADE_DEV_HOURS: f64 = 4.0;
pub const ENGINE_COPY_MINUTES_PER_GB: f64 = 1.0;
pub const ENGINE_FACTOR: f64 = 0.8;
pub const ESCALATION: f64 = 1.5;
pub const ESI_PAGE_HIT: f64 = 0.2;
pub static EXIT_IDS: [&str; 4] = ["acqui-hire", "acquisition", "ipo", "step-down"];
pub const EXPAND_CONTRACT_DH: f64 = 1.25;
pub const EXPORT_MS_PER_GB: f64 = 4000.0;
pub const FAILOVER_SECONDS: f64 = 20.0;
pub const FAILURE_YIELD: f64 = 3.0;
pub static FALLACY_IDS: [&str; 8] = ["reliable", "latency", "bandwidth", "secure", "topology", "administrator", "transport-cost", "homogeneous"];
pub static FAMILY_IDS: [&str; 5] = ["burstable", "general", "compute", "memory", "arm"];
pub const FETCH_MS: f64 = 20.0;
pub const FICKLE_SHARE: f64 = 0.5;
pub const FIRST_INCIDENT_AFTER: f64 = 90.0;
pub const FIRST_KIND_INSIGHT: f64 = 20.0;
pub static FIXES: [&str; 7] = ["eager-loading", "fix-leak", "session-state", "idempotency-keys", "off-loop", "graceful-shutdown", "health-check"];
pub const FIX_BUGS_SHARE: f64 = 0.25;
pub const FLAG_PROPAGATION_SECONDS: f64 = 2.0;
pub const FLASH_SALE_SURGE: f64 = 20.0;
pub const FOLLOWERS: f64 = 20.0;
pub const FOREIGN_OUTPUT: f64 = 0.7;
pub const FOREVER_ATTEMPTS: f64 = 25.0;
pub const FORMAL_VERIFICATION_FACTOR: f64 = 0.5;
pub const FORMAL_VERIFICATION_VELOCITY: f64 = 0.85;
pub const FOUNDER_OUTPUT: f64 = 0.8;
pub const FREEZE_MOOD_DAYS: f64 = 7.0;
pub const FUNCTION_LIMIT_MS: f64 = 900000.0;
pub const FUNNEL_GROWTH: f64 = 1.1;
pub const GATEWAY_AUTH_MS: f64 = 2.0;
pub const GATEWAY_BURST: f64 = 200.0;
pub static GATEWAY_LIMITS: [f64; 6] = [0.0, 100.0, 500.0, 1000.0, 2500.0, 5000.0];
pub const GATEWAY_PRICE: f64 = 0.002;
pub const GC_STORM: f64 = 5.0;
pub const GC_STORM_HEAP: f64 = 0.2;
pub static GLOSSARY_CATEGORIES: [&str; 10] = ["performance", "reliability", "observability", "data", "runtimes", "network", "security", "delivery", "team", "business"];
pub const GPU_CACHE_GB: f64 = 0.25;
pub const GPU_FIRST_TOKEN_MS: f64 = 300.0;
pub const GZIP_CPU: f64 = 1.1;
pub const GZIP_RATIO: f64 = 0.3;
pub const HANDSHAKE_MS: f64 = 1.0;
pub const HEDGE_LOAD: f64 = 0.1;
pub const HERD_REFUSED: f64 = 0.5;
pub const HIRE_DAYS: f64 = 1.0;
pub const HIRING_PIPELINE: f64 = 0.7;
pub const HN_WEIGHT: f64 = 3.0;
pub const HOME_REGION: &str = "na";
pub const HOP_MS: f64 = 0.5;
pub const HOTFIX_DEBT: f64 = 0.02;
pub const HOT_KB_PER_USER: f64 = 200.0;
pub const HOT_KEY_SHARE: f64 = 0.3;
pub const HOT_SHARD_CPU: f64 = 3.0;
pub const HTTP2_CUT: f64 = 0.15;
pub const HTTP3_CUT: f64 = 0.2;
pub const HUB_RAM_KB: f64 = 8388608.0;
pub const HYBRID_READS: f64 = 2.0;
pub const HYBRID_WRITES: f64 = 0.5;
pub const IAC_SWITCH: f64 = 1440.0;
pub static IAC_TOOLS: [&str; 3] = ["terraform", "pulumi", "alchemy"];
pub const INCIDENT_GAP: f64 = 400.0;
pub static INCIDENT_IDS: [&str; 56] = ["spike", "instance", "connections", "loop", "leak", "slow-query", "bad-deploy", "bot-surge", "stuffing", "stampede", "poison", "ddos", "certificate", "psp-outage", "zone", "disk-full", "repl-lag", "latency-regression", "gc-storm", "retry-storm", "deadline-day", "double-charge", "report-db", "gpu-shortage", "regex", "region", "partition", "hot-key", "bgp", "audit", "dr-drill", "breach", "credential-leak", "cluster-upgrade", "config", "spot-reclaim", "stale-read", "reconnect", "runaway-bill", "mtu", "hot-shard", "premiere-spike", "launch-day", "flash-sale", "jvm-warmup", "migration-lock", "supply-chain", "accidental-delete", "operator-typo", "leap-second", "table-bloat", "page-leak", "stale-opcache", "bun-compat", "gevent-compat", "split-brain"];
pub const INDEX_WRITE_COST: f64 = 0.05;
pub static INSIGHT_POOLS: [&str; 18] = ["page", "read", "write", "login", "search", "upload", "bot", "media", "rt", "buy", "job", "report", "ai", "feed", "hook", "push", "bid", "failure"];
pub const INSIGHT_YIELD: f64 = 1.0;
pub static INTERNAL_TOOL_FEATURES: [&str; 4] = ["dashboards", "audit-log", "status-page", "data-export"];
pub const INTERNET_MS: f64 = 30.0;
pub const JEMALLOC_MEMORY: f64 = 1.05;
pub const JEMALLOC_SPEED: f64 = 1.05;
pub const JVM_INSIGHT: f64 = 0.25;
pub const JVM_WARMUP_SECONDS: f64 = 30.0;
pub const KLOC_PER_DH: f64 = 0.5;
pub const L4_BURN: f64 = 0.6;
pub const L4_CAPACITY: f64 = 10.0;
pub const L4_MS: f64 = 0.2;
pub const LAG_SURGE: f64 = 10.0;
pub const LATENCY_REGRESSION_MS: f64 = 150.0;
pub const LAUNCH_SURGE: f64 = 6.0;
pub const LAYOFF_MORALE: f64 = 0.9;
pub const LEAK_RATE: f64 = 0.025;
pub const LEAP_SECOND_SECONDS: f64 = 60.0;
pub const LEARN_COST: f64 = 0.25;
pub const LEARN_DAYS: f64 = 7.0;
pub const LEARN_OUTPUT: f64 = 0.5;
pub const LET_IT_CRASH: f64 = 1000.0;
pub static LEVER_DH: [f64; 3] = [24.0, 80.0, 240.0];
pub static LEVER_GROWTH: [f64; 3] = [0.99, 0.98, 0.96];
pub static LEVER_KINDS: [&str; 12] = ["login", "search", "upload", "media", "rt", "buy", "job", "report", "ai", "feed", "hook", "push"];
pub const LEVER_REFUND: f64 = 0.5;
pub static LEVER_STEPS: [f64; 4] = [1.0, 2.0, 3.0, 4.0];
pub const LIBUV_THREADS: f64 = 4.0;
pub const LIBUV_THREAD_MB: f64 = 2.0;
pub static LIFECYCLE_DAYS: [f64; 4] = [0.0, 30.0, 90.0, 365.0];
pub const LIFT_CONFIDENCE: f64 = 1.96;
pub const LIFT_MAX_ROLLOUT: f64 = 0.5;
pub const LIFT_MIN_ROLLOUT: f64 = 0.05;
pub const LIFT_SPREAD: f64 = 1.0;
pub const LINK_TIMEOUT: f64 = 30.0;
pub const LLM_FIRST_TOKEN_MS: f64 = 600.0;
pub const LLM_PRICE: f64 = 2.5;
pub const LLM_RATE: f64 = 100.0;
pub const LOAD_TEST_DAYS: f64 = 1.0;
pub const LOAD_TEST_DEMAND: f64 = 2.0;
pub const LOAD_TEST_INSIGHT: f64 = 2.0;
pub const LOCAL_DB_CONTENTION: f64 = 1.5;
pub const LOCAL_DB_RAM: f64 = 0.6;
pub const LOCAL_DB_RAM_PER_USER: f64 = 0.0015;
pub const LOGIN_DELEGATED_CPU: f64 = 2.0;
pub static LOG_PARTITIONS: [f64; 4] = [1.0, 3.0, 6.0, 12.0];
pub const LOG_RATE: f64 = 100000.0;
pub const LOG_READ_RATE: f64 = 20000.0;
pub static LOG_REPLICAS: [f64; 3] = [1.0, 2.0, 3.0];
pub const LOG_REPLICATE_MINUTES_PER_GB: f64 = 0.25;
pub const LOG_REPLICA_BURN: f64 = 0.5;
pub static LOG_RETENTION: [f64; 3] = [600.0, 3600.0, 10080.0];
pub const MANUAL_DEPLOY_MINUTES: f64 = 30.0;
pub const MARKET_GAIN_CAP: f64 = 2.0;
pub const MATERIALIZED_SCAN: f64 = 0.5;
pub const MATERIALIZED_STALE: f64 = 0.05;
pub static MAX_ATTEMPTS: [f64; 4] = [1.0, 3.0, 10.0, 25.0];
pub const MAX_CONNECTIONS: f64 = 100.0;
pub const MAX_LEVER_STEP: f64 = 3.0;
pub const MAX_STUDIES: f64 = 8.0;
pub const MESH_HOP_MS: f64 = 1.0;
pub const MESH_INSIGHT: f64 = 0.2;
pub const MESH_OVERHEAD: f64 = 0.05;
pub const MESH_TAX: f64 = 0.5;
pub const MIGRATION_BUGS: f64 = 0.03;
pub const MIGRATION_FEATURE_SPEED: f64 = 0.5;
pub const MIGRATION_LOCK_PER_GB: f64 = 0.1;
pub const MIGRATION_LOCK_SECONDS: f64 = 150.0;
pub static MIGRATION_STEPS: [f64; 4] = [0.05, 0.25, 0.5, 1.0];
pub static MIGRATION_TRANCHES: [f64; 4] = [0.1, 0.2, 0.3, 0.4];
pub const MIN_WEAKNESS: f64 = 0.2;
pub const MIRROR_TIME: f64 = 30.0;
pub const ML_AI_BONUS: f64 = 1.2;
pub static MONEY_KINDS: [&str; 3] = ["read", "write", "buy"];
pub const MONOLITH_DEBT: f64 = 0.4;
pub const MONOLITH_KLOC: f64 = 40.0;
pub const MONOLITH_MIGRATION: f64 = 3.0;
pub const MOOD_START: f64 = 1.0;
pub const MORALE_DAYS: f64 = 7.0;
pub const MSGP_PRICE: f64 = 0.0001;
pub const MSGP_RATE: f64 = 10000.0;
pub const MTU_LOSS: f64 = 0.5;
pub const MULTI_CONFLICT: f64 = 0.02;
pub const MULTI_WRITE_CPU: f64 = 1.25;
pub static MUTATOR_IDS: [&str; 10] = ["chaos-monkey", "hn-front-page", "legacy-monolith", "one-region", "no-caches", "tight-budget", "single-language", "postgres", "strict-slo", "shared-tenancy"];
pub const NATIVE_COLD_MS: f64 = 100.0;
pub const NIF_SPEED: f64 = 3.0;
pub const NOISY_MS: f64 = 10.0;
pub const NOISY_SHARE: f64 = 0.01;
pub const ONLINE_MIGRATION_DH: f64 = 1.1;
pub const ON_CALL_ACK: f64 = 5.0;
pub const OOM_RATIO: f64 = 1.25;
pub const OPCACHE_SPEED: f64 = 2.5;
pub const OPEN_ACTION_WEIGHT: f64 = 2.0;
pub const OPEN_REGION_PRICE: f64 = 20000.0;
pub const OPERATOR_TYPO_SECONDS: f64 = 120.0;
pub const ORM_READS: f64 = 3.0;
pub const OS_RAM: f64 = 0.25;
pub const OUTBOX_STALE: f64 = 0.0005;
pub const P2C_CAPACITY: f64 = 1.5;
pub const P2C_IMBALANCE: f64 = 0.1;
pub const PAGE_LEAK_CHURN: f64 = 0.05;
pub const PAGE_LEAK_SECONDS: f64 = 90.0;
pub const PAGE_MOOD: f64 = 0.08;
pub const PATCH_GRACE: f64 = 60.0;
pub const PAYING_SHARE: f64 = 0.05;
pub const PAY_GAP_MOOD_DAYS: f64 = 3.0;
pub static PERK_IDS: [&str; 12] = ["angel-network", "alumni-network", "institutional-knowledge", "pattern-recognition", "founders-reputation", "better-terms", "night-shift", "time-dilation", "playbooks", "war-stories", "head-start", "autopilot"];
pub const PHP_JIT_HEAVY: f64 = 1.6;
pub const PHP_JIT_SPEED: f64 = 1.05;
pub const PLAN_PER_DAY: f64 = 24.0;
pub const PLATFORM_TAX: f64 = 0.5;
pub static PLAYBOOK_SLOTS: [f64; 5] = [1.0, 2.0, 5.0, 10.0, 25.0];
pub const PLAYTEST_PACE: f64 = 2.0;
pub const POD_BURN: f64 = 0.85;
pub const POD_REACTION: f64 = 30.0;
pub const POD_RESCHEDULE: f64 = 30.0;
pub const POISON_SHARE: f64 = 0.9;
pub static POLICY_IDS: [&str; 3] = ["move-fast", "balanced", "quality"];
pub const POLICY_SWITCH_DAYS: f64 = 1.0;
pub const POOLER_CONNECTIONS: f64 = 20.0;
pub const POOL_FLOOR: f64 = 100.0;
pub static PREFETCH: [f64; 3] = [1.0, 10.0, 100.0];
pub const PREMIERE_SURGE: f64 = 4.0;
pub const PRESENCE_CPU: f64 = 0.15;
pub const PRESENCE_VALUE: f64 = 1.25;
pub const PRICING_FROM_STAGE: f64 = 3.0;
pub static PRICING_IDS: [&str; 3] = ["on-demand", "reserved", "spot"];
pub const PSP_CAPACITY: f64 = 1000.0;
pub const PSP_FIXED: f64 = 0.3;
pub const PSP_RATE: f64 = 0.029;
pub const QUARTER_DAYS: f64 = 90.0;
pub static QUEUE_LENGTHS: [f64; 4] = [0.0, 1000.0, 10000.0, 100000.0];
pub const QUEUE_MESSAGE_PRICE: f64 = 0.00144;
pub const QUEUE_RATE: f64 = 20000.0;
pub static QUORUM_N: [f64; 5] = [1.0, 2.0, 3.0, 4.0, 5.0];
pub const R2_FIRST_BYTE_MS: f64 = 15.0;
pub const RAMP_DAYS: f64 = 7.0;
pub const RAMP_OUTPUT: f64 = 0.3;
pub const RECYCLE_CYCLE: f64 = 1800.0;
pub const REFACTOR_PER_DH: f64 = 0.02;
pub const REFRESH_TIME: f64 = 0.5;
pub const REGEX_CAPACITY: f64 = 0.1;
pub static REGIONS: [&str; 4] = ["na", "eu", "apac", "sa"];
pub const REGIONS_FROM_STAGE: f64 = 5.0;
pub const REPLICA_BOX_PRICE: f64 = 0.7;
pub const REPLICA_SYNC_MINUTES_PER_GB: f64 = 0.5;
pub const REPORT_SURGE: f64 = 10.0;
pub static REQUEST_KINDS: [&str; 17] = ["page", "read", "write", "login", "search", "upload", "bot", "media", "rt", "buy", "job", "report", "ai", "feed", "hook", "push", "bid"];
pub const RESERVED_SECONDS: f64 = 10080.0;
pub const RESHARD_DH: f64 = 24.0;
pub const RESHARD_IOPS: f64 = 0.5;
pub const RESHARD_MINUTES_PER_GB: f64 = 1.0;
pub const RESTART_SECONDS: f64 = 2.0;
pub const RESTORE_DRILL_DH: f64 = 4.0;
pub const RESTORE_FAILURE: f64 = 0.2;
pub const RESTORE_MINUTES_PER_GB: f64 = 0.5;
pub const RESTORE_MIN_MINUTES: f64 = 5.0;
pub static RETENTION_STORAGE: [f64; 3] = [1.0, 2.0, 4.0];
pub static RETENTION_WINDOWS: [f64; 3] = [900.0, 3600.0, 21600.0];
pub const RETROGRADE: f64 = 0.0004;
pub const ROLLOUT_ALL: f64 = 1.0;
pub const ROLLOUT_SHARE: f64 = 0.25;
pub static ROLLOUT_STEPS: [f64; 5] = [0.0, 0.05, 0.25, 0.5, 1.0];
pub const ROWS_PER_USER: f64 = 100.0;
pub const ROW_KB: f64 = 10.0;
pub const RPS_PER_USER: f64 = 0.02;
pub const RT_HOLD_SECONDS: f64 = 300.0;
pub const RUNTIME_COMPAT_SECONDS: f64 = 90.0;
pub const RUSH_BUG_CHANCE: f64 = 0.1;
pub const RUSH_DEBT: f64 = 0.02;
pub const SALARY_BASE: f64 = 0.4;
pub static SAMPLE_LATENCY: [f64; 5] = [0.0, 0.5, 1.0, 3.0, 5.0];
pub static SAMPLE_OVERHEAD: [f64; 5] = [0.002, 0.01, 0.02, 0.08, 0.15];
pub static SAMPLE_RATES: [f64; 5] = [0.01, 0.05, 0.1, 0.5, 1.0];
pub static SAMPLE_STORAGE: [f64; 5] = [0.1, 0.5, 1.0, 5.0, 10.0];
pub const SAVINGS_PLAN_RATE: f64 = 0.8;
pub const SCALE_COOLDOWN: f64 = 30.0;
pub const SCALE_IN: f64 = 0.6;
pub static SCALE_MAXIMA: [f64; 4] = [4.0, 8.0, 16.0, 0.0];
pub static SCALE_MINIMA: [f64; 4] = [1.0, 2.0, 4.0, 8.0];
pub const SCALE_QUEUE_DEPTH: f64 = 100.0;
pub const SCALE_RPS_PER_VCPU: f64 = 100.0;
pub static SCALE_TARGETS: [f64; 3] = [0.4, 0.6, 0.8];
pub const SCAN_PRICE: f64 = 0.02;
pub const SCATTER_CPU: f64 = 0.15;
pub const SCATTER_MS: f64 = 2.0;
pub const SCHEDULE_LEAD_MINUTES: f64 = 120.0;
pub const SEARCH_COPY_MINUTES_PER_GB: f64 = 0.5;
pub const SEARCH_FANOUT: f64 = 0.2;
pub const SEARCH_INDEX_SHARE: f64 = 0.3;
pub const SEARCH_QPS: f64 = 400.0;
pub static SEARCH_REPLICAS: [f64; 3] = [0.0, 1.0, 2.0];
pub static SEARCH_SHARDS: [f64; 3] = [1.0, 2.0, 4.0];
pub const SECOND_PROVIDER_FEE: f64 = 1.15;
pub const SECURITY_TEAM_GRACE: f64 = 2.0;
pub const SECURITY_TEAM_SUPPLY_CHAIN: f64 = 0.5;
pub const SELL_REFUND: f64 = 0.5;
pub const SERIALIZE_MS: f64 = 0.02;
pub const SERVERLESS_CONCURRENCY: f64 = 1000.0;
pub const SERVERLESS_GB_SECOND: f64 = 0.02;
pub const SERVERLESS_IDLE_SECONDS: f64 = 5.0;
pub const SERVERLESS_MEMORY_GB: f64 = 1.0;
pub const SERVERLESS_MS: f64 = 1.0;
pub const SERVERLESS_REQUEST_PRICE: f64 = 0.00024;
pub const SERVICE_HANDOFF_DH: f64 = 8.0;
pub const SESSION_STATE_CRASHES: f64 = 0.05;
pub static SHARD_COUNTS: [f64; 4] = [1.0, 2.0, 4.0, 8.0];
pub const SHARED_DB_COORDINATION: f64 = 0.5;
pub const SIGNING_BASE: f64 = 2000.0;
pub const SIM_SECONDS_PER_DEV_HOUR: f64 = 0.3125;
pub const SLA_CREDIT: f64 = 0.1;
pub const SLOW_CHARGE_MS: f64 = 1500.0;
pub const SLO_FROM_STAGE: f64 = 3.0;
pub static SLO_LEVELS: [f64; 6] = [0.99, 0.995, 0.999, 0.9995, 0.9999, 0.99999];
pub const SLO_WINDOW_HOURS: f64 = 168.0;
pub const SPAWN_BLOCKING_THREADS: f64 = 8.0;
pub const SPAWN_BLOCKING_THREAD_MB: f64 = 2.0;
pub static SPIKE_MAGNITUDE: [f64; 2] = [3.0, 10.0];
pub const SPIKE_SPEED: f64 = 2.0;
pub const SPLIT_BRAIN_SECONDS: f64 = 90.0;
pub const SPOT_DOWN: f64 = 20.0;
pub const SPOT_WARNING: f64 = 10.0;
pub const SPREAD_REGIONS: f64 = 3.0;
pub const SPREAD_REPLICATION_KB: f64 = 1.0;
pub const SRE_MTTR: f64 = 0.4;
pub const STAGE_WAIT: f64 = 60.0;
pub const STALE_AFTER_DEPLOY: f64 = 0.3;
pub const STALE_OPCACHE_SECONDS: f64 = 90.0;
pub const STALE_SURGE: f64 = 10.0;
pub static STANDBY_TYPES: [&str; 5] = ["database", "pooler", "cache", "search", "queue"];
pub const START_CASH: f64 = 300.0;
pub const START_KLOC: f64 = 5.0;
pub const STATIC_ANALYSIS_FACTOR: f64 = 0.2;
pub const STEADY_CHURN: f64 = 0.2;
pub const STEAL_MAX: f64 = 0.3;
pub const STEAL_SECONDS: f64 = 30.0;
pub const STEP_SECONDS: f64 = 0.1;
pub const STICKY_DECAY: f64 = 0.8;
pub const STICKY_HERD: f64 = 0.5;
pub const STICKY_LOCAL_READ: f64 = 0.15;
pub const STICKY_SHARE: f64 = 0.4;
pub const STORAGE_PRICE: f64 = 0.000032;
pub const STORM_SLOWDOWN: f64 = 0.3;
pub const STORM_TRIGGER: f64 = 20.0;
pub const STREAK_BONUS: f64 = 0.1;
pub const STREAK_BONUS_CAP: f64 = 1.0;
pub const STREAM_KB: f64 = 500.0;
pub static STUDY_SECONDS: [f64; 8] = [20.0, 60.0, 120.0, 240.0, 480.0, 900.0, 1800.0, 3600.0];
pub static STUDY_SHAPE_KINDS: [&str; 7] = ["connections", "read-share", "cache-hit", "backlog", "report-share", "saturation", "replica"];
pub const STUDY_SPEEDUP: f64 = 0.25;
pub static STUDY_SPEED_RESEARCH: [&str; 2] = ["trace-search", "notebooks"];
pub const STUFFING_MAGNITUDE: f64 = 19.0;
pub const SUPPLY_CHAIN_CHURN: f64 = 0.1;
pub const SUPPLY_CHAIN_SECONDS: f64 = 90.0;
pub const SUPPORTED_QUARTERS: f64 = 1.0;
pub const SWITCH_PROVIDER_PRICE: f64 = 5000.0;
pub static SYNC_MODES: [&str; 2] = ["all", "staged"];
pub const SYNC_MS: f64 = 2.0;
pub const SYNC_POLL: f64 = 3.0;
pub const TABLE_BLOAT_SECONDS: f64 = 120.0;
pub static TASK_IDS: [&str; 14] = ["add-index", "eager-loading", "fix-leak", "session-state", "refactor", "fix-bugs", "upgrade-cluster", "runbook", "idempotency-keys", "off-loop", "timeouts-retries", "graceful-shutdown", "health-check", "load-test"];
pub const TASK_LINK_TIMEOUT: f64 = 5.0;
pub const TASK_RETRY_SECONDS: f64 = 30.0;
pub const TESTS_FACTOR: f64 = 0.3;
pub const TIERED_MEDIA_HIT: f64 = 0.92;
pub const TIME_OFF_DAYS: f64 = 3.0;
pub static TLS_TERMINATORS: [&str; 6] = ["lb", "cdn", "waf", "gw", "ws", "edge"];
pub const TOKENS_PER_PROMPT: f64 = 400.0;
pub const TRUNK_FREQUENCY: f64 = 1.5;
pub const UNHAPPY_MOOD: f64 = 0.35;
pub const UNINDEXED_MS_PER_ROW: f64 = 0.0001;
pub const UNSTRUCTURED_DEBT: f64 = 0.01;
pub const UPGRADE_CRASHES: f64 = 0.3;
pub const UPKEEP_CEILING: f64 = 0.6;
pub const UPKEEP_HALF: f64 = 2000.0;
pub const UPKEEP_SHARE: f64 = 0.4;
pub const UPLOAD_MB: f64 = 2.0;
pub const USER_MBPS: f64 = 20.0;
pub const USER_ROUND_TRIPS: f64 = 2.0;
pub const USER_UP_MBPS: f64 = 20.0;
pub const VCPU_PRICE: f64 = 0.05;
pub const VEC_AI_LIFT: f64 = 1.35;
pub const VEC_QUERIES: f64 = 500.0;
pub const VENDOR_DISCOUNT: f64 = 0.2;
pub static VENTURE_IDS: [&str; 12] = ["b2b-saas", "consumer-social", "fintech", "streaming", "game-backend", "ai-startup", "e-commerce", "developer-platform", "healthcare", "ad-tech", "bootstrapped", "government"];
pub const VERIFY_MINUTES: f64 = 15.0;
pub const VM_REACTION: f64 = 180.0;
pub const VM_RESTART_SECONDS: f64 = 1.0;
pub const WARMED: f64 = 0.8;
pub const WARMUP_SECONDS: f64 = 15.0;
pub const WEEKEND_FACTOR: f64 = 1.0;
pub const WIDE_OPS: f64 = 30000.0;
pub const WIDE_REBALANCE_MINUTES_PER_GB: f64 = 0.4;
pub const WIDE_SPREAD_LAG_STALE: f64 = 0.015;
pub const WIDE_STALE: f64 = 0.5;
pub const WIDE_TX_DUPLICATE: f64 = 0.01;
pub const WIDE_TX_STALE: f64 = 0.02;
pub const WORKER_THREADS: f64 = 4.0;
pub const WORKER_THREAD_MB: f64 = 10.0;
pub const WORK_MINUTES: f64 = 480.0;
pub const WRITE_BEHIND_SECONDS: f64 = 10.0;
pub const YJIT_MEMORY: f64 = 1.2;
pub const YJIT_SPEED: f64 = 1.3;
pub static ZONES: [&str; 3] = ["a", "b", "c"];
pub static SCALAR_COUNT: usize = 501;

// ---- Request kind profiles ----
pub static PROFILE_CPU: [f64; NR] = [4.0, 1.5, 2.0, 80.0, 3.0, 120.0, 2.0, 1.0, 0.3, 5.0, 400.0, 20.0, 5.0, 6.0, 2.0, 0.5, 0.5];
pub static PROFILE_NATIVE: [bool; NR] = [false, false, false, true, false, true, false, false, false, false, false, false, false, false, false, false, false];
pub static PROFILE_APDEX: [f64; NR] = [400.0, 200.0, 300.0, 800.0, 300.0, 1500.0, 400.0, 1000.0, 100.0, 2000.0, 1000.0, 3000.0, 4000.0, 300.0, 1000.0, 1000.0, 100.0];
pub static PROFILE_OFFLOAD: [f64; NR] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.9, 0.0, 0.0, 0.0, 0.0, 0.95, 0.0, 0.0, 0.0, 0.9, 0.9, 0.0];
pub static PROFILE_IN_KB: [f64; NR] = [0.0, 0.0, 0.0, 0.0, 0.0, 2000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static PROFILE_PAYLOAD_KB: [f64; NR] = [80.0, 4.0, 2.0, 1.0, 8.0, 2.0, 4.0, 5000.0, 1.0, 2.0, 10000.0, 50.0, 4.0, 30.0, 2.0, 1.0, 1.0];
pub static PROFILE_ASYNC_KB: [f64; NR] = [80.0, 4.0, 2.0, 1.0, 8.0, 2.0, 4.0, 5000.0, 1.0, 2.0, 2.0, 50.0, 4.0, 30.0, 2.0, 1.0, 1.0];
pub static PROFILE_ORM: [bool; NR] = [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
pub static PROFILE_SCORED: [bool; NR] = [true, true, true, true, true, true, false, true, true, true, true, true, true, true, true, true, true];
pub static PROFILE_COMPRESSIBLE: [bool; NR] = [true, true, false, false, true, false, true, false, false, false, false, true, false, true, false, false, false];
pub static PROFILE_STREAM: [bool; NR] = [false, false, false, false, false, false, false, true, false, false, false, false, true, false, false, false, false];
pub static PROFILE_COMPLETION: [f64; NR] = [0.0, 0.0, 0.0, 0.0, 0.0, 10000.0, 0.0, 0.0, 0.0, 0.0, 60000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static PROFILE_CALLS: [[f64; NK]; NR] = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
];
pub static PROFILE_ASYNC_CALLS: [[f64; NK]; NR] = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
];

// ---- Kind values ----
pub static KIND_VALUE: [f64; NK] = [0.1, 0.2, 0.5, 0.25, 0.6, 0.75, 0.0, 1.0, 0.025, 25.0, 1.6, 2.0, 24.0, 0.3, 0.4, 0.05, 0.001, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];

// ---- Runtimes ----
pub const RUNTIME_COUNT: usize = 28;
pub static RUNTIME_IDS: [&str; 28] = ["mod_php", "php_fpm", "php_worker", "swoole", "puma", "unicorn", "falcon", "node", "node_cluster", "bun", "deno", "gunicorn", "gevent", "uvicorn", "python_ft", "pypy", "go", "fasthttp", "tomcat", "java_virtual", "webflux", "graal", "kestrel", "native_aot", "beam", "tokio", "zig", "warp"];
pub fn runtime_index(name: &str) -> usize {
    match name {
        "mod_php" => 0,
        "php_fpm" => 1,
        "php_worker" => 2,
        "swoole" => 3,
        "puma" => 4,
        "unicorn" => 5,
        "falcon" => 6,
        "node" => 7,
        "node_cluster" => 8,
        "bun" => 9,
        "deno" => 10,
        "gunicorn" => 11,
        "gevent" => 12,
        "uvicorn" => 13,
        "python_ft" => 14,
        "pypy" => 15,
        "go" => 16,
        "fasthttp" => 17,
        "tomcat" => 18,
        "java_virtual" => 19,
        "webflux" => 20,
        "graal" => 21,
        "kestrel" => 22,
        "native_aot" => 23,
        "beam" => 24,
        "tokio" => 25,
        "zig" => 26,
        "warp" => 27,
        _ => 0,
    }
}
pub static RUNTIME_LANGUAGE: [&str; 28] = ["php", "php", "php", "php", "ruby", "ruby", "ruby", "node", "node", "node", "node", "python", "python", "python", "python", "python", "go", "go", "java", "java", "java", "java", "csharp", "csharp", "elixir", "rust", "zig", "haskell"];
pub static RUNTIME_MODEL: [&str; 28] = ["process", "process", "process", "loop", "threads", "process", "loop", "loop", "loop", "loop", "loop", "process", "green", "loop", "threads", "process", "green", "green", "threads", "green", "loop", "threads", "async", "async", "green", "async", "threads", "green"];
pub static RUNTIME_SPEED: [f64; 28] = [0.15, 0.15, 0.15, 0.15, 0.25, 0.25, 0.25, 0.7, 0.7, 0.85, 0.7, 0.2, 0.2, 0.2, 0.18, 0.6, 1.0, 1.25, 1.1, 1.1, 1.1, 0.8, 1.1, 0.9, 0.45, 1.4, 1.3, 0.85];
pub static RUNTIME_MEMORY_MB: [f64; 28] = [60.0, 40.0, 60.0, 60.0, 180.0, 180.0, 180.0, 80.0, 80.0, 60.0, 80.0, 120.0, 120.0, 120.0, 120.0, 200.0, 30.0, 30.0, 500.0, 500.0, 100.0, 200.0, 150.0, 100.0, 100.0, 10.0, 24.0, 80.0];
pub static RUNTIME_POOL: [bool; 28] = [false, true, true, false, false, true, false, false, false, false, false, true, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false];
pub static RUNTIME_THREADS: [f64; 28] = [1.0, 1.0, 1.0, 1.0, 5.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 8.0, 1.0, 1.0, 1.0, 200.0, 1.0, 1.0, 200.0, 1.0, 1.0, 1.0, 1.0, 64.0, 1.0];
pub static RUNTIME_PARALLEL: [bool; 28] = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false, true, true, true, true, false, true, true, true, true, true, true, true];
pub static RUNTIME_CONNECTION_KB: [f64; 28] = [-1.0, -1.0, -1.0, 20.0, 100.0, -1.0, 100.0, 20.0, 20.0, 20.0, 20.0, -1.0, 30.0, 30.0, 100.0, -1.0, 10.0, 10.0, 1024.0, 10.0, 10.0, 1024.0, 10.0, 10.0, 5.0, 5.0, 256.0, 16.0];
pub static RUNTIME_STARTUP_S: [f64; 28] = [0.0, 0.0, 0.0, 0.0, 10.0, 10.0, 10.0, 1.0, 1.0, 0.0, 1.0, 5.0, 5.0, 5.0, 5.0, 5.0, 0.0, 0.0, 20.0, 20.0, 20.0, 0.0, 3.0, 0.0, 3.0, 0.0, 0.0, 1.0];
pub static RUNTIME_WARM_FROM: [f64; 28] = [1.0, 1.0, 1.0, 1.0, 0.9, 0.9, 0.9, 0.8, 0.8, 1.0, 0.8, 0.95, 0.95, 0.95, 0.95, 0.5, 1.0, 1.0, 0.3, 0.3, 0.3, 1.0, 0.6, 1.0, 1.0, 1.0, 1.0, 1.0];
pub static RUNTIME_WARMUP: [f64; 28] = [15.0, 15.0, 0.0, 0.0, 15.0, 15.0, 15.0, 15.0, 15.0, 0.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 15.0, 0.0, 30.0, 30.0, 30.0, 0.0, 15.0, 0.0, 15.0, 15.0, 0.0, 0.0];
pub static RUNTIME_OVERHEAD_FACTOR: [f64; 28] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static RUNTIME_PERSISTENT: [bool; 28] = [false, false, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true];
pub static RUNTIME_BLOCKING: [&str; 28] = ["none", "none", "none", "loop", "none", "none", "loop", "loop", "loop", "loop", "loop", "none", "none", "loop", "none", "none", "none", "none", "none", "none", "loop", "none", "none", "none", "none", "worker", "none", "none"];
pub static RUNTIME_CONNECTIONS: [f64; 28] = [1.0, 1.0, 10.0, 10.0, 5.0, 1.0, 10.0, 10.0, 10.0, 10.0, 10.0, 1.0, 10.0, 10.0, 10.0, 1.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0];
pub static RUNTIME_VELOCITY: [f64; 28] = [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 0.9, 1.0, 1.0, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0];
pub static RUNTIME_GC_PAUSE: [f64; 28] = [-1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 1.0, 1.0, 30.0, 30.0, 30.0, 30.0, 15.0, 15.0, -1.0, -1.0, -1.0, 12.0];
pub static RUNTIME_GC_CPU: [f64; 28] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.25, 0.25, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.15];

// ---- Languages ----
pub const LANGUAGE_COUNT: usize = 11;
pub static LANGUAGE_IDS: [&str; 11] = ["php", "ruby", "node", "python", "go", "java", "csharp", "elixir", "rust", "zig", "haskell"];
pub fn language_index(name: &str) -> usize {
    match name {
        "php" => 0,
        "ruby" => 1,
        "node" => 2,
        "python" => 3,
        "go" => 4,
        "java" => 5,
        "csharp" => 6,
        "elixir" => 7,
        "rust" => 8,
        "zig" => 9,
        "haskell" => 10,
        _ => 0,
    }
}
pub static LANGUAGE_VELOCITY: [f64; 11] = [1.2, 1.1, 1.15, 1.15, 0.95, 0.9, 1.0, 1.0, 0.6, 0.7, 1.15];
pub static LANGUAGE_BLAST: [&str; 11] = ["request", "request", "whole", "request", "request", "request", "request", "request", "task", "whole", "request"];

// ---- Frameworks ----
pub const FRAMEWORK_COUNT: usize = 31;
pub static FRAMEWORK_IDS: [&str; 31] = ["none", "jetzig", "tokamak", "servant", "ihp", "laravel", "rails", "express", "django", "symfony", "sinatra", "flask", "gin", "spring-boot", "aspnet", "phoenix", "axum", "actix", "fastapi", "fastify", "nextjs", "nestjs", "fiber", "quarkus", "hono", "elysia", "koa", "adonis", "codeigniter", "sanic", "rocket"];
pub fn framework_index(name: &str) -> usize {
    match name {
        "none" => 0,
        "jetzig" => 1,
        "tokamak" => 2,
        "servant" => 3,
        "ihp" => 4,
        "laravel" => 5,
        "rails" => 6,
        "express" => 7,
        "django" => 8,
        "symfony" => 9,
        "sinatra" => 10,
        "flask" => 11,
        "gin" => 12,
        "spring-boot" => 13,
        "aspnet" => 14,
        "phoenix" => 15,
        "axum" => 16,
        "actix" => 17,
        "fastapi" => 18,
        "fastify" => 19,
        "nextjs" => 20,
        "nestjs" => 21,
        "fiber" => 22,
        "quarkus" => 23,
        "hono" => 24,
        "elysia" => 25,
        "koa" => 26,
        "adonis" => 27,
        "codeigniter" => 28,
        "sanic" => 29,
        "rocket" => 30,
        _ => 0,
    }
}
pub static FRAMEWORK_OVERHEAD: [f64; 31] = [1.0, 1.3, 1.05, 1.0, 1.3, 1.8, 1.5, 1.1, 1.4, 1.5, 1.1, 1.1, 1.05, 1.3, 1.05, 1.1, 1.0, 0.95, 1.15, 1.0, 1.0, 1.3, 1.0, 1.1, 1.0, 1.0, 1.05, 1.4, 1.1, 1.05, 1.05];
pub static FRAMEWORK_VELOCITY: [f64; 31] = [0.8, 1.4, 1.2, 1.1, 1.4, 1.45, 1.5, 1.2, 1.4, 1.25, 1.1, 1.1, 1.1, 1.1, 1.15, 1.3, 1.15, 1.1, 1.3, 1.15, 1.35, 1.3, 1.15, 1.05, 1.1, 1.25, 1.15, 1.4, 1.1, 1.2, 1.3];
pub static FRAMEWORK_MEMORY_MB: [f64; 31] = [0.0, 25.0, 5.0, 2.0, 40.0, 10.0, 70.0, 10.0, 30.0, 10.0, 5.0, 10.0, 5.0, 200.0, 20.0, 20.0, 2.0, 2.0, 10.0, 5.0, 30.0, 20.0, 5.0, 100.0, 2.0, 5.0, 5.0, 25.0, 4.0, 10.0, 3.0];
pub static FRAMEWORK_ORM: [bool; 31] = [false, false, false, false, false, true, true, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false];
pub static FRAMEWORK_ASGI: [bool; 31] = [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, false];
pub static FRAMEWORK_CACHEABLE: [f64; 31] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.4, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static FRAMEWORK_WORKER_OVERHEAD: [f64; 31] = [-1.0, -1.0, -1.0, -1.0, -1.0, 1.1, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0];
pub static FRAMEWORK_VALUE: [[f64; NR]; 31] = [
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.2, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.3, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.15, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.5, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
];
pub static FRAMEWORK_CPU: [[f64; NR]; 31] = [
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.6, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
];

// ---- Database engines ----
pub static DB_CONNECTIONS: [f64; 2] = [100.0, 500.0];
pub static DB_CONNECTION_MB: [f64; 2] = [8.0, 1.0];
pub static DB_READ: [f64; 2] = [0.95, 1.05];
pub static DB_WRITE: [f64; 2] = [1.15, 0.85];
pub static DB_SCAN: [f64; 2] = [0.9, 1.1];
pub static DB_SEARCH_COST: [f64; 2] = [1.0, 2.0];
pub static DB_LAG: [f64; 2] = [1.0, 0.8];
pub fn db_engine_index(name: &str) -> usize { if name == "mysql" { 1 } else { 0 } }

// ---- Components ----
pub const COMPONENT_COUNT: usize = 38;
pub static COMPONENT_IDS: [&str; 38] = ["users", "payments", "analytics", "server", "database", "dns", "lb", "pooler", "cache", "replica", "auth", "search", "storage", "doc", "queue", "worker", "log", "fn", "cdn", "waf", "gw", "ws", "psp", "autoscaler", "ci", "cluster", "warehouse", "vec", "gpu", "edge", "llm", "msgp", "wide", "dsql", "cdc", "mesh", "ff", "pki"];
pub fn component_index(name: &str) -> usize {
    match name {
        "users" => 0,
        "payments" => 1,
        "analytics" => 2,
        "server" => 3,
        "database" => 4,
        "dns" => 5,
        "lb" => 6,
        "pooler" => 7,
        "cache" => 8,
        "replica" => 9,
        "auth" => 10,
        "search" => 11,
        "storage" => 12,
        "doc" => 13,
        "queue" => 14,
        "worker" => 15,
        "log" => 16,
        "fn" => 17,
        "cdn" => 18,
        "waf" => 19,
        "gw" => 20,
        "ws" => 21,
        "psp" => 22,
        "autoscaler" => 23,
        "ci" => 24,
        "cluster" => 25,
        "warehouse" => 26,
        "vec" => 27,
        "gpu" => 28,
        "edge" => 29,
        "llm" => 30,
        "msgp" => 31,
        "wide" => 32,
        "dsql" => 33,
        "cdc" => 34,
        "mesh" => 35,
        "ff" => 36,
        "pki" => 37,
        _ => 0,
    }
}
pub static COMPONENT_ACCEPTS: [u64; 38] = [
    0x0, // users
    0x0, // payments
    0x0, // analytics
    0x1ffff, // server
    0x8b560000, // database
    0x1ffff, // dns
    0x8b77ffff, // lb
    0x2060000, // pooler
    0x18b560000, // cache
    0x8020000, // replica
    0x80000, // auth
    0x100100000, // search
    0x1400000, // storage
    0xa060000, // doc
    0x800000, // queue
    0x800000, // worker
    0x100800000, // log
    0x1feff, // fn
    0x1ffff, // cdn
    0x1ffff, // waf
    0x1ffff, // gw
    0x100, // ws
    0x4000000, // psp
    0x0, // autoscaler
    0x0, // ci
    0x0, // cluster
    0x108000000, // warehouse
    0x200000, // vec
    0x10000000, // gpu
    0x1feff, // edge
    0x10000000, // llm
    0x20000000, // msgp
    0x82060000, // wide
    0x2060000, // dsql
    0x0, // cdc
    0x0, // mesh
    0x0, // ff
    0x0, // pki
];
pub static COMPONENT_SENDS: [u64; 38] = [
    0x1ffff, // users
    0x0, // payments
    0x0, // analytics
    0xfffe0000, // server
    0x0, // database
    0x1ffff, // dns
    0x8b77ffff, // lb
    0x2060000, // pooler
    0x8b560000, // cache
    0x0, // replica
    0x0, // auth
    0x0, // search
    0x0, // storage
    0x0, // doc
    0x800000, // queue
    0x60460000, // worker
    0x100800000, // log
    0xff7e0000, // fn
    0x1ffff, // cdn
    0x1ffff, // waf
    0x1ffff, // gw
    0x0, // ws
    0x0, // psp
    0x0, // autoscaler
    0x0, // ci
    0x0, // cluster
    0x0, // warehouse
    0x0, // vec
    0x0, // gpu
    0xff7e0000, // edge
    0x0, // llm
    0x0, // msgp
    0x0, // wide
    0x0, // dsql
    0x100000000, // cdc
    0x0, // mesh
    0x0, // ff
    0x0, // pki
];
pub static COMPONENT_FALLBACK: [u64; 38] = [
    0x0, // users
    0x0, // payments
    0x0, // analytics
    0x0, // server
    0x89500000, // database
    0x0, // dns
    0x0, // lb
    0x0, // pooler
    0x8b500000, // cache
    0x0, // replica
    0x0, // auth
    0x0, // search
    0x0, // storage
    0x8000000, // doc
    0x0, // queue
    0x0, // worker
    0x0, // log
    0x0, // fn
    0x0, // cdn
    0x0, // waf
    0x0, // gw
    0x0, // ws
    0x0, // psp
    0x0, // autoscaler
    0x0, // ci
    0x0, // cluster
    0x0, // warehouse
    0x0, // vec
    0x0, // gpu
    0x0, // edge
    0x0, // llm
    0x0, // msgp
    0x0, // wide
    0x0, // dsql
    0x0, // cdc
    0x0, // mesh
    0x0, // ff
    0x0, // pki
];
pub static COMPONENT_STACK: [bool; 38] = [false, false, false, true, false, false, false, false, false, false, false, false, false, false, false, true, false, true, false, false, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, false];
pub static COMPONENT_LIMITING: [bool; 38] = [false, false, false, true, true, false, true, true, true, true, false, true, false, true, true, true, true, true, false, true, true, true, true, false, false, false, false, true, true, false, true, true, true, true, true, false, false, false];
pub static COMPONENT_COLD_START: [bool; 38] = [false, false, false, true, true, false, false, false, true, true, false, false, false, true, false, true, false, true, false, false, false, false, false, false, false, false, false, true, true, false, false, false, false, false, false, false, false, false];
pub static COMPONENT_TAP: [bool; 38] = [false, false, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
pub static COMPONENT_LATENCY: [f64; 38] = [30.0, 0.0, 0.0, 2.0, 2.0, 0.0, 1.0, 0.3, 0.5, 2.0, 120.0, 15.0, 40.0, 3.0, 2.0, 0.0, 5.0, 1.0, 8.0, 2.0, 6.0, 1.0, 400.0, 0.0, 1.0, 0.0, 1500.0, 20.0, 300.0, 5.0, 600.0, 100.0, 3.0, 3.0, 2.0, 0.0, 0.0, 0.0];
pub static COMPONENT_STEPS: [f64; 38] = [1.0, 6.0, 8.0, 1.0, 1.0, 1.0, 6.0, 4.0, 8.0, 1.0, 1.0, 8.0, 1.0, 8.0, 6.0, 1.0, 6.0, 1.0, 1.0, 6.0, 1.0, 8.0, 8.0, 1.0, 1.0, 1.0, 1.0, 6.0, 8.0, 1.0, 8.0, 1.0, 6.0, 6.0, 1.0, 1.0, 1.0, 1.0];

// ---- Other tables ----
pub static FLAT_CAPACITY: [f64; 38] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 2000.0, 10000.0, 50000.0, 0.0, 0.0, 400.0, 0.0, 0.0, 20000.0, 0.0, 100000.0, 0.0, 0.0, 5000.0, 10000.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, f64::INFINITY, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static COMPONENT_GLOBAL: [bool; 38] = [false, true, true, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false, true, false, false, false, true, false, false, false, false, false, false, false, true, true, false, false, false, false, false, false];
pub static COMPONENT_FIXED: [bool; 38] = [true, true, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false];
pub static REGION_RTT: [[f64; 4]; 4] = [[0.0, 75.0, 200.0, 120.0], [75.0, 0.0, 160.0, 190.0], [200.0, 160.0, 0.0, 300.0], [120.0, 190.0, 300.0, 0.0]];
pub static VENTURE_VALUE: [f64; 12] = [1.0, 0.55, 0.72, 0.77, 0.83, 0.74, 0.88, 0.83, 0.87, 0.44, 1.0, 1.51];
pub static VENTURE_MARKET: [f64; 12] = [1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.5, 1.0, 3.0, 1.0, 0.8];
pub static VENTURE_AMPLITUDE: [f64; 12] = [0.45, 0.45, 0.6, 0.55, 0.45, 0.1, 0.45, 0.1, 0.45, 0.05, 0.45, 0.45];
pub static VENTURE_PEAK: [f64; 12] = [20.0, 20.0, 14.0, 21.0, 21.0, 20.0, 20.0, 20.0, 14.0, 20.0, 20.0, 14.0];
pub static VENTURE_WEEKEND: [f64; 12] = [1.0, 1.15, 0.4, 1.0, 1.0, 1.0, 1.0, 1.0, 0.4, 1.0, 1.0, 0.2];
pub static VENTURE_DEADLINE: [f64; 12] = [-1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, -1.0, 100.0, -1.0, -1.0];
pub static VENTURE_STALE_FINE: [f64; 12] = [0.0, 0.0, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0];
pub static COLLECTOR_PAUSE: [f64; 3] = [30.0, 150.0, 1.0];
pub static COLLECTOR_SPEED: [f64; 3] = [1.0, 1.05, 0.9];
pub static COLLECTOR_MEMORY: [f64; 3] = [1.0, 0.95, 1.15];
pub static STORAGE_IOPS: [f64; 2] = [3000.0, 64000.0];
pub static RETENTION_SCAN_MS: [f64; 3] = [0.0, 200.0, 0.0];
pub static RETENTION_REBUILD: [f64; 3] = [1.0, 1.0, 3.0];
pub static SHARD_HOT: [f64; 4] = [0.0, 0.5, 0.3, 0.0];
pub static SHARD_CROSS: [f64; 4] = [1.0, 1.0, 0.1, 0.2];
pub static SHARD_FAR_MS: [f64; 4] = [0.0, 0.0, 0.0, 70.0];
pub static GOGC_CPU: [f64; 3] = [2.0, 1.0, 0.5];
pub static GOGC_MEMORY: [f64; 3] = [0.7, 1.0, 1.5];
pub static GOGC_VALUES: [f64; 3] = [50.0, 100.0, 200.0];
pub static CDN_TTL_VALUES: [f64; 3] = [60.0, 300.0, 3600.0];
pub static CDN_TTL_FACTOR: [f64; 3] = [0.8, 1.0, 1.2];

// ---- Research ----
pub const RESEARCH_COUNT: usize = 203;
pub static RESEARCH_IDS: [&str; 203] = ["stripe", "dns-rr", "load-balancing", "health-checks", "auth-provider", "caching", "pooling", "replication", "eager-loading", "query-analysis", "logs", "metrics", "percentiles", "alerting", "funnels", "php-fpm", "opcache", "lang-ruby", "lang-node", "lang-python", "node-cluster", "libuv-pool", "fw-laravel", "fw-rails", "fw-express", "fw-django", "fw-symfony", "fw-sinatra", "fw-flask", "keepalive", "gzip", "timeouts", "lb-algorithms", "ci", "blue-green", "canary", "code-review", "testing-culture", "full-text-search", "object-storage", "cache-strategies", "lifecycle-rules", "cdn", "waf", "api-gateway", "websockets", "background-jobs", "queues", "stampede-protection", "cache-warming", "lang-go", "lang-java", "lang-csharp", "fw-gin", "fw-spring-boot", "fw-aspnet", "tracing", "trace-search", "notebooks", "cert-automation", "lang-elixir", "lang-rust", "lang-zig", "lang-haskell", "fw-phoenix", "checkout", "tiered-caching", "multi-az", "autoscaling", "containers", "serverless", "slo-dashboards", "error-budgets", "backoff-jitter", "circuit-breakers", "load-shedding", "idempotency-keys", "ryw-routing", "gogc-tuning", "fw-axum", "fw-actix", "zgc", "data-warehouse", "event-streaming", "embeddings", "hosted-models", "model-serving", "pitr", "tls-everywhere", "http2", "sync-replication", "restore-drills", "dependency-scanning", "sharding", "encryption-at-rest", "multi-region", "geo-dns", "infra-as-code", "gitops", "anycast", "document-db", "edge-compute", "http3", "notifications", "hybrid-fanout", "leaderless", "consensus", "dr-drills", "retention", "soc2", "gdpr-residency", "security-team", "investor-relations", "guidance-modeling", "reserved-instances", "spot-instances", "php-jit", "worker-threads", "yjit", "gevent", "asgi", "php-worker-mode", "swoole", "bun", "deno", "falcon", "pypy", "virtual-threads", "webflux", "fasthttp", "spawn-blocking", "graal-native", "native-aot", "distributed-erlang", "nifs", "jemalloc", "free-threading", "fw-fastapi", "fw-fastify", "fw-nextjs", "fw-nestjs", "fw-fiber", "fw-quarkus", "fw-hono", "fw-elysia", "fw-koa", "fw-adonis", "fw-codeigniter", "fw-sanic", "fw-rocket", "fw-jetzig", "fw-tokamak", "fw-servant", "fw-ihp", "build-cache", "dev-environment", "static-analysis", "formal-verification", "service-boundaries", "cdc", "service-mesh", "feature-flags", "secrets-management", "spam-filter", "on-call", "runbooks", "sre-team", "enterprise-sales", "online-migrations", "leap-smearing", "ab-testing", "hiring-pipeline", "trunk-based", "platform-team", "data-team", "l4-lb", "rate-limiting", "esi", "bot-management", "scheduled-scaling", "arm-instances", "quantization", "continuous-batching", "bulkheads", "graceful-degradation", "hedged-requests", "chaos-engineering", "denormalization", "precompute", "binary-rpc", "outbox", "expand-contract", "profiling", "tail-sampling", "rum", "anomaly-detection", "credential-protection", "pen-testing", "rightsizing", "egress-optimization", "unit-economics", "cost-allocation", "savings-plans"];
pub fn research_index(name: &str) -> usize {
    match name {
        "stripe" => 0,
        "dns-rr" => 1,
        "load-balancing" => 2,
        "health-checks" => 3,
        "auth-provider" => 4,
        "caching" => 5,
        "pooling" => 6,
        "replication" => 7,
        "eager-loading" => 8,
        "query-analysis" => 9,
        "logs" => 10,
        "metrics" => 11,
        "percentiles" => 12,
        "alerting" => 13,
        "funnels" => 14,
        "php-fpm" => 15,
        "opcache" => 16,
        "lang-ruby" => 17,
        "lang-node" => 18,
        "lang-python" => 19,
        "node-cluster" => 20,
        "libuv-pool" => 21,
        "fw-laravel" => 22,
        "fw-rails" => 23,
        "fw-express" => 24,
        "fw-django" => 25,
        "fw-symfony" => 26,
        "fw-sinatra" => 27,
        "fw-flask" => 28,
        "keepalive" => 29,
        "gzip" => 30,
        "timeouts" => 31,
        "lb-algorithms" => 32,
        "ci" => 33,
        "blue-green" => 34,
        "canary" => 35,
        "code-review" => 36,
        "testing-culture" => 37,
        "full-text-search" => 38,
        "object-storage" => 39,
        "cache-strategies" => 40,
        "lifecycle-rules" => 41,
        "cdn" => 42,
        "waf" => 43,
        "api-gateway" => 44,
        "websockets" => 45,
        "background-jobs" => 46,
        "queues" => 47,
        "stampede-protection" => 48,
        "cache-warming" => 49,
        "lang-go" => 50,
        "lang-java" => 51,
        "lang-csharp" => 52,
        "fw-gin" => 53,
        "fw-spring-boot" => 54,
        "fw-aspnet" => 55,
        "tracing" => 56,
        "trace-search" => 57,
        "notebooks" => 58,
        "cert-automation" => 59,
        "lang-elixir" => 60,
        "lang-rust" => 61,
        "lang-zig" => 62,
        "lang-haskell" => 63,
        "fw-phoenix" => 64,
        "checkout" => 65,
        "tiered-caching" => 66,
        "multi-az" => 67,
        "autoscaling" => 68,
        "containers" => 69,
        "serverless" => 70,
        "slo-dashboards" => 71,
        "error-budgets" => 72,
        "backoff-jitter" => 73,
        "circuit-breakers" => 74,
        "load-shedding" => 75,
        "idempotency-keys" => 76,
        "ryw-routing" => 77,
        "gogc-tuning" => 78,
        "fw-axum" => 79,
        "fw-actix" => 80,
        "zgc" => 81,
        "data-warehouse" => 82,
        "event-streaming" => 83,
        "embeddings" => 84,
        "hosted-models" => 85,
        "model-serving" => 86,
        "pitr" => 87,
        "tls-everywhere" => 88,
        "http2" => 89,
        "sync-replication" => 90,
        "restore-drills" => 91,
        "dependency-scanning" => 92,
        "sharding" => 93,
        "encryption-at-rest" => 94,
        "multi-region" => 95,
        "geo-dns" => 96,
        "infra-as-code" => 97,
        "gitops" => 98,
        "anycast" => 99,
        "document-db" => 100,
        "edge-compute" => 101,
        "http3" => 102,
        "notifications" => 103,
        "hybrid-fanout" => 104,
        "leaderless" => 105,
        "consensus" => 106,
        "dr-drills" => 107,
        "retention" => 108,
        "soc2" => 109,
        "gdpr-residency" => 110,
        "security-team" => 111,
        "investor-relations" => 112,
        "guidance-modeling" => 113,
        "reserved-instances" => 114,
        "spot-instances" => 115,
        "php-jit" => 116,
        "worker-threads" => 117,
        "yjit" => 118,
        "gevent" => 119,
        "asgi" => 120,
        "php-worker-mode" => 121,
        "swoole" => 122,
        "bun" => 123,
        "deno" => 124,
        "falcon" => 125,
        "pypy" => 126,
        "virtual-threads" => 127,
        "webflux" => 128,
        "fasthttp" => 129,
        "spawn-blocking" => 130,
        "graal-native" => 131,
        "native-aot" => 132,
        "distributed-erlang" => 133,
        "nifs" => 134,
        "jemalloc" => 135,
        "free-threading" => 136,
        "fw-fastapi" => 137,
        "fw-fastify" => 138,
        "fw-nextjs" => 139,
        "fw-nestjs" => 140,
        "fw-fiber" => 141,
        "fw-quarkus" => 142,
        "fw-hono" => 143,
        "fw-elysia" => 144,
        "fw-koa" => 145,
        "fw-adonis" => 146,
        "fw-codeigniter" => 147,
        "fw-sanic" => 148,
        "fw-rocket" => 149,
        "fw-jetzig" => 150,
        "fw-tokamak" => 151,
        "fw-servant" => 152,
        "fw-ihp" => 153,
        "build-cache" => 154,
        "dev-environment" => 155,
        "static-analysis" => 156,
        "formal-verification" => 157,
        "service-boundaries" => 158,
        "cdc" => 159,
        "service-mesh" => 160,
        "feature-flags" => 161,
        "secrets-management" => 162,
        "spam-filter" => 163,
        "on-call" => 164,
        "runbooks" => 165,
        "sre-team" => 166,
        "enterprise-sales" => 167,
        "online-migrations" => 168,
        "leap-smearing" => 169,
        "ab-testing" => 170,
        "hiring-pipeline" => 171,
        "trunk-based" => 172,
        "platform-team" => 173,
        "data-team" => 174,
        "l4-lb" => 175,
        "rate-limiting" => 176,
        "esi" => 177,
        "bot-management" => 178,
        "scheduled-scaling" => 179,
        "arm-instances" => 180,
        "quantization" => 181,
        "continuous-batching" => 182,
        "bulkheads" => 183,
        "graceful-degradation" => 184,
        "hedged-requests" => 185,
        "chaos-engineering" => 186,
        "denormalization" => 187,
        "precompute" => 188,
        "binary-rpc" => 189,
        "outbox" => 190,
        "expand-contract" => 191,
        "profiling" => 192,
        "tail-sampling" => 193,
        "rum" => 194,
        "anomaly-detection" => 195,
        "credential-protection" => 196,
        "pen-testing" => 197,
        "rightsizing" => 198,
        "egress-optimization" => 199,
        "unit-economics" => 200,
        "cost-allocation" => 201,
        "savings-plans" => 202,
        _ => 203,
    }
}
pub const FEATURE_COUNT: usize = 29;
pub static FEATURE_IDS: [&str; 29] = ["landing-page", "signup-flow", "pagination", "password-login", "paid-plans", "email-digests", "search-filters", "profile-photos", "public-api", "infinite-scroll", "video", "chat", "checkout", "notifications-center", "mobile-app", "data-export", "dashboards", "ai-assistant", "recommendations", "audit-log", "activity-feed", "webhooks", "push-notifications", "localization", "offline-mode", "single-sign-on", "data-residency", "status-page", "usage-pricing"];
pub fn feature_index(name: &str) -> usize {
    match name {
        "landing-page" => 0,
        "signup-flow" => 1,
        "pagination" => 2,
        "password-login" => 3,
        "paid-plans" => 4,
        "email-digests" => 5,
        "search-filters" => 6,
        "profile-photos" => 7,
        "public-api" => 8,
        "infinite-scroll" => 9,
        "video" => 10,
        "chat" => 11,
        "checkout" => 12,
        "notifications-center" => 13,
        "mobile-app" => 14,
        "data-export" => 15,
        "dashboards" => 16,
        "ai-assistant" => 17,
        "recommendations" => 18,
        "audit-log" => 19,
        "activity-feed" => 20,
        "webhooks" => 21,
        "push-notifications" => 22,
        "localization" => 23,
        "offline-mode" => 24,
        "single-sign-on" => 25,
        "data-residency" => 26,
        "status-page" => 27,
        "usage-pricing" => 28,
        _ => 29,
    }
}

// ---- derived masks ----
pub static AUTHENTICATED_KINDS_MASK: [u8; NR] = [0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0];
pub static CPU_HEAVY_MASK: [u8; NK] = [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
pub static DATA_KINDS_MASK: u64 = 0x8b760000;
pub static QUERY_CPU_BY_BACKEND: [f64; NB] = [8.0, 25.0, -1.0, 80.0, -1.0, 60.0, -1.0, 30.0, 40.0, -1.0, 100.0, -1.0, -1.0, -1.0, -1.0, -1.0];
pub static FEATURE_PAYLOAD: [[f64; NK]; 29] = [
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
];

pub static FEATURE_QUERY: [[f64; NK]; 29] = [
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
    [0.0; NK],
];
