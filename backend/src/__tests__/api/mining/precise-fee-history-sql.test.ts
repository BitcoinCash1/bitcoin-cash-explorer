import { createConnection, Connection } from 'mysql2/promise';
import DB from '../../../database';
import repository from '../../../repositories/BlocksRepository';

// Opt-in integration against an isolated MariaDB instance; never the configured application database.
const sqlDescribe = process.env.FEE_HISTORY_DB_PORT ? describe : describe.skip;
sqlDescribe('precise fee history on MariaDB', () => {
  let connection: Connection;
  beforeAll(async () => {
    connection = await createConnection({
      host: '127.0.0.1',
      port: Number(process.env.FEE_HISTORY_DB_PORT),
      user: 'root',
    });
    await connection.query('CREATE DATABASE IF NOT EXISTS fee_history_test');
    await connection.query('USE fee_history_test');
    await connection.query(
      'CREATE TEMPORARY TABLE blocks (height INT, blockTimestamp DATETIME, fee_span JSON, stale TINYINT)'
    );
    for (const [height, rate, stale] of [
      [1, 0, 0],
      [2, 0.001, 0],
      [3, 0.125, 0],
      [4, 1.999, 0],
      [5, 999, 1],
    ]) {
      await connection.query('INSERT INTO blocks VALUES (?, NOW(), ?, ?)', [
        height,
        JSON.stringify(Array(7).fill(rate)),
        stale,
      ]);
    }
    jest.spyOn(DB, 'query').mockImplementation((query: any) => connection.query(query) as any);
  });
  afterAll(async () => {
    jest.restoreAllMocks();
    await connection?.end();
  });

  test('numeric precise output retains fractions and excludes stale rows before averaging', async () => {
    const rows = await repository.$getHistoricalBlockFeeRates(10000000000, null, true);
    expect(rows).toHaveLength(1);
    expect(rows[0].avgFee_50).toBe(0.531);
    expect(typeof rows[0].avgFee_50).toBe('number');
    expect(Object.values(rows[0]).every((value) => typeof value === 'number')).toBe(true);
  });

  test('legacy integer mode preserves its SQL rounding contract', async () => {
    const rows = await repository.$getHistoricalBlockFeeRates(10000000000, null);
    expect(rows[0].avgFee_50).toBe(1);
  });

  test('missing percentile values stay null rather than becoming fabricated zero fees', async () => {
    await connection.query('INSERT INTO blocks VALUES (6, DATE_SUB(NOW(), INTERVAL 1 DAY), ?, 0)', [
      JSON.stringify(Array(7).fill(null)),
    ]);
    const rows = await repository.$getHistoricalBlockFeeRates(1, null, true);
    expect(rows.find((row) => row.avgHeight === 6).avgFee_50).toBeNull();
  });
});
