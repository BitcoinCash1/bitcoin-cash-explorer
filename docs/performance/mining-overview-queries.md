# Mining overview query follow-up

## Evidence and scope

The 4 November 2026 production baseline contained 28 monthly overview executions above one second in one hour: 66.425 seconds total, maximum 2.597 seconds, approximately 981,000 rows examined per execution. Four historical maintenance queries occurred once each, taking approximately 7.24 seconds together. This change targets the recurring overview; it preserves hourly recovery/reconciliation.

The overview now uses the existing timestamp index for 24h/3d/1w/1m, joins audits by block hash, and fixes fee-ratio decimal precision before aggregation. Production had three canonical-block/audit joins with mismatched hashes under the old height join. Therefore audit metrics may intentionally change. Explicit decimal precision also corrects plan-dependent rounding. No schema migration is required.

Short-range overviews reuse the generation-based pool cache with a 120-second TTL, per-worker in-flight sharing, and Valkey sharing between workers. There is no distributed miss lock. Long-range cache TTLs remain unchanged; their keys are versioned to exclude old audit/fallback results. RPC fallback responses are neither persisted nor HTTP-cacheable. Successful metadata/audit-summary mutations invalidate short-range statistics along with existing block/canonical-chain invalidations.

## Production read-only benchmark

MariaDB 10.11.14, mainnet, 4 November 2026, about 19:56 CET. Three repetitions for short intervals, alternating baseline/optimized ordering. These are SQL client wall times; they are not endpoint latency or cold-disk measurements. Other production work continued. The optimized SQL includes the index hint, hash join and decimal cast together.

| Interval | Baseline median ms | Optimized median ms | Baseline rows read | Optimized rows read |
|---|---:|---:|---:|---:|
| 24h | 1.30 | 1.26 | 361 | 361 |
| 3d | 3.53 | 3.45 | 1,197 | 1,197 |
| 1w | 6.71 | 6.18 | 2,851 | 2,851 |
| 1m | 2,383.41 | 28.88 | 980,599 | 12,733 |

Monthly results contained 40 pools. The monthly improvement is about 82.5x. `Rows_read` is the session storage-row counter, not slow-log `Rows_examined`; do not compare them directly. The timestamp plan accesses about 4,452 blocks plus joined rows.

Long-range single-run checks (baseline/optimized ms): 3m 2433/2408; 6m 2470/2412; 1y 2484/2517; 2y 2566/2673; 3y 2771/2968; 4y 2660/2860; all 3122/3764. The unhinted long-range queries remain expensive, and this sample shows higher cost for several ranges after correctness changes. These are not claimed as performance improvements. They retain their existing caches (except 3m, which was already uncached); further long-range work requires frequency/endpoint evidence.

Historical single-run observations:

| Query | ms | Rows read | Rows returned |
|---|---:|---:|---:|
| Chain validation | 1,756 | 975,988 | 975,988 |
| Difficulty history | 1,638 | 975,988 | 975,946 |
| Missing summaries | 1,956 | 1,951,892 | 0 |
| Missing prices | 1,919 | 1,961,219 | 0 |

Large history transfers remain visible, but no evidence currently justifies weakening full reconciliation. Existing logger output now adds monotonic stage timings for block-database generation, difficulty adjustments, missing summaries, and asynchronous price indexing. Completed means the stage returned; existing internal error handling is unchanged. Price-stage `rows` counts saved heights, not scanned rows. Existing summary logs report indexed counts.

## Measurement method

The one-off benchmark script is retained outside the repository with local server reports; it is not part of the application.

Measurements used explicit database configuration, read-only transactions and a 15-second statement limit. They recorded EXPLAIN plans, client duration, session rows read and rows returned, without credentials or result payloads. Historical checks fetched full chain/difficulty results. Reads can still consume resources and appear in the server slow log. Rows returned for missing-summary/price queries indicate work found; chain/difficulty row counts do not imply new work.

Do not run integration tests against production: they create and truncate test data. Run them against a disposable local database.

After deployment, confirm the running revision and compare direct endpoint cold/cache-hit timings, slow-query totals and at least two hourly maintenance cycles. Separate restart/backfill from browsing and normal hourly work. Database benchmark results alone do not establish endpoint latency or RPC performance.

## Local validation

- Backend unit suite with coverage: 16 suites, 125 tests passed.
- MariaDB 10.11 disposable integration database: 8 suites, 50 tests passed.
- Backend build/type checking and source formatting passed.
- Repository-wide ESLint remains failing with 46 errors. Rechecking the same error-bearing files from `origin/main` produces the same 46 errors; no new error-bearing files were introduced. Backend lint is currently commented out in CI. Existing warnings are not treated as a clean lint run.
- The external one-off benchmark was smoke-tested against the disposable database, including all four historical queries.
- No production application/configuration changes or deployment performed. No end-user browser latency claim is made.
