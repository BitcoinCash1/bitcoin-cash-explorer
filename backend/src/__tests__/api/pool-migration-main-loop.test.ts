import fs from 'fs';
import { Server } from '../../index';
import config from '../../config';
import blocks from '../../api/blocks';
import disk from '../../api/disk-cache';
import mempool from '../../api/mempool';
import bitcoinApi, { bitcoinCoreApi } from '../../api/bitcoin/bitcoin-api-factory';
import updater from '../../tasks/pools-updater';
import DB from '../../database';
import indexer from '../../indexer';

jest.mock('../../database', () => ({
  __esModule: true,
  default: { query: jest.fn(), $transaction: jest.fn() },
}));

describe('main loop pool reconciliation with real disk-cache locking', () => {
  let server: Server;
  let write: jest.SpyInstance;
  const originalExplorer = { ...config.EXPLORER };
  const originalValkey = config.VALKEY.ENABLED;
  const originalWallets = config.WALLETS.ENABLED;
  const originalFiat = config.FIAT_PRICE.ENABLED;

  beforeEach(() => {
    jest.useFakeTimers();
    server = Object.create(Server.prototype);
    Object.assign(server, { backendRetryCount: 0, currentBackendRetryInterval: 1 });
    config.EXPLORER.CACHE_ENABLED = true;
    config.VALKEY.ENABLED = false;
    config.WALLETS.ENABLED = false;
    config.FIAT_PRICE.ENABLED = false;
    Object.assign(mempool, {
      limitGBT: false,
      $updateMemPoolInfo: jest.fn().mockResolvedValue(undefined),
      $updateMempool: jest.fn().mockResolvedValue(undefined),
      getMempool: jest.fn().mockReturnValue({}),
    });
    Object.assign(blocks, { blocks: [], currentBits: 1, currentBlockHeight: 0 });
    Object.assign(updater, { recheck: { sha: 'new', fromHeight: 0 } });
    (updater as any).pendingBlocks.clear();
    jest.spyOn(bitcoinApi, '$getRawMempool').mockResolvedValue([]);
    jest.spyOn(bitcoinCoreApi, '$getBlockHeightTip').mockResolvedValue(-1);
    jest.spyOn(blocks, 'getBlockSummaries').mockReturnValue([]);
    jest.spyOn(indexer, 'indexerIsRunning').mockReturnValue(false);
    jest.spyOn(indexer, '$run').mockResolvedValue(undefined);
    jest.mocked(DB.query).mockResolvedValue([[]] as any);
    jest.mocked(DB.$transaction).mockImplementation(async (work) => work({} as any));
    write = jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'rename').mockResolvedValue(undefined);
  });

  afterEach(() => {
    Object.assign(config.EXPLORER, originalExplorer);
    config.VALKEY.ENABLED = originalValkey;
    config.WALLETS.ENABLED = originalWallets;
    config.FIAT_PRICE.ENABLED = originalFiat;
    Object.assign(disk, { semaphore: { locks: 0, resume: [] }, isWritingCache: false });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('publishes after block polling and continues mempool polling and scheduling', async () => {
    await server.runMainUpdateLoop();
    expect(write).toHaveBeenCalledTimes(25);
    expect((updater as any).recheck).toBeNull();
    expect(mempool.$updateMempool).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
    await server.runMainUpdateLoop();
    expect(mempool.$updateMempool).toHaveBeenCalledTimes(2);
  });

  test('block RPC failure releases only its own lock and clears its watchdog', async () => {
    const failure = new Error('block RPC unavailable');
    jest.mocked(bitcoinCoreApi.$getBlockHeightTip).mockRejectedValueOnce(failure);
    disk.lock();
    try {
      await expect(blocks.$updateBlocks()).rejects.toThrow(failure);
      expect(jest.getTimerCount()).toBe(0);
      const publication = disk.$saveCacheToDisk(false, true);
      await Promise.resolve();
      expect(write).not.toHaveBeenCalled();
      disk.unlock();
      await publication;
      expect(write).toHaveBeenCalledTimes(25);
    } finally {
      disk.unlock();
    }
  });

  test('an RPC failure before block polling does not release another cache owner', async () => {
    jest.mocked(bitcoinApi.$getRawMempool).mockRejectedValueOnce(new Error('mempool RPC failed'));
    disk.lock();
    try {
      await server.runMainUpdateLoop();
      const publication = disk.$saveCacheToDisk(false, true);
      await Promise.resolve();
      const writesWhileLocked = write.mock.calls.length;
      disk.unlock();
      await publication;
      expect(writesWhileLocked).toBe(0);
      expect(write).toHaveBeenCalledTimes(25);
    } finally {
      disk.unlock();
    }
  });

  test('main loop retries a block failure and then reconciles without a leaked lock', async () => {
    jest.mocked(bitcoinCoreApi.$getBlockHeightTip).mockRejectedValueOnce(new Error('RPC failed'));
    await server.runMainUpdateLoop();
    expect(write).not.toHaveBeenCalled();
    expect((updater as any).recheck).not.toBeNull();
    expect(jest.getTimerCount()).toBe(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(write).toHaveBeenCalledTimes(25);
    expect((updater as any).recheck).toBeNull();
    expect(mempool.$updateMempool).toHaveBeenCalledTimes(1);
  });

  test('failed disk publication keeps reconciliation pending and polling alive until retry succeeds', async () => {
    write.mockRejectedValueOnce(new Error('disk full'));
    await server.runMainUpdateLoop();
    expect((updater as any).recheck).not.toBeNull();
    expect(mempool.$updateMempool).toHaveBeenCalledTimes(1);
    await server.runMainUpdateLoop();
    expect((updater as any).recheck).toBeNull();
    expect(mempool.$updateMempool).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenCalledTimes(26);
  });
});
