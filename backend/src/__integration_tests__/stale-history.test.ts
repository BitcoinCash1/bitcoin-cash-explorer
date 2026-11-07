import DB from '../database';
import BlocksRepository from '../repositories/BlocksRepository';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import config from '../config';
import { decodeStaleHistoryCursor } from '../api/stale-history';
import { cleanupTestData, insertTestBlock, setupTestDatabase, waitForDatabase } from './test-helpers';

const hash = (value: number) => value.toString(16).padStart(64, '0');

beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
}, 120000);

beforeEach(async () => {
  await cleanupTestData();
});

test('pages duplicate heights without skips, keeps missing counterparts, and exhausts successfully', async () => {
  // The first page ends halfway through a height. No pool row is required.
  for (let i = 1; i <= 57; i++) {
    await insertTestBlock({ height: i <= 30 ? 100 : 99, hash: hash(i) });
  }
  await DB.query('UPDATE blocks SET stale = 1');
  await insertTestBlock({ height: 100, hash: hash(1000) });
  await DB.query(
    'UPDATE blocks SET abla_block_size = 123, abla_block_size_limit = 32000000, abla_next_block_size_limit = 32000123'
  );
  const rpc = jest.spyOn(bitcoinClient, 'getBlock').mockRejectedValue(new Error('History must not call RPC'));
  const query = jest.spyOn(DB, 'query');
  const oldSummarySetting = config.EXPLORER.BLOCKS_SUMMARIES_INDEXING;
  const oldAuditSetting = config.EXPLORER.AUDIT;
  config.EXPLORER.BLOCKS_SUMMARIES_INDEXING = true;
  config.EXPLORER.AUDIT = true;
  try {
    const first = await BlocksRepository.$getStaleHistory();
    expect(query).toHaveBeenCalledTimes(1);
    expect(first.entries).toHaveLength(25);
    expect(first.entries[0].stale.id).toBe(hash(30));
    expect(first.entries[24].stale.id).toBe(hash(6));
    expect(first.entries.every((entry) => entry.canonical?.id === hash(1000))).toBe(true);
    expect(first.entries[0].stale.abla_state).toEqual({
      block_size: 123,
      block_size_limit: 32000000,
      next_block_size_limit: 32000123,
    });
    expect(first.entries[0]).not.toHaveProperty('status');
    expect(first.entries[0]).not.toHaveProperty('branchlen');
    const second = await BlocksRepository.$getStaleHistory(decodeStaleHistoryCursor(first.nextCursor));
    expect(second.entries).toHaveLength(25);
    expect(second.entries[0].stale.id).toBe(hash(5));
    expect(second.entries[5].canonical).toBeNull();
    const third = await BlocksRepository.$getStaleHistory(decodeStaleHistoryCursor(second.nextCursor));
    expect(third.entries).toHaveLength(7);
    expect(third.nextCursor).toBeNull();
    const all = [...first.entries, ...second.entries, ...third.entries];
    expect(new Set(all.map((entry) => entry.stale.id)).size).toBe(57);
    const exhausted = await BlocksRepository.$getStaleHistory({ height: 0, hash: hash(0) });
    expect(exhausted).toEqual({ entries: [], nextCursor: null });
    expect(rpc).not.toHaveBeenCalled();
  } finally {
    config.EXPLORER.BLOCKS_SUMMARIES_INDEXING = oldSummarySetting;
    config.EXPLORER.AUDIT = oldAuditSetting;
    query.mockRestore();
    rpc.mockRestore();
  }
});

test('reads the current canonical counterpart after reclassification, without cached pairings', async () => {
  await insertTestBlock({ height: 100, hash: hash(1) });
  await insertTestBlock({ height: 100, hash: hash(2) });
  await DB.query('UPDATE blocks SET stale = 1 WHERE hash = ?', [hash(1)]);
  expect((await BlocksRepository.$getStaleHistory()).entries[0].canonical?.id).toBe(hash(2));
  await DB.query('UPDATE blocks SET stale = CASE WHEN hash = ? THEN 0 ELSE 1 END', [hash(1)]);
  const page = await BlocksRepository.$getStaleHistory();
  expect(page.entries.map((entry) => [entry.stale.id, entry.canonical?.id])).toEqual([[hash(2), hash(1)]]);
});

test('ambiguous canonical flags during reorg do not duplicate entries or invent a winning block', async () => {
  for (let i = 1; i <= 3; i++) {
    await insertTestBlock({ height: 100, hash: hash(i) });
  }
  await DB.query('UPDATE blocks SET stale = 1 WHERE hash = ?', [hash(1)]);
  const page = await BlocksRepository.$getStaleHistory();
  expect(page.entries).toHaveLength(1);
  expect(page.entries[0].stale.id).toBe(hash(1));
  expect(page.entries[0].canonical).toBeNull();
  expect(page.nextCursor).toBeNull();
});

test('an empty database returns an exhausted page', async () => {
  expect(await BlocksRepository.$getStaleHistory()).toEqual({ entries: [], nextCursor: null });
});
