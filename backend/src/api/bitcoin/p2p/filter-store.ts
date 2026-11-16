import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scanFilters } from 'rust-filter-scan';
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
import { Message, ProtocolError, ZERO_HASH, sha256, sha256d, toDisplay } from './wire';

/**
 * The explorer's own copy of the node's script filters, as any light wallet
 * keeps one: for every block its hash, header Merkle root, filter header and
 * filter (type 1), downloaded over P2P and checked before they are kept. The
 * block headers chain and meet their targets, the filter hashes chain from
 * zero into filter headers that match the node's checkpoints, and every filter
 * hashes to its header. Reorganizations truncate the copy at the fork.
 *
 * Three flat files hold it. filters.dat is the filters back to back; index.dat
 * has one 100 byte record per height: block hash, Merkle root, filter header,
 * filter length; commit.dat says how many heights are whole and a generation
 * that changes whenever stored heights are cut off. The files only grow by
 * blocks and a scan reads them in order, which suits files better than the
 * database: nothing in them is per address or per transaction, a scan is one
 * sequential read, and truncating at a fork is one call. Scans run in the
 * native filter-scan addon, on all cores, many keys per pass.
 *
 * One process writes the store (FilterStore); others, such as cluster
 * workers, read it (FilterReader) up to the heights the writer committed. The
 * writer changes the generation in commit.dat before it cuts heights off, so a
 * read that sees the same generation before and after read heights the cut did
 * not touch.
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
  /** For each key, the heights in [from, to) whose filter may hold it (false positives at 1/784931 per block). */
  match(keys: Buffer[], from: number, to: number, signal?: AbortSignal): Promise<number[][]>;
  /** Takes in what the writer committed since; the writer itself has nothing to take in. */
  refresh(): Promise<void>;
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
const CHECKPOINT_INTERVAL = 1000;
/** Headers fetched ahead of their filters in one round, which bounds the memory of an initial sync. */
const MAX_PENDING = 50_000;
/** Scans of at most this many blocks run at once; longer ones share passes over the files. */
const DIRECT_SCAN = 1000;
/** Records compared at a time when a reader looks for where the writer cut the chain. */
const FORK_STEP = 1000;
/** commit.dat: generation, height count, flags (1: synced), tip hash, 8 bytes of the SHA-256 of the rest. */
const COMMIT_SIZE = 52;

interface Commit {
  generation: number;
  count: number;
  synced: boolean;
  tipHash: Buffer;
}

function encodeCommit(commit: Commit): Buffer {
  const b = Buffer.alloc(COMMIT_SIZE);
  b.writeUInt32LE(commit.generation, 0);
  b.writeUInt32LE(commit.count, 4);
  b.writeUInt32LE(commit.synced ? 1 : 0, 8);
  commit.tipHash.copy(b, 12);
  sha256(b.subarray(0, 44)).copy(b, 44, 0, 8);
  return b;
}

/** A commit record, or undefined when it is not whole: a read can see the writer's write half done. */
function decodeCommit(b: Buffer): Commit | undefined {
  if (b.length !== COMMIT_SIZE || !sha256(b.subarray(0, 44)).subarray(0, 8).equals(b.subarray(44))) {
    return undefined;
  }
  return {
    generation: b.readUInt32LE(0),
    count: b.readUInt32LE(4),
    synced: (b.readUInt32LE(8) & 1) === 1,
    tipHash: Buffer.from(b.subarray(12, 44)),
  };
}

const metaOf = (network: string) => JSON.stringify({ network, filterType: SCRIPT_FILTER_TYPE, version: 1 });

interface Scan {
  keys: Buffer[];
  from: number;
  to: number;
  resolve: (heights: number[][]) => void;
  reject: (error: Error) => void;
}

/** The stored heights in memory and what reads them, for the writer and the readers alike. */
abstract class StoredFilters extends EventEmitter implements FilterSource {
  /** Records of heights [0, count), in a buffer with room for more. */
  protected index = Buffer.alloc(0);
  protected count = 0;
  /** Where each height's filter starts in filters.dat. */
  protected offsets = new Float64Array(0);
  protected filters?: fs.promises.FileHandle;
  /** Changes whenever stored heights are cut off; what was read at another generation is void. */
  protected generation = 0;
  private queued: Scan[] = [];
  private passing = false;
  abstract readonly synced: boolean;

  constructor(protected readonly dir: string) {
    super();
  }

  protected file(name: 'meta.json' | 'filters.dat' | 'index.dat' | 'commit.dat' | 'lock'): string {
    return path.join(this.dir, name);
  }

  /** Whether heights read at `generation` are still the stored ones. */
  protected abstract unchanged(generation: number): Promise<boolean>;

  abstract refresh(): Promise<void>;

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

  protected lengthAt(height: number): number {
    return this.index.readUInt32LE(height * RECORD + LENGTH);
  }

  /** Where the filters of the heights below `height` end in filters.dat. */
  protected endOf(height: number): number {
    return height > 0 ? this.offsets[height - 1] + this.lengthAt(height - 1) : 0;
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

  /** Takes the records of the heights from `base` on into memory, replacing any stored from there. */
  protected take(base: number, records: Buffer): void {
    const count = base + records.length / RECORD;
    this.reserve(count);
    records.copy(this.index, base * RECORD);
    let offset = this.endOf(base);
    for (let h = base; h < count; h++) {
      this.offsets[h] = offset;
      offset += records.readUInt32LE((h - base) * RECORD + LENGTH);
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

  /** A stored filter, checked against the filter header chain. */
  async readFilter(height: number): Promise<Buffer> {
    if (!this.filters || !Number.isInteger(height) || height < 0 || height >= this.count) {
      throw new Error(`No filter at height ${height}`);
    }
    const generation = this.generation;
    const prev = height > 0 ? Buffer.from(this.filterHeaderAt(height - 1)!) : ZERO_HASH;
    const header = Buffer.from(this.filterHeaderAt(height)!);
    const filter = Buffer.alloc(this.lengthAt(height));
    const read = await readExact(this.filters, filter, this.offsets[height]).catch((e: Error) => e);
    if (!(await this.unchanged(generation))) {
      throw new FilterStoreChangedError('The chain changed during the read');
    }
    if (read) {
      throw read;
    }
    if (!sha256d(Buffer.concat([sha256d(filter), prev])).equals(header)) {
      throw new Error(`Stored filter at height ${height} does not match its header`);
    }
    return filter;
  }

  /**
   * For each key, the heights in [from, to) whose filter may hold it. Short
   * runs are scanned at once; longer ones wait for the running pass over the
   * files and share the next one, with every key that waits.
   */
  match(keys: Buffer[], from: number, to: number, signal?: AbortSignal): Promise<number[][]> {
    from = Math.max(0, from);
    to = Math.min(to, this.count);
    if (!keys.length || to <= from) {
      return Promise.resolve(keys.map(() => []));
    }
    if (signal?.aborted) {
      return Promise.reject(new FilterStoreChangedError('Request cancelled'));
    }
    const found = new Promise<number[][]>((resolve, reject) => {
      const scan = { keys, from, to, resolve, reject };
      if (to - from <= DIRECT_SCAN) {
        void this.pass([scan]);
      } else {
        this.queued.push(scan);
        this.drain();
      }
    });
    return found.then((heights) => {
      if (signal?.aborted) {
        throw new FilterStoreChangedError('Request cancelled');
      }
      return heights;
    });
  }

  private drain(): void {
    if (this.passing || !this.queued.length) {
      return;
    }
    this.passing = true;
    void this.pass(this.queued.splice(0)).finally(() => {
      this.passing = false;
      this.drain();
    });
  }

  /** One pass over the heights all the scans cover, with all their keys; each scan gets its own heights. */
  private async pass(scans: Scan[]): Promise<void> {
    try {
      if (!this.filters) {
        throw new Error('Filter store is closed');
      }
      const generation = this.generation;
      const from = Math.min(...scans.map((scan) => scan.from));
      const to = Math.min(Math.max(...scans.map((scan) => scan.to)), this.count);
      const ids = new Map<string, number>();
      const keys: Buffer[] = [];
      for (const key of scans.flatMap((scan) => scan.keys)) {
        const id = key.toString('hex');
        if (!ids.has(id)) {
          ids.set(id, keys.length);
          keys.push(key);
        }
      }
      let found: number[][] = keys.map(() => []);
      let failure: Error | undefined;
      if (from < to) {
        try {
          found = await scanFilters({
            indexFile: this.file('index.dat'),
            filtersFile: this.file('filters.dat'),
            from,
            to,
            filterOffset: this.offsets[from],
            keys,
          });
        } catch (e) {
          failure = e instanceof Error ? e : new Error(String(e));
        }
      }
      if (!(await this.unchanged(generation))) {
        throw new FilterStoreChangedError('The chain changed during the scan');
      }
      if (failure) {
        throw failure;
      }
      for (const scan of scans) {
        scan.resolve(
          scan.keys.map((key) =>
            found[ids.get(key.toString('hex'))!].filter((height) => height >= scan.from && height < scan.to)
          )
        );
      }
    } catch (e) {
      for (const scan of scans) {
        scan.reject(e as Error);
      }
    }
  }
}

export interface FilterStoreOptions {
  network: string;
  /** Milliseconds between polls for new blocks besides the node's announcements. */
  pollInterval?: number;
}

/** The store's writer: it syncs the copy from the node and commits each step for readers. */
export class FilterStore extends StoredFilters {
  private records?: fs.promises.FileHandle;
  private commits?: fs.promises.FileHandle;
  private syncing?: Promise<void>;
  private again = false;
  private timer?: NodeJS.Timeout;
  private readonly onBlock = () => this.requestSync();
  /** True once a sync found no headers past the tip. */
  synced = false;
  lastError?: Error;

  constructor(
    dir: string,
    private readonly peer: FilterPeer,
    private readonly options: FilterStoreOptions
  ) {
    super(dir);
  }

  protected async unchanged(generation: number): Promise<boolean> {
    return generation === this.generation;
  }

  refresh(): Promise<void> {
    return Promise.resolve();
  }

  async open(): Promise<void> {
    await fs.promises.mkdir(this.dir, { recursive: true });
    const meta = this.file('meta.json');
    const network = metaOf(this.options.network);
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
    this.filters = await openFile(this.file('filters.dat'));
    this.records = await openFile(this.file('index.dat'));
    this.commits = await openFile(this.file('commit.dat'));
    const committed = decodeCommit(await readAll(this.commits));
    this.generation = committed?.generation ?? 0;
    const index = await readAll(this.records);
    const filterBytes = (await this.filters.stat()).size;
    // Filters are written before their records: keep the records whose filters are whole.
    let count = Math.floor(index.length / RECORD);
    let total = 0;
    for (let h = 0; h < count; h++) {
      const length = index.readUInt32LE(h * RECORD + LENGTH);
      if (total + length > filterBytes) {
        count = h;
        break;
      }
      total += length;
    }
    if (committed && count < committed.count) {
      // Heights a reader may hold are gone.
      this.generation = (this.generation + 1) >>> 0;
    }
    this.take(0, index.subarray(0, count * RECORD));
    await this.commit();
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
    await this.commits?.close();
    this.filters = this.records = this.commits = undefined;
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
          if (!this.synced) {
            this.synced = true;
            await this.commit();
          }
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

  /** Writes filters, then their records, then the commit that lets readers see them. */
  private async append(headers: BlockHeader[], filterHeaders: Buffer[], filters: Buffer[]): Promise<void> {
    if (!this.filters || !this.records) {
      throw new Error('Filter store is closed');
    }
    const base = this.count;
    const records = Buffer.alloc(headers.length * RECORD);
    for (let i = 0; i < headers.length; i++) {
      headers[i].hash.copy(records, i * RECORD + HASH);
      headers[i].merkleRoot.copy(records, i * RECORD + MERKLE);
      filterHeaders[i].copy(records, i * RECORD + FILTER_HEADER);
      records.writeUInt32LE(filters[i].length, i * RECORD + LENGTH);
    }
    await writeAll(this.filters, Buffer.concat(filters), this.endOf(base));
    await writeAll(this.records, records, base * RECORD);
    this.take(base, records);
    await this.commit();
  }

  /** Cuts the heights from `height` on: readers learn of it from the new generation before the files change. */
  private async truncate(height: number): Promise<void> {
    if (!this.filters || !this.records) {
      throw new Error('Filter store is closed');
    }
    this.generation = (this.generation + 1) >>> 0;
    const end = this.endOf(height);
    this.count = height;
    await this.commit();
    await this.records.truncate(height * RECORD);
    await this.filters.truncate(end);
  }

  private async commit(): Promise<void> {
    if (!this.commits) {
      throw new Error('Filter store is closed');
    }
    const tipHash = this.count ? this.hashAt(this.count - 1)! : ZERO_HASH;
    const commit = encodeCommit({ generation: this.generation, count: this.count, synced: this.synced, tipHash });
    await writeAll(this.commits, commit, 0);
  }
}

export interface FilterReaderOptions {
  network: string;
  /** Milliseconds between looks at what the writer committed, besides each refresh(). */
  pollInterval?: number;
}

/**
 * A read-only view of a store another process writes, as cluster workers
 * have it: it takes the heights the writer committed, and after a new
 * generation keeps only the heights whose records still read the same,
 * which is where the writer cut the chain.
 */
export class FilterReader extends StoredFilters {
  synced = false;
  private records?: fs.promises.FileHandle;
  private commits?: fs.promises.FileHandle;
  private refreshing?: Promise<void>;
  private timer?: NodeJS.Timeout;

  constructor(
    dir: string,
    private readonly options: FilterReaderOptions
  ) {
    super(dir);
  }

  /** Opens the files if the writer has made them; until then the store is empty. */
  open(): Promise<void> {
    return this.refresh();
  }

  start(): void {
    const poll = () => {
      this.timer = setTimeout(() => {
        this.refresh()
          .catch((e) => logger.warn(`P2P filter store ${this.dir}: ${e?.message ?? e}`))
          .finally(poll);
      }, this.options.pollInterval ?? 1000);
      this.timer.unref?.();
    };
    poll();
  }

  async stop(): Promise<void> {
    clearTimeout(this.timer);
    await this.refreshing?.catch(() => undefined);
    await this.close();
  }

  refresh(): Promise<void> {
    this.refreshing ??= this.load().finally(() => {
      this.refreshing = undefined;
    });
    return this.refreshing;
  }

  protected async unchanged(generation: number): Promise<boolean> {
    if (generation !== this.generation) {
      return false;
    }
    const commit = await this.readCommit().catch(() => undefined);
    return commit?.generation === generation;
  }

  private async close(): Promise<void> {
    await this.filters?.close();
    await this.records?.close();
    await this.commits?.close();
    this.filters = this.records = this.commits = undefined;
  }

  private async openFiles(): Promise<boolean> {
    if (this.commits) {
      return true;
    }
    try {
      const meta = (await fs.promises.readFile(this.file('meta.json'), 'utf8')).trim();
      if (meta !== metaOf(this.options.network)) {
        throw new Error(`Filter store ${this.dir} belongs to ${meta}, not ${metaOf(this.options.network)}`);
      }
      // The writer makes commit.dat last.
      this.commits = await fs.promises.open(this.file('commit.dat'), 'r');
      this.records = await fs.promises.open(this.file('index.dat'), 'r');
      this.filters = await fs.promises.open(this.file('filters.dat'), 'r');
      return true;
    } catch (e: any) {
      await this.close();
      if (e.code === 'ENOENT') {
        return false;
      }
      throw e;
    }
  }

  /** What the writer committed last, undefined before its first commit. */
  private async readCommit(): Promise<Commit | undefined> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const b = Buffer.alloc(COMMIT_SIZE);
      const { bytesRead } = await this.commits!.read(b, 0, COMMIT_SIZE, 0);
      if (bytesRead === 0) {
        return undefined;
      }
      const commit = decodeCommit(b.subarray(0, bytesRead));
      if (commit) {
        return commit;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    throw new FilterStoreChangedError('The filter store commit does not read whole');
  }

  private async load(): Promise<void> {
    if (!(await this.openFiles())) {
      return;
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      const commit = await this.readCommit();
      if (!commit) {
        return;
      }
      this.synced = commit.synced;
      if (commit.generation === this.generation && commit.count === this.count) {
        return;
      }
      const base =
        commit.generation === this.generation && commit.count > this.count
          ? this.count
          : await this.agreeing(Math.min(this.count, commit.count));
      const records = Buffer.alloc((commit.count - base) * RECORD);
      const read = await readExact(this.records!, records, base * RECORD).catch((e: Error) => e);
      // Unless the generation held, the writer cut the chain meanwhile: read again.
      if ((await this.readCommit())?.generation !== commit.generation) {
        continue;
      }
      if (read) {
        throw read;
      }
      const tip = records.length ? records.subarray(records.length - RECORD) : this.index.subarray((base - 1) * RECORD);
      if (commit.count > 0 && !tip.subarray(HASH, HASH + 32).equals(commit.tipHash)) {
        continue;
      }
      const cut = base < this.count;
      this.generation = commit.generation;
      this.take(base, records);
      if (cut) {
        logger.info(`P2P filter store ${this.dir}: the writer replaced the blocks from height ${base}`);
        this.emit('reorg', base - 1);
      }
      return;
    }
    throw new FilterStoreChangedError('The filter store kept changing while it was read');
  }

  /** How many of the first `limit` heights the file still holds as this reader does. */
  private async agreeing(limit: number): Promise<number> {
    for (let end = limit; end > 0; end -= FORK_STEP) {
      const start = Math.max(0, end - FORK_STEP);
      const stored = Buffer.alloc((end - start) * RECORD);
      await readExact(this.records!, stored, start * RECORD);
      for (let h = end - 1; h >= start; h--) {
        const at = (h - start) * RECORD;
        if (stored.compare(this.index, h * RECORD, (h + 1) * RECORD, at, at + RECORD) === 0) {
          return h + 1;
        }
      }
    }
    return 0;
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
