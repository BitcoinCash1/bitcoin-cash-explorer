import '@angular/compiler';
// Include declaring modules for the address and its transitive transaction
// components in Angular's AOT scope without executing their routing setup.
import type {} from '@app/graphs/graphs.module';
import type {} from '@components/transaction/transaction.module';
import { convertToParamMap } from '@angular/router';
import {
  BehaviorSubject,
  ReplaySubject,
  Subject,
  firstValueFrom,
  of,
} from 'rxjs';
import { ElectrsApiService } from '@app/services/backend-api.service';
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
    counts: Subject<any>[] = [],
    pendingCounts: Subject<any>[] = [];
  const request = (list: Subject<any>[]) =>
    vi.fn(() => {
      const subject = new Subject<any>();
      list.push(subject);
      return subject;
    });
  const api = {
    getAddressBalanceSummary$: request(summaries),
    getAddressMempoolSummary$: request(pendingCounts),
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
    connectionState$: new BehaviorSubject(2),
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
    pendingCounts,
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
  it('clears partial count progress on terminal history failure and disables count until navigation', () => {
    vi.useFakeTimers();
    const { component: c, api, counts, params, summaries } = setup();
    summaries[0].next({
      address: first,
      confirmedBalance: 123,
      pendingBalance: 0,
      electrum: true,
    });
    c.calculateCount();
    counts[0].next(count(0, 'partial'));
    vi.runOnlyPendingTimers();
    counts[1].error({
      status: 422,
      error: { code: 'ADDRESS_HISTORY_UNAVAILABLE', retryable: false },
    });
    expect(c.countUnavailable).toBe(true);
    expect(c.countResult).toBeNull();
    expect(c.countRunning).toBe(false);
    expect(c.chainStats.balance).toBe(123);
    expect(c.chainStats.tx_count).toBeUndefined();
    c.calculateCount();
    vi.runOnlyPendingTimers();
    expect(api.getAddressTransactionCount$).toHaveBeenCalledTimes(2);
    params.next(convertToParamMap({ id: second }));
    expect(c.countUnavailable).toBe(false);
    c.calculateCount();
    expect(api.getAddressTransactionCount$).toHaveBeenLastCalledWith(
      second,
      undefined,
      undefined
    );
  });

  it('retains partial progress and permits continuation after a transient count failure', () => {
    vi.useFakeTimers();
    const { component: c, api, counts } = setup();
    c.calculateCount();
    counts[0].next(count(120, 'continue'));
    vi.runOnlyPendingTimers();
    counts[1].error({ status: 503 });
    expect(c.countUnavailable).toBe(false);
    expect(c.countResult.confirmedCount).toBe(120);
    expect(c.countRunning).toBe(false);
    c.calculateCount();
    expect(api.getAddressTransactionCount$).toHaveBeenLastCalledWith(
      first,
      undefined,
      'continue'
    );
  });

  it('retains cards and balance but disables page retries on terminal history failure until network changes', () => {
    const { component: c, api, pages, summaries, state } = setup();
    summaries[0].next({
      address: first,
      confirmedBalance: 123,
      pendingBalance: 0,
      electrum: true,
    });
    pages[0].next(page([tx('existing')], 'next'));
    c.loadMore();
    pages[1].error({
      status: 422,
      error: { code: 'ADDRESS_HISTORY_UNAVAILABLE', retryable: false },
    });
    expect(c.historyUnavailable).toBe(true);
    expect(c.retryLoadMore).toBe(false);
    expect(c.isLoadingTransactions).toBe(false);
    expect(c.transactions[0].txid).toBe('existing');
    expect(c.chainStats.balance).toBe(123);
    c.loadMore();
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(2);
    state.networkChanged$.next('chipnet');
    expect(c.historyUnavailable).toBe(false);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(3);
  });

  it('allows page retry using the same cursor after a transient history failure', () => {
    const { component: c, api, pages } = setup();
    pages[0].next(page([tx('existing')], 'next'));
    c.loadMore();
    pages[1].error({ status: 503 });
    expect(c.historyUnavailable).toBe(false);
    expect(c.retryLoadMore).toBe(true);
    expect(c.transactions[0].txid).toBe('existing');
    c.loadMore();
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      first,
      undefined,
      'next'
    );
  });

  it('keeps two live pending arrivals newest first before and after a page arrives', () => {
    const { component: c, pages, state } = setup();
    state.mempoolTransactions$.next(tx('first-pending', false));
    state.mempoolTransactions$.next(tx('second-pending', false));
    pages[0].next(page([tx('confirmed')], 'next'));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'second-pending',
      'first-pending',
      'confirmed',
    ]);
    state.mempoolTransactions$.next(tx('third-pending', false));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'third-pending',
      'second-pending',
      'first-pending',
      'confirmed',
    ]);
    c.loadMore();
    pages[1].next(page([tx('other-confirmed')]));
    expect(c.transactions.slice(0, 3).map((item) => item.txid)).toEqual([
      'third-pending',
      'second-pending',
      'first-pending',
    ]);
  });

  it('sorts pending before confirmed heights and uses txid ties immediately on live confirmation', () => {
    const { component: c, pages, state } = setup();
    const confirmed = (id: string, height: number) => ({
      ...tx(id),
      status: { confirmed: true, block_height: height },
    });
    pages[0].next(
      page([
        confirmed('older', 9),
        confirmed('z', 10),
        tx('pending', false),
        confirmed('a', 10),
      ])
    );
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'pending',
      'a',
      'z',
      'older',
    ]);
    state.blockTransactions$.next(confirmed('newest', 11));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'pending',
      'newest',
      'a',
      'z',
      'older',
    ]);
    state.blockTransactions$.next(confirmed('pending', 10));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'newest',
      'a',
      'pending',
      'z',
      'older',
    ]);
    state.mempoolRemovedTransactions$.next(tx('a'));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'newest',
      'pending',
      'z',
      'older',
    ]);
  });

  it('reconnects with a fresh first page, clearing stale live overrides and ignoring the obsolete inflight page', () => {
    const { component: c, api, pages, state, counts } = setup();
    pages[0].next(page([tx('restored')], 'old-next'));
    state.mempoolTransactions$.next(tx('stale-pending', false));
    state.mempoolRemovedTransactions$.next(tx('restored'));
    c.calculateCount();
    counts[0].next(count(50));
    c.loadMore();
    const oldPage = pages[1];
    state.connectionState$.next(2);
    state.connectionState$.next(2);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(2);
    state.connectionState$.next(0);
    state.connectionState$.next(2);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(3);
    // Only the disconnected -> connected transition refreshes the first page.
    expect(oldPage.observed).toBe(false);
    expect(c.transactions.map((item) => item.txid)).toEqual(['stale-pending']);
    expect(c.countResult.confirmedCount).toBe(50);
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      first,
      undefined,
      undefined
    );
    oldPage.next(page([tx('obsolete')]));
    expect(c.transactions.map((item) => item.txid)).toEqual(['stale-pending']);
    pages[2].next(page([tx('missed'), tx('restored')]));
    expect(c.transactions.map((item) => item.txid)).toEqual([
      'missed',
      'restored',
    ]);
    state.connectionState$.next(0);
    state.connectionState$.next(1);
    state.connectionState$.next(2);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(4);
    state.connectionState$.next(2);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(4);
  });

  it('cancels queued empty-page continuations at reconnect and resets terminal page state', () => {
    vi.useFakeTimers();
    const { component: c, api, pages, state } = setup();
    pages[0].next(page([], 'obsolete-cursor'));
    state.connectionState$.next(0);
    state.connectionState$.next(2);
    vi.runOnlyPendingTimers();
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(2);
    expect(api.getAddressTransactionPage$).toHaveBeenLastCalledWith(
      first,
      undefined,
      undefined
    );
    pages[1].error({
      status: 422,
      error: { code: 'ADDRESS_HISTORY_UNAVAILABLE', retryable: false },
    });
    expect(c.historyUnavailable).toBe(true);
    state.connectionState$.next(0);
    state.connectionState$.next(2);
    expect(c.historyUnavailable).toBe(false);
    expect(c.transactionError).toBeNull();
    expect(c.retryLoadMore).toBe(false);
    expect(c.fullyLoaded).toBe(false);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(3);
    pages[2].next(page([tx('recovered')]));
    expect(c.fullyLoaded).toBe(true);
  });

  it('loads pending count independently and accepts exact one and zero without a total calculation', () => {
    const { component: c, api, summaries, pages, pendingCounts } = setup();
    expect(c.pendingCount).toBeNull();
    expect(c.isLoadingPendingCount).toBe(true);
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(1);
    summaries[0].next({
      address: first,
      confirmedBalance: 123,
      pendingBalance: -5,
      electrum: true,
    });
    pages[0].next(page([tx('first')]));
    expect(c.isLoadingAddress).toBe(false);
    expect(c.isLoadingTransactions).toBe(false);
    expect(c.pendingCount).toBeNull();
    pendingCounts[0].next({ pendingTransactionCount: 1 });
    expect(c.pendingCount).toBe(1);
    expect(c.isLoadingPendingCount).toBe(false);
    expect(api.getAddressTransactionCount$).not.toHaveBeenCalled();
    c.refreshPendingCount();
    pendingCounts[1].next({ pendingTransactionCount: 0 });
    expect(c.pendingCount).toBe(0);
  });

  it('keeps balance and cards available through pending count failure and independent retry', () => {
    const { component: c, api, summaries, pages, pendingCounts } = setup();
    summaries[0].next({
      address: first,
      confirmedBalance: 123,
      pendingBalance: 0,
      electrum: true,
    });
    pages[0].next(page([tx('first')]));
    pendingCounts[0].error({ status: 503 });
    expect(c.pendingCount).toBeNull();
    expect(c.pendingCountError.status).toBe(503);
    expect(c.isLoadingPendingCount).toBe(false);
    expect(c.error).toBeNull();
    expect(c.transactionError).toBeNull();
    expect(c.chainStats.balance).toBe(123);
    expect(c.transactions[0].txid).toBe('first');
    c.refreshPendingCount();
    expect(c.pendingCountError).toBeNull();
    pendingCounts[1].next({ pendingTransactionCount: 1 });
    expect(c.pendingCount).toBe(1);
    expect(api.getAddressBalanceSummary$).toHaveBeenCalledTimes(1);
    expect(api.getAddressTransactionPage$).toHaveBeenCalledTimes(1);
  });

  it('coalesces live add, confirmation and removal refreshes and refreshes immediately after reconnect', () => {
    vi.useFakeTimers();
    const { component: c, api, pendingCounts, state } = setup();
    pendingCounts[0].next({ pendingTransactionCount: 1 });
    state.mempoolTransactions$.next(tx('new', false));
    state.blockTransactions$.next(tx('confirmed'));
    state.mempoolRemovedTransactions$.next(tx('removed', false));
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(1);
    vi.runOnlyPendingTimers();
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(2);
    expect(pendingCounts[0].observed).toBe(false);
    pendingCounts[1].next({ pendingTransactionCount: 0 });
    expect(c.pendingCount).toBe(0);
    state.connectionState$.next(0);
    state.connectionState$.next(2);
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(3);
    state.connectionState$.next(2);
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(3);
  });

  it('cancels pending count requests and coalesced work on navigation and uses the pubkey script after network changes', () => {
    vi.useFakeTimers();
    const { component: c, api, params, pendingCounts, state } = setup();
    state.mempoolTransactions$.next(tx('new', false));
    const pubkey = '02' + '11'.repeat(32);
    params.next(convertToParamMap({ id: pubkey }));
    expect(pendingCounts[0].observed).toBe(false);
    pendingCounts[0].next({ pendingTransactionCount: 99 });
    expect(c.pendingCount).toBeNull();
    vi.runOnlyPendingTimers();
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(2);
    expect(api.getAddressMempoolSummary$).toHaveBeenLastCalledWith(
      pubkey,
      '21' + pubkey + 'ac'
    );
    state.networkChanged$.next('chipnet');
    expect(pendingCounts[1].observed).toBe(false);
    expect(api.getAddressMempoolSummary$).toHaveBeenCalledTimes(3);
    pendingCounts[2].next({ pendingTransactionCount: 1 });
    expect(c.pendingCount).toBe(1);
  });

  it('uses the existing service pubkey hash convention and network path for the pending count endpoint', async () => {
    const requestedUrls: string[] = [];
    const get = vi.fn((url: string) => {
      requestedUrls.push(url);
      return of({ pendingTransactionCount: 1 });
    });
    const network = new BehaviorSubject('chipnet');
    const service = new ElectrsApiService(
      { get } as any,
      {
        isBrowser: true,
        env: { ROOT_NETWORK: '' },
        networkChanged$: network,
      } as any
    );
    const script = '21' + '02' + '11'.repeat(32) + 'ac';
    await firstValueFrom(service.getScriptHash$(script));
    const legacyUrl = requestedUrls[0];
    await firstValueFrom(service.getAddressMempoolSummary$('unused', script));
    expect(requestedUrls[1]).toBe(legacyUrl + '/mempool-summary');
    expect(requestedUrls[1]).toMatch(
      /^\/chipnet\/api\/scripthash\/[a-f0-9]{64}\/mempool-summary$/
    );
  });

  it('preserves the none backend flow', () => {
    const { component: c, api } = setup('none');
    expect(c.paginatedMode).toBe(false);
    expect(api.getAddress$).toHaveBeenCalledWith(first);
    expect(api.getAddressBalanceSummary$).not.toHaveBeenCalled();
    expect(api.getAddressTransactionPage$).not.toHaveBeenCalled();
  });
});
