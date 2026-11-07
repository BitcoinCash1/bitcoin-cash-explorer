import '@angular/compiler';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { AddressTransactionsWidgetComponent } from './address-transactions-widget.component';
import { refreshDashboard$ } from '@app/shared/dashboard-refresh';

afterEach(() => vi.useRealTimers());
it('settles failed shared history to a visible unavailable state and later recovers without resubscribing', () => {
  vi.useFakeTimers();
  const connection = new BehaviorSubject(0);
  const request = vi.fn(() => throwError(() => new Error('offline')) as any);
  const component = new AddressTransactionsWidgetComponent(
    { fiatCurrency$: of('USD') } as any,
    {} as any,
    { getBlockPrice$: vi.fn(() => of({ USD: 500 })) } as any
  );
  component.addressSummary$ = refreshDashboard$(connection, request);
  component.ngOnInit();
  let result: any;
  const subscription = component.transactions$.subscribe(
    (value) => (result = value)
  );
  vi.advanceTimersByTime(30000);
  expect(component.error).toBeTruthy();
  expect(component.isLoading).toBe(false);
  expect(result).toEqual([]); // Truthy settled value replaces the async template's loading skeleton.
  request.mockReturnValue(of([{ txid: 'recovered', value: 2000000, time: 1 }]));
  connection.next(2);
  expect(component.error).toBeNull();
  expect(result[0].txid).toBe('recovered');
  const source = component.transactions$;
  component.ngOnChanges({ addressInfo: {} } as any);
  expect(component.transactions$).toBe(source);
  subscription.unsubscribe();
  component.ngOnDestroy();
  expect(vi.getTimerCount()).toBe(0);
});
it('successful empty history settles without calling the price service', () => {
  const price = { getBlockPrice$: vi.fn() };
  const component = new AddressTransactionsWidgetComponent(
    {} as any,
    {} as any,
    price as any
  );
  component.addressSummary$ = of([]);
  component.startAddressSubscription();
  let result: any;
  component.transactions$.subscribe((value) => (result = value));
  expect(result).toEqual([]);
  expect(component.error).toBeNull();
  expect(price.getBlockPrice$).not.toHaveBeenCalled();
});

it('retries failed direct history on an address-info update', () => {
  const request = vi.fn(() => throwError(() => new Error('offline')) as any);
  const component = new AddressTransactionsWidgetComponent(
    {} as any,
    { getAddressSummary$: request } as any,
    {} as any
  );
  component.address = 'address';
  component.addressInfo = {} as any;
  component.ngOnChanges({ address: {} } as any);
  component.transactions$.subscribe();
  expect(component.error).toBeTruthy();
  const failedSource = component.transactions$;
  request.mockReturnValue(of([]));
  component.ngOnChanges({ addressInfo: {} } as any);
  expect(component.transactions$).not.toBe(failedSource);
  component.transactions$.subscribe();
  expect(component.error).toBeNull();
  expect(component.isLoading).toBe(false);
});
