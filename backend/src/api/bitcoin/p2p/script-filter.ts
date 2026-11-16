import { CFProof, CFRange, LEAF_SIZE, SCRIPT_FILTER_TYPE } from './messages';
import { ZERO_HASH, sha256, sha256d } from './wire';

/**
 * Script filters (filter type 1): the served filter is the root of a sorted
 * tree of leaves, then a GCS of the leaves' distinct keys. A leaf is a key
 * (the SHA-256 of a locking script, of 0x01 and a token category, or of 0x02
 * and a txid), the transaction index, the input or output index and the kind.
 * A range of leaves and its edge hashes rebuild the root, which proves which
 * leaves of the block have a key prefix and that no other leaf has it.
 */

export enum LeafKind {
  Output = 0,
  Spent = 1,
  OutputCategory = 2,
  SpentCategory = 3,
  /** One per transaction of the block, the coinbase included, with index 0. */
  Transaction = 4,
}

export interface ScriptLeaf {
  key: Buffer;
  txIndex: number;
  index: number;
  kind: LeafKind;
}

export class ScriptFilterError extends Error {}

export function parseLeaf(b: Buffer): ScriptLeaf {
  if (b.length !== LEAF_SIZE || b[40] > LeafKind.Transaction) {
    throw new ScriptFilterError('A script filter leaf is 41 bytes, of kind 0 to 4');
  }
  return { key: b.subarray(0, 32), txIndex: b.readUInt32LE(32), index: b.readUInt32LE(36), kind: b[40] };
}

export function serializeLeaf(leaf: ScriptLeaf): Buffer {
  const b = Buffer.alloc(LEAF_SIZE);
  leaf.key.copy(b, 0);
  b.writeUInt32LE(leaf.txIndex, 32);
  b.writeUInt32LE(leaf.index, 36);
  b[40] = leaf.kind;
  return b;
}

/** Orders serialized leaves by key, transaction index, input or output index, then kind. */
export function compareLeaves(a: Buffer, b: Buffer): number {
  const byKey = Buffer.compare(a.subarray(0, 32), b.subarray(0, 32));
  if (byKey !== 0) {
    return byKey;
  }
  for (const at of [32, 36]) {
    const x = a.readUInt32LE(at);
    const y = b.readUInt32LE(at);
    if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return a[40] - b[40];
}

/** The key of a locking script (without any token prefix): its SHA-256, the Electrum scripthash unreversed. */
export function scriptKey(script: Buffer): Buffer {
  return sha256(script);
}

/** The key of a token category, given in the byte order of a token prefix. */
export function categoryKey(category: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([0x01]), category]));
}

/** The key of a transaction (leaf kind 4), from its txid in internal byte order, as an outpoint has it. */
export function txKey(txid: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([0x02]), txid]));
}

export function leafHash(leaf: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([0x00]), leaf]));
}

export function nodeHash(left: Buffer, right: Buffer): Buffer {
  return sha256(Buffer.concat([Buffer.from([0x01]), left, right]));
}

/** Pairs a level into the one above; a last node without a partner moves up unchanged. */
export function nextLevel(level: Buffer[]): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i + 1 < level.length; i += 2) {
    out.push(nodeHash(level[i], level[i + 1]));
  }
  if (level.length % 2) {
    out.push(level[level.length - 1]);
  }
  return out;
}

/** The root over sorted serialized leaves; the root of no leaves is 32 zero bytes. */
export function leavesRoot(leaves: Buffer[]): Buffer {
  if (!leaves.length) {
    return ZERO_HASH;
  }
  let level = leaves.map(leafHash);
  while (level.length > 1) {
    level = nextLevel(level);
  }
  return level[0];
}

/**
 * The root a run of consecutive leaves starting at index lo rebuilds, in a
 * tree of count leaves, with the edge hashes listed level by level: the node
 * just left of the run, then the node just right of it, where the run does
 * not already reach them. Throws when the hashes are too few or too many.
 */
export function rangeRoot(count: number, lo: number, run: Buffer[], hashes: Buffer[]): Buffer {
  if (!run.length || lo + run.length > count) {
    throw new ScriptFilterError('The run does not fit the tree');
  }
  let nodes = run.map(leafHash);
  let next = 0;
  let a = lo;
  let b = lo + run.length - 1;
  let width = count;
  while (width > 1) {
    if (a % 2 === 1) {
      if (next >= hashes.length) {
        throw new ScriptFilterError('Too few edge hashes');
      }
      nodes = [hashes[next++], ...nodes];
      a--;
    }
    if (b % 2 === 0 && b + 1 < width) {
      if (next >= hashes.length) {
        throw new ScriptFilterError('Too few edge hashes');
      }
      nodes.push(hashes[next++]);
      b++;
    }
    nodes = nextLevel(nodes);
    a = Math.floor(a / 2);
    b = Math.floor(b / 2);
    width = Math.ceil(width / 2);
  }
  if (next !== hashes.length) {
    throw new ScriptFilterError('Edge hashes left over');
  }
  return nodes[0];
}

/** The prefix of a key: its first `bits` bits, the rest zero. */
export function keyPrefix(key: Buffer, bits: number): Buffer {
  const prefix = Buffer.alloc(32);
  const full = bits >>> 3;
  key.copy(prefix, 0, 0, full);
  const rem = bits & 7;
  if (rem) {
    prefix[full] = key[full] & (0xff << (8 - rem));
  }
  return prefix;
}

/** Compares the first `bits` bits of a key with a prefix. */
export function comparePrefix(key: Buffer, prefix: Buffer, bits: number): number {
  const full = bits >>> 3;
  const c = Buffer.compare(key.subarray(0, full), prefix.subarray(0, full));
  if (c !== 0) {
    return c;
  }
  const rem = bits & 7;
  if (rem) {
    const k = key[full] & (0xff << (8 - rem));
    if (k !== prefix[full]) {
      return k < prefix[full] ? -1 : 1;
    }
  }
  return 0;
}

/** The served bytes of a script filter: the root of its leaves, then the N-prefixed GCS. */
export function splitScriptFilter(filter: Buffer): { root: Buffer; gcs: Buffer } {
  if (filter.length < 33) {
    throw new ScriptFilterError('Script filter shorter than its root and item count');
  }
  return { root: filter.subarray(0, 32), gcs: filter.subarray(32) };
}

export interface ProvedLeaf extends ScriptLeaf {
  /** The leaf's index in the block's tree. */
  position: number;
  bytes: Buffer;
}

/**
 * Checks a cfrange reply against the root in front of the block's script
 * filter and returns the run: every leaf of the block whose key has the
 * prefix, each with its position in the tree. As bchutil's CheckScriptRange:
 * the neighbours are there exactly when the run does not reach the edge, the
 * run and neighbours rebuild the root, every run leaf has the prefix, the
 * neighbours do not, and the leaves are in order.
 */
export function checkRange(
  root: Buffer,
  blockHash: Buffer,
  reply: CFRange,
  prefix: Buffer,
  bits: number
): ProvedLeaf[] {
  if (reply.filterType !== SCRIPT_FILTER_TYPE || !reply.blockHash.equals(blockHash)) {
    throw new ScriptFilterError('The range is for another block or filter');
  }
  if (bits < 0 || bits > 256 || !keyPrefix(prefix, bits).equals(prefix)) {
    throw new ScriptFilterError('Invalid key prefix');
  }
  const { leafCount: count, firstIndex: first, leaves: run, before, after } = reply;
  const end = first + run.length;
  if (end > count || first > 0 !== !!before || end < count !== !!after) {
    throw new ScriptFilterError('The leaves and hashes do not fit the tree');
  }
  if (count === 0) {
    if (reply.hashes.length !== 0 || !root.equals(ZERO_HASH)) {
      throw new ScriptFilterError('The leaves and hashes rebuild another root');
    }
    return [];
  }
  const span = [...(before ? [before] : []), ...run, ...(after ? [after] : [])];
  if (!rangeRoot(count, before ? first - 1 : first, span, reply.hashes).equals(root)) {
    throw new ScriptFilterError('The leaves and hashes rebuild another root');
  }
  for (let i = 1; i < span.length; i++) {
    if (compareLeaves(span[i - 1], span[i]) >= 0) {
      throw new ScriptFilterError('The leaves are out of order');
    }
  }
  if (
    run.some((leaf) => comparePrefix(leaf, prefix, bits) !== 0) ||
    (before && comparePrefix(before, prefix, bits) >= 0) ||
    (after && comparePrefix(after, prefix, bits) <= 0)
  ) {
    throw new ScriptFilterError('The leaves do not bound the prefix');
  }
  return run.map((bytes, i) => ({ ...parseLeaf(bytes), position: first + i, bytes }));
}

/** Folds a transaction hash with its branch, index bit by index bit, to the block's Merkle root. */
export function merkleFold(txid: Buffer, index: number, branch: Buffer[]): Buffer {
  let node = txid;
  for (const sibling of branch) {
    node = index % 2 ? sha256d(Buffer.concat([sibling, node])) : sha256d(Buffer.concat([node, sibling]));
    index = Math.floor(index / 2);
  }
  return node;
}

/**
 * Checks a cfproof reply for a leaf the client already proved with a range:
 * the same leaf at the same position folds to the filter's root, and the
 * transaction folds to the block header's Merkle root at the leaf's
 * transaction index. For a spent output's leaf, the creating transaction
 * must be the one the spending input names; a transaction's leaf must be the
 * key of the transaction's own txid.
 */
export function checkProof(
  root: Buffer,
  merkleRoot: Buffer,
  blockHash: Buffer,
  leaf: ProvedLeaf,
  leafCount: number,
  proof: CFProof
): void {
  if (
    proof.filterType !== SCRIPT_FILTER_TYPE ||
    !proof.blockHash.equals(blockHash) ||
    proof.leafIndex !== leaf.position ||
    proof.leafCount !== leafCount ||
    !proof.leaf.equals(leaf.bytes)
  ) {
    throw new ScriptFilterError('The proof is for another leaf');
  }
  if (!rangeRoot(leafCount, leaf.position, [proof.leaf], proof.leafBranch).equals(root)) {
    throw new ScriptFilterError('The leaf does not fold to the filter root');
  }
  if (!merkleFold(proof.tx.txid, leaf.txIndex, proof.txBranch).equals(merkleRoot)) {
    throw new ScriptFilterError('The transaction does not fold to the block header');
  }
  if (leaf.kind === LeafKind.Transaction) {
    if (leaf.index !== 0 || !txKey(proof.tx.txid).equals(leaf.key)) {
      throw new ScriptFilterError('The leaf is not the key of the transaction');
    }
    return;
  }
  const spent = leaf.kind === LeafKind.Spent || leaf.kind === LeafKind.SpentCategory;
  let field: Buffer;
  if (!spent) {
    if (leaf.index >= proof.tx.outputs.length) {
      throw new ScriptFilterError('The leaf names an output the transaction does not have');
    }
    field = proof.tx.outputs[leaf.index].script;
  } else {
    const input = proof.tx.inputs[leaf.index];
    if (
      !input ||
      !proof.origin ||
      !proof.origin.tx.txid.equals(input.prevTxid) ||
      input.prevIndex >= proof.origin.tx.outputs.length
    ) {
      throw new ScriptFilterError('The creating transaction is not the one the input spends');
    }
    field = proof.origin.tx.outputs[input.prevIndex].script;
  }
  const { category, script } = splitTokenPrefix(field);
  const isCategory = leaf.kind === LeafKind.OutputCategory || leaf.kind === LeafKind.SpentCategory;
  const key = isCategory ? (category ? categoryKey(category) : undefined) : scriptKey(script);
  if (!key || !key.equals(leaf.key)) {
    throw new ScriptFilterError('The output the leaf names has another key');
  }
}

const TOKEN_PREFIX = 0xef;
const HAS_AMOUNT = 0x10;
const HAS_NFT = 0x20;
const HAS_COMMITMENT_LENGTH = 0x40;
const MAX_COMMITMENT_LENGTH = 128;

function readCompact(b: Buffer, o: number): [bigint, number] | undefined {
  if (o >= b.length) {
    return undefined;
  }
  const first = b[o];
  const width = first < 0xfd ? 0 : first === 0xfd ? 2 : first === 0xfe ? 4 : 8;
  if (o + 1 + width > b.length) {
    return undefined;
  }
  const value =
    width === 0
      ? BigInt(first)
      : width === 2
        ? BigInt(b.readUInt16LE(o + 1))
        : width === 4
          ? BigInt(b.readUInt32LE(o + 1))
          : b.readBigUInt64LE(o + 1);
  return [value, o + 1 + width];
}

/**
 * Splits an output's script field into its CashTokens category, if it has a
 * valid token prefix, and the locking script. A field whose prefix does not
 * parse is all locking script, as nodes read it.
 */
export function splitTokenPrefix(field: Buffer): { category?: Buffer; script: Buffer } {
  if (field.length < 34 || field[0] !== TOKEN_PREFIX) {
    return { script: field };
  }
  const bits = field[33];
  const capability = bits & 0x0f;
  const nft = (bits & HAS_NFT) !== 0;
  const amount = (bits & HAS_AMOUNT) !== 0;
  const commitment = (bits & HAS_COMMITMENT_LENGTH) !== 0;
  if (
    (bits & 0xf0) >= 0x80 ||
    (bits & 0xf0) === 0 ||
    capability > 2 ||
    (!nft && (!amount || capability || commitment))
  ) {
    return { script: field };
  }
  let o = 34;
  if (commitment) {
    const read = readCompact(field, o);
    if (!read || read[0] < 1n || read[0] > BigInt(MAX_COMMITMENT_LENGTH) || read[1] + Number(read[0]) > field.length) {
      return { script: field };
    }
    o = read[1] + Number(read[0]);
  }
  if (amount) {
    const read = readCompact(field, o);
    if (!read || read[0] < 1n || read[0] > (1n << 63n) - 1n) {
      return { script: field };
    }
    o = read[1];
  }
  return { category: field.subarray(1, 33), script: field.subarray(o) };
}
