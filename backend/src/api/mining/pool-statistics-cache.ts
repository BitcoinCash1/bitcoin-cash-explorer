import { randomUUID } from 'crypto';
import config from '../../config';
import valkey from '../valkey-cache';

export interface PoolStatisticsResult {
  value: object;
  cacheable: boolean;
}

// Shared generation invalidates every pool and worker, including computations already in flight.
class PoolStatisticsCache {
  private pending = new Map<string, Promise<PoolStatisticsResult>>();
  private revision = 0;
  private get prefix(): string {
    return `mining:pool-statistics:${config.EXPLORER.NETWORK}:${config.DATABASE.DATABASE}`;
  }

  public async invalidate(): Promise<void> {
    this.revision++;
    await valkey.$setCache(`${this.prefix}:generation`, randomUUID());
  }

  private async generation(): Promise<string | null> {
    if (!config.VALKEY.ENABLED) return null;
    let token = await valkey.$getCache(`${this.prefix}:generation`);
    if (!token) {
      await valkey.$setCache(`${this.prefix}:generation`, randomUUID());
      token = await valkey.$getCache(`${this.prefix}:generation`);
    }
    return token;
  }

  public async get(pool: number, compute: () => Promise<PoolStatisticsResult>): Promise<PoolStatisticsResult> {
    const token = await this.generation();
    const revision = this.revision;
    const key = `${this.prefix}:${token}:${revision}:${pool}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = this.load(pool, token, revision, compute);
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }

  private async load(
    pool: number,
    token: string | null,
    revision: number,
    compute: () => Promise<PoolStatisticsResult>
  ): Promise<PoolStatisticsResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      // Version response keys so older workers cannot supply cached RPC fallbacks.
      const key = `${this.prefix}:v2:${token}:${pool}`;
      if (token) {
        const cached = await valkey.$getCache(key);
        if (cached) {
          try {
            const value = JSON.parse(cached);
            if (revision === this.revision && token === (await this.generation())) return { value, cacheable: true };
          } catch {
            /* Recompute malformed cached responses. */
          }
        }
      }
      const result = await compute();
      const current = await this.generation();
      if (revision === this.revision && token === current) {
        if (token && result.cacheable) await valkey.$setCache(key, JSON.stringify(result.value), 120);
        return result;
      }
      if (attempt === 1) return result;
      token = current;
      revision = this.revision;
    }
    throw new Error('Unreachable pool statistics cache state');
  }
}
export default new PoolStatisticsCache();
