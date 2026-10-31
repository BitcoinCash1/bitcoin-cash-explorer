/* Runs real compiled application handlers/stages against a disposable fixture.
 * EXPLORER_CONFIG_FILE and PERF_BUILD must point at the fixture config/build.
 * The fixture starts with an empty, synced mempool; BCHN is a local RPC server.
 */
const path = require("node:path");
const { performance, monitorEventLoopDelay } = require("node:perf_hooks");
const eventLoop = monitorEventLoopDelay({ resolution: 20 });
eventLoop.enable();
const logger = require(path.join(process.env.PERF_BUILD, "logger")).default;
let errors = [];
const logError = logger.err.bind(logger);
logger.err = (...args) => {
  errors.push(args.map(String).join(" "));
  logError(...args);
};
const build = process.env.PERF_BUILD;
const load = (name) => require(path.join(build, name)).default;
const fixtureConfig = load("config");
require("./fixture-guard.cjs")(fixtureConfig);
const DB = load("database");
let queries = [];
const query = DB.query.bind(DB);
DB.query = async (...args) => {
  const start = performance.now();
  const result = await query(...args);
  const sql = typeof args[0] === "string" ? args[0] : args[0].sql;
  queries.push({
    sql: sql.replace(/\s+/g, " ").trim(),
    ms: performance.now() - start,
    rows: Array.isArray(result[0]) ? result[0].length : 0,
  });
  return result;
};
let peak = { rss: 0, heapUsed: 0, external: 0 };
const sample = () => {
  const m = process.memoryUsage();
  for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], m[k]);
};
setInterval(sample, 20).unref();
const reset = () => {
  errors = [];
  eventLoop.reset();
  queries = [];
  peak = { rss: 0, heapUsed: 0, external: 0 };
  sample();
};
const stats = () => {
  sample();
  return {
    queries,
    valkey: { enabled: fixtureConfig.VALKEY.ENABLED, connected: load("api/valkey-cache").connected },
    errors,
    eventLoop: { p95Ms: eventLoop.percentile(95) / 1e6, maxMs: eventLoop.max / 1e6 },
    peak,
    memory: process.memoryUsage(),
    maxRSS: process.resourceUsage().maxRSS * 1024,
  };
};
(async () => {
  const mode = process.argv[2];
  if (process.env.PERF_SQL_NOW) {
    const epoch = Number(process.env.PERF_SQL_NOW);
    if (!Number.isSafeInteger(epoch)) throw new Error("Invalid fixture SQL clock");
    const pool = await DB.getPool();
    pool.on("connection", (connection) => connection.query(`SET timestamp = ${epoch}`));
  }

  if (mode === "migrate") {
    reset();
    await load("api/database-migration").$initializeOrMigrateDatabase();
    process.send?.({ done: true, ...stats() });
    await DB.close();
    process.exit(0);
  }
  const valkey = load("api/valkey-cache");
  for (let i = 0; i < 100 && !(await valkey.$getCache("schema_version")); i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (mode === "server") {
    const express = require("express");
    const app = express();
    load("api/mining/mining-routes").initRoutes(app);
    app.post("/__perf/reset", (_req, res) => {
      reset();
      global.gc?.();
      reset();
      res.json({ ok: true });
    });
    app.get("/__perf/stats", (_req, res) => res.json(stats()));
    app.post("/__perf/canonical/:height/:stale", async (req, res) => {
      const height = Number(req.params.height);
      await load("repositories/BlocksRepository").$setCanonicalBlockAtHeight(
        Number(req.params.stale) ? null : String(height).padStart(64, "0"),
        height
      );
      res.json({ ok: true });
    });
    app.post("/__perf/pool/:height/:pool", async (req, res) => {
      await load("repositories/BlocksRepository").$savePool(
        String(req.params.height).padStart(64, "0"),
        Number(req.params.pool)
      );
      res.json({ ok: true });
    });
    app.post("/__perf/invalidate", async (_req, res) => {
      await load("api/mining/pool-statistics-cache").invalidate();
      res.json({ ok: true });
    });

    const server = app.listen(0, "127.0.0.1", () => process.send?.({ port: server.address().port }));
  } else if (["summary", "history", "price", "price-target"].includes(mode)) {
    if (mode === "price-target") await DB.query("DELETE FROM blocks_prices WHERE height = 999999");
    global.gc?.();
    reset();
    const start = performance.now();
    if (mode === "summary") await load("api/blocks").$generateBlocksSummariesDatabase();
    if (mode === "history") {
      const mining = load("api/mining/mining");
      const boundary = await mining.$indexDifficultyAdjustments();
      await mining.$generateNetworkHashrateHistory(boundary);
      await mining.$generatePoolHashrateHistory(boundary);
    }
    if (mode === "price") await load("api/mining/mining").$indexBlockPrices();
    if (mode === "price-target") {
      await load("api/mining/mining").$indexBlockPrices([999999]);
      const [links] = await DB.query("SELECT price_id FROM blocks_prices WHERE height = 999999");
      if (links.length !== 1) throw new Error("Targeted price repair did not restore link");
    }
    process.send?.({ ms: performance.now() - start, ...stats() });
    await DB.close();
    process.exit(0);
  } else if (mode === "indexer") {
    const mempool = load("api/mempool");
    mempool.inSync = true; // fixture: no mempool transactions to prioritise over indexing
    const indexer = load("indexer");
    const mining = load("api/mining/mining");
    for (const phase of process.env.PERF_STARTUP_ONLY ? ["startup"] : ["startup", "hourly"]) {
      global.gc?.();
      reset();
      const start = performance.now();
      if (phase === "hourly") indexer.reindex();
      await indexer.$run();
      // Price-feed HTTP import is disabled; exercise the real reconciliation with seeded prices.
      await mining.$indexBlockPrices();
      process.send?.({ phase, ms: performance.now() - start, ...stats() });
    }
    await DB.close();
    process.exit(0);
  } else throw new Error(`Unknown worker mode: ${mode}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
