import DB from '../database';
import blocks from '../repositories/BlocksRepository';
import { cleanupTestData, insertTestPool, insertTestBlock, setupTestDatabase, waitForDatabase } from './test-helpers';

beforeAll(async () => {
  await waitForDatabase();
  await setupTestDatabase();
}, 120000);
beforeEach(cleanupTestData);
afterAll(cleanupTestData);

test('pool aggregate preserves counts and rewards while excluding stale blocks', async () => {
  const pool = await insertTestPool({ name: 'Test', slug: 'test' });
  await insertTestBlock({ height: 1, hash: 'a', poolId: pool });
  await insertTestBlock({ height: 2, hash: 'b', poolId: pool });
  await insertTestBlock({ height: 2, hash: 'c', poolId: pool });
  await DB.query("UPDATE blocks SET stale = 1 WHERE hash = 'c'");
  await DB.query('UPDATE blocks SET reward = 5000000000');
  const result = await blocks.$poolStatisticsCounts(pool);
  expect(Number(result.allCount)).toBe(await blocks.$blockCount(pool));
  expect(Number(result.dayCount)).toBe(await blocks.$blockCount(pool, '24h'));
  expect(Number(result.weekCount)).toBe(await blocks.$blockCount(pool, '1w'));
  expect(result.totalReward).toBe(await blocks.$getTotalRewardForPoolId(pool));
  const network = await blocks.$networkStatisticsCounts();
  expect(Number(network.dayCount)).toBe(await blocks.$blockCount(null, '24h'));
  expect(Number(network.weekCount)).toBe(await blocks.$blockCount(null, '1w'));
});

test('empty aggregates preserve zero-count and nullable sum semantics', async () => {
  const result = await blocks.$poolStatisticsCounts(9999);
  expect(Number(result.allCount)).toBe(0);
  expect(Number(result.dayCount)).toBe(0);
  expect(Number(result.weekCount)).toBe(0);
  expect(result.totalReward).toBeNull();
});
