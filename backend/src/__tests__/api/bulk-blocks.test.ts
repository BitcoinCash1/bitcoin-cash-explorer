import blocks from '../../api/blocks';
import { Common } from '../../api/common';
import repository from '../../repositories/BlocksRepository';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
jest.mock('../../api/bitcoin/bitcoin-api-factory');
jest.mock('../../api/bitcoin/bitcoin-client');
jest.mock('../../api/disk-cache');
jest.mock('../../api/chain-tips');
jest.mock('../../repositories/BlocksRepository');
afterEach(() => jest.restoreAllMocks());
const block = (height: number) => ({
  height,
  id: String(height),
  extras: { pool: {}, feePercentiles: [], feeRange: [] },
});
it.each(['indexed', 'returned but not persisted'])(
  'advances through %s block results with bounded indexing calls',
  async (mode) => {
    jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
    jest.spyOn(Common, 'blocksSummariesIndexingEnabled').mockReturnValue(false);
    jest
      .mocked(repository.$getBlockByHeight)
      .mockImplementation(async (height) => (mode === 'indexed' ? (block(height) as any) : null));
    jest.mocked(bitcoinApi.$getBlockHash).mockImplementation(async (height) => String(height));
    jest.spyOn(blocks, '$indexBlock').mockImplementation(async (hash) => block(Number(hash)) as any);
    const index = jest.spyOn(blocks, '$indexBlockByHeight');
    const result = await blocks.$getBlocksBetweenHeight(10, 12);
    expect(result.map((b) => b.height)).toEqual([10, 11, 12]);
    expect(index.mock.calls).toEqual([[10], [11], [12]]);
  }
);
it.each(['missing', 'exception'])('stops immediately on an indexing %s', async (failure) => {
  jest.spyOn(Common, 'indexingEnabled').mockReturnValue(true);
  const index = jest.spyOn(blocks, '$indexBlockByHeight');
  if (failure === 'missing') index.mockResolvedValue(null as any);
  else index.mockRejectedValue(new Error('fixture failure'));
  await expect(blocks.$getBlocksBetweenHeight(10, 12)).rejects.toThrow(
    failure === 'missing' ? 'height 10' : 'fixture failure'
  );
  expect(index).toHaveBeenCalledTimes(1);
});
it('does no indexing when disabled or the range is empty', async () => {
  const enabled = jest.spyOn(Common, 'indexingEnabled').mockReturnValue(false);
  const index = jest.spyOn(blocks, '$indexBlockByHeight');
  expect(await blocks.$getBlocksBetweenHeight(10, 12)).toEqual([]);
  enabled.mockReturnValue(true);
  expect(await blocks.$getBlocksBetweenHeight(12, 10)).toEqual([]);
  expect(index).not.toHaveBeenCalled();
});
