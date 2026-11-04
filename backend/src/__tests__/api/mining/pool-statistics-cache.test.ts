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

test('shares pending computations and caches for two minutes', async () => {
  const compute = jest.fn(async () => ({ value: { count: 10 }, cacheable: true }));
  expect(await Promise.all([cache.get(1, compute), cache.get(1, compute)])).toEqual([
    { value: { count: 10 }, cacheable: true },
    { value: { count: 10 }, cacheable: true },
  ]);
  await cache.get(1, compute);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(valkey.$setCache).toHaveBeenCalledWith(expect.any(String), expect.any(String), 120);
});

test('invalidates all pools and isolates pool keys', async () => {
  const compute = jest.fn(async () => ({ value: { count: 10 }, cacheable: true }));
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
      return { value: { count: 1 }, cacheable: true };
    })
    .mockResolvedValue({ value: { count: 2 }, cacheable: true });
  expect(await cache.get(1, compute)).toEqual({ value: { count: 2 }, cacheable: true });
  expect(compute).toHaveBeenCalledTimes(2);
});

test('does not cache failures and releases pending requests', async () => {
  const compute = jest
    .fn()
    .mockRejectedValueOnce(new Error('database unavailable'))
    .mockResolvedValue({ value: { count: 2 }, cacheable: true });
  await expect(cache.get(1, compute)).rejects.toThrow('database unavailable');
  expect(await cache.get(1, compute)).toEqual({ value: { count: 2 }, cacheable: true });
});

test('computes without persistent caching when Valkey is disabled', async () => {
  config.VALKEY.ENABLED = false;
  const compute = jest.fn(async () => ({ value: { count: 1 }, cacheable: true }));
  await Promise.all([cache.get(1, compute), cache.get(1, compute)]);
  await cache.get(1, compute);
  expect(compute).toHaveBeenCalledTimes(2);
});

test('unavailable Valkey does not cause duplicate fallback computations', async () => {
  (valkey.$getCache as jest.Mock).mockResolvedValue(null);
  const compute = jest.fn(async () => ({ value: { count: 1 }, cacheable: true }));
  expect(await cache.get(1, compute)).toEqual({ value: { count: 1 }, cacheable: true });
  expect(compute).toHaveBeenCalledTimes(1);
});

test('shares a degraded calculation without storing it, then caches recovery', async () => {
  const degraded = { value: { estimatedHashrate: 0 }, cacheable: false };
  const recovered = { value: { estimatedHashrate: 100 }, cacheable: true };
  const compute = jest.fn().mockResolvedValueOnce(degraded).mockResolvedValue(recovered);
  jest.mocked(valkey.$setCache).mockClear();
  expect(await Promise.all([cache.get(1, compute), cache.get(1, compute)])).toEqual([degraded, degraded]);
  expect(compute).toHaveBeenCalledTimes(1);
  expect(valkey.$setCache).not.toHaveBeenCalled();
  expect(await cache.get(1, compute)).toEqual(recovered);
  expect(await cache.get(1, compute)).toEqual(recovered);
  expect(compute).toHaveBeenCalledTimes(2);
  expect(valkey.$setCache).toHaveBeenCalledWith(expect.stringMatching(/:1$/), JSON.stringify(recovered.value), 120);
});

test.each([false, true])(
  'does not retain degraded results when Valkey is unavailable (disabled=%s)',
  async (disabled) => {
    config.VALKEY.ENABLED = !disabled;
    jest.mocked(valkey.$getCache).mockResolvedValue(null);
    const result = { value: { estimatedHashrate: 0 }, cacheable: false };
    const compute = jest.fn().mockResolvedValue(result);
    expect(await Promise.all([cache.get(1, compute), cache.get(1, compute)])).toEqual([result, result]);
    expect(compute).toHaveBeenCalledTimes(1);
    await cache.get(1, compute);
    expect(compute).toHaveBeenCalledTimes(2);
  }
);

test('bounds recalculation when every degraded result is invalidated', async () => {
  const result = { value: { estimatedHashrate: 0 }, cacheable: false };
  const compute = jest.fn(async () => {
    await cache.invalidate();
    return result;
  });
  expect(await cache.get(1, compute)).toEqual(result);
  expect(compute).toHaveBeenCalledTimes(2);
  expect([...values.keys()].filter((key) => !key.endsWith(':generation'))).toHaveLength(0);
});

test('overview keys isolate intervals, pools, networks and databases', async () => {
  const compute = jest.fn(async () => ({ value: { count: 10 }, cacheable: true }));
  const network = config.EXPLORER.NETWORK;
  const database = config.DATABASE.DATABASE;
  try {
    await cache.getOverview('1m', compute);
    await cache.getOverview('1m', compute);
    await cache.getOverview('1w', compute);
    await cache.get(1, compute);
    config.DATABASE.DATABASE = 'isolated';
    await cache.getOverview('1m', compute);
    config.EXPLORER.NETWORK = 'chipnet';
    await cache.getOverview('1m', compute);
    expect(compute).toHaveBeenCalledTimes(5);
  } finally {
    config.EXPLORER.NETWORK = network;
    config.DATABASE.DATABASE = database;
  }
});

test('overview expiration, malformed data and invalidation force fresh calculations', async () => {
  const compute = jest.fn(async () => ({ value: { count: 10 }, cacheable: true }));
  await cache.getOverview('1m', compute);
  const key = [...values.keys()].find((key) => key.includes('overview:1m'))!;
  values.delete(key); // Model Valkey expiration; TTL is asserted in the shared cache test.
  await cache.getOverview('1m', compute);
  values.set(key, 'null');
  await cache.getOverview('1m', compute);
  values.set(key, '{invalid');
  await cache.getOverview('1m', compute);
  await cache.invalidate();
  await cache.getOverview('1m', compute);
  expect(compute).toHaveBeenCalledTimes(5);
});
