jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {} }));
import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import ElectrumApi from '../../api/bitcoin/electrum-api';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import routes from '../../api/bitcoin/bitcoin.routes';
import config from '../../config';

function fixture(outputs: Record<string, number>) {
  const client = { getTxOut: jest.fn(async () => ({})) };
  const api = new BitcoinApi(client);
  const raw = jest.spyOn(api, '$getRawTransaction').mockImplementation(
    async (txid) =>
      ({
        vout: Array.from({ length: outputs[txid] }, () => ({})),
        status: { block_height: 1 },
      }) as any
  );
  return { api, raw, client };
}

test('single budget accepts boundary and rejects before output RPCs above it', async () => {
  const { api, client } = fixture({ tx: 3 });
  await expect(api.$getOutspends('tx', 3)).resolves.toHaveLength(3);
  client.getTxOut.mockClear();
  await expect(api.$getOutspends('tx', 2)).rejects.toThrow('Too many outputs requested');
  expect(client.getTxOut).not.toHaveBeenCalled();
});

test('batch shares remaining budget and stops before over-budget output RPCs or later transactions', async () => {
  const { api, raw, client } = fixture({ a: 2, b: 2, c: 1 });
  await expect(api.$getBatchedOutspends(['a', 'b'], 4)).resolves.toHaveLength(2);
  client.getTxOut.mockClear();
  raw.mockClear();
  await expect(api.$getBatchedOutspends(['a', 'b', 'c'], 3)).rejects.toThrow('Too many outputs requested');
  expect(client.getTxOut).toHaveBeenCalledTimes(2);
  expect(raw.mock.calls.map((call) => call[0])).toEqual(['a', 'b']);
});

test('zero remaining allows empty transactions and internal callers remain unlimited', async () => {
  const { api } = fixture({ a: 2, empty: 0 });
  await expect(api.$getBatchedOutspends(['a', 'empty'], 2)).resolves.toEqual([
    [{ spent: false }, { spent: false }],
    [],
  ]);
  const original = config.EXPLORER.MAX_OUTSPENDS_OUTPUTS;
  config.EXPLORER.MAX_OUTSPENDS_OUTPUTS = 1;
  try {
    await expect(api.$getBatchedOutspendsInternal(['a', 'a'])).resolves.toHaveLength(2);
  } finally {
    config.EXPLORER.MAX_OUTSPENDS_OUTPUTS = original;
  }
});

test('repeated transaction IDs consume cumulative output budget', async () => {
  const { api, client } = fixture({ a: 2 });
  await expect(api.$getBatchedOutspends(['a', 'a'], 3)).rejects.toThrow('Too many outputs requested');
  expect(client.getTxOut).toHaveBeenCalledTimes(2);
});

test('Electrum inherits base budget enforcement', () => {
  expect(ElectrumApi.prototype.$getOutspends).toBe(BitcoinApi.prototype.$getOutspends);
  expect(ElectrumApi.prototype.$getBatchedOutspends).toBe(BitcoinApi.prototype.$getBatchedOutspends);
});

test.each([0, 100000])('public routes pass budget %i and map excess to 400', async (budget) => {
  const original = config.EXPLORER.MAX_OUTSPENDS_OUTPUTS;
  config.EXPLORER.MAX_OUTSPENDS_OUTPUTS = budget;
  const mock = jest.fn().mockRejectedValue(new Error('Too many outputs requested'));
  Object.assign(bitcoinApi, { $getOutspends: mock, $getBatchedOutspends: mock });
  const txid = '1'.repeat(64);
  try {
    for (const [method, req, firstArg] of [
      ['getTransactionOutspends', { params: { txId: txid } }, txid],
      ['$getBatchedOutspends', { query: { txids: txid } }, [txid]],
    ] as const) {
      const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn() };
      await (routes as any)[method]({ ...req, accepts: () => true }, res);
      expect(mock).toHaveBeenLastCalledWith(firstArg, budget || Infinity);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  } finally {
    config.EXPLORER.MAX_OUTSPENDS_OUTPUTS = original;
  }
});

test('Electrum instances enforce output budget before output RPCs', async () => {
  const client = { getTxOut: jest.fn() };
  const api = new ElectrumApi(client);
  jest.spyOn(api, '$getRawTransaction').mockResolvedValue({ vout: [{}, {}] } as any);
  await expect(api.$getBatchedOutspends(['a'], 1)).rejects.toThrow('Too many outputs requested');
  expect(client.getTxOut).not.toHaveBeenCalled();
});
