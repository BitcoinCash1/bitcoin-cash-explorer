#!/usr/bin/env node
// Explicit configuration only. Never prints credentials or returned business data.
import fs from 'node:fs';
import mysql from 'mysql2/promise';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    intervals: { type: 'string', default: '24h,3d,1w,1m' },
    repeats: { type: 'string', default: '3' },
    history: { type: 'boolean', default: false },
  },
});
const intervals = {
  '24h': '1 DAY',
  '3d': '3 DAY',
  '1w': '1 WEEK',
  '1m': '1 MONTH',
  '3m': '3 MONTH',
  '6m': '6 MONTH',
  '1y': '1 YEAR',
  '2y': '2 YEAR',
  '3y': '3 YEAR',
  '4y': '4 YEAR',
  all: null,
};
const selected = values.intervals.split(',');
const repeats = Number(values.repeats);
if (
  !values.config ||
  selected.some((key) => !Object.hasOwn(intervals, key)) ||
  !Number.isInteger(repeats) ||
  repeats < 1 ||
  repeats > 10
) {
  throw new Error(
    'Usage: node scripts/benchmark-mining-queries.mjs --config FILE [--intervals 24h,3d,1w,1m] [--repeats 1..10] [--history]'
  );
}
function overview(interval, optimized) {
  const expression =
    '(CAST(blocks.fees AS SIGNED) - CAST(blocks_audits.expected_fees AS SIGNED)) / NULLIF(CAST(blocks_audits.expected_fees AS SIGNED), 0)';
  const hint = optimized && ['24h', '3d', '1w', '1m'].includes(interval) ? 'FORCE INDEX (blockTimestamp)' : '';
  return `SELECT COUNT(blocks.height) AS blockCount, pool_id AS poolId, pools.name AS name,
    pools.link AS link, slug, AVG(blocks_audits.match_rate) AS avgMatchRate,
    AVG(${optimized ? `CAST(${expression} AS DECIMAL(30,12))` : expression}) AS avgFeeDelta,
    unique_id AS poolUniqueId FROM blocks ${hint}
    JOIN pools ON pools.id = pool_id
    LEFT JOIN blocks_audits ON blocks_audits.${optimized ? 'hash' : 'height'} = blocks.${optimized ? 'hash' : 'height'}
    WHERE blocks.stale = 0 ${intervals[interval] ? `AND blocks.blockTimestamp BETWEEN DATE_SUB(NOW(), INTERVAL ${intervals[interval]}) AND NOW()` : ''}
    GROUP BY pool_id ORDER BY COUNT(blocks.height) DESC`;
}
async function main() {
  const c = JSON.parse(fs.readFileSync(values.config, 'utf8')).DATABASE;
  const db = await mysql.createConnection({
    host: c.HOST,
    port: c.PORT,
    socketPath: c.SOCKET || undefined,
    user: c.USERNAME,
    password: c.PASSWORD,
    database: c.DATABASE,
  });
  try {
    // Server-side limits and read-only transactions also protect use against production.
    await db.query('SET SESSION max_statement_time=15');
    const [[meta]] = await db.query('SELECT VERSION() AS version, DATABASE() AS db, NOW() AS captured_at');
    console.log(JSON.stringify({ metadata: meta, repeats, first_sample: 'initial; subsequent samples warmed' }));
    async function measure(name, sql) {
      await db.query('START TRANSACTION READ ONLY');
      try {
        const [[plan]] = await db.query('EXPLAIN FORMAT=JSON ' + sql);
        const [[before]] = await db.query("SHOW SESSION STATUS LIKE 'Rows_read'");
        const start = performance.now();
        const [rows] = await db.query(sql);
        const elapsed = performance.now() - start;
        const [[after]] = await db.query("SHOW SESSION STATUS LIKE 'Rows_read'");
        console.log(
          JSON.stringify({
            name,
            elapsed_ms: elapsed,
            rows_returned: rows.length,
            rows_read: Number(after.Value) - Number(before.Value),
            plan: JSON.parse(plan.EXPLAIN),
          })
        );
      } finally {
        await db.rollback();
      }
    }
    for (const interval of selected) {
      for (let i = 0; i < repeats; i++) {
        // Alternate order to reduce systematic warm-cache bias.
        for (const optimized of i % 2 ? [true, false] : [false, true]) {
          await measure(
            `overview:${interval}:${optimized ? 'optimized' : 'baseline'}:${i + 1}`,
            overview(interval, optimized)
          );
        }
      }
    }
    if (values.history) {
      const [[{ tip }]] = await db.query('SELECT MAX(height) AS tip FROM blocks WHERE stale=0');
      const history = {
        chain:
          'SELECT height, hash, previous_block_hash, UNIX_TIMESTAMP(blockTimestamp) AS timestamp, stale FROM blocks ORDER BY height DESC',
        difficulty:
          'SELECT UNIX_TIMESTAMP(blockTimestamp) AS time, height, difficulty, bits FROM blocks WHERE stale=0 ORDER BY height ASC',
        missing_summaries: `SELECT b.height,b.hash,b.stale FROM blocks b LEFT JOIN blocks_summaries bs FORCE INDEX(id_version) ON bs.id=b.hash AND bs.version>=1 WHERE b.stale=0 AND b.height BETWEEN 0 AND ${Number(tip) || 0} AND bs.id IS NULL ORDER BY b.height DESC,b.hash DESC LIMIT 1000`,
        missing_prices:
          'SELECT UNIX_TIMESTAMP(blocks.blockTimestamp) AS timestamp,blocks.height FROM blocks LEFT JOIN blocks_prices ON blocks.height=blocks_prices.height LEFT JOIN prices ON blocks_prices.price_id=prices.id WHERE blocks.stale=0 AND (blocks_prices.height IS NULL OR prices.id IS NULL) ORDER BY blocks.height',
      };
      for (const [name, sql] of Object.entries(history)) await measure(name, sql);
    }
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error.code || error.name);
  process.exitCode = 1;
});
