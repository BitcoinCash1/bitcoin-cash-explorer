import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import routes from '../../../api/mining/mining-routes';
import mining from '../../../api/mining/mining';
import repository from '../../../repositories/BlocksRepository';
import valkey from '../../../api/valkey-cache';
import config from '../../../config';

jest.mock('../../../api/valkey-cache', () => ({
  __esModule: true,
  default: { $getCache: jest.fn(), $setCache: jest.fn() },
}));
let server: Server;
let base: string;
const values = new Map<string, string>();
const originalValkey = config.VALKEY.ENABLED;

beforeAll(async () => {
  const app = express();
  routes.initRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/mining/blocks/fee-rates`;
});
beforeEach(() => {
  values.clear();
  config.VALKEY.ENABLED = true;
  jest.mocked(valkey.$getCache).mockImplementation(async (key) => values.get(key) ?? null);
  jest.mocked(valkey.$setCache).mockImplementation(async (key, value) => {
    values.set(key, value);
  });
  jest.spyOn(repository, '$blockCount').mockResolvedValue(42);
  jest.spyOn(repository, '$getHistoricalBlockFeeRates').mockImplementation(async (_div, _interval, precise) => [
    {
      avgHeight: 100,
      timestamp: 1000,
      avgFee_0: 0,
      avgFee_50: precise ? 0.125 : 0,
      avgFee_100: precise ? 1.999 : 2,
    },
  ]);
});
afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  config.VALKEY.ENABLED = originalValkey;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test.each([false, true])('keeps cold/warm precision caches isolated, precise first: %s', async (preciseFirst) => {
  for (const precise of [preciseFirst, !preciseFirst, preciseFirst, !preciseFirst]) {
    const response = await fetch(`${base}/6m${precise ? '/precise' : ''}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('x-total-count')).toBe('42');
    expect(new Date(response.headers.get('expires')!).getTime()).toBeGreaterThan(Date.now());
    const body = (await response.json()) as any[];
    expect(body[0].avgFee_50).toBe(precise ? 0.125 : 0);
    expect(typeof body[0].avgFee_50).toBe('number');
  }
  expect(repository.$getHistoricalBlockFeeRates).toHaveBeenCalledTimes(2);
  expect(values.size).toBe(2);
  expect([...values.keys()]).toEqual(
    expect.arrayContaining(['mining:historical-block-fee-rates-6m', 'mining:historical-block-fee-rates-6m-precise'])
  );
});

test.each(['', '/precise'])('rejects invalid interval before SQL%s', async (suffix) => {
  expect((await fetch(`${base}/invalid${suffix}`)).status).toBe(400);
  expect(repository.$getHistoricalBlockFeeRates).not.toHaveBeenCalled();
});

test('uncached short intervals and disabled Valkey still pass precision to repository', async () => {
  config.VALKEY.ENABLED = false;
  await mining.$getHistoricalBlockFeeRates('24h', true);
  expect(repository.$getHistoricalBlockFeeRates).toHaveBeenCalledWith(expect.any(Number), expect.any(String), true);
});
