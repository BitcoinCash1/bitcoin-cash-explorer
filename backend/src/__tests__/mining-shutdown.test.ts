import blocks from '../api/blocks';
import bitcoinClient from '../api/bitcoin/bitcoin-client';
import summaries from '../repositories/BlocksSummariesRepository';
import indexer from '../indexer';
import shutdown from '../utils/shutdown';
import config from '../config';

jest.mock('../api/common', () => ({
  Common: {
    indexingEnabled: () => true,
    blocksSummariesIndexingEnabled: () => true,
  },
}));
jest.mock('../api/mempool', () => ({ hasPriority: () => false }));
jest.mock('../api/bitcoin/bitcoin-api-factory', () => ({}));
jest.mock('../api/bitcoin/bitcoin-client', () => ({ getBlockchainInfo: jest.fn(), getIndexInfo: async () => ({}) }));
jest.mock('../repositories/BlocksSummariesRepository', () => ({ $getMissingSummaries: jest.fn() }));

afterEach(() => {
  shutdown.stopping = false;
  jest.restoreAllMocks();
});

test('stops within a fetched summary batch after finishing the current summary', async () => {
  const batch = Array.from({ length: 12 }, (_, height) => ({ height, hash: String(height), stale: false }));
  (bitcoinClient.getBlockchainInfo as jest.Mock).mockResolvedValue({ blocks: 20 });
  (summaries.$getMissingSummaries as jest.Mock).mockReset().mockResolvedValue(batch);
  const saved: string[] = [];
  const save = jest.spyOn(blocks, '$indexBlockSummary').mockImplementation(async (hash) => {
    shutdown.stop();
    await Promise.resolve();
    saved.push(hash);
  });
  await shutdown.run(() => blocks.$generateBlocksSummariesDatabase());
  await shutdown.drain();
  expect(saved).toEqual(['0']);
  expect(save).toHaveBeenCalledTimes(1);
  expect(summaries.$getMissingSummaries).toHaveBeenCalledTimes(1);
});

test('does not fetch another historical batch after shutdown', async () => {
  (bitcoinClient.getBlockchainInfo as jest.Mock).mockResolvedValue({ blocks: 20 });
  (summaries.$getMissingSummaries as jest.Mock).mockReset().mockResolvedValue([{ height: 1, hash: '1' }]);
  jest.spyOn(blocks, '$indexBlockSummary').mockImplementation(async () => {
    shutdown.stop();
  });
  await blocks.$generateBlocksSummariesDatabase();
  expect(summaries.$getMissingSummaries).toHaveBeenCalledTimes(1);
});

test('a stopped mining stage cannot start later stages or schedule another pass', async () => {
  const originalFiat = config.FIAT_PRICE.ENABLED;
  config.FIAT_PRICE.ENABLED = false;
  (bitcoinClient.getBlockchainInfo as jest.Mock).mockResolvedValue({ blocks: 20, headers: 20 });
  (indexer as any).runIndexer = true;
  const current = jest.spyOn(blocks, '$generateBlockDatabase').mockImplementation(async () => {
    shutdown.stop();
    return false;
  });
  const next = jest.spyOn(blocks, '$indexCoinbaseAddresses').mockResolvedValue(undefined);
  const schedule = jest.spyOn(indexer as any, 'scheduleNextRun');
  try {
    await indexer.$run();
    await shutdown.drain();
    expect(current).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();
    expect(schedule).not.toHaveBeenCalled();
    expect(indexer.indexerIsRunning()).toBe(false);
  } finally {
    config.FIAT_PRICE.ENABLED = originalFiat;
  }
});
