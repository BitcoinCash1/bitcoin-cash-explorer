import DB from '../../database';
import config from '../../config';
import audits from '../../repositories/BlocksAuditsRepository';
import blocks from '../../repositories/BlocksRepository';
import pools from '../../repositories/PoolsRepository';
jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../api/mining/pool-statistics-cache', () => ({ __esModule: true, default: { invalidate: jest.fn() } }));
jest.mock('../../api/chain-tips', () => ({
  __esModule: true,
  default: { getOrphanedBlocksAtHeight: jest.fn(() => []) },
}));

const originalAudit = config.EXPLORER.AUDIT;
const row = (i: number) => ({
  id: String(i),
  height: 1000 - i,
  feeRange: '[]',
  feePercentiles: '[]',
  medianFeeAmt: 0,
  poolName: 'fixture',
  poolId: 1,
  poolSlug: 'fixture',
  ablaBlockSize: 1000000,
  ablaBlockSizeLimit: 32000000,
  ablaNextBlockSizeLimit: 32000000,
});
const score = (i: number) => ({ hash: String(i), matchRate: 99, expectedFees: 100, expectedSize: 1234567 });
beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  config.EXPLORER.AUDIT = true;
});
afterAll(() => {
  config.EXPLORER.AUDIT = originalAudit;
});

it.each([0, 1, 100])('fetches %i hashes in zero/one parameterized audit query', async (count) => {
  jest.mocked(DB.query).mockResolvedValue([[score(0)]] as any);
  const hashes = Array.from({ length: count }, (_, i) => String(i));
  const result = await audits.$getBlockAuditScoresByHashes(hashes);
  expect(DB.query).toHaveBeenCalledTimes(count ? 1 : 0);
  if (count) {
    expect(jest.mocked(DB.query).mock.calls[0][1]).toEqual(hashes);
    expect(result.get('0')).toEqual(score(0));
    expect(result.get('missing')).toBeUndefined();
  }
});
it('deduplicates hashes before generating placeholders', async () => {
  jest.mocked(DB.query).mockResolvedValue([[score(0)]] as any);
  await audits.$getBlockAuditScoresByHashes(['0', '0']);
  expect(jest.mocked(DB.query).mock.calls[0][1]).toEqual(['0']);
});
it.each([0, 1, 100])('enriches %i pool rows without individual fallback queries', async (count) => {
  const rows = Array.from({ length: count }, (_, i) => row(i));
  jest.spyOn(pools, '$getPool').mockResolvedValue({ id: 1 } as any);
  jest
    .mocked(DB.query)
    .mockImplementation(async (sql: any) => [String(sql).includes('FROM blocks_audits') ? [score(0)] : rows] as any);
  const single = jest.spyOn(audits, '$getBlockAuditScore');
  const result = await blocks.$getBlocksByPool('fixture', 2000);
  expect(DB.query).toHaveBeenCalledTimes(count ? 2 : 1);
  expect(single).not.toHaveBeenCalled();
  expect(jest.mocked(DB.query).mock.calls[0][0]).toContain('FORCE INDEX (pool_stale_height)');
  expect(jest.mocked(DB.query).mock.calls[0][0]).toContain('stale = 0');
  expect(jest.mocked(DB.query).mock.calls[0][0]).toContain('ORDER BY height DESC');
  expect(jest.mocked(DB.query).mock.calls[0][1]).toEqual([1, 2000]);
  // Compare every formatted field with the original per-block enrichment path.
  single.mockImplementation(async (hash) => (hash === '0' ? score(0) : (undefined as any)));
  const expected = await Promise.all(rows.map((r) => (blocks as any).formatDbBlockIntoExtendedBlock(r)));
  expect(result).toEqual(expected);
  if (count) {
    expect(result[0].extras.expectedSize).toBe(1234567);
    expect(result[0].abla_state.block_size_limit).toBe(32000000);
  }
});
it('skips audits when disabled or formatting is not enriched, retaining single-block fallback otherwise', async () => {
  const single = jest.spyOn(audits, '$getBlockAuditScore').mockResolvedValue(score(0));
  jest.spyOn(pools, '$getPool').mockResolvedValue({ id: 1 } as any);
  jest.mocked(DB.query).mockResolvedValue([[row(0)]] as any);
  config.EXPLORER.AUDIT = false;
  const result = await blocks.$getBlocksByPool('fixture');
  expect(DB.query).toHaveBeenCalledTimes(1);
  expect(result[0].extras.expectedSize).toBeNull();
  expect(single).not.toHaveBeenCalled();
  config.EXPLORER.AUDIT = true;
  await (blocks as any).formatDbBlockIntoExtendedBlock(row(0), false);
  await (blocks as any).formatDbBlockIntoExtendedBlock(row(0), true, null);
  expect(single).not.toHaveBeenCalled();
  await (blocks as any).formatDbBlockIntoExtendedBlock(row(0));
  expect(single).toHaveBeenCalledWith('0');
});
