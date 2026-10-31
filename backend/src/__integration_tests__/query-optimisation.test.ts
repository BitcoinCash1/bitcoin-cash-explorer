import migration from '../api/database-migration';
import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import summaries from '../repositories/BlocksSummariesRepository';
import { setupTestDatabase, cleanupTestData, waitForDatabase } from './test-helpers';

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
  expect(version[0].number).toBe(111);
});
