import { Shutdown } from '../utils/shutdown';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('shutdown blocks new work and drains active and detached nested jobs', async () => {
  const shutdown = new Shutdown();
  const parent = deferred();
  const child = deferred();
  let childWork!: Promise<void>;
  const work = shutdown.run(async () => {
    childWork = shutdown.run(() => child.promise);
    await parent.promise;
  });
  await Promise.resolve();
  shutdown.stop();
  const rejectedWork = jest.fn();
  await shutdown.run(rejectedWork);
  expect(rejectedWork).not.toHaveBeenCalled();
  let drained = false;
  const draining = shutdown.drain().then(() => {
    drained = true;
  });
  parent.resolve();
  await work;
  expect(drained).toBe(false);
  child.resolve();
  await childWork;
  await draining;
  expect(drained).toBe(true);
});

test('failed jobs do not prevent remaining jobs from draining', async () => {
  const shutdown = new Shutdown();
  const pending = deferred();
  const failed = shutdown.run(async () => {
    throw new Error('failed');
  });
  const failure = expect(failed).rejects.toThrow('failed');
  const work = shutdown.run(() => pending.promise);
  shutdown.stop();
  pending.resolve();
  await shutdown.drain();
  await failure;
  await work;
});
