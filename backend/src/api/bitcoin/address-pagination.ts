import { createHash } from 'node:crypto';
import { IElectrumApi } from './electrum-api.interface';
import { HistoryBusyError } from './history-coordinator';
export interface AddressSummary {
  address: string;
  confirmedBalance: number;
  pendingBalance: number;
  electrum: true;
}
export interface AddressPageMetadata {
  nextCursor: string | null;
  complete: boolean;
  snapshotHeight: number;
  snapshotHash: string;
}
export interface AddressCountPage extends AddressPageMetadata {
  confirmedCount: number;
  scannedThroughHeight: number;
  progress: number;
}
type Row = IElectrumApi.ScriptHashHistory;
export class AddressCursorError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = 'INVALID_ADDRESS_CURSOR'
  ) {
    super(message);
  }
}
interface Cursor {
  version: 1;
  key: string;
  mode: 'transactions' | 'count';
  expires: number;
  snapshotHeight: number;
  snapshotHash: string;
  birth: number;
  next: number;
  width: number;
  offset: number;
  confirmedCount: number;
  pendingOffset: number;
  pendingDigest?: string;
}
export interface PageSource {
  snapshot(): Promise<{ height: number; hash: string }>;
  hash(height: number): Promise<string>;
  firstUse(key: string, snapshotHash?: string): Promise<number | null>;
  history(
    key: string,
    from: number,
    to: number,
    count: boolean,
    signal?: AbortSignal,
    snapshotHash?: string
  ): Promise<Row[]>;
  pending(key: string): Promise<Row[]>;
}
const MAX_ROWS = 2000;
const MAX_SINGLE_BLOCK_ROWS = 20000;
/** Validated, bounded continuation state; no retained address histories or background jobs. */
export class AddressPagination {
  constructor(
    private readonly source: PageSource,
    private readonly network: string
  ) {}
  private encode(cursor: Cursor): string {
    return Buffer.from(JSON.stringify(cursor)).toString('base64url');
  }
  private decode(token: string, key: string, mode: Cursor['mode']): Cursor {
    try {
      if (token.length > 2048) throw new Error();
      if (!/^[a-zA-Z0-9_-]+$/.test(token)) throw new Error();
      const c: Cursor = JSON.parse(Buffer.from(token, 'base64url').toString());
      if (
        c.version !== 1 ||
        c.key !== this.network + ':' + key ||
        c.mode !== mode ||
        !Number.isSafeInteger(c.expires) ||
        c.expires < Date.now() ||
        c.expires > Date.now() + 15 * 60 * 1000 ||
        !/^[a-f0-9]{64}$/i.test(c.snapshotHash) ||
        ![c.snapshotHeight, c.birth, c.next, c.width, c.offset, c.confirmedCount, c.pendingOffset].every(
          Number.isSafeInteger
        ) ||
        c.snapshotHeight < 0 ||
        c.birth < 0 ||
        c.birth > c.snapshotHeight + 1 ||
        c.width < 1 ||
        c.width > 1048576 ||
        c.next < c.birth ||
        c.next > c.snapshotHeight + 1 ||
        (mode === 'count' && (c.pendingOffset !== -1 || c.offset !== 0)) ||
        (mode === 'transactions' && c.pendingOffset > 0 && !c.pendingDigest) ||
        c.offset < 0 ||
        c.offset > (c.width === 1 ? MAX_SINGLE_BLOCK_ROWS : MAX_ROWS) ||
        c.confirmedCount < 0 ||
        c.pendingOffset < -1 ||
        c.pendingOffset > MAX_ROWS ||
        (c.pendingDigest !== undefined && !/^[a-f0-9]{64}$/.test(c.pendingDigest))
      )
        throw new Error();
      return c;
    } catch {
      throw new AddressCursorError('Invalid or expired address cursor');
    }
  }
  async page(key: string, mode: Cursor['mode'], token?: string, signal?: AbortSignal) {
    let c: Cursor;
    if (token) {
      c = this.decode(token, key, mode);
      if ((await this.source.hash(c.snapshotHeight)) !== c.snapshotHash)
        throw new AddressCursorError('Address snapshot changed; restart pagination', 409, 'ADDRESS_SNAPSHOT_CHANGED');
    } else {
      const snapshot = await this.source.snapshot();
      const birth = await this.source.firstUse(key, snapshot.hash);
      c = {
        version: 1,
        key: this.network + ':' + key,
        mode,
        expires: Date.now() + 15 * 60 * 1000,
        snapshotHeight: snapshot.height,
        snapshotHash: snapshot.hash,
        birth: birth === null ? snapshot.height + 1 : Math.max(0, birth),
        next: mode === 'count' ? (birth ?? snapshot.height + 1) : snapshot.height + 1,
        width: 144,
        offset: 0,
        confirmedCount: 0,
        pendingOffset: mode === 'count' ? -1 : 0,
      };
    }
    const rows: Row[] = [];
    if (mode === 'transactions' && c.pendingOffset >= 0) {
      const pending = this.validate(await this.source.pending(key))
        .filter((row) => row.height <= 0)
        .sort((a, b) => a.tx_hash.localeCompare(b.tx_hash));
      if (pending.length > MAX_ROWS) throw new HistoryBusyError('Pending history exceeds safe page limit');
      const digest = createHash('sha256').update(JSON.stringify(pending)).digest('hex');
      if (c.pendingDigest && c.pendingDigest !== digest)
        throw new AddressCursorError('Pending snapshot changed; restart pagination', 409, 'ADDRESS_SNAPSHOT_CHANGED');
      c.pendingDigest = digest;
      rows.push(...pending.slice(c.pendingOffset, c.pendingOffset + 10));
      c.pendingOffset += rows.length;
      if (c.pendingOffset >= pending.length) c.pendingOffset = -1;
    }
    const started = Date.now();
    let calls = 0;
    while (
      rows.length < 10 &&
      calls < 8 &&
      Date.now() - started < 2000 &&
      !signal?.aborted &&
      (mode === 'count' ? c.next <= c.snapshotHeight : c.next > c.birth)
    ) {
      const from = mode === 'count' ? c.next : Math.max(c.birth, c.next - c.width);
      const to = mode === 'count' ? Math.min(c.snapshotHeight + 1, from + c.width) : c.next;
      calls++;
      const history = this.validate(
        await this.source.history(key, from, to, mode === 'count', signal, c.snapshotHash)
      ).filter((r) => r.height >= from && r.height < to && r.height > 0);
      if (history.length > (to - from === 1 ? MAX_SINGLE_BLOCK_ROWS : MAX_ROWS)) {
        if (to - from <= 1) throw new HistoryBusyError('Single block history exceeds safe page limit');
        c.width = Math.max(1, Math.floor((to - from) / 2));
        continue;
      }
      history.sort((a, b) => b.height - a.height || a.tx_hash.localeCompare(b.tx_hash));
      if (mode === 'count') {
        c.confirmedCount += history.length;
        c.next = to;
      } else {
        const selected = history.slice(c.offset, c.offset + 10 - rows.length);
        rows.push(...selected);
        c.confirmedCount += selected.length;
        c.offset += selected.length;
        if (c.offset >= history.length) {
          c.next = from;
          c.offset = 0;
        } else {
          c.width = to - from;
          break;
        }
      }
      c.width = Math.min(1048576, c.width * 2);
    }
    if (signal?.aborted) throw new HistoryBusyError('Request cancelled');
    // Recheck after work so a concurrent reorg cannot produce a successful mixed snapshot page.
    if ((await this.source.hash(c.snapshotHeight)) !== c.snapshotHash)
      throw new AddressCursorError('Address snapshot changed; restart pagination', 409, 'ADDRESS_SNAPSHOT_CHANGED');
    const complete = c.pendingOffset < 0 && (mode === 'count' ? c.next > c.snapshotHeight : c.next <= c.birth);
    if (complete && c.birth > 0 && c.birth <= c.snapshotHeight && c.confirmedCount === 0)
      throw new HistoryBusyError('History contradicts confirmed first use');
    const base = {
      nextCursor: complete ? null : this.encode(c),
      complete,
      snapshotHeight: c.snapshotHeight,
      snapshotHash: c.snapshotHash,
    };
    return mode === 'count'
      ? {
          ...base,
          confirmedCount: c.confirmedCount,
          scannedThroughHeight: Math.min(c.snapshotHeight, c.next - 1),
          progress: complete
            ? 100
            : Math.min(100, Math.max(0, (100 * (c.next - c.birth)) / Math.max(1, c.snapshotHeight + 1 - c.birth))),
        }
      : { ...base, rows };
  }
  private validate(rows: Row[]): Row[] {
    if (
      !Array.isArray(rows) ||
      rows.some((r) => !r || !Number.isSafeInteger(r.height) || !/^[a-f0-9]{64}$/i.test(r.tx_hash))
    )
      throw new HistoryBusyError('Invalid history response');
    const unique = new Map<string, Row>();
    for (const row of rows) unique.set(row.tx_hash, row);
    return [...unique.values()];
  }
}
