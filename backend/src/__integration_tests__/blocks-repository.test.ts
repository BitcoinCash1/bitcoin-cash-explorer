import DB from '../database';
import BlocksRepository from '../repositories/BlocksRepository';
import { setupTestDatabase, waitForDatabase, cleanupTestData, insertTestPool, insertTestBlock } from './test-helpers';

describe('BlocksRepository Integration Tests', () => {
  let defaultPoolId: number;

  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  beforeEach(async () => {
    await cleanupTestData();
    // Create a default pool for all blocks
    defaultPoolId = await insertTestPool({
      name: 'Unknown',
      slug: 'unknown',
      addresses: '[]',
      regexes: '[]',
    });
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  test('should insert and retrieve a block', async () => {
    const blockHash = '00000000000000000001a0e3e9b2e6d6e8a4b0e9b2e6d6e8a4b0e9b2e6d6e8a4';
    const height = 800000;

    await insertTestBlock({
      height: height,
      hash: blockHash,
      blockTimestamp: new Date('2023-07-16T00:00:00Z'),
      size: 1500000,
      tx_count: 3000,
      difficulty: 53911173001054.59,
      poolId: defaultPoolId,
    });

    const block = await BlocksRepository.$getBlockByHeight(height);

    expect(block).toBeDefined();
    expect(block!.height).toBe(height);
    expect(block!.id).toBe(blockHash);
  });

  test('should get block by hash', async () => {
    const blockHash = '00000000000000000002b0e3e9b2e6d6e8a4b0e9b2e6d6e8a4b0e9b2e6d6e8a4';
    const height = 800001;

    await insertTestBlock({
      height: height,
      hash: blockHash,
      tx_count: 2500,
      poolId: defaultPoolId,
    });

    const block = await BlocksRepository.$getBlockByHash(blockHash);

    expect(block).toBeDefined();
    expect(block!.id).toBe(blockHash);
    expect(block!.height).toBe(height);
  });

  test('should handle non-existent block', async () => {
    const block = await BlocksRepository.$getBlockByHeight(999999);
    expect(block).toBeNull();
  });

  test('should check for missing blocks in range', async () => {
    // Insert blocks with a gap
    await insertTestBlock({
      height: 800100,
      hash: '0000000000000000000100000000000000000000000000000000000000000001',
      poolId: defaultPoolId,
    });
    await insertTestBlock({
      height: 800102,
      hash: '0000000000000000000100000000000000000000000000000000000000000003',
      poolId: defaultPoolId,
    });

    const missingBlocks = await BlocksRepository.$getMissingBlocksBetweenHeights(800100, 800102);

    expect(missingBlocks).toEqual([800101]);
  });

  test('should return every missing height in ascending order for reversed ranges', async () => {
    expect(await BlocksRepository.$getMissingBlocksBetweenHeights(800102, 800100)).toEqual([800100, 800101, 800102]);
  });

  test('should preserve the single-height no-op', async () => {
    expect(await BlocksRepository.$getMissingBlocksBetweenHeights(800100, 800100)).toEqual([]);
  });

  test.each([
    { heights: [10, 11, 12, 13, 14], missing: [] },
    { heights: [11, 13], missing: [10, 12, 14] },
    { heights: [11, 11, 13], missing: [10, 12, 14] },
  ])('finds exact gaps for $heights', async ({ heights, missing }) => {
    for (const [index, height] of heights.entries()) {
      await insertTestBlock({
        height,
        hash: (index + 1).toString(16).padStart(64, '0'),
        poolId: defaultPoolId,
      });
    }
    expect(await BlocksRepository.$getMissingBlocksBetweenHeights(10, 14)).toEqual(missing);
    expect(await BlocksRepository.$getMissingBlocksBetweenHeights(14, 10)).toEqual(missing);
  });

  test('ignores stale forks but accepts a canonical block at the same height', async () => {
    for (const [index, height] of [10, 11, 11].entries()) {
      await insertTestBlock({
        height,
        hash: (index + 1).toString(16).padStart(64, '0'),
        poolId: defaultPoolId,
      });
    }
    await DB.query('UPDATE blocks SET stale = 1 WHERE hash IN (?, ?)', ['1'.padStart(64, '0'), '2'.padStart(64, '0')]);
    expect(await BlocksRepository.$getMissingBlocksBetweenHeights(10, 12)).toEqual([10, 12]);
  });

  test('propagates database errors instead of returning a complete range', async () => {
    const error = new Error('Database unavailable');
    const query = jest.spyOn(DB, 'query').mockRejectedValueOnce(error);
    try {
      await expect(BlocksRepository.$getMissingBlocksBetweenHeights(10, 12)).rejects.toBe(error);
    } finally {
      query.mockRestore();
    }
  });

  test('should get latest block height', async () => {
    await insertTestBlock({
      height: 800200,
      hash: '0000000000000000000200000000000000000000000000000000000000000001',
      poolId: defaultPoolId,
    });
    await insertTestBlock({
      height: 800201,
      hash: '0000000000000000000200000000000000000000000000000000000000000002',
      poolId: defaultPoolId,
    });

    const height = await BlocksRepository.$mostRecentBlockHeight();

    expect(height).toBe(800201);
  });

  test('should handle block with pool association', async () => {
    // Insert a pool and get its auto-generated ID
    const testPoolId = await insertTestPool({
      name: 'Test Pool',
      slug: 'test-pool',
      addresses: '[]',
      regexes: '[]',
    });

    const blockHash = '0000000000000000000300000000000000000000000000000000000000000001';
    await insertTestBlock({
      height: 800300,
      hash: blockHash,
      poolId: testPoolId,
    });

    const block = await BlocksRepository.$getBlockByHash(blockHash);

    expect(block).toBeDefined();
    expect(block).not.toBeNull();
    // The pool should be populated with the test pool's data
    if (block && block.extras?.pool) {
      expect(block.extras.pool.name).toBe('Test Pool');
      expect(block.extras.pool.slug).toBe('test-pool');
    }
  });
});
