import { ByteReader, ByteWriter, PROTOCOL_VERSION, ProtocolError, ZERO_HASH, sha256d } from './wire';

/**
 * The P2P messages a filter light client sends and reads: block headers
 * (getheaders/headers) and BIP157 committed filters with the script filter
 * (filter type 1) range and proof messages as BCHD and Knuth serve them.
 */

export const SCRIPT_FILTER_TYPE = 1;
export const LEAF_SIZE = 41;
export const MAX_HEADERS_PER_MSG = 2000;
export const MAX_CFHEADERS_PER_MSG = 2000;
export const MAX_CFILTERS_PER_MSG = 1000;
/** A Merkle branch never has more than 32 levels in a tree of at most 2^32 leaves. */
const MAX_BRANCH = 32;

export interface BlockHeader {
  hash: Buffer;
  prevHash: Buffer;
  merkleRoot: Buffer;
  time: number;
  bits: number;
}

export function parseBlockHeader(raw: Buffer): BlockHeader {
  if (raw.length !== 80) {
    throw new ProtocolError('A block header is 80 bytes');
  }
  return {
    hash: sha256d(raw),
    prevHash: raw.subarray(4, 36),
    merkleRoot: raw.subarray(36, 68),
    time: raw.readUInt32LE(68),
    bits: raw.readUInt32LE(72),
  };
}

/** True when the header's hash meets the target its own bits encode. */
export function meetsTarget(header: BlockHeader): boolean {
  const exponent = header.bits >>> 24;
  const mantissa = header.bits & 0x007fffff;
  if (header.bits & 0x00800000 || mantissa === 0) {
    return false;
  }
  const target =
    exponent <= 3 ? BigInt(mantissa >>> (8 * (3 - exponent))) : BigInt(mantissa) << BigInt(8 * (exponent - 3));
  const value = BigInt('0x' + Buffer.from(header.hash).reverse().toString('hex'));
  return target > 0n && value <= target;
}

export function encodeGetHeaders(locator: Buffer[], stop: Buffer = ZERO_HASH): Buffer {
  return new ByteWriter().u32(PROTOCOL_VERSION).hashes(locator).bytes(stop).toBuffer();
}

export function decodeHeaders(payload: Buffer): BlockHeader[] {
  const r = new ByteReader(payload);
  const n = r.count(81, MAX_HEADERS_PER_MSG);
  const out: BlockHeader[] = [];
  for (let i = 0; i < n; i++) {
    out.push(parseBlockHeader(r.bytes(80)));
    r.varint();
  }
  r.end();
  return out;
}

export interface BlockFilterRequest {
  filterType: number;
  startHeight: number;
  stopHash: Buffer;
}

export function encodeGetCFilters(filterType: number, startHeight: number, stopHash: Buffer): Buffer {
  return new ByteWriter().u8(filterType).u32(startHeight).bytes(stopHash).toBuffer();
}

export const encodeGetCFHeaders = encodeGetCFilters;

export function encodeGetCFCheckpt(filterType: number, stopHash: Buffer): Buffer {
  return new ByteWriter().u8(filterType).bytes(stopHash).toBuffer();
}

export interface CFilter {
  filterType: number;
  blockHash: Buffer;
  filter: Buffer;
}

export function decodeCFilter(payload: Buffer): CFilter {
  const r = new ByteReader(payload);
  const filterType = r.u8();
  const blockHash = r.hash();
  const filter = r.bytes(r.count(1));
  r.end();
  return { filterType, blockHash, filter };
}

export interface CFHeaders {
  filterType: number;
  stopHash: Buffer;
  prevHeader: Buffer;
  filterHashes: Buffer[];
}

export function decodeCFHeaders(payload: Buffer): CFHeaders {
  const r = new ByteReader(payload);
  const filterType = r.u8();
  const stopHash = r.hash();
  const prevHeader = r.hash();
  const filterHashes = r.hashes(MAX_CFHEADERS_PER_MSG);
  r.end();
  return { filterType, stopHash, prevHeader, filterHashes };
}

export interface CFCheckpt {
  filterType: number;
  stopHash: Buffer;
  headers: Buffer[];
}

export function decodeCFCheckpt(payload: Buffer): CFCheckpt {
  const r = new ByteReader(payload);
  const filterType = r.u8();
  const stopHash = r.hash();
  const headers = r.hashes();
  r.end();
  return { filterType, stopHash, headers };
}

export function encodeGetCFRange(filterType: number, blockHash: Buffer, prefixBits: number, prefix: Buffer): Buffer {
  if (!Number.isInteger(prefixBits) || prefixBits < 0 || prefixBits > 256 || prefix.length !== 32) {
    throw new ProtocolError('A key prefix is at most 256 bits of a 32 byte key');
  }
  return new ByteWriter().u8(filterType).bytes(blockHash).u16(prefixBits).bytes(prefix).toBuffer();
}

export interface CFRange {
  filterType: number;
  blockHash: Buffer;
  leafCount: number;
  firstIndex: number;
  leaves: Buffer[];
  before?: Buffer;
  after?: Buffer;
  hashes: Buffer[];
}

export function decodeCFRange(payload: Buffer): CFRange {
  const r = new ByteReader(payload);
  const filterType = r.u8();
  const blockHash = r.hash();
  const leafCount = r.u32();
  const firstIndex = r.u32();
  const n = r.count(LEAF_SIZE);
  const leaves: Buffer[] = [];
  for (let i = 0; i < n; i++) {
    leaves.push(r.bytes(LEAF_SIZE));
  }
  // The neighbours are there exactly when the run does not reach the tree's edge.
  const before = firstIndex > 0 ? r.bytes(LEAF_SIZE) : undefined;
  const after = firstIndex + n < leafCount ? r.bytes(LEAF_SIZE) : undefined;
  const hashes = r.hashes(2 * MAX_BRANCH);
  r.end();
  return { filterType, blockHash, leafCount, firstIndex, leaves, before, after, hashes };
}

export function encodeGetCFProof(filterType: number, blockHash: Buffer, leafIndex: number): Buffer {
  return new ByteWriter().u8(filterType).bytes(blockHash).u32(leafIndex).toBuffer();
}

export interface TxInput {
  prevTxid: Buffer;
  prevIndex: number;
}

export interface TxOutput {
  value: number;
  /** The output's script field as serialized: a token prefix, if any, then the locking script. */
  script: Buffer;
}

export interface ParsedTx {
  raw: Buffer;
  txid: Buffer;
  inputs: TxInput[];
  outputs: TxOutput[];
}

/** Reads one serialized Bitcoin Cash transaction. */
export function readTx(r: ByteReader): ParsedTx {
  const start = r.offset;
  r.i32();
  const inputs: TxInput[] = [];
  const nIn = r.count(41);
  for (let i = 0; i < nIn; i++) {
    const prevTxid = r.hash();
    const prevIndex = r.u32();
    r.bytes(r.count(1));
    r.u32();
    inputs.push({ prevTxid, prevIndex });
  }
  const outputs: TxOutput[] = [];
  const nOut = r.count(9);
  for (let i = 0; i < nOut; i++) {
    const value = r.u64();
    const script = r.bytes(r.count(1));
    outputs.push({ value, script });
  }
  r.u32();
  const raw = r.buf.subarray(start, r.offset);
  return { raw, txid: sha256d(raw), inputs, outputs };
}

export interface CFProofOrigin {
  blockHash: Buffer;
  txIndex: number;
  tx: ParsedTx;
  branch: Buffer[];
}

export interface CFProof {
  filterType: number;
  blockHash: Buffer;
  leafCount: number;
  leafIndex: number;
  leaf: Buffer;
  leafBranch: Buffer[];
  tx: ParsedTx;
  txBranch: Buffer[];
  /** For a spent output's leaf (kind 1 or 3): the transaction that created the output. */
  origin?: CFProofOrigin;
}

export function decodeCFProof(payload: Buffer): CFProof {
  const r = new ByteReader(payload);
  const filterType = r.u8();
  const blockHash = r.hash();
  const leafCount = r.u32();
  const leafIndex = r.u32();
  const leaf = r.bytes(LEAF_SIZE);
  const leafBranch = r.hashes(MAX_BRANCH);
  const tx = readTx(r);
  const txBranch = r.hashes(MAX_BRANCH);
  let origin: CFProofOrigin | undefined;
  if (leaf[40] === 1 || leaf[40] === 3) {
    const originBlock = r.hash();
    const originIndex = r.u32();
    const originTx = readTx(r);
    origin = { blockHash: originBlock, txIndex: originIndex, tx: originTx, branch: r.hashes(MAX_BRANCH) };
  }
  r.end();
  return { filterType, blockHash, leafCount, leafIndex, leaf, leafBranch, tx, txBranch, origin };
}
