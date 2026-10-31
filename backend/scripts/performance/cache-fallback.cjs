const { fork, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const config = JSON.parse(fs.readFileSync(process.env.EXPLORER_CONFIG_FILE));
require("./fixture-guard.cjs")(config);
const output = process.env.PERF_OUTPUT;
const results = { checks: [] };
const workers = [];
async function start(configPath) {
  const worker = fork(path.join(__dirname, "stack-worker.cjs"), ["server"], {
    env: { ...process.env, EXPLORER_CONFIG_FILE: configPath },
    execArgv: ["--expose-gc"],
    stdio: ["ignore", fs.openSync(output + ".log", "a"), fs.openSync(output + ".log", "a"), "ipc"],
  });
  workers.push(worker);
  const [m] = await once(worker, "message");
  return `http://127.0.0.1:${m.port}`;
}
const get = async (base, route = "/api/v1/mining/pool/large") => {
  const r = await fetch(base + route, { signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  return r.json();
};
const post = async (base, route) => {
  const r = await fetch(base + route, { method: "POST", signal: AbortSignal.timeout(15000) });
  assert.equal(r.status, 200);
  return r.json();
};
(async () => {
  const base = await start(process.env.EXPLORER_CONFIG_FILE);
  const original = await get(base);
  execFileSync("docker", ["stop", process.env.PERF_VALKEY_CONTAINER || "explorer-stack-perf-valkey"], {
    stdio: "ignore",
  });
  assert.deepEqual(await get(base), original);
  await post(base, "/__perf/canonical/999999/1");
  assert.equal((await get(base)).blockCount.all, 429999);
  await post(base, "/__perf/canonical/999999/0");
  assert.equal((await get(base)).blockCount.all, 430000);
  results.checks.push("real Valkey shutdown: HTTP remains available, repository writes and fresh counts work");
  execFileSync("docker", ["start", process.env.PERF_VALKEY_CONTAINER || "explorer-stack-perf-valkey"], {
    stdio: "ignore",
  });
  // The application reconnects on its existing ten-second timer.
  await new Promise((r) => setTimeout(r, 12000));
  assert.deepEqual(await get(base), original);
  await post(base, "/__perf/reset");
  assert.deepEqual(await get(base), original);
  const recovered = await get(base, "/__perf/stats");
  assert.equal(recovered.valkey.connected, true);
  assert.equal(recovered.queries.length, 1);
  results.recovered = recovered;
  results.checks.push("real Valkey restart reconnects and warm cache hits avoid aggregate SQL");
  const noCache = { ...config, VALKEY: { ...config.VALKEY, ENABLED: false } };
  const disabled = output + ".disabled.json";
  fs.writeFileSync(disabled, JSON.stringify(noCache));
  const other = await start(disabled);
  await post(other, "/__perf/reset");
  await Promise.all(Array.from({ length: 8 }, async () => assert.deepEqual(await get(other), original)));
  const metrics = await get(other, "/__perf/stats");
  assert.equal(metrics.queries.filter((q) => q.sql.startsWith("SELECT COUNT(*) AS allCount")).length, 1);
  results.checks.push("Valkey disabled: eight concurrent HTTP requests share one SQL computation");
  results.disabled = metrics;
})()
  .catch((error) => {
    results.error = error.stack;
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    workers.forEach((w) => w.kill());
    execFileSync("docker", ["start", process.env.PERF_VALKEY_CONTAINER || "explorer-stack-perf-valkey"], {
      stdio: "ignore",
    });
    fs.writeFileSync(output, JSON.stringify(results, null, 2));
  });
