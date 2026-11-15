import prices from '../../repositories/PricesRepository';
import updater from '../../tasks/price-updater';
import KrakenApi from '../../tasks/price-feeds/kraken-api';
import { query } from '../../utils/axios-query';
jest.mock('../../repositories/PricesRepository', () => ({
  __esModule: true,
  default: { $getPricesTimes: jest.fn(), $savePrices: jest.fn() },
  MAX_PRICES: { USD: 10000000, EUR: 10000000 },
}));
jest.mock('../../utils/axios-query', () => ({ query: jest.fn() }));
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it('skips existing MtGox timestamps using the Set and keeps importing new timestamps', async () => {
  jest.mocked(prices.$getPricesTimes).mockResolvedValue(new Set([100]));
  jest.spyOn(updater as any, 'loadMtGoxPrices').mockReturnValue([
    { ct: 100, c: 1 },
    { ct: 200, c: 2 },
  ]);
  jest.spyOn(KrakenApi.prototype, '$insertHistoricalPrice').mockResolvedValue();
  jest.spyOn(updater as any, '$insertMissingRecentPrices').mockResolvedValue();
  await (updater as any).$insertHistoricalPrices();
  expect(prices.$savePrices).toHaveBeenCalledTimes(1);
  expect(prices.$savePrices).toHaveBeenCalledWith(200, expect.objectContaining({ USD: 2 }));
});
it.each(['day', 'hour'])(
  'skips stored recent %s prices and groups duplicate exchange times before saving',
  async (type) => {
    jest.mocked(prices.$getPricesTimes).mockResolvedValue(new Set([100]));
    const originalFeeds = (updater as any).feeds;
    const originalCurrencies = (updater as any).currencies;
    try {
      (updater as any).currencies = ['USD'];
      (updater as any).feeds = [
        { $fetchRecentPrice: async () => ({ 100: { USD: 1 }, 200: { USD: 20 } }) },
        { $fetchRecentPrice: async () => ({ 200: { USD: 40 } }) },
      ];
      await (updater as any).$insertMissingRecentPrices(type);
      expect(prices.$savePrices).toHaveBeenCalledTimes(1);
      expect(prices.$savePrices).toHaveBeenCalledWith(200, expect.objectContaining({ USD: 30 }));
    } finally {
      (updater as any).feeds = originalFeeds;
      (updater as any).currencies = originalCurrencies;
    }
  }
);
it('checks numeric membership in both Kraken BTC and BCH history loops', async () => {
  const before = 1500000000,
    after = 1502000000;
  jest.mocked(prices.$getPricesTimes).mockResolvedValue(new Set([before, after]));
  const kraken = new KrakenApi();
  kraken.currencies = ['USD'];
  jest
    .mocked(query)
    .mockResolvedValueOnce({
      result: {
        XXBTZUSD: [
          [String(before), 0, 0, 0, 1],
          [String(before + 1), 0, 0, 0, 2],
          [String(after), 0, 0, 0, 3],
        ],
      },
    })
    .mockResolvedValueOnce({
      result: {
        BCHUSD: [
          [String(before), 0, 0, 0, 1],
          [String(after), 0, 0, 0, 3],
          [String(after + 1), 0, 0, 0, 4],
        ],
      },
    });
  await kraken.$insertHistoricalPrice();
  expect(prices.$savePrices).toHaveBeenCalledTimes(2);
  expect(prices.$savePrices).toHaveBeenCalledWith(before + 1, expect.objectContaining({ USD: 2 }));
  expect(prices.$savePrices).toHaveBeenCalledWith(after + 1, expect.objectContaining({ USD: 4 }));
});
