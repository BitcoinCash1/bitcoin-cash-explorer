import DB from '../../database';
import { Common } from '../../api/common';
import blocks from '../../repositories/BlocksRepository';
import summaries from '../../repositories/BlocksSummariesRepository';
import pools from '../../repositories/PoolsRepository';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import blockApi from '../../api/blocks';
import config from '../../config';
jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../api/bitcoin/bitcoin-client');
jest.mock('../../api/chain-tips', () => ({ __esModule: true, default: { getOrphanedBlocksAtHeight: () => [] } }));
jest.mock('../../api/mining/pool-statistics-cache', () => ({ __esModule: true, default: { invalidate: jest.fn() } }));
const transactions = [{ fee: 999 }, ...Array.from({ length: 10 }, (_, i) => ({ fee: 10 - i }))];
const percentiles = [1, 1, 2, 5, 7, 9, 10];
const row = (i: number) => ({
  id: String(i),
  height: 1000 - i,
  feeRange: '[]',
  feePercentiles: null,
  medianFeeAmt: null,
  poolName: 'fixture',
});
const originalAudit = config.EXPLORER.AUDIT;
beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  config.EXPLORER.AUDIT = false;
  jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(true);
  jest.spyOn(pools, '$getPool').mockResolvedValue({ id: 1 } as any);
  jest.spyOn(blocks, '$updateFeeAmounts').mockResolvedValue();
});
afterAll(() => {
  config.EXPLORER.AUDIT = originalAudit;
});

it.each([0, 1, 100])('uses zero/one summary reads for %i affected pool blocks', async (count) => {
  const rows = Array.from({ length: count }, (_, i) => row(i));
  jest
    .mocked(DB.query)
    .mockImplementation(
      async (sql: any) =>
        [
          String(sql).includes('FROM blocks_summaries')
            ? rows.map((r) => ({ id: r.id, transactions: JSON.stringify(transactions) }))
            : rows,
        ] as any
    );
  const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId');
  const result = await blocks.$getBlocksByPool('fixture');
  const reads = jest.mocked(DB.query).mock.calls.filter(([sql]) => String(sql).includes('FROM blocks_summaries'));
  expect(reads).toHaveLength(count ? 1 : 0);
  expect(single).not.toHaveBeenCalled();
  expect(blocks.$updateFeeAmounts).toHaveBeenCalledTimes(count);
  for (const b of result) {
    expect(b.extras.feePercentiles).toEqual(percentiles);
    expect(b.extras.medianFeeAmt).toBe(5);
  }
  // The previous per-block lookup path must produce the identical public DTO.
  single.mockResolvedValue(percentiles);
  const expected = await Promise.all(rows.map((r) => (blocks as any).formatDbBlockIntoExtendedBlock(r)));
  expect(result).toEqual(expected);
});

it.each([null, 'null', '{invalid'])(
  'repairs a genuinely missing or unusable summary (%s) and re-reads only that repaired block',
  async (json) => {
    jest
      .mocked(DB.query)
      .mockImplementation(
        async (sql: any) =>
          [
            String(sql).includes('FROM blocks_summaries')
              ? [
                  { id: '0', transactions: JSON.stringify(transactions) },
                  ...(json === null ? [] : [{ id: '1', transactions: json }]),
                ]
              : [row(0), row(1)],
          ] as any
      );
    jest.mocked(bitcoinClient.getBlock).mockResolvedValue({ tx: [] } as any);
    jest.spyOn(blockApi, 'summarizeBlock').mockReturnValue({ transactions } as any);
    const save = jest.spyOn(summaries, '$saveTransactions').mockResolvedValue();
    const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId').mockResolvedValue(percentiles);
    const result = await blocks.$getBlocksByPool('fixture');
    expect(bitcoinClient.getBlock).toHaveBeenCalledTimes(1);
    expect(bitcoinClient.getBlock).toHaveBeenCalledWith('1', 2);
    expect(save).toHaveBeenCalledWith(999, '1', transactions, 0);
    expect(single.mock.calls).toEqual([['1']]);
    expect(result.map((b) => b.extras.feePercentiles)).toEqual([percentiles, percentiles]);
  }
);

it('does no summary reads for complete fee fields or disabled enrichment', async () => {
  jest.mocked(DB.query).mockResolvedValue([[{ ...row(0), feePercentiles: '[]', medianFeeAmt: 0 }]] as any);
  await blocks.$getBlocksByPool('fixture');
  expect(DB.query).toHaveBeenCalledTimes(1);
  jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(false);
  jest.mocked(DB.query).mockResolvedValue([[row(0)]] as any);
  await blocks.$getBlocksByPool('fixture');
  expect(DB.query).toHaveBeenCalledTimes(2);
  const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId');
  jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(true);
  await (blocks as any).formatDbBlockIntoExtendedBlock(row(0), false);
  expect(single).not.toHaveBeenCalled();
});

it('retains single-block lookup and repair behaviour when not prefetched', async () => {
  const single = jest.spyOn(summaries, '$getFeePercentilesByBlockId').mockResolvedValue(percentiles);
  const result = await (blocks as any).formatDbBlockIntoExtendedBlock(row(0));
  expect(single).toHaveBeenCalledWith('0');
  expect(result.extras.feePercentiles).toEqual(percentiles);
});

it('treats a failed batch read as unavailable summaries without individual fallback reads', async () => {
  jest.mocked(DB.query).mockRejectedValue(new Error('unavailable'));
  expect(await summaries.$getFeePercentilesByBlockIds(['0'])).toEqual(new Map());
});

it('deduplicates summary IDs and calculates empty/coinbase-only percentiles consistently', async () => {
  jest.mocked(DB.query).mockResolvedValue([
    [
      { id: '0', transactions: '[]' },
      { id: '1', transactions: '[{"fee":999}]' },
    ],
  ] as any);
  const result = await summaries.$getFeePercentilesByBlockIds(['0', '1', '0']);
  expect(jest.mocked(DB.query).mock.calls[0][1]).toEqual(['0', '1']);
  expect(result.get('0')).toEqual([0, 0, 0, 0, 0, 0, 0]);
  expect(result.get('1')).toEqual([0, 0, 0, 0, 0, 0, 0]);
});
