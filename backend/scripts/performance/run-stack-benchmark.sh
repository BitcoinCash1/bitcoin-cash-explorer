#!/usr/bin/env bash
set -euo pipefail
# Disposable local containers only. Results survive cleanup in PERF_DIR.
REPO=$(git rev-parse --show-toplevel)
PERF_DIR=${PERF_DIR:-$(mktemp -d /tmp/explorer-stack-performance.XXXXXX)}
export PERF_DIR
mkdir -p "$PERF_DIR/socket"
DB=explorer-stack-perf-db
export PERF_VALKEY_CONTAINER=explorer-stack-perf-valkey
for container in "$DB" "$PERF_VALKEY_CONTAINER"; do
  if docker inspect "$container" >/dev/null 2>&1; then
    echo "Refusing to reuse existing container: $container" >&2
    exit 1
  fi
done
BASELINE=${PERF_BASELINE:-e8c6f0070}
WORKTREE="$PERF_DIR/baseline"
RPC_PID=
cleanup() {
  [[ -z "$RPC_PID" ]] || kill "$RPC_PID" 2>/dev/null || true
  docker rm -fv "$DB" "$PERF_VALKEY_CONTAINER" >/dev/null 2>&1 || true
  git -C "$REPO" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  echo "Results retained in $PERF_DIR"
}
trap cleanup EXIT
SCRIPTS="$REPO/backend/scripts/performance"
git -C "$REPO" worktree add --detach "$WORKTREE" "$BASELINE"
ln -s "$REPO/backend/node_modules" "$WORKTREE/backend/node_modules"
ln -s "$REPO/backend/rust-gbt" "$WORKTREE/backend/rust-gbt"
(cd "$WORKTREE/backend" && node_modules/.bin/tsc -p tsconfig.build.json --outDir "$PERF_DIR/baseline-build")
ln -s "$REPO/backend/node_modules" "$PERF_DIR/baseline-build/node_modules"
cp "$REPO/backend/src/tasks/price-feeds/mtgox-weekly.json" "$PERF_DIR/baseline-build/tasks/price-feeds/"
(cd "$REPO/backend" && node_modules/.bin/tsc -p tsconfig.build.json)
cp "$REPO/backend/src/tasks/price-feeds/mtgox-weekly.json" "$REPO/backend/dist/tasks/price-feeds/"
node - "$REPO" "$PERF_DIR" <<'JS'
const fs=require('node:fs');const [repo,dir]=process.argv.slice(2);
const c=JSON.parse(fs.readFileSync(repo+'/backend/explorer-config.test.json'));
c.DATABASE={...c.DATABASE,HOST:'127.0.0.1',PORT:33417,USERNAME:'root',PASSWORD:'',DATABASE:'explorer_perf',POOL_SIZE:10,TIMEOUT:120000,PID_DIR:dir};
c.CORE_RPC={...c.CORE_RPC,HOST:'127.0.0.1',PORT:33418,USERNAME:'fixture',PASSWORD:'fixture',COOKIE:false};
c.EXPLORER={...c.EXPLORER,INDEXING_BLOCKS_AMOUNT:-1,BLOCKS_SUMMARIES_INDEXING:true,GOGGLES_INDEXING:false,AUDIT:false,STDOUT_LOG_MIN_PRIORITY:'warn',BACKEND:'none',AUTOMATIC_POOLS_UPDATE:false};
c.FIAT_PRICE.ENABLED=false;c.VALKEY={...c.VALKEY,ENABLED:true,UNIX_SOCKET_PATH:dir+'/socket/valkey.sock'};c.REPLICATION.ENABLED=false;
fs.writeFileSync(dir+'/config.json',JSON.stringify(c));
JS
export EXPLORER_CONFIG_FILE="$PERF_DIR/config.json"
docker run -d --name "$DB" -p 127.0.0.1:33417:3306 -e MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1 --memory=4g mariadb:10.11 --innodb-buffer-pool-size=536870912 --performance-schema=ON --innodb-buffer-pool-dump-at-shutdown=OFF --innodb-buffer-pool-load-at-startup=OFF >/dev/null
docker run -d --name "$PERF_VALKEY_CONTAINER" -v "$PERF_DIR/socket:/socket" valkey/valkey:9.0.6-alpine valkey-server --port 0 --unixsocket /socket/valkey.sock --unixsocketperm 777 --save '' --appendonly no >/dev/null
node "$SCRIPTS/fixture-rpc.cjs" > "$PERF_DIR/rpc.log" 2>&1 &
RPC_PID=$!
ready() {
  for attempt in {1..60}; do
    if docker exec "$DB" mariadb-admin ping --silent >/dev/null 2>&1; then return; fi
    sleep 1
  done
  return 1
}
ready
docker exec "$DB" mariadb -e 'CREATE DATABASE explorer_perf'
node "$SCRIPTS/seed.cjs" "$PERF_DIR/baseline-build" > "$PERF_DIR/seed.log" 2>&1
benchmark() {
  export PERF_OUTPUT="$PERF_DIR/$1.json"
  node "$SCRIPTS/stack-benchmark.cjs" "$2" > "$PERF_DIR/$1.log" 2>&1
}
export PERF_BUILD="$PERF_DIR/baseline-build" PERF_REVISION="$BASELINE"
benchmark baseline-api api
benchmark baseline-stages stages
docker restart "$DB" >/dev/null; ready
benchmark baseline-cold startup-traffic
PERF_SQL_NOW=1793000100 benchmark baseline-snapshot-fixed snapshot
export PERF_BUILD="$REPO/backend/dist" PERF_REVISION
PERF_REVISION=$(git -C "$REPO" rev-parse HEAD)
benchmark migration migrate
benchmark stack-api api
benchmark stack-stages stages
docker restart "$DB" >/dev/null; ready
benchmark stack-cold startup-traffic
PERF_SQL_NOW=1793000100 benchmark stack-snapshot-fixed snapshot
PERF_OUTPUT="$PERF_DIR/cache-validation.json" node "$SCRIPTS/cache-validation.cjs"
PERF_SQL_NOW=1793000100 PERF_OUTPUT="$PERF_DIR/cache-fallback.json" node "$SCRIPTS/cache-fallback.cjs"
