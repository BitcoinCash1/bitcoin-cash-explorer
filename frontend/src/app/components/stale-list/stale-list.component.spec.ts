import '@angular/compiler';
import '@angular/localize/init';
import { BehaviorSubject, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { StaleList } from './stale-list.component';
import {
  StaleHistoryEntry,
  StaleHistoryPage,
  StaleTip,
} from '@interfaces/node-api.interface';

function entry(id: string): StaleHistoryEntry {
  return {
    stale: {
      id,
      height: 100,
      extras: { feeRange: [1, 2, 3, 4], medianFee: 2 },
    },
    canonical: null,
  } as StaleHistoryEntry;
}

function fixture(network: Subject<string> = new BehaviorSubject('')): {
  component: StaleList;
  api: {
    getStaleTips$: () => Subject<StaleTip[]>;
    getStaleHistory$: () => Subject<StaleHistoryPage>;
  };
  network: Subject<string>;
  recentRequests: Subject<StaleTip[]>[];
  historyRequests: Subject<StaleHistoryPage>[];
} {
  const recentRequests: Subject<StaleTip[]>[] = [];
  const historyRequests: Subject<StaleHistoryPage>[] = [];
  const api = {
    getStaleTips$: vi.fn(() => {
      const request = new Subject<StaleTip[]>();
      recentRequests.push(request);
      return request;
    }),
    getStaleHistory$: vi.fn(() => {
      const request = new Subject<StaleHistoryPage>();
      historyRequests.push(request);
      return request;
    }),
  };
  const component = new StaleList(
    api as never,
    {
      networkChanged$: network,
      network: '',
      env: { MIN_BLOCK_SIZE_UNITS: 32000000 },
    } as never,
    { setTitle: vi.fn(), setDescription: vi.fn() } as never,
    {} as never,
    { markForCheck: vi.fn() } as never
  );
  component.ngOnInit();
  return { component, api, network, recentRequests, historyRequests };
}

describe('stale history browsing', () => {
  it('loads the initial network even when no network change has been emitted', () => {
    const { component, api, network } = fixture(new Subject<string>());
    expect(api.getStaleTips$).toHaveBeenCalledTimes(1);
    expect(api.getStaleHistory$).toHaveBeenCalledTimes(1);
    network.next('');
    expect(api.getStaleHistory$).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });
  it('prevents overlapping pages and deduplicates by hash, including recent tips arriving later', () => {
    const { component, api, recentRequests, historyRequests } = fixture();
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenCalledTimes(1);
    historyRequests[0].next({
      entries: [entry('a'), entry('a'), entry('b')],
      nextCursor: 'cursor-1',
    });
    recentRequests[0].next([
      { ...entry('a'), status: 'valid-fork' },
      { ...entry('a'), status: 'valid-fork' },
    ] as StaleTip[]);
    expect(component.chainTips).toHaveLength(1);
    expect(
      component.visibleHistoryEntries.map((value) => value.stale.id)
    ).toEqual(['b']);
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenLastCalledWith('cursor-1');
    historyRequests[1].next({
      entries: [entry('b'), entry('c')],
      nextCursor: null,
    });
    expect(component.historyEntries.map((value) => value.stale.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(
      component.visibleHistoryEntries.map((value) => value.stale.id)
    ).toEqual(['b', 'c']);
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenCalledTimes(2);
    expect(component.historyEntries[0].canonical).toBeNull();
    component.ngOnDestroy();
  });

  it('keeps rows and cursor after errors and retries the failed page', () => {
    const { component, api, historyRequests } = fixture();
    historyRequests[0].next({ entries: [entry('a')], nextCursor: 'cursor-1' });
    component.loadMoreHistory();
    historyRequests[1].error({ status: 500 });
    expect(component.historyEntries.map((value) => value.stale.id)).toEqual([
      'a',
    ]);
    expect(component.historyError).toBe('failed');
    expect(component.historyLoading).toBe(false);
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenLastCalledWith('cursor-1');
    historyRequests[2].next({ entries: [entry('b')], nextCursor: null });
    expect(component.historyError).toBeNull();
    expect(component.historyEntries).toHaveLength(2);
    component.ngOnDestroy();
  });

  it('distinguishes successful empty exhaustion from unavailable history', () => {
    const { component, api, historyRequests, network } = fixture();
    historyRequests[0].next({ entries: [], nextCursor: null });
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenCalledTimes(1);
    expect(component.historyError).toBeNull();
    network.next('chipnet');
    historyRequests[1].error({ status: 503 });
    expect(component.historyError).toBe('unavailable');
    component.loadMoreHistory();
    expect(api.getStaleHistory$).toHaveBeenLastCalledWith(undefined);
    component.ngOnDestroy();
  });

  it('cancels pending requests on network changes and destruction, preventing old rows', () => {
    const { component, recentRequests, historyRequests, network } = fixture();
    expect(historyRequests[0].observed).toBe(true);
    expect(recentRequests[0].observed).toBe(true);
    network.next('testnet4');
    expect(historyRequests[0].observed).toBe(false);
    expect(recentRequests[0].observed).toBe(false);
    historyRequests[0].next({
      entries: [entry('old-network')],
      nextCursor: null,
    });
    expect(component.historyEntries).toEqual([]);
    historyRequests[1].next({
      entries: [entry('new-network')],
      nextCursor: 'new-cursor',
    });
    component.loadMoreHistory();
    component.ngOnDestroy();
    expect(historyRequests[2].observed).toBe(false);
    expect(recentRequests[1].observed).toBe(false);
    expect(network.observed).toBe(false);
  });
});
