// Run against an isolated, seeded fixture. See the companion report for setup/limitations.
const { fork } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const { performance } = require("node:perf_hooks");
const { createHash } = require("node:crypto");
const root = path.resolve(__dirname, "../..");
const mysql = require(path.join(root, "node_modules/mysql2/promise"));
const redis = require(path.join(root, "node_modules/redis"));
const out = process.env.PERF_OUTPUT;
const build = process.env.PERF_BUILD;
const config = JSON.parse(fs.readFileSync(process.env.EXPLORER_CONFIG_FILE));
require("./fixture-guard.cjs")(config);
const results = {
  revision: process.env.PERF_REVISION,
  build,
  fixture: "1,000,000 canonical blocks, wide rows and 2KiB summary JSON",
  scenarios: [],
};
let admin, vk;
const status = async () =>
  Object.fromEntries(
    (
      await admin.query(
        "SHOW GLOBAL STATUS WHERE Variable_name IN ('Bytes_sent','Innodb_buffer_pool_reads','Innodb_buffer_pool_read_requests','Rows_read','Questions')"
      )
    )[0].map((r) => [r.Variable_name, Number(r.Value)])
  );
const delta = (a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, b[k] - a[k]]));
const save = () => fs.writeFileSync(out, JSON.stringify(results, null, 2));
function start(mode, extra = {}) {
  const child = fork(path.join(__dirname, "stack-worker.cjs"), [mode], {
    env: { ...process.env, ...extra },
    execArgv: ["--expose-gc", "--max-old-space-size=4096"],
    stdio: ["ignore", fs.openSync(out + ".worker.log", "a"), fs.openSync(out + ".worker.log", "a"), "ipc"],
  });
  const messages = [];
  const waiters = [];
  child.on("message", (m) => {
    const f = waiters.shift();
    if (f) f.resolve(m);
    else messages.push(m);
  });
  child.on("exit", (code) => {
    if (code) for (const f of waiters.splice(0)) f.reject(new Error(`Worker exited ${code}; see ${out}.worker.log`));
  });
  return {
    child,
    next: () =>
      messages.length
        ? Promise.resolve(messages.shift())
        : new Promise((resolve, reject) => waiters.push({ resolve, reject })),
  };
}
async function workload(base, url, concurrency, requests) {
  let next = 0;
  const latency = [];
  let checksum;
  let responseBytes = 0;
  const t = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next++ < requests) {
        const a = performance.now();
        const r = await fetch(base + url);
        const body = await r.json();
        if (!r.ok) throw new Error(`${url}: ${r.status} ${JSON.stringify(body)}`);
        responseBytes += Buffer.byteLength(JSON.stringify(body));
        latency.push(performance.now() - a);
        checksum = Array.isArray(body)
          ? { count: body.length, first: body[0]?.height, last: body.at(-1)?.height }
          : {
              all: body.blockCount.all,
              day: body.blockCount["24h"],
              week: body.blockCount["1w"],
              reward: body.totalReward,
            };
        checksum.digest = createHash("sha256").update(JSON.stringify(body)).digest("hex");
      }
    })
  );
  latency.sort((a, b) => a - b);
  return {
    concurrency,
    requests,
    responseBytes,
    wallMs: performance.now() - t,
    p50: latency[Math.ceil(latency.length * 0.5) - 1],
    p95: latency[Math.ceil(latency.length * 0.95) - 1],
    max: latency.at(-1),
    checksum,
  };
}
async function api() {
  const w = start("server");
  try {
    const { port } = await w.next();
    const base = `http://127.0.0.1:${port}`;
    for (const [label, url] of [
      ["pool-stats", "/api/v1/mining/pool/large"],
      ["pool-blocks", "/api/v1/mining/pool/large/blocks"],
      ["pool-pagination", "/api/v1/mining/pool/large/blocks/500000"],
    ]) {
      for (const [concurrency, requests] of [
        [1, 5],
        [8, 24],
        [32, 64],
      ]) {
        await vk.flushDb();
        await fetch(base + "/__perf/reset", { method: "POST" });
        const before = await status();
        const r = await workload(base, url, concurrency, requests);
        const db = delta(before, await status());
        const metrics = await (await fetch(base + "/__perf/stats")).json();
        results.scenarios.push({ label, ...r, db, metrics });
        save();
        console.log(label, concurrency, r.p95.toFixed(2));
      }
    }
  } finally {
    w.child.kill();
  }
}
async function startupTraffic() {
  const apiWorker = start("server");
  let indexWorker;
  try {
    const { port } = await apiWorker.next();
    const base = `http://127.0.0.1:${port}`;
    await vk.flushDb();
    await fetch(base + "/__perf/reset", { method: "POST" });
    const before = await status();
    const t = performance.now();
    indexWorker = start("indexer", { PERF_STARTUP_ONLY: "1" });
    const [requests, indexing] = await Promise.all([
      workload(base, "/api/v1/mining/pool/large", 8, 16),
      indexWorker.next(),
    ]);
    const metrics = await (await fetch(base + "/__perf/stats")).json();
    results.scenarios.push({
      label: "cold-startup-with-traffic",
      wallMs: performance.now() - t,
      requests,
      indexing,
      metrics,
      db: delta(before, await status()),
    });
    save();
  } finally {
    apiWorker.child.kill();
    indexWorker?.child.kill();
  }
}
async function stages() {
  for (const mode of process.env.PERF_ONLY_STAGE
    ? [process.env.PERF_ONLY_STAGE]
    : ["summary", "history", "price", "price-target", "indexer"]) {
    const w = start(mode);
    try {
      for (let i = 0; i < (mode === "indexer" ? 2 : 1); i++) {
        const before = await status();
        const metrics = await w.next();
        results.scenarios.push({ label: mode, db: delta(before, await status()), metrics });
        save();
        console.log(mode, metrics.phase || "", metrics.ms);
      }
    } finally {
      w.child.kill();
    }
  }
}
(async () => {
  const d = config.DATABASE;
  admin = await mysql.createConnection({
    host: d.HOST,
    port: d.PORT,
    user: d.USERNAME,
    password: d.PASSWORD,
    database: d.DATABASE,
  });
  vk = redis.createClient({ socket: { path: config.VALKEY.UNIX_SOCKET_PATH } });
  await vk.connect();
  results.server = (await admin.query("SELECT VERSION() AS version"))[0];
  if (process.argv[2] === "snapshot") {
    await vk.flushDb();
    const w = start("server");
    try {
      const { port } = await w.next();
      results.samples = {};
      for (const route of [
        "large",
        "large/blocks",
        "large/blocks/500000",
        "small",
        "small/blocks",
        "tiny",
        "tiny/blocks",
      ]) {
        const r = await fetch(`http://127.0.0.1:${port}/api/v1/mining/pool/${route}`);
        if (!r.ok) throw new Error(`snapshot ${r.status}`);
        results.samples[route] = await r.json();
      }
    } finally {
      w.child.kill();
    }
  } else if (process.argv[2] === "migrate") {
    const sizes = async () =>
      (
        await admin.query(
          "SELECT TABLE_NAME,DATA_LENGTH,INDEX_LENGTH FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()"
        )
      )[0];
    const before = await sizes();
    const w = start("migrate");
    try {
      const t = performance.now();
      const metrics = await w.next();
      results.scenarios.push({
        label: "migration",
        wallMs: performance.now() - t,
        before,
        after: await sizes(),
        metrics,
      });
    } finally {
      w.child.kill();
    }
  } else if (process.argv[2] === "api") await api();
  else if (process.argv[2] === "stages") await stages();
  else if (process.argv[2] === "startup-traffic") await startupTraffic();
  else throw new Error("Choose api or stages");
  save();
  await vk.quit();
  await admin.end();
})().catch((e) => {
  console.error(e);
  save();
  process.exitCode = 1;
});
