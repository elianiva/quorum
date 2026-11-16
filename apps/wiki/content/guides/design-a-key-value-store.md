---
title: Design a key-value store like Redis or Dynamo
seoTitle: Design a key-value store like Redis or Dynamo
summary: Design a distributed key-value store like Redis or Dynamo: partition with consistent hashing, replicate, and tune quorum reads and writes.
section: guides
order: 22
aliases: system design primer, key value store, distributed key value store, dynamo, dynamodb, cassandra, nosql, consistent hashing, quorum, system design interview
---

A distributed key-value store splits keys across many machines with consistent hashing, copies each key to N replicas, and uses quorums so reads and writes survive a dead node. Choose W and R per request: with R + W greater than N a read sees the latest write, and with smaller values you trade freshness for speed. This is the shape of Amazon's Dynamo, DynamoDB and Cassandra.

This question is in the [System Design Primer](https://github.com/donnemartin/system-design-primer)'s [list of additional questions](https://github.com/donnemartin/system-design-primer#additional-system-design-interview-questions).

## Requirements

Functional:

- `put(key, value)` and `get(key)`, with values up to a few hundred KB.
- Optional delete and TTL.

Non-functional:

- Single-digit millisecond reads and writes at the 99th percentile.
- Highly available for writes: a node failure must not stop the store.
- Scales horizontally by adding machines, with little data movement.
- Eventually consistent by default, with stronger reads when a caller asks.

## Estimate the load

Assume 1 billion keys, 1 KB per value, 100,000 requests per second with 4 reads for every write.

- Raw data: 1,000,000,000 x 1 KB is 1 TB. With N of 3 that is 3 TB on disk.
- Machines: at 1 TB per node, 3 TB is 3 nodes by capacity. By throughput, if a node serves 10,000 operations per second, 100,000 / 10,000 is 10 nodes before replication cost.
- Write cost: 20,000 writes per second x 3 replicas is 60,000 replica writes per second. Reads at R of 2 cost 80,000 x 2, or 160,000 replica reads.

So throughput, not storage, sets the cluster size. Plan about 25 nodes with headroom.

## The design

### Partitioning

Hash each key onto a ring and give it to the next node clockwise. Adding a node moves only its neighbour's slice, where `hash(key) % n` would remap almost everything. Each machine takes many virtual nodes so slices even out. See [consistent hashing](/patterns/consistent-hashing) and [sharding](/patterns/sharding).

### Replication

Store each key on the next N distinct nodes around the ring, usually N of 3, ideally in different zones. Any node can coordinate a request, so there is no leader to lose. See [replication strategies](/patterns/replication-strategies).

### Quorum reads and writes

A write succeeds when W replicas acknowledge it, and a read asks R replicas and returns the newest version.

| N, W, R | Behavior                                       |
| ------- | ---------------------------------------------- |
| 3, 2, 2 | Read sees latest write, survives one node down |
| 3, 1, 1 | Fastest, a read can be stale                   |
| 3, 3, 1 | Fast reads, but one dead node blocks writes    |

Making this tunable per request is what DynamoDB's strongly consistent read flag and Cassandra's consistency levels do. Details are in [quorum reads and writes](/patterns/quorum-reads-and-writes).

### Conflicts and repair

Concurrent writes to one key need a rule: last write wins by timestamp, or vector clocks that keep both versions. Replicas that missed a write catch up through read repair and background anti-entropy. A node that is briefly down gets hinted handoff.

## Where it breaks

**One key is hot.** A popular key lives on N nodes, so more nodes do not help. Cache it in front, split it into several sub-keys, or spread reads over all replicas. See [hot keys and hot shards](/patterns/hot-keys-and-hot-shards) and the [Hot key](/incidents/hot-key) incident.

**A partition splits the ring.** With W and R of 1 both sides accept writes and diverge. A quorum of 2 stops the minority side. This is the CAP choice: [CAP and PACELC](/patterns/cap-and-pacelc) lays it out, and the [Network partition](/incidents/partition) incident shows it in play.

**Stale reads surprise users.** A user writes and reads back an old value. Route that user to the replica that took the write, or raise R. See [read-your-writes](/patterns/read-your-writes) and [consistency models](/patterns/consistency-models).

## Build it in Quorum

Research [Leaderless replication](/research/leaderless) and place a [Wide-column Store](/components/wide), the game's Cassandra. Its card takes N, R and W, so set R + W above N and then below it, and watch stale reads appear and the cost per request change.

The first board is the quorum answer. One App Server talks to a Wide-column Store with three replicas per key and a read and write quorum of two, so R + W is above N. Look at how the store's capacity is spent, because a write costs N replica operations and a read costs R, which is why the cluster size follows throughput and not storage. It uses an [App Server](/components/server) and a [Wide-column Store](/components/wide), and the pattern is [quorum reads and writes](/patterns/quorum-reads-and-writes).

::Design{id="wide-column-quorum"}

The second board adds the rest of a real data tier. An [API Gateway](/components/gw) sends lookups to the App Server that talks to the quorum store, and sends searches and uploads, which a key-value store cannot answer, to a second App Server and a [Database](/components/database). One caller reads one Data Group, so each store gets its own App Server. Look at which requests go to which store. It shows the interview point that a key-value store only does lookups by key, and the Database covers everything else. [Distributed SQL and leaderless stores](/patterns/distributed-sql-and-leaderless-stores) puts the two kinds side by side.

::Design{id="quorum-store"}

The third board is partitioning. One Database is given four shards on a hash key, so keys spread evenly and no shard runs hot, which is the point of hashing a key onto a ring. Look at the load on each shard. It uses a [Database](/components/database) and not a store, and it hashes keys into fixed shards, which is simpler than a ring with virtual nodes. See [sharding](/patterns/sharding) and [consistent hashing](/patterns/consistent-hashing).

::Design{id="sharded-hash-key"}

The [Hot key](/sandboxes/hot-key) Sandbox shows one key overloading its replicas.

The game covers replication and quorum settings, plus placement of keys on replicas. It does not model conflict resolution, hinted handoff or read repair, so those stay interview theory. It also does not let you add a node and watch a ring rebalance.

## Common questions

### What is the difference between a key-value store and a database?

A key-value store only looks up by key, which lets it shard and replicate simply and answer in milliseconds. A relational database adds joins, secondary indexes and transactions, and pays for them in scalability.

### How does consistent hashing work in a key-value store?

Nodes and keys are hashed onto the same ring, and each key belongs to the next node clockwise. When a node joins or leaves, only the keys next to it move, about 1/n of the data.

### What does R + W > N mean?

It means every read set overlaps every write set in at least one replica, so a read reaches a node holding the latest acknowledged write. It improves freshness but is not full linearizability.

### Should a key-value store be consistent or available?

For most use cases, available: shopping carts and sessions tolerate a stale read. For balances and inventory, ask for quorum reads or use a consensus store instead.
