import mining from '../../../api/mining/mining';
import BlocksRepository from '../../../repositories/BlocksRepository';
import HashratesRepository from '../../../repositories/HashratesRepository';
import DifficultyAdjustmentsRepository from '../../../repositories/DifficultyAdjustmentsRepository';
import PoolsRepository from '../../../repositories/PoolsRepository';
import bitcoinApi from '../../../api/bitcoin/bitcoin-api-factory';
import bitcoinClient from '../../../api/bitcoin/bitcoin-client';
import config from '../../../config';

jest.mock('../../../repositories/BlocksRepository');
jest.mock('../../../repositories/HashratesRepository');
jest.mock('../../../repositories/DifficultyAdjustmentsRepository');
jest.mock('../../../repositories/PoolsRepository');
jest.mock('../../../api/bitcoin/bitcoin-api-factory');
jest.mock('../../../api/bitcoin/bitcoin-client');

const time = Date.parse('2026-10-12T00:00:00Z') / 1000;
const row = { time, height: 10, difficulty: 1, bits: 486604799 };
const savedHashrates: unknown[] = [];
const originalAmount = config.EXPLORER.INDEXING_BLOCKS_AMOUNT;

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-26T12:00:00Z'));
  jest.clearAllMocks();
  savedHashrates.length = 0;
  jest.mocked(HashratesRepository.$saveHashrates).mockImplementation(async (rows) => {
    savedHashrates.push(...rows.map((row) => ({ ...row })));
  });
  mining.lastHashrateIndexingDate = null;
  mining.lastWeeklyHashrateIndexingDate = null;
  config.EXPLORER.INDEXING_BLOCKS_AMOUNT = 100;
  jest.mocked(BlocksRepository.$getBlocksDifficulty).mockResolvedValue([row, { ...row, height: 11 }]);
  jest.mocked(BlocksRepository.$getOldestConsecutiveBlock).mockResolvedValue({ ...row, timestamp: time });
  jest.mocked(BlocksRepository.$blockCount).mockResolvedValue(1008);
  jest
    .mocked(BlocksRepository.$blockCountBetweenTimestamp)
    .mockResolvedValue({ blockCount: 144, lastBlockHeight: 11 } as never);
  jest.mocked(DifficultyAdjustmentsRepository.$getAdjustmentsHeights).mockResolvedValue([]);
  jest.mocked(HashratesRepository.$getRawNetworkDailyHashrate).mockResolvedValue([]);
  jest.mocked(HashratesRepository.$getWeeklyHashrateTimestamps).mockResolvedValue([]);
  jest.mocked(PoolsRepository.$getPoolsInfoBetween).mockResolvedValue([{ poolId: 1, blockCount: 144 }] as never);
  jest.mocked(bitcoinClient.getNetworkHashPs).mockResolvedValue(100);
  jest
    .mocked(bitcoinApi.$getBlock)
    .mockResolvedValue({ timestamp: time - 86400, difficulty: 1, bits: row.bits } as never);
});
afterEach(() => jest.useRealTimers());
afterAll(() => {
  config.EXPLORER.INDEXING_BLOCKS_AMOUNT = originalAmount;
});

test.each(['$generateNetworkHashrateHistory', '$generatePoolHashrateHistory'] as const)(
  '%s indexes the same intervals with a reused SQL boundary as with its own lookup',
  async (generate) => {
    const boundary = await mining.$indexDifficultyAdjustments();
    await mining[generate](boundary);
    const reusedIntervals = jest
      .mocked(BlocksRepository.$blockCountBetweenTimestamp)
      .mock.calls.map((args) => [...args]);
    expect(reusedIntervals.length).toBeGreaterThan(0);
    expect(reusedIntervals.every(([, from, to]) => Number.isFinite(from) && Number.isFinite(to))).toBe(true);
    expect(savedHashrates).toEqual(expect.arrayContaining([expect.objectContaining({ avgHashrate: 100 })]));
    expect(BlocksRepository.$getOldestConsecutiveBlock).not.toHaveBeenCalled();

    mining.lastHashrateIndexingDate = null;
    mining.lastWeeklyHashrateIndexingDate = null;
    jest.mocked(BlocksRepository.$blockCountBetweenTimestamp).mockClear();
    await mining[generate]();
    expect(BlocksRepository.$blockCountBetweenTimestamp).toHaveBeenCalledTimes(reusedIntervals.length);
    expect(jest.mocked(BlocksRepository.$blockCountBetweenTimestamp).mock.calls).toEqual(reusedIntervals);
  }
);

test('uses the consecutive suffix after the latest height gap', async () => {
  const afterGap = { ...row, time: time + 604800, height: 20 };
  jest.mocked(BlocksRepository.$getBlocksDifficulty).mockResolvedValue([row, afterGap, { ...afterGap, height: 21 }]);
  expect(await mining.$indexDifficultyAdjustments()).toEqual({
    timestamp: afterGap.time,
    height: 20,
    difficulty: 1,
    bits: row.bits,
  });
});

test('an empty chain skips both histories without marking them up to date', async () => {
  jest.mocked(BlocksRepository.$getBlocksDifficulty).mockResolvedValue([]);
  const boundary = await mining.$indexDifficultyAdjustments();
  expect(boundary).toBeNull();
  await mining.$generateNetworkHashrateHistory(boundary);
  await mining.$generatePoolHashrateHistory(boundary);
  expect(BlocksRepository.$blockCountBetweenTimestamp).not.toHaveBeenCalled();
  expect(mining.lastHashrateIndexingDate).toBeNull();
  expect(mining.lastWeeklyHashrateIndexingDate).toBeNull();
});
