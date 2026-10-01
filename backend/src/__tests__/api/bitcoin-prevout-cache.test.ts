jest.mock('../../api/blocks', () => ({ __esModule: true, default: { getCurrentBlockHeight: () => 100 } }));
jest.mock('../../api/mempool', () => ({ __esModule: true, default: { getMempool: () => ({}) } }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {}, bitcoinCoreApi: {} }));

import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import { PrevoutCache } from '../../api/bitcoin/prevout-cache';

const output = (value: number, token = false) => ({
  value: value / 100000000,
  scriptPubKey: {
    hex: '51',
    asm: 'OP_1',
    type: 'pubkeyhash',
    addresses: ['address'],
    byteCodePattern: { pattern: '51', data: ['51'] },
  },
  ...(token && {
    tokenData: { category: 'ab'.repeat(32), amount: '123', nft: { capability: 'mutable', commitment: 'abcd' } },
  }),
});
const transaction = (id: string, vin: any[], vout = [output(50)]) => ({
  txid: id,
  version: 2,
  locktime: 0,
  size: 100,
  vin,
  vout,
  confirmations: 1,
  blockhash: 'block',
  blocktime: 1,
});
const input = (txid: string, vout: number) => ({
  txid,
  vout,
  sequence: 0xffffffff,
  scriptSig: { hex: '51', asm: 'OP_1' },
});
function fixture(stale = false) {
  const parent = transaction('parent', [{ coinbase: '0101' }], [output(100, true), output(200)]);
  const child = transaction('child', [input('parent', 0), input('parent', 1)]);
  const next = transaction('next', [input('parent', 1), input('child', 0)]);
  const block = {
    hash: 'block',
    height: 100,
    time: 1,
    confirmations: stale ? -1 : 1,
    tx: [transaction('coinbase', [{ coinbase: '0101' }]), child, next],
  };
  const client = {
    getBlock: jest.fn(async () => structuredClone(block)),
    getRawTransaction: jest.fn(async (id: string) => structuredClone(id === 'parent' ? parent : child)),
  };
  return { api: new BitcoinApi(client), client };
}

test('real conversion preserves complete transaction data, fees, scripts, tokens and same-block parent outputs', async () => {
  const baseline = fixture();
  const cached = fixture();
  const expected = await baseline.api.$getTxsForBlock('block');
  const actual = await cached.api.$getTxsForBlock('block', false, { reusePrevouts: true });
  expect(actual).toStrictEqual(expected);
  expect(baseline.client.getRawTransaction).toHaveBeenCalledTimes(4);
  expect(cached.client.getRawTransaction).toHaveBeenCalledTimes(2);
  expect(actual[1].vin[0].prevout?.token_amount).toBe('123');
  expect(actual[1].fee).toBe(250);
});

test('default and explicitly disabled calls retain original RPC behaviour', async () => {
  const f = fixture();
  await f.api.$getTxsForBlock('block', false, { reusePrevouts: false });
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(4);
});

test('normal raw requests and concurrent block calls do not share retention', async () => {
  const f = fixture();
  await Promise.all([
    f.api.$getTxsForBlock('block', false, { reusePrevouts: true }),
    f.api.$getTxsForBlock('block', false, { reusePrevouts: true }),
    f.api.$getRawTransaction('parent', false, false),
  ]);
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(5);
  await f.api.$getRawTransaction('parent', false, false);
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(6);
});

test('orphaned blocks retain uncached conversion and missing-prevout tolerance', async () => {
  const baseline = fixture(true);
  const cached = fixture(true);
  expect(await cached.api.$getTxsForBlock('block', false, { reusePrevouts: true })).toStrictEqual(
    await baseline.api.$getTxsForBlock('block')
  );
  expect(cached.client.getRawTransaction).toHaveBeenCalledTimes(4);
});

test('success and failure clear cache context without swallowing RPC errors', async () => {
  const clear = jest.spyOn(PrevoutCache.prototype, 'clear');
  try {
    const f = fixture();
    await f.api.$getTxsForBlock('block', false, { reusePrevouts: true });
    f.client.getRawTransaction.mockRejectedValueOnce(new Error('RPC failed'));
    await expect(f.api.$getTxsForBlock('block', false, { reusePrevouts: true })).rejects.toThrow('RPC failed');
    expect(clear).toHaveBeenCalledTimes(2);
  } finally {
    clear.mockRestore();
  }
});

test('non-boolean options cannot accidentally enable retention', async () => {
  const f = fixture();
  await f.api.$getTxsForBlock('block', false, { reusePrevouts: 'true' as any });
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(4);
});
