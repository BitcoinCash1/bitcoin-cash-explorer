import '@angular/compiler';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { CustomDashboardComponent } from './custom-dashboard.component';
import { BalanceWidgetComponent } from '../balance-widget/balance-widget.component';

afterEach(() => vi.useRealTimers());
function fixture() {
  const component: any = Object.create(CustomDashboardComponent.prototype);
  const connectionState$ = new BehaviorSubject(0);
  const walletTransactions$ = new Subject<any>();
  const original = {
    a: { transactions: [{ txid: 'old', value: 10, height: 1, time: 1 }] },
    b: { transactions: [{ txid: 'old', value: 20, height: 1, time: 1 }] },
  };
  const api = { getWallet$: vi.fn(() => of(structuredClone(original) as any)) };
  Object.assign(component, {
    stateService: {
      connectionState$,
      walletTransactions$,
      env: {
        customize: {
          dashboard: { widgets: [{ props: { wallet: 'wallet' } }] },
        },
      },
    },
    apiService: api,
    websocketService: {
      startTrackingWallet: vi.fn(),
      stopTrackingWallet: vi.fn(),
    },
    destroy$: new Subject(),
    filterSubscription: { unsubscribe: vi.fn() },
    mempoolInfoSubscription: { unsubscribe: vi.fn() },
    currencySubscription: { unsubscribe: vi.fn() },
  });
  component.startWalletSubscription();
  return { component, api, walletTransactions$, connectionState$, original };
}
it('shares refreshed wallet state and suppresses same-batch and replayed duplicates without mutating prior sums', () => {
  vi.useFakeTimers();
  const { component, api, walletTransactions$, connectionState$, original } =
    fixture();
  let latest: any;
  const first = component.walletSummary$.subscribe((value) => (latest = value));
  const second = component.walletSummary$.subscribe();
  expect(api.getWallet$).toHaveBeenCalledOnce();
  expect(latest[0].value).toBe(30);
  const tx = {
    txid: 'new',
    vin: [{ prevout: { scriptpubkey_address: 'a', value: 70 } }],
    vout: [
      { scriptpubkey_address: 'a', value: 100 },
      { scriptpubkey_address: 'b', value: 60 },
    ],
    status: { block_height: 2, block_time: 2 },
  };
  walletTransactions$.next([tx, tx]);
  walletTransactions$.next([tx]);
  expect(latest.map((entry) => entry.value)).toEqual([90, 30]);
  expect(original.a.transactions[0].value).toBe(10);
  connectionState$.next(2);
  expect(api.getWallet$).toHaveBeenCalledTimes(2);
  vi.advanceTimersByTime(3600000);
  expect(api.getWallet$).toHaveBeenCalledTimes(3);
  component.ngOnDestroy();
  expect(walletTransactions$.observers).toHaveLength(0);
  expect(vi.getTimerCount()).toBe(0);
  expect(component.websocketService.stopTrackingWallet).toHaveBeenCalledOnce();
  first.unsubscribe();
  second.unsubscribe();
});
it('exhausted initial wallet history ends the balance spinner and a later reconnect clears its error', () => {
  vi.useFakeTimers();
  const { component, api, connectionState$ } = fixture();
  api.getWallet$.mockReturnValue(throwError(() => new Error('offline')));
  const balance = new BalanceWidgetComponent(
    {} as any,
    {} as any,
    { markForCheck: vi.fn() } as any
  );
  balance.addressSummary$ = component.walletSummary$;
  balance.ngOnChanges({ addressSummary$: {} } as any);
  vi.advanceTimersByTime(30000);
  expect(balance.isLoading).toBe(false);
  expect(balance.error).toBeTruthy();
  api.getWallet$.mockReturnValue(
    of({
      a: {
        transactions: [{ txid: 'recovered', value: 12, height: 1, time: 1 }],
      },
    })
  );
  connectionState$.next(2);
  expect(balance.error).toBeNull();
  expect(balance.total).toBe(12);
  balance.ngOnDestroy();
  component.ngOnDestroy();
});
