import DB from '../../database';
import updater from '../../tasks/pools-updater';
import blocks from '../../repositories/BlocksRepository';
import pools from '../../repositories/PoolsRepository';
import statistics from '../../api/mining/pool-statistics-cache';
import parser from '../../api/pools-parser';

jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn() } }));

test('actual block INSERT persists its attribution generation and schedules late historical repair', async () => {
  const originalSha = updater.currentSha;
  Object.assign(updater as any, { migrating: false, recheck: null });
  (updater as any).pendingBlocks.clear();
  const pool = { id: 1, name: 'Old' };
  updater.currentSha = 'old-generation';
  updater.trackPoolAttribution(pool);
  updater.currentSha = 'new-generation';
  const block = { id: 'historical-hash', height: 1, extras: { pool } } as any;
  const query = jest.mocked(DB.query).mockResolvedValue([[]] as any);
  const getPool = jest.spyOn(pools, '$getPoolByUniqueId').mockResolvedValue({ id: 7 } as any);
  const invalidate = jest.spyOn(statistics, 'invalidate').mockResolvedValue();
  const refresh = jest.spyOn(parser, '$refreshStaleBlocks').mockResolvedValue();
  try {
    await blocks.$saveBlockInDatabase(block);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO blocks');
    const columns = sql
      .slice(sql.indexOf('(') + 1, sql.indexOf(')'))
      .split(',')
      .map((column) => column.trim());
    expect(params[columns.indexOf('definition_hash')]).toBe('old-generation');
    expect(params[columns.indexOf('pool_id')]).toBe(7);
    await updater.$recheckBlocks();
    expect(refresh).toHaveBeenCalledWith('new-generation', Number.MAX_SAFE_INTEGER, ['historical-hash']);
  } finally {
    updater.currentSha = originalSha;
    (updater as any).pendingBlocks.clear();
    (updater as any).recheck = null;
    getPool.mockRestore();
    invalidate.mockRestore();
    refresh.mockRestore();
  }
});
