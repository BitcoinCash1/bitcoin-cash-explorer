import mining from '../../../api/mining/mining';
import DB from '../../../database';
import PricesRepository from '../../../repositories/PricesRepository';

jest.mock('../../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('../../../repositories/PricesRepository');

// Exercise the real repository's failure handling, rather than assuming a rejected write reaches mining.
test('a failed database write is not acknowledged as a completed price retry', async () => {
  jest.mocked(PricesRepository.$getPricesTimesAndId).mockResolvedValue([{ id: 1, time: 200 }] as never);
  let failWrite = true;
  jest.mocked(DB.query).mockImplementation(async (sql) => {
    if (String(sql).includes('INSERT INTO blocks_prices')) {
      if (failWrite) {
        throw new Error('fixture write failure');
      }
      return [] as never;
    }
    return [[{ height: 100000, timestamp: 100 }]] as never;
  });
  expect(await mining.$indexBlockPrices([100000])).toEqual([]);
  failWrite = false;
  expect(await mining.$indexBlockPrices([100000])).toEqual([100000]);
});

test('price lookup preserves strict timestamp boundaries and handles nonmonotonic block times', async () => {
  const prices = [10, 20, 20, 40, 70].map((time, i) => ({ time, id: i + 1, USD: 1 }));
  const times = [20, 9, 70, 40, 10, 19, 21, 71, 39, 69];
  const rows = times.map((timestamp, i) => ({ height: 100000 + i, timestamp }));
  jest.mocked(PricesRepository.$getPricesTimesAndId).mockResolvedValue(prices);
  const writes: string[] = [];
  jest.mocked(DB.query).mockImplementation(async (sql) => {
    if (String(sql).includes('INSERT INTO blocks_prices')) {
      writes.push(String(sql));
      return [] as never;
    }
    return [rows] as never;
  });
  const expected = rows.flatMap((row) => {
    const price = prices.find((price) => row.timestamp < price.time);
    return price ? [{ height: row.height, priceId: price.id }] : [];
  });
  expect(await mining.$indexBlockPrices(rows.map((row) => row.height))).toEqual(expected.map((row) => row.height));
  expect(writes).toEqual([
    `INSERT INTO blocks_prices(height, price_id) VALUES ${expected.map((row) => `(${row.height}, ${row.priceId})`).join(', ')} ON DUPLICATE KEY UPDATE price_id = VALUES(price_id)`,
  ]);
});

test('an already reconciled chain does not load the price history', async () => {
  jest.mocked(PricesRepository.$getPricesTimesAndId).mockClear();
  jest.mocked(DB.query).mockResolvedValue([[]] as never);
  expect(await mining.$indexBlockPrices()).toEqual([]);
  expect(await mining.$indexBlockPrices([])).toEqual([]);
  expect(PricesRepository.$getPricesTimesAndId).not.toHaveBeenCalled();
});

test('pre-feed blocks still use the first available price', async () => {
  jest.mocked(PricesRepository.$getPricesTimesAndId).mockResolvedValue([{ id: 17, time: 200, USD: 1 }]);
  const writes: string[] = [];
  jest.mocked(DB.query).mockImplementation(async (sql) => {
    if (String(sql).includes('INSERT INTO blocks_prices')) {
      writes.push(String(sql));
      return [] as never;
    }
    return [[{ height: 68950, timestamp: 300 }]] as never;
  });
  expect(await mining.$indexBlockPrices()).toEqual([68950]);
  expect(writes[0]).toContain('(68950, 17)');
});
