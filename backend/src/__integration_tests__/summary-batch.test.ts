import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import summaries from '../repositories/BlocksSummariesRepository';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import blockApi from '../api/blocks';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool, insertTestBlock } from './test-helpers';

const transactions = [{ fee: 999 }, ...Array.from({ length: 10 }, (_, i) => ({ fee: 10 - i }))];
const percentiles = [1, 1, 2, 5, 7, 9, 10];
const originalAudit = config.EXPLORER.AUDIT;
const originalIndexing = config.EXPLORER.BLOCKS_SUMMARIES_INDEXING;
const hash = (i: number) => i.toString(16).padStart(64, '0');
beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
}, 120000);
beforeEach(async () => {
  await cleanupTestData();
  config.EXPLORER.AUDIT = false;
  config.EXPLORER.BLOCKS_SUMMARIES_INDEXING = true;
});
afterEach(() => {
  jest.restoreAllMocks();
  config.EXPLORER.AUDIT = originalAudit;
  config.EXPLORER.BLOCKS_SUMMARIES_INDEXING = originalIndexing;
});

it('batch-loads 100 existing summaries and persists the same repaired fee fields', async () => {
  const poolId = await insertTestPool({ name: 'Fixture', slug: 'fixture' });
  for (let i = 1; i <= 100; i++) {
    await insertTestBlock({ height: 800000 + i, hash: hash(i), poolId });
    await summaries.$saveTransactions(800000 + i, hash(i), transactions as any, 0);
  }
  const query = jest.spyOn(DB, 'query');
  const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId');
  const result = await blocks.$getBlocksByPool('fixture');
  const reads = query.mock.calls.filter(([sql]) => String(sql).includes('FROM blocks_summaries'));
  expect(reads).toHaveLength(1);
  expect(single).not.toHaveBeenCalled();
  expect(result).toHaveLength(100);
  for (const b of result) {
    expect(b.extras.feePercentiles).toEqual(percentiles);
    expect(b.extras.medianFeeAmt).toBe(5);
  }
  const [stored]: any = await DB.query('SELECT fee_percentiles, median_fee_amt FROM blocks');
  expect(
    stored.every(
      (b) => JSON.stringify(JSON.parse(b.fee_percentiles)) === JSON.stringify(percentiles) && b.median_fee_amt === 5
    )
  ).toBe(true);
  query.mockClear();
  await blocks.$getBlocksByPool('fixture');
  expect(query.mock.calls.filter(([sql]) => String(sql).includes('FROM blocks_summaries'))).toHaveLength(0);
});

it('repairs a genuinely missing summary using RPC and re-reads the newly saved summary', async () => {
  const poolId = await insertTestPool({ name: 'Fixture', slug: 'fixture' });
  await insertTestBlock({ height: 800001, hash: hash(1), poolId });
  const rpc = jest.spyOn(bitcoinClient, 'getBlock').mockResolvedValue({ tx: [] } as any);
  jest.spyOn(blockApi, 'summarizeBlock').mockReturnValue({ transactions } as any);
  const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId');
  const result = await blocks.$getBlocksByPool('fixture');
  expect(rpc).toHaveBeenCalledWith(hash(1), 2);
  expect(single.mock.calls).toEqual([[hash(1)]]);
  expect(result[0].extras.feePercentiles).toEqual(percentiles);
  const [rows]: any = await DB.query('SELECT transactions FROM blocks_summaries WHERE id = ?', [hash(1)]);
  expect(JSON.parse(rows[0].transactions)).toEqual(transactions);
});
