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
