import { AddressHistoryUnavailableError } from '../address-pagination';
import { FilterSource, FilterStoreChangedError, only } from './filter-store';
import { gcsMatch } from './gcs';
import {
  CFProof,
  CFRange,
  SCRIPT_FILTER_TYPE,
  decodeCFProof,
  decodeCFRange,
  encodeGetCFProof,
  encodeGetCFRange,
} from './messages';
import { Collector } from './peer';
import {
  LeafKind,
  ProvedLeaf,
  checkProof,
  checkRange,
  keyPrefix,
  scriptKey,
  splitScriptFilter,
  splitTokenPrefix,
} from './script-filter';
import { toDisplay } from './wire';

/**
 * The address side of the light client. For a script key it tests each
 * block's stored filter; for a block that matches it asks the node for the
 * leaves with the key (getcfrange) and checks them against the root in the
 * filter, then asks for one proof per transaction (getcfproof), which gives
 * the transaction and folds it to the block header's Merkle root. Leaves say
 * which outputs pay the script and which inputs spend from it, so history,
 * balance and unspent outputs follow without any index.
 */

export interface ProofPeer {
  request<T>(command: string, payload: Buffer, collect: Collector<T>, timeout?: number): Promise<T>;
}

export interface ScriptOutput {
  vout: number;
  value: number;
}

export interface ScriptSpend {
  vin: number;
  /** The output it spends. */
  txid: string;
  vout: number;
  /** Known when the node's proof included the creating transaction. */
  value?: number;
}

/** A confirmed transaction that pays or spends a script, with what it does to it. */
export interface ScriptTx {
  txid: string;
  height: number;
  blockHash: string;
  txIndex: number;
  outputs: ScriptOutput[];
  spends: ScriptSpend[];
}

export interface ScriptHistory {
  /** The heights [0, through] have been scanned, through the block throughHash. */
  through: number;
  throughHash: string;
  txs: ScriptTx[];
}

export interface LightClientOptions {
  /** Bits of the key a getcfrange names; fewer bits show the node a bucket of keys instead of the key. */
  prefixBits: number;
  maxHistoryTxs: number;
  blockCacheSize?: number;
  historyCacheSize?: number;
}

class Lru<V> {
  private readonly map = new Map<string, V>();
  constructor(private readonly size: number) {}
  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value !== undefined) {
      this.map.delete(key);
      this.map.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.size) {
      this.map.delete(this.map.keys().next().value!);
    }
  }
  values(): IterableIterator<V> {
    return this.map.values();
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

export class LightClient {
  private readonly blocks: Lru<ScriptTx[]>;
  private readonly histories: Lru<ScriptHistory>;
  private readonly pending = new Map<string, Promise<ScriptHistory>>();

  constructor(
    private readonly store: FilterSource,
    private readonly peer: ProofPeer,
    private readonly options: LightClientOptions
  ) {
    this.blocks = new Lru(options.blockCacheSize ?? 20_000);
    this.histories = new Lru(options.historyCacheSize ?? 64);
    store.on('reorg', (fork) => this.onReorg(fork));
  }

  static keyOfScript(scriptHex: string): Buffer {
    return scriptKey(Buffer.from(scriptHex, 'hex'));
  }

  /** The key of an Electrum scripthash, which is the key with its bytes reversed. */
  static keyOfScripthash(scripthash: string): Buffer {
    if (!/^[0-9a-fA-F]{64}$/.test(scripthash)) {
      throw new Error('Invalid scripthash');
    }
    return Buffer.from(scripthash, 'hex').reverse();
  }

  get tipHeight(): number {
    return this.store.tipHeight;
  }

  /** Until the filter copy has caught up with the node once, histories would be partial. */
  get synced(): boolean {
    return this.store.synced;
  }

  hashAt(height: number): string | undefined {
    const hash = this.store.hashAt(height);
    return hash ? toDisplay(hash) : undefined;
  }

  private onReorg(fork: number): void {
    for (const history of this.histories.values()) {
      if (history.through > fork) {
        history.txs = history.txs.filter((tx) => tx.height <= fork);
        history.through = fork;
        history.throughHash = fork >= 0 ? this.hashAt(fork)! : '';
      }
    }
  }

  /** The history of a script that is cached and still on the chain, without scanning. */
  cachedHistory(key: Buffer): ScriptHistory | undefined {
    const history = this.histories.get(key.toString('hex'));
    return history && history.through >= 0 && this.hashAt(history.through) === history.throughHash
      ? history
      : undefined;
  }

  /**
   * The confirmed transactions of a script in the blocks [from, to), in chain
   * order. A cached full history answers without a scan.
   */
  async scan(key: Buffer, from: number, to: number, signal?: AbortSignal, limit?: number): Promise<ScriptTx[]> {
    const cached = this.cachedHistory(key);
    if (cached && to - 1 <= cached.through) {
      return cached.txs.filter((tx) => tx.height >= from && tx.height < to);
    }
    const end = Math.min(to, this.store.tipHeight + 1);
    if (end <= from) {
      return [];
    }
    const tipHash = this.hashAt(end - 1);
    const heights: number[] = [];
    await this.store.scan(
      from,
      end,
      (height, blockHash, filter) => {
        if (filter.length > 32 && gcsMatch(filter.subarray(32), blockHash, key)) {
          heights.push(height);
        }
      },
      signal
    );
    // Each matching block holds at least one transaction: refuse before asking for proofs.
    if (limit !== undefined && heights.length > limit) {
      throw new AddressHistoryUnavailableError('Address history exceeds the supported limit');
    }
    const txs: ScriptTx[] = [];
    for (const height of heights) {
      if (signal?.aborted) {
        throw new FilterStoreChangedError('Request cancelled');
      }
      txs.push(...(await this.blockTxs(key, height)));
    }
    if (this.hashAt(end - 1) !== tipHash) {
      throw new FilterStoreChangedError('The chain changed during the scan');
    }
    return txs;
  }

  /** The full confirmed history of a script, scanned once and then extended block by block. */
  history(key: Buffer): Promise<ScriptHistory> {
    const id = key.toString('hex');
    const running = this.pending.get(id);
    if (running) {
      return running;
    }
    const work = (async () => {
      const cached = this.cachedHistory(key);
      const tip = this.store.tipHeight;
      if (tip < 0) {
        return { through: -1, throughHash: '', txs: [] };
      }
      if (cached && cached.through >= tip) {
        return cached;
      }
      const tipHash = this.hashAt(tip)!;
      const txs = cached ? [...cached.txs] : [];
      const limit = this.options.maxHistoryTxs - txs.length;
      txs.push(...(await this.scan(key, cached ? cached.through + 1 : 0, tip + 1, undefined, limit)));
      if (txs.length > this.options.maxHistoryTxs) {
        throw new AddressHistoryUnavailableError('Address history exceeds the supported limit');
      }
      const history = { through: tip, throughHash: tipHash, txs };
      if (this.hashAt(tip) === tipHash) {
        this.histories.set(id, history);
      }
      return history;
    })();
    this.pending.set(id, work);
    const done = () => this.pending.delete(id);
    void work.then(done, done);
    return work;
  }

  /** The transactions of one block that pay or spend the script, each proved against the block. */
  async blockTxs(key: Buffer, height: number): Promise<ScriptTx[]> {
    const hash = this.store.hashAt(height);
    const merkleRoot = this.store.merkleRootAt(height);
    if (!hash || !merkleRoot) {
      throw new FilterStoreChangedError(`No block at height ${height}`);
    }
    const blockHash = Buffer.from(hash);
    const merkle = Buffer.from(merkleRoot);
    const id = key.toString('hex') + blockHash.toString('hex');
    const cached = this.blocks.get(id);
    if (cached) {
      return cached;
    }
    const { root, gcs } = splitScriptFilter(await this.store.readFilter(height));
    if (!this.store.hashAt(height)?.equals(blockHash)) {
      throw new FilterStoreChangedError('The chain changed during the scan');
    }
    let txs: ScriptTx[] = [];
    if (gcsMatch(gcs, blockHash, key)) {
      const bits = this.options.prefixBits;
      const prefix = keyPrefix(key, bits);
      const range = await this.peer.request<CFRange>(
        'getcfrange',
        encodeGetCFRange(SCRIPT_FILTER_TYPE, blockHash, bits, prefix),
        only('cfrange', decodeCFRange, (reply) => reply.blockHash.equals(blockHash))
      );
      const leaves = checkRange(root, blockHash, range, prefix, bits).filter(
        (leaf) => leaf.key.equals(key) && (leaf.kind === LeafKind.Output || leaf.kind === LeafKind.Spent)
      );
      txs = await this.proveTxs(height, blockHash, root, merkle, range.leafCount, leaves);
    }
    this.blocks.set(id, txs);
    return txs;
  }

  private async proveTxs(
    height: number,
    blockHash: Buffer,
    root: Buffer,
    merkleRoot: Buffer,
    leafCount: number,
    leaves: ProvedLeaf[]
  ): Promise<ScriptTx[]> {
    const byTx = new Map<number, ProvedLeaf[]>();
    for (const leaf of leaves) {
      byTx.set(leaf.txIndex, [...(byTx.get(leaf.txIndex) ?? []), leaf]);
    }
    const out: ScriptTx[] = [];
    for (const txIndex of [...byTx.keys()].sort((a, b) => a - b)) {
      const group = byTx.get(txIndex)!;
      // A created output's proof is the smaller one; a spent one also brings the creating transaction.
      const chosen = group.find((leaf) => leaf.kind === LeafKind.Output) ?? group[0];
      const proof = await this.peer.request<CFProof>(
        'getcfproof',
        encodeGetCFProof(SCRIPT_FILTER_TYPE, blockHash, chosen.position),
        only(
          'cfproof',
          decodeCFProof,
          (reply) => reply.blockHash.equals(blockHash) && reply.leafIndex === chosen.position
        )
      );
      checkProof(root, merkleRoot, blockHash, chosen, leafCount, proof);
      const tx = proof.tx;
      const entry: ScriptTx = {
        txid: toDisplay(tx.txid),
        height,
        blockHash: toDisplay(blockHash),
        txIndex,
        outputs: [],
        spends: [],
      };
      for (const leaf of group) {
        if (leaf.kind === LeafKind.Output) {
          const output = tx.outputs[leaf.index];
          if (!output || !scriptKey(splitTokenPrefix(output.script).script).equals(leaf.key)) {
            throw new FilterStoreChangedError('A leaf names an output with another script');
          }
          entry.outputs.push({ vout: leaf.index, value: output.value });
        } else {
          const input = tx.inputs[leaf.index];
          if (!input) {
            throw new FilterStoreChangedError('A leaf names an input the transaction does not have');
          }
          const spend: ScriptSpend = { vin: leaf.index, txid: toDisplay(input.prevTxid), vout: input.prevIndex };
          if (leaf === chosen && proof.origin) {
            spend.value = proof.origin.tx.outputs[input.prevIndex].value;
          }
          entry.spends.push(spend);
        }
      }
      out.push(entry);
    }
    return out;
  }
}

/** Balance and outputs of a script from its full history. */
export interface ScriptSummary {
  fundedCount: number;
  fundedSum: number;
  spentCount: number;
  spentSum: number;
  txCount: number;
  /** Created outputs, keyed txid:vout. */
  outputs: Map<string, { txid: string; vout: number; value: number; height: number; blockHash: string }>;
  spent: Set<string>;
}

export function summarize(txs: ScriptTx[]): ScriptSummary {
  const outputs: ScriptSummary['outputs'] = new Map();
  const spent = new Set<string>();
  let fundedSum = 0;
  let spentSum = 0;
  let spentCount = 0;
  for (const tx of txs) {
    for (const output of tx.outputs) {
      outputs.set(`${tx.txid}:${output.vout}`, {
        txid: tx.txid,
        ...output,
        height: tx.height,
        blockHash: tx.blockHash,
      });
      fundedSum += output.value;
    }
  }
  for (const tx of txs) {
    for (const spend of tx.spends) {
      const outpoint = `${spend.txid}:${spend.vout}`;
      spent.add(outpoint);
      spentCount++;
      spentSum += outputs.get(outpoint)?.value ?? spend.value ?? 0;
    }
  }
  return {
    fundedCount: outputs.size,
    fundedSum,
    spentCount,
    spentSum,
    txCount: new Set(txs.map((tx) => tx.txid)).size,
    outputs,
    spent,
  };
}
