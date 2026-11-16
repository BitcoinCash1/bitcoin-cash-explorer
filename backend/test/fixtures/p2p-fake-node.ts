import { AddressInfo, Server, Socket, createServer } from 'node:net';
import { gcsHash } from '../../src/api/bitcoin/p2p/gcs';
import { meetsTarget, parseBlockHeader } from '../../src/api/bitcoin/p2p/messages';
import {
  LeafKind,
  categoryKey,
  compareLeaves,
  comparePrefix,
  leafHash,
  leavesRoot,
  nextLevel,
  scriptKey,
  serializeLeaf,
  splitTokenPrefix,
  txKey,
} from '../../src/api/bitcoin/p2p/script-filter';
import {
  ByteReader,
  ByteWriter,
  Message,
  MessageDecoder,
  NETWORKS,
  ZERO_HASH,
  encodeMessage,
  encodeVersion,
  sha256d,
  toDisplay,
} from '../../src/api/bitcoin/p2p/wire';

/**
 * A node for tests: a chain built here, its script filters (type 1) built the
 * way BCHD and Knuth build them, and a P2P server that answers the messages a
 * filter light client sends. Also a stub of the node's RPC that, like a node
 * without a transaction index, finds a transaction only in the block it names.
 */

export const MAGIC = NETWORKS.regtest.magic;

/** An N-prefixed GCS of distinct keys (P = 19, M = 784931), as BIP158 serializes it. */
export function gcsEncode(blockHash: Buffer, keys: Buffer[]): Buffer {
  const distinct = [...new Map(keys.map((k) => [k.toString('hex'), k])).values()];
  const n = distinct.length;
  const values = distinct.map((k) => gcsHash(blockHash, n, k)).sort((a, b) => a - b);
  const bits: number[] = [];
  let last = 0;
  for (const value of values) {
    const delta = value - last;
    last = value;
    for (let q = Math.floor(delta / 2 ** 19); q > 0; q--) {
      bits.push(1);
    }
    bits.push(0);
    for (let i = 18; i >= 0; i--) {
      bits.push(Math.floor(delta / 2 ** i) % 2);
    }
  }
  const bytes = Buffer.alloc(Math.ceil(bits.length / 8));
  bits.forEach((bit, i) => {
    bytes[i >> 3] |= bit << (7 - (i & 7));
  });
  return new ByteWriter().varint(n).bytes(bytes).toBuffer();
}

/** The edge hashes of leaves[lo, end), as bchutil's ScriptRangeHashes lists them. */
export function rangeHashes(leaves: Buffer[], lo: number, end: number): Buffer[] {
  let level = leaves.map(leafHash);
  const hashes: Buffer[] = [];
  let a = lo;
  let b = end - 1;
  while (level.length > 1) {
    if (a % 2 === 1) {
      hashes.push(level[a - 1]);
    }
    if (b % 2 === 0 && b + 1 < level.length) {
      hashes.push(level[b + 1]);
    }
    level = nextLevel(level);
    a >>= 1;
    b >>= 1;
  }
  return hashes;
}

/** A block's transaction Merkle tree, the last node of an odd level paired with itself. */
export function merkle(txids: Buffer[]): { root: Buffer; branch: (index: number) => Buffer[] } {
  const levels: Buffer[][] = [txids];
  while (levels[levels.length - 1].length > 1) {
    const level = [...levels[levels.length - 1]];
    if (level.length % 2) {
      level.push(level[level.length - 1]);
    }
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256d(Buffer.concat([level[i], level[i + 1]])));
    }
    levels[levels.length - 1] = level;
    levels.push(next);
  }
  return {
    root: levels[levels.length - 1][0],
    branch: (index) => {
      const out: Buffer[] = [];
      for (let l = 0; l + 1 < levels.length; l++) {
        out.push(levels[l][index ^ 1]);
        index >>= 1;
      }
      return out;
    },
  };
}

export interface Output {
  /** The script field: an optional token prefix, then the locking script. */
  script: Buffer;
  value: number;
}

export interface FakeTx {
  raw: Buffer;
  txid: Buffer;
  coinbase: boolean;
  inputs: { prevTxid: Buffer; prevIndex: number; prev: Output }[];
  outputs: Output[];
}

export interface FakeBlock {
  height: number;
  hash: Buffer;
  header: Buffer;
  merkleRoot: Buffer;
  time: number;
  txs: FakeTx[];
  leaves: Buffer[];
  filter: Buffer;
  filterHash: Buffer;
  filterHeader: Buffer;
}

export interface TxSpec {
  spends: string[];
  outputs: Output[];
}

export function p2pkh(byte: number): Buffer {
  return Buffer.concat([Buffer.from('76a914', 'hex'), Buffer.alloc(20, byte), Buffer.from('88ac', 'hex')]);
}

/** A fungible token prefix: category, bitfield HAS_AMOUNT, amount. */
export function withToken(category: Buffer, amount: number, locking: Buffer): Buffer {
  return Buffer.concat([Buffer.from([0xef]), category, Buffer.from([0x10, amount]), locking]);
}

const outpoint = (txid: Buffer, vout: number) => `${toDisplay(txid)}:${vout}`;

export class FakeChain {
  blocks: FakeBlock[] = [];
  private utxos = new Map<string, Output>();
  private counter = 0;

  /**
   * With `txLeaves` the filters have a transaction leaf (kind 4) for each
   * transaction, as nodes build them since; without, as before.
   */
  constructor(
    private readonly miner: Buffer = p2pkh(0xee),
    readonly txLeaves = true
  ) {
    this.mine([]);
  }

  get tip(): FakeBlock {
    return this.blocks[this.blocks.length - 1];
  }

  heightOf(hash: Buffer): number | undefined {
    const at = this.blocks.findIndex((block) => block.hash.equals(hash));
    return at < 0 ? undefined : at;
  }

  findTx(txid: Buffer): { block: FakeBlock; index: number; tx: FakeTx } | undefined {
    for (const block of this.blocks) {
      const index = block.txs.findIndex((tx) => tx.txid.equals(txid));
      if (index >= 0) {
        return { block, index, tx: block.txs[index] };
      }
    }
    return undefined;
  }

  unspent(): Map<string, Output> {
    return new Map(this.utxos);
  }

  private buildTx(inputs: FakeTx['inputs'], outputs: Output[], coinbase: boolean): FakeTx {
    const w = new ByteWriter().i32(2).varint(inputs.length || 1);
    if (coinbase) {
      w.bytes(ZERO_HASH).u32(0xffffffff).varint(5).u8(4).u32(this.counter++).u32(0xffffffff);
    }
    for (const input of inputs) {
      w.bytes(input.prevTxid).u32(input.prevIndex).varint(5).u8(4).u32(this.counter++).u32(0xffffffff);
    }
    w.varint(outputs.length);
    for (const output of outputs) {
      w.u64(output.value).varint(output.script.length).bytes(output.script);
    }
    const raw = w.u32(0).toBuffer();
    return { raw, txid: sha256d(raw), coinbase, inputs, outputs };
  }

  /**
   * Mines a block of a coinbase and the given transactions, each spending
   * outputs of earlier blocks. `omit` lists keys a lying node leaves out of
   * the block's filter and tree.
   */
  mine(
    specs: TxSpec[],
    coinbase: Output[] = [{ script: this.miner, value: 5_000_000_000 }],
    omit: Buffer[] = []
  ): FakeBlock {
    const txs = [this.buildTx([], coinbase, true)];
    for (const spec of specs) {
      const inputs = spec.spends.map((point) => {
        const prev = this.utxos.get(point);
        if (!prev) {
          throw new Error(`No unspent output ${point}`);
        }
        const [txid, vout] = point.split(':');
        return { prevTxid: Buffer.from(txid, 'hex').reverse(), prevIndex: Number(vout), prev };
      });
      txs.push(this.buildTx(inputs, spec.outputs, false));
    }
    for (const tx of txs) {
      tx.inputs.forEach((input) => this.utxos.delete(outpoint(input.prevTxid, input.prevIndex)));
      tx.outputs.forEach((output, vout) => this.utxos.set(outpoint(tx.txid, vout), output));
    }
    const height = this.blocks.length;
    const prev = height ? this.blocks[height - 1] : undefined;
    const tree = merkle(txs.map((tx) => tx.txid));
    const time = 1_700_000_000 + height * 600;
    const header = new ByteWriter()
      .i32(0x20000000)
      .bytes(prev?.hash ?? ZERO_HASH)
      .bytes(tree.root)
      .u32(time)
      .u32(0x207fffff)
      .u32(0)
      .toBuffer();
    for (let nonce = 0; !meetsTarget(parseBlockHeader(header)); nonce++) {
      header.writeUInt32LE(nonce, 76);
    }
    const hash = sha256d(header);
    const leaves = blockLeaves(txs, this.txLeaves).filter(
      (leaf) => !omit.some((key) => leaf.subarray(0, 32).equals(key))
    );
    const filter = Buffer.concat([
      leavesRoot(leaves),
      gcsEncode(
        hash,
        leaves.map((leaf) => leaf.subarray(0, 32))
      ),
    ]);
    const filterHash = sha256d(filter);
    const filterHeader = sha256d(Buffer.concat([filterHash, prev?.filterHeader ?? ZERO_HASH]));
    const block = { height, hash, header, merkleRoot: tree.root, time, txs, leaves, filter, filterHash, filterHeader };
    this.blocks.push(block);
    return block;
  }

  /** Drops the blocks above a height, as a reorganization does, and returns their transactions' outputs. */
  rewind(height: number): void {
    this.blocks = this.blocks.slice(0, height + 1);
    this.utxos.clear();
    for (const block of this.blocks) {
      for (const tx of block.txs) {
        tx.inputs.forEach((input) => this.utxos.delete(outpoint(input.prevTxid, input.prevIndex)));
        tx.outputs.forEach((output, vout) => this.utxos.set(outpoint(tx.txid, vout), output));
      }
    }
  }
}

/** A block as a block message carries it: the header, then the transactions. */
export function serializeBlock(block: FakeBlock): Buffer {
  return Buffer.concat([
    block.header,
    new ByteWriter().varint(block.txs.length).toBuffer(),
    ...block.txs.map((t) => t.raw),
  ]);
}

/** The sorted leaves of a block: the scripts and token categories it creates and spends, and its transactions. */
export function blockLeaves(txs: FakeTx[], txLeaves = true): Buffer[] {
  const leaves: Buffer[] = [];
  const add = (field: Buffer, txIndex: number, index: number, spent: boolean) => {
    const { category, script } = splitTokenPrefix(field);
    if (script.length && script[0] !== 0x6a) {
      leaves.push(serializeLeaf({ key: scriptKey(script), txIndex, index, kind: spent ? LeafKind.Spent : 0 }));
    }
    if (category) {
      leaves.push(
        serializeLeaf({ key: categoryKey(category), txIndex, index, kind: spent ? LeafKind.SpentCategory : 2 })
      );
    }
  };
  txs.forEach((tx, txIndex) => {
    tx.inputs.forEach((input, j) => add(input.prev.script, txIndex, j, true));
    tx.outputs.forEach((output, j) => add(output.script, txIndex, j, false));
    if (txLeaves) {
      leaves.push(serializeLeaf({ key: txKey(tx.txid), txIndex, index: 0, kind: LeafKind.Transaction }));
    }
  });
  return leaves.sort(compareLeaves);
}

export class FakeNode {
  private server?: Server;
  readonly sockets = new Set<Socket>();
  readonly requests: Message[] = [];
  /** Commands the node leaves unanswered. */
  readonly silent = new Set<string>();
  /** Lets a test change an answer before it is sent. */
  tamper?: (command: string, payload: Buffer) => Buffer;
  port = 0;

  constructor(public chain: FakeChain) {}

  async listen(): Promise<number> {
    this.server = createServer((socket) => this.accept(socket));
    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as AddressInfo).port;
    return this.port;
  }

  async close(): Promise<void> {
    for (const socket of this.sockets) {
      socket.destroy();
    }
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
  }

  /** Announces the tip to every connection, as a node does for a new block. */
  announce(): void {
    const inv = new ByteWriter().varint(1).u32(2).bytes(this.chain.tip.hash).toBuffer();
    for (const socket of this.sockets) {
      socket.write(encodeMessage(MAGIC, 'inv', inv));
    }
  }

  count(command: string): number {
    return this.requests.filter((m) => m.command === command).length;
  }

  private accept(socket: Socket): void {
    this.sockets.add(socket);
    socket.on('close', () => this.sockets.delete(socket));
    socket.on('error', () => undefined);
    const decoder = new MessageDecoder(MAGIC);
    socket.on('data', (chunk) => {
      for (const message of decoder.push(chunk)) {
        this.requests.push(message);
        if (!this.silent.has(message.command)) {
          this.answer(socket, message);
        }
      }
    });
  }

  private send(socket: Socket, command: string, payload: Buffer): void {
    socket.write(encodeMessage(MAGIC, command, this.tamper ? this.tamper(command, payload) : payload));
  }

  private answer(socket: Socket, { command, payload }: Message): void {
    const chain = this.chain;
    const r = new ByteReader(payload);
    switch (command) {
      case 'version':
        this.send(socket, 'version', encodeVersion('/fake-node:1/'));
        this.send(socket, 'verack', Buffer.alloc(0));
        break;
      case 'ping':
        this.send(socket, 'pong', payload);
        break;
      case 'getheaders': {
        r.u32();
        const locator = r.hashes();
        const stop = r.hash();
        let headers: FakeBlock[];
        if (!locator.length) {
          const at = chain.heightOf(stop);
          headers = at === undefined ? [] : [chain.blocks[at]];
        } else {
          const known = locator.map((hash) => chain.heightOf(hash)).find((h) => h !== undefined) ?? 0;
          headers = chain.blocks.slice(known + 1, known + 1 + 2000);
          const end = headers.findIndex((block) => block.hash.equals(stop));
          if (end >= 0) {
            headers = headers.slice(0, end + 1);
          }
        }
        const w = new ByteWriter().varint(headers.length);
        headers.forEach((block) => w.bytes(block.header).varint(0));
        this.send(socket, 'headers', w.toBuffer());
        break;
      }
      case 'getcfheaders':
      case 'getcfilters': {
        const type = r.u8();
        const start = r.u32();
        const stop = chain.heightOf(r.hash());
        const max = command === 'getcfheaders' ? 2000 : 1000;
        if (type !== 1 || stop === undefined || start > stop || stop - start + 1 > max) {
          break;
        }
        const blocks = chain.blocks.slice(start, stop + 1);
        if (command === 'getcfheaders') {
          const prev = start > 0 ? chain.blocks[start - 1].filterHeader : ZERO_HASH;
          const w = new ByteWriter().u8(1).bytes(chain.blocks[stop].hash).bytes(prev);
          this.send(socket, 'cfheaders', w.hashes(blocks.map((b) => b.filterHash)).toBuffer());
        } else {
          for (const block of blocks) {
            const w = new ByteWriter().u8(1).bytes(block.hash).varint(block.filter.length).bytes(block.filter);
            this.send(socket, 'cfilter', w.toBuffer());
          }
        }
        break;
      }
      case 'getcfcheckpt': {
        const type = r.u8();
        const stop = r.hash();
        const at = chain.heightOf(stop);
        if (type !== 1 || at === undefined) {
          break;
        }
        const headers: Buffer[] = [];
        for (let h = 1000; h <= at; h += 1000) {
          headers.push(chain.blocks[h].filterHeader);
        }
        this.send(socket, 'cfcheckpt', new ByteWriter().u8(1).bytes(stop).hashes(headers).toBuffer());
        break;
      }
      case 'getdata': {
        const n = r.varint();
        const missing = new ByteWriter();
        let notFound = 0;
        for (let i = 0; i < n; i++) {
          const type = r.u32();
          const hash = r.hash();
          const block = chain.blocks[chain.heightOf(hash) ?? -1];
          if (type === 2 && block) {
            this.send(socket, 'block', serializeBlock(block));
          } else {
            missing.u32(type).bytes(hash);
            notFound++;
          }
        }
        if (notFound) {
          this.send(
            socket,
            'notfound',
            Buffer.concat([new ByteWriter().varint(notFound).toBuffer(), missing.toBuffer()])
          );
        }
        break;
      }
      case 'getcfrange': {
        r.u8();
        const block = chain.blocks[chain.heightOf(r.hash()) ?? -1];
        const bits = r.u16();
        const prefix = r.hash();
        if (!block) {
          break;
        }
        const leaves = block.leaves;
        let first = 0;
        while (first < leaves.length && comparePrefix(leaves[first], prefix, bits) < 0) {
          first++;
        }
        let end = first;
        while (end < leaves.length && comparePrefix(leaves[end], prefix, bits) === 0) {
          end++;
        }
        const w = new ByteWriter()
          .u8(1)
          .bytes(block.hash)
          .u32(leaves.length)
          .u32(first)
          .varint(end - first);
        leaves.slice(first, end).forEach((leaf) => w.bytes(leaf));
        if (first > 0) {
          w.bytes(leaves[first - 1]);
        }
        if (end < leaves.length) {
          w.bytes(leaves[end]);
        }
        const lo = first > 0 ? first - 1 : first;
        const hi = end < leaves.length ? end + 1 : end;
        w.hashes(leaves.length ? rangeHashes(leaves, lo, hi) : []);
        this.send(socket, 'cfrange', w.toBuffer());
        break;
      }
      case 'getcfproof': {
        r.u8();
        const block = chain.blocks[chain.heightOf(r.hash()) ?? -1];
        const index = r.u32();
        if (!block || index >= block.leaves.length) {
          break;
        }
        const leaf = block.leaves[index];
        const txIndex = leaf.readUInt32LE(32);
        const tx = block.txs[txIndex];
        const w = new ByteWriter().u8(1).bytes(block.hash).u32(block.leaves.length).u32(index).bytes(leaf);
        w.hashes(rangeHashes(block.leaves, index, index + 1));
        w.bytes(tx.raw);
        w.hashes(merkle(block.txs.map((t) => t.txid)).branch(txIndex));
        if (leaf[40] === 1 || leaf[40] === 3) {
          const input = tx.inputs[leaf.readUInt32LE(36)];
          const origin = chain.findTx(input.prevTxid)!;
          w.bytes(origin.block.hash).u32(origin.index).bytes(origin.tx.raw);
          w.hashes(merkle(origin.block.txs.map((t) => t.txid)).branch(origin.index));
        }
        this.send(socket, 'cfproof', w.toBuffer());
        break;
      }
      default:
        break;
    }
  }
}

const lockingPart = (field: Buffer) => splitTokenPrefix(field).script.toString('hex');
const scriptPubKey = (field: Buffer, address: (script: string) => string) => {
  const hex = lockingPart(field);
  return {
    hex,
    asm: 'OP_DUP OP_HASH160',
    type: 'pubkeyhash',
    address: address(hex),
    byteCodePattern: { pattern: hex, data: [] as string[] },
  };
};

/** The node's RPC as the explorer calls it; without a transaction index a transaction is found by its block. */
export function fakeRpc(chain: FakeChain, address: (script: string) => string = (s) => 'bchreg:' + s.slice(6, 16)) {
  const calls: { method: string; params: unknown[] }[] = [];
  const verbose = (tx: FakeTx, block: FakeBlock) => ({
    txid: toDisplay(tx.txid),
    hash: toDisplay(tx.txid),
    hex: tx.raw.toString('hex'),
    version: 2,
    size: tx.raw.length,
    locktime: 0,
    vin: tx.coinbase
      ? [{ coinbase: '04', sequence: 0xffffffff }]
      : tx.inputs.map((input) => ({
          txid: toDisplay(input.prevTxid),
          vout: input.prevIndex,
          scriptSig: { asm: '', hex: '0400000000' },
          sequence: 0xffffffff,
          value: input.prev.value / 1e8,
          scriptPubKey: scriptPubKey(input.prev.script, address),
        })),
    vout: tx.outputs.map((output, n) => {
      const spk = scriptPubKey(output.script, address);
      return { value: output.value / 1e8, n, scriptPubKey: { ...spk, addresses: [spk.address] } };
    }),
    blockhash: toDisplay(block.hash),
    confirmations: chain.tip.height - block.height + 1,
    time: block.time,
    blocktime: block.time,
  });
  const rpc = {
    calls,
    /** Set to answer getrawtransaction without a block hash, as a node with -txindex does. */
    txindex: false,
    validateAddress: async (addr: string) => {
      calls.push({ method: 'validateaddress', params: [addr] });
      const hex = addr.startsWith('bchreg:') ? addr.slice(7) : '';
      return /^[0-9a-f]+$/.test(hex) ? { isvalid: true, address: addr, scriptPubKey: hex } : { isvalid: false };
    },
    getRawTransaction: async (txid: string, verbosity: number, blockHash?: string) => {
      calls.push({ method: 'getrawtransaction', params: [txid, verbosity, blockHash] });
      const found = chain.findTx(Buffer.from(txid, 'hex').reverse());
      if (!found || (!rpc.txindex && (!blockHash || toDisplay(found.block.hash) !== blockHash))) {
        throw Object.assign(
          new Error(
            'No such mempool or blockchain transaction. Use -txindex to enable blockchain transaction queries.'
          ),
          { code: -5 }
        );
      }
      return verbosity ? verbose(found.tx, found.block) : found.tx.raw.toString('hex');
    },
    getBlock: async (hash: string) => {
      calls.push({ method: 'getblock', params: [hash] });
      const block = chain.blocks.find((b) => toDisplay(b.hash) === hash);
      if (!block) {
        throw new Error('Block not found');
      }
      return {
        hash,
        height: block.height,
        version: 0x20000000,
        time: block.time,
        bits: '207fffff',
        nonce: 0,
        difficulty: 1,
        merkleroot: toDisplay(block.merkleRoot),
        nTx: block.txs.length,
        size: 1000,
        previousblockhash: block.height ? toDisplay(chain.blocks[block.height - 1].hash) : undefined,
        mediantime: block.time,
        confirmations: chain.tip.height - block.height + 1,
        tx: block.txs.map((tx) => toDisplay(tx.txid)),
      };
    },
    getTxOut: async (txid: string, vout: number) => {
      calls.push({ method: 'gettxout', params: [txid, vout] });
      return chain.unspent().has(`${txid}:${vout}`) ? { value: 0 } : null;
    },
  };
  return rpc;
}
