import { Application, Request, Response } from 'express';
import routes from '../../api/bitcoin/bitcoin.routes';
import config from '../../config';
import BlocksRepository from '../../repositories/BlocksRepository';
import chainTips from '../../api/chain-tips';
import { encodeStaleHistoryCursor } from '../../api/stale-history';

const handlers = new Map<string, (req: Request, res: Response) => Promise<void>>();
const app = {
  get(path, handler) {
    handlers.set(path, handler);
    return this;
  },
  post() {
    return this;
  },
};
routes.initRoutes(app as unknown as Application);

function response() {
  const headers: Record<string, string> = {};
  return {
    headers,
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers[name] = value;
    },
    removeHeader(name: string) {
      delete headers[name];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    send(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

async function request(query: unknown = {}, path = 'stale-tips/history') {
  const res = response();
  await handlers.get(config.EXPLORER.API_URL_PREFIX + path)!(
    { query, accepts: () => true } as unknown as Request,
    res as unknown as Response
  );
  return res;
}

const oldDbEnabled = config.DATABASE.ENABLED;
afterEach(() => {
  config.DATABASE.ENABLED = oldDbEnabled;
  jest.restoreAllMocks();
});

test('empty history succeeds and supplies no-store, without changing the recent-tip contract', async () => {
  config.DATABASE.ENABLED = true;
  jest.spyOn(BlocksRepository, '$getStaleHistory').mockResolvedValue({ entries: [], nextCursor: null });
  const history = await request();
  expect(history.statusCode).toBe(200);
  expect(history.body).toEqual({ entries: [], nextCursor: null });
  expect(history.headers).toEqual({ 'Cache-Control': 'no-store' });
  const tips = [{ hash: 'recent' }];
  jest.spyOn(chainTips, 'getStaleTips').mockReturnValue(tips as never);
  expect((await request({}, 'stale-tips')).body).toEqual(tips);
  expect((await request({}, 'stale-tips')).headers).toHaveProperty('Expires');
});

test('validated cursor reaches repository; malformed cursor returns 400 without querying', async () => {
  config.DATABASE.ENABLED = true;
  const cursor = { height: 1, hash: 'a'.repeat(64) };
  const lookup = jest.spyOn(BlocksRepository, '$getStaleHistory').mockResolvedValue({ entries: [], nextCursor: null });
  expect((await request({ cursor: encodeStaleHistoryCursor(cursor) })).statusCode).toBe(200);
  expect(lookup).toHaveBeenCalledWith(cursor);
  lookup.mockClear();
  for (const value of ['', 'garbage', ['x', 'y'], { height: 1 }]) {
    expect((await request({ cursor: value })).statusCode).toBe(400);
  }
  expect(lookup).not.toHaveBeenCalled();
});

test('database failures are uncached errors, while disabled database is explicit 503', async () => {
  config.DATABASE.ENABLED = true;
  const lookup = jest.spyOn(BlocksRepository, '$getStaleHistory').mockRejectedValue(new Error('database unavailable'));
  const failed = await request();
  expect(failed.statusCode).toBe(500);
  expect(failed.headers).toEqual({ 'Cache-Control': 'no-store', 'X-Accel-Expires': '0' });
  expect(failed.body).toEqual({ error: 'Failed to get stale block history' });
  lookup.mockClear();
  config.DATABASE.ENABLED = false;
  const disabled = await request();
  expect(disabled.statusCode).toBe(503);
  expect(disabled.body).toEqual({ error: 'Stale block history is unavailable without a database' });
  expect(lookup).not.toHaveBeenCalled();
});
