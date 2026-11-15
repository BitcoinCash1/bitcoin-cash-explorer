import '@angular/compiler';
import { QueryList } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { EightBlocksComponent } from './eight-blocks.component';

afterEach(() => vi.useRealTimers());

function fixture() {
  const blocks = new Subject<any[]>();
  const transactions = new Subject<any[]>();
  const api = {
    getBlocks$: vi.fn(() => blocks),
    getStrippedBlockTransactions$: vi.fn(() => transactions),
  };
  const component = new EightBlocksComponent(
    { queryParams: new BehaviorSubject({ test: 'true' }) } as any,
    {} as any,
    {
      isBrowser: false,
      networkChanged$: new Subject(),
      markBlock$: new Subject(),
    } as any,
    { want: vi.fn() } as any,
    api as any,
    {} as any
  );
  component.blockGraphs = new QueryList();
  return { component, blocks, transactions, api };
}

it('stops test-mode polling on destruction', () => {
  vi.useFakeTimers();
  const { component, blocks, api } = fixture();
  component.ngOnInit();
  blocks.next([]);
  component.ngOnDestroy();
  vi.advanceTimersByTime(30000);
  expect(api.getBlocks$).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
});

it('cancels a pending polling response on destruction', () => {
  const { component, blocks } = fixture();
  component.ngOnInit();
  component.ngOnDestroy();
  expect(blocks.observers).toHaveLength(0);
});

it('cancels pending transactions without updating destroyed graphs or cache', async () => {
  const { component, transactions } = fixture();
  const update = vi.spyOn(component, 'updateBlockGraphs');
  const pending = component.handleNewBlock([
    { id: 'fixture', height: 1 },
  ] as any);
  component.ngOnDestroy();
  transactions.next([{ txid: 'late' }]);
  transactions.complete();
  await pending;
  expect(transactions.observers).toHaveLength(0);
  expect(update).not.toHaveBeenCalled();
  expect(component.strippedTransactions).toEqual({});
});
