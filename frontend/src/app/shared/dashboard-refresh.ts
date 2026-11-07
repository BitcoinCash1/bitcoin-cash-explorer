import { of, Observable, defer, interval, merge, timer } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  filter,
  retry,
  switchMap,
} from 'rxjs/operators';

/** Refetch initially, when connected again, and hourly without terminating on an outage. */
export function refreshDashboard$<T>(
  connectionState: Observable<number>,
  request: () => Observable<T>
): Observable<T | null> {
  return merge(
    connectionState.pipe(
      distinctUntilChanged(),
      filter((state, index) => index === 0 || state === 2)
    ),
    interval(60 * 60 * 1000)
  ).pipe(
    switchMap(() =>
      defer(request).pipe(
        retry({ count: 3, delay: (_, attempt) => timer(attempt * 5000) }),
        catchError(() => of(null))
      )
    )
  );
}
