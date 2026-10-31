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

test('counts indexed canonical rows rather than assuming a contiguous chain', async () => {
  await insert(0, 'a');
  await insert(2, 'b');
  await insert(2, 'c', 1);
  expect(await blocks.$blockCount(null)).toBe(2);
  expect(await blocks.$blockCountBetweenHeight(2, 0)).toBe(2);
});

test('summary tip skips stale and old-version summaries and returns null when empty', async () => {
  expect(await summaries.$getTipIndexed()).toBeNull();
  await insert(1, 'a');
  await insert(2, 'b');
  await insert(3, 'c', 1);
  await DB.query(
    "INSERT INTO blocks_summaries (height,id,transactions,version) VALUES (1,'a','[]',1),(2,'b','[]',0),(3,'c','[]',1)"
  );
  expect(await summaries.$getTipIndexed()).toBe(1);
});
