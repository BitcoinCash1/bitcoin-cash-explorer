import DB from '../database';
import migration from '../api/database-migration';
import { setupTestDatabase, waitForDatabase } from './test-helpers';

describe('Database Migration Integration Tests', () => {
  beforeAll(async () => {
    await waitForDatabase();
    await setupTestDatabase();
  }, 120000);

  test('should create state table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'explorer_test'
       AND table_name = 'state'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should have schema version in state table', async () => {
    const [result] = await DB.query<any>("SELECT number FROM state WHERE name = 'schema_version'");
    expect(result).toHaveLength(1);
    expect(result[0].number).toBeGreaterThan(0);
  });

  test('should create blocks table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'explorer_test'
       AND table_name = 'blocks'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should key blocks by hash so stale and canonical blocks can share a height', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = 'explorer_test' AND TABLE_NAME = 'blocks'
         AND CONSTRAINT_NAME = 'PRIMARY' ORDER BY ORDINAL_POSITION`
    );
    expect(columns.map((column: any) => column.COLUMN_NAME)).toEqual(['hash']);
  });

  test('should resume the composite index migration after a partial upgrade', async () => {
    await DB.query('ALTER TABLE blocks DROP INDEX stale_height');
    await DB.query("UPDATE state SET number = 109 WHERE name = 'schema_version'");
    await migration.$initializeOrMigrateDatabase();
    const [indexes] = await DB.query<any>(
      `SELECT INDEX_NAME, COLUMN_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'blocks'
       AND INDEX_NAME IN ('pool_stale_height', 'stale_height') ORDER BY INDEX_NAME, SEQ_IN_INDEX`
    );
    expect(indexes.map((row: any) => [row.INDEX_NAME, row.COLUMN_NAME])).toEqual([
      ['pool_stale_height', 'pool_id'],
      ['pool_stale_height', 'stale'],
      ['pool_stale_height', 'height'],
      ['stale_height', 'stale'],
      ['stale_height', 'height'],
    ]);
    await migration.$initializeOrMigrateDatabase();
  });

  test('should create pools table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'explorer_test'
       AND table_name = 'pools'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create hashrates table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'explorer_test'
       AND table_name = 'hashrates'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create prices table', async () => {
    const [result] = await DB.query<any>(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = 'explorer_test'
       AND table_name = 'prices'`
    );
    expect(result[0].count).toBe(1);
  });

  test('should create the Goggles rollup table with a 64 bit size total', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME, DATA_TYPE
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = 'explorer_test'
       AND TABLE_NAME = 'flag_values'`
    );
    expect(columns.map((column: any) => column.COLUMN_NAME)).toEqual(
      expect.arrayContaining(['bucket_size', 'start_height', 'flag_value', 'tx_count', 'size_total'])
    );
    expect(columns.find((column: any) => column.COLUMN_NAME === 'size_total')?.DATA_TYPE).toBe('bigint');
  });

  test('blocks table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'explorer_test'
       AND TABLE_NAME = 'blocks'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('height');
    expect(columnNames).toContain('hash');
    expect(columnNames).toContain('blockTimestamp');
    expect(columnNames).toContain('size');
    expect(columnNames).not.toContain('weight');
    expect(columnNames).toContain('tx_count');
  });

  test('pools table should have required columns', async () => {
    const [columns] = await DB.query<any>(
      `SELECT COLUMN_NAME 
       FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = 'explorer_test'
       AND TABLE_NAME = 'pools'`
    );

    const columnNames = columns.map((col: any) => col.COLUMN_NAME);
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('name');
    expect(columnNames).toContain('slug');
  });
});
