import express from 'express';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import miningRoutes from '../../../api/mining/mining-routes';
import BlocksRepository from '../../../repositories/BlocksRepository';
import PoolsRepository from '../../../repositories/PoolsRepository';
import bitcoinClient from '../../../api/bitcoin/bitcoin-client';
import cache from '../../../api/mining/pool-statistics-cache';
import valkey from '../../../api/valkey-cache';
import config from '../../../config';

jest.mock('../../../repositories/BlocksRepository');
jest.mock('../../../repositories/PoolsRepository');
jest.mock('../../../api/bitcoin/bitcoin-client');
jest.mock('../../../api/valkey-cache', () => ({
  __esModule: true,
  default: { $getCache: jest.fn(), $setCache: jest.fn() },
}));

const values = new Map<string, string>();
let server: Server;
let rpcServer: Server;
let url: string;
let rpcFailure = false;
let rpcResult = 100;
let rpcCalls = 0;
const originalEnabled = config.VALKEY.ENABLED;

beforeAll(async () => {
  // Exercise the real RPC transport and HTTP route with controlled node responses.
  rpcServer = createServer(async (req, res) => {
    for await (const _ of req) {
      /* Drain the RPC request. */
    }
    rpcCalls++;
    await new Promise((resolve) => setTimeout(resolve, 20));
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify(
        rpcFailure
          ? { result: null, error: { code: -28, message: 'Node warming up' }, id: 1 }
          : { result: rpcResult, error: null, id: 1 }
      )
    );
  });
  await new Promise<void>((resolve) => rpcServer.listen(0, '127.0.0.1', resolve));
  const { Client } = require('../../../rpc-api/index');
  const rpc = new Client({ host: '127.0.0.1', port: (rpcServer.address() as AddressInfo).port, timeout: 1000 });
  jest.mocked(bitcoinClient.getNetworkHashPs).mockImplementation((...args) => rpc.getNetworkHashPs(...args));
  const app = express();
  miningRoutes.initRoutes(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${config.EXPLORER.API_URL_PREFIX}mining/pool/example`;
});

beforeEach(async () => {
  values.clear();
  rpcCalls = 0;
  rpcFailure = false;
  rpcResult = 100;
  config.VALKEY.ENABLED = true;
  jest.mocked(valkey.$getCache).mockImplementation(async (key) => values.get(key) ?? null);
  jest.mocked(valkey.$setCache).mockImplementation(async (key, value) => {
    values.set(key, value);
  });
  await cache.invalidate();
  jest.mocked(BlocksRepository.$poolStatisticsCounts).mockClear();
  jest.mocked(PoolsRepository.$getPool).mockResolvedValue({ id: 1, name: 'Example', slug: 'example' } as never);
  jest
    .mocked(BlocksRepository.$poolStatisticsCounts)
    .mockResolvedValue({ allCount: 10, dayCount: 2, weekCount: 5, totalReward: 50 } as never);
  jest.mocked(BlocksRepository.$networkStatisticsCounts).mockResolvedValue({ dayCount: 10, weekCount: 20 } as never);
  jest.mocked(BlocksRepository.$blockCount).mockResolvedValue(100);
  jest.mocked(BlocksRepository.$getAvgBlockHealthPerPoolId).mockResolvedValue(99 as never);
});

afterAll(async () => {
  config.VALKEY.ENABLED = originalEnabled;
  await Promise.all(
    [server, rpcServer].map(
      (instance) =>
        new Promise<void>((resolve, reject) => instance.close((error) => (error ? reject(error) : resolve())))
    )
  );
});

test('RPC failure is not cached by Valkey or HTTP, and the next request recovers', async () => {
  rpcFailure = true;
  const responses = await Promise.all(Array.from({ length: 8 }, () => fetch(url)));
  for (const response of responses) {
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('expires')).toBeNull();
    expect(response.headers.get('pragma')).toBeNull();
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.estimatedHashrate).toBe(0);
    expect(body).not.toHaveProperty('cacheable');
    expect(body).not.toHaveProperty('value');
    expect(body.blockCount).toEqual({ all: 10, '24h': 2, '1w': 5 });
  }
  expect(rpcCalls).toBe(1);
  expect(BlocksRepository.$poolStatisticsCounts).toHaveBeenCalledTimes(1);
  expect([...values.keys()].filter((key) => key.includes(':v2:'))).toHaveLength(0);
  // A successive failed request retries; there is no hidden negative cache.
  await (await fetch(url)).json();
  expect(rpcCalls).toBe(2);
  rpcFailure = false;
  const recovered = await fetch(url);
  expect(recovered.headers.get('cache-control')).toBe('public');
  const remaining = Date.parse(recovered.headers.get('expires')!) - Date.now();
  expect(remaining).toBeGreaterThan(58000);
  expect(remaining).toBeLessThanOrEqual(60000);
  expect(((await recovered.json()) as Record<string, unknown>).estimatedHashrate).toBe(20);
  await (await fetch(url)).json();
  expect(rpcCalls).toBe(3);
  expect(BlocksRepository.$poolStatisticsCounts).toHaveBeenCalledTimes(3);
  expect(valkey.$setCache).toHaveBeenCalledWith(expect.stringContaining(':v2:'), expect.any(String), 120);
});

test('a successful zero hashrate remains cacheable', async () => {
  rpcResult = 0;
  const response = await fetch(url);
  expect(response.headers.get('cache-control')).toBe('public');
  expect(((await response.json()) as Record<string, unknown>).estimatedHashrate).toBe(0);
  await (await fetch(url)).json();
  expect(rpcCalls).toBe(1);
});

test('preserves missing-pool and database-error responses', async () => {
  jest.mocked(PoolsRepository.$getPool).mockResolvedValueOnce(undefined as never);
  const missing = await fetch(url);
  expect(missing.status).toBe(404);
  await missing.text();
  jest.mocked(BlocksRepository.$poolStatisticsCounts).mockRejectedValueOnce(new Error('database unavailable'));
  const failed = await fetch(url);
  expect(failed.status).toBe(500);
  await failed.text();
  expect(rpcCalls).toBe(0);
  const recovered = await fetch(url);
  expect(recovered.status).toBe(200);
  expect(((await recovered.json()) as Record<string, unknown>).estimatedHashrate).toBe(20);
});

test.each(['ETIMEDOUT', 'ECONNREFUSED'])('retries after a transport failure (%s)', async (code) => {
  jest.mocked(bitcoinClient.getNetworkHashPs).mockRejectedValueOnce(Object.assign(new Error(code), { code }));
  const failed = await fetch(url);
  expect(failed.headers.get('cache-control')).toBe('no-store');
  expect(((await failed.json()) as Record<string, unknown>).estimatedHashrate).toBe(0);
  const recovered = await fetch(url);
  expect(((await recovered.json()) as Record<string, unknown>).estimatedHashrate).toBe(20);
  expect(rpcCalls).toBe(1);
});
