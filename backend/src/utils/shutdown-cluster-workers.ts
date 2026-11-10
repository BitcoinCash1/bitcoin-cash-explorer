import type { Worker } from 'cluster';

/** Keep worker IPC open until every worker has exited, including failed exits. */
export async function shutdownClusterWorkers(workers: Worker[]): Promise<void> {
  const exits = workers.map((worker) => {
    if (worker.isDead()) {
      return Promise.resolve({ code: worker.process.exitCode, signal: worker.process.signalCode });
    }
    return new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      worker.once('exit', (code, signal) => resolve({ code, signal }));
      worker.process.kill('SIGTERM');
    });
  });
  const results = await Promise.allSettled(exits);
  const failed = results.some(
    (result) => result.status === 'rejected' || result.value.code !== 0 || result.value.signal !== null
  );
  if (failed) throw new Error('A cluster worker exited without completing graceful shutdown');
}
