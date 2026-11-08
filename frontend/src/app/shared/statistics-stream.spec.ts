import { BehaviorSubject, Observable, Subject, of, throwError } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { afterEach, expect, it, vi } from 'vitest';
import { loadStatistics$, StatisticsState } from './statistics-stream';
import { refreshDashboard$ } from './dashboard-refresh';

const sample = (added = Date.now() / 1000) =>
  ({ added, bytes_per_second: 5 }) as any;
afterEach(() => vi.useRealTimers());
it('retries transient history failures and distinguishes successful empty history', () => {
  vi.useFakeTimers();
  const request = vi
    .fn()
    .mockReturnValueOnce(throwError(() => new Error('offline')))
    .mockReturnValue(of([]));
  const values: StatisticsState[] = [];
  const subscription = loadStatistics$(request).subscribe((state) =>
    values.push(state)
  );
  expect(values).toEqual([{ data: null, error: null, loading: true }]);
  vi.advanceTimersByTime(1000);
  expect(request).toHaveBeenCalledTimes(2);
  expect(values.at(-1)).toEqual({ data: [], error: null, loading: false });
  subscription.unsubscribe();
});
it('exhausted history retries recover with deduplicated live samples inside the two-hour window', () => {
  vi.useFakeTimers();
  const request = vi.fn(() => throwError(() => new Error('offline')));
  const live = new Subject<any>();
  const values: StatisticsState[] = [];
  const subscription = loadStatistics$(request, live).subscribe((state) =>
    values.push(state)
  );
  vi.advanceTimersByTime(3000);
  expect(request).toHaveBeenCalledTimes(4);
  expect(values.at(-1).error).toBeInstanceOf(Error);
  live.next(sample());
  live.next(sample());
  live.next(sample(Date.now() / 1000 - 7300));
  expect(values.at(-1)).toEqual({
    data: [sample()],
    error: null,
    loading: false,
  });
  subscription.unsubscribe();
  expect(live.observers).toHaveLength(0);
});
it('switching history requests cancels live subscribers and pending retries', () => {
  vi.useFakeTimers();
  const selection = new BehaviorSubject(true);
  const live = new Subject<any>();
  const request = vi.fn(() => of([]));
  const subscription = selection
    .pipe(
      switchMap((enabled) =>
        loadStatistics$(request, enabled ? live : undefined)
      )
    )
    .subscribe();
  expect(live.observers).toHaveLength(1);
  selection.next(false);
  expect(live.observers).toHaveLength(0);
  subscription.unsubscribe();
  const failed = vi.fn(() => throwError(() => new Error('offline')));
  const retrying = loadStatistics$(failed).subscribe();
  retrying.unsubscribe();
  vi.advanceTimersByTime(5000);
  expect(failed).toHaveBeenCalledOnce();
});
it('dashboard refresh survives failure, refetches on reconnect/hourly, and releases its timer', () => {
  vi.useFakeTimers();
  const connection = new BehaviorSubject(0);
  const request = vi.fn(
    () => throwError(() => new Error('offline')) as Observable<any>
  );
  const values: any[] = [];
  const subscription = refreshDashboard$(connection, request, true).subscribe(
    (value) => values.push(value)
  );
  vi.advanceTimersByTime(30000);
  expect(request).toHaveBeenCalledTimes(4);
  request.mockReturnValue(of('recovered'));
  connection.next(2);
  connection.next(2);
  expect(request).toHaveBeenCalledTimes(5);
  expect(values).toEqual([null, 'recovered']);
  vi.advanceTimersByTime(3600000);
  expect(request).toHaveBeenCalledTimes(6);
  subscription.unsubscribe();
  vi.advanceTimersByTime(3600000);
  expect(request).toHaveBeenCalledTimes(6);
  expect(vi.getTimerCount()).toBe(0);
});
