# Query optimisation evidence

## Stage 1

`block-query-benchmark.sql` creates a **disposable database named benchmark** and one million synthetic blocks. Run only on an isolated test MariaDB instance. The payload approximates wide block rows; it does not model production summary JSON sizes or concurrent clients. Retain a separate baseline before running against other data.

On local MariaDB 10.11.19, single warm executions measured:

- Canonical `COUNT(height)`: 377 ms; `COUNT(*)`: 106 ms.
- Pool listing with separate indexes: 1,406 ms. Adding composite indexes alone still produced index intersection and sorting (1,413 ms), including after `ANALYZE TABLE`.
- Summary tip via `MAX` join: 1,362 ms; ordered, height-index-first join: 0.31 ms.
- Building both indexes: 1.39 seconds on this synthetic table.

The pool listing therefore explicitly selects `pool_stale_height`. A separate forced-index execution measured 0.74 ms. Its plan uses equality on pool and stale status, then index order for the limit. This is a targeted hint, not a global optimizer setting.

These are single-run synthetic measurements, not production latency guarantees. Production plans must be read back after the additive migration. Concurrent requests, cold startup, index storage growth, and application peak memory still require deployment-scale validation.

The integration harness previously referenced a missing config filename, used credentials inconsistent with its Compose database, loaded an ESM RPC dependency under CommonJS Jest, and inserted removed Bitcoin-specific columns. The test-only repairs allow actual BCH schema tests to execute without mocking database operations.
