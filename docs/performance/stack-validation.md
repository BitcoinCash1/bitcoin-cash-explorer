# Local validation of the three-MR stack

Runtime source: `a01e51a58` (includes the covering-index fix discovered during this run).
Baseline: `e8c6f0070` (3.15.0, before the stack).
Machine-readable measurements: [stack-results.json](stack-results.json).

## Environment and method

- Node 24.15.0; AMD Ryzen Threadripper 7960X, 48 logical CPUs; local NVMe storage.
- Dedicated MariaDB 10.11.19 container: **512 MiB buffer pool**, **4 GiB container limit**. Node workers use a 4 GiB heap ceiling and the same ten-connection database pool for both versions.
- Real application migrations and the same million-block fixture: 43%, 56%, and 1% pool shares; production-style wide block columns; approximately 2 KiB of JSON per summary. All summaries/prices/hashrate history initially indexed. This reproduces the expensive no-work reconciliation path seen in the slow log.
- Real Express mining routes, mysql2 connections, and Valkey 9.0.6 through a Unix socket. Only BCHN is replaced: a local deterministic JSON-RPC server supplies the tip, genesis data and network-hashrate response. External price-feed fetching, replication, Goggles rollups and block auditing are disabled.
- Baseline measurements ran before adding the stack's indexes. Each HTTP scenario used 5 requests at concurrency 1, 24 at concurrency 8, and 64 at concurrency 32; Valkey was cleared before each scenario, so statistics timings include the first cache fill. No reverse proxy/browser cache was involved.
- Cold means restarting the fixture database without buffer-pool restore, then running startup indexing with eight concurrent clients making 16 pool-statistics requests. The host OS page cache was not cleared.
- Timings are one workload sample per scenario, not repeated statistical trials or production predictions. The 512 MiB buffer pool is deliberately smaller than production's observed 8 GiB. The fixture's latest block precedes wall time by about 5.6 days; a separate fixed-clock replay verifies nonempty 24-hour/week results.

## HTTP and indexing results

| Check | Original | Complete stack |
| --- | ---: | ---: |
| Pool-statistics p95, concurrency 32 | 37,080 ms | 1,888 ms |
| Latest pool-blocks p95, concurrency 32 | 11,789 ms | 46.7 ms |
| Historical pagination p95, concurrency 32 | 69.8 ms | 48.9 ms |
| Pool-statistics SQL calls, 64 requests | 576 | 68 |
| Pool-statistics server `Rows_read`, 64 requests | 119,070,528 | 1,430,301 |
| Latest-blocks server `Rows_read`, 64 requests | 27,526,528 | 6,528 |
| Startup indexing, otherwise idle | 21.85 s | 11.95 s |
| Subsequent hourly indexing cycle | 15.27 s | 11.67 s |
| Startup indexing under cold/concurrent traffic | 27.18 s | 11.77 s |
| Pool-statistics p95 during cold startup | 8.35 s | 2.59 s |
| Missing-summary reconciliation | 2.73 s | 1.64 s |
| Difficulty + daily/weekly history checks | 7.37 s | 1.86 s |
| Full price reconciliation | 2.09 s | 1.90 s |
| Repair one queued price height | 2.44 s (full scan) | 4.1 ms |

`Rows_read` and database `Bytes_sent` are isolated-server counter deltas, not slow-log `Rows_examined`. Query counts include pool metadata lookups. The 68 statistics queries comprise 64 metadata lookups and one shared four-query calculation. Substantially faster warm hits do not remove the approximately two-second first calculation under this constrained fixture.

All measured indexing stages completed without application error logs. Full chain validation is retained and exercised. The startup and hourly cycles were invoked through the real indexer, with an empty synced mempool; seeded price reconciliation was invoked explicitly instead of fetching exchange feeds. These are indexing-cycle measurements, not full-process boot or live BCHN ingestion benchmarks.

## Memory and data transfer

| Isolated stage | Original peak RSS | Stack peak RSS | Original DB bytes sent | Stack DB bytes sent |
| --- | ---: | ---: | ---: | ---: |
| Summary reconciliation | 638 MiB | 127 MiB | 146,889,726 | 722 |
| Difficulty/history checks | 352 MiB | 300 MiB | 101,802,427 | 34,024,136 |
| Indexer worker, startup plus hourly | 760 MiB | 696 MiB | — | — |
| Startup cycle transfer | — | — | 413,480,062 | 198,812,295 |
| Hourly cycle transfer | — | — | 345,566,794 | 198,677,791 |

Peak RSS is the operating system's process high-water mark; the shared indexer worker's high-water mark covers both cycles. Summary/history stages each used a fresh worker. Query instrumentation records counts and timings, not retained result arrays.

Full validation still dominates overall peak memory. Startup sampled peak V8 heap did **not** decrease (approximately 484 to 490 MiB); this work removes redundant history transfers rather than redesigning the chain-validation object graph.

A 10,000-request soak at concurrency 32 passed complete-response assertions. Post-GC retained heap was **30.74 MiB** after the first batch and **29.96 MiB** after the last. The explicit acceptance gate was less than 16 MiB growth after warm-up; there was no increasing retained-heap trend in this run. This is bounded leak evidence, not a long-duration guarantee.

## Regression discovered and fixed

The first version of missing-summary reconciliation reduced transfer but took **10.15 s**, compared with the original 2.73 s. MariaDB read clustered summary records to check `version`, touching the wide JSON table. Adding an index alone still selected the primary key.

MR 3 therefore now includes **migration 111**, a retry-safe `blocks_summaries(id, version)` covering index, and a query hint selecting it. The resulting reconciliation took 1.64 s with a 127 MiB RSS high-water mark. Integration tests cover creation, interrupted-migration recovery, missing/outdated/stale summaries, range bounds and pagination beyond 1,000 rows.

Local migration costs, including worker initialisation:

- Two block indexes: **4.59 s**, index allocation +**166,494,208 bytes** (159 MiB).
- Summary covering index: **3.22 s**, index allocation +**80,609,280 bytes** (77 MiB).
- Combined additional index allocation: **247,103,488 bytes** (236 MiB) on this fixture. No existing indexes were removed.

Production index-build time, metadata-lock wait and disk headroom still require operational checks when deployment is scheduled. These do not require deploying an MR for local review readiness.

## Correctness and failure checks

- Complete JSON responses match the original implementation for seven routes: pool statistics and latest blocks for all three pools, plus historical pagination for the 43% pool. Replay uses the same SQL `NOW()` in both versions; the large pool has 58 blocks in 24 hours and 517 in a week at that clock.
- Two real backend workers observe cross-worker canonical/reorg and pool-reassignment invalidation.
- Invalidating the generation while real SQL is pending triggers one recomputation; an obsolete result does not populate the active generation.
- Real Valkey TTL expiry after 30 seconds recomputes aggregates; warm hits issue only the metadata query.
- Stopping the fixture Valkey container preserves HTTP availability and fresh counts after repository mutations. After restart, the application reconnects and cache hits again avoid aggregate SQL.
- With Valkey disabled, eight concurrent requests share one calculation.
- **83 unit tests** pass. **38 integration tests** pass on MariaDB **10.5.21** and **11.8.9**. Mainnet fixture migration/reconciliation also ran on 10.11.19. Targeted migration/query suites pass **17 tests each** with testnet4 and chipnet configurations.
- TypeScript build, resource generation and source formatting passed. The six previously reported lint errors in legacy code remain unchanged; no new lint error was introduced by the covering-index change.

## Reproduction and boundaries

Install the repository's existing backend dependencies/native binding first. Then, from the repository, run:

```sh
backend/scripts/performance/run-stack-benchmark.sh
```

The runner requires local ports 33417/33418, Docker, Node and Git. It refuses to reuse its named containers, uses a detached baseline worktree, creates only the disposable `explorer_perf` database, and retains JSON/logs under its printed temporary output directory. The helpers reject non-fixture database/RPC endpoints and a Valkey socket outside the adjacent fixture directory. Cleanup removes only its own containers/volumes and baseline worktree. Allow several minutes and several GiB of local storage.

The component commands in that runner were exercised during this validation; the final assembled wrapper received shell/syntax checks. Raw outputs for this run were retained locally at `/tmp/explorer-stack-performance`; the compact checked-in JSON is the review artifact.

**Local review-readiness checks pass.** CI is left to run independently. No production access, migration, deployment or merge occurred during this validation. Live traffic, genuine BCHN reorg/ingestion load, external feeds, browser rendering and production index-build behaviour remain outside this local evidence.
