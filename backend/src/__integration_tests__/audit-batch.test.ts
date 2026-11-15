import DB from '../database';
import config from '../config';
import blocks from '../repositories/BlocksRepository';
import audits from '../repositories/BlocksAuditsRepository';
import prices from '../repositories/PricesRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool, insertTestBlock } from './test-helpers';

const hash = (i: number) => i.toString(16).padStart(64, '0');
const originalAudit = config.EXPLORER.AUDIT;
beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
}, 120000);
beforeEach(async () => {
  await cleanupTestData();
  config.EXPLORER.AUDIT = true;
});
afterEach(() => {
  jest.restoreAllMocks();
  config.EXPLORER.AUDIT = originalAudit;
});

it.each([0, 1, 100])('preserves pool results with %i rows and zero/one batch audit query', async (count) => {
  const poolId = await insertTestPool({ name: 'Fixture', slug: 'fixture' });
  for (let i = 1; i <= count; i++) {
    await insertTestBlock({ height: 800000 + i, hash: hash(i), poolId });
    if (i % 2)
      await DB.query(
        `INSERT INTO blocks_audits (time, hash, height, missing_txs, added_txs, match_rate, expected_fees, expected_size)
       VALUES (NOW(), ?, ?, '[]', '[]', 99, 1234, 2345678)`,
        [hash(i), 800000 + i]
      );
  }
  // A stale block must not enter the list, even at a greater height.
  await insertTestBlock({ height: 900000, hash: hash(999), poolId });
  await DB.query('UPDATE blocks SET stale = 1 WHERE hash = ?', [hash(999)]);
  await DB.query(
    'UPDATE blocks SET abla_block_size = 1000000, abla_block_size_limit = 32000000, abla_next_block_size_limit = 32000000'
  );
  const query = jest.spyOn(DB, 'query');
  const single = jest.spyOn(audits, '$getBlockAuditScore');
  const result = await blocks.$getBlocksByPool('fixture', 900000);
  const batchCalls = query.mock.calls.filter(([sql]) => String(sql).includes('FROM blocks_audits'));
  expect(batchCalls).toHaveLength(count ? 1 : 0);
  expect(single).not.toHaveBeenCalled();
  expect(result.map((b) => b.height)).toEqual(Array.from({ length: count }, (_, i) => 800000 + count - i));
  for (const block of result) {
    expect(block.extras.expectedSize).toBe(block.height % 2 ? 2345678 : null);
    expect(block.abla_state.block_size_limit).toBe(32000000);
  }
  const singleResults = await Promise.all(result.map((b) => blocks.$getBlockByHash(b.id)));
  expect(result).toEqual(singleResults);
  const poolQuery = query.mock.calls.find(([sql]) => String(sql).includes('FORCE INDEX (pool_stale_height)'))!;
  const [plan]: any = await DB.query('EXPLAIN ' + poolQuery[0], poolQuery[1]);
  expect(plan.find((p) => p.table === 'blocks').key).toBe('pool_stale_height');
  if (count) {
    // Make the selected hashes a small fraction of the audit table for EXPLAIN.
    const background = Array.from({ length: 2000 }, (_, i) => i + 2000);
    await DB.query(
      `INSERT INTO blocks_audits (time, hash, height, missing_txs, added_txs, match_rate) VALUES ${background.map(() => "(NOW(), ?, ?, '[]', '[]', 100)").join(',')}`,
      background.flatMap((i) => [hash(i), i])
    );
    const [auditPlan]: any = await DB.query('EXPLAIN ' + batchCalls[0][0], batchCalls[0][1]);
    expect(auditPlan[0].key).toBe('PRIMARY');
    console.log('Audit batch EXPLAIN', count, auditPlan);
  }
  query.mockClear();
  single.mockClear();
  config.EXPLORER.AUDIT = false;
  const disabled = await blocks.$getBlocksByPool('fixture');
  expect(disabled).toHaveLength(count);
  expect(query.mock.calls.filter(([sql]) => String(sql).includes('FROM blocks_audits'))).toHaveLength(0);
  expect(single).not.toHaveBeenCalled();
});

it('returns numeric timestamp membership from MariaDB', async () => {
  await DB.query(
    'INSERT INTO prices (time, USD) VALUES (FROM_UNIXTIME(1700000000), 100), (FROM_UNIXTIME(1700003600), 200)'
  );
  expect(await prices.$getPricesTimes()).toEqual(new Set([1700000000, 1700003600]));
});
