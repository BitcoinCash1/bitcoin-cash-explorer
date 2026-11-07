import express from 'express';
import { Server } from 'http';
import DB from '../../database';
import statistics from '../../api/statistics/statistics-api';
import routes from '../../api/statistics/statistics.routes';

jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));

const intervals = [
  ['2h', '$list2H', 30],
  ['24h', '$list24H', 60],
  ['3d', '$list3D', 300],
  ['1w', '$list1W', 600],
  ['1m', '$list1M', 1800],
  ['3m', '$list3M', 3600],
  ['6m', '$list6M', 7200],
  ['1y', '$list1Y', 14400],
  ['2y', '$list2Y', 86400],
  ['3y', '$list3Y', 86400],
  ['4y', '$list4Y', 86400],
  ['all', '$listAll', 86400],
] as const;
let server: Server;
let base: string;
beforeAll(async () => {
  const app = express();
  routes.initRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  base = `http://127.0.0.1:${(server.address() as any).port}/api/v1/statistics/`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));
afterEach(() => jest.clearAllMocks());

test.each(intervals)(
  '%s propagates DB failure and serves uncached 500, then a cacheable genuine empty result',
  async (interval, method, ttl) => {
    const failure = new Error('database unavailable');
    (DB.query as jest.Mock).mockRejectedValue(failure);
    await expect(statistics[method]()).rejects.toBe(failure);
    const error = await fetch(base + interval, { headers: { Accept: 'application/json' } });
    expect(error.status).toBe(500);
    expect(error.headers.get('expires')).toBeNull();
    expect(error.headers.get('cache-control')).toBe('no-store');
    expect(await error.json()).toEqual({ error: 'Failed to get statistics' });
    (DB.query as jest.Mock).mockResolvedValue([[]]);
    const response = await fetch(base + interval);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expect(response.headers.get('cache-control')).toBe('public');
    const expiry = Date.parse(response.headers.get('expires'));
    expect(expiry).toBeGreaterThan(Date.now() + (ttl - 2) * 1000);
  }
);
