jest.mock('../../api/blocks', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {} }));
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getFirstSeenForTransactions: jest.fn((ids: string[]) => ids.map(() => 123)) },
}));
import routes from '../../api/bitcoin/bitcoin.routes';
import bitcoinApi from '../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../api/bitcoin/bitcoin-client';
import mempool from '../../api/mempool';
import config from '../../config';

const txid = '1'.repeat(64);
const handlers = routes as any;

async function invoke(method: string, params = {}, query = {}) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn(), send: jest.fn(), setHeader: jest.fn() };
  await handlers[method]({ params, query, accepts: () => true }, res);
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
});

test.each([
  { name: 'empty array', ids: [] },
  { name: 'single ID', ids: [txid] },
  { name: 'invalid ID filtering and duplicates', ids: [txid, 'invalid', null, {}, [txid], 1, txid] },
  { name: '100 supplied IDs', ids: Array(100).fill(txid) },
])('transaction-times preserves empty arrays, filtering, duplicates and the boundary: $name', async ({ ids }) => {
  const expectedIds = ids.filter((id) => typeof id === 'string' && /^[a-f0-9]{64}$/i.test(id));
  const res = await invoke('getTransactionTimes', {}, { txId: ids });
  expect(mempool.getFirstSeenForTransactions).toHaveBeenCalledWith(expectedIds);
  expect(res.json).toHaveBeenCalledWith(expectedIds.map(() => 123));
  expect(res.status).not.toHaveBeenCalled();
});

test.each([
  { name: 'missing IDs', ids: undefined },
  { name: 'scalar ID', ids: txid },
  { name: 'object IDs', ids: {} },
  { name: '101 supplied IDs', ids: Array(101).fill(txid) },
  { name: '101 IDs before invalid ID filtering', ids: [txid, ...Array(100).fill('invalid')] },
])('malformed or excessive transaction-times requests reject before mempool access: $name', async ({ ids }) => {
  const res = await invoke('getTransactionTimes', {}, { txId: ids });
  expect(res.status).toHaveBeenCalledWith(400);
  expect(mempool.getFirstSeenForTransactions).not.toHaveBeenCalled();
});

const invalidGuards: [string, Record<string, string>, string][] = [
  ...[
    'getTransaction',
    'getTransactionHex',
    'getTransactionStatus',
    'getTransactionOutspends',
    'getTransactionOutspend',
    'getTransactionMerkleProof',
  ].map((method): [string, Record<string, string>, string] => [method, { txId: 'invalid' }, 'Invalid transaction ID']),
  ...[
    'getStrippedBlockTransactions',
    'getStrippedBlockTransaction',
    'getBlock',
    'getBlockHeader',
    'getBlockAuditSummary',
    '$getBlockTxAuditSummary',
    'getBlockTransactions',
    'getRawBlock',
    'getTxIdsForBlock',
  ].map((method): [string, Record<string, string>, string] => [method, { hash: 'invalid' }, 'Invalid block hash']),
  ['getStrippedBlockTransaction', { hash: txid, txid: 'invalid' }, 'Invalid transaction ID'],
  ['$getBlockTxAuditSummary', { hash: txid, txid: 'invalid' }, 'Invalid transaction ID'],
  ...[
    'getAddress',
    'getAddressTransactions',
    'getAddressUtxo',
    'getAddressChainTransactions',
    'getAddressMempoolTransactions',
    'validateAddress',
  ].map((method): [string, Record<string, string>, string] => [method, { address: 'invalid!' }, 'Invalid address']),
  ...['getScriptHash', 'getScriptHashTransactions', 'getScriptHashMempoolTransactions', 'getScriptHashUtxo'].map(
    (method): [string, Record<string, string>, string] => [method, { scripthash: 'invalid!' }, 'Invalid scripthash']
  ),
  ['getTransactionOutspend', { txId: txid, vout: 'invalid' }, 'Invalid vout'],
];

test.each(invalidGuards)('%s returns 400 for invalid parameters %j', async (method, params, message) => {
  const backend = config.EXPLORER.BACKEND;
  config.EXPLORER.BACKEND = 'electrum';
  try {
    const res = await invoke(method, params);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: message });
  } finally {
    config.EXPLORER.BACKEND = backend;
  }
});

test.each([undefined, '', [], {}].map((txids) => ({ txids })))(
  'batched outspends rejects malformed query $txids as 400',
  async ({ txids }) => {
    const res = await invoke('$getBatchedOutspends', {}, { txids });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid txids format' });
  }
);

test.each([
  ['mainnet', 'bitcoincash:qtestaddress'],
  ['chipnet', 'bchtest:qtestaddress'],
  ['testnet4', 'bchtest:qtestaddress'],
] as const)('BCH address syntax remains accepted on %s', async (network, address) => {
  const originalNetwork = config.EXPLORER.NETWORK;
  const validate = jest.spyOn(bitcoinClient, 'validateAddress').mockResolvedValue({ isvalid: false } as any);
  config.EXPLORER.NETWORK = network;
  try {
    const res = await invoke('validateAddress', { address });
    expect(validate).toHaveBeenCalledWith(address);
    expect(res.json).toHaveBeenCalledWith({ isvalid: false });
    expect(res.status).not.toHaveBeenCalled();
  } finally {
    config.EXPLORER.NETWORK = originalNetwork;
    validate.mockRestore();
  }
});

test.each([
  ['getTransactionHex', '$getTransactionHex', { txId: txid }],
  ['getBlockHeader', '$getBlockHeader', { hash: txid }],
  ['getRawBlock', '$getRawBlock', { hash: txid }],
  ['getTxIdsForBlock', '$getTxIdsForBlock', { hash: txid }],
  ['getTransactionOutspends', '$getOutspends', { txId: txid }],
  ['getTransactionOutspend', '$getOutspend', { txId: txid, vout: '0' }],
  ['getTransactionMerkleProof', '$getTransactionMerkleProof', { txId: txid }],
])('%s retains 500 for actual backend failures', async (method, apiMethod, params) => {
  const failure = jest.fn().mockRejectedValue(new Error('Backend unavailable'));
  Object.assign(bitcoinApi, { [apiMethod as string]: failure });
  const res = await invoke(method as string, params as Record<string, string>);
  expect(failure).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(500);
});

test('transaction lookup retains 404 for a missing transaction', async () => {
  Object.assign(bitcoinApi, {
    $getTransactionHex: jest.fn().mockRejectedValue(new Error('No such mempool or blockchain transaction')),
  });
  const res = await invoke('getTransactionHex', { txId: txid });
  expect(res.status).toHaveBeenCalledWith(404);
});
