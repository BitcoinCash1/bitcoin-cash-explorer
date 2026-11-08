import { PoolConnection } from 'mysql2/promise';
import poolStatisticsCache from './mining/pool-statistics-cache';
import DB from '../database';
import logger from '../logger';
import config from '../config';
import PoolsRepository from '../repositories/PoolsRepository';
import { PoolTag } from '../mempool.interfaces';
import diskCache from './disk-cache';
import transactionUtils from './transaction-utils';
import BlocksRepository from '../repositories/BlocksRepository';
import valkeyCache from './valkey-cache';
import blocks from './blocks';

class PoolsParser {
  miningPools: any[] = [];
  unknownPool: any = {
    id: 0,
    name: 'Unknown',
    link: 'https://learnmeabitcoin.com/technical/coinbase-transaction',
    regexes: '[]',
    addresses: '[]',
    slug: 'unknown',
  };

  public prepareMiningPools(pools): any[] {
    pools = structuredClone(pools);
    for (const pool of pools) {
      pool.regexes = pool.tags;
      pool.slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
      delete pool.tags;
    }
    return pools;
  }

  public setMiningPools(pools): void {
    this.miningPools = this.prepareMiningPools(pools);
  }

  /**
   * Populate our db with updated mining pool definition
   * @param pools
   */
  public async migratePoolsJson(connection: PoolConnection, pools: any[], sha: string): Promise<boolean> {
    await this.$insertUnknownPool(connection);

    let reindexUnknown = false;
    let clearCache = false;

    for (const pool of pools) {
      if (!pool.id) {
        logger.info(`Mining pool ${pool.name} has no unique 'id' defined. Skipping.`);
        continue;
      }

      // One of the two fields 'addresses' or 'regexes' must be a non-empty array
      if (!pool.addresses && !pool.regexes) {
        logger.err(`Mining pool ${pool.name} must have at least one of the fields 'addresses' or 'regexes'. Skipping.`);
        continue;
      }

      pool.addresses = pool.addresses || [];
      pool.regexes = pool.regexes || [];

      if (pool.addresses.length === 0 && pool.regexes.length === 0) {
        logger.err(`Mining pool ${pool.name} has no 'addresses' nor 'regexes' defined. Skipping.`);
        continue;
      }

      if (pool.addresses.length === 0) {
        logger.warn(`Mining pool ${pool.name} has no 'addresses' defined.`);
      }

      if (pool.regexes.length === 0) {
        logger.warn(`Mining pool ${pool.name} has no 'regexes' defined.`);
      }

      const poolDB = await PoolsRepository.$getPoolByUniqueId(pool.id, false, connection);
      if (!poolDB) {
        // New mining pool
        const slug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
        logger.debug(`Inserting new mining pool ${pool.name}`);
        await PoolsRepository.$insertNewMiningPool(pool, slug, connection);
        reindexUnknown = true;
        clearCache = true;
      } else {
        if (poolDB.name !== pool.name) {
          // Pool has been renamed
          const newSlug = pool.name.replace(/[^a-z0-9]/gi, '').toLowerCase();
          logger.warn(
            `Renaming ${poolDB.name} mining pool to ${pool.name}. Slug has been updated. Maybe you want to make a redirection from 'https://bchexplorer.cash/mining/pool/${poolDB.slug}' to 'https://bchexplorer.cash/mining/pool/${newSlug}`
          );
          await PoolsRepository.$renameMiningPool(poolDB.id, newSlug, pool.name, connection);
          clearCache = true;
        }
        if (poolDB.link !== pool.link) {
          // Pool link has changed
          logger.debug(`Updating link for ${pool.name} mining pool`);
          await PoolsRepository.$updateMiningPoolLink(poolDB.id, pool.link, connection);
          clearCache = true;
        }
        if (JSON.stringify(pool.addresses) !== poolDB.addresses || JSON.stringify(pool.regexes) !== poolDB.regexes) {
          // Pool addresses changed or coinbase tags changed
          logger.notice(`Updating addresses and/or coinbase tags for ${pool.name} mining pool.`);
          await PoolsRepository.$updateMiningPoolTags(poolDB.id, pool.addresses, pool.regexes, connection);
          reindexUnknown = true;
          clearCache = true;
          await this.$reindexBlocksForPool(poolDB.id, connection, sha);
        }
      }
    }

    if (reindexUnknown) {
      logger.notice(`Updating addresses and/or coinbase tags for unknown mining pool.`);
      let unknownPool;
      if (config.DATABASE.ENABLED === true) {
        unknownPool = await PoolsRepository.$getUnknownPool(connection);
      } else {
        unknownPool = this.unknownPool;
      }
      await this.$reindexBlocksForPool(unknownPool.id, connection, sha);
    }

    return clearCache;
  }

  public async $refreshStaleBlocks(sha: string, fromHeight: number, pendingHashes: string[] = []): Promise<void> {
    const [rows]: any[] = await DB.query(
      'SELECT hash, pool_id, coinbase_raw, coinbase_addresses FROM blocks WHERE height >= ?' +
        (pendingHashes.length ? ' OR hash IN (?)' : ''),
      pendingHashes.length ? [fromHeight, pendingHashes] : [fromHeight]
    );
    await DB.$transaction((connection) => this.$reassignBlocks(rows, connection, sha, true));
    await poolStatisticsCache.invalidate(true);
    diskCache.setIgnoreBlocksCache();
    valkeyCache.setIgnoreBlocksCache();
    for (const block of blocks.getBlocks()) {
      const reindexedBlock = await blocks.$indexBlock(block.id);
      block.extras.pool = reindexedBlock.extras.pool;
    }
    await diskCache.$saveCacheToDisk(false, true);
    await valkeyCache.$updateBlocks(blocks.getBlocks(), true);
  }

  public matchBlockMiner(scriptsig: string, addresses: string[], pools: PoolTag[]): PoolTag | undefined {
    const asciiScriptSig = transactionUtils.hex2ascii(scriptsig);

    for (let i = 0; i < pools.length; ++i) {
      if (addresses.length) {
        const poolAddresses: string[] =
          typeof pools[i].addresses === 'string' ? JSON.parse(pools[i].addresses) : pools[i].addresses;
        for (let y = 0; y < poolAddresses.length; y++) {
          if (addresses.indexOf(poolAddresses[y]) !== -1) {
            return pools[i];
          }
        }
      }

      const regexes: string[] = typeof pools[i].regexes === 'string' ? JSON.parse(pools[i].regexes) : pools[i].regexes;
      for (let y = 0; y < regexes.length; ++y) {
        const regex = new RegExp(regexes[y], 'i');
        const match = asciiScriptSig.match(regex);
        if (match !== null) {
          return pools[i];
        }
      }
    }
  }

  /**
   * Manually add the 'unknown pool'
   */
  public async $insertUnknownPool(connection?: PoolConnection): Promise<void> {
    if (!config.DATABASE.ENABLED) {
      return;
    }

    try {
      const [rows]: any[] = await DB.query(
        {
          sql: 'SELECT name from pools where name="Unknown"',
          timeout: 120000,
        },
        undefined,
        'debug',
        connection
      );
      if (rows.length === 0) {
        await DB.query(
          {
            sql: `INSERT INTO pools(name, link, regexes, addresses, slug, unique_id)
          VALUES("${this.unknownPool.name}", "${this.unknownPool.link}", "[]", "[]", "${this.unknownPool.slug}", 0);
        `,
          },
          undefined,
          'debug',
          connection
        );
      } else {
        await DB.query(
          `UPDATE pools
          SET name='${this.unknownPool.name}', link='${this.unknownPool.link}',
          regexes='[]', addresses='[]',
          slug='${this.unknownPool.slug}',
          unique_id=0
          WHERE slug='${this.unknownPool.slug}'
        `,
          undefined,
          'debug',
          connection
        );
      }
      if (!connection) await poolStatisticsCache.invalidate();
    } catch (e) {
      if (connection) throw e;
      logger.err(`Unable to insert or update "Unknown" mining pool. Reason: ${e instanceof Error ? e.message : e}`);
    }
  }

  /**
   * re-index pool assignment for blocks previously associated with pool
   *
   * @param pool local id of existing pool to reindex
   */
  private async $reindexBlocksForPool(poolId: number, connection: PoolConnection, sha: string): Promise<void> {
    let firstKnownBlockPool = 130635; // https://bchexplorer.cash/block/00000000000009c4cdccbc49e72552a732fbbcad97391207d4606186e9e6d899
    if (config.EXPLORER.NETWORK === 'testnet4') {
      firstKnownBlockPool = 21106; // https://mempool.space/testnet/block/0000000070b701a5b6a1b965f6a38e0472e70b2bb31b973e4638dec400877581
    } else if (config.EXPLORER.NETWORK === 'scalenet') {
      firstKnownBlockPool = 16869; // https://docs.bitcoincashnode.org/doc/test-networks/
    } else if (['chipnet'].includes(config.EXPLORER.NETWORK)) {
      firstKnownBlockPool = 0;
    }

    const [blocks]: any[] = await DB.query(
      `
      SELECT height, hash, pool_id, coinbase_raw, coinbase_addresses
      FROM blocks
      WHERE pool_id = ?
      AND height >= ?
      ORDER BY height DESC
    `,
      [poolId, firstKnownBlockPool],
      'debug',
      connection
    );

    await this.$reassignBlocks(blocks, connection, sha);
  }

  private async $reassignBlocks(
    blocks: any[],
    connection: PoolConnection | undefined,
    sha: string,
    stampUnchanged = false
  ): Promise<void> {
    let pools: PoolTag[] = [];
    if (config.DATABASE.ENABLED === true) {
      pools = await PoolsRepository.$getPools(connection);
    } else {
      pools = this.miningPools;
    }

    const unknownPool = await PoolsRepository.$getUnknownPool(connection);
    let changed = 0;
    for (const block of blocks) {
      const addresses = JSON.parse(block.coinbase_addresses) || [];
      const newPool = this.matchBlockMiner(block.coinbase_raw, addresses, pools) || unknownPool;
      if (newPool && (stampUnchanged || newPool.id !== block.pool_id)) {
        if (newPool.id !== block.pool_id) changed++;
        await BlocksRepository.$savePool(block.hash, newPool.id, connection, sha);
      }
    }

    logger.info(`${changed} blocks assigned to a new pool`, logger.tags.mining);

    // Re-index hashrates later
    // Note: Disable for now, as it's causing incorrectly re-indexing hashrates (specifically the daily hashrate)
    // mining.reindexHashrateRequested = true;
  }
}

export default new PoolsParser();
