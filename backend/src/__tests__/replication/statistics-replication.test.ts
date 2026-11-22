import statisticsReplication from '../../replication/StatisticsReplication';
import auditReplication from '../../replication/AuditReplication';
import { $sync, query } from '../../replication/replicator';
import statistics from '../../api/statistics/statistics-api';
import config from '../../config';
import { Common } from '../../api/common';
import DB from '../../database';

jest.mock('../../replication/replicator');
jest.mock('../../api/backend-info', () => ({
  __esModule: true,
  default: { getBackendInfo: () => ({ hostname: 'self' }) },
}));

const STEP = 300;
const START = 1790000000 - (1790000000 % STEP);
const replication = statisticsReplication as any;

function rows(from: number, to: number, count = 1000, sizesLength = 39): any[] {
  const result: any[] = [];
  for (let index = from; index < to; index++) {
    result.push({
      added: START + index * STEP,
      count: count + (index % 2) * 20,
      bytes_per_second: 1000,
      total_fee: 0,
      mempool_byte_size: 0,
      min_fee: 0.1,
      sizes: new Array(sizesLength).fill(100),
    });
  }
  return result;
}

function times(from: number, to: number): number[] {
  return rows(from, to).map((row) => row.added);
}

test('both replicators skip database and peer work when replication is disabled', async () => {
  const original = { ...config.REPLICATION };
  const database = jest.spyOn(DB, 'query').mockRejectedValue(new Error('unexpected database call'));
  config.REPLICATION.ENABLED = false;
  config.REPLICATION.AUDIT = true;
  config.REPLICATION.STATISTICS = true;
  try {
    await Promise.all([auditReplication.$sync(), statisticsReplication.$sync()]);
    expect(database).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
    expect($sync).not.toHaveBeenCalled();
    expect(auditReplication.inProgress).toBe(false);
    expect(statisticsReplication.inProgress).toBe(false);
  } finally {
    Object.assign(config.REPLICATION, original);
    database.mockRestore();
  }
});

test('retries recent gaps once the short cooldown expires after an empty run', async () => {
  const originalReplication = { ...config.REPLICATION };
  const originalStatisticsEnabled = config.STATISTICS.ENABLED;
  config.REPLICATION.ENABLED = true;
  config.REPLICATION.STATISTICS = true;
  config.STATISTICS.ENABLED = true;
  const gaps = new Set([60, 120]);
  const now = jest.spyOn(Date, 'now').mockReturnValue(START * 1000);
  jest.spyOn(Common, 'sleep$').mockResolvedValue();
  jest.spyOn(replication, '$getMissingStatistics').mockResolvedValue({ '24h': gaps });
  const sync = jest
    .spyOn(replication, '$syncStatistics')
    .mockResolvedValue({ success: false, synced: 0, missed: gaps.size });

  try {
    await statisticsReplication.$sync();
    await statisticsReplication.$sync();
    expect(sync).toHaveBeenCalledTimes(1);

    now.mockReturnValue(START * 1000 + 5 * 60 * 1000);
    await statisticsReplication.$sync();
    expect(sync).toHaveBeenCalledTimes(2);
  } finally {
    Object.assign(config.REPLICATION, originalReplication);
    config.STATISTICS.ENABLED = originalStatisticsEnabled;
    delete replication.failedAttempts['24h'];
    jest.restoreAllMocks();
  }
});

describe('StatisticsReplication $syncStatistics', () => {
  let create: jest.SpyInstance;
  let responses: Record<string, unknown>;
  const originalServers = config.REPLICATION.SERVERS;

  beforeEach(() => {
    create = jest.spyOn(statistics, '$create').mockResolvedValue(1);
    jest.spyOn(statistics, '$list1W').mockResolvedValue([]);
    jest.spyOn(Common, 'shuffleArray').mockImplementation(() => undefined);
    (query as unknown as jest.Mock)
      .mockReset()
      .mockImplementation((url: string) => Promise.resolve(responses[url.split('/')[2]]));
  });

  afterEach(() => {
    config.REPLICATION.SERVERS = originalServers;
    jest.restoreAllMocks();
  });

  test('fills both adjacent long-history slots from a peer with a late representative timestamp', async () => {
    const start = START - (START % 1800);
    const added = [start + 1500, start + 1860];
    config.REPLICATION.SERVERS = ['a'];
    jest.spyOn(statistics, '$list1M').mockResolvedValue([]);
    responses = { a: rows(0, 2).map((row, i) => ({ ...row, added: added[i] })) };
    const result = await replication.$syncStatistics('1m', new Set([start, start + 1800]));
    expect(result.synced).toBe(2);
    expect(create.mock.calls.map(([sample]) => sample.added)).toEqual(added);
  });

  test('fills a gap from the peer that continues our data', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c'];
    jest.spyOn(statistics, '$list1W').mockResolvedValue(rows(0, 40));
    responses = { a: rows(0, 100, 1500), b: rows(0, 100, 1010), c: rows(0, 100, 1500) };
    const result = await replication.$syncStatistics('1w', new Set(times(40, 100)));
    expect(result.synced).toBe(60);
    expect(create.mock.calls[0][0].unconfirmed_transactions).toBe(1010);
  });

  test('only inserts individual slots supported by three peers in an unanchored chunk', async () => {
    config.REPLICATION.SERVERS = ['a', 'b', 'c'];
    const partial = rows(0, 30);
    responses = {
      a: rows(0, 60),
      b: partial,
      c: partial.map((row, i) => (i === 10 ? { ...row, count: 2000 } : row)),
    };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result).toEqual({ success: true, synced: 29, missed: 31 });
    expect(create.mock.calls.map(([row]) => row.added)).toEqual(times(0, 30).filter((_, i) => i !== 10));
  });

  test('fills gaps from a single configured BCH peer, including legacy byte buckets', async () => {
    config.REPLICATION.SERVERS = ['a', 'a', 'self'];
    // The historical SELECTs omit these fields when serialized for peers.
    responses = {
      a: JSON.parse(
        JSON.stringify(
          rows(0, 2, 1000, 37).map((row) => ({ ...row, total_fee: undefined, mempool_byte_size: undefined }))
        )
      ),
    };
    const result = await replication.$syncStatistics('1w', new Set(times(0, 2)));
    expect(result).toEqual({ success: true, synced: 2, missed: 0 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ size_0: 0, size_2000: 0, total_fee: 0, mempool_byte_size: 0 }),
      true
    );
  });

  test('caps attempted peer requests when every peer is unavailable or incompatible', async () => {
    config.REPLICATION.SERVERS = Array.from({ length: 20 }, (_, i) => `s${i}`);
    responses = { s1: { vsizes: [] } };
    (query as unknown as jest.Mock).mockRejectedValueOnce(new Error('peer timeout'));
    const result = await replication.$syncStatistics('1w', new Set(times(0, 60)));
    expect(result).toEqual({ success: false, synced: 0, missed: 60 });
    expect(query).toHaveBeenCalledTimes(8);
    expect(statistics.$list1W).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('StatisticsReplication missing rows', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('retries isolated slots left by a partial fill', async () => {
    const missingIndexes = new Set([10, 11, 12, 40, 41, 42, 43, 44, 45, 70]);
    const stored = times(0, 100)
      .filter((time, index) => !missingIndexes.has(index))
      .map((time) => ({ added: time + 10 }));
    const query = jest.spyOn(DB, 'query').mockResolvedValue([stored, []] as any);
    replication.pendingSlots.clear();
    const missing: Set<number> = await replication.$getMissingStatisticsInterval(
      [START, START + 100 * STEP, '1w'],
      START
    );
    expect([...missing].sort((a, b) => a - b)).toEqual([...times(10, 13), ...times(40, 46)]);

    // The middle of the three-slot gap and the entire second gap were filled.
    const newStored = [...stored, ...[...times(11, 12), ...times(40, 46)].map((time) => ({ added: time + 10 }))];
    query.mockResolvedValue([newStored, []] as any);
    const retry = await replication.$getMissingStatisticsInterval([START, START + 100 * STEP, '1w'], START);
    expect([...retry]).toEqual([times(10, 11)[0], times(12, 13)[0]]);
  });
});
