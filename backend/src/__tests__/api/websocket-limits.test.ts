import { EventEmitter } from 'events';
jest.mock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {} }));

function fixture() {
  jest.resetModules();
  const settings = jest.requireActual('../../config').default;
  Object.assign(settings.EXPLORER, {
    MAX_MESSAGE_SIZE: 200,
    MAX_BUFFERED_AMOUNT: 100,
    MAX_TRACKED_TXS: 2,
    MSG_RATE_LIMIT: 2,
    MSG_RATE_WINDOW: 10000,
  });
  const handler = jest.requireActual('../../api/websocket-handler').default;
  const server = new EventEmitter();
  handler.addWebsocketServer(server);
  handler.setupConnectionHandling();
  const client: any = new EventEmitter();
  Object.assign(client, { send: jest.fn(), close: jest.fn(), terminate: jest.fn(), bufferedAmount: 0 });
  server.emit('connection', client, { headers: {} });
  return { handler, client };
}

test('message bytes accept boundary and terminate above configured limit', async () => {
  const { handler, client } = fixture();
  expect(handler.MAX_MESSAGE_SIZE).toBe(200);
  const listener = client.listeners('message')[0];
  await listener(Buffer.from('{}' + ' '.repeat(198)));
  expect(client.terminate).not.toHaveBeenCalled();
  await listener(Buffer.from('{}' + ' '.repeat(199)));
  expect(client.terminate).toHaveBeenCalledTimes(1);
});

test('buffer accepts boundary and terminates above configured limit', () => {
  const { handler, client } = fixture();
  client.bufferedAmount = 100;
  handler.send(client, '{}');
  expect(client.send).toHaveBeenCalledWith('{}');
  client.bufferedAmount = 101;
  handler.send(client, '{}');
  expect(client.terminate).toHaveBeenCalledTimes(1);
});

test('message count closes above limit and expires at configured window', async () => {
  const { client } = fixture();
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const listener = client.listeners('message')[0];
  try {
    await listener(Buffer.from('{}'));
    await listener(Buffer.from('{}'));
    expect(client.close).not.toHaveBeenCalled();
    await listener(Buffer.from('{}'));
    expect(client.close).toHaveBeenCalledTimes(1);
    now.mockReturnValue(11000);
    client.close.mockClear();
    await listener(Buffer.from('{}'));
    expect(client.close).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

test('tracking above configured transaction count reports limit and closes', async () => {
  const { client } = fixture();
  await client.listeners('message')[0](Buffer.from(JSON.stringify({ 'track-txs': ['a', 'b', 'c'] })));
  expect(client.send).toHaveBeenCalledWith(expect.stringContaining('maximum of 2 transactions'));
  expect(client.close).toHaveBeenCalledTimes(1);
});

test('tracking accepts the configured transaction count boundary', async () => {
  const { client } = fixture();
  const ids = ['1'.repeat(64), '2'.repeat(64)];
  await client.listeners('message')[0](Buffer.from(JSON.stringify({ 'track-txs': ids })));
  expect(client['track-txs']).toEqual(ids);
  expect(client.close).not.toHaveBeenCalled();
});
