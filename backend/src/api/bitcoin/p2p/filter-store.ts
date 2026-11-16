import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import logger from '../../../logger';
import {
  BlockHeader,
  CFHeaders,
  CFCheckpt,
  MAX_CFILTERS_PER_MSG,
  MAX_HEADERS_PER_MSG,
  SCRIPT_FILTER_TYPE,
  decodeCFCheckpt,
  decodeCFHeaders,
  decodeCFilter,
  decodeHeaders,
  encodeGetCFCheckpt,
  encodeGetCFHeaders,
  encodeGetCFilters,
  encodeGetHeaders,
  meetsTarget,
} from './messages';
import { Collector } from './peer';
import { Message, ProtocolError, ZERO_HASH, sha256d, toDisplay } from './wire';

/**
 * The explorer's own copy of the node's script filters, as any light wallet
 * keeps one: for every block its hash, header Merkle root, filter header and
 * filter (type 1), downloaded over P2P and checked before they are kept. The
 * block headers chain and meet their targets, the filter hashes chain from
 * zero into filter headers that match the node's checkpoints, and every filter
 * hashes to its header. Reorganizations truncate the copy at the fork.
 *
 * Two flat files hold it. filters.dat is the filters back to back; index.dat
 * has one 100 byte record per height: block hash, Merkle root, filter header,
 * filter length. Both only grow by blocks and are read in order when an
 * address is scanned, which suits files better than the database: nothing in
 * them is per address or per transaction, a scan is one sequential read, and
 * truncating at a fork is one call.
 */

export interface FilterPeer {
  readonly isReady: boolean;
  request<T>(command: string, payload: Buffer, collect: Collector<T>, timeout?: number): Promise<T>;
  on(event: 'ready' | 'block', listener: () => void): unknown;
  off(event: 'ready' | 'block', listener: () => void): unknown;
}

/** What scans and proofs read from the store. */
export interface FilterSource {
  readonly tipHeight: number;
  /** True once the copy has caught up with the node. */
  readonly synced: boolean;
  hashAt(height: number): Buffer | undefined;
  merkleRootAt(height: number): Buffer | undefined;
  heightOf(hash: Buffer): number | undefined;
  readFilter(height: number): Promise<Buffer>;
  scan(
    from: number,
    to: number,
    visit: (height: number, blockHash: Buffer, filter: Buffer) => boolean | void,
    signal?: AbortSignal
  ): Promise<void>;
  on(event: 'reorg', listener: (forkHeight: number) => void): unknown;
}

export class FilterStoreChangedError extends Error {
  readonly status = 503;
  readonly code = 'ADDRESS_HISTORY_BUSY';
}

const RECORD = 100;
const HASH = 0;
const MERKLE = 32;
const FILTER_HEADER = 64;
const LENGTH = 96;
const SCAN_CHUNK = 8 * 1024 * 1024;
const CHECKPOINT_INTERVAL = 1000;
/** Headers fetched ahead of their filters in one round, which bounds the memory of an initial sync. */
const MAX_PENDING = 50_000;

export interface FilterStoreOptions {
  network: string;
  /** Milliseconds between polls for new blocks besides the node's announcements. */
  pollInterval?: number;
}

export class FilterStore extends EventEmitter implements FilterSource {
  /** Records of heights [0, count), in a buffer with room for more. */
  private index = Buffer.alloc(0);
  private count = 0;
  /** Where each height's filter starts in filters.dat. */
  private offsets = new Float64Array(0);
  private filters?: fs.promises.FileHandle;
  private records?: fs.promises.FileHandle;
  private generation = 0;
  private syncing?: Promise<void>;
  private again = false;
  private timer?: NodeJS.Timeout;
  private readonly onBlock = () => this.requestSync();
  /** True once a sync found no headers past the tip. */
  synced = false;
  lastError?: Error;

  constructor(
    private readonly dir: string,
    private readonly peer: FilterPeer,
    private readonly options: FilterStoreOptions
  ) {
    super();
  }

  get tipHeight(): number {
    return this.count - 1;
  }

  hashAt(height: number): Buffer | undefined {
    return this.field(height, HASH);
  }

  merkleRootAt(height: number): Buffer | undefined {
    return this.field(height, MERKLE);
  }

  filterHeaderAt(height: number): Buffer | undefined {
    return this.field(height, FILTER_HEADER);
  }

  private field(height: number, at: number): Buffer | undefined {
    if (!Number.isInteger(height) || height < 0 || height >= this.count) {
      return undefined;
    }
    return this.index.subarray(height * RECORD + at, height * RECORD + at + 32);
  }

  private lengthAt(height: number): number {
    return this.index.readUInt32LE(height * RECORD + LENGTH);
  }

  /** The height of a block of the stored chain, searched from the tip down. */
  heightOf(hash: Buffer): number | undefined {
    for (let h = this.count - 1; h >= 0; h--) {
      if (this.index.compare(hash, 0, 32, h * RECORD, h * RECORD + 32) === 0) {
        return h;
      }
    }
    return undefined;
  }

  async open(): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const meta = path.join(this.dir, 'meta.json');
    const network = JSON.stringify({ network: this.options.network, filterType: SCRIPT_FILTER_TYPE, version: 1 });
    try {
      const existing = await fs.promises.readFile(meta, 'utf8');
      if (existing.trim() !== network) {
        throw new Error(`Filter store ${this.dir} belongs to ${existing.trim()}, not ${network}`);
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
      await fs.promises.writeFile(meta, network + '\n');
    }
    this.filters = await openFile(path.join(this.dir, 'filters.dat'));
    this.records = await openFile(path.join(this.dir, 'index.dat'));
    const index = await readAll(this.records);
    const filterBytes = (await this.filters.stat()).size;
    // Filters are written before their records: keep the records whose filters are whole.
    let count = Math.floor(index.length / RECORD);
    let total = 0;
    const offsets = new Float64Array(count);
    for (let h = 0; h < count; h++) {
      const length = index.readUInt32LE(h * RECORD + LENGTH);
      if (total + length > filterBytes) {
        count = h;
        break;
      }
      offsets[h] = total;
      total += length;
    }
    this.reserve(count);
    index.copy(this.index, 0, 0, count * RECORD);
    this.offsets.set(offsets.subarray(0, count));
    this.count = count;
    await this.records.truncate(count * RECORD);
    await this.filters.truncate(total);
    // Check the newest filters against their headers; older ones are checked when a scan matches them.
    for (let h = Math.max(0, count - 10); h < this.count; h++) {
      try {
        await this.readFilter(h);
      } catch (e: any) {
        logger.warn(`P2P filter store: ${e.message}; downloading again from height ${h}`);
        await this.truncate(h);
      }
    }
    logger.info(`P2P filter store ${this.dir}: ${this.count} blocks`);
  }

  start(): void {
    this.peer.on('ready', this.onBlock);
    this.peer.on('block', this.onBlock);
    const poll = () => {
      this.requestSync();
      this.timer = setTimeout(poll, this.options.pollInterval ?? 30_000);
      this.timer.unref?.();
    };
    poll();
  }

  async stop(): Promise<void> {
    clearTimeout(this.timer);
    this.peer.off('ready', this.onBlock);
    this.peer.off('block', this.onBlock);
    await this.syncing?.catch(() => undefined);
    await this.filters?.close();
    await this.records?.close();
    this.filters = this.records = undefined;
  }

  /** Starts a sync, or another one right after the running one. */
  requestSync(): Promise<void> {
    if (this.syncing) {
      this.again = true;
      return this.syncing;
    }
    if (!this.peer.isReady) {
      return Promise.resolve();
    }
    this.syncing = (async () => {
      try {
        do {
          this.again = false;
          while (await this.syncStep()) {
            // keep going until the node has no newer headers
          }
          this.synced = true;
          this.lastError = undefined;
        } while (this.again);
      } catch (e: any) {
        this.lastError = e;
        logger.warn(`P2P filter sync: ${e?.message ?? e}`);
      } finally {
        this.syncing = undefined;
      }
    })();
    return this.syncing;
  }

  /** Block locator of the stored chain: ten newest, then doubling steps back, then genesis. */
  private locator(): Buffer[] {
    if (!this.count) {
      // A hash no node knows: the node answers from its genesis block.
      return [ZERO_HASH];
    }
    const out: Buffer[] = [];
    let step = 1;
    for (let h = this.count - 1; h > 0; h -= step) {
      out.push(this.hashAt(h)!);
      if (out.length >= 10) {
        step *= 2;
      }
    }
    out.push(this.hashAt(0)!);
    return out;
  }

  /**
   * One round: up to MAX_PENDING headers after the stored tip, then their
   * filter headers, checked against the node's checkpoints, and filters.
   * Returns false when the node has nothing newer.
   */
  private async syncStep(): Promise<boolean> {
    let reply = await this.getHeaders(this.locator());
    if (!reply.length) {
      return false;
    }
    let fork = this.heightOf(reply[0].prevHash);
    let headers = reply;
    if (fork === undefined) {
      if (this.count) {
        throw new ProtocolError('The node sent headers that do not connect to the stored chain');
      }
      headers = [await this.getGenesis(reply[0].prevHash), ...reply];
      fork = -1;
    }
    // Skip what is stored already; anything after a difference replaces the stored blocks.
    let start = fork + 1;
    for (;;) {
      let skip = 0;
      while (skip < headers.length && this.hashAt(start + skip)?.equals(headers[skip].hash)) {
        skip++;
      }
      start += skip;
      headers = headers.slice(skip);
      if (headers.length || reply.length < MAX_HEADERS_PER_MSG) {
        break;
      }
      reply = headers = await this.getHeaders([this.hashAt(start - 1)!]);
    }
    if (!headers.length) {
      return false;
    }
    // Follow the node towards its tip first, so that one checkpoint request covers many batches.
    while (reply.length === MAX_HEADERS_PER_MSG && headers.length < MAX_PENDING) {
      reply = await this.getHeaders([headers[headers.length - 1].hash]);
      headers.push(...reply);
    }
    this.checkHeaders(start, headers);
    if (start < this.count) {
      logger.warn(`P2P filter store: reorganization at height ${start}, ${this.count - start} blocks replaced`);
      await this.truncate(start);
      this.emit('reorg', start - 1);
    }
    const last = start + headers.length - 1;
    const spansCheckpoint =
      last >= CHECKPOINT_INTERVAL &&
      Math.floor(last / CHECKPOINT_INTERVAL) > Math.floor((start - 1) / CHECKPOINT_INTERVAL);
    const checkpoints = spansCheckpoint ? await this.getCheckpoints(headers) : [];
    for (let at = 0; at < headers.length; at += MAX_CFILTERS_PER_MSG) {
      const batch = headers.slice(at, at + MAX_CFILTERS_PER_MSG);
      await this.syncFilters(start + at, batch, checkpoints);
    }
    if (headers.length > 1) {
      logger.info(`P2P filter store: ${this.count} blocks, tip ${toDisplay(this.hashAt(this.tipHeight)!)}`);
    }
    return true;
  }

  private getHeaders(locator: Buffer[], stop: Buffer = ZERO_HASH): Promise<BlockHeader[]> {
    return this.peer.request('getheaders', encodeGetHeaders(locator, stop), only('headers', decodeHeaders));
  }

  /** With an empty locator the node returns the stop block's header alone. */
  private async getGenesis(hash: Buffer): Promise<BlockHeader> {
    const [genesis] = await this.getHeaders([], hash);
    if (!genesis || !genesis.hash.equals(hash)) {
      throw new ProtocolError('The node did not send its genesis header');
    }
    return genesis;
  }

  private checkHeaders(start: number, headers: BlockHeader[]): void {
    let prev = start > 0 ? this.hashAt(start - 1) : undefined;
    for (const header of headers) {
      if ((prev && !header.prevHash.equals(prev)) || !meetsTarget(header)) {
        throw new ProtocolError(`Invalid block header ${toDisplay(header.hash)}`);
      }
      prev = header.hash;
    }
  }

  private async getCheckpoints(headers: BlockHeader[]): Promise<Buffer[]> {
    const stop = headers[headers.length - 1].hash;
    const reply = await this.peer.request<CFCheckpt>(
      'getcfcheckpt',
      encodeGetCFCheckpt(SCRIPT_FILTER_TYPE, stop),
      only('cfcheckpt', decodeCFCheckpt, (m) => m.filterType === SCRIPT_FILTER_TYPE && m.stopHash.equals(stop))
    );
    return reply.headers;
  }

  private async syncFilters(start: number, headers: BlockHeader[], checkpoints: Buffer[]): Promise<void> {
    const stop = headers[headers.length - 1].hash;
    const cfheaders = await this.peer.request<CFHeaders>(
      'getcfheaders',
      encodeGetCFHeaders(SCRIPT_FILTER_TYPE, start, stop),
      only('cfheaders', decodeCFHeaders, (m) => m.filterType === SCRIPT_FILTER_TYPE && m.stopHash.equals(stop))
    );
    const prevHeader = start > 0 ? this.filterHeaderAt(start - 1)! : ZERO_HASH;
    if (!cfheaders.prevHeader.equals(prevHeader) || cfheaders.filterHashes.length !== headers.length) {
      throw new ProtocolError(`Filter headers from ${start} do not chain to the stored ones`);
    }
    const filterHeaders: Buffer[] = [];
    let header = prevHeader;
    for (let i = 0; i < headers.length; i++) {
      header = sha256d(Buffer.concat([cfheaders.filterHashes[i], header]));
      filterHeaders.push(header);
      const height = start + i;
      const checkpoint = height % CHECKPOINT_INTERVAL === 0 ? checkpoints[height / CHECKPOINT_INTERVAL - 1] : undefined;
      if (checkpoint && !checkpoint.equals(header)) {
        throw new ProtocolError(`Filter header at ${height} differs from the node's checkpoint`);
      }
    }

    const filters: Buffer[] = [];
    await this.peer.request<void>('getcfilters', encodeGetCFilters(SCRIPT_FILTER_TYPE, start, stop), (message) => {
      if (message.command !== 'cfilter') {
        return false;
      }
      const reply = decodeCFilter(message.payload);
      const i = filters.length;
      if (
        reply.filterType !== SCRIPT_FILTER_TYPE ||
        !reply.blockHash.equals(headers[i].hash) ||
        reply.filter.length < 33 ||
        !sha256d(reply.filter).equals(cfheaders.filterHashes[i])
      ) {
        throw new ProtocolError(`Filter of block ${toDisplay(reply.blockHash)} does not match its header`);
      }
      filters.push(Buffer.from(reply.filter));
      return filters.length === headers.length ? { value: undefined } : true;
    });
    await this.append(headers, filterHeaders, filters);
  }

  private async append(headers: BlockHeader[], filterHeaders: Buffer[], filters: Buffer[]): Promise<void> {
    if (!this.filters || !this.records) {
      throw new Error('Filter store is closed');
    }
    const base = this.count;
    const end = base > 0 ? this.offsets[base - 1] + this.lengthAt(base - 1) : 0;
    const blob = Buffer.concat(filters);
    const records = Buffer.alloc(headers.length * RECORD);
    for (let i = 0; i < headers.length; i++) {
      headers[i].hash.copy(records, i * RECORD + HASH);
      headers[i].merkleRoot.copy(records, i * RECORD + MERKLE);
      filterHeaders[i].copy(records, i * RECORD + FILTER_HEADER);
      records.writeUInt32LE(filters[i].length, i * RECORD + LENGTH);
    }
    await writeAll(this.filters, blob, end);
    await writeAll(this.records, records, base * RECORD);

    const count = base + headers.length;
    this.reserve(count);
    records.copy(this.index, base * RECORD);
    let offset = end;
    for (let i = 0; i < headers.length; i++) {
      this.offsets[base + i] = offset;
      offset += filters[i].length;
    }
    this.count = count;
  }

  /** Makes room for `count` records in memory. */
  private reserve(count: number): void {
    if (count * RECORD <= this.index.length) {
      return;
    }
    const capacity = Math.max(count, Math.ceil(this.count * 1.5)) + 1024;
    const index = Buffer.alloc(capacity * RECORD);
    this.index.copy(index, 0, 0, this.count * RECORD);
    const offsets = new Float64Array(capacity);
    offsets.set(this.offsets.subarray(0, this.count));
    this.index = index;
    this.offsets = offsets;
  }

  private async truncate(height: number): Promise<void> {
    if (!this.filters || !this.records) {
      throw new Error('Filter store is closed');
    }
    this.generation++;
    const end = height > 0 ? this.offsets[height - 1] + this.lengthAt(height - 1) : 0;
    this.count = height;
    await this.records.truncate(height * RECORD);
    await this.filters.truncate(end);
  }

  /** A stored filter, checked against the filter header chain. */
  async readFilter(height: number): Promise<Buffer> {
    if (!this.filters || height < 0 || height >= this.count) {
      throw new Error(`No filter at height ${height}`);
    }
    const generation = this.generation;
    const filter = Buffer.alloc(this.lengthAt(height));
    await readExact(this.filters, filter, this.offsets[height]);
    const prev = height > 0 ? this.filterHeaderAt(height - 1)! : ZERO_HASH;
    if (generation !== this.generation) {
      throw new FilterStoreChangedError('The chain changed during the read');
    }
    if (!sha256d(Buffer.concat([sha256d(filter), prev])).equals(this.filterHeaderAt(height)!)) {
      throw new Error(`Stored filter at height ${height} does not match its header`);
    }
    return filter;
  }

  /**
   * Visits the filters of heights [from, to) in order, reading the file in
   * large chunks. The filter passed is only valid during the call. Returning
   * true stops the scan.
   */
  async scan(
    from: number,
    to: number,
    visit: (height: number, blockHash: Buffer, filter: Buffer) => boolean | void,
    signal?: AbortSignal
  ): Promise<void> {
    if (!this.filters) {
      throw new Error('Filter store is closed');
    }
    const generation = this.generation;
    const end = Math.min(to, this.count);
    let buffer = Buffer.alloc(0);
    for (let h = Math.max(0, from); h < end;) {
      if (signal?.aborted) {
        throw new FilterStoreChangedError('Request cancelled');
      }
      const first = h;
      const base = this.offsets[first];
      let last = first;
      while (last + 1 < end && this.offsets[last + 1] + this.lengthAt(last + 1) - base <= SCAN_CHUNK) {
        last++;
      }
      const size = this.offsets[last] + this.lengthAt(last) - base;
      if (buffer.length < size) {
        buffer = Buffer.alloc(Math.max(size, Math.min(SCAN_CHUNK, buffer.length * 2)));
      }
      await readExact(this.filters, buffer.subarray(0, size), base);
      if (generation !== this.generation) {
        throw new FilterStoreChangedError('The chain changed during the scan');
      }
      for (let height = first; height <= last; height++) {
        const at = this.offsets[height] - base;
        if (visit(height, this.hashAt(height)!, buffer.subarray(at, at + this.lengthAt(height))) === true) {
          return;
        }
      }
      h = last + 1;
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
}

/** A collector for a request answered by one message of a command. */
export function only<T>(command: string, decode: (payload: Buffer) => T, accept?: (value: T) => boolean): Collector<T> {
  return (message: Message) => {
    if (message.command !== command) {
      return false;
    }
    const value = decode(message.payload);
    return !accept || accept(value) ? { value } : false;
  };
}

async function openFile(file: string): Promise<fs.promises.FileHandle> {
  try {
    return await fs.promises.open(file, 'r+');
  } catch (e: any) {
    if (e.code !== 'ENOENT') {
      throw e;
    }
    return fs.promises.open(file, 'w+');
  }
}

async function readAll(handle: fs.promises.FileHandle): Promise<Buffer> {
  const { size } = await handle.stat();
  const buffer = Buffer.alloc(size);
  await readExact(handle, buffer, 0);
  return buffer;
}

async function readExact(handle: fs.promises.FileHandle, buffer: Buffer, position: number): Promise<void> {
  let done = 0;
  while (done < buffer.length) {
    const { bytesRead } = await handle.read(buffer, done, buffer.length - done, position + done);
    if (bytesRead === 0) {
      throw new FilterStoreChangedError('The filter store ended early');
    }
    done += bytesRead;
  }
}

async function writeAll(handle: fs.promises.FileHandle, buffer: Buffer, position: number): Promise<void> {
  let done = 0;
  while (done < buffer.length) {
    const { bytesWritten } = await handle.write(buffer, done, buffer.length - done, position + done);
    done += bytesWritten;
  }
}
