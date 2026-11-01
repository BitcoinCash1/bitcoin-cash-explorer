import migration from '../api/database-migration';
import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import summaries from '../repositories/BlocksSummariesRepository';
import mining from '../api/mining/mining';
import bitcoinApi from '../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import { setupTestDatabase, cleanupTestData, waitForDatabase, insertTestPool } from './test-helpers';

beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
  config.EXPLORER.BLOCKS_SUMMARIES_INDEXING = true;
}, 120000);
beforeEach(cleanupTestData);
afterAll(cleanupTestData);

async function insert(height: number, hash: string, stale = 0) {
  // Use the migrated BCH schema, including required fields with no server default.
  const [columns]: any[] = await DB.query('SHOW COLUMNS FROM blocks');
  const row: Record<string, any> = {};
  for (const column of columns) {
    if (column.Null === 'NO' && column.Default === null) {
      row[column.Field] = /timestamp|datetime/.test(column.Type)
        ? '2026-10-30 00:00:00'
        : /int|double|float|decimal/.test(column.Type)
          ? 0
          : '';
    }
  }
  Object.assign(row, { height, hash, stale, blockTimestamp: '2026-10-30 00:00:00', fee_span: '[]', pool_id: null });
  await DB.query('INSERT INTO blocks SET ?', [row]);
}

test('missing summaries respect range, stale status, versions and keyset continuation', async () => {
  await insert(1, 'a');
  await insert(2, 'b');
  await insert(3, 'c', 1);
  await insert(4, 'd');
  await DB.query("INSERT INTO blocks_summaries (height,id,transactions,version) VALUES (1,'a','[]',1),(2,'b','[]',0)");
  expect((await summaries.$getMissingSummaries(1, 4)).map((r) => r.hash)).toEqual(['d', 'b']);
  expect((await summaries.$getMissingSummaries(1, 4, { height: 4, hash: 'd' })).map((r) => r.hash)).toEqual(['b']);
});

test('targeted price retries include only requested heights', async () => {
  await insert(1, 'a');
  await insert(2, 'b');
  expect(((await blocks.$getBlocksWithoutPrice([2])) as any[]).map((r) => r.height)).toEqual([2]);
  expect(await blocks.$getBlocksWithoutPrice([])).toEqual([]);
});

test('missing summaries paginate beyond one batch without skipping equal-height hashes', async () => {
  for (let height = 1; height <= 1001; height++) await insert(height, String(height).padStart(64, '0'));
  await insert(1, 'z'.repeat(64));
  const first = await summaries.$getMissingSummaries(0, 2000);
  expect(first).toHaveLength(1000);
  const second = await summaries.$getMissingSummaries(0, 2000, first[first.length - 1]);
  expect(second).toHaveLength(2);
  expect(new Set([...first, ...second].map((row) => row.hash)).size).toBe(1002);
}, 15000);

test('summary covering index migration can resume after DDL completed before version update', async () => {
  await DB.query("UPDATE state SET number = 110 WHERE name = 'schema_version'");
  await migration.$initializeOrMigrateDatabase();
  const [parts]: any[] = await DB.query(`SELECT COLUMN_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blocks_summaries' AND INDEX_NAME = 'id_version'
    ORDER BY SEQ_IN_INDEX`);
  expect(parts.map((row: any) => row.COLUMN_NAME)).toEqual(['id', 'version']);
  const [version]: any[] = await DB.query("SELECT number FROM state WHERE name = 'schema_version'");
  expect(version[0].number).toBe(112);
});

test('the real difficulty boundary backfills missing daily and weekly hashrate rows', async () => {
  const poolId = await insertTestPool({ id: 1, name: 'Fixture', slug: 'fixture' });
  const oldestTime = Math.floor(Date.now() / 1000) - 15 * 86400;
  const originalAmount = config.EXPLORER.INDEXING_BLOCKS_AMOUNT;
  const originalDaily = mining.lastHashrateIndexingDate;
  const originalWeekly = mining.lastWeeklyHashrateIndexingDate;
  jest.spyOn(bitcoinApi, '$getBlockHash').mockResolvedValue('genesis');
  jest.spyOn(bitcoinApi, '$getBlock').mockResolvedValue({
    timestamp: oldestTime - 86400,
    difficulty: 1,
    bits: 486604799,
  } as never);
  jest.spyOn(bitcoinClient, 'getNetworkHashPs').mockResolvedValue(100);
  try {
    config.EXPLORER.INDEXING_BLOCKS_AMOUNT = 100;
    mining.lastHashrateIndexingDate = null;
    mining.lastWeeklyHashrateIndexingDate = null;
    for (let height = 1; height <= 3; height++) {
      await insert(height, `history-${height}`);
      await DB.query(
        'UPDATE blocks SET blockTimestamp = FROM_UNIXTIME(?), pool_id = ?, difficulty = 1, bits = 486604799 WHERE height = ?',
        [oldestTime + (height - 1) * 7 * 86400, poolId, height]
      );
    }
    const boundary = await mining.$indexDifficultyAdjustments();
    expect(Number(boundary?.timestamp)).toBe(oldestTime);
    await mining.$generateNetworkHashrateHistory(boundary);
    await mining.$generatePoolHashrateHistory(boundary);
    const [rows]: any[] = await DB.query(
      'SELECT type, COUNT(*) AS count, MIN(avg_hashrate) AS minimum FROM hashrates GROUP BY type'
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'daily', count: expect.any(Number) }),
        expect.objectContaining({ type: 'weekly', minimum: 100 }),
      ])
    );
    expect(rows.every((row) => row.count > 0)).toBe(true);
  } finally {
    jest.restoreAllMocks();
    config.EXPLORER.INDEXING_BLOCKS_AMOUNT = originalAmount;
    mining.lastHashrateIndexingDate = originalDaily;
    mining.lastWeeklyHashrateIndexingDate = originalWeekly;
  }
});
