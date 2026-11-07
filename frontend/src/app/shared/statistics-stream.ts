import { Observable, concat, defer, of } from 'rxjs';
import {
  catchError,
  map,
  retry,
  scan,
  startWith,
  switchMap,
} from 'rxjs/operators';
import { OptimizedMempoolStats } from '@interfaces/node-api.interface';

export interface StatisticsState {
  data: OptimizedMempoolStats[] | null;
  error: unknown;
  loading: boolean;
}

/** Keep failed history distinct from empty history, and allow live samples to recover it. */
export function loadStatistics$(
  request: () => Observable<OptimizedMempoolStats[]>,
  live?: Observable<OptimizedMempoolStats>
): Observable<StatisticsState> {
  return defer(request).pipe(
    retry({ count: 3, delay: 1000 }),
    map((data): StatisticsState => ({ data, error: null, loading: false })),
    catchError((error) =>
      of<StatisticsState>({ data: null, error, loading: false })
    ),
    switchMap((initial) => {
      if (!live) return of(initial);
      return concat(
        of(initial),
        live.pipe(
          scan((data, sample) => {
            const start = Date.now() / 1000 - 2 * 60 * 60;
            return [
              sample,
              ...data.filter((previous) => previous.added !== sample.added),
            ].filter((point) => point.added >= start);
          }, initial.data || []),
          map((data): StatisticsState => ({
            data,
            error: null,
            loading: false,
          }))
        )
      );
    }),
    startWith<StatisticsState>({ data: null, error: null, loading: true })
  );
}
