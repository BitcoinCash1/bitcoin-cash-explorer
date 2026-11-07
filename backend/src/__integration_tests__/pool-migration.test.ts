import DB from '../database';
import config from '../config';
import parser from '../api/pools-parser';
import updater from '../tasks/pools-updater';
import repository from '../repositories/PoolsRepository';
import blocks from '../api/blocks';
import diskCache from '../api/disk-cache';
import valkey from '../api/valkey-cache';
import statisticsCache from '../api/mining/pool-statistics-cache';
import { cleanupTestData, insertTestPool, insertTestBlock, setupTestDatabase } from './test-helpers';

beforeAll(setupTestDatabase, 120000);
beforeEach(async () => {
  await cleanupTestData();
  await DB.query("DELETE FROM state WHERE name = 'pools_json_sha'");
  await DB.query("INSERT INTO state VALUES('pools_json_sha',NULL,'old')");
  Object.assign(config.EXPLORER, { ENABLED: true, NETWORK: 'mainnet', AUTOMATIC_POOLS_UPDATE: true });
  Object.assign(updater as any, { lastRun: 0, currentSha: 'old', recheck: null, migrating: false });
  (updater as any).pendingBlocks.clear();
  parser.miningPools = [{ name: 'Old published' }];
  jest.spyOn(blocks, 'getBlocks').mockReturnValue([]);
  jest.spyOn(diskCache, '$saveCacheToDisk').mockResolvedValue();
  jest.spyOn(valkey, '$updateBlocks').mockResolvedValue();
});
afterEach(() => jest.restoreAllMocks());
afterAll(cleanupTestData);

async function seed() {
  const poolId = await insertTestPool({ name: 'Old', slug: 'old', id: 1 });
  await DB.query('UPDATE pools SET regexes = ?, addresses = ?, link = ? WHERE id = ?', ['["OLD"]', '[]', '', poolId]);
  await insertTestBlock({ height: 200000, hash: 'old-block', poolId });
  await DB.query('UPDATE blocks SET coinbase_raw = ?, coinbase_addresses = ?, definition_hash = ?', [
    Buffer.from('OLD').toString('hex'),
    '[]',
    'old',
  ]);
  return poolId;
}
function fetchPools() {
  updater.poolsSource = 'gitlab';
  jest
    .spyOn(updater as any, 'query')
    .mockResolvedValueOnce([{ name: 'pools-v2.json', id: 'new' }])
    .mockResolvedValueOnce([
      { id: 1, name: 'Renamed', link: '', addresses: [], tags: ['NEW'] },
      { id: 2, name: 'Inserted', link: '', addresses: [], tags: ['INSERTED'] },
    ]);
}

test.each([0, 10000])(
  'rolls back state, pool mutations and block assignments on one connection with TIMEOUT=%i',
  async (timeout) => {
    const previousTimeout = config.DATABASE.TIMEOUT;
    config.DATABASE.TIMEOUT = timeout;
    try {
      await seed();
      fetchPools();
      const invalidate = jest.spyOn(statisticsCache, 'invalidate');
      const originalInsert = repository.$insertNewMiningPool.bind(repository);
      jest.spyOn(repository, '$insertNewMiningPool').mockImplementation(async (...args) => {
        await originalInsert(...args);
        throw new Error('injected failure after reassignment and insertion');
      });
      await updater.updatePoolsJson();
      const [pools]: any[] = await DB.query('SELECT name FROM pools ORDER BY id');
      expect(pools.map((p) => p.name)).toEqual(['Old']);
      const [rows]: any[] = await DB.query('SELECT definition_hash, pool_id FROM blocks');
      const [sha]: any[] = await DB.query("SELECT string FROM state WHERE name='pools_json_sha'");
      expect(rows[0].definition_hash).toBe('old');
      expect(sha[0].string).toBe('old');
      expect(updater.currentSha).toBe('old');
      expect(parser.miningPools).toEqual([{ name: 'Old published' }]);
      expect(invalidate).not.toHaveBeenCalled();
    } finally {
      config.DATABASE.TIMEOUT = previousTimeout;
    }
  }
);

test('commits tag removal to Unknown and repairs old-generation tip and historical saves without a chain scan', async () => {
  const poolId = await seed();
  const unrelatedPool = await insertTestPool({ id: 3, name: 'Unchanged', slug: 'unchanged', regexes: '["UNCHANGED"]' });
  fetchPools();
  let racingSave: Promise<void>;
  const migrate = parser.migratePoolsJson.bind(parser);
  jest.spyOn(parser, 'migratePoolsJson').mockImplementation(async (...args) => {
    const result = await migrate(...args);
    expect(updater.currentSha).toBe('old');
    expect(parser.miningPools).toEqual([{ name: 'Old published' }]);
    const [visible]: any[] = await DB.query('SELECT name FROM pools WHERE unique_id=1');
    expect(visible[0].name).toBe('Old');
    // Issue the concurrent insert before commit. InnoDB may defer it behind migration locks.
    racingSave = (async () => {
      await insertTestBlock({ height: 200001, hash: 'racing-tip', poolId: unrelatedPool });
      await DB.query(
        "UPDATE blocks SET coinbase_raw=?, coinbase_addresses='[]', definition_hash='new' WHERE hash='racing-tip'",
        [Buffer.from('INSERTED').toString('hex')]
      );
      updater.trackIndexedBlock('racing-tip', 'old');
    })();
    return result;
  });
  await updater.updatePoolsJson();
  await racingSave!;
  const [pools]: any[] = await DB.query('SELECT id, name FROM pools ORDER BY id');
  const unknown = pools.find((p) => p.name === 'Unknown');
  let [rows]: any[] = await DB.query("SELECT pool_id, definition_hash FROM blocks WHERE hash='old-block'");
  expect(rows[0]).toEqual({ pool_id: unknown.id, definition_hash: 'new' });
  // Emulate a block whose attribution was computed before commit but persisted later.
  await insertTestBlock({ height: 1, hash: 'late-historical', poolId });
  await DB.query(
    "UPDATE blocks SET coinbase_raw=?, coinbase_addresses='[]', definition_hash='old' WHERE hash='late-historical'",
    [Buffer.from('INSERTED').toString('hex')]
  );
  updater.trackIndexedBlock('late-historical', 'old');
  await updater.$recheckBlocks();
  [rows] = await DB.query("SELECT pool_id, definition_hash FROM blocks WHERE hash='late-historical'");
  expect(rows[0]).toEqual({ pool_id: pools.find((p) => p.name === 'Inserted').id, definition_hash: 'new' });
  expect((updater as any).recheck).toBeNull();
  const [tip]: any[] = await DB.query("SELECT pool_id FROM blocks WHERE hash='racing-tip'");
  expect(tip[0].pool_id).toBe(pools.find((p) => p.name === 'Inserted').id);
  // A save completing after the first repair is still queued by its pinned attribution SHA.
  await DB.query("UPDATE blocks SET pool_id=?, definition_hash='old' WHERE hash='late-historical'", [poolId]);
  updater.trackIndexedBlock('late-historical', 'old');
  await updater.$recheckBlocks();
  const [late]: any[] = await DB.query("SELECT pool_id FROM blocks WHERE hash='late-historical'");
  expect(late[0].pool_id).toBe(pools.find((p) => p.name === 'Inserted').id);
});
