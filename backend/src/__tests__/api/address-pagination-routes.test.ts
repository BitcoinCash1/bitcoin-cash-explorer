jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({
  __esModule: true,
  default: { $getAddressSummary: jest.fn(), $getAddressPage: jest.fn(), $getAddressCount: jest.fn() },
}));
import express from 'express';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import routes from '../../api/bitcoin/bitcoin.routes';
import api from '../../api/bitcoin/bitcoin-api-factory';
import config from '../../config';
let server: Server;
let url: string;
const previous = config.EXPLORER.BACKEND;
beforeAll(async () => {
  config.EXPLORER.BACKEND = 'electrum';
  const app = express();
  routes.initRoutes(app);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}${config.EXPLORER.API_URL_PREFIX}`;
});
afterAll(async () => {
  config.EXPLORER.BACKEND = previous;
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
beforeEach(() => jest.clearAllMocks());
test('summary is balance-only, preserves negative pending balance and does not request transactions/count', async () => {
  const payload = { address: 'qqtest', confirmedBalance: 42, pendingBalance: -3, electrum: true };
  (api.$getAddressSummary as jest.Mock).mockResolvedValue(payload);
  const response = await fetch(url + 'address/qqtest/summary');
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(payload);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(api.$getAddressPage).not.toHaveBeenCalled();
  expect(api.$getAddressCount).not.toHaveBeenCalled();
});
test('scripthash convention is reversed exactly once for new routes', async () => {
  (api.$getAddressSummary as jest.Mock).mockResolvedValue({ electrum: true });
  const hash = '00'.repeat(31) + 'ab';
  await (await fetch(url + 'scripthash/' + hash + '/summary')).text();
  expect(api.$getAddressSummary).toHaveBeenCalledWith('ab' + '00'.repeat(31), true);
});
test('page preserves continuation and strips verbosity from transactions', async () => {
  const page = {
    transactions: [{ txid: 'a'.repeat(64), vin: [], vout: [], status: { confirmed: true } }],
    nextCursor: 'next',
    complete: false,
    snapshotHeight: 100,
    snapshotHash: 'b'.repeat(64),
  };
  (api.$getAddressPage as jest.Mock).mockResolvedValue(structuredClone(page));
  const response = await fetch(url + 'address/qqtest/transactions?cursor=opaque');
  const payload: any = await response.json();
  expect(payload.nextCursor).toBe('next');
  expect(payload.transactions[0].txid).toBe(page.transactions[0].txid);
  expect(api.$getAddressPage).toHaveBeenCalledWith('qqtest', false, 'opaque', expect.any(AbortSignal));
});
test('on-demand count propagates running count, errors and Retry-After without invoking legacy API', async () => {
  const count = {
    confirmedCount: 15,
    progress: 10,
    scannedThroughHeight: 100,
    nextCursor: 'more',
    complete: false,
    snapshotHeight: 1000,
    snapshotHash: 'a'.repeat(64),
  };
  (api.$getAddressCount as jest.Mock)
    .mockResolvedValueOnce(count)
    .mockRejectedValueOnce(Object.assign(new Error('reorg'), { status: 409, code: 'ADDRESS_SNAPSHOT_CHANGED' }))
    .mockRejectedValueOnce(new Error('upstream private failure'));
  expect(await (await fetch(url + 'address/qqtest/transaction-count')).json()).toEqual(count);
  const reorg = await fetch(url + 'address/qqtest/transaction-count?cursor=old');
  expect(reorg.status).toBe(409);
  expect(await reorg.json()).toMatchObject({ code: 'ADDRESS_SNAPSHOT_CHANGED' });
  const busy = await fetch(url + 'address/qqtest/transaction-count');
  expect(busy.status).toBe(503);
  expect(busy.headers.get('retry-after')).toBe('2');
  expect(JSON.stringify(await busy.json())).not.toContain('private');
});
test('rejects malformed supplied cursor before invoking scanner', async () => {
  const response = await fetch(url + 'address/qqtest/transactions?cursor=');
  expect(response.status).toBe(400);
  expect(api.$getAddressPage).not.toHaveBeenCalled();
});

test('terminal history unavailability returns 422 without Retry-After', async () => {
  (api.$getAddressCount as jest.Mock).mockRejectedValueOnce(
    Object.assign(new Error('Transaction history is unavailable from the configured history server'), {
      status: 422,
      code: 'ADDRESS_HISTORY_UNAVAILABLE',
      retryable: false,
    })
  );
  const response = await fetch(url + 'address/qqtest/transaction-count');
  expect(response.status).toBe(422);
  expect(response.headers.get('retry-after')).toBeNull();
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({
    error: 'Transaction history is unavailable from the configured history server',
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
});
