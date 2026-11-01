import indexer from '../../indexer';
import mining from '../../api/mining/mining';
import config from '../../config';
import { Common } from '../../api/common';

jest.mock('../../api/common', () => ({ Common: { indexingEnabled: jest.fn(() => true) } }));
jest.mock('../../api/mining/mining', () => ({ __esModule: true, default: { $indexBlockPrices: jest.fn() } }));
jest.mock('../../repositories/PricesRepository', () => ({
  __esModule: true,
  default: { $getLatestPriceId: async () => 1 },
}));
jest.mock('../../tasks/price-updater', () => ({ __esModule: true, default: { historyInserted: true } }));

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  jest.mocked(Common.indexingEnabled).mockReturnValue(true);
  config.EXPLORER.NETWORK = 'mainnet';
  config.FIAT_PRICE.ENABLED = true;
});
afterEach(() => {
  jest.clearAllTimers();
  const state = indexer as unknown as { pendingBlockPrices: Set<number>; tasksScheduled: object };
  state.pendingBlockPrices.clear();
  state.tasksScheduled = {};
  jest.useRealTimers();
});

test('deduplicates heights, retains failed work, and schedules again after completion', async () => {
  const run = mining.$indexBlockPrices as jest.Mock;
  run.mockResolvedValueOnce([]).mockImplementation(async (heights) => heights);
  indexer.queueBlockPrice(10);
  indexer.queueBlockPrice(10);
  await jest.advanceTimersByTimeAsync(10000);
  expect(run).toHaveBeenNthCalledWith(1, [10]);
  await jest.advanceTimersByTimeAsync(10000);
  expect(run).toHaveBeenNthCalledWith(2, [10]);
  indexer.queueBlockPrice(11);
  await jest.advanceTimersByTimeAsync(10000);
  expect(run).toHaveBeenNthCalledWith(3, [11]);
});

test('retries after an unexpected task failure and releases the running guard', async () => {
  const run = mining.$indexBlockPrices as jest.Mock;
  run
    .mockReset()
    .mockRejectedValueOnce(new Error('unexpected failure'))
    .mockImplementation(async (heights) => heights);
  indexer.queueBlockPrice(12);
  await jest.advanceTimersByTimeAsync(10000);
  await jest.advanceTimersByTimeAsync(10000);
  expect(run).toHaveBeenCalledTimes(2);
  expect(run).toHaveBeenLastCalledWith([12]);
});

test.each(['testnet4', 'chipnet', 'scalenet', 'disabled fiat', 'disabled indexing'])(
  'does not retain price retries for %s',
  async (scenario) => {
    if (scenario === 'disabled fiat') {
      config.FIAT_PRICE.ENABLED = false;
    } else if (scenario === 'disabled indexing') {
      jest.mocked(Common.indexingEnabled).mockReturnValue(false);
    } else {
      config.EXPLORER.NETWORK = scenario;
    }
    for (let height = 0; height < 10000; height++) {
      indexer.queueBlockPrice(height);
    }
    await indexer.runSingleTask('blocksPrices');
    expect((indexer as unknown as { pendingBlockPrices: Set<number> }).pendingBlockPrices.size).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    expect(mining.$indexBlockPrices).not.toHaveBeenCalled();
  }
);

test('drains bounded batches and preserves heights queued while a batch is running', async () => {
  const run = jest.mocked(mining.$indexBlockPrices);
  run.mockReset().mockImplementation(async (heights) => {
    if (heights?.includes(0)) {
      indexer.queueBlockPrice(2000);
    }
    return heights || [];
  });
  for (let height = 0; height < 1005; height++) {
    indexer.queueBlockPrice(height);
  }
  await jest.advanceTimersByTimeAsync(10000);
  expect(run.mock.calls[0][0]).toHaveLength(1000);
  await jest.advanceTimersByTimeAsync(10000);
  expect(run).toHaveBeenLastCalledWith([1000, 1001, 1002, 1003, 1004, 2000]);
  expect((indexer as unknown as { pendingBlockPrices: Set<number> }).pendingBlockPrices.size).toBe(0);
  expect(jest.getTimerCount()).toBe(0);
});
