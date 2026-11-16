import { EventEmitter } from 'node:events';
import * as net from 'node:net';
import logger from '../../../logger';
import {
  ByteReader,
  Message,
  MessageDecoder,
  NODE_CF,
  ProtocolError,
  VersionInfo,
  decodeVersion,
  encodeMessage,
  encodeVersion,
} from './wire';

/**
 * One P2P connection to a node, as a light client keeps it: the version
 * handshake, pings answered, block announcements passed on, and requests
 * sent one at a time, each waiting for the messages that answer it. A request
 * that gets no answer in time, a bad message or a closed socket drops the
 * connection, which then reconnects with backoff.
 */

export interface PeerOptions {
  host: string;
  port: number;
  magic: Buffer;
  /** Milliseconds a request may wait between two of the messages that answer it. */
  timeout: number;
  name?: string;
  userAgent?: string;
  /** Opens the socket; tests pass their own. */
  connect?: (port: number, host: string) => net.Socket;
}

/**
 * Takes messages while a request waits: `false` for a message that is not part
 * of the answer, `true` for one that is but more must follow, `{ value }` when
 * the answer is complete. Throwing rejects the request and drops the connection.
 */
export type Collector<T> = (message: Message) => boolean | { value: T };

export class P2PTimeoutError extends Error {
  readonly status = 503;
  readonly code = 'P2P_TIMEOUT';
}

export class P2PUnavailableError extends Error {
  readonly status = 503;
  readonly code = 'P2P_UNAVAILABLE';
}

interface Job {
  command: string;
  payload: Buffer;
  collect: Collector<any>;
  timeout: number;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
  timer?: NodeJS.Timeout;
}

const MSG_BLOCK = 2;
const MAX_BACKOFF = 30_000;

export class P2PPeer extends EventEmitter {
  private socket?: net.Socket;
  private decoder?: MessageDecoder;
  private handshakeTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private gotVersion = false;
  private gotVerack = false;
  private ready = false;
  private running = false;
  private backoff = 1000;
  private queue: Job[] = [];
  private current?: Job;
  private waiters: { resolve: () => void; reject: (e: Error) => void; timer: NodeJS.Timeout }[] = [];
  remote?: VersionInfo;
  readonly name: string;

  constructor(private readonly options: PeerOptions) {
    super();
    this.name = options.name ?? `${options.host}:${options.port}`;
  }

  get isReady(): boolean {
    return this.ready;
  }

  start(): void {
    if (this.running) {
      return;
    }
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    clearTimeout(this.reconnectTimer);
    this.drop(new P2PUnavailableError('P2P peer stopped'));
  }

  /** Sends a request once the connection is up and resolves with what the collector assembles. */
  async request<T>(
    command: string,
    payload: Buffer,
    collect: Collector<T>,
    timeout = this.options.timeout
  ): Promise<T> {
    await this.whenReady(timeout);
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ command, payload, collect, timeout, resolve, reject });
      this.pump();
    });
  }

  /** Resolves when the handshake is done, or rejects after `timeout` milliseconds. */
  whenReady(timeout = this.options.timeout): Promise<void> {
    if (this.ready) {
      return Promise.resolve();
    }
    if (!this.running) {
      return Promise.reject(new P2PUnavailableError('P2P peer is not running'));
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new P2PUnavailableError(`P2P peer ${this.name} is not connected`));
        }, timeout),
      };
      this.waiters.push(waiter);
    });
  }

  private connect(): void {
    if (!this.running) {
      return;
    }
    const socket = this.options.connect
      ? this.options.connect(this.options.port, this.options.host)
      : net.connect(this.options.port, this.options.host);
    this.socket = socket;
    this.decoder = new MessageDecoder(this.options.magic);
    this.gotVersion = false;
    this.gotVerack = false;
    socket.setNoDelay(true);
    socket.on('connect', () => {
      this.send('version', encodeVersion(this.options.userAgent ?? '/bch-explorer-p2p:1.0/'));
    });
    socket.on('data', (chunk: Buffer) => {
      if (socket !== this.socket) {
        return;
      }
      try {
        for (const message of this.decoder!.push(chunk)) {
          this.onMessage(message);
        }
      } catch (e) {
        this.drop(e instanceof Error ? e : new ProtocolError(String(e)));
      }
    });
    socket.on('error', (e) => {
      if (socket === this.socket) {
        logger.debug(`P2P peer ${this.name}: ${e.message}`);
      }
    });
    socket.on('close', () => {
      if (socket === this.socket) {
        this.drop(new P2PUnavailableError(`P2P peer ${this.name} closed the connection`));
      }
    });
    this.handshakeTimer = setTimeout(
      () => this.drop(new P2PTimeoutError(`P2P handshake with ${this.name} timed out`)),
      this.options.timeout
    );
  }

  private send(command: string, payload: Buffer): void {
    this.socket?.write(encodeMessage(this.options.magic, command, payload));
  }

  private onMessage(message: Message): void {
    if (!this.ready) {
      if (message.command === 'version') {
        this.remote = decodeVersion(message.payload);
        this.gotVersion = true;
        this.send('verack', Buffer.alloc(0));
      } else if (message.command === 'verack') {
        this.gotVerack = true;
      } else if (message.command === 'ping') {
        this.send('pong', message.payload);
      }
      if (this.gotVersion && this.gotVerack) {
        this.onReady();
      }
      return;
    }
    if (message.command === 'ping') {
      this.send('pong', message.payload);
      return;
    }
    const job = this.current;
    if (job) {
      const taken = job.collect(message);
      if (taken !== false) {
        this.arm(job);
        if (taken !== true) {
          this.finish(job);
          job.resolve(taken.value);
        }
        return;
      }
    }
    if (message.command === 'inv' && this.announcesBlock(message.payload)) {
      this.emit('block');
    } else if (message.command === 'headers') {
      this.emit('block');
    }
  }

  private announcesBlock(payload: Buffer): boolean {
    try {
      const r = new ByteReader(payload);
      const n = r.count(36);
      for (let i = 0; i < n; i++) {
        const type = r.u32();
        r.hash();
        if (type === MSG_BLOCK) {
          return true;
        }
      }
    } catch {
      return false;
    }
    return false;
  }

  private onReady(): void {
    clearTimeout(this.handshakeTimer);
    this.ready = true;
    this.backoff = 1000;
    const services = this.remote?.services ?? 0n;
    logger.info(
      `Connected to P2P node ${this.name} (${this.remote?.userAgent}, height ${this.remote?.startHeight})` +
        ((services & NODE_CF) === 0n ? '; it does not advertise compact filters' : '')
    );
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    this.emit('ready');
    this.pump();
  }

  private pump(): void {
    if (!this.ready || this.current || !this.queue.length) {
      return;
    }
    const job = this.queue.shift()!;
    this.current = job;
    this.arm(job);
    this.send(job.command, job.payload);
  }

  private arm(job: Job): void {
    clearTimeout(job.timer);
    job.timer = setTimeout(() => {
      // A late answer could be taken for the next request's, so the connection goes.
      this.drop(new P2PTimeoutError(`P2P ${job.command} to ${this.name} timed out`));
    }, job.timeout);
  }

  private finish(job: Job): void {
    clearTimeout(job.timer);
    if (this.current === job) {
      this.current = undefined;
    }
    setImmediate(() => this.pump());
  }

  /** Fails what waits on this connection, closes it and schedules the next one. */
  private drop(error: Error): void {
    clearTimeout(this.handshakeTimer);
    const socket = this.socket;
    const wasReady = this.ready;
    this.socket = undefined;
    this.ready = false;
    socket?.removeAllListeners('data');
    socket?.destroy();
    const jobs = [...(this.current ? [this.current] : []), ...this.queue.splice(0)];
    this.current = undefined;
    for (const job of jobs) {
      clearTimeout(job.timer);
      job.reject(error);
    }
    if (wasReady) {
      logger.warn(`P2P node ${this.name}: ${error.message}`);
      this.emit('disconnect', error);
    }
    if (!this.running) {
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(error);
      }
      return;
    }
    if (socket) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = setTimeout(() => this.connect(), this.backoff);
      this.backoff = Math.min(MAX_BACKOFF, this.backoff * 2);
    }
  }
}
