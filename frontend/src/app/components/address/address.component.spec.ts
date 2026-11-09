import '@angular/compiler';
import { convertToParamMap } from '@angular/router';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddressComponent } from './address.component';
const first = 'qz9cq5ytxmejfqqr0l5clkmw0l52pj6n5yc76lup7a';
const second = 'qz9cq5pcexrfnz0a60qz7xtvv8wh5rqf8v6pxd3k74';
const tx = (txid: string, confirmed = true) =>
  ({ txid, vin: [], vout: [], status: { confirmed } }) as any;
const page = (
  transactions: any[],
  nextCursor: string | null = null,
  snapshotHash = 'snapshot'
) => ({
  transactions,
  nextCursor,
  complete: nextCursor === null,
  snapshotHeight: 100,
  snapshotHash,
});
const count = (confirmedCount: number, nextCursor: string | null = null) => ({
  confirmedCount,
  nextCursor,
  complete: nextCursor === null,
  snapshotHeight: 100,
  snapshotHash: 'count-snapshot',
  scannedThroughHeight: 50,
  progress: nextCursor ? 50 : 100,
});
const components: AddressComponent[] = [];
function setup(
  backend: 'electrum' | 'none' = 'electrum',
  address = first,
  networkChanged$ = new BehaviorSubject('') as Subject<string>
) {
  const visibility = { hidden: false, body: { scrollTo: vi.fn() } };
  vi.stubGlobal('document', visibility);
  vi.stubGlobal('window', { innerWidth: 1200 });
  const params = new BehaviorSubject(convertToParamMap({ id: address }));
  const summaries: Subject<any>[] = [],
    pages: Subject<any>[] = [],
    counts: Subject<any>[] = [];
  const request = (list: Subject<any>[]) =>
    vi.fn(() => {
      const subject = new Subject<any>();
      list.push(subject);
      return subject;
    });
  const api = {
    getAddressBalanceSummary$: request(summaries),
    getAddressTransactionPage$: request(pages),
    getAddressTransactionCount$: request(counts),
    getAddress$: vi.fn(() => new Subject<any>()),
    getPubKeyAddress$: vi.fn(() => new Subject<any>()),
    getAddressTransactions$: vi.fn(),
  };
  const state = {
    network: '',
    backend$: new BehaviorSubject(backend),
    networkChanged$,
    connectionState$: new BehaviorSubject(0),
    loadingIndicators$: new BehaviorSubject({}),
    mempoolTransactions$: new Subject<any>(),
    mempoolRemovedTransactions$: new Subject<any>(),
    blockTransactions$: new Subject<any>(),
  };
  const component = new AddressComponent(
    { paramMap: params } as any,
    api as any,
    {
      want: vi.fn(),
      startTrackAddress: vi.fn(),
      stopTrackingAddress: vi.fn(),
    } as any,
    state as any,
    { playSound: vi.fn() } as any,
    {} as any,
    { setTitle: vi.fn(), setDescription: vi.fn(), logSoft404: vi.fn() } as any,
    { markForCheck: vi.fn() } as any
  );
  components.push(component);
  component.ngOnInit();
  return {
    component,
    params,
    api,
    summaries,
    pages,
    counts,
    state,
    visibility,
  };
}
afterEach(() => {
  components.splice(0).forEach((c) => c.ngOnDestroy());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
describe('bounded Electrum address loading', () => {
  it('loads immediately before the first network ReplaySubject emission and suppresses duplicate initial network', () => {
    const network = new ReplaySubject<string>(1);
    const { component, api } = setup('electrum', first, network);
    expect(component.displayAddress).toBe(first);
    expect(api.getAddressBalanceSummary$).toHaveBeenCalledTimes(1);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(1);
    network.next('');
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(1);
    network.next('chipnet');
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(2);
  });

  it('renders transactions independently of a delayed or failed balance without legacy history or automatic counting', () => {
    const { component: c, api, summaries, pages } = setup();
    expect(api.getAddressBalanceSummary$).toHaveBeenCalledTimes(1);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(1);
    expect(api.getAddress$).not.toHaveBeenCalled();
    expect(api.getAddressTransactions$).not.toHaveBeenCalled();
    pages[0].next(page([tx('first')]));
    expect(c.transactions[0].txid).toBe('first');
    expect(c.isLoadingAddress).toBe(true);
    summaries[0].error({ status: 503 });
    expect(c.transactions).toHaveLength(1);
    expect(c.transactionError).toBeNull();
    expect(api.getAddressTransactionCount$).not.toHaveBeenCalled();
  });
  it('renders balances with unknown counts and retains them when a page fails', () => {
    const { component: c, summaries, pages } = setup();
    summaries[0].next({
      address: first,
      confirmedBalance: 123,
      pendingBalance: -5,
      electrum: true,
    });
    expect(c.chainStats.balance).toBe(123);
    expect(c.mempoolStats.balance).toBe(-5);
    expect(c.chainStats.tx_count).toBeUndefined();
    pages[0].error({ status: 503 });
    expect(c.error).toBeNull();
    expect(c.chainStats.balance).toBe(123);
    expect(c.retryLoadMore).toBe(true);
  });
  it('uses cursors, deduplicates rows and obeys server completion', () => {
    const { component: c, api, pages } = setup();
    pages[0].next(page([tx('a')], 'next'));
    c.loadMore();
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      first,
      undefined,
      'next'
    );
    pages[1].next(page([tx('a'), tx('b')]));
    expect(c.transactions.map((t) => t.txid)).toEqual(['a', 'b']);
    expect(c.fullyLoaded).toBe(true);
    c.loadMore();
    expect(pages).toHaveLength(2);
  });
  it.each([
    { status: 409 },
    { status: 400, error: { code: 'INVALID_ADDRESS_CURSOR' } },
  ])('retains cards until explicit snapshot reset: %j', (error) => {
    const { component: c, api, pages } = setup();
    pages[0].next(page([tx('old')], 'expired'));
    c.loadMore();
    pages[1].error(error);
    expect(c.transactions[0].txid).toBe('old');
    expect(c.pageResetRequired).toBe(true);
    expect(pages).toHaveLength(2);
    c.loadMore();
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      first,
      undefined,
      undefined
    );
    pages[2].next(page([tx('new')], null, 'new'));
    expect(c.transactions[0].txid).toBe('new');
  });
  it('bounds automatic empty page continuation', () => {
    vi.useFakeTimers();
    const { component: c, api, pages } = setup();
    for (let i = 0; i < 4; i++) {
      pages[i].next(page([], `cursor-${i}`));
      vi.runOnlyPendingTimers();
    }
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(4);
    expect(c.isLoadingTransactions).toBe(false);
    expect(c.fullyLoaded).toBe(false);
  });
  it('counts only on request, pauses hidden work and resumes the committed cursor', () => {
    vi.useFakeTimers();
    const { component: c, api, counts, visibility } = setup();
    expect(counts).toHaveLength(0);
    c.calculateCount();
    counts[0].next(count(100, 'next'));
    visibility.hidden = true;
    c.onVisibilityChange();
    vi.runOnlyPendingTimers();
    expect(counts).toHaveLength(1);
    expect(c.countPaused).toBe(true);
    visibility.hidden = false;
    c.onVisibilityChange();
    expect(api.getAddressTransactionCount$).toHaveBeenLastCalledWith(
      first,
      undefined,
      'next'
    );
    counts[1].next(count(200));
    expect(c.countResult.confirmedCount).toBe(200);
    expect(c.countRunning).toBe(false);
    expect(c.fullyLoaded).toBe(false);
  });
  it('cancels pending requests and rejects late emissions after navigation', () => {
    const { component: c, params, pages, summaries, counts } = setup();
    c.calculateCount();
    params.next(convertToParamMap({ id: second }));
    expect(pages[0].observed).toBe(false);
    expect(summaries[0].observed).toBe(false);
    expect(counts[0].observed).toBe(false);
    pages[0].next(page([tx('old')]));
    expect(c.transactions).toBeNull();
    pages[1].next(page([tx('new')]));
    expect(c.transactions[0].txid).toBe('new');
    expect(c.countResult).toBeNull();
  });
  it('merges live additions and confirmations into an arriving page', () => {
    const { component: c, pages, state } = setup();
    state.mempoolTransactions$.next(tx('live', false));
    state.blockTransactions$.next(tx('live'));
    pages[0].next(page([tx('older')]));
    expect(c.transactions.map((t) => t.txid)).toEqual(['live', 'older']);
    expect(c.transactions[0].status.confirmed).toBe(true);
  });
  it('preserves pubkey scripts and cancels on backend and network changes', () => {
    const pubkey = '02' + '11'.repeat(32);
    const { api, pages, state } = setup('electrum', pubkey);
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      pubkey,
      '21' + pubkey + 'ac',
      undefined
    );
    state.networkChanged$.next('chipnet');
    expect(pages[0].observed).toBe(false);
    state.backend$.next('none');
    expect(pages[1].observed).toBe(false);
    expect(api.getPubKeyAddress$).toHaveBeenCalledWith(pubkey);
  });
  it('preserves the none backend flow', () => {
    const { component: c, api } = setup('none');
    expect(c.paginatedMode).toBe(false);
    expect(api.getAddress$).toHaveBeenCalledWith(first);
    expect(api.getAddressBalanceSummary$).not.toHaveBeenCalled();
    expect(api.getAddressTransactionPage$).not.toHaveBeenCalled();
  });
});
