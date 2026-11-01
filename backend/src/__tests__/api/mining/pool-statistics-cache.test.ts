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
  expect(valkey.$setCache).toHaveBeenCalledWith(expect.stringContaining(':v2:'), JSON.stringify(recovered.value), 120);
});

test('ignores legacy response keys while retaining shared generation invalidation', async () => {
  const generationKey = [...values.keys()].find((key) => key.endsWith(':generation'))!;
  const prefix = generationKey.slice(0, -':generation'.length);
  values.set(`${prefix}:${values.get(generationKey)}:1`, JSON.stringify({ estimatedHashrate: 0 }));
  const recovered = { value: { estimatedHashrate: 100 }, cacheable: true };
  const compute = jest.fn().mockResolvedValue(recovered);
  expect(await cache.get(1, compute)).toEqual(recovered);
  expect(compute).toHaveBeenCalledTimes(1);
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
  expect([...values.keys()].filter((key) => key.includes(':v2:'))).toHaveLength(0);
});
