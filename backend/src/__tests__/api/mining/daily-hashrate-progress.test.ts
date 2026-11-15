import mining from '../../../api/mining/mining';
import BlocksRepository from '../../../repositories/BlocksRepository';
import HashratesRepository from '../../../repositories/HashratesRepository';
import bitcoinClient from '../../../api/bitcoin/bitcoin-client';
import loadingIndicators from '../../../api/loading-indicators';
import config from '../../../config';

jest.mock('../../../repositories/BlocksRepository');
jest.mock('../../../repositories/HashratesRepository');
jest.mock('../../../api/bitcoin/bitcoin-client');

it('bounds progress while skipping indexed days and filling empty daily gaps', async () => {
  const original = mining.lastHashrateIndexingDate;
  const originalAmount = config.EXPLORER.INDEXING_BLOCKS_AMOUNT;
  const midnight = Date.UTC(2026, 10, 15);
  const day = 86400000;
  const boundary = (midnight - 4 * day + 1000) / 1000;
  const progress = jest.spyOn(loadingIndicators, 'setProgress').mockImplementation(() => {});
  jest.spyOn(mining as any, 'getGenesisData').mockResolvedValue({ timestamp: boundary - day / 1000 });
  jest
    .mocked(HashratesRepository.$getRawNetworkDailyHashrate)
    .mockResolvedValue([{ timestamp: midnight / 1000 - day / 1000 }] as any);
  jest
    .mocked(BlocksRepository.$blockCountBetweenTimestamp)
    .mockResolvedValue({ blockCount: 0, lastBlockHeight: 332451 } as any);
  jest.mocked(HashratesRepository.$saveHashrates).mockResolvedValue(undefined as any);
  let time = midnight + day / 2;
  jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
    return new RealDate(args.length ? args[0] : (time += 3000));
  });
  try {
    config.EXPLORER.INDEXING_BLOCKS_AMOUNT = 100;
    mining.lastHashrateIndexingDate = null;
    await mining.$generateNetworkHashrateHistory({ timestamp: boundary } as any);
    const values = progress.mock.calls.filter(([name]) => name === 'daily-hashrate-indexing').map(([, value]) => value);
    expect(values.length).toBeGreaterThan(2);
    expect(values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)).toBe(true);
    expect(values.at(-1)).toBe(100);
    const saved = jest.mocked(HashratesRepository.$saveHashrates).mock.calls.flatMap(([rows]) => rows);
    expect(saved).toHaveLength(3);
    expect(saved.every((row) => row.avgHashrate === 0)).toBe(true);
    expect(bitcoinClient.getNetworkHashPs).not.toHaveBeenCalled();
  } finally {
    jest.restoreAllMocks();
    mining.lastHashrateIndexingDate = original;
    config.EXPLORER.INDEXING_BLOCKS_AMOUNT = originalAmount;
  }
});
const RealDate = Date;
