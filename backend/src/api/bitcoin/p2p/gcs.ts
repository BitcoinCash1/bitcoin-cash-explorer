import { ByteReader, ProtocolError } from './wire';

/**
 * BIP158 Golomb-coded sets as committed filters serve them: N as a varint,
 * then the sorted values' Golomb-Rice coded differences, most significant bit
 * first. An item maps to [0, N*M) by SipHash-2-4 keyed with the first 16
 * bytes of the block hash.
 */

export const GCS_P = 19;
export const GCS_M = 784931;

const C0_LO = 0x70736575;
const C0_HI = 0x736f6d65;
const C1_LO = 0x6e646f6d;
const C1_HI = 0x646f7261;
const C2_LO = 0x6e657261;
const C2_HI = 0x6c796765;
const C3_LO = 0x79746573;
const C3_HI = 0x74656462;

/** SipHash-2-4 over 32-bit halves; returns the 64-bit result as [low, high]. */
export function siphash24(key: Buffer, data: Buffer): [number, number] {
  const k0l = key.readUInt32LE(0);
  const k0h = key.readUInt32LE(4);
  const k1l = key.readUInt32LE(8);
  const k1h = key.readUInt32LE(12);
  // v[0..7] = v0l v0h v1l v1h v2l v2h v3l v3h
  const v = new Uint32Array([
    (k0l ^ C0_LO) >>> 0,
    (k0h ^ C0_HI) >>> 0,
    (k1l ^ C1_LO) >>> 0,
    (k1h ^ C1_HI) >>> 0,
    (k0l ^ C2_LO) >>> 0,
    (k0h ^ C2_HI) >>> 0,
    (k1l ^ C3_LO) >>> 0,
    (k1h ^ C3_HI) >>> 0,
  ]);

  const add = (a: number, b: number) => {
    const lo = (v[a] + v[b]) >>> 0;
    v[a + 1] = (v[a + 1] + v[b + 1] + (lo < v[a] ? 1 : 0)) >>> 0;
    v[a] = lo;
  };
  const rotl = (a: number, n: number) => {
    let lo = v[a];
    let hi = v[a + 1];
    if (n >= 32) {
      [lo, hi] = [hi, lo];
      n -= 32;
    }
    if (n > 0) {
      const nlo = ((lo << n) | (hi >>> (32 - n))) >>> 0;
      const nhi = ((hi << n) | (lo >>> (32 - n))) >>> 0;
      lo = nlo;
      hi = nhi;
    }
    v[a] = lo;
    v[a + 1] = hi;
  };
  const xor = (a: number, b: number) => {
    v[a] ^= v[b];
    v[a + 1] ^= v[b + 1];
  };
  const round = () => {
    add(0, 2);
    rotl(2, 13);
    xor(2, 0);
    rotl(0, 32);
    add(4, 6);
    rotl(6, 16);
    xor(6, 4);
    add(0, 6);
    rotl(6, 21);
    xor(6, 0);
    add(4, 2);
    rotl(2, 17);
    xor(2, 4);
    rotl(4, 32);
  };
  const absorb = (ml: number, mh: number) => {
    v[6] ^= ml;
    v[7] ^= mh;
    round();
    round();
    v[0] ^= ml;
    v[1] ^= mh;
  };

  const whole = data.length - (data.length % 8);
  for (let o = 0; o < whole; o += 8) {
    absorb(data.readUInt32LE(o), data.readUInt32LE(o + 4));
  }
  const last = Buffer.alloc(8);
  data.copy(last, 0, whole);
  last[7] = data.length & 0xff;
  absorb(last.readUInt32LE(0), last.readUInt32LE(4));
  v[4] ^= 0xff;
  round();
  round();
  round();
  round();
  return [(v[0] ^ v[2] ^ v[4] ^ v[6]) >>> 0, (v[1] ^ v[3] ^ v[5] ^ v[7]) >>> 0];
}

/** floor(h * f / 2^64) for a 64-bit h given as [low, high] and f below 2^53, exactly. */
export function mulHigh64(h: [number, number], f: number): number {
  const a = [h[0] & 0xffff, h[0] >>> 16, h[1] & 0xffff, h[1] >>> 16];
  const b = [f % 0x10000, Math.floor(f / 0x10000) % 0x10000, Math.floor(f / 0x100000000) % 0x10000];
  b.push(Math.floor(f / 0x1000000000000));
  const p = new Array<number>(8).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      p[i + j] += a[i] * b[j];
    }
  }
  let carry = 0;
  for (let k = 0; k < 8; k++) {
    const t = p[k] + carry;
    p[k] = t % 0x10000;
    carry = Math.floor(t / 0x10000);
  }
  return p[4] + p[5] * 0x10000 + p[6] * 0x100000000 + p[7] * 0x1000000000000;
}

/** The value an item has in a filter of n items under the block's key. */
export function gcsHash(blockHash: Buffer, n: number, item: Buffer): number {
  return mulHigh64(siphash24(blockHash.subarray(0, 16), item), n * GCS_M);
}

/** Reads the Golomb-Rice coded values of a filter one by one. */
class GcsReader {
  private pos: number;
  private readonly end: number;
  last = 0;

  constructor(
    private readonly data: Buffer,
    start: number
  ) {
    this.pos = start * 8;
    this.end = data.length * 8;
  }

  next(): number {
    const data = this.data;
    let quotient = 0;
    for (;;) {
      if (this.pos >= this.end) {
        throw new ProtocolError('Filter ends inside a value');
      }
      const bit = (data[this.pos >>> 3] >>> (7 - (this.pos & 7))) & 1;
      this.pos++;
      if (!bit) {
        break;
      }
      quotient++;
    }
    if (this.pos + GCS_P > this.end) {
      throw new ProtocolError('Filter ends inside a remainder');
    }
    const i = this.pos >>> 3;
    const window =
      ((data[i] << 24) | ((data[i + 1] ?? 0) << 16) | ((data[i + 2] ?? 0) << 8) | (data[i + 3] ?? 0)) >>> 0;
    const remainder = ((window << (this.pos & 7)) >>> 0) >>> (32 - GCS_P);
    this.pos += GCS_P;
    this.last += quotient * (1 << GCS_P) + remainder;
    return this.last;
  }
}

function header(filter: Buffer): { n: number; start: number } {
  const r = new ByteReader(filter);
  const n = r.varint();
  // Every value takes at least P + 1 bits.
  if (n * (GCS_P + 1) > r.remaining * 8) {
    throw new ProtocolError('Filter is shorter than its item count');
  }
  return { n, start: r.offset };
}

/** The item count of an N-prefixed filter. */
export function gcsCount(filter: Buffer): number {
  return header(filter).n;
}

/** Every value of an N-prefixed filter, in order. */
export function gcsValues(filter: Buffer): number[] {
  const { n, start } = header(filter);
  const reader = new GcsReader(filter, start);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(reader.next());
  }
  return out;
}

/** Whether an N-prefixed filter of the block may hold the item (false positives at rate 1/M). */
export function gcsMatch(filter: Buffer, blockHash: Buffer, item: Buffer): boolean {
  const { n, start } = header(filter);
  if (n === 0) {
    return false;
  }
  const target = gcsHash(blockHash, n, item);
  const reader = new GcsReader(filter, start);
  for (let i = 0; i < n; i++) {
    const value = reader.next();
    if (value === target) {
      return true;
    }
    if (value > target) {
      return false;
    }
  }
  return false;
}
