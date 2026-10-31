import { randomUUID } from 'crypto';
import config from '../../config';
import valkey from '../valkey-cache';

// Shared generation invalidates every pool and worker, including computations already in flight.
class PoolStatisticsCache {
  private pending = new Map<string, Promise<object>>();
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

  public async get(pool: number, compute: () => Promise<object>): Promise<object> {
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
    compute: () => Promise<object>
  ): Promise<object> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const key = `${this.prefix}:${token}:${pool}`;
      if (token) {
        const cached = await valkey.$getCache(key);
        if (cached) {
          try {
            const value = JSON.parse(cached);
            if (revision === this.revision && token === (await this.generation())) return value;
          } catch {
            /* Recompute malformed cached responses. */
          }
        }
      }
      const result = await compute();
      const current = await this.generation();
      if (revision === this.revision && token === current) {
        if (token) await valkey.$setCache(key, JSON.stringify(result), 30);
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
