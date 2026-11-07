import { EventEmitter } from 'events';
jest.mock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
jest.mock('../../api/mempool-blocks', () => ({
  __esModule: true,
  default: {
    getMempoolBlocksWithTransactions: jest.fn(() => [
      { transactions: ['first'] },
      { transactions: [] },
      { transactions: ['last'] },
    ]),
    compressTx: jest.fn((tx) => `compressed-${tx}`),
  },
}));
jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {} }));

function fixture() {
  jest.resetModules();
  const settings = jest.requireActual('../../config').default;
  Object.assign(settings.EXPLORER, {
    MEMPOOL_BLOCKS_AMOUNT: 3,
  });
  const handler = jest.requireActual('../../api/websocket-handler').default;
  const server = new EventEmitter();
  handler.addWebsocketServer(server);
  handler.setupConnectionHandling();
  const client: any = new EventEmitter();
  Object.assign(client, { send: jest.fn(), close: jest.fn(), terminate: jest.fn(), bufferedAmount: 0 });
  server.emit('connection', client, { headers: {} });
  return { client };
}

test.each([
  [0, ['compressed-first']],
  [2, ['compressed-last']],
])('projected-block tracking accepts configured boundary %i and sends transactions', async (index, transactions) => {
  const { client } = fixture();
  await client.listeners('message')[0](Buffer.from(JSON.stringify({ 'track-mempool-block': index })));
  expect(client['track-mempool-block']).toBe(index);
  expect(client.send).toHaveBeenCalledTimes(1);
  expect(JSON.parse(client.send.mock.calls[0][0])['projected-block-transactions']).toEqual({
    index,
    sequence: expect.any(Number),
    blockTransactions: transactions,
  });
  expect(client.close).not.toHaveBeenCalled();
  expect(client.terminate).not.toHaveBeenCalled();
});

test('projected-block tracking accepts an empty configured block', async () => {
  const { client } = fixture();
  await client.listeners('message')[0](Buffer.from(JSON.stringify({ 'track-mempool-block': 1 })));
  expect(client['track-mempool-block']).toBe(1);
  expect(JSON.parse(client.send.mock.calls[0][0])['projected-block-transactions'].blockTransactions).toEqual([]);
});

test.each([-1, 3, 4, Number.MAX_SAFE_INTEGER, 0.5, '0', null, true, {}, []])(
  'invalid projected-block index %j clears an existing subscription',
  async (index) => {
    const { client } = fixture();
    client['track-mempool-block'] = 0;
    await client.listeners('message')[0](Buffer.from(JSON.stringify({ 'track-mempool-block': index })));
    expect(client['track-mempool-block']).toBeNull();
    expect(client.send).not.toHaveBeenCalled();
    expect(client.close).not.toHaveBeenCalled();
    expect(client.terminate).not.toHaveBeenCalled();
  }
);

test('omitting the projected-block field preserves an existing subscription', async () => {
  const { client } = fixture();
  client['track-mempool-block'] = 0;
  await client.listeners('message')[0](Buffer.from('{}'));
  expect(client['track-mempool-block']).toBe(0);
});
