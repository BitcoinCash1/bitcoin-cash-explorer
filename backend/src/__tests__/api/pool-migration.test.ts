import DB from '../../database';
import config from '../../config';
import parser from '../../api/pools-parser';
import updater from '../../tasks/pools-updater';
import repository from '../../repositories/BlocksRepository';

jest.mock('../../database', () => ({ __esModule: true, default: { query: jest.fn(), $transaction: jest.fn() } }));
jest.mock('../../api/pools-parser', () => ({
  __esModule: true,
  default: {
    miningPools: [],
    prepareMiningPools: jest.fn((p) => structuredClone(p)),
    migratePoolsJson: jest.fn(),
    $refreshStaleBlocks: jest.fn(),
  },
}));
jest.mock('../../repositories/BlocksRepository', () => ({
  __esModule: true,
  default: { $mostRecentBlockHeight: jest.fn() },
}));

describe('atomic mining pool publication', () => {
  const connection = {} as any;
  const oldPools = [{ id: 1, name: 'Old' }];
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(config.EXPLORER, { ENABLED: true, NETWORK: 'mainnet', AUTOMATIC_POOLS_UPDATE: true });
    config.DATABASE.ENABLED = true;
    Object.assign(updater as any, { lastRun: 0, currentSha: 'old', recheck: null, migrating: false });
    (updater as any).pendingBlocks.clear();
    parser.miningPools = oldPools;
    jest.spyOn(updater, 'getShaFromDb').mockResolvedValue('old');
    jest
      .spyOn(updater as any, 'query')
      .mockResolvedValueOnce([{ name: 'pools-v2.json', id: 'new' }])
      .mockResolvedValueOnce([{ id: 2, name: 'New' }]);
    updater.poolsSource = 'gitlab';
    (repository.$mostRecentBlockHeight as jest.Mock).mockResolvedValue(100);
    (DB.query as jest.Mock).mockResolvedValue([[]]);
    (DB.$transaction as jest.Mock).mockImplementation(async (work) => work(connection));
    (parser.migratePoolsJson as jest.Mock).mockResolvedValue(true);
    (parser.$refreshStaleBlocks as jest.Mock).mockResolvedValue(undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  test('does not publish staged definitions or SHA before commit and preserves state on rollback', async () => {
    (DB.$transaction as jest.Mock).mockImplementation(async (work) => {
      await work(connection);
      expect(updater.currentSha).toBe('old');
      expect(parser.miningPools).toBe(oldPools);
      throw new Error('commit failed');
    });
    await updater.updatePoolsJson();
    expect(updater.currentSha).toBe('old');
    expect(parser.miningPools).toBe(oldPools);
    expect(parser.$refreshStaleBlocks).not.toHaveBeenCalled();
    expect((updater as any).recheck).toBeNull();
    expect(parser.migratePoolsJson).toHaveBeenCalledWith(connection, [{ id: 2, name: 'New' }], 'new');
    expect((DB.query as jest.Mock).mock.calls.every((call) => call[3] === connection)).toBe(true);
  });

  test('retries postcommit publication and retains saves completed during refresh, including old historical attribution', async () => {
    await updater.updatePoolsJson();
    expect(updater.currentSha).toBe('new');
    const attribution = {};
    updater.currentSha = 'old';
    updater.trackPoolAttribution(attribution);
    updater.currentSha = 'new';
    const copiedPool = {};
    updater.copyPoolAttribution(attribution, copiedPool);
    expect(updater.getAttributionSha(copiedPool)).toBe('old');
    (parser.$refreshStaleBlocks as jest.Mock).mockRejectedValueOnce(new Error('cache offline'));
    await updater.$recheckBlocks();
    expect((updater as any).recheck).not.toBeNull();
    (parser.$refreshStaleBlocks as jest.Mock).mockImplementationOnce(async () =>
      updater.trackIndexedBlock('historical', updater.getAttributionSha(attribution))
    );
    await updater.$recheckBlocks();
    expect((updater as any).recheck).not.toBeNull();
    await updater.$recheckBlocks();
    expect(parser.$refreshStaleBlocks).toHaveBeenLastCalledWith('new', 90, ['historical']);
    expect((updater as any).recheck).toBeNull();
    updater.trackIndexedBlock('late-historical', 'old');
    await updater.$recheckBlocks();
    expect(parser.$refreshStaleBlocks).toHaveBeenLastCalledWith('new', Number.MAX_SAFE_INTEGER, ['late-historical']);
  });
  test('drains historical repair hashes in bounded batches', async () => {
    updater.currentSha = 'new';
    for (let i = 0; i < 1001; i++) updater.trackIndexedBlock(`block-${i}`, 'old');
    await updater.$recheckBlocks();
    expect((parser.$refreshStaleBlocks as jest.Mock).mock.calls[0][2]).toHaveLength(1000);
    expect((updater as any).recheck).not.toBeNull();
    await updater.$recheckBlocks();
    expect(parser.$refreshStaleBlocks).toHaveBeenLastCalledWith('new', Number.MAX_SAFE_INTEGER, ['block-1000']);
    expect((updater as any).recheck).toBeNull();
  });

  test('preserves GitHub source and database-disabled publication', async () => {
    config.DATABASE.ENABLED = false;
    updater.poolsSource = 'github';
    (updater as any).query
      .mockReset()
      .mockResolvedValueOnce({ tree: [{ path: 'pools-v2.json', sha: 'github-sha' }] })
      .mockResolvedValueOnce([{ id: 3, name: 'Github' }]);
    await updater.updatePoolsJson();
    expect(updater.currentSha).toBe('github-sha');
    expect(parser.miningPools).toEqual([{ id: 3, name: 'Github' }]);
    expect(DB.$transaction).not.toHaveBeenCalled();
  });
});
