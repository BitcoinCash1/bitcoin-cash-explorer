import DB from '../../database';
import prices from '../../repositories/PricesRepository';
jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));

it('normalizes database timestamps to numeric Set membership and removes duplicates', async () => {
  jest.mocked(DB.query).mockResolvedValue([[{ time: '100' }, { time: 200 }, { time: 100 }]] as any);
  const result = await prices.$getPricesTimes();
  expect(result).toEqual(new Set([100, 200]));
  expect(result.has(100)).toBe(true);
  expect(result.has(300)).toBe(false);
});
it.each([[], null])('returns an empty Set for empty or unavailable rows', async (rows) => {
  jest.mocked(DB.query).mockResolvedValue([rows] as any);
  expect(await prices.$getPricesTimes()).toEqual(new Set());
});
