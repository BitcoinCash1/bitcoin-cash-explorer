import '@angular/compiler';
import { Observable, Subject, of } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { BalanceWidgetComponent } from './balance-widget.component';

const info = (balance: number) =>
  ({ chain_stats: { funded_txo_sum: balance, spent_txo_sum: 0 } }) as any;
it('updates address totals without refetching history and cancels pending replacement/destroyed sources', () => {
  const pending = new Subject<any>();
  const api = { getAddressSummary$: vi.fn(() => pending) };
  const component = new BalanceWidgetComponent(
    {} as any,
    api as any,
    { markForCheck: vi.fn() } as any
  );
  component.address = 'address';
  component.addressInfo = info(10);
  component.ngOnChanges({ address: {} } as any);
  expect(pending.observers).toHaveLength(1);
  component.addressInfo = info(20);
  component.ngOnChanges({ addressInfo: {} } as any);
  expect(component.total).toBe(20);
  expect(api.getAddressSummary$).toHaveBeenCalledOnce();
  component.address = undefined;
  component.addressInfo = undefined;
  component.ngOnChanges({ address: {} } as any);
  expect(pending.observers).toHaveLength(0);
  expect(component.isLoading).toBe(false);
  const stop = vi.fn();
  component.addressSummary$ = new Observable(() => stop);
  component.ngOnChanges({ addressSummary$: {} } as any);
  component.ngOnDestroy();
  expect(stop).toHaveBeenCalledOnce();
});
it('replaces a supplied summary source and ignores emissions from its predecessor', () => {
  const previous = new Subject<any>();
  const component = new BalanceWidgetComponent(
    {} as any,
    {} as any,
    { markForCheck: vi.fn() } as any
  );
  component.addressSummary$ = previous;
  component.ngOnChanges({ addressSummary$: {} } as any);
  component.addressSummary$ = of([
    { value: 12, time: Date.now() / 1000 } as any,
  ]);
  component.ngOnChanges({ addressSummary$: {} } as any);
  previous.next([{ value: 999, time: Date.now() / 1000 }]);
  expect(component.total).toBe(12);
  expect(component.delta7d).toBe(12);
  component.ngOnDestroy();
});
it('does not refetch completed successful history on totals-only changes, but retries a completed failed request', () => {
  const api = { getAddressSummary$: vi.fn(() => of([])) };
  const component = new BalanceWidgetComponent(
    {} as any,
    api as any,
    { markForCheck: vi.fn() } as any
  );
  component.address = 'address';
  component.addressInfo = info(1);
  component.ngOnChanges({ address: {} } as any);
  component.addressInfo = info(2);
  component.ngOnChanges({ addressInfo: {} } as any);
  expect(api.getAddressSummary$).toHaveBeenCalledOnce();
  expect(component.total).toBe(2);
  api.getAddressSummary$.mockReturnValue(
    new Observable((subscriber) => subscriber.error(new Error('offline')))
  );
  component.ngOnChanges({ address: {} } as any);
  expect(component.error).toBeTruthy();
  api.getAddressSummary$.mockReturnValue(of([]));
  component.ngOnChanges({ addressInfo: {} } as any);
  expect(api.getAddressSummary$).toHaveBeenCalledTimes(3);
  expect(component.error).toBeNull();
  component.ngOnDestroy();
});
