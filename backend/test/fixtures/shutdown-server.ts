import chainTips from '../../src/api/chain-tips';
import blocks from '../../src/api/blocks';
import summaries from '../../src/repositories/BlocksSummariesRepository';
import { Common } from '../../src/api/common';
import cluster from 'cluster';
import http from 'http';
import { Server } from '../../src/index';
import DB from '../../src/database';
import config from '../../src/config';
import shutdown from '../../src/utils/shutdown';

// Run the real Server shutdown code. Only startup dependencies are disabled by
// the temporary config; the test can supply a real MariaDB endpoint separately.
if (process.env.SHUTDOWN_TEST_DEADLINE) {
  const realTimeout = global.setTimeout;
  // Exercise the production deadline callback without adding 50s to each run.
  global.setTimeout = ((callback, milliseconds, ...args) =>
    realTimeout(
      callback,
      milliseconds === 50000 ? (process.env.SHUTDOWN_TEST_ORPHANS ? 350 : 200) : milliseconds,
      ...args
    )) as typeof global.setTimeout;
}
if (cluster.isPrimary && config.EXPLORER.SPAWN_CLUSTER_PROCS) {
  cluster.on('message', (_worker, message) => {
    if (message.event === 'ready' || message.event === 'request-started') process.send?.(message);
  });
  cluster.on('exit', (_worker, code, signal) => process.send?.({ event: 'worker-exited', code, signal }));
}
const realListen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args: any[]): any {
  this.once('listening', () => {
    process.send?.({ event: 'ready', port: (this.address() as any).port });
  });
  return Reflect.apply(realListen, this, args);
};

if (!process.env.SHUTDOWN_REAL_DB) {
  (DB as any).pool = {
    end: async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    },
  };
}
const closeDatabase = DB.shutdown.bind(DB);
DB.shutdown = async () => {
  process.send?.({ event: 'pool-closing' });
  if (cluster.isWorker && process.env.SHUTDOWN_TEST_WORKER_FAILURE) {
    await new Promise((resolve) => setTimeout(resolve, Number(process.env.workerId) * 100));
    throw new Error('Injected database shutdown failure');
  }
  await closeDatabase();
  process.send?.({ event: 'pool-closed' });
};
const server = new Server();
(server as any).app.get('/slow', async (_req, res) => {
  process.send?.({ event: 'request-started' });
  if (process.env.SHUTDOWN_REAL_DB) {
    config.DATABASE.ENABLED = true;
    await DB.query('SELECT SLEEP(0.4)');
  } else {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  res.end('completed');
});
process.on('message', (message) => {
  if (message === 'orphans') {
    let indexed = 0;
    (chainTips as any).indexingQueue = Array.from({ length: 12 }, (_, index) => ({
      block: { id: String(index), height: index + 1 },
      tip: { height: 20, status: 'valid-fork' },
    }));
    summaries.$isSummaryIndexed = async () => false;
    blocks.$indexBlock = async (_id, block) => {
      indexed++;
      return block as any;
    };
    blocks.$indexBlockSummary = async () => undefined;
    blocks.$indexBlockByHeight = async (height) => ({ id: 'canonical', height }) as any;
    Common.sleep$ = async () => {
      process.send?.({ event: 'orphan-started' });
      await new Promise((resolve) => setTimeout(resolve, 50));
    };
    void (chainTips as any).$indexOrphanedBlocks().then(() =>
      process.send?.({
        event: 'orphans-drained',
        indexed,
        queued: (chainTips as any).indexingQueue.length,
      })
    );
  }
  if (message === 'stall') {
    void shutdown.run(async () => {
      process.send?.({ event: 'background-started' });
      await new Promise<void>(() => {});
    });
  }
  if (message === 'background') {
    void shutdown.run(async () => {
      process.send?.({ event: 'background-started' });
      if (process.env.SHUTDOWN_REAL_DB) {
        await DB.$transaction(async (connection) => {
          await DB.query('SELECT SLEEP(0.6)', [], 'debug', connection);
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
      process.send?.({ event: 'background-completed' });
    });
  }
});
