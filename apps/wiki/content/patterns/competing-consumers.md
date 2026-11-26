---
title: Competing consumers
summary: Let several workers read from one queue, so each task goes to exactly one of them and throughput grows by adding workers.
section: patterns
group: Messaging and async
order: 402
aliases: worker pool, parallel consumers, consumer group, concurrency, work queue, scale workers
---

Competing consumers are several workers pulling from the same queue, so the work is shared and each task goes to one worker.

## Use it when

- One worker cannot drain the queue, and queue depth keeps climbing.
- Tasks are independent, so any worker can take any task.
- You want to add capacity by adding workers, not by rewriting the producer.

## How it works

The broker hands each task to one ready consumer and waits for an acknowledgement. If a consumer dies before it acks, the broker gives the task to another, which is why delivery is at least once. If one worker handles 20 tasks a second and 100 arrive, five workers keep up.

Concurrency is how many tasks one worker runs at once. A high value overlaps waits and keeps a worker busy on I/O-bound jobs. A low value protects a CPU or a downstream service, and leaves less work stuck on a worker that crashes.

## What it costs

Order is gone: two tasks for the same user can run at once or out of order. Fix that by partitioning on a key, so one entity always goes to one consumer. Workers that share a database also share its connection limit, so more workers can move the bottleneck, not remove it.

## In Quorum

::Design{id="competing-workers"}

Both [Workers](/components/worker) link to the same [Queue](/components/queue), which offers each of them what arrives. Concurrency is the setting on a Worker. A crash loses every task in flight, and a planned restart hands them back first. A [Connection Pooler](/components/pooler) protects the Database when Workers multiply.

Add copies with an [Autoscaler](/components/autoscaler) on queue depth. Research [Background jobs](/research/background-jobs) and [Message queues](/research/queues). The glossary defines [at-least-once delivery](/glossary/at-least-once-delivery).
