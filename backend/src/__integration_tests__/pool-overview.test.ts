import cache from '../api/mining/pool-statistics-cache';
import blocks from '../repositories/BlocksRepository';
import audits from '../repositories/BlocksAuditsRepository';
import DB from '../database';
import config from '../config';
import pools from '../repositories/PoolsRepository';
import { cleanupTestData, insertTestPool, insertTestBlock, setupTestDatabase, waitForDatabase } from './test-helpers';

beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
}, 120000);
beforeEach(cleanupTestData);
afterAll(cleanupTestData);

async function audit(hash: string, height: number, fees: number, match: number) {
  const [columns]: any[] = await DB.query('SHOW COLUMNS FROM blocks_audits');
  const row: Record<string, unknown> = {};
  for (const column of columns) {
    if (column.Null === 'NO' && column.Default === null) {
      row[column.Field] = /timestamp|datetime/.test(column.Type)
        ? '2026-01-01 00:00:00'
        : /int|double|float|decimal/.test(column.Type)
          ? 0
          : '[]';
    }
  }
  Object.assign(row, { hash, height, expected_fees: fees, match_rate: match });
  await DB.query('INSERT INTO blocks_audits SET ?', [row]);
}

test('overview matches audits by hash, excludes stale blocks and preserves nullable averages', async () => {
  const pool = await insertTestPool({ name: 'Fixture', slug: 'fixture' });
  for (const [height, hash] of [
    [1, 'canonical'],
    [1, 'fork'],
    [2, 'missing'],
    [3, 'zero'],
  ] as const) {
    await insertTestBlock({ height, hash, poolId: pool });
  }
  await DB.query('UPDATE blocks SET fees = 50, blockTimestamp = NOW() - INTERVAL 1 HOUR');
  await DB.query("UPDATE blocks SET stale = 1 WHERE hash = 'fork'");
  await audit('canonical', 1, 100, 80);
  await audit('fork', 1, 1, 20);
  await audit('zero', 3, 0, 100);
  const rows = await pools.$getPoolsInfo('1m');
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].blockCount)).toBe(3);
  expect(Number(rows[0].avgMatchRate)).toBe(90);
  expect(Number(rows[0].avgFeeDelta)).toBe(-0.5);
  await DB.query('DELETE FROM blocks_audits');
  const [withoutAudits] = await pools.$getPoolsInfo('1m');
  expect(withoutAudits.avgMatchRate).toBeNull();
  expect(withoutAudits.avgFeeDelta).toBeNull();
});

test.each(['24h', '3d', '1w', '1m'])('overview filters date boundaries for %s', async (interval) => {
  const pool = await insertTestPool({ name: 'Fixture', slug: 'fixture' });
  await insertTestBlock({ height: 1, hash: 'recent', poolId: pool });
  await insertTestBlock({ height: 2, hash: 'old', poolId: pool });
  await insertTestBlock({ height: 3, hash: 'future', poolId: pool });
  await DB.query("UPDATE blocks SET blockTimestamp = NOW() - INTERVAL 1 HOUR WHERE hash='recent'");
  await DB.query("UPDATE blocks SET blockTimestamp = NOW() - INTERVAL 2 MONTH WHERE hash='old'");
  await DB.query("UPDATE blocks SET blockTimestamp = NOW() + INTERVAL 1 DAY WHERE hash='future'");
  expect(Number((await pools.$getPoolsInfo(interval))[0].blockCount)).toBe(1);
  expect(Number((await pools.$getPoolsInfo(null))[0].blockCount)).toBe(3);
  await DB.query('DELETE FROM blocks');
  expect(await pools.$getPoolsInfo(interval)).toEqual([]);
});

test('fee averages have stable precision with either index plan', async () => {
  const pool = await insertTestPool({ name: 'Precision', slug: 'precision' });
  for (let height = 1; height <= 12; height++) {
    const hash = `precision-${height}`;
    await insertTestBlock({ height, hash, poolId: pool });
    await audit(hash, height, 7 * height, 90);
  }
  await DB.query('UPDATE blocks SET fees=1, blockTimestamp=NOW() - INTERVAL 1 HOUR');
  const spy = jest.spyOn(DB, 'query');
  let query: string;
  try {
    await pools.$getPoolsInfo('1m');
    query = spy.mock.calls[0][0] as string;
  } finally {
    spy.mockRestore();
  }
  const [hinted]: any[] = await DB.query(query);
  const [unhinted]: any[] = await DB.query(query.replace('USE INDEX (blockTimestamp)', ''));
  expect(hinted).toEqual(unhinted);
  const expected =
    Array.from({ length: 12 }, (_, i) => (1 - 7 * (i + 1)) / (7 * (i + 1))).reduce((a, b) => a + b, 0) / 12;
  expect(Number(hinted[0].avgFeeDelta)).toBeCloseTo(expected, 4);
});

test('successful pool metadata and audit-summary writes invalidate cached statistics', async () => {
  const pool = await insertTestPool({ name: 'Before', slug: 'before' });
  await audit('audit', 1, 100, 90);
  const invalidate = jest.spyOn(cache, 'invalidate').mockResolvedValue();
  try {
    await pools.$renameMiningPool(pool, 'after', 'After');
    await pools.$updateMiningPoolLink(pool, 'https://example.com');
    await audits.$setSummary('audit', 200, 1000);
    expect(invalidate).toHaveBeenCalledTimes(3);
    const [rows]: any[] = await DB.query('SELECT name,link FROM pools WHERE id=?', [pool]);
    expect(rows[0]).toMatchObject({ name: 'After', link: 'https://example.com' });
  } finally {
    invalidate.mockRestore();
  }
});

test.each([
  ['24h', '1 DAY'],
  ['3d', '3 DAY'],
  ['1w', '1 WEEK'],
  ['1m', '1 MONTH'],
  ['3m', '3 MONTH'],
  ['6m', '6 MONTH'],
  ['1y', '1 YEAR'],
  ['2y', '2 YEAR'],
  ['3y', '3 YEAR'],
  ['4y', '4 YEAR'],
])(
  '%s overview preserves inclusive boundaries, empty counts and audit semantics',
  async (requestedInterval, sqlInterval) => {
    const first = await insertTestPool({ name: 'First', slug: 'first' });
    const second = await insertTestPool({ name: 'Second', slug: 'second' });
    const fixtures = [
      ['lower', '2025-11-11 12:00:00', first, 1],
      ['upper', '2026-11-11 12:00:00', first, 2],
      ['middle', '2026-06-01 00:00:00', first, 1],
      ['before', '2025-11-11 11:59:59', first, 1],
      ['after', '2026-11-11 12:00:01', first, 1],
      ['fork', '2026-06-01 00:00:00', first, 1],
      ['second', '2026-06-01 00:00:00', second, 2],
    ] as const;
    for (const [index, [hash, timestamp, poolId, tx_count]] of fixtures.entries()) {
      await insertTestBlock({ height: index + 1, hash, poolId, tx_count });
      await DB.query('UPDATE blocks SET blockTimestamp=?, fees=50 WHERE hash=?', [timestamp, hash]);
    }
    await DB.query(
      `UPDATE blocks SET blockTimestamp=DATE_SUB('2026-11-11 12:00:00', INTERVAL ${sqlInterval}) WHERE hash='lower'`
    );
    await DB.query(
      `UPDATE blocks SET blockTimestamp=DATE_SUB(DATE_SUB('2026-11-11 12:00:00', INTERVAL ${sqlInterval}), INTERVAL 1 SECOND) WHERE hash='before'`
    );
    await DB.query('UPDATE blocks SET blockTimestamp=? WHERE hash IN (?, ?, ?)', [
      '2026-11-11 11:59:59',
      'middle',
      'fork',
      'second',
    ]);
    await DB.query('UPDATE blocks SET stale=1 WHERE hash=?', ['fork']);
    await audit('lower', 1, 100, 80);
    await audit('upper', 2, 0, 100);
    await audit('fork', 6, 1, 20);

    await DB.$transaction(async (connection) => {
      await connection.query('SET timestamp = UNIX_TIMESTAMP(?)', ['2026-11-11 12:00:00']);
      const network = config.EXPLORER.NETWORK;
      const original = DB.query.bind(DB);
      const spy = jest
        .spyOn(DB, 'query')
        .mockImplementation((query, params) => original(query, params, 'debug', connection));
      try {
        const result = await pools.$getPoolsInfo(requestedInterval);
        expect(result.map((row) => [row.poolId, Number(row.blockCount)])).toEqual([
          [first, 3],
          [second, 1],
        ]);
        expect(Number(result[0].avgMatchRate)).toBe(90);
        expect(Number(result[0].avgFeeDelta)).toBe(-0.5);
        expect(result[1].avgMatchRate).toBeNull();
        expect(result[1].avgFeeDelta).toBeNull();
        const empty = await blocks.$countEmptyBlocks(null, requestedInterval);
        expect(empty.map((row) => [row.poolId, Number(row.count)])).toEqual([[first, 2]]);
        expect(
          spy.mock.calls.slice(0, 2).every(([query]) => String(query).includes('USE INDEX (blockTimestamp)'))
        ).toBe(true);
        await blocks.$countEmptyBlocks(first, requestedInterval);
        expect(String(spy.mock.calls.at(-1)![0])).not.toContain('USE INDEX');
        for (const interval of ['24h', '3d', '1w', '1m', '3m', '6m', '2y', '3y', '4y', 'all', null]) {
          await pools.$getPoolsInfo(interval);
          expect(String(spy.mock.calls.at(-1)![0]).includes('USE INDEX')).toBe(interval !== null && interval !== 'all');
          await blocks.$countEmptyBlocks(null, interval);
          expect(String(spy.mock.calls.at(-1)![0]).includes('USE INDEX')).toBe(interval !== null && interval !== 'all');
        }
        for (const otherNetwork of ['chipnet', 'testnet4'] as const) {
          config.EXPLORER.NETWORK = otherNetwork;
          await pools.$getPoolsInfo(requestedInterval);
          expect(String(spy.mock.calls.at(-1)![0])).toContain('USE INDEX (blockTimestamp)');
          await blocks.$countEmptyBlocks(null, requestedInterval);
          expect(String(spy.mock.calls.at(-1)![0])).toContain('USE INDEX (blockTimestamp)');
        }
      } finally {
        config.EXPLORER.NETWORK = network;
        spy.mockRestore();
        await connection.query('SET timestamp = DEFAULT');
      }
    });
  }
);
