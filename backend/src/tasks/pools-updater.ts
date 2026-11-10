import shutdown from '../utils/shutdown';
import diskCache from '../api/disk-cache';
import valkeyCache from '../api/valkey-cache';
import BlocksRepository from '../repositories/BlocksRepository';
import axios, { AxiosResponse } from 'axios';
import poolsParser from '../api/pools-parser';
import config from '../config';
import DB from '../database';
import backendInfo from '../api/backend-info';
import logger from '../logger';
import { getSocksProxyOptions } from '../utils/socks-proxy';
import * as https from 'https';
import { Common } from '../api/common';

/**
 * Maintain the most recent version of pools-v2.json
 */
class PoolsUpdater {
  tag = 'PoolsUpdater';

  private migrating = false;
  private readonly pendingBlocks = new Set<string>();
  private readonly attributionShas = new WeakMap<object, string | null>();
  private recheck: { sha: string; fromHeight: number } | null = null;
  lastRun = 0;
  currentSha: string | null = null;
  poolsUrl: string = config.EXPLORER.POOLS_JSON_URL;
  treeUrl: string = config.EXPLORER.POOLS_JSON_TREE_URL;
  poolsSource: string = config.EXPLORER.POOLS_SOURCE || 'gitlab';

  public async $startService(): Promise<void> {
    while (!shutdown.stopping) {
      try {
        await this.updatePoolsJson();
      } catch (e: any) {
        logger.info(`Exception ${e} in PoolsUpdater::$startService. Code: ${e.code}. Message: ${e.message}`, this.tag);
      }
      await Common.sleep$(10000);
    }
  }

  public async updatePoolsJson(): Promise<void> {
    return shutdown.run(() => this.updatePoolsJsonWork());
  }

  private async updatePoolsJsonWork(): Promise<void> {
    if (
      ['mainnet', 'testnet4', 'chipnet', 'scalenet'].includes(config.EXPLORER.NETWORK) === false ||
      config.EXPLORER.ENABLED === false
    ) {
      return;
    }

    if (this.migrating || this.recheck) return;

    const now = new Date().getTime() / 1000;
    if (now - this.lastRun < config.EXPLORER.POOLS_UPDATE_DELAY) {
      // Execute the PoolsUpdate only once a week, or upon restart
      return;
    }

    this.lastRun = now;

    try {
      if (config.DATABASE.ENABLED === true) {
        this.currentSha = await this.getShaFromDb();
      }

      let sha: string | null = null;
      if (this.poolsSource === 'gitlab') {
        sha = await this.fetchGitLabPoolsSha(); // Fetch pools-v2.json sha from GitLab
      } else {
        sha = await this.fetchGitHubPoolsSha(); // Fetch pools-v2.json sha from GitHub
      }

      if (sha === null) {
        logger.warn(`Failed to fetch pools-v2.json sha from ${this.poolsSource}`, this.tag);
        return;
      }

      logger.debug(`pools-v2.json sha | Current: ${this.currentSha} | ${this.poolsSource}: ${sha}`, this.tag);
      if (this.currentSha !== null && this.currentSha === sha) {
        logger.info('No new mining pools data available, skip update', this.tag);
        return;
      }

      // See backend README for more details about the mining pools update process
      if (
        this.currentSha !== null && // If we don't have any mining pool, download it at least once
        config.EXPLORER.AUTOMATIC_POOLS_UPDATE !== true && // Automatic pools update is disabled
        !process.env.npm_config_update_pools // We're not manually updating mining pool
      ) {
        logger.warn(`Updated mining pools data is available (${sha}) but AUTOMATIC_POOLS_UPDATE is disabled`, this.tag);
        logger.info(
          `You can update your mining pools using the --update-pools command flag. You may want to clear your nginx cache as well if applicable`,
          this.tag
        );
        return;
      }

      const network = config.SOCKS5PROXY.ENABLED ? 'tor' : 'clearnet';
      if (this.currentSha === null) {
        logger.info(`Downloading pools-v2.json for the first time from ${this.poolsUrl} over ${network}`, this.tag);
      } else {
        logger.warn(`pools-v2.json is outdated, fetching latest from ${this.poolsUrl} over ${network}`, this.tag);
      }
      const poolsJson = await this.query(this.poolsUrl);
      if (poolsJson === undefined) {
        return;
      }
      const stagedPools = poolsParser.prepareMiningPools(poolsJson);

      if (config.DATABASE.ENABLED === false) {
        poolsParser.miningPools = stagedPools;
        this.currentSha = sha;
        // Don't run db operations
        logger.info(`Mining pools-v2.json (${sha}) import completed (no database)`, this.tag);
        return;
      }

      const fromHeight = Math.max(0, (await BlocksRepository.$mostRecentBlockHeight()) - 10);
      this.migrating = true;
      try {
        await DB.$transaction(async (connection) => {
          await DB.query('DELETE FROM state WHERE name = ?', ['pools_json_sha'], 'debug', connection);
          await DB.query('INSERT INTO state VALUES(?, NULL, ?)', ['pools_json_sha', sha], 'debug', connection);
          await poolsParser.migratePoolsJson(connection, stagedPools, sha);
        });
      } catch (error) {
        this.pendingBlocks.clear();
        throw error;
      } finally {
        this.migrating = false;
      }
      // Indexing continues using the old definitions until the transaction has committed.
      poolsParser.miningPools = stagedPools;
      this.currentSha = sha;
      this.recheck = { sha, fromHeight };
      diskCache.setIgnoreBlocksCache();
      valkeyCache.setIgnoreBlocksCache();
      logger.info(`Mining pools-v2.json (${sha}) import completed`, this.tag);
    } catch (e) {
      // fast-forward lastRun to 10 minutes before the next scheduled update
      this.lastRun = now - Math.max(config.EXPLORER.POOLS_UPDATE_DELAY - 600, 600);
      logger.err(`PoolsUpdater failed. Will try again in 10 minutes. Exception: ${JSON.stringify(e)}`, this.tag);
    }
  }

  public trackPoolAttribution(pool: object): void {
    this.attributionShas.set(pool, this.currentSha);
  }

  public copyPoolAttribution(source: object, target: object): void {
    this.attributionShas.set(target, this.getAttributionSha(source));
  }

  public getAttributionSha(pool: object): string | null {
    return this.attributionShas.has(pool) ? this.attributionShas.get(pool)! : this.currentSha;
  }

  public trackIndexedBlock(hash: string, attributionSha: string | null): void {
    if (this.migrating || attributionSha !== this.currentSha) {
      this.pendingBlocks.add(hash);
      if (!this.migrating && this.currentSha && !this.recheck) {
        this.recheck = { sha: this.currentSha, fromHeight: Number.MAX_SAFE_INTEGER };
      }
    }
  }

  public async $recheckBlocks(): Promise<void> {
    if (!this.recheck) return;
    const pending = [...this.pendingBlocks].slice(0, 1000);
    for (const hash of pending) this.pendingBlocks.delete(hash);
    try {
      await poolsParser.$refreshStaleBlocks(this.recheck.sha, this.recheck.fromHeight, pending);
      if (!this.pendingBlocks.size) this.recheck = null;
    } catch (error) {
      for (const hash of pending) this.pendingBlocks.add(hash);
      logger.err(
        `Could not refresh mining pools; will retry: ${error instanceof Error ? error.message : error}`,
        this.tag
      );
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from the db
   */
  public async getShaFromDb(): Promise<string | null> {
    try {
      const [rows]: any[] = await DB.query('SELECT string FROM state WHERE name="pools_json_sha"');
      return rows.length > 0 ? rows[0].string : null;
    } catch (e) {
      logger.err('Cannot fetch pools-v2.json sha from db. Reason: ' + (e instanceof Error ? e.message : e), this.tag);
      return null;
    }
  }

  /**
   * Fetch our latest pools-v2.json sha from GitLab v4 API end point
   */
  private async fetchGitLabPoolsSha(): Promise<string | null> {
    const response = await this.query(this.treeUrl);

    if (response !== undefined) {
      for (const file of response) {
        if (file['name'] === 'pools-v2.json') {
          return file['id']; // id is the sha
        }
      }
    }

    logger.err(`Cannot find "pools-v2.json" in git tree (${this.treeUrl})`, this.tag);
    return null;
  }

  /**
   * Fetch our latest pools-v2.json sha from GitHub
   */
  private async fetchGitHubPoolsSha(): Promise<string | null> {
    const response = await this.query(this.treeUrl);

    if (response !== undefined) {
      for (const file of response['tree']) {
        if (file['path'] === 'pools-v2.json') {
          return file['sha'];
        }
      }
    }

    logger.err(`Cannot find "pools-v2.json" in git tree (${this.treeUrl})`, this.tag);
    return null;
  }

  /**
   * Http request wrapper
   */
  private async query(path): Promise<any[] | undefined> {
    type axiosOptions = {
      headers: {
        'User-Agent': string;
      };
      timeout: number;
      httpsAgent?: https.Agent;
    };
    const setDelay = (secs = 1): Promise<void> => new Promise((resolve) => setTimeout(() => resolve(), secs * 1000));
    const axiosOptions: axiosOptions = {
      headers: {
        'User-Agent':
          config.EXPLORER.USER_AGENT === 'explorer'
            ? `BCHExplorer/v${backendInfo.getBackendInfo().version}`
            : `${config.EXPLORER.USER_AGENT}`,
      },
      timeout: config.SOCKS5PROXY.ENABLED ? 30000 : 10000,
    };
    let retry = 0;

    while (retry < config.EXPLORER.EXTERNAL_MAX_RETRY) {
      try {
        const data: AxiosResponse = await axios.get(path, { ...axiosOptions, ...getSocksProxyOptions(retry) });
        if (data.statusText === 'error' || !data.data) {
          throw new Error(`Could not fetch data from ${path}, Error: ${data.status}`);
        }
        return data.data;
      } catch (e) {
        logger.err('Could not connect to Github. Reason: ' + (e instanceof Error ? e.message : e), this.tag);
        retry++;
      }
      await setDelay(config.EXPLORER.EXTERNAL_RETRY_INTERVAL);
    }
    return undefined;
  }
}

export default new PoolsUpdater();
