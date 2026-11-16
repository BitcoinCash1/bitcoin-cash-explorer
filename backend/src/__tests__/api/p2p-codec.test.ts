import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { scanFilters } from 'rust-filter-scan';
import { gcsCount, gcsHash, gcsMatch, gcsValues, mulHigh64, siphash24 } from '../../api/bitcoin/p2p/gcs';
import { merkleRootOf } from '../../api/bitcoin/p2p/light-client';
import {
  MSG_BLOCK,
  decodeBlock,
  decodeNotFoundBlocks,
  encodeGetData,
  decodeCFProof,
  decodeCFRange,
  decodeHeaders,
  encodeGetCFProof,
  encodeGetCFRange,
  encodeGetHeaders,
  meetsTarget,
  parseBlockHeader,
} from '../../api/bitcoin/p2p/messages';
import {
  LeafKind,
  ScriptFilterError,
  categoryKey,
  checkRange,
  comparePrefix,
  keyPrefix,
  leavesRoot,
  parseLeaf,
  rangeRoot,
  serializeLeaf,
  splitTokenPrefix,
  txKey,
} from '../../api/bitcoin/p2p/script-filter';
import {
  ByteWriter,
  MessageDecoder,
  NETWORKS,
  ProtocolError,
  ZERO_HASH,
  decodeVersion,
  encodeMessage,
  encodeVarint,
  encodeVersion,
  fromDisplay,
  sha256,
  sha256d,
  toDisplay,
} from '../../api/bitcoin/p2p/wire';
import {
  FakeChain,
  FakeTx,
  blockLeaves,
  gcsEncode,
  p2pkh,
  rangeHashes,
  serializeBlock,
  withToken,
} from '../../../test/fixtures/p2p-fake-node';

const vectors = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-data/p2p-script-filter-vectors.json'), 'utf8'));
const hex = (s: string) => Buffer.from(s, 'hex');
const wire = (name: string) => hex(vectors.bchdWire[name].payload);
const vectorBlock = hex('b0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecf');

describe('P2P framing', () => {
  const magic = NETWORKS.regtest.magic;

  test('a message splits back out of any chunking, with its checksum checked', () => {
    const payload = Buffer.from('payload bytes');
    const stream = Buffer.concat([
      encodeMessage(magic, 'ping', payload),
      encodeMessage(magic, 'verack', Buffer.alloc(0)),
    ]);
    const decoder = new MessageDecoder(magic);
    const out = [];
    for (let i = 0; i < stream.length; i += 3) {
      out.push(...decoder.push(stream.subarray(i, i + 3)));
    }
    expect(out.map((m) => m.command)).toEqual(['ping', 'verack']);
    expect(out[0].payload.equals(payload)).toBe(true);
  });

  test('wrong magic, a bad checksum and an oversized payload are refused', () => {
    const good = encodeMessage(magic, 'ping', Buffer.from([1, 2, 3]));
    expect(() => new MessageDecoder(NETWORKS.mainnet.magic).push(good)).toThrow(ProtocolError);
    const corrupt = Buffer.from(good);
    corrupt[corrupt.length - 1] ^= 1;
    expect(() => new MessageDecoder(magic).push(corrupt)).toThrow('checksum');
    const big = Buffer.from(good);
    big.writeUInt32LE(1000, 16);
    expect(() => new MessageDecoder(magic, 999).push(big)).toThrow('too large');
  });

  test('network magics follow the nodes', () => {
    expect(NETWORKS.mainnet.magic.toString('hex')).toBe('e3e1f3e8');
    expect(NETWORKS.chipnet.magic.toString('hex')).toBe('e2b7daaf');
    expect(NETWORKS.testnet4.magic.toString('hex')).toBe('e2b7daaf');
    expect(NETWORKS.testnet3.magic.toString('hex')).toBe('f4e5f3f4');
    expect(NETWORKS.regtest.magic.toString('hex')).toBe('dab5bffa');
  });

  test('varints and the version message round-trip', () => {
    expect(encodeVarint(0xfc).toString('hex')).toBe('fc');
    expect(encodeVarint(0xfd).toString('hex')).toBe('fdfd00');
    expect(encodeVarint(0x10000).toString('hex')).toBe('fe00000100');
    const version = decodeVersion(encodeVersion('/test:1/'));
    expect(version).toMatchObject({ version: 70016, services: 0n, userAgent: '/test:1/', startHeight: 0 });
  });
});

describe('script filter messages, from BCHD wire encoders', () => {
  test('getcfrange is encoded byte for byte as bchd encodes it', () => {
    const prefix = Buffer.alloc(32);
    prefix[0] = 0x5c;
    prefix[1] = 0xa0;
    expect(encodeGetCFRange(1, vectorBlock, 12, prefix).equals(wire('getcfrange'))).toBe(true);
    expect(encodeGetCFRange(1, vectorBlock, 0, ZERO_HASH).equals(wire('getcfrange_all'))).toBe(true);
    expect(encodeGetCFProof(1, vectorBlock, 3).equals(wire('getcfproof'))).toBe(true);
  });

  test('cfrange replies decode with their neighbours exactly where the run stops short of an edge', () => {
    const inner = decodeCFRange(wire('cfrange_inner'));
    expect(inner).toMatchObject({ filterType: 1, leafCount: 5, firstIndex: 1 });
    expect(inner.blockHash.equals(vectorBlock)).toBe(true);
    expect(inner.leaves.map((l) => parseLeaf(l))).toMatchObject([
      { txIndex: 1, index: 1, kind: LeafKind.Spent },
      { txIndex: 2, index: 0, kind: LeafKind.OutputCategory },
    ]);
    expect(parseLeaf(inner.before!)).toMatchObject({ txIndex: 1, index: 0, kind: LeafKind.Output });
    expect(parseLeaf(inner.after!)).toMatchObject({ txIndex: 3, index: 2, kind: LeafKind.SpentCategory });
    expect(inner.hashes).toHaveLength(3);

    const start = decodeCFRange(wire('cfrange_none_at_start'));
    expect(start.leaves).toHaveLength(0);
    expect(start.before).toBeUndefined();
    expect(start.after).toBeDefined();
    expect(start.hashes).toHaveLength(2);

    const all = decodeCFRange(wire('cfrange_all'));
    expect(all.leaves).toHaveLength(2);
    expect(all.before ?? all.after).toBeUndefined();

    const empty = decodeCFRange(wire('cfrange_empty_tree'));
    expect(empty).toMatchObject({ leafCount: 0, firstIndex: 0, leaves: [], hashes: [] });
  });

  test('cfproof replies decode with the transaction, and for a spent leaf the creating one', () => {
    const output = decodeCFProof(wire('cfproof_output'));
    expect(output).toMatchObject({ leafCount: 4, leafIndex: 2 });
    expect(output.leafBranch).toHaveLength(2);
    expect(output.tx.raw.equals(hex(vectors.bchdWire.tx5.tx))).toBe(true);
    expect(output.tx.outputs.map((o) => o.value)).toEqual([1005, 2005]);
    expect(output.txBranch).toHaveLength(1);
    expect(output.origin).toBeUndefined();

    const spent = decodeCFProof(wire('cfproof_spent'));
    expect(spent.tx.raw.equals(hex(vectors.bchdWire.tx6.tx))).toBe(true);
    expect(spent.origin!.txIndex).toBe(9);
    expect(spent.origin!.tx.raw.equals(hex(vectors.bchdWire.tx7.tx))).toBe(true);
    expect(spent.origin!.branch).toHaveLength(4);
    expect(toDisplay(spent.origin!.blockHash)).toBe(
      Buffer.from(Array.from({ length: 32 }, (_, i) => 0xe0 ^ i))
        .reverse()
        .toString('hex')
    );

    const category = decodeCFProof(wire('cfproof_spent_category'));
    expect(category.leafBranch).toHaveLength(0);
    expect(category.origin!.tx.raw.equals(hex(vectors.bchdWire.tx9.tx))).toBe(true);
    expect(category.origin!.branch).toHaveLength(0);
  });

  test('truncated or padded replies are refused', () => {
    const inner = wire('cfrange_inner');
    expect(() => decodeCFRange(inner.subarray(0, inner.length - 1))).toThrow(ProtocolError);
    expect(() => decodeCFRange(Buffer.concat([inner, Buffer.from([0])]))).toThrow(ProtocolError);
    const proof = wire('cfproof_spent');
    expect(() => decodeCFProof(proof.subarray(0, proof.length - 32))).toThrow(ProtocolError);
  });

  test('getdata, notfound and block messages, and the Merkle root of a block', () => {
    const hash = Buffer.alloc(32, 7);
    expect(encodeGetData([{ type: MSG_BLOCK, hash }]).toString('hex')).toBe('0102000000' + '07'.repeat(32));
    const notFound = encodeGetData([
      { type: 1, hash: ZERO_HASH },
      { type: MSG_BLOCK, hash },
    ]);
    expect(decodeNotFoundBlocks(notFound)).toEqual([hash]);
    const chain = new FakeChain();
    const coinbase = chain.tip.txs[0].txid;
    const block = chain.mine([
      {
        spends: [`${toDisplay(coinbase)}:0`],
        outputs: [
          { script: p2pkh(1), value: 5 },
          { script: p2pkh(2), value: 6 },
        ],
      },
    ]);
    const raw = serializeBlock(block);
    const decoded = decodeBlock(raw);
    expect(decoded.header.hash.equals(block.hash)).toBe(true);
    expect(decoded.txs.map((tx) => tx.txid)).toEqual(block.txs.map((tx) => tx.txid));
    expect(decoded.txs[1].outputs.map((o) => o.value)).toEqual([5, 6]);
    expect(merkleRootOf(decoded.txs.map((tx) => tx.txid)).equals(block.merkleRoot)).toBe(true);
    expect(merkleRootOf([block.txs[0].txid]).equals(block.txs[0].txid)).toBe(true);
    expect(() => decodeBlock(raw.subarray(0, raw.length - 1))).toThrow(ProtocolError);
  });

  test('getheaders and headers', () => {
    const locator = [Buffer.alloc(32, 1), Buffer.alloc(32, 2)];
    const payload = encodeGetHeaders(locator);
    expect(payload.length).toBe(4 + 1 + 64 + 32);
    const header = Buffer.alloc(80);
    header.writeUInt32LE(0x207fffff, 72);
    for (let nonce = 0; !meetsTarget(parseBlockHeader(header)); nonce++) {
      header.writeUInt32LE(nonce, 76);
    }
    const [decoded] = decodeHeaders(new ByteWriter().varint(1).bytes(header).varint(0).toBuffer());
    expect(decoded.bits).toBe(0x207fffff);
    // The mainnet genesis header meets its target; with harder bits it does not.
    const genesis = hex(
      '0100000000000000000000000000000000000000000000000000000000000000000000003ba3edfd7a7b12b27ac72c3e67768f617fc81bc3888a51323a9fb8aa4b1e5e4a29ab5f49ffff001d1dac2b7c'
    );
    const parsed = parseBlockHeader(genesis);
    expect(toDisplay(parsed.hash)).toBe('000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f');
    expect(meetsTarget(parsed)).toBe(true);
    genesis.writeUInt32LE(0x1b00ffff, 72);
    expect(meetsTarget(parseBlockHeader(genesis))).toBe(false);
  });
});

describe('Golomb-coded sets', () => {
  test('SipHash-2-4 equals the reference client', () => {
    const key = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
    for (const { data, hash } of vectors.siphash) {
      const [lo, hi] = siphash24(key, hex(data));
      expect(hi.toString(16).padStart(8, '0') + lo.toString(16).padStart(8, '0')).toBe(hash);
    }
  });

  test('the 64-bit multiply-shift is exact', () => {
    let seed = 7;
    const rand32 = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0);
    for (let i = 0; i < 2000; i++) {
      const h: [number, number] = [rand32(), rand32()];
      const f = (rand32() % 2 ** 21) * 2 ** 32 + rand32();
      const expected = Number((((BigInt(h[1]) << 32n) | BigInt(h[0])) * BigInt(f)) >> 64n);
      expect(mulHigh64(h, f)).toBe(expected);
    }
  });

  test('the BIP158 testnet genesis filter decodes and matches its coinbase script', () => {
    const { blockHash, script, filter, values } = vectors.bip158Genesis;
    const block = fromDisplay(blockHash);
    expect(gcsValues(hex(filter))).toEqual(values);
    expect(gcsHash(block, 1, hex(script))).toBe(values[0]);
    expect(gcsMatch(hex(filter), block, hex(script))).toBe(true);
    expect(gcsMatch(hex(filter), block, hex('51'))).toBe(false);
  });

  test('a filter of the reference client decodes to its values and matches all of its items', () => {
    const { block, items, values, filter } = vectors.gcs;
    expect(gcsCount(hex(filter))).toBe(items.length);
    expect(gcsValues(hex(filter))).toEqual(values);
    for (const item of items) {
      expect(gcsMatch(hex(filter), hex(block), hex(item))).toBe(true);
    }
    expect(gcsEncode(hex(block), items.map(hex)).toString('hex')).toBe(filter);
    let falsePositives = 0;
    for (let i = 0; i < 2000; i++) {
      falsePositives += gcsMatch(hex(filter), hex(block), sha256(Buffer.from(`absent ${i}`))) ? 1 : 0;
    }
    expect(falsePositives).toBeLessThan(3);
  });

  test('a filter that ends inside a value is refused, an empty one matches nothing', () => {
    const { filter, block, items } = vectors.gcs;
    expect(() => gcsValues(hex(filter).subarray(0, 100))).toThrow(ProtocolError);
    expect(gcsMatch(hex('00'), hex(block), hex(items[0]))).toBe(false);
  });
});

describe('script filter entry tree', () => {
  const leaves: Buffer[] = vectors.tree.leaves.map(hex);

  test('roots equal the reference client for every tree size, the empty root is zero', () => {
    for (const [size, root] of Object.entries<string>(vectors.tree.roots)) {
      expect(leavesRoot(leaves.slice(0, Number(size))).toString('hex')).toBe(root);
    }
    expect(leavesRoot([]).equals(ZERO_HASH)).toBe(true);
  });

  test('every run of every tree rebuilds the root, and one hash too many or too few fails', () => {
    for (let count = 1; count <= leaves.length; count++) {
      const tree = leaves.slice(0, count);
      const root = leavesRoot(tree);
      for (let lo = 0; lo < count; lo++) {
        for (let end = lo + 1; end <= count; end++) {
          const hashes = rangeHashes(tree, lo, end);
          expect(rangeRoot(count, lo, tree.slice(lo, end), hashes).equals(root)).toBe(true);
          expect(() => rangeRoot(count, lo, tree.slice(lo, end), [...hashes, ZERO_HASH])).toThrow(ScriptFilterError);
          if (hashes.length) {
            expect(() => rangeRoot(count, lo, tree.slice(lo, end), hashes.slice(1))).toThrow(ScriptFilterError);
          }
        }
      }
    }
  });

  const answer = (tree: Buffer[], prefix: Buffer, bits: number) => {
    let first = 0;
    while (first < tree.length && comparePrefix(tree[first], prefix, bits) < 0) {
      first++;
    }
    let end = first;
    while (end < tree.length && comparePrefix(tree[end], prefix, bits) === 0) {
      end++;
    }
    const before = first > 0 ? tree[first - 1] : undefined;
    const after = end < tree.length ? tree[end] : undefined;
    return {
      filterType: 1,
      blockHash: vectorBlock,
      leafCount: tree.length,
      firstIndex: first,
      leaves: tree.slice(first, end),
      before,
      after,
      hashes: tree.length ? rangeHashes(tree, before ? first - 1 : first, after ? end + 1 : end) : [],
    };
  };

  test('a range shows every leaf of a key and proves the key absent elsewhere', () => {
    const root = leavesRoot(leaves);
    for (const leaf of leaves) {
      const key = leaf.subarray(0, 32);
      for (const bits of [0, 7, 12, 256]) {
        const prefix = keyPrefix(key, bits);
        const run = checkRange(root, vectorBlock, answer(leaves, prefix, bits), prefix, bits);
        expect(run.map((l) => l.bytes)).toEqual(leaves.filter((l) => comparePrefix(l, prefix, bits) === 0));
        run.forEach((l) => expect(leaves[l.position].equals(l.bytes)).toBe(true));
      }
    }
    const absent = sha256(Buffer.from('absent'));
    expect(checkRange(root, vectorBlock, answer(leaves, absent, 256), absent, 256)).toEqual([]);
    expect(checkRange(ZERO_HASH, vectorBlock, answer([], absent, 256), absent, 256)).toEqual([]);
  });

  test('a range that hides a leaf, claims a wrong neighbour or belongs to another root is refused', () => {
    const root = leavesRoot(leaves);
    const key = leaves[11].subarray(0, 32);
    const honest = answer(leaves, key, 256);
    expect(honest.leaves.length).toBeGreaterThan(1);
    const hidden = { ...honest, leaves: honest.leaves.slice(1), firstIndex: honest.firstIndex + 1 };
    hidden.before = honest.leaves[0];
    expect(() => checkRange(root, vectorBlock, hidden, key, 256)).toThrow(ScriptFilterError);
    expect(() => checkRange(root, vectorBlock, { ...honest, before: undefined }, key, 256)).toThrow(ScriptFilterError);
    expect(() => checkRange(sha256(root), vectorBlock, honest, key, 256)).toThrow('another root');
    expect(() => checkRange(root, ZERO_HASH, honest, key, 256)).toThrow('another block');
    const swapped = { ...honest, leaves: [...honest.leaves].reverse() };
    expect(() => checkRange(root, vectorBlock, swapped, key, 256)).toThrow(ScriptFilterError);
  });

  test('prefixes keep only their bits', () => {
    const key = hex('5cafe0' + '11'.repeat(29));
    expect(keyPrefix(key, 12).toString('hex')).toBe('5ca0' + '00'.repeat(30));
    expect(comparePrefix(key, keyPrefix(key, 12), 12)).toBe(0);
    expect(comparePrefix(hex('5cb0' + '00'.repeat(30)), keyPrefix(key, 12), 12)).toBe(1);
  });

  test('a token prefix is split off the locking script, a broken one is all script', () => {
    const category = Buffer.alloc(32, 0x42);
    const locking = hex('76a914' + '22'.repeat(20) + '88ac');
    expect(splitTokenPrefix(withToken(category, 5, locking))).toEqual({ category, script: locking });
    const nft = Buffer.concat([hex('ef'), category, hex('6203abcdef'), locking]);
    expect(splitTokenPrefix(nft)).toEqual({ category, script: locking });
    const broken = Buffer.concat([hex('ef'), category, hex('80'), locking]);
    expect(splitTokenPrefix(broken).category).toBeUndefined();
    expect(splitTokenPrefix(locking).script.equals(locking)).toBe(true);
    expect(categoryKey(category).equals(sha256(Buffer.concat([hex('01'), category])))).toBe(true);
    expect(
      serializeLeaf(parseLeaf(wire('cfrange_all').subarray(42, 83))).equals(wire('cfrange_all').subarray(42, 83))
    ).toBe(true);
  });
});

describe('native filter scan', () => {
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-filter-scan-'));
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** A store of the given filters, each after a 32 byte root, as the filter store writes it. */
  const writeStore = (name: string, blocks: { hash: Buffer; filter: Buffer }[]) => {
    const records = blocks.map(({ hash, filter }) => {
      const record = Buffer.alloc(100);
      hash.copy(record, 0);
      record.writeUInt32LE(32 + filter.length, 96);
      return record;
    });
    const indexFile = path.join(dir, `${name}-index.dat`);
    const filtersFile = path.join(dir, `${name}-filters.dat`);
    fs.writeFileSync(indexFile, Buffer.concat(records));
    fs.writeFileSync(filtersFile, Buffer.concat(blocks.flatMap(({ filter }) => [Buffer.alloc(32), filter])));
    const offset = (height: number) => blocks.slice(0, height).reduce((sum, b) => sum + 32 + b.filter.length, 0);
    return (keys: Buffer[], from = 0, to = blocks.length) =>
      scanFilters({ indexFile, filtersFile, from, to, filterOffset: offset(from), keys });
  };
  /** What the TypeScript matcher says, filter by filter. */
  const oneByOne = (blocks: { hash: Buffer; filter: Buffer }[], keys: Buffer[], from = 0, to = blocks.length) =>
    keys.map((key) => {
      const heights: number[] = [];
      for (let h = from; h < to; h++) {
        if (gcsMatch(blocks[h].filter, blocks[h].hash, key)) {
          heights.push(h);
        }
      }
      return heights;
    });

  test('equals the TypeScript matcher on the reference vectors', async () => {
    const { block, items, filter } = vectors.gcs;
    const genesis = vectors.bip158Genesis;
    const blocks = [
      { hash: hex(block), filter: hex(filter) },
      { hash: fromDisplay(genesis.blockHash), filter: hex(genesis.filter) },
      { hash: Buffer.alloc(32, 9), filter: hex('00') },
      { hash: hex(block), filter: hex(filter) },
    ];
    const keys = [
      ...items.map(hex),
      hex(genesis.script),
      hex('51'),
      ...Array.from({ length: 50 }, (_, i) => sha256(Buffer.from(`absent ${i}`))),
    ];
    const scan = writeStore('vectors', blocks);
    const found = await scan(keys);
    expect(found).toEqual(oneByOne(blocks, keys));
    expect(found.slice(0, items.length).every((heights) => heights.join() === '0,3')).toBe(true);
    expect(found[items.length]).toEqual([1]);
    expect(await scan(keys, 1, 3)).toEqual(oneByOne(blocks, keys, 1, 3));
  });

  test('equals the TypeScript matcher on random filters, many keys in one pass', async () => {
    let seed = 99;
    const rand = (n: number) => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) % n;
    const keys = Array.from({ length: 40 }, (_, i) => sha256(Buffer.from(`key ${i}`)));
    const blocks = Array.from({ length: 1200 }, (_, h) => {
      const hash = sha256(Buffer.from(`block ${h}`));
      const items = Array.from({ length: rand(300) }, (_, i) => sha256(Buffer.from(`item ${h} ${i}`)));
      items.push(...keys.filter(() => rand(10) === 0));
      return { hash, filter: gcsEncode(hash, items) };
    });
    const scan = writeStore('random', blocks);
    const found = await scan(keys);
    expect(found).toEqual(oneByOne(blocks, keys));
    expect(found.every((heights) => heights.length > 60)).toBe(true);
    for (const [from, to] of [
      [0, 1],
      [17, 1199],
      [1100, 1200],
      [1200, 1200],
    ]) {
      expect(await scan(keys.slice(0, 7), from, to)).toEqual(oneByOne(blocks, keys.slice(0, 7), from, to));
    }
  }, 30_000);

  test('refuses heights past the files and a damaged filter', async () => {
    const hash = Buffer.alloc(32, 3);
    const scan = writeStore('damaged', [
      { hash, filter: gcsEncode(hash, [Buffer.from('a'), Buffer.from('b')]) },
      { hash, filter: hex('ff' + 'ff'.repeat(8)) },
    ]);
    await expect(scan([Buffer.from('a')], 0, 1)).resolves.toEqual([[0]]);
    await expect(scan([Buffer.from('a')], 0, 3)).rejects.toThrow('ended early');
    await expect(scan([Buffer.from('a')])).rejects.toThrow('shorter than its item count (stored filter at height 1)');
  });
});

describe('transaction leaves (kind 4)', () => {
  test('a transaction key is the SHA-256 of 0x02 and the txid in internal byte order', () => {
    const txid = hex('11'.repeat(31) + '22');
    expect(txKey(txid).equals(sha256(Buffer.concat([hex('02'), txid])))).toBe(true);
    // Tagged apart from a token category that is the same 32 bytes.
    expect(txKey(txid).equals(categoryKey(txid))).toBe(false);
  });

  test('leaves of kind 4 parse and kinds above 4 are refused', () => {
    const leaf = serializeLeaf({ key: txKey(Buffer.alloc(32, 5)), txIndex: 7, index: 0, kind: LeafKind.Transaction });
    expect(parseLeaf(leaf)).toMatchObject({ txIndex: 7, index: 0, kind: LeafKind.Transaction });
    leaf[40] = 5;
    expect(() => parseLeaf(leaf)).toThrow('of kind 0 to 4');
  });

  test("every transaction of a block has its leaf, and a range of a txid's full key proves it", () => {
    const chain = new FakeChain();
    const block = chain.mine([
      { spends: [`${toDisplay(chain.tip.txs[0].txid)}:0`], outputs: [{ script: p2pkh(3), value: 10 }] },
    ]);
    const kinds = block.leaves.filter((l) => l[40] === LeafKind.Transaction).map((l) => parseLeaf(l));
    expect(kinds.map((l) => l.txIndex).sort()).toEqual([0, 1]);
    const key = txKey(block.txs[1].txid);
    expect(gcsMatch(block.filter.subarray(32), block.hash, key)).toBe(true);
    const first = block.leaves.findIndex((l) => l.subarray(0, 32).equals(key));
    const range = {
      filterType: 1,
      blockHash: block.hash,
      leafCount: block.leaves.length,
      firstIndex: first,
      leaves: [block.leaves[first]],
      before: first > 0 ? block.leaves[first - 1] : undefined,
      after: first + 1 < block.leaves.length ? block.leaves[first + 1] : undefined,
      hashes: rangeHashes(
        block.leaves,
        first > 0 ? first - 1 : first,
        first + 2 <= block.leaves.length ? first + 2 : first + 1
      ),
    };
    const [proved] = checkRange(block.filter.subarray(0, 32), block.hash, range, key, 256);
    expect(proved).toMatchObject({ kind: LeafKind.Transaction, txIndex: 1, index: 0 });
    const without = new FakeChain(undefined, false);
    expect(without.tip.leaves.some((l) => l[40] === LeafKind.Transaction)).toBe(false);
  });
});

describe('transaction leaves (kind 4), vectors of the Go and Python implementations', () => {
  const tv = vectors.txLeaves;

  test('the genesis coinbase key, from the txid in internal byte order', () => {
    expect(txKey(hex(tv.genesisKey.txid)).toString('hex')).toBe(tv.genesisKey.key);
    expect(txKey(hex(tv.genesisKey.txid).reverse()).toString('hex')).not.toBe(tv.genesisKey.key);
  });

  test("the test block's leaves, root, filter and header, as the fake node builds them", () => {
    const { block } = tv;
    const header = hex(block.header);
    const parsed = decodeBlock(Buffer.concat([header, encodeVarint(block.txs.length), ...block.txs.map(hex)]));
    expect(toDisplay(parsed.header.hash)).toBe(block.hash);
    expect(parsed.txs.map((tx) => tx.txid.toString('hex'))).toEqual(block.txids);
    expect(parsed.txs.map((tx) => txKey(tx.txid).toString('hex'))).toEqual(block.keys);
    // The spent scripts in input order: transaction 1's two inputs, then transaction 2's.
    const spent = block.spent.map(hex);
    const txs: FakeTx[] = parsed.txs.map((tx, i) => ({
      raw: tx.raw,
      txid: tx.txid,
      coinbase: i === 0,
      inputs: i === 0 ? [] : tx.inputs.map((input) => ({ ...input, prev: { script: spent.shift()!, value: 0 } })),
      outputs: tx.outputs,
    }));
    const leaves = blockLeaves(txs);
    expect(leaves.map((l) => l.toString('hex'))).toEqual(block.leaves);
    const keys = leaves.map((l) => l.subarray(0, 32));
    const served = Buffer.concat([leavesRoot(leaves), gcsEncode(parsed.header.hash, keys)]);
    expect(gcsEncode(parsed.header.hash, keys).toString('hex')).toBe(block.filter);
    expect(served.toString('hex')).toBe(block.served);
    expect(sha256d(served).toString('hex')).toBe(block.filterHash);
    expect(sha256d(Buffer.concat([sha256d(served), ZERO_HASH])).toString('hex')).toBe(block.headerAfterZero);
  });

  test('the native scan finds each transaction key in its own block, as gcsMatch does', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bch-txid-scan-'));
    try {
      const blocks = [
        ...tv.bchdBlocks.map((b: any) => ({ hash: fromDisplay(b.hash), served: hex(b.served), keys: b.keys })),
        { hash: fromDisplay(tv.block.hash), served: hex(tv.block.served), keys: tv.block.keys },
      ];
      const records = blocks.map(({ hash, served }) => {
        const record = Buffer.alloc(100);
        hash.copy(record, 0);
        record.writeUInt32LE(served.length, 96);
        return record;
      });
      const indexFile = path.join(dir, 'index.dat');
      const filtersFile = path.join(dir, 'filters.dat');
      fs.writeFileSync(indexFile, Buffer.concat(records));
      fs.writeFileSync(filtersFile, Buffer.concat(blocks.map((b) => b.served)));
      const tx1 = hex(tv.block.txids[1]);
      const keys = [
        ...blocks.flatMap((b) => b.keys.map(hex)),
        tx1,
        sha256(Buffer.concat([hex('02'), Buffer.from(tx1).reverse()])),
      ];
      const found = await scanFilters({ indexFile, filtersFile, from: 0, to: blocks.length, filterOffset: 0, keys });
      const own = blocks.flatMap((b, height) => b.keys.map(() => [height]));
      expect(found).toEqual([...own, [], []]);
      expect(found).toEqual(
        keys.map((key) => blocks.flatMap((b, height) => (gcsMatch(b.served.subarray(32), b.hash, key) ? [height] : [])))
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a range of a whole txid key proves its kind 4 leaf, or that the block has no such transaction', () => {
    for (const r of tv.ranges) {
      const reply = {
        filterType: 1,
        blockHash: fromDisplay(r.blockHash),
        leafCount: r.leafCount,
        firstIndex: r.firstIndex,
        leaves: r.run.map(hex),
        before: r.before ? hex(r.before) : undefined,
        after: r.after ? hex(r.after) : undefined,
        hashes: r.hashes.map(hex),
      };
      const run = checkRange(hex(r.root), reply.blockHash, reply, hex(r.prefix), 256);
      expect(run.map((leaf) => [leaf.kind, leaf.key.toString('hex'), leaf.index])).toEqual(
        r.run.map(() => [LeafKind.Transaction, r.prefix, 0])
      );
      if (run.length) {
        // A node that hides the leaf cannot claim the transaction is absent.
        const hidden = { ...reply, leaves: [], leafCount: r.leafCount };
        expect(() => checkRange(hex(r.root), reply.blockHash, hidden, hex(r.prefix), 256)).toThrow(ScriptFilterError);
      }
    }
    expect(tv.ranges.map((r: any) => r.run.map((l: string) => hex(l).readUInt32LE(32)))).toEqual([
      [0],
      [1],
      [2],
      [],
      [2],
    ]);
  });
});
