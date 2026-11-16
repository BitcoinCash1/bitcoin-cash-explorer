import { createHash, randomBytes } from 'node:crypto';

/**
 * Bitcoin Cash P2P wire primitives: hashing, byte readers and writers, the
 * 24-byte message header with its checksum, and the version handshake.
 */

export const ZERO_HASH = Buffer.alloc(32);
export const PROTOCOL_VERSION = 70016;
export const HEADER_SIZE = 24;
/** The largest payload accepted from a peer: a block, which ABLA lets grow past 32 MB over the years. */
export const MAX_PAYLOAD = 256 * 1024 * 1024;

export interface NetworkParams {
  magic: Buffer;
  port: number;
}

/** Message start bytes and default P2P ports, as BCHN, BCHD and Knuth use them. */
export const NETWORKS: Record<string, NetworkParams> = {
  mainnet: { magic: Buffer.from('e3e1f3e8', 'hex'), port: 8333 },
  testnet3: { magic: Buffer.from('f4e5f3f4', 'hex'), port: 18333 },
  testnet4: { magic: Buffer.from('e2b7daaf', 'hex'), port: 28333 },
  chipnet: { magic: Buffer.from('e2b7daaf', 'hex'), port: 48333 },
  scalenet: { magic: Buffer.from('c3afe1a2', 'hex'), port: 38333 },
  regtest: { magic: Buffer.from('dab5bffa', 'hex'), port: 18444 },
  simnet: { magic: Buffer.from('161c1412', 'hex'), port: 18555 },
};

export function networkParams(name: string): NetworkParams {
  const params = NETWORKS[name === 'testnet' ? 'testnet3' : name];
  if (!params) {
    throw new Error(`Unknown P2P network '${name}'`);
  }
  return params;
}

export class ProtocolError extends Error {}

export function sha256(data: Buffer): Buffer {
  return createHash('sha256').update(data).digest();
}

export function sha256d(data: Buffer): Buffer {
  return sha256(sha256(data));
}

/** A hash as the RPC and the explorer show it: the wire bytes reversed. */
export function toDisplay(hash: Buffer): string {
  return Buffer.from(hash).reverse().toString('hex');
}

export function fromDisplay(hex: string): Buffer {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('Invalid hash');
  }
  return Buffer.from(hex, 'hex').reverse();
}

export function encodeVarint(n: number): Buffer {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new ProtocolError('Invalid varint');
  }
  if (n < 0xfd) {
    return Buffer.from([n]);
  }
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  if (n <= 0xffffffff) {
    const b = Buffer.alloc(5);
    b[0] = 0xfe;
    b.writeUInt32LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(9);
  b[0] = 0xff;
  b.writeBigUInt64LE(BigInt(n), 1);
  return b;
}

/** Reads a payload front to back; every read past the end throws a ProtocolError. */
export class ByteReader {
  constructor(
    readonly buf: Buffer,
    public offset = 0
  ) {}

  get remaining(): number {
    return this.buf.length - this.offset;
  }

  private need(n: number): void {
    if (n < 0 || this.offset + n > this.buf.length) {
      throw new ProtocolError('Message ends early');
    }
  }

  bytes(n: number): Buffer {
    this.need(n);
    const out = this.buf.subarray(this.offset, this.offset + n);
    this.offset += n;
    return out;
  }

  hash(): Buffer {
    return this.bytes(32);
  }

  u8(): number {
    this.need(1);
    return this.buf[this.offset++];
  }

  u16(): number {
    this.need(2);
    const v = this.buf.readUInt16LE(this.offset);
    this.offset += 2;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.buf.readUInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.buf.readInt32LE(this.offset);
    this.offset += 4;
    return v;
  }

  u64(): number {
    this.need(8);
    const v = this.buf.readBigUInt64LE(this.offset);
    this.offset += 8;
    if (v > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new ProtocolError('Integer too large');
    }
    return Number(v);
  }

  varint(): number {
    const first = this.u8();
    if (first < 0xfd) {
      return first;
    }
    if (first === 0xfd) {
      return this.u16();
    }
    if (first === 0xfe) {
      return this.u32();
    }
    return this.u64();
  }

  /** A count of elements of `size` bytes each, refused when they cannot fit what is left. */
  count(size: number, max = Number.MAX_SAFE_INTEGER): number {
    const n = this.varint();
    if (n > max || n * size > this.remaining) {
      throw new ProtocolError('Count exceeds the message');
    }
    return n;
  }

  hashes(max = Number.MAX_SAFE_INTEGER): Buffer[] {
    const n = this.count(32, max);
    const out: Buffer[] = [];
    for (let i = 0; i < n; i++) {
      out.push(this.hash());
    }
    return out;
  }

  end(): void {
    if (this.remaining !== 0) {
      throw new ProtocolError('Trailing bytes in message');
    }
  }
}

export class ByteWriter {
  private readonly parts: Buffer[] = [];

  bytes(b: Buffer): this {
    this.parts.push(b);
    return this;
  }

  u8(n: number): this {
    this.parts.push(Buffer.from([n & 0xff]));
    return this;
  }

  u16(n: number): this {
    const b = Buffer.alloc(2);
    b.writeUInt16LE(n);
    this.parts.push(b);
    return this;
  }

  u32(n: number): this {
    const b = Buffer.alloc(4);
    b.writeUInt32LE(n >>> 0);
    this.parts.push(b);
    return this;
  }

  i32(n: number): this {
    const b = Buffer.alloc(4);
    b.writeInt32LE(n);
    this.parts.push(b);
    return this;
  }

  u64(n: number | bigint): this {
    const b = Buffer.alloc(8);
    b.writeBigUInt64LE(BigInt(n));
    this.parts.push(b);
    return this;
  }

  i64(n: number | bigint): this {
    const b = Buffer.alloc(8);
    b.writeBigInt64LE(BigInt(n));
    this.parts.push(b);
    return this;
  }

  varint(n: number): this {
    this.parts.push(encodeVarint(n));
    return this;
  }

  hashes(list: Buffer[]): this {
    this.varint(list.length);
    for (const h of list) {
      this.bytes(h);
    }
    return this;
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.parts);
  }
}

export interface Message {
  command: string;
  payload: Buffer;
}

export function encodeMessage(magic: Buffer, command: string, payload: Buffer): Buffer {
  if (command.length > 12 || !/^[a-z0-9]*$/.test(command)) {
    throw new ProtocolError('Invalid command');
  }
  const header = Buffer.alloc(HEADER_SIZE);
  magic.copy(header, 0);
  header.write(command, 4, 'ascii');
  header.writeUInt32LE(payload.length, 16);
  sha256d(payload).copy(header, 20, 0, 4);
  return Buffer.concat([header, payload]);
}

/** Splits a byte stream into messages, checking the magic, the size limit and each checksum. */
export class MessageDecoder {
  private chunks: Buffer[] = [];
  private length = 0;

  constructor(
    private readonly magic: Buffer,
    private readonly maxPayload = MAX_PAYLOAD
  ) {}

  /** Bytes of a message not yet complete. */
  get pending(): number {
    return this.length;
  }

  push(chunk: Buffer): Message[] {
    this.chunks.push(chunk);
    this.length += chunk.length;
    const out: Message[] = [];
    while (this.length >= HEADER_SIZE) {
      const head = this.peek(HEADER_SIZE);
      if (!head.subarray(0, 4).equals(this.magic)) {
        throw new ProtocolError('Wrong network magic');
      }
      const size = head.readUInt32LE(16);
      if (size > this.maxPayload) {
        throw new ProtocolError(`Message of ${size} bytes is too large`);
      }
      if (this.length < HEADER_SIZE + size) {
        break;
      }
      const all = this.take(HEADER_SIZE + size);
      const payload = all.subarray(HEADER_SIZE);
      if (!sha256d(payload).subarray(0, 4).equals(all.subarray(20, 24))) {
        throw new ProtocolError('Bad message checksum');
      }
      const end = all.indexOf(0, 4);
      const command = all.toString('ascii', 4, end >= 4 && end < 16 ? end : 16);
      out.push({ command, payload });
    }
    return out;
  }

  private peek(n: number): Buffer {
    if (this.chunks[0].length < n) {
      this.chunks = [Buffer.concat(this.chunks)];
    }
    return this.chunks[0].subarray(0, n);
  }

  private take(n: number): Buffer {
    const all = this.chunks.length === 1 ? this.chunks[0] : Buffer.concat(this.chunks);
    const out = all.subarray(0, n);
    const rest = all.subarray(n);
    this.chunks = rest.length ? [rest] : [];
    this.length = rest.length;
    return out;
  }
}

function networkAddress(services: bigint): Buffer {
  // services, IPv6-mapped 0.0.0.0 and port 0: a light client has no address to give.
  const b = Buffer.alloc(26);
  b.writeBigUInt64LE(services, 0);
  b[18] = 0xff;
  b[19] = 0xff;
  return b;
}

export interface VersionInfo {
  version: number;
  services: bigint;
  userAgent: string;
  startHeight: number;
}

/** The version message of a light client: no services, no transaction relay. */
export function encodeVersion(userAgent: string, nonce: Buffer = randomBytes(8)): Buffer {
  const agent = Buffer.from(userAgent, 'ascii');
  return new ByteWriter()
    .i32(PROTOCOL_VERSION)
    .u64(0)
    .i64(Math.floor(Date.now() / 1000))
    .bytes(networkAddress(0n))
    .bytes(networkAddress(0n))
    .bytes(nonce)
    .varint(agent.length)
    .bytes(agent)
    .i32(0)
    .u8(0)
    .toBuffer();
}

export function decodeVersion(payload: Buffer): VersionInfo {
  const r = new ByteReader(payload);
  const version = r.i32();
  const services = r.buf.readBigUInt64LE(r.offset);
  r.bytes(8);
  r.bytes(8 + 26 + 26 + 8);
  const agentLength = r.count(1, 256);
  const userAgent = r.bytes(agentLength).toString('ascii');
  const startHeight = r.remaining >= 4 ? r.i32() : 0;
  return { version, services, userAgent, startHeight };
}

/** Service bit of committed filters on Bitcoin Cash nodes (BCHD and Knuth use bit 8). */
export const NODE_CF = 1n << 8n;
