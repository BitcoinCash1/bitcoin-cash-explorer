import fs from 'fs';
import mempool from '../../api/mempool';
import blocks from '../../api/blocks';
import config from '../../config';
import disk from '../../api/disk-cache';
import valkey from '../../api/valkey-cache';
import statistics from '../../api/mining/pool-statistics-cache';

// These use the real cache methods: best-effort APIs must fail explicitly for migration refreshes.
test('strict publication rejects disconnected Valkey and preserves existing best-effort callers', async () => {
  const enabled = config.VALKEY.ENABLED;
  const connected = (valkey as any).connected;
  config.VALKEY.ENABLED = true;
  (valkey as any).connected = false;
  try {
    await expect(valkey.$updateBlocks([], true)).rejects.toThrow('not connected');
    await expect(statistics.invalidate(true)).rejects.toThrow('not connected');
    await expect(valkey.$updateBlocks([])).resolves.toBeUndefined();
    await expect(statistics.invalidate()).resolves.toBeUndefined();
  } finally {
    config.VALKEY.ENABLED = enabled;
    (valkey as any).connected = connected;
  }
});

test('strict cache publication counts disabled caches as success', async () => {
  const enabled = config.VALKEY.ENABLED;
  config.VALKEY.ENABLED = false;
  try {
    await expect(valkey.$updateBlocks([], true)).resolves.toBeUndefined();
    await expect(statistics.invalidate(true)).resolves.toBeUndefined();
  } finally {
    config.VALKEY.ENABLED = enabled;
  }
});

test('strict disk publication retries an existing write instead of claiming success', async () => {
  const enabled = config.EXPLORER.CACHE_ENABLED;
  config.EXPLORER.CACHE_ENABLED = true;
  (disk as any).isWritingCache = true;
  try {
    await expect(disk.$saveCacheToDisk(false, true)).rejects.toThrow('already in progress');
    await expect(disk.$saveCacheToDisk()).resolves.toBeUndefined();
  } finally {
    config.EXPLORER.CACHE_ENABLED = enabled;
    (disk as any).isWritingCache = false;
  }
});

test('strict Valkey publication propagates client write failures', async () => {
  const enabled = config.VALKEY.ENABLED;
  const connected = (valkey as any).connected;
  const client = (valkey as any).client;
  config.VALKEY.ENABLED = true;
  (valkey as any).connected = true;
  (valkey as any).client = { set: jest.fn().mockRejectedValue(new Error('write failed')) };
  try {
    await expect(valkey.$updateBlocks([], true)).rejects.toThrow('write failed');
    await expect(statistics.invalidate(true)).rejects.toThrow('write failed');
    await expect(valkey.$updateBlocks([])).resolves.toBeUndefined();
  } finally {
    config.VALKEY.ENABLED = enabled;
    (valkey as any).connected = connected;
    (valkey as any).client = client;
  }
});

test('strict disk publication propagates filesystem failure and releases the writer', async () => {
  const enabled = config.EXPLORER.CACHE_ENABLED;
  const getMempool = (mempool as any).getMempool;
  config.EXPLORER.CACHE_ENABLED = true;
  (mempool as any).getMempool = jest.fn().mockReturnValue({});
  const getBlocks = jest.spyOn(blocks, 'getBlocks').mockReturnValue([]);
  const getSummaries = jest.spyOn(blocks, 'getBlockSummaries').mockReturnValue([]);
  const write = jest.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('disk full'));
  try {
    await expect(disk.$saveCacheToDisk(false, true)).rejects.toThrow('disk full');
    expect((disk as any).isWritingCache).toBe(false);
    await expect(disk.$saveCacheToDisk()).resolves.toBeUndefined();
  } finally {
    config.EXPLORER.CACHE_ENABLED = enabled;
    (mempool as any).getMempool = getMempool;
    getBlocks.mockRestore();
    getSummaries.mockRestore();
    write.mockRestore();
  }
});
