const fakeMempool: Record<string, any> = {};
let chainTip = 0;
jest.mock('../../api/blocks', () => ({
  __esModule: true,
  default: { getCurrentBlockHeight: () => chainTip, getBlocks: () => [] },
}));
jest.mock('../../api/mempool', () => ({
  __esModule: true,
  default: { getMempool: () => fakeMempool, isInSync: () => true },
}));
jest.mock('../../api/bitcoin/bitcoin-api-factory', () => ({ __esModule: true, default: {}, bitcoinCoreApi: {} }));
// The native scan itself, counted.
jest.mock('rust-filter-scan', () => {
  const actual = jest.requireActual('rust-filter-scan');
  return { ...actual, scanFilters: jest.fn(actual.scanFilters) };
});

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanFilters } from 'rust-filter-scan';
import { AddressHistoryUnavailableError } from '../../api/bitcoin/address-pagination';
import P2PBackendApi, { merkleBranch } from '../../api/bitcoin/p2p-api';
import { FilterReader, FilterStore, FilterStoreChangedError } from '../../api/bitcoin/p2p/filter-store';
import { LightClient, ScriptTx, summarize } from '../../api/bitcoin/p2p/light-client';
import { P2PPeer, P2PTimeoutError } from '../../api/bitcoin/p2p/peer';
import { ScriptFilterError, splitTokenPrefix } from '../../api/bitcoin/p2p/script-filter';
import { sha256, toDisplay } from '../../api/bitcoin/p2p/wire';
import {
  FakeChain,
  FakeNode,
  MAGIC,
  Output,
  fakeRpc,
  merkle,
  p2pkh,
  withToken,
} from '../../../test/fixtures/p2p-fake-node';

const A = p2pkh(0xaa);
const B = p2pkh(0xbb);
const C = p2pkh(0xcc);
const addressOf = (script: Buffer) => 'bchreg:' + script.toString('hex');
const scripthashOf = (script: Buffer) => Buffer.from(sha256(script)).reverse().toString('hex');
const point = (txid: Buffer, vout: number) => `${toDisplay(txid)}:${vout}`;
const locking = (o: Output) => splitTokenPrefix(o.script).script;

/** What the chain itself says about a script: its transactions newest first, funded and spent sums, unspent outputs. */
function truth(chain: FakeChain, script: Buffer) {
  const txs: { txid: string; height: number; txIndex: number }[] = [];
  const created = new Map<string, number>();
  let spentSum = 0;
  let spentCount = 0;
  for (const block of chain.blocks) {
    block.txs.forEach((tx, txIndex) => {
      let touches = false;
      tx.outputs.forEach((o, vout) => {
        if (locking(o).equals(script)) {
          created.set(point(tx.txid, vout), o.value);
          touches = true;
        }
      });
      tx.inputs.forEach((input) => {
        if (locking(input.prev).equals(script)) {
          spentSum += input.prev.value;
          spentCount++;
          touches = true;
        }
      });
      if (touches) {
        txs.push({ txid: toDisplay(tx.txid), height: block.height, txIndex });
      }
    });
  }
  const unspent = [...chain.unspent()].filter(([, o]) => locking(o).equals(script)).map(([p]) => p);
  txs.sort((a, b) => b.height - a.height || b.txIndex - a.txIndex);
  return {
    txids: txs.map((t) => t.txid),
    blocks: new Set(txs.map((t) => t.height)).size,
    funded: [...created.values()].reduce((s, v) => s + v, 0),
    fundedCount: created.size,
    spentSum,
    spentCount,
    unspent: unspent.sort(),
  };
}

async function until(check: () => boolean, ms = 10_000): Promise<void> {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) {
      throw new Error('Timed out waiting');
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let chain: FakeChain;
let node: FakeNode;
let dir: string;
let syncPeer: P2PPeer;
let queryPeer: P2PPeer;
let store: FilterStore;
let client: LightClient;
let rangeClient: LightClient;
let reader: FilterReader;
let readerClient: LightClient;
let rpc: ReturnType<typeof fakeRpc>;
let api: P2PBackendApi;
let coinbases: Buffer[];

beforeAll(async () => {
  chain = new FakeChain();
  coinbases = [];
  // Filler: every block pays the miner and moves coins between scripts nobody looks at.
  const filler = (h: number) => {
    const spends = h > 2 ? [point(coinbases[h - 2], 0)] : [];
    const block = chain.mine(
      spends.length ? [{ spends, outputs: [{ script: p2pkh(h % 200), value: 4_000_000_000 }] }] : []
    );
    coinbases.push(block.txs[0].txid);
  };
  const aPay = chain.mine([], [{ script: A, value: 5_000_000_000 }]);
  coinbases.push(aPay.txs[0].txid);
  for (let h = 2; h < 5; h++) {
    filler(h);
  }
  // Height 5: A pays B and itself the change in one transaction.
  const change = chain.mine([
    {
      spends: [point(aPay.txs[0].txid, 0)],
      outputs: [
        { script: B, value: 1_000_000_000 },
        { script: A, value: 3_900_000_000 },
      ],
    },
  ]);
  coinbases.push(change.txs[0].txid);
  filler(6);
  // Height 7: A gets a token output and a plain one from the miner.
  const category = Buffer.alloc(32, 0x42);
  const token = chain.mine([
    {
      spends: [point(coinbases[5], 0)],
      outputs: [
        { script: withToken(category, 9, A), value: 1000 },
        { script: A, value: 200_000_000 },
        { script: Buffer.from('6a0401020304', 'hex'), value: 0 },
      ],
    },
  ]);
  coinbases.push(token.txs[0].txid);
  filler(8);
  // Height 9: the token output goes to B.
  const tokenSpend = chain.mine([
    { spends: [point(token.txs[1].txid, 0)], outputs: [{ script: withToken(category, 9, B), value: 800 }] },
  ]);
  coinbases.push(tokenSpend.txs[0].txid);
  for (let h = 10; h < 1100; h++) {
    filler(h);
  }
  // Height 1100: a late payment to A and two to C, past the first checkpoint.
  const late = chain.mine([
    {
      spends: [point(coinbases[1098], 0)],
      outputs: [
        { script: A, value: 70_000 },
        { script: C, value: 1 },
        { script: C, value: 2 },
      ],
    },
  ]);
  coinbases.push(late.txs[0].txid);
  for (let h = 1101; h < 1210; h++) {
    filler(h);
  }
  // Height 1210: A's change output goes to C.
  const last = chain.mine([{ spends: [point(change.txs[1].txid, 1)], outputs: [{ script: C, value: 3_800_000_000 }] }]);
  coinbases.push(last.txs[0].txid);
  chainTip = chain.tip.height;

  node = new FakeNode(chain);
  const port = await node.listen();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-p2p-store-'));
  syncPeer = new P2PPeer({ host: '127.0.0.1', port, magic: MAGIC, timeout: 3000, name: 'sync' });
  queryPeer = new P2PPeer({ host: '127.0.0.1', port, magic: MAGIC, timeout: 1500, name: 'query' });
  store = new FilterStore(dir, syncPeer, { network: 'regtest', pollInterval: 60_000 });
  await store.open();
  syncPeer.start();
  queryPeer.start();
  store.start();
  await until(() => store.tipHeight === chain.tip.height);
  client = new LightClient(store, queryPeer, { prefixBits: 256, maxHistoryTxs: 1000 });
  rangeClient = new LightClient(store, queryPeer, { mode: 'range', prefixBits: 256, maxHistoryTxs: 1000 });
  // A reader of the same files, as a cluster worker has them.
  reader = new FilterReader(dir, { network: 'regtest' });
  await reader.open();
  readerClient = new LightClient(reader, queryPeer, { prefixBits: 256, maxHistoryTxs: 1000 });
  rpc = fakeRpc(chain, (hex) => 'bchreg:' + hex);
  api = new P2PBackendApi(rpc, { client, mempool: () => fakeMempool, started: Promise.resolve() });
}, 60_000);

afterAll(async () => {
  await reader.stop();
  syncPeer.stop();
  queryPeer.stop();
  await store.stop();
  await node.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
  for (const key of Object.keys(fakeMempool)) {
    delete fakeMempool[key];
  }
});

test('the store keeps every filter of the chain, checked against the checkpoints', async () => {
  expect(store.tipHeight).toBe(chain.tip.height);
  expect(node.count('getcfcheckpt')).toBe(1);
  expect(node.count('getcfilters')).toBe(2);
  for (const height of [0, 1, 7, 999, 1000, 1100, chain.tip.height]) {
    expect((await store.readFilter(height)).equals(chain.blocks[height].filter)).toBe(true);
    expect(store.hashAt(height)!.equals(chain.blocks[height].hash)).toBe(true);
    expect(store.merkleRootAt(height)!.equals(chain.blocks[height].merkleRoot)).toBe(true);
  }
});

const sent = () => ({ data: node.count('getdata'), range: node.count('getcfrange'), proof: node.count('getcfproof') });

test('address totals, history pages and unspent outputs come from the filters and matching blocks alone', async () => {
  const expected = truth(chain, A);
  const before = sent();
  const address = await api.$getAddress(addressOf(A));
  expect(address).toEqual({
    address: addressOf(A),
    chain_stats: {
      funded_txo_count: expected.fundedCount,
      funded_txo_sum: expected.funded,
      spent_txo_count: expected.spentCount,
      spent_txo_sum: expected.spentSum,
      tx_count: expected.txids.length,
    },
    mempool_stats: { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0 },
  });
  // The node is asked for the blocks whose filter matches, and nothing that names the address.
  const after = sent();
  expect(after.data - before.data).toBeGreaterThanOrEqual(expected.blocks);
  expect(after.data - before.data).toBeLessThan(expected.blocks + 3);
  expect(after.range - before.range).toBe(0);
  expect(after.proof - before.proof).toBe(0);

  const first = await api.$getAddressTransactions(addressOf(A), '');
  expect(first.map((tx) => tx.txid)).toEqual(expected.txids.slice(0, 10));
  expect(first[0].status).toMatchObject({ confirmed: true, block_height: 1210 });
  // Every transaction was read by its block: the node needs no transaction index.
  const reads = rpc.calls.filter((c) => c.method === 'getrawtransaction');
  expect(reads.length).toBeGreaterThan(0);
  expect(reads.every((c) => typeof c.params[2] === 'string' && (c.params[2] as string).length === 64)).toBe(true);

  const utxos = await api.$getAddressUtxos(addressOf(A));
  expect(utxos.map((u) => `${u.txid}:${u.vout}`).sort()).toEqual(expected.unspent);
  expect(utxos.every((u) => u.status.confirmed && u.status.block_time)).toBe(true);
  expect(utxos.reduce((s, u) => s + u.value, 0)).toBe(expected.funded - expected.spentSum);
});

test('scripthash routes give the same history for the Electrum scripthash', async () => {
  const expected = truth(chain, C);
  const stats = await api.$getScriptHash(scripthashOf(C));
  expect(stats.scripthash).toBe(scripthashOf(C));
  expect(stats.chain_stats).toMatchObject({ tx_count: expected.txids.length, funded_txo_sum: expected.funded });
  const txs = await api.$getScriptHashTransactions(scripthashOf(C), '');
  expect(txs.map((tx) => tx.txid)).toEqual(expected.txids);
  const utxos = await api.$getScriptHashUtxos(scripthashOf(C));
  expect(utxos.map((u) => `${u.txid}:${u.vout}`).sort()).toEqual(expected.unspent);
});

test('the mempool part comes from the explorer mempool copy', async () => {
  const expected = truth(chain, A);
  const spend = expected.unspent[0];
  const [txid, vout] = spend.split(':');
  const value = chain.unspent().get(spend)!.value;
  fakeMempool['ab'.repeat(32)] = {
    txid: 'ab'.repeat(32),
    vin: [{ txid, vout: Number(vout), is_coinbase: false, prevout: { scriptpubkey: A.toString('hex'), value } }],
    vout: [
      { scriptpubkey: B.toString('hex'), value: value - 1000 - 500 },
      { scriptpubkey: A.toString('hex'), value: 1000 },
    ],
    status: { confirmed: false },
  };
  const address = await api.$getAddress(addressOf(A));
  expect(address.mempool_stats).toEqual({
    funded_txo_count: 1,
    funded_txo_sum: 1000,
    spent_txo_count: 1,
    spent_txo_sum: value,
    tx_count: 1,
  });
  const utxos = await api.$getAddressUtxos(addressOf(A));
  expect(utxos.find((u) => `${u.txid}:${u.vout}` === spend)).toBeUndefined();
  expect(utxos.find((u) => !u.status.confirmed)).toMatchObject({ txid: 'ab'.repeat(32), vout: 1, value: 1000 });
  const pending = await api.$getAddressMempoolTransactions(addressOf(A));
  expect(pending.map((tx) => tx.txid)).toEqual(['ab'.repeat(32)]);
  const all = await api.$getAddressTransactions(addressOf(A), '');
  expect(all[0].txid).toBe('ab'.repeat(32));
  expect((await api.$getAddressMempoolSummary(addressOf(A))).pendingTransactionCount).toBe(1);
  const summary = await api.$getAddressSummary(addressOf(A));
  expect(summary).toMatchObject({
    confirmedBalance: expected.funded - expected.spentSum,
    pendingBalance: 1000 - value,
    electrum: false,
  });
});

test('paginated pages and counts scan the filters window by window', async () => {
  const expected = truth(chain, B);
  const seen: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.$getAddressPage(addressOf(B), false, cursor);
    seen.push(...page.transactions.map((tx) => tx.txid));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(seen).toEqual(expected.txids);
  let count: number | undefined;
  cursor = undefined;
  do {
    const page = await api.$getAddressCount(scripthashOf(B), true, cursor);
    count = page.confirmedCount;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(count).toBe(expected.txids.length);
});

test('a spend is found by scanning forward from the output, and merkle proofs come from the block', async () => {
  const change = chain.blocks[5].txs[1];
  rpc.txindex = true;
  try {
    const outspend = await api.$getOutspend(toDisplay(change.txid), 1);
    expect(outspend).toEqual({ spent: true, txid: toDisplay(chain.blocks[1210].txs[1].txid), vin: 0 });
    expect(await api.$getOutspend(toDisplay(chain.blocks[1100].txs[1].txid), 0)).toEqual({ spent: false });
    const proof = await api.$getTransactionMerkleProof(toDisplay(chain.blocks[7].txs[1].txid));
    const block = chain.blocks[7];
    expect(proof).toEqual({
      block_height: 7,
      pos: 1,
      merkle: merkle(block.txs.map((t) => t.txid))
        .branch(1)
        .map(toDisplay),
    });
  } finally {
    rpc.txindex = false;
  }
  expect(merkleBranch(['aa'.repeat(32)], 0)).toEqual([]);
});

test('range mode gives the histories of block mode from leaves and proofs, without blocks', async () => {
  const withoutValues = (txs: ScriptTx[]) =>
    txs.map((tx) => ({ ...tx, spends: tx.spends.map(({ vin, txid, vout }) => ({ vin, txid, vout })) }));
  for (const script of [A, B, C, p2pkh(0x17)]) {
    const blocks = await client.history(sha256(script));
    const before = sent();
    const ranges = await rangeClient.history(sha256(script));
    const after = sent();
    expect(withoutValues(ranges.txs)).toEqual(withoutValues(blocks.txs));
    expect(summarize(ranges.txs).spentSum).toBe(summarize(blocks.txs).spentSum);
    expect(after.data).toBe(before.data);
    expect(after.proof - before.proof).toBe(new Set(blocks.txs.map((tx) => tx.txid)).size);
    expect(after.range - before.range).toBeGreaterThanOrEqual(truth(chain, script).blocks);
  }
});

test('a shorter range prefix shows the node a bucket of keys and gives the same history', async () => {
  const bucket = new LightClient(store, queryPeer, { mode: 'range', prefixBits: 4, maxHistoryTxs: 1000 });
  const key = sha256(A);
  const exact = await rangeClient.history(key);
  const before = node.requests.filter((m) => m.command === 'getcfrange').length;
  const coarse = await bucket.history(key);
  const asked = node.requests.filter((m) => m.command === 'getcfrange').slice(before);
  expect(coarse.txs).toEqual(exact.txs);
  expect(asked.length).toBeGreaterThan(0);
  // Only the first four bits of the key are sent; the rest of the prefix is zero.
  for (const message of asked) {
    const prefix = message.payload.subarray(35, 67);
    expect(message.payload.readUInt16LE(33)).toBe(4);
    expect(prefix[0]).toBe(key[0] & 0xf0);
    expect(prefix.subarray(1).equals(Buffer.alloc(31))).toBe(true);
  }
});

test('a history over the limit is refused before any block, range or proof is asked', async () => {
  for (const mode of ['block', 'range'] as const) {
    const small = new LightClient(store, queryPeer, { mode, prefixBits: 256, maxHistoryTxs: 5 });
    const asked = node.requests.length;
    await expect(small.history(sha256(p2pkh(0xee)))).rejects.toThrow(AddressHistoryUnavailableError);
    expect(node.requests.slice(asked).map((m) => m.command)).toEqual([]);
  }
});

test('a block that does not match its header is refused', async () => {
  const fresh = p2pkh(0x16); // paid by filler blocks 22, 222, 422 ...
  node.tamper = (command, payload) => {
    if (command === 'block') {
      payload = Buffer.from(payload);
      payload[payload.length - 10] ^= 1; // a byte of the last transaction
    }
    return payload;
  };
  try {
    await expect(api.$getAddress(addressOf(fresh))).rejects.toThrow('does not match its header');
  } finally {
    node.tamper = undefined;
  }
  expect((await api.$getAddress(addressOf(fresh))).chain_stats.tx_count).toBe(truth(chain, fresh).txids.length);
});

test('in range mode a node that hides a leaf or changes a transaction is caught', async () => {
  const fresh = p2pkh(0x18); // paid by filler blocks 24, 224, 424 ...
  node.tamper = (command, payload) => {
    if (command === 'cfrange' && payload.length > 41 + 41) {
      payload = Buffer.from(payload);
      payload[45] ^= 1; // a byte of the first leaf's key
    }
    return payload;
  };
  await expect(rangeClient.history(sha256(fresh))).rejects.toThrow(ScriptFilterError);
  node.tamper = (command, payload) => {
    if (command === 'cfproof') {
      payload = Buffer.from(payload);
      payload[payload.length - 40] ^= 1;
    }
    return payload;
  };
  await expect(rangeClient.history(sha256(fresh))).rejects.toThrow();
  node.tamper = undefined;
  const ok = await rangeClient.history(sha256(fresh));
  expect(ok.txs.length).toBe(truth(chain, fresh).txids.length);
});

test('an unanswered request times out, drops the connection and the next one reconnects', async () => {
  node.silent.add('getdata');
  try {
    await expect(client.blockTxs(sha256(p2pkh(0x31)), 0x31)).rejects.toThrow(P2PTimeoutError);
  } finally {
    node.silent.delete('getdata');
  }
  await until(() => queryPeer.isReady);
  expect((await client.blockTxs(sha256(p2pkh(0x33)), 0x33)).length).toBe(1);
});

test('long scans that wait share one pass over the files, each with its own heights', async () => {
  const end = chain.tip.height + 1;
  const [a, b, c] = [A, B, C].map((script) => sha256(script));
  const alone = [];
  for (const key of [a, b, c]) {
    alone.push((await store.match([key], 0, end))[0]);
  }
  const passes = (scanFilters as jest.Mock).mock.calls.length;
  const together = await Promise.all([store.match([a], 0, end), store.match([b], 5, end), store.match([c, a], 0, end)]);
  // The first starts a pass at once; the two that wait for it share the next.
  expect((scanFilters as jest.Mock).mock.calls.length - passes).toBe(2);
  expect(together).toEqual([[alone[0]], [alone[1].filter((h) => h >= 5)], [alone[2], alone[0]]]);
  expect(alone[0]).toEqual(
    [...new Set(truth(chain, A).txids.map((t) => chain.findTx(Buffer.from(t, 'hex').reverse())!.block.height))].sort(
      (x, y) => x - y
    )
  );
});

test('a reader of the store sees what the writer committed and gives the same histories', async () => {
  await reader.refresh();
  expect(reader.tipHeight).toBe(store.tipHeight);
  expect(reader.synced).toBe(true);
  for (const height of [0, 1100, store.tipHeight]) {
    expect(reader.hashAt(height)!.equals(store.hashAt(height)!)).toBe(true);
    expect((await reader.readFilter(height)).equals(await store.readFilter(height))).toBe(true);
  }
  for (const script of [A, B, C]) {
    expect((await readerClient.history(sha256(script))).txs).toEqual((await client.history(sha256(script))).txs);
  }
  // Before the writer made its files, a reader is an empty store that waits for them.
  const early = new FilterReader(path.join(dir, 'not-yet'), { network: 'regtest' });
  await early.open();
  expect(early.tipHeight).toBe(-1);
  expect(early.synced).toBe(false);
  await early.stop();
  await expect(new FilterReader(dir, { network: 'mainnet' }).open()).rejects.toThrow('belongs to');
});

test('a reorganization replaces the stored blocks and the cached histories', async () => {
  const before = truth(chain, A);
  expect((await api.$getAddress(addressOf(A))).chain_stats.tx_count).toBe(before.txids.length);
  // The last block, which spent A's change, is replaced by two blocks that pay A instead.
  chain.rewind(chain.tip.height - 1);
  chain.mine([], [{ script: A, value: 123 }]);
  chain.mine([]);
  chainTip = chain.tip.height;
  node.announce();
  await until(() => store.hashAt(store.tipHeight)!.equals(chain.tip.hash));
  const after = truth(chain, A);
  const address = await api.$getAddress(addressOf(A));
  expect(address.chain_stats).toEqual({
    funded_txo_count: after.fundedCount,
    funded_txo_sum: after.funded,
    spent_txo_count: after.spentCount,
    spent_txo_sum: after.spentSum,
    tx_count: after.txids.length,
  });
  expect(after.txids.length).toBe(before.txids.length);

  // A reader that has not looked since: what it reads now is refused, and its next look finds the fork.
  await expect(reader.readFilter(chain.tip.height - 3)).rejects.toThrow(FilterStoreChangedError);
  await expect(reader.match([sha256(A)], 0, chain.tip.height)).rejects.toThrow(FilterStoreChangedError);
  const forks: number[] = [];
  reader.once('reorg', (fork) => forks.push(fork));
  await reader.refresh();
  expect(forks).toEqual([chain.tip.height - 2]);
  expect(reader.hashAt(reader.tipHeight)!.equals(chain.tip.hash)).toBe(true);
  expect((await readerClient.history(sha256(A))).txs).toEqual((await client.history(sha256(A))).txs);
});

test('a filter that leaves out an output of a block it matches is caught', async () => {
  // A lying node builds a block's filter without D's key: D could never be found in that block.
  const D = p2pkh(0xdd);
  chain.mine(
    [
      {
        spends: [point(chain.blocks[1209].txs[0].txid, 0)],
        outputs: [
          { script: D, value: 5 },
          { script: A, value: 6 },
        ],
      },
    ],
    undefined,
    [sha256(D)]
  );
  chainTip = chain.tip.height;
  node.announce();
  await until(() => store.hashAt(store.tipHeight)!.equals(chain.tip.hash));
  await expect(api.$getAddress(addressOf(A))).rejects.toThrow('leaves out an output');
});

test('the store reopens from its files, and a damaged filter is downloaded again', async () => {
  const offline = { isReady: false, request: jest.fn(), on: jest.fn(), off: jest.fn() };
  // The running store holds the files; a copy is opened instead.
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-p2p-copy-'));
  try {
    for (const file of ['meta.json', 'index.dat', 'filters.dat']) {
      fs.copyFileSync(path.join(dir, file), path.join(copy, file));
    }
    const filters = path.join(copy, 'filters.dat');
    const bytes = fs.readFileSync(filters);
    bytes[bytes.length - 5] ^= 0xff;
    fs.writeFileSync(filters, bytes);
    const damaged = new FilterStore(copy, offline, { network: 'regtest' });
    await damaged.open();
    expect(damaged.tipHeight).toBe(chain.tip.height - 1);
    await damaged.stop();
    await expect(new FilterStore(copy, offline, { network: 'mainnet' }).open()).rejects.toThrow('belongs to');
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
});
