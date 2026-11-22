import DB from '../database';
import statistics from '../api/statistics/statistics-api';
import { backfillBatch, historyQuery, verifyBuckets } from '../api/statistics/statistics-buckets';
import { setupTestDatabase } from './test-helpers';

const base = 1728000000;
async function history(width: number, start: number, end: number, timesOnly = false) {
  const { sql, params } = historyQuery(width, start, end, timesOnly);
  const [rows]: any[] = await DB.query(sql, params);
  return rows;
}

beforeAll(setupTestDatabase, 120000);

async function clearFixture() {
  await DB.query('DELETE FROM statistics_buckets');
  await DB.query('DELETE FROM statistics');
  await DB.query(
    `UPDATE state SET number=0 WHERE name IN ('statistics_bucket_limit','statistics_bucket_cursor','statistics_bucket_reads')`
  );
}
beforeEach(clearFixture);
afterAll(clearFixture);

test('resumed backfill and late samples preserve averages, sampled bands and replication slot times', async () => {
  const id = await statistics.$createZeroedStatistic();
  expect(id).toBeDefined();
  // Simulate a pre-upgrade row, with a later timestamp than the replicated row.
  await DB.query('DELETE FROM statistics_buckets');
  await DB.query('UPDATE statistics SET added=FROM_UNIXTIME(?), size_1=10, min_fee=NULL WHERE id=?', [base + 1200, id]);
  await DB.query(`UPDATE state SET number=? WHERE name='statistics_bucket_limit'`, [id]);

  await DB.query(`UPDATE state SET number=? WHERE name='statistics_bucket_cursor'`, [id! - 1]);
  const zero = await statistics.$get(id!);
  const late = statistics.mapOptimizedStatisticToStatistic([
    { ...zero!, added: String(base + 60), min_fee: 3, sizes: Array(39).fill(20) },
  ])[0];
  expect(await statistics.$create(late, true)).toBeDefined();
  expect(await statistics.$create(late, true)).toBeDefined();
  expect(await backfillBatch()).toBe(true);
  expect(await backfillBatch()).toBe(false);
  expect(await history(1800, base, base + 1799)).toEqual([
    expect.objectContaining({ added: base + 1200, size_1: 50 / 3, min_fee: 3 }),
  ]);
  expect(await history(28800, base, base + 28799)).toEqual([
    expect.objectContaining({ added: base + 1200, size_1: 10, min_fee: 3 }),
  ]);
  expect(await history(1800, base, base + 1799, true)).toEqual([{ added: base + 60 }]);
  expect(await history(1800, base + 1200, base + 1800)).toEqual([
    expect.objectContaining({ added: base + 1200, size_1: 10, min_fee: null }),
  ]);
  expect(await history(1800, base + 61, base + 1199)).toEqual([]);

  await DB.query(`UPDATE state SET number=1 WHERE name='statistics_bucket_reads'`);
  expect(await verifyBuckets()).toBe(5);
  const all = await statistics.$listAll();
  expect(all).toHaveLength(1);
  expect(all[0].sizes[1]).toBe(10);
});

test('a failed backfill batch resumes from the last committed ID', async () => {
  const first = (await statistics.$createZeroedStatistic())!;
  const second = (await statistics.$createZeroedStatistic())!;
  await DB.query('UPDATE statistics SET id=? WHERE id=?', [second + 4096, second]);
  await DB.query('UPDATE statistics SET added=FROM_UNIXTIME(?)', [base]);
  await DB.query('DELETE FROM statistics_buckets');
  await DB.query(`UPDATE state SET number=? WHERE name='statistics_bucket_limit'`, [second + 4096]);
  await DB.query(`UPDATE state SET number=? WHERE name='statistics_bucket_cursor'`, [first - 1]);
  expect(await backfillBatch()).toBe(true);
  await DB.query(`CREATE TRIGGER interrupt_batch BEFORE UPDATE ON statistics_buckets FOR EACH ROW
    BEGIN IF NEW.bucket_seconds = 7200 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='batch interrupted'; END IF; END`);
  try {
    await expect(backfillBatch()).rejects.toThrow('batch interrupted');
  } finally {
    await DB.query('DROP TRIGGER interrupt_batch');
  }
  expect(await backfillBatch()).toBe(true);
  expect(await backfillBatch()).toBe(false);
  const [counts] = await DB.query(
    'SELECT bucket_seconds,SUM(sample_count) AS total FROM statistics_buckets GROUP BY bucket_seconds'
  );
  expect((counts as { total: string }[]).map((row) => Number(row.total))).toEqual([2, 2, 2, 2, 2]);
});

test('a bucket write failure rolls back the raw sample', async () => {
  await DB.query(
    `CREATE TRIGGER reject_bucket BEFORE INSERT ON statistics_buckets FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='rejected bucket'`
  );
  try {
    expect(await statistics.$createZeroedStatistic()).toBeUndefined();
    const [rows] = await DB.query('SELECT id FROM statistics');
    expect(rows).toEqual([]);
  } finally {
    await DB.query('DROP TRIGGER reject_bucket');
  }
});
