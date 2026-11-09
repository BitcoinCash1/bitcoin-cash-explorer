jest.mock('@bitcoincash/electrum-client', () => {
  // Bypass the suite-wide package mock and Jest's ESM loader: Node 26 loads the actual installed client.
  const nativeModule = process.getBuiltinModule('node:module');
  return nativeModule.Module._load(require.resolve('@bitcoincash/electrum-client'), undefined, false);
});
jest.mock('../../api/blocks', () => ({ __esModule: true, default: { getBlocks: () => [] } }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {}, bitcoinCoreApi: {} }));
import { createServer, Server, Socket, AddressInfo } from 'node:net';
import config from '../../config';
import BitcoindElectrsApi from '../../api/bitcoin/electrum-api';

const address = 'qrv4ytx9jweyy095v3rxxysrs2luz5kcrq50kljf27';
const hash = 'a'.repeat(64);
let server: Server;
let api: BitcoindElectrsApi;
const sockets = new Set<Socket>();
const requests: { method: string; params: unknown[] }[] = [];
const previous = { ...config.ELECTRUM };
let firstUse: unknown = null;
beforeAll(async () => {
  server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = '';
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const request = JSON.parse(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        requests.push(request);
        let result: unknown;
        switch (request.method) {
          case 'server.version':
            result = ['Fulcrum mock', '1.6'];
            break;
          case 'blockchain.scripthash.get_first_use':
            result = firstUse;
            break;
          case 'blockchain.scripthash.get_mempool':
            result = [];
            break;
          case 'blockchain.scripthash.get_balance':
            result = { confirmed: 0, unconfirmed: 0 };
            break;
          case 'blockchain.scripthash.get_history':
            result = [];
            break;
          default:
            socket.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                error: { code: -32601, message: 'Unexpected method' },
              }) + '\n'
            );
            continue;
        }
        socket.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  Object.assign(config.ELECTRUM, {
    HOST: '127.0.0.1',
    PORT: (server.address() as AddressInfo).port,
    TLS_ENABLED: false,
  });
  api = new BitcoindElectrsApi({
    validateAddress: jest.fn(async () => ({
      isvalid: true,
      address,
      scriptPubKey: '76a914' + '00'.repeat(20) + '88ac',
    })),
    getBestBlockHash: async () => hash,
    getBlockHash: async () => hash,
    getBlock: async () => ({ hash, height: 100 }),
  });
  await Promise.all([
    (api as any).electrumClient.server_version('test', '1.6'),
    (api as any).historyClient.server_version('test', '1.6'),
  ]);
});
afterAll(async () => {
  (api as any).electrumClient.close();
  (api as any).historyClient.close();
  for (const socket of sockets) socket.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  Object.assign(config.ELECTRUM, previous);
});
beforeEach(() => {
  requests.length = 0;
  firstUse = null;
  (api as any).historyCoordinator.cache.clear();
});
test.each([address, 'bitcoincash:' + address])(
  'real Electrum null wire result completes unused address page and count: %s',
  async (target) => {
    const summary = await api.$getAddressSummary(target);
    expect(summary).toMatchObject({ address, confirmedBalance: 0, pendingBalance: 0 });
    const [page, count] = await Promise.all([api.$getAddressPage(target), api.$getAddressCount(target)]);
    expect(page).toMatchObject({
      transactions: [],
      complete: true,
      nextCursor: null,
      snapshotHeight: 100,
      snapshotHash: hash,
    });
    expect(count).toMatchObject({ confirmedCount: 0, complete: true, nextCursor: null, progress: 100 });
    expect(requests.filter((request) => request.method === 'blockchain.scripthash.get_first_use')).toHaveLength(1);
    expect(requests.some((request) => request.method === 'blockchain.scripthash.get_history')).toBe(false);
  }
);
test('real confirmed first-use wire object with empty history remains terminal unavailable', async () => {
  firstUse = { height: 1, block_hash: hash, tx_hash: 'b'.repeat(64) };
  // Use a distinct script hash so the two-second null cache from previous tests cannot mask the response.
  await expect(api.$getAddressCount('01'.repeat(32), true)).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
  expect(requests.filter((request) => request.method === 'blockchain.scripthash.get_history')).toHaveLength(1);
});
