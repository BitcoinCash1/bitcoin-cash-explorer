import * as fs from 'node:fs';
import * as path from 'node:path';
import config from '../../config';
import logger from '../../logger';
import loadingIndicators from '../loading-indicators';
import mempool from '../mempool';
import { AddressPagination } from './address-pagination';
import { AbstractBitcoinApi } from './bitcoin-api-abstract-factory';
import BitcoinApi from './bitcoin-api';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IElectrumApi } from './electrum-api.interface';
import { compareElectrumHistoryNewestFirst } from './electrum-history';
import { HistoryBusyError, HistoryCoordinator } from './history-coordinator';
import { IPublicApi } from './public-api.interface';
import { FilterStore } from './p2p/filter-store';
import { LightClient, ScriptSummary, ScriptTx, summarize } from './p2p/light-client';
import { P2PPeer } from './p2p/peer';
import { scriptKey } from './p2p/script-filter';
import { networkParams, sha256d } from './p2p/wire';

/**
 * Address data from the node as a pure P2P light client: the explorer keeps
 * the node's script filters (type 1), matches addresses against them itself
 * and proves what matches with getcfrange and getcfproof. The node serves
 * per-block filters and proofs and, over RPC, transactions by block and its
 * mempool; it needs no address or transaction index, and no Electrum server.
 */

interface MempoolTx {
  txid: string;
  vin: {
    txid: string;
    vout: number;
    is_coinbase?: boolean;
    scriptpubkey?: string;
    value?: number | null;
    prevout?: { scriptpubkey: string; value: number } | null;
  }[];
  vout: { scriptpubkey: string; value: number }[];
}

export interface P2PBackendDeps {
  client: LightClient;
  mempool?: () => Record<string, MempoolTx>;
  started?: Promise<void>;
}

interface Target {
  key: Buffer;
  /** The locking script, when the target is an address. */
  script?: string;
  address: string;
}

/** What the mempool does to a script: transactions, created outputs and spends. */
interface PendingActivity {
  rows: IElectrumApi.ScriptHashHistory[];
  outputs: { txid: string; vout: number; value: number }[];
  spends: { txid: string; vin: number; outpoint: string; value: number }[];
}

class P2PBackendApi extends BitcoinApi implements AbstractBitcoinApi {
  private readonly client: LightClient;
  private readonly started: Promise<void>;
  private readonly readMempool: () => Record<string, MempoolTx>;
  private readonly historyCoordinator = new HistoryCoordinator();
  private readonly pagination: AddressPagination;

  constructor(bitcoinClient: any, deps?: P2PBackendDeps) {
    super(bitcoinClient);
    const built = deps ?? createLightClient();
    this.client = built.client;
    this.started = built.started ?? Promise.resolve();
    this.started.catch((e) => logger.err(`P2P light client did not start: ${e?.message ?? e}`));
    this.readMempool = built.mempool ?? (() => mempool.getMempool() as unknown as Record<string, MempoolTx>);
    this.pagination = new AddressPagination(
      {
        snapshot: async () => {
          await this.started;
          const height = this.client.tipHeight;
          if (height < 0) {
            throw new HistoryBusyError('Filters are not synchronized yet');
          }
          return { height, hash: this.client.hashAt(height)! };
        },
        hash: async (height) => this.client.hashAt(height) ?? '',
        firstUse: async (key) => {
          // Only a scanned history knows where a script starts; otherwise every block is a candidate.
          const history = this.client.cachedHistory(LightClient.keyOfScripthash(key));
          if (history?.txs.length) {
            return history.txs[0].height;
          }
          return history && history.through >= this.client.tipHeight ? null : 0;
        },
        history: (key, from, to, count, signal, snapshotHash) =>
          this.historyCoordinator.request<IElectrumApi.ScriptHashHistory[]>(
            `${key}:${snapshotHash}:${from}:${to}`,
            async () => rows(await this.client.scan(LightClient.keyOfScripthash(key), from, to, signal)),
            count,
            signal
          ),
        pending: async (key) => this.pending(LightClient.keyOfScripthash(key)).rows,
      },
      config.EXPLORER.NETWORK
    );
  }

  private async target(target: string, isScripthash: boolean): Promise<Target> {
    await this.started;
    if (!this.client.synced) {
      throw new HistoryBusyError('Filters are still being downloaded from the node');
    }
    if (isScripthash) {
      return { key: LightClient.keyOfScripthash(target), address: target };
    }
    const info = await this.bitcoindClient.validateAddress(target);
    if (!info?.isvalid) {
      throw new Error('Invalid Bitcoin Cash address');
    }
    return { key: scriptKey(Buffer.from(info.scriptPubKey, 'hex')), script: info.scriptPubKey, address: info.address };
  }

  /** Mempool transactions that pay the script or spend its outputs, from the explorer's own mempool copy. */
  private pending(key: Buffer, script?: string, confirmed?: ScriptSummary): PendingActivity {
    const pool = this.readMempool() ?? {};
    const known = new Map<string, boolean>();
    const pays = (hex?: string) => {
      if (!hex) {
        return false;
      }
      if (script !== undefined) {
        return hex === script;
      }
      let hit = known.get(hex);
      if (hit === undefined) {
        hit = scriptKey(Buffer.from(hex, 'hex')).equals(key);
        known.set(hex, hit);
      }
      return hit;
    };
    const created = new Map<string, number>();
    const activity: PendingActivity = { rows: [], outputs: [], spends: [] };
    const touched = new Set<string>();
    for (const tx of Object.values(pool)) {
      tx.vout.forEach((output, vout) => {
        if (pays(output.scriptpubkey)) {
          created.set(`${tx.txid}:${vout}`, output.value);
          activity.outputs.push({ txid: tx.txid, vout, value: output.value });
          touched.add(tx.txid);
        }
      });
    }
    for (const tx of Object.values(pool)) {
      tx.vin.forEach((input, vin) => {
        if (input.is_coinbase) {
          return;
        }
        const outpoint = `${input.txid}:${input.vout}`;
        const value = created.get(outpoint) ?? confirmed?.outputs.get(outpoint)?.value;
        if (value !== undefined || pays(input.prevout?.scriptpubkey ?? input.scriptpubkey)) {
          activity.spends.push({
            txid: tx.txid,
            vin,
            outpoint,
            value: value ?? input.prevout?.value ?? input.value ?? 0,
          });
          touched.add(tx.txid);
        }
      });
    }
    for (const txid of touched) {
      // As Electrum: -1 for a transaction with an unconfirmed parent, 0 otherwise.
      const parentPending = pool[txid].vin.some((input) => pool[input.txid] !== undefined);
      activity.rows.push({ tx_hash: txid, height: parentPending ? -1 : 0 });
    }
    activity.rows.sort((a, b) => a.tx_hash.localeCompare(b.tx_hash));
    return activity;
  }

  private stats(target: Target, history: ScriptTx[]) {
    const confirmed = summarize(history);
    const pending = this.pending(target.key, target.script, confirmed);
    return {
      confirmed,
      pending,
      chain_stats: {
        funded_txo_count: confirmed.fundedCount,
        funded_txo_sum: confirmed.fundedSum,
        spent_txo_count: confirmed.spentCount,
        spent_txo_sum: confirmed.spentSum,
        tx_count: confirmed.txCount,
      },
      mempool_stats: {
        funded_txo_count: pending.outputs.length,
        funded_txo_sum: pending.outputs.reduce((sum, output) => sum + output.value, 0),
        spent_txo_count: pending.spends.length,
        spent_txo_sum: pending.spends.reduce((sum, spend) => sum + spend.value, 0),
        tx_count: pending.rows.length,
      },
    };
  }

  /** A confirmed transaction read by its block, so that the node needs no transaction index. */
  private async $getTransactionInBlock(txid: string, blockHash: string): Promise<IPublicApi.VerboseTransaction> {
    const tx: IBitcoinApi.VerboseTransaction = await this.bitcoindClient.getRawTransaction(txid, 2, blockHash, true);
    return this.$convertTransaction(tx, true);
  }

  private async $transactions(
    progressKey: string,
    list: { tx_hash: string; height: number; blockHash?: string }[],
    lastSeenTxId?: string
  ): Promise<IPublicApi.VerboseTransaction[]> {
    let start = 0;
    if (lastSeenTxId) {
      const pos = list.findIndex((row) => row.tx_hash === lastSeenTxId);
      if (pos < 0) {
        throw new Error('Invalid transaction cursor');
      }
      start = pos + 1;
    }
    const end = Math.min(start + 10, list.length);
    const transactions: IPublicApi.VerboseTransaction[] = [];
    loadingIndicators.setProgress('address-' + progressKey, 0);
    try {
      for (let i = start; i < end; i++) {
        const row = list[i];
        transactions.push(
          row.blockHash
            ? await this.$getTransactionInBlock(row.tx_hash, row.blockHash)
            : ((await this.$getRawTransaction(row.tx_hash, false, true)) as IPublicApi.VerboseTransaction)
        );
        loadingIndicators.setProgress('address-' + progressKey, ((i + 1) / end) * 100);
      }
    } catch (e: any) {
      loadingIndicators.setProgress('address-' + progressKey, 100);
      throw new Error(typeof e === 'string' ? e : (e && e.message) || e, { cause: e });
    }
    return transactions;
  }

  /** Every transaction of a script, the mempool first, then the chain newest first. */
  private async $history(target: Target) {
    const history = await this.client.history(target.key);
    const pending = this.pending(target.key, target.script, summarize(history.txs)).rows;
    const confirmed = [...history.txs].sort((a, b) => b.height - a.height || b.txIndex - a.txIndex);
    return [
      ...[...pending].sort(compareElectrumHistoryNewestFirst),
      ...confirmed.map((tx) => ({ tx_hash: tx.txid, height: tx.height, blockHash: tx.blockHash })),
    ];
  }

  private async $summary(target: Target) {
    const history = await this.client.history(target.key);
    return this.stats(target, history.txs);
  }

  async $getAddress(address: string): Promise<IPublicApi.Address> {
    const target = await this.target(address, false);
    const { chain_stats, mempool_stats } = await this.$summary(target);
    return { address: target.address, chain_stats, mempool_stats };
  }

  async $getScriptHash(scripthash: string): Promise<IPublicApi.ScriptHash> {
    const target = await this.target(scripthash, true);
    const { chain_stats, mempool_stats } = await this.$summary(target);
    return { scripthash, chain_stats, mempool_stats };
  }

  async $getAddressTransactions(address: string, lastSeenTxId: string): Promise<IPublicApi.VerboseTransaction[]> {
    const target = await this.target(address, false);
    return this.$transactions(address, await this.$history(target), lastSeenTxId);
  }

  async $getScriptHashTransactions(
    scripthash: string,
    lastSeenTxId?: string
  ): Promise<IPublicApi.VerboseTransaction[]> {
    const target = await this.target(scripthash, true);
    return this.$transactions(scripthash, await this.$history(target), lastSeenTxId);
  }

  async $getAddressMempoolTransactions(address: string): Promise<IPublicApi.VerboseTransaction[]> {
    const target = await this.target(address, false);
    const cached = this.client.cachedHistory(target.key);
    const rows = this.pending(target.key, target.script, cached && summarize(cached.txs)).rows;
    return this.$transactions(address, rows.sort(compareElectrumHistoryNewestFirst));
  }

  async $getScriptHashMempoolTransactions(scripthash: string): Promise<IPublicApi.VerboseTransaction[]> {
    const target = await this.target(scripthash, true);
    const cached = this.client.cachedHistory(target.key);
    const rows = this.pending(target.key, undefined, cached && summarize(cached.txs)).rows;
    return this.$transactions(scripthash, rows.sort(compareElectrumHistoryNewestFirst));
  }

  async $getAddressUtxos(address: string): Promise<IPublicApi.UTXO[]> {
    return this.$utxos(await this.target(address, false));
  }

  async $getScriptHashUtxos(scripthash: string): Promise<IPublicApi.UTXO[]> {
    return this.$utxos(await this.target(scripthash, true));
  }

  /** Outputs created and not spent, on the chain or in the mempool, as Electrum's listunspent gives them. */
  private async $utxos(target: Target): Promise<IPublicApi.UTXO[]> {
    const { confirmed, pending } = await this.$summary(target);
    const spentInMempool = new Set(pending.spends.map((spend) => spend.outpoint));
    const times = new Map<string, number>();
    const result: IPublicApi.UTXO[] = [];
    const unspent = [...confirmed.outputs.entries()]
      .filter(([outpoint]) => !confirmed.spent.has(outpoint) && !spentInMempool.has(outpoint))
      .map(([, output]) => output)
      .sort((a, b) => a.height - b.height || a.txid.localeCompare(b.txid) || a.vout - b.vout);
    for (const output of unspent) {
      let time = times.get(output.blockHash);
      if (time === undefined) {
        time = (await this.$getBlock(output.blockHash)).timestamp;
        times.set(output.blockHash, time);
      }
      result.push({
        txid: output.txid,
        vout: output.vout,
        status: { confirmed: true, block_height: output.height, block_hash: output.blockHash, block_time: time },
        value: output.value,
      });
    }
    for (const output of pending.outputs) {
      if (!spentInMempool.has(`${output.txid}:${output.vout}`)) {
        result.push({ txid: output.txid, vout: output.vout, status: { confirmed: false }, value: output.value });
      }
    }
    return result;
  }

  async $getAddressMempoolSummary(target: string, scriptHash = false) {
    const resolved = await this.target(target, scriptHash);
    const cached = this.client.cachedHistory(resolved.key);
    return {
      pendingTransactionCount: this.pending(resolved.key, resolved.script, cached && summarize(cached.txs)).rows.length,
    };
  }

  async $getAddressSummary(target: string, scriptHash = false) {
    const resolved = await this.target(target, scriptHash);
    const { confirmed, pending } = await this.$summary(resolved);
    return {
      address: resolved.address,
      confirmedBalance: confirmed.fundedSum - confirmed.spentSum,
      pendingBalance:
        pending.outputs.reduce((sum, output) => sum + output.value, 0) -
        pending.spends.reduce((sum, spend) => sum + spend.value, 0),
      electrum: false,
    };
  }

  async $getAddressPage(target: string, scriptHash = false, cursor?: string, signal?: AbortSignal) {
    const resolved = await this.target(target, scriptHash);
    const key = Buffer.from(resolved.key).reverse().toString('hex');
    const page = await this.pagination.page(key, 'transactions', cursor, signal);
    const transactions: IPublicApi.VerboseTransaction[] = [];
    for (const row of 'rows' in page ? page.rows : []) {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }
      const blockHash = row.height > 0 ? this.client.hashAt(row.height) : undefined;
      transactions.push(
        blockHash
          ? await this.$getTransactionInBlock(row.tx_hash, blockHash)
          : ((await this.$getRawTransaction(row.tx_hash, false, true)) as IPublicApi.VerboseTransaction)
      );
    }
    if (this.client.hashAt(page.snapshotHeight) !== page.snapshotHash) {
      throw Object.assign(new Error('Address snapshot changed; restart pagination'), {
        status: 409,
        code: 'ADDRESS_SNAPSHOT_CHANGED',
      });
    }
    return {
      nextCursor: page.nextCursor,
      complete: page.complete,
      snapshotHeight: page.snapshotHeight,
      snapshotHash: page.snapshotHash,
      transactions,
    };
  }

  async $getAddressCount(target: string, scriptHash = false, cursor?: string, signal?: AbortSignal) {
    const resolved = await this.target(target, scriptHash);
    const key = Buffer.from(resolved.key).reverse().toString('hex');
    const page = await this.pagination.page(key, 'count', cursor, signal);
    if (!('confirmedCount' in page)) {
      throw new Error('Invalid count result');
    }
    return page;
  }

  /**
   * Which input spends an output: a mempool spend from the explorer's mempool
   * copy, a confirmed one by scanning the filters forward from the output's
   * block for a spend of its script, in windows that grow until it is found.
   */
  async $getOutspend(txId: string, vout: number): Promise<IPublicApi.DetailedOutspend> {
    await this.started;
    const tx = (await this.$getRawTransaction(txId, false, false)) as IPublicApi.Transaction;
    const output = tx.vout[vout];
    if (!output) {
      throw new Error('Output not found');
    }
    const unspent = await this.bitcoindClient.getTxOut(txId, vout);
    if (unspent !== null) {
      return { spent: false };
    }
    for (const pending of Object.values(this.readMempool() ?? {})) {
      const vin = pending.vin.findIndex((input) => input.txid === txId && input.vout === vout);
      if (vin >= 0) {
        return { spent: true, txid: pending.txid, vin };
      }
    }
    const height = tx.status?.block_height;
    if (!height || !output.scriptpubkey) {
      return { spent: true };
    }
    const key = scriptKey(Buffer.from(output.scriptpubkey, 'hex'));
    const tip = this.client.tipHeight;
    for (let from = height, width = 144; from <= tip; from += width, width = Math.min(width * 2, 100_000)) {
      for (const spender of await this.client.scan(key, from, Math.min(from + width, tip + 1))) {
        const spend = spender.spends.find((s) => s.txid === txId && s.vout === vout);
        if (spend) {
          return { spent: true, txid: spender.txid, vin: spend.vin };
        }
      }
    }
    return { spent: true };
  }

  async $getTransactionMerkleProof(txId: string): Promise<IPublicApi.MerkleProof> {
    const tx = (await this.$getRawTransaction(txId)) as IPublicApi.VerboseTransaction;
    if (!tx.status.block_hash || !tx.status.block_height) {
      throw new Error('Transaction is not confirmed / could not find block height.');
    }
    const txids = await this.$getTxIdsForBlock(tx.status.block_hash);
    const pos = txids.indexOf(txId);
    if (pos < 0) {
      throw new Error('Transaction is not in its block');
    }
    return { block_height: tx.status.block_height, merkle: merkleBranch(txids, pos), pos };
  }
}

/** The Merkle branch of the transaction at pos, as Electrum gives it: display-order hashes from the bottom. */
export function merkleBranch(txids: string[], pos: number): string[] {
  let level: Buffer[] = txids.map((txid) => Buffer.from(txid, 'hex').reverse());
  const branch: string[] = [];
  let index = pos;
  while (level.length > 1) {
    if (level.length % 2) {
      level.push(level[level.length - 1]);
    }
    branch.push(
      Buffer.from(level[index ^ 1])
        .reverse()
        .toString('hex')
    );
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      next.push(sha256d(Buffer.concat([level[i], level[i + 1]])));
    }
    level = next;
    index >>= 1;
  }
  return branch;
}

function rows(txs: ScriptTx[]): IElectrumApi.ScriptHashHistory[] {
  const seen = new Set<string>();
  const out: IElectrumApi.ScriptHashHistory[] = [];
  for (const tx of txs) {
    if (!seen.has(tx.txid)) {
      seen.add(tx.txid);
      out.push({ tx_hash: tx.txid, height: tx.height });
    }
  }
  return out;
}

/** Takes the store directory for this process, refusing one another live process holds. */
function lockStore(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  const lock = path.join(dir, 'lock');
  try {
    const holder = Number(fs.readFileSync(lock, 'utf8'));
    if (holder && holder !== process.pid) {
      process.kill(holder, 0);
      throw new Error(
        `P2P filter store ${dir} is in use by process ${holder}; the p2p backend runs in one process (SPAWN_CLUSTER_PROCS 0)`
      );
    }
  } catch (e: any) {
    if (e.code !== 'ENOENT' && e.code !== 'ESRCH') {
      throw e;
    }
  }
  fs.writeFileSync(lock, String(process.pid));
}

function createLightClient(): P2PBackendDeps {
  const network = config.P2P.NETWORK || config.EXPLORER.NETWORK;
  const params = networkParams(network);
  const port = config.P2P.PORT || params.port;
  const dir = config.P2P.FILTER_DIR || path.join(config.EXPLORER.CACHE_DIR, 'p2p-filters', network);
  const peer = (role: string) =>
    new P2PPeer({
      host: config.P2P.HOST,
      port,
      magic: params.magic,
      timeout: config.P2P.TIMEOUT,
      name: `${config.P2P.HOST}:${port} (${role})`,
    });
  const syncPeer = peer('filters');
  const queryPeer = peer('proofs');
  const store = new FilterStore(dir, syncPeer, { network });
  const client = new LightClient(store, queryPeer, {
    prefixBits: config.P2P.RANGE_PREFIX_BITS,
    maxHistoryTxs: config.P2P.MAX_HISTORY_TXS,
  });
  const started = (async () => {
    lockStore(dir);
    await store.open();
    syncPeer.start();
    queryPeer.start();
    store.start();
  })();
  return { client, started };
}

export default P2PBackendApi;
