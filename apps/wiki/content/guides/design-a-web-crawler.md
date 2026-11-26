---
title: Design a web crawler
seoTitle: Design a web crawler: system design interview guide
summary: Design a web crawler for a system design interview: URL frontier, deduplication, politeness, freshness, and sharding the crawl, and what Quorum teaches.
section: guides
order: 30
aliases: web crawler, crawler, spider, url frontier, deduplication, politeness, robots.txt, search engine, system design primer, system design interview
---

A web crawler is a loop around a queue of URLs. Workers pull a URL from a frontier, fetch the page, store it, extract its links, drop the ones already seen, and push the rest back onto the frontier. The hard parts are not the fetch. They are deduplication, politeness toward each site, and keeping a billion pages fresh.

This is one of the questions in the [System Design Primer](https://github.com/donnemartin/system-design-primer), and its [solution for the web crawler](https://github.com/donnemartin/system-design-primer/blob/master/solutions/system_design/web_crawler/README.md) is worth reading next to this page.

## Requirements

Functional:

- Start from seed URLs and follow links across the web.
- Store each page, and hand it on to indexing so a search can find it.
- Re-crawl pages on a schedule, and more often for pages that change.
- Never loop forever on a link cycle or a calendar page with endless "next month" links.

Non-functional:

- Polite: obey robots.txt and never hammer one host.
- Scales out by adding machines.
- Tolerates dead hosts, slow hosts and malformed HTML.

Search ranking and personalization are out of scope. The crawler feeds them.

## Estimate the load

Assume 1 billion known pages, each refreshed about once a week, at 500 KB a page.

- Fetch rate: 1,000,000,000 pages every 7 days is about 1,650 pages a second. Call it 2,000 to leave headroom.
- Storage: 1,000,000,000 x 500 KB is 500 TB for one full copy. Keeping history of changed pages pushes it toward petabytes.
- Bandwidth: 2,000 pages a second x 500 KB is about 1 GB a second inbound, around 8 Gbit/s.
- Workers: if a fetch takes 500 ms, 2,000 a second needs about 1,000 fetches in flight, so a few dozen machines with many connections each.

Fetching is bandwidth and storage work, not CPU work.

## The design

### The URL frontier

The frontier holds URLs waiting to be crawled. A plain FIFO [Queue](/components/queue) crawls the same busy host all at once, so real frontiers have two layers. A priority layer ranks URLs by importance and expected change rate. A politeness layer keeps one queue per host and releases one URL per host every few seconds. Redis sorted sets or Kafka partitions keyed by host both work.

### Fetchers

A pool of [Workers](/components/worker) pulls URLs from the frontier. Each does a DNS lookup, checks the host's robots.txt (cached for a day), fetches with a timeout, and writes the raw page out. Because many Workers draw from one Queue, you scale by adding Workers. See [competing consumers](/patterns/competing-consumers).

### Deduplication

Two checks. For URLs, normalize first (lowercase the host, strip fragments, sort query parameters), then test a hash of the result against a seen set, with a Bloom filter in front so most checks skip the disk. For content, store a hash such as SimHash of each page, so two mirrors of the same article count once. This is what stops cycles and spider traps. A per-site depth and URL count cap catches the traps hashes miss.

### Storage and the index handoff

Raw pages go to [Object Storage](/components/storage) like S3, and metadata (URL, hash, last crawl time, next crawl time) goes to a key-value or wide-column store. Each stored page enqueues a job for the indexer and for the snippet builder, so crawling and indexing run at their own speeds. Old versions age into cheaper classes with [lifecycle rules](/patterns/object-storage-and-lifecycle-rules).

### Freshness

Keep a next-crawl time per URL. A page that changed on three of the last three visits gets a shorter interval, and one that never changes gets a longer one. Sitemaps and `Last-Modified` headers save fetches.

## Where it breaks

**A backlog nobody sees.** Fetchers slow down on a bad stretch of the web and the frontier grows without bound. Cap the queue and refuse or defer low-priority URLs, as in [backpressure](/patterns/backpressure).

**One host takes the whole crawl.** A site with millions of generated links fills the frontier. Per-host queues and per-host caps keep it to its share, which is the same idea as [rate limiting](/patterns/rate-limiting) applied to an outsider's server.

**Retries on dead hosts.** Retrying a failing host at once wastes the fetch budget. Use [retry with backoff](/patterns/retry-with-backoff) and put repeat offenders on a slow lane.

**Storage cost.** Old pages are rarely read and the bill grows monthly, so tier them down.

## Build it in Quorum

The game models the queue-and-workers core well. This board shows fetchers as several [Workers](/components/worker) draining one [Queue](/components/queue), the frontier-to-fetcher part of the answer:

::Design{id="competing-workers"}

Look at how the Queue offers work to each Worker, and what a crash does to the tasks a Worker had in flight. That is the real tradeoff of concurrency in a fetch fleet.

The next board shows the frontier with a limit. It uses a Queue with a maximum length and a Worker slower than the arrivals:

::Design{id="queue-bounded"}

Read the refusals: past the limit the Queue turns work away, and with no limit the depth just grows. That is the backlog problem above.

The last board shows the storage tail, with [Object Storage](/components/storage) and a lifecycle window:

::Design{id="lifecycle-storage"}

It shows that a request for an archived object cannot be answered at once, which is why a crawler's rarely read old pages can sit in cold storage.

Unlock the pieces with [Background jobs](/research/background-jobs), [Message queues](/research/queues) and [Object storage](/research/object-storage). [Capacity, utilization, and queues](/explanation/queues) explains why waiting grows with load.

The game has no URLs, no link graph, no robots.txt, no hosts to be polite to, and no deduplication. The Queue is one flat line of tasks, not a frontier with priorities. Politeness and dedup you learn from this page.

## Common questions

### How does a web crawler avoid crawling the same page twice?

It normalizes each URL and checks a hash of it against a seen set, usually with a Bloom filter in front. For mirrored content under different URLs, it also compares a content fingerprint.

### What is a URL frontier?

It is the queue of URLs waiting to be fetched, split into priority tiers and per-host queues. The tiers decide what to crawl first, and the per-host queues keep any one site from being hit too fast.

### How do you make a crawler polite?

Read each site's robots.txt, keep one queue per host, and space requests to that host by a few seconds. Back off when the host answers slowly or with errors.

### Where does the System Design Primer's crawler fit in?

The Primer scopes the problem to a crawler that feeds a reverse index and a snippet service, with a ranked link table and a table of page signatures. This page follows the same shape and adds the frontier, politeness and storage tiering.
