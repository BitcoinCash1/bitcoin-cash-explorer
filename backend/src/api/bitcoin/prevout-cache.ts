import { serialize } from 'node:v8';
import { IBitcoinApi } from './bitcoin-api.interface';
import { IPublicApi } from './public-api.interface';

export type PrevoutResolver = (txid: string, index: number) => Promise<IPublicApi.VerboseVout>;

interface Limits {
  maxBytes: number;
  maxEntries: number;
  maxTxids: number;
  maxOutpoints: number;
}

/** Retains only repeated parents' referenced outputs for one summary rebuild. */
export class PrevoutCache {
  private readonly needed = new Map<string, Set<number>>();
  private readonly entries = new Map<string, { outputs: Map<number, IPublicApi.VerboseVout>; cost: number }>();
  private bytes = 0;
  private readonly limits: Limits;

  constructor(
    block: IBitcoinApi.VerboseBlock,
    private readonly fetch: (txid: string) => Promise<IPublicApi.VerboseTransaction>,
    limits: Partial<Limits> = {}
  ) {
    this.limits = { maxBytes: 8 * 1024 * 1024, maxEntries: 1024, maxTxids: 4096, maxOutpoints: 32768, ...limits };
    const counts = new Map<string, number>();
    let outpoints = 0;
    for (const tx of block.tx) {
      for (const vin of tx.vin) {
        if (!vin.txid || vin.vout === undefined) {
          continue;
        }
        let indices = this.needed.get(vin.txid);
        if (!indices) {
          if (this.needed.size >= this.limits.maxTxids) {
            continue;
          }
          this.needed.set(vin.txid, (indices = new Set()));
        }
        counts.set(vin.txid, Math.min(2, (counts.get(vin.txid) ?? 0) + 1));
        if (!indices.has(vin.vout) && outpoints < this.limits.maxOutpoints) {
          indices.add(vin.vout);
          outpoints++;
        }
      }
    }
    for (const [id, count] of counts) {
      if (count < 2 || this.needed.get(id)?.size === 0) {
        this.needed.delete(id);
      }
    }
  }

  get eligible(): boolean {
    return this.needed.size > 0;
  }

  readonly resolve: PrevoutResolver = async (txid, index) => {
    const entry = this.entries.get(txid);
    const hit = entry?.outputs.get(index);
    if (hit) {
      this.entries.delete(txid);
      this.entries.set(txid, entry!);
      return structuredClone(hit);
    }
    const tx = await this.fetch(txid);
    const output = tx.vout[index];
    if (!output) {
      if (entry) {
        this.entries.delete(txid);
        this.bytes -= entry.cost;
      }
      throw new TypeError('Previous output is missing');
    }
    const wanted = this.needed.get(txid);
    if (!wanted?.has(index) || !tx.status?.confirmed) {
      return output;
    }
    const outputs = new Map<number, IPublicApi.VerboseVout>();
    for (const i of wanted) {
      if (tx.vout[i]) {
        outputs.set(i, structuredClone(tx.vout[i]));
      }
    }
    const cost = serialize(outputs).length;
    if (cost > this.limits.maxBytes || this.limits.maxEntries <= 0) {
      return output;
    }
    if (entry) {
      this.entries.delete(txid);
      this.bytes -= entry.cost;
    }
    while (this.entries.size >= this.limits.maxEntries || this.bytes + cost > this.limits.maxBytes) {
      const [key, oldest] = this.entries.entries().next().value!;
      this.entries.delete(key);
      this.bytes -= oldest.cost;
    }
    this.entries.set(txid, { outputs, cost });
    this.bytes += cost;
    return output;
  };

  clear(): void {
    this.entries.clear();
    this.needed.clear();
    this.bytes = 0;
  }
}
