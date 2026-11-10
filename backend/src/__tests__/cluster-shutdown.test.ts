import { EventEmitter } from 'events';
import type { Worker } from 'cluster';
import { shutdownClusterWorkers } from '../utils/shutdown-cluster-workers';

function createWorker(dead = false, code: number | null = 0, signal: string | null = null) {
  const events = new EventEmitter();
  const kill = jest.fn();
  const worker = Object.assign(events, {
    isDead: () => dead,
    process: { kill, exitCode: code, signalCode: signal },
  }) as unknown as Worker;
  return { worker, events, kill };
}

test.each([
  [1, null],
  [null, 'SIGKILL'],
] as const)('waits for every worker before reporting exit %s/%s', async (code, signal) => {
  const first = createWorker();
  const second = createWorker();
  let finished = false;
  const closing = shutdownClusterWorkers([first.worker, second.worker]);
  const result = expect(closing).rejects.toThrow('A cluster worker exited');
  void closing.catch(() => {
    finished = true;
  });
  expect(first.kill).toHaveBeenCalledWith('SIGTERM');
  expect(second.kill).toHaveBeenCalledWith('SIGTERM');
  first.events.emit('exit', code, signal);
  await Promise.resolve();
  expect(finished).toBe(false);
  second.events.emit('disconnect');
  await Promise.resolve();
  expect(finished).toBe(false);
  second.events.emit('exit', 0, null);
  await result;
});

test('waits for remaining workers even if signalling one throws', async () => {
  const first = createWorker();
  const second = createWorker();
  first.kill.mockImplementation(() => {
    throw new Error('Cannot signal');
  });
  const closing = shutdownClusterWorkers([first.worker, second.worker]);
  const result = expect(closing).rejects.toThrow('A cluster worker exited');
  expect(second.kill).toHaveBeenCalledWith('SIGTERM');
  second.events.emit('exit', 0, null);
  await result;
});

test('handles clean, already dead and empty clusters', async () => {
  await shutdownClusterWorkers([]);
  const dead = createWorker(true);
  await shutdownClusterWorkers([dead.worker]);
  expect(dead.kill).not.toHaveBeenCalled();
  const alive = createWorker();
  alive.kill.mockImplementation(() => alive.events.emit('exit', 0, null));
  await shutdownClusterWorkers([alive.worker]);
  await expect(shutdownClusterWorkers([createWorker(true, 1).worker])).rejects.toThrow('A cluster worker exited');
});
