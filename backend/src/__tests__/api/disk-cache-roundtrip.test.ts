import fs from 'fs';
import os from 'os';
import path from 'path';
import config from '../../config';
import mempool from '../../api/mempool';
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getMempool: jest.fn(), $setMempool: jest.fn() },
}));
jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: {
    getBlocks: () => [],
    getBlockSummaries: () => [],
    setBlocks: jest.fn(),
    setBlockSummaries: jest.fn(),
  },
}));
let cache: typeof import('../../api/disk-cache').default;
let directory: string;
const originalDirectory = config.EXPLORER.CACHE_DIR;
const originalEnabled = config.EXPLORER.CACHE_ENABLED;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-mr53-disk-'));
  config.EXPLORER.CACHE_DIR = directory;
  config.EXPLORER.CACHE_ENABLED = true;
  cache = jest.requireActual('../../api/disk-cache').default;
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  config.EXPLORER.CACHE_DIR = originalDirectory;
  config.EXPLORER.CACHE_ENABLED = originalEnabled;
});
afterEach(() => jest.restoreAllMocks());
it.each([false, true].flatMap((sync) => [0, 1, 24, 25, 26, 49, 50, 51, 10003].map((count) => [sync, count] as const)))(
  'round-trips every transaction exactly once (sync=%s, count=%i)',
  async (sync, count) => {
    const transactions = Array.from({ length: count }, (_, i) => ({ txid: String(i), value: i }));
    jest.mocked(mempool.getMempool).mockReturnValue(Object.fromEntries(transactions.map((tx) => [tx.txid, tx])) as any);
    await cache.$saveCacheToDisk(sync, true);
    const stored = Array.from(
      { length: 25 },
      (_, i) => JSON.parse(fs.readFileSync(path.join(directory, `cache${i || ''}.json`), 'utf8')).mempoolArray
    ).flat();
    expect(stored).toHaveLength(count);
    expect(new Set(stored.map((tx) => tx.txid)).size).toBe(count);
    expect(stored.sort((a, b) => a.value - b.value)).toEqual(transactions);
    await cache.$loadMempoolCache();
    expect(mempool.$setMempool).toHaveBeenLastCalledWith(Object.fromEntries(transactions.map((tx) => [tx.txid, tx])));
  }
);
it('waits for locks, joins concurrent writes and rejects strict concurrent writes', async () => {
  cache.lock();
  const write = cache.$saveCacheToDisk(false, true);
  const joined = cache.$saveCacheToDisk();
  await expect(cache.$saveCacheToDisk(false, true)).rejects.toThrow('already in progress');
  let settled = false;
  void write.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  cache.unlock();
  await Promise.all([write, joined]);
});
it('releases the write state after a failure and permits retry', async () => {
  const write = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error('fixture failure'));
  await expect(cache.$saveCacheToDisk(false, true)).rejects.toThrow('fixture failure');
  write.mockRestore();
  await expect(cache.$saveCacheToDisk(false, true)).resolves.toBeUndefined();
});
