jest.mock('../../api/blocks', () => ({ __esModule: true, default: { getCurrentBlockHeight: () => 100 } }));
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getMempool: jest.fn(() => ({})), isInSync: () => true },
}));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {}, bitcoinCoreApi: {} }));

import BitcoinApi from '../../api/bitcoin/bitcoin-api';
import { PrevoutResolver } from '../../api/bitcoin/prevout-cache';
import { Common } from '../../api/common';
import mempool from '../../api/mempool';

class TestBitcoinApi extends BitcoinApi {
  convert(raw: any, addPrevout = true, lazy = false, allowMissing = false, resolver?: PrevoutResolver) {
    return this.$convertTransaction(raw, addPrevout, lazy, allowMissing, resolver);
  }
}

const lockingScript = (type = 'pubkeyhash', address: string | undefined = 'address') => ({
  hex: '51',
  asm: '1',
  type,
  ...(address !== undefined && { address }),
  byteCodePattern: { pattern: '51', data: ['51'] },
});
const input = (sats = 1000, type = 'pubkeyhash', address: string | undefined = 'address'): any => ({
  txid: 'parent',
  vout: 0,
  sequence: 0xffffffff,
  value: sats / 100000000,
  scriptSig: { hex: '0151', asm: '51' },
  scriptPubKey: lockingScript(type, address),
});
const output = (sats = 900, type = 'pubkeyhash', addresses: string[] | undefined = ['address']): any => ({
  value: sats / 100000000,
  n: 0,
  scriptPubKey: {
    hex: '51',
    asm: '1',
    type,
    ...(addresses && { addresses }),
    byteCodePattern: { pattern: '51', data: ['51'] },
  },
});
const transaction = (vin: any[] = [input()], vout = [output()], confirmations = 1): any => ({
  txid: 'child',
  version: 2,
  locktime: 0,
  size: 100,
  vin,
  vout,
  confirmations,
  blockhash: 'block',
  blocktime: 123,
});
const expectedOutput = (value = 1000, type = 'p2pkh', address = 'address') => ({
  value,
  scriptpubkey: '51',
  scriptpubkey_address: address,
  scriptpubkey_asm: 'OP_PUSHNUM_1',
  scriptpubkey_type: type,
  scriptpubkey_byte_code_pattern: '51',
  scriptpubkey_byte_code: ['51'],
});
function fixture(raw = transaction(), parentOutput = output(1000)) {
  const parent = { ...transaction([{ coinbase: '0101' }], [parentOutput]), txid: 'parent' };
  const client = {
    getRawTransaction: jest.fn(async (id: string) => structuredClone(id === 'child' ? raw : parent)),
    getMempoolEntry: jest.fn(async () => ({ fees: { base: 0.000001 } })),
    getBlock: jest.fn(async () => ({ hash: 'block', height: 100, time: 123, confirmations: 1, tx: [raw] })),
  };
  return { api: new TestBitcoinApi(client), client };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.mocked(mempool.getMempool).mockReturnValue({});
});

test('201 complete inputs require only the child RPC and preserve fees and public fields', async () => {
  const f = fixture(
    transaction(
      Array.from({ length: 201 }, () => input()),
      [output(200000)]
    )
  );
  const result: any = await f.api.$getRawTransaction('child', false, true);
  expect(f.client.getRawTransaction.mock.calls).toEqual([['child', 2, '', true]]);
  expect(result.fee).toBe(1000);
  expect(result.status).toEqual({ confirmed: true, block_height: 100, block_hash: 'block', block_time: 123 });
  expect(result.vin).toHaveLength(201);
  for (const vin of result.vin) {
    expect(vin.prevout).toEqual(expectedOutput());
    expect(vin.value).toBe(1000);
    expect(vin.scriptsig).toBe('0151');
    expect(vin.scriptsig_asm).toBe('OP_PUSHBYTES_1 51');
    expect(vin.scriptpubkey_address).toBe('address');
  }
  expect(result.vout).toEqual([expectedOutput(200000)]);
});

test.each([
  [
    'pubkeyhash',
    'p2pkh',
    '76a914' + 'ab'.repeat(20) + '88ac',
    'OP_DUP OP_HASH160 OP_PUSHBYTES_20 ' + 'ab'.repeat(20) + ' OP_EQUALVERIFY OP_CHECKSIG',
  ],
  [
    'scripthash',
    'p2sh',
    'a914' + 'ab'.repeat(20) + '87',
    'OP_HASH160 OP_PUSHBYTES_20 ' + 'ab'.repeat(20) + ' OP_EQUAL',
  ],
  ['pubkey', 'p2pk', '2102' + 'ab'.repeat(32) + 'ac', 'OP_PUSHBYTES_33 02' + 'ab'.repeat(32) + ' OP_CHECKSIG'],
  ['script', 'p2s', '51', 'OP_PUSHNUM_1'],
])('uses complete %s inputs and preserves script representation', async (rawType, publicType, hex, asm) => {
  const vin = input(1000, rawType);
  vin.scriptPubKey = { ...vin.scriptPubKey, hex, asm, byteCodePattern: { pattern: hex, data: [hex] } };
  const f = fixture();
  const tx = await f.api.convert(transaction([vin]));
  expect(tx.vin[0].prevout).toEqual({
    ...expectedOutput(1000, publicType),
    scriptpubkey: hex,
    scriptpubkey_asm: asm,
    scriptpubkey_byte_code_pattern: hex,
    scriptpubkey_byte_code: [hex],
  });
  expect(tx.vin[0].scriptpubkey_asm).toBe(asm);
  expect(tx.vin[0].inner_redeemscript_asm).toBe(rawType === 'scripthash' ? 'OP_PUSHNUM_1' : '');
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test.each(['nonstandard', 'nulldata', 'anchor'])('preserves complete addressless %s inputs', async (type) => {
  const vin = input(1000, type);
  delete vin.scriptPubKey.address;
  const f = fixture();
  const tx = await f.api.convert(transaction([vin]));
  expect(tx.vin[0].prevout).toEqual(expectedOutput(1000, type === 'nulldata' ? 'op_return' : type, ''));
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test('accepts zero-valued outputs and complete empty script metadata', async () => {
  const vin = input(0, 'nonstandard');
  vin.scriptPubKey = { hex: '', asm: '', type: 'nonstandard', byteCodePattern: { pattern: '', data: [] } };
  const f = fixture();
  const tx = await f.api.convert(transaction([vin], [output(0)]));
  expect(tx.vin[0].prevout).toEqual({
    value: 0,
    scriptpubkey: '',
    scriptpubkey_address: '',
    scriptpubkey_asm: '',
    scriptpubkey_type: 'nonstandard',
    scriptpubkey_byte_code_pattern: '',
    scriptpubkey_byte_code: [],
  });
  expect(tx.fee).toBe(0);
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test.each(['none', 'mutable', 'minting'])(
  'preserves fungible tokens and %s NFTs without parent RPC',
  async (capability) => {
    const vin = input();
    vin.tokenData = { category: 'ab'.repeat(32), amount: '0', nft: { capability, commitment: '' } };
    const f = fixture();
    const tx = await f.api.convert(transaction([vin]));
    expect(tx.vin[0].prevout).toEqual({
      ...expectedOutput(),
      token_category: 'ab'.repeat(32),
      token_amount: '0',
      token_nft_capability: capability,
      token_nft_commitment: '',
    });
    expect(tx.vin[0].token_amount).toBe('0');
    expect(f.client.getRawTransaction).not.toHaveBeenCalled();
  }
);

test('preserves fungible-only token amounts', async () => {
  const vin = input();
  vin.tokenData = { category: 'ab'.repeat(32), amount: '123' };
  const f = fixture();
  const tx = await f.api.convert(transaction([vin]));
  expect(tx.vin[0].prevout).toEqual({ ...expectedOutput(), token_category: 'ab'.repeat(32), token_amount: '123' });
});

test.each([
  'value',
  'scriptPubKey',
  'scriptPubKey.hex',
  'scriptPubKey.asm',
  'scriptPubKey.type',
  'scriptPubKey.address',
  'scriptPubKey.byteCodePattern',
  'scriptPubKey.byteCodePattern.pattern',
  'scriptPubKey.byteCodePattern.data',
  'tokenData.amount',
  'tokenData.category',
  'tokenData.nft.commitment',
  'tokenData.nft.capability',
])('fetches the parent when %s is absent', async (path) => {
  const vin = input();
  if (path.startsWith('tokenData')) {
    vin.tokenData = { category: 'ab'.repeat(32), amount: '1', nft: { capability: 'none', commitment: '' } };
  }
  const parts = path.split('.');
  let owner = vin;
  for (const part of parts.slice(0, -1)) {
    owner = owner[part];
  }
  delete owner[parts[parts.length - 1]];
  const f = fixture();
  const tx = await f.api.convert(transaction([vin]));
  expect(f.client.getRawTransaction).toHaveBeenCalledWith('parent', 2, '', true);
  expect(tx.vin[0].prevout).toEqual(expectedOutput());
  expect(tx.fee).toBe(100);
});

test('bare multisig uses the parent output address representation', async () => {
  const f = fixture(transaction([input(1000, 'multisig')]), output(1000, 'multisig', ['first', 'second']));
  const tx = await f.api.convert(transaction([input(1000, 'multisig')]));
  expect(tx.vin[0].prevout).toEqual(expectedOutput(1000, 'multisig', 'first'));
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(1);
});

test('complete inline data precedes the supplied resolver; incomplete data uses it', async () => {
  const incomplete = input();
  delete incomplete.value;
  const resolver = jest.fn(async () => expectedOutput(2000));
  const f = fixture();
  const tx = await f.api.convert(transaction([input(), incomplete]), true, false, false, resolver);
  expect(resolver.mock.calls).toEqual([['parent', 0]]);
  expect(tx.fee).toBe(2100);
  expect(tx.vin.map((vin) => vin.prevout?.value)).toEqual([1000, 2000]);
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test('lazy conversion enriches only the existing first thirteen inputs', async () => {
  const f = fixture();
  const tx = await f.api.convert(transaction(Array.from({ length: 20 }, () => input())), true, true);
  expect(tx.fee).toBe(-1);
  expect(tx.vin.slice(0, 13).every((vin) => vin.prevout?.value === 1000)).toBe(true);
  expect(tx.vin.slice(13).every((vin) => vin.prevout === null && vin.lazy === true)).toBe(true);
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test('disabled enrichment keeps prevouts null and coinbase keeps zero fee', async () => {
  const f = fixture();
  const tx = await f.api.convert(transaction(), false);
  expect(tx.vin[0].prevout).toBeNull();
  expect(tx.fee).toBe(0);
  const coinbase = await f.api.convert(transaction([{ coinbase: '0101', sequence: 0xffffffff }]));
  expect(coinbase.vin[0].is_coinbase).toBe(true);
  expect(coinbase.vin[0].prevout).toBeNull();
  expect(coinbase.fee).toBe(0);
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test('unconfirmed complete input data calculates fees without mempool or parent RPCs', async () => {
  const f = fixture();
  const tx = await f.api.convert(transaction([input()], [output()], 0));
  expect(tx.status).toEqual({ confirmed: false });
  expect(tx.fee).toBe(100);
  expect(f.client.getMempoolEntry).not.toHaveBeenCalled();
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});

test('block resolver fallback remains usable for incomplete inputs with complete siblings', async () => {
  const incomplete = input();
  delete incomplete.value;
  const f = fixture(transaction([input(), incomplete, { ...incomplete }]));
  const txs = await f.api.$getTxsForBlock('block', false, { reusePrevouts: true });
  expect(txs[0].fee).toBe(2100);
  expect(txs[0].vin.every((vin) => vin.prevout?.value === 1000)).toBe(true);
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(1);
});

test('stale blocks tolerate failed fallback while ordinary conversion propagates errors', async () => {
  const incomplete = input();
  delete incomplete.value;
  const f = fixture();
  f.client.getRawTransaction.mockRejectedValue(new Error('parent unavailable'));
  await expect(f.api.convert(transaction([input(), incomplete]))).rejects.toThrow('parent unavailable');
  const tx = await f.api.convert(transaction([input(), incomplete]), true, false, true);
  expect(tx.vin[0].prevout).toEqual(expectedOutput());
  expect(tx.vin[1].prevout).toBeNull();
  expect(tx.fee).toBe(0);
});

test('returned prevout arrays do not alias the raw input, sibling, or output', async () => {
  const vin = input();
  const out = output();
  out.scriptPubKey.byteCodePattern = vin.scriptPubKey.byteCodePattern;
  const raw = transaction([vin, vin], [out]);
  const f = fixture();
  const tx = await f.api.convert(raw);
  tx.vin[0].prevout!.scriptpubkey_byte_code.push('aa');
  expect(tx.vin[1].prevout!.scriptpubkey_byte_code).toEqual(['51']);
  expect(tx.vout[0].scriptpubkey_byte_code).toEqual(['51']);
  expect(vin.scriptPubKey.byteCodePattern.data).toEqual(['51']);
  expect(tx.vin[0].scriptpubkey_byte_code).toEqual(['51']);
});

test('cached mempool enrichment retains parent fallback and recalculates flags only once', async () => {
  const f = fixture();
  const cached: any = await f.api.convert(transaction([input()], [output()], 0), false);
  cached.flags = 123;
  jest.mocked(mempool.getMempool).mockReturnValue({ child: cached });
  const flags = jest.spyOn(Common, 'getTransactionFlags').mockReturnValue(456);
  const tx: any = await f.api.$getRawTransaction('child', false, true);
  expect(tx).toBe(cached);
  expect(tx.vin[0].prevout).toEqual(expectedOutput());
  expect(tx.flags).toBe(456);
  expect(flags).toHaveBeenCalledTimes(1);
  expect(f.client.getRawTransaction.mock.calls).toEqual([['parent', 2, '', true]]);
  await f.api.$getRawTransaction('child', false, true);
  expect(flags).toHaveBeenCalledTimes(1);
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(1);
});

test.each([
  [
    'non-finite value',
    (vin: any) => {
      vin.value = Number.NaN;
    },
  ],
  [
    'negative value',
    (vin: any) => {
      vin.value = -1;
    },
  ],
  [
    'malformed pattern data',
    (vin: any) => {
      vin.scriptPubKey.byteCodePattern.data = ['51', null];
    },
  ],
  [
    'null address',
    (vin: any) => {
      vin.scriptPubKey.address = null;
    },
  ],
  [
    'unknown script type',
    (vin: any) => {
      vin.scriptPubKey.type = 'future';
    },
  ],
  [
    'null token data',
    (vin: any) => {
      vin.tokenData = null;
    },
  ],
  [
    'null NFT data',
    (vin: any) => {
      vin.tokenData = { category: 'ab'.repeat(32), amount: '1', nft: null };
    },
  ],
])('falls back for %s', async (_label, change) => {
  const vin = input();
  change(vin);
  const f = fixture();
  const tx = await f.api.convert(transaction([vin]));
  expect(tx.vin[0].prevout).toEqual(expectedOutput());
  expect(tx.fee).toBe(100);
  expect(f.client.getRawTransaction).toHaveBeenCalledTimes(1);
});

test('complete stale block input metadata remains usable without missing-parent calls', async () => {
  const f = fixture();
  f.client.getBlock.mockResolvedValue({
    hash: 'block',
    height: 100,
    time: 123,
    confirmations: -1,
    tx: [transaction()],
  });
  const txs = await f.api.$getTxsForBlock('block', false, { reusePrevouts: true });
  expect(txs[0].vin[0].prevout).toEqual(expectedOutput());
  expect(txs[0].fee).toBe(100);
  expect(f.client.getRawTransaction).not.toHaveBeenCalled();
});
