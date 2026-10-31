import indexer from '../../indexer';
import mining from '../../api/mining/mining';
import config from '../../config';

jest.mock('../../api/common', () => ({ Common: { indexingEnabled: () => true } }));
jest.mock('../../api/mining/mining', () => ({ __esModule: true, default: { $indexBlockPrices: jest.fn() } }));
jest.mock('../../repositories/PricesRepository', () => ({
  __esModule: true,
  default: { $getLatestPriceId: async () => 1 },
}));
jest.mock('../../tasks/price-updater', () => ({ __esModule: true, default: { historyInserted: true } }));

beforeEach(() => {
  jest.useFakeTimers();
  config.EXPLORER.NETWORK = 'mainnet';
  config.FIAT_PRICE.ENABLED = true;
});
afterEach(() => jest.useRealTimers());

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
