import { AddressPagination, PageSource } from '../../api/bitcoin/address-pagination';
import { HistoryCoordinator } from '../../api/bitcoin/history-coordinator';
const hash = 'a'.repeat(64);
const row = (id: number, height: number) => ({ tx_hash: id.toString(16).padStart(64, '0'), height, fee: 0 });
function fixture(height = 1000000, birth: number | null = 1) {
  const source: jest.Mocked<PageSource> = {
    snapshot: jest.fn<ReturnType<PageSource['snapshot']>, Parameters<PageSource['snapshot']>>(async () => ({
      height,
      hash,
    })),
    hash: jest.fn<ReturnType<PageSource['hash']>, Parameters<PageSource['hash']>>(async () => hash),
    firstUse: jest.fn<ReturnType<PageSource['firstUse']>, Parameters<PageSource['firstUse']>>(async () => birth),
    history: jest.fn<ReturnType<PageSource['history']>, Parameters<PageSource['history']>>(async () => []),
    pending: jest.fn<ReturnType<PageSource['pending']>, Parameters<PageSource['pending']>>(async () => []),
  };
  return { source, pager: new AddressPagination(source, 'mainnet') };
}
test('sparse old address stops after eight finite ranges and resumes without repeated windows', async () => {
  const { source, pager } = fixture();
  source.history.mockImplementation(async (_key, from, to) => (from <= 1 && to > 1 ? [row(1, 1)] : []));
  const first = await pager.page('key', 'transactions');
  expect(first.complete).toBe(false);
  expect(first.nextCursor).toBeTruthy();
  expect(source.history).toHaveBeenCalledTimes(8);
  const windows = source.history.mock.calls.map((c) => [c[1], c[2]]);
  expect(windows.every(([from, to]) => from >= 1 && to > from && to <= 1000001)).toBe(true);
  for (let i = 1; i < windows.length; i++) expect(windows[i][1]).toBe(windows[i - 1][0]);
  await pager.page('key', 'transactions', first.nextCursor!);
  expect(source.history.mock.calls[8][2]).toBe(windows[7][0]);
});
test('more than ten transactions in a single block use deterministic tie ordering without skips', async () => {
  const { source, pager } = fixture(100, 100);
  source.history.mockResolvedValue(Array.from({ length: 25 }, (_, i) => row(25 - i, 100)));
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await pager.page('key', 'transactions', cursor);
    if ('rows' in page) ids.push(...page.rows.map((r) => r.tx_hash));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(ids).toEqual(Array.from({ length: 25 }, (_, i) => row(i + 1, 100).tx_hash));
});
test('counts confirmed rows progressively and carries cumulative count across workers', async () => {
  const { source, pager } = fixture(1000000, 1);
  source.history.mockImplementation(async (_key, from) => [row(from, from)]);
  const first = await pager.page('key', 'count');
  expect('confirmedCount' in first && first.confirmedCount).toBe(8);
  const other = new AddressPagination(source, 'mainnet');
  const second = await other.page('key', 'count', first.nextCursor!);
  expect('confirmedCount' in second && second.confirmedCount).toBeGreaterThan(8);
  expect(source.pending).not.toHaveBeenCalled();
});
test('unused address completes without history and mempool zero-fee rows remain visible', async () => {
  const { source, pager } = fixture(100, null);
  source.pending.mockResolvedValue([row(1, 0), row(2, -1)]);
  const page = await pager.page('key', 'transactions');
  expect(page.complete).toBe(true);
  expect('rows' in page && page.rows).toHaveLength(2);
  expect(source.history).not.toHaveBeenCalled();
});
test('rejects invalid, wrong-address, wrong-mode and reorg cursors', async () => {
  const { source, pager } = fixture();
  const page = await pager.page('key', 'transactions');
  await expect(pager.page('other', 'transactions', page.nextCursor!)).rejects.toMatchObject({ status: 400 });
  await expect(pager.page('key', 'count', page.nextCursor!)).rejects.toMatchObject({ status: 400 });
  await expect(pager.page('key', 'transactions', 'junk')).rejects.toMatchObject({ status: 400 });
  source.hash.mockResolvedValue('b'.repeat(64));
  await expect(pager.page('key', 'transactions', page.nextCursor!)).rejects.toMatchObject({
    status: 409,
    code: 'ADDRESS_SNAPSHOT_CHANGED',
  });
});
test('changing pending snapshot resets instead of silently shifting offsets', async () => {
  const { source, pager } = fixture();
  source.pending.mockResolvedValue(Array.from({ length: 12 }, (_, i) => row(i, 0)));
  const page = await pager.page('key', 'transactions');
  source.pending.mockResolvedValue(Array.from({ length: 11 }, (_, i) => row(i + 1, 0)));
  await expect(pager.page('key', 'transactions', page.nextCursor!)).rejects.toMatchObject({ status: 409 });
});
test('dense windows shrink boundedly and single-block overflow returns terminal failure', async () => {
  const { source, pager } = fixture(100, 1);
  source.history.mockResolvedValue(Array.from({ length: 20001 }, (_, i) => row(i, 100)));
  await expect(pager.page('key', 'transactions')).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
  expect(source.history.mock.calls.every((c) => c[2] - c[1] >= 1)).toBe(true);
  expect(source.history.mock.calls.length).toBeLessThanOrEqual(8);
});
test('coordinator serializes, coalesces and does not cache errors', async () => {
  const coordinator = new HistoryCoordinator();
  let release!: (value: number[]) => void;
  const operation = jest.fn(() => new Promise<number[]>((resolve) => (release = resolve)));
  const a = coordinator.request('same', operation);
  const b = coordinator.request('same', operation);
  await Promise.resolve();
  expect(operation).toHaveBeenCalledTimes(1);
  release([1]);
  expect(await a).toEqual([1]);
  expect(await b).toEqual([1]);
  const failure = jest.fn(async () => {
    throw new Error('fail');
  });
  await expect(coordinator.request('error', failure)).rejects.toThrow('fail');
  await expect(coordinator.request('error', failure)).rejects.toThrow('fail');
  expect(failure).toHaveBeenCalledTimes(2);
});
test('coordinator caps queued work and preserves live coalesced waiter after leader cancellation', async () => {
  const coordinator = new HistoryCoordinator();
  let release!: (value: number) => void;
  const active = coordinator.request('active', () => new Promise<number>((resolve) => (release = resolve)));
  await Promise.resolve();
  const abort = new AbortController();
  const work = jest.fn(async () => 2);
  const cancelled = coordinator.request('shared', work, false, abort.signal);
  const live = coordinator.request('shared', work);
  abort.abort();
  const queued = Array.from({ length: 31 }, (_, i) => coordinator.request('queued' + i, async () => i));
  await expect(coordinator.request('overflow', async () => 0)).rejects.toMatchObject({ status: 503 });
  release(1);
  await active;
  expect(await live).toBe(2);
  await cancelled;
  await Promise.all(queued);
});

test('contradictory first use never yields false exact zero', async () => {
  const { pager, source } = fixture(100, 1);
  await expect(pager.page('key', 'count')).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
  expect(source.history).toHaveBeenCalledTimes(1);
  await expect(pager.page('key', 'transactions')).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
});
test('all cancelled queued work frees capacity before the active operation completes', async () => {
  const coordinator = new HistoryCoordinator();
  let release!: (value: number) => void;
  const active = coordinator.request('active', () => new Promise<number>((resolve) => (release = resolve)));
  await Promise.resolve();
  const controllers = Array.from({ length: 32 }, () => new AbortController());
  const queued = controllers.map((controller, i) =>
    coordinator.request('cancel' + i, async () => i, false, controller.signal).catch((error) => error)
  );
  controllers.forEach((controller) => controller.abort());
  const next = coordinator.request('replacement', async () => 42);
  release(1);
  await active;
  expect(await next).toBe(42);
  await Promise.all(queued);
});

test('single block with more than 2000 rows counts exactly and paginates beyond offset 2000 without skips', async () => {
  const { source, pager } = fixture(100, 100);
  const history = Array.from({ length: 2015 }, (_, i) => row(2015 - i, 100));
  source.history.mockResolvedValue(history);
  const count = await pager.page('key', 'count');
  expect(count.complete).toBe(true);
  expect('confirmedCount' in count && count.confirmedCount).toBe(2015);
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await pager.page('key', 'transactions', cursor);
    if ('rows' in page) ids.push(...page.rows.map((item) => item.tx_hash));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(ids).toHaveLength(2015);
  expect(new Set(ids).size).toBe(2015);
  expect(ids).toEqual([...history].sort((a, b) => a.tx_hash.localeCompare(b.tx_hash)).map((item) => item.tx_hash));
});
test('a dense multiblock window still shrinks before accepting a bounded single block', async () => {
  const { source, pager } = fixture(200, 1);
  source.history.mockImplementation(async (_key, from, to) =>
    to - from > 1
      ? Array.from({ length: 2001 }, (_, i) => row(i, to - 1))
      : Array.from({ length: 2001 }, (_, i) => row(i, from))
  );
  const page = await pager.page('key', 'transactions');
  expect(page.complete).toBe(false);
  expect('rows' in page && page.rows).toHaveLength(10);
  expect(source.history.mock.calls.some((call) => call[2] - call[1] === 1)).toBe(true);
});

test('pending history above the supported limit returns a terminal error', async () => {
  const { source, pager } = fixture(100, null);
  source.pending.mockResolvedValue(Array.from({ length: 2001 }, (_, i) => row(i, 0)));
  await expect(pager.page('key', 'transactions')).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
  expect(source.history).not.toHaveBeenCalled();
});

test('count stops at the first empty birth interval before returning invented progress', async () => {
  const { pager, source } = fixture(1000000, 100);
  await expect(pager.page('key', 'count')).rejects.toMatchObject({
    status: 422,
    code: 'ADDRESS_HISTORY_UNAVAILABLE',
    retryable: false,
  });
  expect(source.history).toHaveBeenCalledTimes(1);
  expect(source.history.mock.calls[0].slice(1, 3)).toEqual([100, 244]);
});
