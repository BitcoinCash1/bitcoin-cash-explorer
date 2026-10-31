// Real HTTP + repository writes + Valkey; disposable fixture only.
const { fork } = require("node:child_process");
const { once } = require("node:events");
const { performance } = require("node:perf_hooks");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const config = JSON.parse(fs.readFileSync(process.env.EXPLORER_CONFIG_FILE));
require("./fixture-guard.cjs")(config);
const redis = require("redis");
const results = { checks: [], soak: [] };
const output = process.env.PERF_OUTPUT;
function start(extra = {}) {
  const child = fork(path.join(__dirname, "stack-worker.cjs"), ["server"], {
    env: { ...process.env, ...extra },
    execArgv: ["--expose-gc", "--max-old-space-size=4096"],
    stdio: ["ignore", fs.openSync(output + ".log", "a"), fs.openSync(output + ".log", "a"), "ipc"],
  });
  return child;
}
const workerBase = async (child) => {
  const [m] = await once(child, "message");
  return `http://127.0.0.1:${m.port}`;
};
const get = async (base, route = "/api/v1/mining/pool/large") => {
  const r = await fetch(base + route);
  assert.equal(r.status, 200);
  return r.json();
};
const post = async (base, route) => {
  const r = await fetch(base + route, { method: "POST" });
  assert.equal(r.status, 200);
  return r.json();
};
const save = () => fs.writeFileSync(output, JSON.stringify(results, null, 2));
(async () => {
  const vk = redis.createClient({ socket: { path: config.VALKEY.UNIX_SOCKET_PATH } });
  await vk.connect();
  const a = start();
  const b = start();
  try {
    const [A, B] = await Promise.all([workerBase(a), workerBase(b)]);
    await vk.flushDb();
    const initial = await get(A);
    assert.equal(initial.blockCount.all, 430000);
    assert.deepEqual(await get(B), initial);
    await post(A, "/__perf/canonical/999999/1");
    assert.equal((await get(B)).blockCount.all, 429999);
    await post(A, "/__perf/canonical/999999/0");
    assert.equal((await get(B)).blockCount.all, 430000);
    results.checks.push("cross-worker canonical/reorg invalidation");
    await post(A, "/__perf/pool/999999/3");
    assert.equal((await get(B)).blockCount.all, 429999);
    assert.equal((await get(B, "/api/v1/mining/pool/tiny")).blockCount.all, 10001);
    await post(A, "/__perf/pool/999999/1");
    assert.equal((await get(B)).blockCount.all, 430000);
    results.checks.push("cross-worker pool reassignment invalidation");
    await post(B, "/__perf/invalidate");
    await post(A, "/__perf/reset");
    const pending = get(A);
    await new Promise((r) => setTimeout(r, 50));
    await post(B, "/__perf/invalidate");
    assert.deepEqual(await pending, initial);
    const raced = await get(A, "/__perf/stats");
    assert.equal(raced.queries.filter((q) => q.sql.startsWith("SELECT COUNT(*) AS allCount")).length, 2);
    results.checks.push("generation changed during real SQL computation: old work retried once");
    // A warm cache hit must issue only the metadata lookup, not aggregates.
    await post(A, "/__perf/reset");
    assert.deepEqual(await get(A), initial);
    const hit = await get(A, "/__perf/stats");
    assert.equal(hit.queries.length, 1);
    results.checks.push("warm hit avoids aggregate SQL");
    for (let batch = 0; batch < 20; batch++) {
      await post(A, "/__perf/reset");
      const begin = performance.now();
      let i = 0;
      await Promise.all(
        Array.from({ length: 32 }, async () => {
          while (i++ < 500) assert.deepEqual(await get(A), initial);
        })
      );
      // Force GC before measuring retained heap, separately from sampled peak memory.
      const peak = await get(A, "/__perf/stats");
      await post(A, "/__perf/reset");
      const retained = await get(A, "/__perf/stats");
      results.soak.push({
        batch,
        requests: 500,
        ms: performance.now() - begin,
        peak: peak.peak,
        retained: retained.memory,
        errors: peak.errors,
      });
      save();
    }
    const plateau = results.soak.slice(5).map((s) => s.retained.heapUsed);
    assert.ok(plateau.at(-1) - Math.min(...plateau) < 16 * 1024 * 1024, "retained heap grew by >16 MiB after warmup");
    results.checks.push("10,000 warm requests at concurrency 32; retained heap growth <16 MiB after warmup");
    await get(A);
    await new Promise((r) => setTimeout(r, 31000));
    await post(A, "/__perf/reset");
    assert.deepEqual(await get(A), initial);
    const expired = await get(A, "/__perf/stats");
    assert.equal(expired.queries.filter((q) => q.sql.startsWith("SELECT COUNT(*) AS allCount")).length, 1);
    results.checks.push("real 30-second TTL expiry recomputes aggregates");
    save();
  } finally {
    a.kill();
    b.kill();
    await vk.quit();
  }
})().catch((e) => {
  results.error = e.stack;
  save();
  console.error(e);
  process.exitCode = 1;
});
