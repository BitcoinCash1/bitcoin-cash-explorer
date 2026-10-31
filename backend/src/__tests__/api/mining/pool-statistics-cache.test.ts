import cache from '../../../api/mining/pool-statistics-cache';
import valkey from '../../../api/valkey-cache';
import config from '../../../config';

jest.mock('../../../api/valkey-cache', () => ({
  __esModule: true,
  default: { $getCache: jest.fn(), $setCache: jest.fn() },
}));
const values = new Map<string, string>();
beforeEach(async () => {
  values.clear();
  config.VALKEY.ENABLED = true;
  (valkey.$getCache as jest.Mock).mockImplementation(async (key) => values.get(key) ?? null);
  (valkey.$setCache as jest.Mock).mockImplementation(async (key, value) => {
    values.set(key, value);
  });
  await cache.invalidate();
});

test('shares pending computations and caches for 30 seconds', async () => {
  const compute = jest.fn(async () => ({ count: 10 }));
  expect(await Promise.all([cache.get(1, compute), cache.get(1, compute)])).toEqual([{ count: 10 }, { count: 10 }]);
  await cache.get(1, compute);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(valkey.$setCache).toHaveBeenCalledWith(expect.any(String), expect.any(String), 30);
});

test('invalidates all pools and isolates pool keys', async () => {
  const compute = jest.fn(async () => ({ count: 10 }));
  await cache.get(1, compute);
  await cache.get(2, compute);
  await cache.invalidate();
  await cache.get(1, compute);
  expect(compute).toHaveBeenCalledTimes(3);
});

test('retries a computation invalidated while pending', async () => {
  const compute = jest
    .fn()
    .mockImplementationOnce(async () => {
      await cache.invalidate();
      return { count: 1 };
    })
    .mockResolvedValue({ count: 2 });
  expect(await cache.get(1, compute)).toEqual({ count: 2 });
  expect(compute).toHaveBeenCalledTimes(2);
});

test('does not cache failures and releases pending requests', async () => {
  const compute = jest.fn().mockRejectedValueOnce(new Error('database unavailable')).mockResolvedValue({ count: 2 });
  await expect(cache.get(1, compute)).rejects.toThrow('database unavailable');
  expect(await cache.get(1, compute)).toEqual({ count: 2 });
});

test('computes without persistent caching when Valkey is disabled', async () => {
  config.VALKEY.ENABLED = false;
  const compute = jest.fn(async () => ({ count: 1 }));
  await Promise.all([cache.get(1, compute), cache.get(1, compute)]);
  await cache.get(1, compute);
  expect(compute).toHaveBeenCalledTimes(2);
});
