import express from 'express';
import { Server } from 'http';
import { AddressInfo } from 'net';
import bitcoinRoutes from '../../api/bitcoin/bitcoin.routes';
import { Common } from '../../api/common';
import FlagValueRepository from '../../repositories/FlagValueRepository';
import config from '../../config';

jest.mock('../../repositories/FlagValueRepository', () => ({
  __esModule: true,
  ...jest.requireActual('../../repositories/FlagValueRepository'),
  default: {
    $getTipAndTailIndexedByBucketSize: jest.fn(),
    $getTotalBlocksIndexedByBucketSize: jest.fn(),
    $queryTxCountBasedOnMask: jest.fn(),
  },
}));

let server: Server;
let url: string;

beforeAll(async () => {
  jest.spyOn(Common, 'gogglesIndexingEnabled').mockReturnValue(true);
  const app = express();
  bitcoinRoutes.initRoutes(app);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${config.EXPLORER.API_URL_PREFIX}goggles`;
});

beforeEach(() => {
  jest.mocked(FlagValueRepository.$getTipAndTailIndexedByBucketSize).mockResolvedValue({ tip: 975744, tail: 0 });
  jest.mocked(FlagValueRepository.$getTotalBlocksIndexedByBucketSize).mockResolvedValue(975744);
  jest.mocked(FlagValueRepository.$queryTxCountBasedOnMask).mockResolvedValue([]);
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
  jest.restoreAllMocks();
});

test.each(['24h', '6m', '1y', '2y', '3y', '4y', 'all', '4y/4032/and/1'])(
  '%s responses expire after one minute regardless of bucket width',
  async (interval) => {
    const before = Date.now();
    const response = await fetch(`${url}/${interval}`);
    const after = Date.now();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, must-revalidate');
    const expires = Date.parse(response.headers.get('expires')!);
    expect(expires).toBeGreaterThanOrEqual(before + 59_000);
    expect(expires).toBeLessThanOrEqual(after + 60_000);
    expect(response.headers.get('x-total-count')).toBe('975744');
    expect(await response.json()).toEqual([]);
  }
);

test('a subsequent request can return newly backfilled data', async () => {
  const first = await fetch(`${url}/4y`);
  expect(await first.json()).toEqual([]);
  const etag = first.headers.get('etag');
  expect(etag).toBeTruthy();
  const unchanged = await fetch(`${url}/4y`, { headers: { 'If-None-Match': etag!, 'Cache-Control': 'max-age=0' } });
  expect(unchanged.status).toBe(304);
  expect(unchanged.headers.get('cache-control')).toBe('public, max-age=60, must-revalidate');
  const backfilled = [
    { bucketSize: '1008', startHeight: 974736, avgTimestamp: 1793700000, txCount: 42, sizeTotal: 1000 },
  ];
  jest.mocked(FlagValueRepository.$queryTxCountBasedOnMask).mockResolvedValue(backfilled);
  const refreshed = await fetch(`${url}/4y`, { headers: { 'If-None-Match': etag!, 'Cache-Control': 'max-age=0' } });
  expect(refreshed.status).toBe(200);
  expect(await refreshed.json()).toEqual(backfilled);
});

test('unavailable history does not receive the successful-response cache policy', async () => {
  jest.mocked(FlagValueRepository.$getTipAndTailIndexedByBucketSize).mockResolvedValue(null);
  const response = await fetch(`${url}/4y`);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('x-accel-expires')).toBe('0');
  expect(response.headers.get('expires')).toBeNull();
  expect(await response.json()).toEqual({
    error: 'Historical Goggles data is unavailable: no complete 1008-block bucket is indexed',
  });
});
